import type { BeliefToken, LatticePrediction, RegimeContext, ShapBreakdown, Direction, BeliefDynamics } from "./types";
import { nanoid } from "nanoid";
import { describeRegime } from "./regime-detector";

function clamp(v: number, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, v));
}

export interface MetaOutput {
  token: BeliefToken;
  finalPrediction: LatticePrediction;
  causalNarrative: string;
}

export function runMetaAgent(
  synthesisToken: BeliefToken,
  regime: RegimeContext,
  shap: ShapBreakdown,
  hiveRelevantMarkets: string[],
  agentConsensus: number,
  symbol: string,
  timeframe: string,
  currentPrice: number,
  parentIds: string[],
  beliefDynamics?: BeliefDynamics
): MetaOutput {
  let probability = synthesisToken.probability;

  const regimeMultiplier =
    regime.regime === "calm" ? 1.05
    : regime.regime === "volatile" ? 0.92
    : 0.78;

  probability = clamp(probability * (probability > 0.5 ? regimeMultiplier : 2 - regimeMultiplier));

  const hivemindRaw = Math.abs(probability - 0.5) * 200;
  const regimePenalty =
    regime.regime === "calm" ? 0
    : regime.regime === "volatile" ? 8
    : 18;
  const hivemindScore = Math.max(5, Math.min(99, hivemindRaw - regimePenalty));

  const direction: Direction =
    probability > 0.54 ? "bullish" : probability < 0.46 ? "bearish" : "neutral";
  const confidence = synthesisToken.confidence;

  const days = { "15m": 1/96, "30m": 1/48, "1h": 1/24, "6h": 0.25, "12h": 0.5, "1d": 1, "7d": 7 }[timeframe] ?? 30;
  const expectedMovePct = (regime.volatility * Math.sqrt(days / 252) * (direction === "neutral" ? 0 : 1));
  const targetPrice =
    direction === "bullish"
      ? currentPrice * (1 + expectedMovePct)
      : direction === "bearish"
        ? currentPrice * (1 - expectedMovePct)
        : currentPrice;

  const token: BeliefToken = {
    id: nanoid(8),
    agentType: "meta",
    round: 4,
    hypothesis: direction,
    probability: parseFloat(probability.toFixed(4)),
    confidence: parseFloat(confidence.toFixed(4)),
    rationale: [
      "Role: final verdict and regime calibration",
      `Meta-agent regime calibration applied: ${regime.regime} multiplier ${((regimeMultiplier - 1) * 100).toFixed(0)}%`,
      `Hivemind Score: ${hivemindScore.toFixed(0)}/100 (${regime.regime} regime penalty: ${regimePenalty} pts)`,
      `Final target price: $${targetPrice.toFixed(2)} (${(expectedMovePct * 100).toFixed(1)}% ${direction === "bullish" ? "upside" : direction === "bearish" ? "downside" : "flat"} expected over ${timeframe})`,
    ],
    shapHive: synthesisToken.shapHive,
    shapAi: synthesisToken.shapAi,
    shapGeo: synthesisToken.shapGeo,
    liquidityScore: synthesisToken.liquidityScore,
    parentIds,
  };

  const causalNarrative = buildNarrative({
    symbol,
    timeframe,
    regime,
    direction,
    hivemindScore,
    agentConsensus,
    shap,
    hiveRelevantMarkets,
    probability,
    targetPrice,
    currentPrice,
    beliefDynamics,
  });

  return {
    token,
    finalPrediction: {
      direction,
      targetPrice: parseFloat(targetPrice.toFixed(2)),
      confidence: parseFloat(confidence.toFixed(4)),
      hivemindScore: parseFloat(hivemindScore.toFixed(1)),
    },
    causalNarrative,
  };
}

interface NarrativeParams {
  symbol: string;
  timeframe: string;
  regime: RegimeContext;
  direction: Direction;
  hivemindScore: number;
  agentConsensus: number;
  shap: ShapBreakdown;
  hiveRelevantMarkets: string[];
  probability: number;
  targetPrice: number;
  currentPrice: number;
  beliefDynamics?: BeliefDynamics;
}

function buildNarrative(p: NarrativeParams): string {
  const regimeDesc = describeRegime(p.regime.regime, p.regime.volatility);
  const consensusPct = (p.agentConsensus * 100).toFixed(0);
  const priceDelta = ((p.targetPrice - p.currentPrice) / p.currentPrice * 100).toFixed(1);
  const hivePct = (p.shap.hive * 100).toFixed(0);
  const aiPct = (p.shap.ai * 100).toFixed(0);
  const geoPct = (p.shap.geo * 100).toFixed(0);

  const hiveDesc =
    p.shap.hive > 0.3
      ? `Polymarket crowd wisdom carries significant weight (${hivePct}%), reflecting meaningful skin-in-the-game consensus`
      : `Polymarket signal is thin (${hivePct}%) — AI technical analysis dominates this forecast`;

  const geoDesc =
    p.shap.geo > 0.15
      ? `Geopolitical tail-risk contributes ${geoPct}% — causal transmission chains (commodity supply shocks → inflation → monetary policy → equity multiples) have been modeled.`
      : `Geopolitical risk is contained at ${geoPct}% of signal weight.`;

  const hiveMarketNote =
    p.hiveRelevantMarkets.length > 0 && p.hiveRelevantMarkets[0] !== "Fallback signal — live data unavailable"
      ? ` Key Polymarket reference: "${p.hiveRelevantMarkets[0]}."`
      : "";

  const directionVerb = p.direction === "bullish" ? "advance" : p.direction === "bearish" ? "decline" : "consolidate";
  const strengthWord = p.hivemindScore > 70 ? "high-conviction" : p.hivemindScore > 50 ? "moderate" : "low-conviction";

  const version = p.beliefDynamics ? "v3" : "v2";

  const lines = [
    `HPL-HPA ${version} lattice analysis for ${p.symbol} (${p.timeframe} horizon):`,
    ``,
    `Market Regime: ${regimeDesc}`,
    ``,
    `The ${p.symbol} lattice ran 4 hypothesis agents across 2 debate rounds with ${consensusPct}% agent consensus on a ${p.direction.toUpperCase()} outcome. Hivemind Score: ${p.hivemindScore.toFixed(0)}/100 (${strengthWord} signal).`,
    ``,
    `Signal Attribution: ${hiveDesc}.${hiveMarketNote} AI technical ensemble accounts for ${aiPct}% of the forecast. ${geoDesc}`,
    ``,
    `Price Target: $${p.targetPrice.toFixed(2)} (${priceDelta}% ${p.direction === "bullish" ? "upside" : p.direction === "bearish" ? "downside" : "flat"} from current $${p.currentPrice.toFixed(2)}). The lattice expects ${p.symbol} to ${directionVerb} over the ${p.timeframe} window with calibrated probability of ${(p.probability * 100).toFixed(1)}%.`,
  ];

  // v3: append belief delta section
  if (p.beliefDynamics) {
    const d = p.beliefDynamics;
    const deltaSign = d.delta >= 0 ? "+" : "";
    const momSign = d.momentum >= 0 ? "+" : "";
    const accSign = d.acceleration >= 0 ? "+" : "";

    const shiftDesc: Record<typeof d.convictionShift, string> = {
      strengthening: "conviction is STRENGTHENING — the lattice is growing more certain",
      weakening: "conviction is WEAKENING — uncertainty is increasing",
      reversing: "conviction is REVERSING — directional thesis has flipped",
      stable: "conviction is STABLE — consistent with prior runs",
    };

    const firstRun = d.previousRunId === null;

    lines.push(``);
    lines.push(`Belief Delta (HPL-HPA v3 — Session ${d.sessionCount}):`);
    if (firstRun) {
      lines.push(`This is the first v3 run for ${p.symbol}. Belief state seeded. Future runs will show delta dynamics.`);
    } else {
      lines.push(`Δ Probability: ${deltaSign}${(d.delta * 100).toFixed(2)}% vs previous run (was ${d.previousDirection?.toUpperCase() ?? "unknown"}).`);
      lines.push(`Momentum: ${momSign}${(d.momentum * 100).toFixed(2)}% rolling avg — ${shiftDesc[d.convictionShift]}.`);
      lines.push(`Acceleration: ${accSign}${(d.acceleration * 100).toFixed(2)}% (Δ momentum). Stability score: ${(d.stability * 100).toFixed(0)}/100.`);
    }
  }

  return lines.join("\n");
}
