import { nanoid } from "nanoid";
import { db } from "@workspace/db";
import { latticeRunsTable, agentStatesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

import type { LatticeResult, AgentState, BeliefDynamics, TechnicalFeatures } from "./types";
import { detectRegime } from "./regime-detector";
import { extractHiveSignal } from "./hive-agents";
import {
  momentumAgent,
  meanReversionAgent,
  volRegimeAgent,
  hiveWisdomAgent,
} from "./hypothesis-agents";
import { runDevilsAdvocate, runTailRiskAgent } from "./critique-agents";
import { synthesize } from "./synthesis-agent";
import { runMetaAgent } from "./meta-agent";
import { loadBeliefState, saveBeliefState, computeBeliefDynamics, enrichTokensWithDeltas } from "./belief-state";
import {
  fetchStockHistory,
  fetchCryptoHistory,
  fetchStockPrice,
  fetchCryptoPrices,
  CRYPTO_ID_MAP,
} from "../market-data";
import { logger } from "../logger";

function computeRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  const ag = gains / period;
  const al = losses / period;
  if (al === 0) return 100;
  return 100 - 100 / (1 + ag / al);
}

function computeMACDHistogram(closes: number[]): number {
  if (closes.length < 26) return 0;
  const ema = (data: number[], p: number) => {
    const k = 2 / (p + 1);
    let e = data[0];
    for (let i = 1; i < data.length; i++) e = data[i] * k + e * (1 - k);
    return e;
  };
  const macd = ema(closes, 12) - ema(closes, 26);
  return macd - macd * 0.9;
}

function computeBollingerB(closes: number[], period = 20): number {
  if (closes.length < period) return 0.5;
  const slice = closes.slice(-period);
  const mid = slice.reduce((a, b) => a + b, 0) / period;
  const std = Math.sqrt(slice.reduce((a, b) => a + Math.pow(b - mid, 2), 0) / period);
  if (std === 0) return 0.5;
  const current = closes[closes.length - 1];
  return (current - (mid - 2 * std)) / (4 * std);
}

async function getAgentReputations(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const states = await db.select().from(agentStatesTable);
    for (const s of states) map.set(s.agentType, s.reputation);
  } catch {}
  return map;
}

async function persistAgentRun(agentType: string): Promise<void> {
  try {
    const existing = await db
      .select()
      .from(agentStatesTable)
      .where(eq(agentStatesTable.agentId, agentType));
    if (existing.length > 0) {
      await db
        .update(agentStatesTable)
        .set({ totalRuns: existing[0].totalRuns + 1, updatedAt: new Date() })
        .where(eq(agentStatesTable.agentId, agentType));
    } else {
      await db.insert(agentStatesTable).values({
        agentId: agentType,
        agentType,
        reputation: 1.0,
        brierScore: 0.25,
        totalRuns: 1,
        correctRuns: 0,
        updatedAt: new Date(),
      });
    }
  } catch {}
}

export async function runLattice(
  symbol: string,
  timeframe: string,
  useV3 = false
): Promise<LatticeResult> {
  const runId = nanoid(12);
  const version = useV3 ? "v3" : "v2";
  logger.info({ symbol, timeframe, runId, version }, "HPL lattice run started");

  const isCrypto = symbol in CRYPTO_ID_MAP;

  let closes: number[] = [];
  let currentPrice = 100;

  try {
    if (isCrypto) {
      const coinId = CRYPTO_ID_MAP[symbol]?.id ?? symbol.toLowerCase();
      const history = await fetchCryptoHistory(coinId, 60);
      closes = history.filter((h) => h.close != null).map((h) => h.close!);
      const prices = await fetchCryptoPrices();
      const cp = prices.find((p) => p.symbol === symbol);
      if (cp) currentPrice = cp.price;
    } else {
      const history = await fetchStockHistory(symbol, 60);
      closes = history.filter((h) => h.close != null).map((h) => h.close!);
      const sp = await fetchStockPrice(symbol);
      currentPrice = sp.price;
    }
  } catch (err) {
    logger.warn({ symbol, err }, "Could not fetch live data for lattice, using synthetic");
    closes = Array.from({ length: 40 }, (_, i) =>
      currentPrice * (1 + Math.sin(i * 0.4) * 0.03 + (Math.random() - 0.5) * 0.01)
    );
  }

  if (closes.length < 5) {
    closes = Array.from({ length: 40 }, (_, i) =>
      100 * (1 + Math.sin(i * 0.4) * 0.03)
    );
    currentPrice = 100;
  }

  const regime = detectRegime(closes);

  const { getNewsContextForSymbol } = await import("../news");

  // In v3 mode, load previous belief state in parallel with hive + news
  const [hive, newsContext, prevState] = await Promise.all([
    extractHiveSignal(symbol),
    getNewsContextForSymbol(symbol).catch(() => ({ sentiment: 0, weight: 0, headlines: [], breakingAlert: false })),
    useV3 ? loadBeliefState(symbol) : Promise.resolve(null),
  ]);

  const features: TechnicalFeatures = {
    rsi: computeRSI(closes),
    macdHistogram: computeMACDHistogram(closes),
    bollingerPercentB: computeBollingerB(closes),
    maCross: closes.length >= 20
      ? ((closes[closes.length - 1] / (closes.slice(-20).reduce((a, b) => a + b, 0) / 20)) - 1) * 100
      : 0,
    momentum5d:
      closes.length >= 5
        ? ((closes[closes.length - 1] / closes[closes.length - 5] - 1) * 100)
        : 0,
    volatility: regime.volatility,
  };

  const hiveToken = { id: nanoid(8), agentType: "hive_polymarket" as const, round: 0,
    hypothesis: (hive.probability > 0.54 ? "bullish" : hive.probability < 0.46 ? "bearish" : "neutral") as "bullish" | "bearish" | "neutral",
    probability: hive.probability, confidence: hive.confidence,
    rationale: [`Polymarket liquidity-weighted signal: ${(hive.probability * 100).toFixed(1)}% bullish`, `Liquidity score: ${hive.liquidityScore.toFixed(2)}`],
    shapHive: 1, shapAi: 0, shapGeo: hive.geoPressure, liquidityScore: hive.liquidityScore, parentIds: [] };

  const momToken = momentumAgent(features, regime, [hiveToken.id], symbol, timeframe);
  const meanToken = meanReversionAgent(features, regime, [hiveToken.id], symbol, timeframe);
  const volToken = volRegimeAgent(features, regime, [hiveToken.id], symbol, timeframe);
  const hiveWisToken = hiveWisdomAgent(hive, [hiveToken.id], symbol, timeframe);

  const hypothesisTokens = [momToken, meanToken, volToken, hiveWisToken];

  for (const t of hypothesisTokens) {
    persistAgentRun(t.agentType).catch(() => {});
  }

  const devilResult = runDevilsAdvocate(
    hypothesisTokens,
    features,
    regime,
    hypothesisTokens.map((t) => t.id),
    symbol,
    timeframe
  );

  const tailResult = runTailRiskAgent(
    devilResult.adjustedProb,
    hive,
    regime,
    devilResult.tokens.map((t) => t.id),
    symbol,
    timeframe,
    newsContext
  );

  const agentReputations = await getAgentReputations();

  const critiqueTokens = [...devilResult.tokens, ...tailResult.tokens];
  const synthesis = synthesize(hypothesisTokens, critiqueTokens, agentReputations);

  const meta = runMetaAgent(
    synthesis.token,
    regime,
    synthesis.shap,
    hive.relevantMarkets,
    synthesis.agentConsensus,
    symbol,
    timeframe,
    currentPrice,
    [synthesis.token.id]
  );

  const allTokens = [hiveToken, ...hypothesisTokens, ...critiqueTokens, synthesis.token, meta.token];
  const allDebateRounds = [...devilResult.rounds, ...tailResult.rounds];

  // ─── v3: Compute belief dynamics and enrich tokens ────────────────────────
  let beliefDynamics: BeliefDynamics | undefined;

  if (useV3) {
    try {
      const { dynamics, newState } = computeBeliefDynamics({
        symbol,
        runId,
        finalProbability: meta.token.probability,
        finalDirection: meta.finalPrediction.direction,
        hivemindScore: meta.finalPrediction.hivemindScore,
        regime: regime.regime,
        allTokens,
        prev: prevState,
      });

      // Enrich each token with its per-agent delta vs the previous run
      if (prevState) {
        enrichTokensWithDeltas(allTokens, prevState, dynamics);
      }

      await saveBeliefState(newState);
      beliefDynamics = dynamics;

      logger.info({
        symbol,
        runId,
        delta: dynamics.delta,
        momentum: dynamics.momentum,
        convictionShift: dynamics.convictionShift,
        sessionCount: dynamics.sessionCount,
      }, "HPL-HPA v3 belief dynamics computed");
    } catch (err) {
      logger.warn({ err, symbol }, "v3 belief dynamics failed — result returned without dynamics");
    }
  }

  try {
    await db.insert(latticeRunsTable).values({
      id: runId,
      symbol,
      timeframe,
      regime: regime.regime,
      regimeScore: regime.regimeScore,
      finalDirection: meta.finalPrediction.direction,
      finalConfidence: meta.finalPrediction.confidence,
      hivemindScore: meta.finalPrediction.hivemindScore,
      shapHive: synthesis.shap.hive,
      shapAi: synthesis.shap.ai,
      shapGeo: synthesis.shap.geo,
      tokens: JSON.stringify(allTokens),
      debateRounds: JSON.stringify(allDebateRounds),
      causalNarrative: meta.causalNarrative,
      minorityReport: synthesis.minorityReport,
      agentConsensus: synthesis.agentConsensus,
      createdAt: new Date(),
    });
  } catch (err) {
    logger.warn({ err }, "Failed to persist lattice run");
  }

  logger.info({ symbol, runId, direction: meta.finalPrediction.direction, score: meta.finalPrediction.hivemindScore, version }, "HPL lattice run complete");

  return {
    runId,
    symbol,
    timeframe,
    regime: regime.regime,
    regimeScore: regime.regimeScore,
    tokens: allTokens,
    debateRounds: allDebateRounds,
    shap: synthesis.shap,
    finalPrediction: meta.finalPrediction,
    causalNarrative: meta.causalNarrative,
    minorityReport: synthesis.minorityReport,
    agentConsensus: synthesis.agentConsensus,
    beliefDynamics,
  };
}

export async function getAllAgentStates(): Promise<AgentState[]> {
  try {
    const rows = await db.select().from(agentStatesTable);
    return rows.map((r) => ({
      agentId: r.agentId,
      agentType: r.agentType,
      reputation: r.reputation,
      brierScore: r.brierScore,
      totalRuns: r.totalRuns,
      correctRuns: r.correctRuns,
    }));
  } catch {
    return [];
  }
}

export function getStaticAgentStates(): AgentState[] {
  const agents = [
    { agentId: "hypothesis_momentum", agentType: "hypothesis_momentum", reputation: 1.12, brierScore: 0.21, totalRuns: 48, correctRuns: 31 },
    { agentId: "hypothesis_meanrevert", agentType: "hypothesis_meanrevert", reputation: 0.94, brierScore: 0.26, totalRuns: 48, correctRuns: 26 },
    { agentId: "hypothesis_volregime", agentType: "hypothesis_volregime", reputation: 1.05, brierScore: 0.23, totalRuns: 48, correctRuns: 29 },
    { agentId: "hypothesis_hive", agentType: "hypothesis_hive", reputation: 1.08, brierScore: 0.22, totalRuns: 48, correctRuns: 30 },
    { agentId: "critique_devil", agentType: "critique_devil", reputation: 0.98, brierScore: 0.24, totalRuns: 48, correctRuns: 27 },
    { agentId: "critique_tailrisk", agentType: "critique_tailrisk", reputation: 1.01, brierScore: 0.24, totalRuns: 48, correctRuns: 28 },
  ];
  return agents;
}
