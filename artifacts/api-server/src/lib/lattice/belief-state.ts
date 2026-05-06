import { db } from "@workspace/db";
import { beliefStatesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { BeliefState, BeliefDynamics, BeliefToken, Direction, Regime } from "./types";
import { logger } from "../logger";

// ─── Persistence ─────────────────────────────────────────────────────────────

export async function loadBeliefState(symbol: string): Promise<BeliefState | null> {
  try {
    const rows = await db
      .select()
      .from(beliefStatesTable)
      .where(eq(beliefStatesTable.symbol, symbol));

    if (rows.length === 0) return null;

    const r = rows[0];
    return {
      symbol: r.symbol,
      runId: r.runId,
      finalProbability: r.finalProbability,
      finalDirection: r.finalDirection as Direction,
      agentProbabilities: JSON.parse(r.agentProbabilities) as Record<string, number>,
      hivemindScore: r.hivemindScore,
      regime: r.regime as Regime,
      momentum: r.momentum,
      acceleration: r.acceleration,
      deltaHistory: JSON.parse(r.deltaHistory) as number[],
      sessionCount: r.sessionCount,
    };
  } catch (err) {
    logger.warn({ err, symbol }, "Failed to load belief state");
    return null;
  }
}

export async function saveBeliefState(state: BeliefState): Promise<void> {
  try {
    const row = {
      symbol: state.symbol,
      runId: state.runId,
      finalProbability: parseFloat(state.finalProbability.toFixed(6)),
      finalDirection: state.finalDirection,
      agentProbabilities: JSON.stringify(state.agentProbabilities),
      hivemindScore: parseFloat(state.hivemindScore.toFixed(4)),
      regime: state.regime,
      momentum: parseFloat(state.momentum.toFixed(6)),
      acceleration: parseFloat(state.acceleration.toFixed(6)),
      deltaHistory: JSON.stringify(state.deltaHistory.slice(-10)),
      sessionCount: state.sessionCount,
      updatedAt: new Date(),
    };

    const existing = await db
      .select({ symbol: beliefStatesTable.symbol })
      .from(beliefStatesTable)
      .where(eq(beliefStatesTable.symbol, state.symbol));

    if (existing.length > 0) {
      await db
        .update(beliefStatesTable)
        .set(row)
        .where(eq(beliefStatesTable.symbol, state.symbol));
    } else {
      await db.insert(beliefStatesTable).values(row);
    }
  } catch (err) {
    logger.warn({ err, symbol: state.symbol }, "Failed to save belief state");
  }
}

// ─── Delta Computation ────────────────────────────────────────────────────────

/**
 * Pure function. Given the current run's outputs and the previous BeliefState,
 * computes BeliefDynamics and the new BeliefState to persist.
 *
 * Runs AFTER all agents have fired so we have the full token list.
 */
export function computeBeliefDynamics(opts: {
  symbol: string;
  runId: string;
  finalProbability: number;
  finalDirection: Direction;
  hivemindScore: number;
  regime: Regime;
  allTokens: BeliefToken[];
  prev: BeliefState | null;
}): { dynamics: BeliefDynamics; newState: BeliefState } {
  const { symbol, runId, finalProbability, finalDirection, hivemindScore, regime, allTokens, prev } = opts;

  const delta = prev
    ? parseFloat((finalProbability - prev.finalProbability).toFixed(6))
    : 0;

  const rawHistory = prev ? [...prev.deltaHistory, delta] : [delta];
  const deltaHistory = rawHistory.slice(-10);

  const momentum = parseFloat(
    (deltaHistory.reduce((s, d) => s + d, 0) / deltaHistory.length).toFixed(6)
  );

  const prevMomentum = prev?.momentum ?? 0;
  const acceleration = parseFloat((momentum - prevMomentum).toFixed(6));

  // Stability = 1 – normalised std-dev of recent deltas (0 = chaotic, 1 = rock-solid)
  const meanDelta = deltaHistory.reduce((s, d) => s + d, 0) / deltaHistory.length;
  const variance = deltaHistory.reduce((s, d) => s + Math.pow(d - meanDelta, 2), 0) / deltaHistory.length;
  const stability = parseFloat(Math.max(0, 1 - Math.min(1, Math.sqrt(variance) * 15)).toFixed(4));

  // Conviction shift classification
  let convictionShift: BeliefDynamics["convictionShift"] = "stable";
  if (prev) {
    const prevDir = prev.finalDirection;
    const dirReversed =
      prevDir !== "neutral" &&
      finalDirection !== "neutral" &&
      prevDir !== finalDirection;

    if (dirReversed) {
      convictionShift = "reversing";
    } else if (Math.abs(delta) > 0.025) {
      const prevExtremity = Math.abs(prev.finalProbability - 0.5);
      const currExtremity = Math.abs(finalProbability - 0.5);
      convictionShift = currExtremity > prevExtremity ? "strengthening" : "weakening";
    }
  }

  // Build per-agent probability snapshot from this run
  const agentProbabilities: Record<string, number> = {};
  for (const t of allTokens) {
    agentProbabilities[t.agentType] = t.probability;
  }

  const dynamics: BeliefDynamics = {
    delta,
    momentum,
    acceleration,
    stability,
    convictionShift,
    previousRunId: prev?.runId ?? null,
    previousDirection: prev?.finalDirection ?? null,
    sessionCount: (prev?.sessionCount ?? 0) + 1,
  };

  const newState: BeliefState = {
    symbol,
    runId,
    finalProbability,
    finalDirection,
    agentProbabilities,
    hivemindScore,
    regime,
    momentum,
    acceleration,
    deltaHistory,
    sessionCount: (prev?.sessionCount ?? 0) + 1,
  };

  return { dynamics, newState };
}

/**
 * Enriches tokens in-place with per-agent delta fields using the previous
 * belief state's agent probability snapshot.
 */
export function enrichTokensWithDeltas(
  tokens: BeliefToken[],
  prev: BeliefState,
  dynamics: BeliefDynamics
): void {
  for (const token of tokens) {
    const prevProb = prev.agentProbabilities[token.agentType];
    if (prevProb !== undefined) {
      token.delta = parseFloat((token.probability - prevProb).toFixed(6));
    }
    // Momentum / acceleration / stability are lattice-level, shared across tokens
    token.momentum = dynamics.momentum;
    token.acceleration = dynamics.acceleration;
    token.stability = dynamics.stability;
  }
}
