import { describe, it, expect } from "vitest";
import { runMetaAgent } from "../meta-agent";
import type { BeliefToken, RegimeContext, ShapBreakdown } from "../types";

function makeSynthToken(overrides: Partial<BeliefToken> = {}): BeliefToken {
  return {
    id: "synth-1",
    agentType: "synthesis",
    round: 3,
    hypothesis: "bullish",
    probability: 0.65,
    confidence: 0.75,
    rationale: ["synthesis rationale"],
    shapHive: 0.2,
    shapAi: 0.7,
    shapGeo: 0.1,
    liquidityScore: 0.5,
    parentIds: [],
    ...overrides,
  };
}

function makeRegime(regime: "calm" | "volatile" | "crisis" = "calm"): RegimeContext {
  return {
    regime,
    regimeScore: 0.5,
    volatility: 0.25,
    closes: Array.from({ length: 30 }, (_, i) => 100 + i),
  };
}

const shap: ShapBreakdown = { hive: 0.2, ai: 0.7, geo: 0.1 };

describe("runMetaAgent()", () => {
  it("returns a token with agentType=meta and round=4", () => {
    const { token } = runMetaAgent(
      makeSynthToken(),
      makeRegime(),
      shap,
      ["BTC up"],
      0.8,
      "BTC",
      "1d",
      50000,
      ["synth-1"],
    );
    expect(token.agentType).toBe("meta");
    expect(token.round).toBe(4);
  });

  it("final probability is clamped to [0, 1]", () => {
    const { token } = runMetaAgent(
      makeSynthToken({ probability: 0.99 }),
      makeRegime("calm"),
      shap,
      [],
      1.0,
      "AAPL",
      "1d",
      200,
      [],
    );
    expect(token.probability).toBeLessThanOrEqual(1);
    expect(token.probability).toBeGreaterThanOrEqual(0);
  });

  it("hivemindScore is between 0 and 100", () => {
    const { finalPrediction } = runMetaAgent(
      makeSynthToken(),
      makeRegime(),
      shap,
      [],
      0.75,
      "ETH",
      "1d",
      3000,
      [],
    );
    expect(finalPrediction.hivemindScore).toBeGreaterThanOrEqual(0);
    expect(finalPrediction.hivemindScore).toBeLessThanOrEqual(100);
  });

  it("bullish direction produces a targetPrice above currentPrice", () => {
    const currentPrice = 100;
    const { finalPrediction } = runMetaAgent(
      makeSynthToken({ hypothesis: "bullish", probability: 0.7 }),
      makeRegime("calm"),
      shap,
      [],
      0.8,
      "TSLA",
      "1d",
      currentPrice,
      [],
    );
    expect(finalPrediction.targetPrice).toBeGreaterThanOrEqual(currentPrice);
  });

  it("bearish direction produces a targetPrice below or equal to currentPrice", () => {
    const currentPrice = 100;
    const { finalPrediction } = runMetaAgent(
      makeSynthToken({ hypothesis: "bearish", probability: 0.3 }),
      makeRegime("calm"),
      shap,
      [],
      0.8,
      "TSLA",
      "1d",
      currentPrice,
      [],
    );
    expect(finalPrediction.targetPrice).toBeLessThanOrEqual(currentPrice);
  });

  it("neutral direction keeps targetPrice equal to currentPrice", () => {
    const currentPrice = 200;
    const { finalPrediction } = runMetaAgent(
      makeSynthToken({ hypothesis: "neutral", probability: 0.5 }),
      makeRegime("calm"),
      shap,
      [],
      0.5,
      "MSFT",
      "1d",
      currentPrice,
      [],
    );
    expect(finalPrediction.targetPrice).toBe(currentPrice);
  });

  it("causalNarrative is a non-empty string containing the symbol", () => {
    const { causalNarrative } = runMetaAgent(
      makeSynthToken(),
      makeRegime(),
      shap,
      [],
      0.8,
      "NVDA",
      "1d",
      600,
      [],
    );
    expect(typeof causalNarrative).toBe("string");
    expect(causalNarrative.length).toBeGreaterThan(50);
    expect(causalNarrative).toContain("NVDA");
  });

  it("crisis regime reduces hivemindScore more than calm regime", () => {
    const baseToken = makeSynthToken({ probability: 0.75 });

    const { finalPrediction: calmPred } = runMetaAgent(
      baseToken,
      makeRegime("calm"),
      shap,
      [],
      0.8,
      "BTC",
      "1d",
      50000,
      [],
    );
    const { finalPrediction: crisisPred } = runMetaAgent(
      baseToken,
      makeRegime("crisis"),
      shap,
      [],
      0.8,
      "BTC",
      "1d",
      50000,
      [],
    );
    expect(calmPred.hivemindScore).toBeGreaterThan(crisisPred.hivemindScore);
  });

  it("v3 causalNarrative includes Belief Delta section when beliefDynamics is provided", () => {
    const beliefDynamics = {
      delta: 0.05,
      momentum: 0.03,
      convictionShift: "strengthening" as const,
      previousRunId: "prev-run-1",
      previousDirection: "bullish" as const,
      sessionCount: 3,
    };

    const { causalNarrative } = runMetaAgent(
      makeSynthToken(),
      makeRegime(),
      shap,
      [],
      0.8,
      "ETH",
      "1d",
      3000,
      [],
      beliefDynamics,
    );
    expect(causalNarrative).toContain("Belief Delta");
    expect(causalNarrative).toContain("v3");
  });
});
