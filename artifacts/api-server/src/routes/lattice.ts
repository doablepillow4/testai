import { Router, type IRouter } from "express";
import {
  RunLatticeBody,
  RunLatticeResponse,
  GetLatticeAgentsResponse,
  GetMarketRegimeQueryParams,
  GetMarketRegimeResponse,
  LatticeChallengeBody,
  LatticeChallengeResponse,
  RunLatticeTrainingResponse,
  GetBeliefHistoryParams,
  GetBeliefHistoryQueryParams,
  GetBeliefHistoryResponse,
} from "@workspace/api-zod";
import { runLattice, getAllAgentStates, getStaticAgentStates } from "../lib/lattice/lattice-engine";
import { queryBeliefHistory } from "../lib/lattice/belief-state";
import { detectRegime, describeRegime } from "../lib/lattice/regime-detector";
import { fetchStockHistory, fetchCryptoHistory, CRYPTO_ID_MAP } from "../lib/market-data";
import { db } from "@workspace/db";
import { latticeRunsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { runTrainingCycle } from "../lib/scheduler";
import { getGeoMarketsForAsset, buildPolymarketHeadline } from "../lib/polymarket-cache";
import { fetchPolymarketData } from "./polymarket";
import { logger } from "../lib/logger";
import { latticeCache, TTL } from "../lib/cache";

const router: IRouter = Router();

router.post("/lattice/run", async (req, res): Promise<void> => {
  const parsed = RunLatticeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { symbol, timeframe = "7d", useV3 = false } = parsed.data;
  const sym = symbol.toUpperCase();

  try {
    const cacheKey = `lattice:run:${sym}:${timeframe}:${useV3 ? "v3" : "v2"}`;
    const cached = latticeCache.get<object>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const [latticeResult, polyData] = await Promise.allSettled([
      runLattice(sym, timeframe, useV3),
      fetchPolymarketData(30),
    ]);

    if (latticeResult.status === "rejected") {
      throw latticeResult.reason;
    }

    const result = latticeResult.value;
    const markets = polyData.status === "fulfilled" ? polyData.value : [];

    const geoMarkets = getGeoMarketsForAsset(sym, markets);
    const polymarketIntel = geoMarkets.slice(0, 5).map((m) => ({
      headline: buildPolymarketHeadline(m),
      question: m.question,
      yesPrice: m.yesPrice,
      oddsShift: m.oddsShift,
      marketImpact: m.marketImpact,
      category: m.category,
      volume: m.volume,
    }));

    const enrichedResult = {
      ...result,
      polymarketIntel: polymarketIntel.length > 0 ? polymarketIntel : null,
    };

    const parsed2 = RunLatticeResponse.parse(enrichedResult);
    latticeCache.set(cacheKey, parsed2, TTL.LATTICE_RUN);
    res.json(parsed2);
  } catch (err) {
    logger.error({ err, symbol }, "Lattice run failed");
    res.status(500).json({ error: "Lattice run failed" });
  }
});

router.post("/lattice/challenge", async (req, res): Promise<void> => {
  const parsed = LatticeChallengeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { agentType, challenge, symbol, currentProbability } = parsed.data;
  const lower = challenge.toLowerCase();

  let adjustment = 0;
  let response = "";

  if (/recession|downturn|bear market|contraction/.test(lower)) {
    adjustment = -0.07;
    response = `Recession risk is a material concern. Historical precedent shows risk assets underperform by 25–40% during NBER-defined contractions. For ${symbol}, I'm applying a macro-headwind discount — growth multiples compress as earnings expectations reset downward. Revising probability lower.`;
  } else if (/fed|rate hike|interest rate|monetary tighten|hawkish/.test(lower)) {
    adjustment = -0.05;
    response = `Federal Reserve policy is a critical macro variable. Each 25bps hike increases the discount rate applied to future cash flows, compressing equity multiples by ~4-6% on a DCF basis. For high-growth names like ${symbol}, this headwind is amplified by duration sensitivity.`;
  } else if (/inflation/.test(lower)) {
    adjustment = -0.04;
    response = `Persistent inflation erodes real earnings power and locks central banks into restrictive stances longer than consensus expects. For ${symbol}, margin pressure from input cost inflation and the ceiling on PE expansion both weigh on probability. Revising slightly lower.`;
  } else if (/debt|balance sheet|leverage|bankruptcy|default/.test(lower)) {
    adjustment = -0.06;
    response = `Balance sheet risk is a direct hit to enterprise value. Elevated leverage in a rising-rate environment increases refinancing risk and reduces operating flexibility. For ${symbol}, this injects tail-risk into the bear case that I must account for.`;
  } else if (/china|taiwan|war|conflict|geopolit|sanction/.test(lower)) {
    adjustment = -0.07;
    response = `Geopolitical tail risk is systematically underweighted by standard models. Conflict risk scenarios introduce supply-chain disruption, export control acceleration, and risk-off positioning that cascades through equity markets. For ${symbol}, the causal transmission chains are real — adjusting tail-risk premium upward.`;
  } else if (/regulat|sec|ban|antitrust|probe|investigation/.test(lower)) {
    adjustment = -0.08;
    response = `Regulatory risk introduces a discount ceiling on the upside case. Whether it's SEC enforcement, antitrust action, or legislative uncertainty, these events reduce investor confidence and limit institutional positioning. For ${symbol}, this is a legitimate headwind I'm incorporating.`;
  } else if (/(earnings|revenue|guidance).*(miss|disappoint|cut|lower|poor|weak)/.test(lower)) {
    adjustment = -0.09;
    response = `Earnings disappointment fundamentally revises the bull thesis. If revenue growth is decelerating and management is cutting guidance, the market will re-rate the multiple downward — potentially aggressively. For ${symbol}, I'm revising my probability materially lower on this new fundamental information.`;
  } else if (/(earnings|revenue|guidance).*(beat|strong|raise|better|great|exceed)/.test(lower)) {
    adjustment = +0.08;
    response = `Strong earnings validate the fundamental bull thesis. Revenue growth beating consensus and raised guidance typically triggers a re-rating event, as institutional investors revise their price targets upward. For ${symbol}, this is a credible positive catalyst — revising probability higher.`;
  } else if (/etf|institutional|pension|fund.*buy|accumulate/.test(lower)) {
    adjustment = +0.06;
    response = `Institutional demand flow is a structural tailwind that changes supply/demand dynamics at the margin. ETF inflows create programmatic buying pressure independent of individual stock selection. For ${symbol}, persistent institutional accumulation is a positive signal I'm incorporating.`;
  } else if (/buyback|share repurchase|dividend|capital return/.test(lower)) {
    adjustment = +0.05;
    response = `Capital return programs signal management's confidence in the forward business trajectory. Buybacks reduce float and are EPS-accretive, while dividends attract income-seeking institutional holders. For ${symbol}, this is a positive signal that tightens the downside distribution.`;
  } else if (/ai|artificial intelligence|llm|machine learning|data center/.test(lower)) {
    adjustment = +0.06;
    response = `The AI secular cycle is a multi-year structural driver of revenue growth and pricing power for exposed names. The capex wave from hyperscalers is still in early innings. For ${symbol}, genuine AI exposure is a credible bull catalyst that I'm incorporating into my probability.`;
  } else if (/breakout|all.?time high|ath|resistance.*break|momentum.*bull/.test(lower)) {
    adjustment = +0.05;
    response = `Technical breakouts above key resistance trigger systematic trend-following capital inflows from CTAs and momentum funds. The mechanics of market structure create self-reinforcing buying pressure at all-time highs. For ${symbol}, this technical catalyst is a legitimate factor.`;
  } else if (/rate cut|pivot|dovish|easing|qe/.test(lower)) {
    adjustment = +0.07;
    response = `Monetary easing is a powerful tailwind for risk assets. A Fed pivot compresses the risk-free rate, expands equity multiples on a DCF basis, and triggers a rotation from bonds to equities. For ${symbol}, this macro shift is a genuine bull catalyst — revising probability higher.`;
  } else if (/underval|cheap|discount|low pe|margin of safety/.test(lower)) {
    adjustment = +0.04;
    response = `Valuation support provides a margin of safety that asymmetrically skews the risk/reward in the bull direction. When ${symbol} trades at a meaningful discount to intrinsic value or peers, downside is cushioned and upside is uncapped. This is a constructive factor.`;
  } else if (/breakdown|support.*fail|crash|collapse/.test(lower)) {
    adjustment = -0.07;
    response = `Technical breakdown below key support levels triggers systematic selling from trend-following models. Stop-loss cascades and forced liquidations can amplify the initial move. For ${symbol}, structural buyers exit on such breaks, and I'm revising downside risk higher.`;
  } else if (/ceasefire|peace|treaty|truce/.test(lower)) {
    adjustment = +0.04;
    response = `A ceasefire or peace agreement reduces geopolitical tail risk premium that markets have been pricing. For ${symbol}, reduced conflict risk means commodity supply chains normalize and risk-off positioning reverses — a net positive catalyst. Revising probability slightly higher.`;
  } else if (/nuclear|nuke|warhead|escalat/.test(lower)) {
    adjustment = -0.1;
    response = `Nuclear escalation risk is the most extreme tail event in modern geopolitics. The market impact would be severe, non-linear, and largely unpriceable — which is exactly why tail-risk models demand the largest probability discounts. For ${symbol}, this is a significant bearish adjustment.`;
  } else if (/ukraine|russia|zelensky|putin/.test(lower)) {
    adjustment = -0.05;
    response = `The Russia-Ukraine conflict continues to act as a geopolitical shadow over European assets, energy markets, and global sentiment. For ${symbol}, any escalation in hostilities would trigger commodity price spikes and risk-off rotation. I'm applying a moderate geopolitical risk discount.`;
  } else {
    adjustment = 0;
    response = `Your challenge raises a nuanced consideration. After reviewing the argument, I note the signal-to-noise ratio is limited given current information. While I acknowledge the uncertainty this introduces, the preponderance of evidence still supports my existing thesis for ${symbol}. I'm holding my probability estimate but flagging this as an area to monitor.`;
  }

  const newProbability = Math.max(0.05, Math.min(0.95, currentProbability + adjustment));
  res.json(
    LatticeChallengeResponse.parse({
      agentType,
      response,
      adjustment: parseFloat(adjustment.toFixed(4)),
      newProbability: parseFloat(newProbability.toFixed(4)),
    }),
  );
});

router.get("/lattice/agents", async (_req, res): Promise<void> => {
  try {
    const dbStates = await getAllAgentStates();
    const states = dbStates.length > 0 ? dbStates : getStaticAgentStates();
    res.json(GetLatticeAgentsResponse.parse(states));
  } catch (err) {
    logger.warn({ err }, "Failed to fetch agent states, using static");
    res.json(GetLatticeAgentsResponse.parse(getStaticAgentStates()));
  }
});

router.get("/lattice/regime", async (req, res): Promise<void> => {
  const parsed = GetMarketRegimeQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "symbol is required" });
    return;
  }

  const { symbol } = parsed.data;
  const isCrypto = symbol.toUpperCase() in CRYPTO_ID_MAP;

  try {
    let closes: number[] = [];
    if (isCrypto) {
      const coinId = CRYPTO_ID_MAP[symbol.toUpperCase()]?.id ?? symbol.toLowerCase();
      const history = await fetchCryptoHistory(coinId, 30);
      closes = history.filter((h) => h.close !== null).map((h) => h.close!);
    } else {
      const history = await fetchStockHistory(symbol.toUpperCase(), 30);
      closes = history.filter((h) => h.close !== null).map((h) => h.close!);
    }

    const ctx = detectRegime(closes);
    res.json(
      GetMarketRegimeResponse.parse({
        symbol: symbol.toUpperCase(),
        regime: ctx.regime,
        regimeScore: ctx.regimeScore,
        volatility: ctx.volatility,
        description: describeRegime(ctx.regime, ctx.volatility),
      }),
    );
  } catch (err) {
    logger.warn({ err, symbol }, "Regime detection failed");
    res.json(
      GetMarketRegimeResponse.parse({
        symbol: symbol.toUpperCase(),
        regime: "calm",
        regimeScore: 0.1,
        volatility: 0.14,
        description: "Low-volatility environment (14.0% annualized).",
      }),
    );
  }
});

router.post("/lattice/train", async (_req, res): Promise<void> => {
  try {
    const result = await runTrainingCycle();
    res.json(RunLatticeTrainingResponse.parse(result));
  } catch (err) {
    logger.error({ err }, "Lattice training failed");
    res.status(500).json({ error: "Training cycle failed" });
  }
});

// ─── Backtest ─────────────────────────────────────────────────────────────────

router.get("/lattice/runs/:symbol", async (req, res): Promise<void> => {
  const symbol = (req.params.symbol ?? "").toUpperCase();
  if (!symbol) {
    res.status(400).json({ error: "symbol required" });
    return;
  }
  try {
    const rows = await db
      .select()
      .from(latticeRunsTable)
      .where(eq(latticeRunsTable.symbol, symbol))
      .orderBy(desc(latticeRunsTable.createdAt))
      .limit(50);

    res.json(
      rows.map((r) => ({
        id: r.id,
        symbol: r.symbol,
        timeframe: r.timeframe,
        regime: r.regime,
        regimeScore: r.regimeScore,
        finalDirection: r.finalDirection,
        finalConfidence: r.finalConfidence,
        hivemindScore: r.hivemindScore,
        shapHive: r.shapHive,
        shapAi: r.shapAi,
        shapGeo: r.shapGeo,
        agentConsensus: r.agentConsensus,
        causalNarrative: r.causalNarrative,
        createdAt: r.createdAt.toISOString(),
      })),
    );
  } catch (err) {
    logger.error({ err, symbol }, "Backtest runs fetch failed");
    res.status(500).json({ error: "Failed to fetch runs" });
  }
});

// ─── Leaderboard ──────────────────────────────────────────────────────────────

router.get("/lattice/leaderboard", async (_req, res): Promise<void> => {
  try {
    const dbStates = await getAllAgentStates();
    const states = dbStates.length > 0 ? dbStates : getStaticAgentStates();

    const leaderboard = states
      .map((s) => ({
        ...s,
        accuracy: s.totalRuns > 0 ? s.correctRuns / s.totalRuns : null,
        rank: 0,
      }))
      .sort((a, b) => b.reputation - a.reputation)
      .map((s, i) => ({ ...s, rank: i + 1 }));

    res.json(leaderboard);
  } catch (err) {
    logger.error({ err }, "Leaderboard fetch failed");
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

// ─── Belief History ───────────────────────────────────────────────────────────

router.get("/lattice/belief-history/:symbol", async (req, res): Promise<void> => {
  try {
    const { symbol } = GetBeliefHistoryParams.parse(req.params);
    const { limit } = GetBeliefHistoryQueryParams.parse(req.query);

    const rows = await queryBeliefHistory(symbol.toUpperCase(), limit);
    const validated = GetBeliefHistoryResponse.parse(rows);
    res.json(validated);
  } catch (err) {
    logger.error({ err }, "Failed to fetch belief history");
    res.status(500).json({ error: "Failed to fetch belief history" });
  }
});

export default router;
