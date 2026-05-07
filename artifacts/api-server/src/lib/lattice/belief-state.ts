import { db } from "@workspace/db";
import { beliefStatesTable, beliefHistoryTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import type { BeliefState, BeliefDynamics, BeliefToken, Direction, Regime } from "./types";
import { logger } from "../logger";

// ─── Persistence: current state (one row per symbol, upserted) ───────────────

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
      deltaHistory: JSON.stringify(state.deltaHistory.slice(-10)),
      sessionCount: state.sessionCount,
      updatedAt: new Date(),
    };

    const existing = await db
      .select({ symbol: beliefStatesTable.symbol })
      .from(beliefStatesTable)
      .where(eq(beliefStatesTable.symbol, state.symbol));

    if (existing.length > 0) {
      await db.update(beliefStatesTable).set(row).where(eq(beliefStatesTable.symbol, state.symbol));
    } else {
      await db.insert(beliefStatesTable).values(row);
    }
  } catch (err) {
    logger.warn({ err, symbol: state.symbol }, "Failed to save belief state");
  }
}

// ─── Persistence: history (append-only, one row per v3 run) ──────────────────

export async function appendBeliefHistory(opts: {
  runId: string;
  symbol: string;
  dynamics: BeliefDynamics;
  finalProbability: number;
  finalDirection: Direction;
  hivemindScore: number;
  regime: Regime;
}): Promise<void> {
  try {
    await db.insert(beliefHistoryTable).values({
      id: opts.runId,
      symbol: opts.symbol,
      sessionCount: opts.dynamics.sessionCount,
      finalProbability: parseFloat(opts.finalProbability.toFixed(6)),
      finalDirection: opts.finalDirection,
      hivemindScore: parseFloat(opts.hivemindScore.toFixed(4)),
      regime: opts.regime,
      delta: parseFloat(opts.dynamics.delta.toFixed(6)),
      momentum: parseFloat(opts.dynamics.momentum.toFixed(6)),
      convictionShift: opts.dynamics.convictionShift,
      previousRunId: opts.dynamics.previousRunId ?? null,
      createdAt: new Date(),
    });
  } catch (err) {
    logger.warn({ err, symbol: opts.symbol, runId: opts.runId }, "Failed to append belief history");
  }
}

export async function queryBeliefHistory(
  symbol: string,
  limit: number,
): Promise<
  BeliefDynamics &
    {
      runId: string;
      symbol: string;
      finalProbability: number;
      finalDirection: Direction;
      hivemindScore: number;
      regime: Regime;
      createdAt: string;
    }[]
> {
  const rows = await db
    .select()
    .from(beliefHistoryTable)
    .where(eq(beliefHistoryTable.symbol, symbol))
    .orderBy(desc(beliefHistoryTable.createdAt))
    .limit(limit);

  // Return in chronological order (oldest first) for chart rendering
  return rows.reverse().map((r) => ({
    runId: r.id,
    symbol: r.symbol,
    sessionCount: r.sessionCount,
    finalProbability: r.finalProbability,
    finalDirection: r.finalDirection as Direction,
    hivemindScore: r.hivemindScore,
    regime: r.regime as Regime,
    delta: r.delta,
    momentum: r.momentum,
    convictionShift: r.convictionShift as BeliefDynamics["convictionShift"],
    previousRunId: r.previousRunId ?? null,
    previousDirection: null,
    createdAt: r.createdAt.toISOString(),
  }));
}

// ─── Delta Computation ────────────────────────────────────────────────────────

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
  const {
    symbol,
    runId,
    finalProbability,
    finalDirection,
    hivemindScore,
    regime,
    allTokens,
    prev,
  } = opts;

  const delta = prev ? parseFloat((finalProbability - prev.finalProbability).toFixed(6)) : 0;

  const rawHistory = prev ? [...prev.deltaHistory, delta] : [delta];
  const deltaHistory = rawHistory.slice(-10);

  const momentum = parseFloat(
    (deltaHistory.reduce((s, d) => s + d, 0) / deltaHistory.length).toFixed(6),
  );

  let convictionShift: BeliefDynamics["convictionShift"] = "stable";
  if (prev) {
    const prevDir = prev.finalDirection;
    const dirReversed =
      prevDir !== "neutral" && finalDirection !== "neutral" && prevDir !== finalDirection;

    if (dirReversed) {
      convictionShift = "reversing";
    } else if (Math.abs(delta) > 0.025) {
      const prevExtremity = Math.abs(prev.finalProbability - 0.5);
      const currExtremity = Math.abs(finalProbability - 0.5);
      convictionShift = currExtremity > prevExtremity ? "strengthening" : "weakening";
    }
  }

  const agentProbabilities: Record<string, number> = {};
  for (const t of allTokens) {
    agentProbabilities[t.agentType] = t.probability;
  }

  const dynamics: BeliefDynamics = {
    delta,
    momentum,
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
    deltaHistory,
    sessionCount: (prev?.sessionCount ?? 0) + 1,
  };

  return { dynamics, newState };
}

export function enrichTokensWithDeltas(
  tokens: BeliefToken[],
  prev: BeliefState,
  dynamics: BeliefDynamics,
): void {
  for (const token of tokens) {
    const prevProb = prev.agentProbabilities[token.agentType];
    if (prevProb !== undefined) {
      token.delta = parseFloat((token.probability - prevProb).toFixed(6));
    }
    token.momentum = dynamics.momentum;
  }
}
