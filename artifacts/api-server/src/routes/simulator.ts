import { Router, type IRouter } from "express";
import { RunMonteCarloBody, RunMonteCarloResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/simulator/monte-carlo", async (req, res): Promise<void> => {
  const parsed = RunMonteCarloBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { symbol, currentPrice, volatility, eventImpact, timeHorizon, simulations = 1000 } = parsed.data;

  const dt = 1 / 252;
  const drift = 0;
  const vol = Math.max(0.001, volatility / 100);
  const impact = eventImpact / 100;
  const steps = Math.max(1, timeHorizon);
  const numSims = Math.min(2000, Math.max(100, simulations));

  const MAX_PATHS = 50;
  const paths: number[][] = [];
  const finalPrices: number[] = [];

  for (let sim = 0; sim < numSims; sim++) {
    const path: number[] = [currentPrice];
    let price = currentPrice;

    for (let step = 0; step < steps; step++) {
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
      const eventShock = step === 0 ? impact : 0;
      price = price * Math.exp((drift - 0.5 * vol * vol) * dt + vol * Math.sqrt(dt) * z + eventShock);
      path.push(parseFloat(price.toFixed(2)));
    }

    finalPrices.push(price);
    if (sim < MAX_PATHS) paths.push(path);
  }

  finalPrices.sort((a, b) => a - b);
  const p = (pct: number) => finalPrices[Math.floor((pct / 100) * finalPrices.length)];
  const mean = finalPrices.reduce((a, b) => a + b, 0) / finalPrices.length;
  const bullish = finalPrices.filter((p) => p > currentPrice).length;

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
    paths,
  };

  res.json(RunMonteCarloResponse.parse(result));
});

export default router;
