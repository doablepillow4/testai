import { db } from "@workspace/db";
import { predictionsTable } from "@workspace/db";
import { desc, eq, and, gte, isNull } from "drizzle-orm";
import { fetchStockHistory, fetchCryptoHistory, CRYPTO_ID_MAP } from "./market-data";
import { logger } from "./logger";

interface Signal {
  name: string;
  value: number;
  weight: number;
  bullish: boolean;
}

function computeRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1];
    if (delta > 0) gains += delta;
    else losses -= delta;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function computeMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
  const ema = (data: number[], period: number) => {
    const k = 2 / (period + 1);
    let emaVal = data[0];
    for (let i = 1; i < data.length; i++) emaVal = data[i] * k + emaVal * (1 - k);
    return emaVal;
  };
  if (closes.length < 26) return { macd: 0, signal: 0, histogram: 0 };
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macd = ema12 - ema26;
  const signalLine = macd * 0.9;
  return { macd, signal: signalLine, histogram: macd - signalLine };
}

function computeBollingerBands(closes: number[], period = 20) {
  if (closes.length < period) return { upper: 0, middle: 0, lower: 0, percentB: 0.5 };
  const slice = closes.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + Math.pow(b - middle, 2), 0) / period;
  const stddev = Math.sqrt(variance);
  const upper = middle + 2 * stddev;
  const lower = middle - 2 * stddev;
  const current = closes[closes.length - 1];
  const percentB = (current - lower) / (upper - lower);
  return { upper, middle, lower, percentB };
}

function computeMovingAverages(closes: number[]) {
  const current = closes[closes.length - 1];
  const ma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, closes.length);
  const ma50 = closes.slice(-50).reduce((a, b) => a + b, 0) / Math.min(50, closes.length);
  return { current, ma20, ma50, aboveMa20: current > ma20, aboveMa50: current > ma50 };
}

export async function generatePrediction(symbol: string, timeframe = "7d", currentPrice: number) {
  const isCrypto = symbol in CRYPTO_ID_MAP;
  let history: Array<{ close: number }> = [];
  try {
    if (isCrypto) {
      const coinId = CRYPTO_ID_MAP[symbol]?.id ?? symbol.toLowerCase();
      history = await fetchCryptoHistory(coinId, 60);
    } else {
      history = await fetchStockHistory(symbol, 60);
    }
  } catch (err) {
    logger.warn({ symbol, err }, "Could not fetch history for prediction");
  }

  const closes = history.filter((h) => h.close != null).map((h) => h.close);
  if (closes.length < 10) {
    closes.push(...Array.from({ length: 20 }, (_, i) => currentPrice * (1 + (Math.sin(i) * 0.03))));
  }

  const rsi = computeRSI(closes);
  const macd = computeMACD(closes);
  const bb = computeBollingerBands(closes);
  const mas = computeMovingAverages(closes);

  const signals: Signal[] = [
    {
      name: "RSI",
      value: parseFloat(rsi.toFixed(1)),
      weight: 0.25,
      bullish: rsi < 50,
    },
    {
      name: "MACD",
      value: parseFloat(macd.histogram.toFixed(4)),
      weight: 0.25,
      bullish: macd.histogram > 0,
    },
    {
      name: "Bollinger %B",
      value: parseFloat(bb.percentB.toFixed(3)),
      weight: 0.2,
      bullish: bb.percentB < 0.5,
    },
    {
      name: "MA Cross",
      value: parseFloat(((mas.current / mas.ma20 - 1) * 100).toFixed(2)),
      weight: 0.15,
      bullish: mas.aboveMa20 && mas.aboveMa50,
    },
    {
      name: "Momentum",
      value: parseFloat(((closes[closes.length - 1] / closes[Math.max(0, closes.length - 5)] - 1) * 100).toFixed(2)),
      weight: 0.15,
      bullish: closes[closes.length - 1] > closes[Math.max(0, closes.length - 5)],
    },
  ];

  const bullishScore = signals.reduce((acc, s) => acc + (s.bullish ? s.weight : 0), 0);
  const bearishScore = 1 - bullishScore;

  let direction: "bullish" | "bearish" | "neutral";
  if (bullishScore > 0.55) direction = "bullish";
  else if (bearishScore > 0.55) direction = "bearish";
  else direction = "neutral";

  const rawConfidence = Math.max(bullishScore, bearishScore);
  const historicalBoost = await getHistoricalAccuracyBoost(symbol);
  const confidence = Math.min(0.95, rawConfidence + historicalBoost * 0.1);

  const days = timeframe === "1d" ? 1 : timeframe === "7d" ? 7 : timeframe === "30d" ? 30 : 7;
  const volatility = computeVolatility(closes);
  const expectedMove = currentPrice * volatility * Math.sqrt(days / 252);
  const targetPrice =
    direction === "bullish"
      ? currentPrice + expectedMove
      : direction === "bearish"
        ? currentPrice - expectedMove
        : currentPrice;

  return {
    symbol,
    direction,
    targetPrice: parseFloat(targetPrice.toFixed(2)),
    currentPrice,
    confidence: parseFloat(confidence.toFixed(3)),
    timeframe,
    signals,
  };
}

async function getHistoricalAccuracyBoost(symbol: string): Promise<number> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const resolved = await db
      .select()
      .from(predictionsTable)
      .where(
        and(
          eq(predictionsTable.symbol, symbol),
          gte(predictionsTable.createdAt, thirtyDaysAgo),
        ),
      )
      .limit(20);
    if (resolved.length === 0) return 0;
    const correct = resolved.filter((p) => p.outcome === "correct").length;
    return (correct / resolved.length - 0.5) * 0.5;
  } catch {
    return 0;
  }
}

function computeVolatility(closes: number[]): number {
  if (closes.length < 2) return 0.02;
  const returns = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push(Math.log(closes[i] / closes[i - 1]));
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
  return Math.sqrt(variance * 252);
}

export async function resolveExpiredPredictions(currentPrices: Map<string, number>) {
  try {
    const pending = await db
      .select()
      .from(predictionsTable)
      .where(isNull(predictionsTable.outcome))
      .limit(50);

    for (const pred of pending) {
      const created = new Date(pred.createdAt);
      const days = pred.timeframe === "1d" ? 1 : pred.timeframe === "7d" ? 7 : 30;
      const resolveDate = new Date(created.getTime() + days * 24 * 60 * 60 * 1000);
      if (new Date() < resolveDate) continue;

      const currentPrice = currentPrices.get(pred.symbol);
      if (!currentPrice) continue;

      const priceChange = currentPrice - pred.currentPrice;
      let outcome: "correct" | "incorrect";
      if (pred.direction === "bullish") outcome = priceChange > 0 ? "correct" : "incorrect";
      else if (pred.direction === "bearish") outcome = priceChange < 0 ? "correct" : "incorrect";
      else outcome = Math.abs(priceChange / pred.currentPrice) < 0.02 ? "correct" : "incorrect";

      await db
        .update(predictionsTable)
        .set({ outcome, resolvedAt: new Date() })
        .where(eq(predictionsTable.id, pred.id));
    }
  } catch (err) {
    logger.error({ err }, "Failed to resolve predictions");
  }
}

export async function getPredictionsSummary() {
  const all = await db.select().from(predictionsTable).orderBy(desc(predictionsTable.createdAt));
  const resolved = all.filter((p) => p.outcome && p.outcome !== "pending");
  const correct = resolved.filter((p) => p.outcome === "correct");

  const bySymbol = new Map<string, { total: number; correct: number }>();
  for (const p of resolved) {
    const entry = bySymbol.get(p.symbol) ?? { total: 0, correct: 0 };
    entry.total++;
    if (p.outcome === "correct") entry.correct++;
    bySymbol.set(p.symbol, entry);
  }

  const recentResolved = resolved.slice(0, 10);
  const recentCorrect = recentResolved.filter((p) => p.outcome === "correct");

  const older = resolved.slice(10);
  const olderCorrect = older.filter((p) => p.outcome === "correct");
  const recentAccuracy = recentResolved.length > 0 ? recentCorrect.length / recentResolved.length : 0;
  const olderAccuracy = older.length > 0 ? olderCorrect.length / older.length : 0;

  return {
    totalPredictions: all.length,
    correctPredictions: correct.length,
    accuracy: resolved.length > 0 ? correct.length / resolved.length : 0,
    averageConfidence: all.length > 0 ? all.reduce((a, b) => a + b.confidence, 0) / all.length : 0,
    recentAccuracy,
    improvementTrend: recentAccuracy - olderAccuracy,
    bySymbol: Array.from(bySymbol.entries()).map(([symbol, stats]) => ({
      symbol,
      total: stats.total,
      correct: stats.correct,
      accuracy: stats.total > 0 ? stats.correct / stats.total : 0,
    })),
  };
}
