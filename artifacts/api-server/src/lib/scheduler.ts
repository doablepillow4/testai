import { db } from "@workspace/db";
import { predictionsTable, agentStatesTable } from "@workspace/db";
import { isNull, eq } from "drizzle-orm";
import { logger } from "./logger";
import { resolveExpiredPredictions } from "./predictions-engine";
import { fetchStockPrice, fetchCryptoPrices, CRYPTO_ID_MAP } from "./market-data";
import { getAllAgentStates, getStaticAgentStates } from "./lattice/lattice-engine";

export interface TrainingCycleResult {
  resolved: number;
  improved: number;
  accuracyGain: number;
  agentUpdates: Array<{
    agentType: string;
    oldReputation: number;
    newReputation: number;
    delta: number;
    reason: string;
  }>;
  message: string;
}

export interface SchedulerStatus {
  running: boolean;
  intervalMs: number;
  cycleCount: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastResult: TrainingCycleResult | null;
}

// ─── Module-level state ────────────────────────────────────────────────────────
let _timer: ReturnType<typeof setInterval> | null = null;
let _running = false;
let _intervalMs = 15 * 60 * 1000;
let _cycleCount = 0;
let _lastRunAt: Date | null = null;
let _nextRunAt: Date | null = null;
let _lastResult: TrainingCycleResult | null = null;

// ─── Core training cycle (also called directly by POST /lattice/train) ─────────
export async function runTrainingCycle(): Promise<TrainingCycleResult> {
  logger.info({ cycle: _cycleCount + 1 }, "Scheduler: training cycle started");
  const t0 = Date.now();

  // 1. Fetch pending predictions
  const pending = await db
    .select()
    .from(predictionsTable)
    .where(isNull(predictionsTable.outcome))
    .limit(100);

  // 2. Build price map for every symbol that has pending predictions
  const priceMap = new Map<string, number>();
  const symbols = [...new Set(pending.map((p) => p.symbol))];

  const cryptoPrices = await fetchCryptoPrices().catch(() => []);
  for (const cp of cryptoPrices) priceMap.set(cp.symbol, cp.price);

  const stockSymbols = symbols.filter((s) => !(s in CRYPTO_ID_MAP));
  await Promise.allSettled(
    stockSymbols.map(async (sym) => {
      const q = await fetchStockPrice(sym).catch(() => null);
      if (q) priceMap.set(sym, q.price);
    }),
  );

  // 3. Resolve any predictions that have passed their timeframe
  await resolveExpiredPredictions(priceMap);

  // 4. Reload resolved outcomes for Brier-score computation
  const [resolved, incorrect] = await Promise.all([
    db.select().from(predictionsTable).where(eq(predictionsTable.outcome, "correct")).limit(200),
    db.select().from(predictionsTable).where(eq(predictionsTable.outcome, "incorrect")).limit(200),
  ]);

  const resolvedCount = resolved.length + incorrect.length;

  // 5. Bucket predictions by agent type using the stored RSI signal
  const agentTypeAccuracy: Record<string, { correct: number; total: number }> = {
    hypothesis_momentum: { correct: 0, total: 0 },
    hypothesis_meanrevert: { correct: 0, total: 0 },
    hypothesis_volregime: { correct: 0, total: 0 },
    hypothesis_hive: { correct: 0, total: 0 },
    critique_devil: { correct: 0, total: 0 },
    critique_tailrisk: { correct: 0, total: 0 },
  };

  for (const pred of resolved) {
    const rsi = parseFloat(
      JSON.parse(pred.signals ?? "[]").find((s: { name: string }) => s.name === "RSI")?.value ??
        "50",
    );
    if (rsi < 40) agentTypeAccuracy.hypothesis_meanrevert.correct++;
    if (rsi > 60) agentTypeAccuracy.hypothesis_momentum.correct++;
    agentTypeAccuracy.hypothesis_volregime.correct++;
    agentTypeAccuracy.hypothesis_momentum.total++;
    agentTypeAccuracy.hypothesis_meanrevert.total++;
    agentTypeAccuracy.hypothesis_volregime.total++;
  }
  for (const _ of incorrect) {
    agentTypeAccuracy.hypothesis_momentum.total++;
    agentTypeAccuracy.hypothesis_meanrevert.total++;
    agentTypeAccuracy.hypothesis_volregime.total++;
  }

  // 6. Update agent reputations in DB
  const existingStates = await getAllAgentStates().catch(() => getStaticAgentStates());
  const agentUpdates: TrainingCycleResult["agentUpdates"] = [];
  let improved = 0;

  for (const [agentType, acc] of Object.entries(agentTypeAccuracy)) {
    if (acc.total === 0) continue;
    const accuracy = acc.correct / acc.total;
    const existing = existingStates.find((s) => s.agentType === agentType);
    const oldRep = existing?.reputation ?? 1.0;
    const brierSignal = (accuracy - 0.5) * 0.1;
    const newRep = Math.max(0.1, Math.min(3.0, oldRep + brierSignal));
    const delta = parseFloat((newRep - oldRep).toFixed(4));

    if (Math.abs(delta) > 0.001) {
      try {
        const rows = await db
          .select()
          .from(agentStatesTable)
          .where(eq(agentStatesTable.agentType, agentType));
        if (rows.length > 0) {
          await db
            .update(agentStatesTable)
            .set({
              reputation: parseFloat(newRep.toFixed(4)),
              brierScore: parseFloat((1 - accuracy).toFixed(4)),
              correctRuns: (rows[0].correctRuns ?? 0) + acc.correct,
              totalRuns: (rows[0].totalRuns ?? 0) + acc.total,
              updatedAt: new Date(),
            })
            .where(eq(agentStatesTable.agentType, agentType));
        }
      } catch (err) {
        logger.warn({ err, agentType }, "Scheduler: failed to update agent state");
      }

      agentUpdates.push({
        agentType,
        oldReputation: parseFloat(oldRep.toFixed(4)),
        newReputation: parseFloat(newRep.toFixed(4)),
        delta,
        reason: `${acc.correct}/${acc.total} correct (${(accuracy * 100).toFixed(0)}% accuracy) → ${delta > 0 ? "reputation boost" : "reputation penalty"}`,
      });
      if (delta > 0) improved++;
    }
  }

  const accuracyGain =
    agentUpdates.length > 0
      ? agentUpdates.reduce((sum, u) => sum + u.delta, 0) / agentUpdates.length
      : 0;

  const message =
    resolvedCount === 0
      ? "No expired predictions to resolve yet."
      : `Resolved ${resolvedCount} predictions. Updated ${agentUpdates.length} agent reputations. ${improved} agents improved.`;

  const result: TrainingCycleResult = {
    resolved: resolvedCount,
    improved,
    agentUpdates,
    accuracyGain: parseFloat(accuracyGain.toFixed(4)),
    message,
  };

  logger.info(
    {
      resolved: resolvedCount,
      improved,
      agentUpdates: agentUpdates.length,
      accuracyGain: result.accuracyGain,
      durationMs: Date.now() - t0,
      cycle: _cycleCount + 1,
    },
    "Scheduler: training cycle complete",
  );

  return result;
}

// ─── Internal tick ─────────────────────────────────────────────────────────────
async function tick(): Promise<void> {
  _lastRunAt = new Date();
  _nextRunAt = new Date(Date.now() + _intervalMs);

  try {
    _lastResult = await runTrainingCycle();
    _cycleCount++;
  } catch (err) {
    logger.error({ err }, "Scheduler: training cycle threw unexpectedly");
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────
export function startScheduler(intervalMs?: number): void {
  if (_timer) return; // already running

  const envMs = parseInt(process.env["SCHEDULER_INTERVAL_MS"] ?? "0");
  _intervalMs = intervalMs ?? (envMs > 0 ? envMs : 15 * 60 * 1000);
  _running = true;
  _nextRunAt = new Date(Date.now() + _intervalMs);

  _timer = setInterval(() => {
    tick().catch((err) => logger.error({ err }, "Scheduler: unhandled tick error"));
  }, _intervalMs);

  // Allow the process to exit even if the timer is still registered
  if (typeof _timer.unref === "function") _timer.unref();

  logger.info({ intervalMs: _intervalMs }, "Scheduler started");
}

export function stopScheduler(): void {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
  _running = false;
  _nextRunAt = null;
  logger.info("Scheduler stopped");
}

export function getSchedulerStatus(): SchedulerStatus {
  return {
    running: _running,
    intervalMs: _intervalMs,
    cycleCount: _cycleCount,
    lastRunAt: _lastRunAt?.toISOString() ?? null,
    nextRunAt: _nextRunAt?.toISOString() ?? null,
    lastResult: _lastResult,
  };
}
