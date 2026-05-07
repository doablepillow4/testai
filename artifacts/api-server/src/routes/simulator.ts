import { Router, type IRouter } from "express";
import { RunMonteCarloBody, RunMonteCarloResponse } from "@workspace/api-zod";
import { getGeoMarketsForAsset } from "../lib/polymarket-cache";
import { fetchPolymarketData, getFallbackMarkets } from "./polymarket";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/simulator/monte-carlo", async (req, res): Promise<void> => {
  const parsed = RunMonteCarloBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let {
    symbol,
    currentPrice,
    volatility,
    eventImpact,
    timeHorizon,
    simulations = 1000,
  } = parsed.data;

  simulations = Math.min(simulations, 2000);

  const dt = 1 / 252;
  const drift = 0;
  const vol = Math.max(0.001, volatility / 100);
  const impact = eventImpact / 100;
  const steps = Math.max(1, timeHorizon);
  const numSims = Math.min(2000, Math.max(100, simulations));

  const MAX_PATHS = 50;
  const paths: number[][] = [];
  const finalPrices: number[] = [];

  let worstDrawdown = 0;

  for (let sim = 0; sim < numSims; sim++) {
    const path: number[] = [currentPrice];
    let price = currentPrice;
    let peakPrice = currentPrice;
    let simDrawdown = 0;

    for (let step = 0; step < steps; step++) {
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
      const eventShock = step === 0 ? impact : 0;
      price =
        price * Math.exp((drift - 0.5 * vol * vol) * dt + vol * Math.sqrt(dt) * z + eventShock);
      if (price > peakPrice) peakPrice = price;
      const dd = (peakPrice - price) / peakPrice;
      if (dd > simDrawdown) simDrawdown = dd;
      path.push(parseFloat(price.toFixed(4)));
    }

    finalPrices.push(price);
    if (simDrawdown > worstDrawdown) worstDrawdown = simDrawdown;
    if (sim < MAX_PATHS) paths.push(path);
  }

  finalPrices.sort((a, b) => a - b);
  const p = (pct: number) =>
    finalPrices[Math.max(0, Math.floor((pct / 100) * finalPrices.length) - 1)] ?? finalPrices[0];
  const mean = finalPrices.reduce((a, b) => a + b, 0) / finalPrices.length;
  const bullish = finalPrices.filter((v) => v > currentPrice).length;

  const var95 = currentPrice * vol * Math.sqrt(dt) * 1.6449;
  const expectedReturn = currentPrice > 0 ? (mean - currentPrice) / currentPrice : 0;

  let geopoliticsContext = null;
  try {
    const allMarkets = await fetchPolymarketData(30);
    const relevant = getGeoMarketsForAsset(symbol, allMarkets);
    if (relevant.length > 0) geopoliticsContext = relevant;
  } catch {
    try {
      const fallback = getFallbackMarkets(20);
      const relevant = getGeoMarketsForAsset(symbol, fallback);
      if (relevant.length > 0) geopoliticsContext = relevant;
    } catch (err) {
      logger.warn({ err }, "Could not attach geo context to MC result");
    }
  }

  const result = {
    symbol,
    simulations: numSims,
    median: parseFloat(p(50).toFixed(2)),
    mean: parseFloat(mean.toFixed(2)),
    p10: parseFloat(p(10).toFixed(2)),
    p25: parseFloat(p(25).toFixed(2)),
    p75: parseFloat(p(75).toFixed(2)),
    p90: parseFloat(p(90).toFixed(2)),
    bullishProbability: parseFloat((bullish / numSims).toFixed(3)),
    bearishProbability: parseFloat(((numSims - bullish) / numSims).toFixed(3)),
    var95: parseFloat(var95.toFixed(2)),
    maxDrawdown: parseFloat(worstDrawdown.toFixed(4)),
    expectedReturn: parseFloat(expectedReturn.toFixed(4)),
    paths,
    geopoliticsContext,
  };

  res.json(RunMonteCarloResponse.parse(result));
});

export default router;
