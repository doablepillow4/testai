import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { predictionsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import {
  GetPredictionsResponse,
  CreatePredictionBody,
  GetPredictionsSummaryResponse,
} from "@workspace/api-zod";
import { generatePrediction, getPredictionsSummary, resolveExpiredPredictions } from "../lib/predictions-engine";
import { fetchStockPrice, fetchCryptoPrices, CRYPTO_ID_MAP } from "../lib/market-data";

const router: IRouter = Router();

router.get("/predictions", async (req, res): Promise<void> => {
  const all = await db
    .select()
    .from(predictionsTable)
    .orderBy(desc(predictionsTable.createdAt))
    .limit(50);

  const formatted = all.map((p) => ({
    ...p,
    signals: JSON.parse(p.signals),
    targetPrice: p.targetPrice,
    currentPrice: p.currentPrice,
    confidence: p.confidence,
    createdAt: p.createdAt.toISOString(),
    resolvedAt: p.resolvedAt?.toISOString() ?? null,
    outcome: (p.outcome as "correct" | "incorrect" | "pending" | null) ?? null,
  }));

  res.json(GetPredictionsResponse.parse(formatted));
});

router.post("/predictions", async (req, res): Promise<void> => {
  const parsed = CreatePredictionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { symbol, timeframe } = parsed.data;
  const upperSymbol = symbol.toUpperCase();

  let currentPrice = 100;
  try {
    if (upperSymbol in CRYPTO_ID_MAP) {
      const cryptos = await fetchCryptoPrices();
      const crypto = cryptos.find((c) => c.symbol === upperSymbol);
      currentPrice = crypto?.price ?? 100;
    } else {
      const stock = await fetchStockPrice(upperSymbol);
      currentPrice = stock.price;
    }
  } catch {
    currentPrice = 100;
  }

  const prediction = await generatePrediction(upperSymbol, timeframe ?? "7d", currentPrice);

  const [inserted] = await db
    .insert(predictionsTable)
    .values({
      symbol: prediction.symbol,
      direction: prediction.direction,
      targetPrice: prediction.targetPrice,
      currentPrice: prediction.currentPrice,
      confidence: prediction.confidence,
      timeframe: prediction.timeframe,
      signals: JSON.stringify(prediction.signals),
      outcome: null,
    })
    .returning();

  const prices = new Map<string, number>([[upperSymbol, currentPrice]]);
  resolveExpiredPredictions(prices).catch(() => {});

  res.status(201).json({
    id: inserted.id,
    symbol: inserted.symbol,
    direction: inserted.direction as "bullish" | "bearish" | "neutral",
    targetPrice: inserted.targetPrice,
    currentPrice: inserted.currentPrice,
    confidence: inserted.confidence,
    timeframe: inserted.timeframe,
    signals: prediction.signals,
    outcome: null,
    createdAt: inserted.createdAt.toISOString(),
    resolvedAt: null,
  });
});

router.get("/predictions/summary", async (_req, res): Promise<void> => {
  const summary = await getPredictionsSummary();
  res.json(GetPredictionsSummaryResponse.parse(summary));
});

export default router;
