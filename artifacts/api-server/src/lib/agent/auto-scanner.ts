import { logger } from "../logger";
import { logAgentEvent } from "./agent-log";
import { runLattice } from "../lattice/lattice-engine";
import { fetchCryptoPrices, fetchStockPrice, STOCK_SYMBOL_LIST, CRYPTO_ID_MAP } from "../market-data";
import { fetchGeopoliticsNews } from "../news";
import { pool } from "@workspace/db";
import { getSchedulerStatus } from "../scheduler";

export interface ScanResult {
  scannedAt: string;
  durationMs: number;
  symbolsScanned: number;
  alerts: ScanAlert[];
  summary: string;
}

export interface ScanAlert {
  symbol: string;
  direction: "bullish" | "bearish" | "neutral";
  hivemindScore: number;
  confidence: number;
  regime: string;
  reason: string;
  urgency: "high" | "medium" | "low";
}

export interface HealthSnapshot {
  status: "ok" | "degraded" | "critical";
  db: "ok" | "degraded";
  uptime: number;
  scheduler: ReturnType<typeof getSchedulerStatus>;
  anomalies: string[];
  checkedAt: string;
}

let _lastScan: ScanResult | null = null;
let _lastHealth: HealthSnapshot | null = null;
let _scanRunning = false;

// Which symbols to prioritize in autonomous scans
// Rotates through all assets over multiple scans
const SCAN_PRIORITY: string[] = ["BTC", "ETH", "NVDA", "SPY", "SOL", "TSLA", "AAPL", "MSFT"];

function scoreUrgency(hivemindScore: number, confidence: number, regime: string): "high" | "medium" | "low" {
  if (regime === "crisis" && confidence > 0.7) return "high";
  if (hivemindScore >= 75 && confidence > 0.65) return "high";
  if (hivemindScore >= 60 && confidence > 0.5) return "medium";
  return "low";
}

function buildAlertReason(direction: string, hivemindScore: number, regime: string, confidence: number): string {
  const dir = direction === "bullish" ? "strong buy" : direction === "bearish" ? "strong sell" : "neutral/hold";
  const conf = (confidence * 100).toFixed(0);
  const regimeDesc = regime === "crisis" ? "crisis regime" : regime === "volatile" ? "volatile regime" : "calm regime";
  return `Hivemind signals ${dir} (score ${hivemindScore.toFixed(0)}, ${conf}% confidence) in ${regimeDesc}`;
}

export async function runAutonomousScan(symbolOverride?: string[]): Promise<ScanResult> {
  if (_scanRunning) {
    return _lastScan ?? {
      scannedAt: new Date().toISOString(),
      durationMs: 0,
      symbolsScanned: 0,
      alerts: [],
      summary: "Scan already in progress — try again shortly.",
    };
  }

  _scanRunning = true;
  const t0 = Date.now();
  const symbols = symbolOverride ?? SCAN_PRIORITY;
  const alerts: ScanAlert[] = [];

  logAgentEvent("scan_started", `Autonomous scan started for ${symbols.length} symbols`, { symbols });

  try {
    await Promise.allSettled(
      symbols.map(async (symbol) => {
        try {
          const result = await runLattice(symbol, "7d", false);
          const { finalPrediction, regime } = result;
          const urgency = scoreUrgency(finalPrediction.hivemindScore, finalPrediction.confidence, regime);

          // Only surface alerts for meaningful signals
          if (finalPrediction.hivemindScore >= 55 || regime === "crisis") {
            const alert: ScanAlert = {
              symbol,
              direction: finalPrediction.direction,
              hivemindScore: finalPrediction.hivemindScore,
              confidence: finalPrediction.confidence,
              regime,
              reason: buildAlertReason(finalPrediction.direction, finalPrediction.hivemindScore, regime, finalPrediction.confidence),
              urgency,
            };
            alerts.push(alert);

            logAgentEvent("scan_symbol_done", `${symbol}: ${finalPrediction.direction} (score ${finalPrediction.hivemindScore.toFixed(0)})`, {
              symbol,
              direction: finalPrediction.direction,
              hivemindScore: finalPrediction.hivemindScore,
              urgency,
            });
          }
        } catch (err) {
          logger.warn({ symbol, err }, "Auto-scanner: lattice run failed for symbol");
        }
      }),
    );

    alerts.sort((a, b) => b.hivemindScore - a.hivemindScore);

    const highCount = alerts.filter((a) => a.urgency === "high").length;
    const summary =
      alerts.length === 0
        ? `Scan complete. All ${symbols.length} symbols within normal parameters — no strong signals detected.`
        : `Scan complete. ${alerts.length} signal(s) detected across ${symbols.length} symbols. ${highCount} high-urgency alert(s). Top: ${alerts[0]?.symbol} ${alerts[0]?.direction} (score ${alerts[0]?.hivemindScore.toFixed(0)}).`;

    const scan: ScanResult = {
      scannedAt: new Date().toISOString(),
      durationMs: Date.now() - t0,
      symbolsScanned: symbols.length,
      alerts,
      summary,
    };

    _lastScan = scan;

    logAgentEvent("scan_completed", summary, { alertCount: alerts.length, durationMs: scan.durationMs });

    return scan;
  } finally {
    // Always release the lock, even if an unexpected error is thrown above.
    _scanRunning = false;
  }
}

export function getLastScan(): ScanResult | null {
  return _lastScan;
}

export async function runHealthCheck(): Promise<HealthSnapshot> {
  const anomalies: string[] = [];

  let dbStatus: "ok" | "degraded" = "ok";
  try {
    await pool.query("SELECT 1");
  } catch {
    dbStatus = "degraded";
    anomalies.push("Database connection is unreachable");
  }

  const scheduler = getSchedulerStatus();
  if (!scheduler.running) {
    anomalies.push("Scheduler is not running");
  }

  const uptime = Math.floor(process.uptime());
  if (uptime < 30) {
    anomalies.push("Server recently restarted (uptime < 30s)");
  }

  let overallStatus: "ok" | "degraded" | "critical" = "ok";
  if (dbStatus === "degraded") overallStatus = "critical";
  else if (anomalies.length > 0) overallStatus = "degraded";

  const snapshot: HealthSnapshot = {
    status: overallStatus,
    db: dbStatus,
    uptime,
    scheduler,
    anomalies,
    checkedAt: new Date().toISOString(),
  };

  _lastHealth = snapshot;

  if (overallStatus !== "ok") {
    logAgentEvent("health_alert", `Health check: ${overallStatus} — ${anomalies.join(", ")}`, { anomalies });
  } else {
    logAgentEvent("health_ok", `Health check passed. DB ok, scheduler running, uptime ${uptime}s`);
  }

  return snapshot;
}

export function getLastHealth(): HealthSnapshot | null {
  return _lastHealth;
}

export function isScanRunning(): boolean {
  return _scanRunning;
}
