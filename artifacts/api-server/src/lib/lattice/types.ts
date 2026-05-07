export type Regime = "calm" | "volatile" | "crisis";
export type Direction = "bullish" | "bearish" | "neutral";

export type AgentType =
  | "hive_polymarket"
  | "hypothesis_momentum"
  | "hypothesis_meanrevert"
  | "hypothesis_volregime"
  | "hypothesis_hive"
  | "critique_devil"
  | "critique_tailrisk"
  | "synthesis"
  | "meta";

export interface BeliefToken {
  id: string;
  agentType: AgentType;
  round: number;
  hypothesis: Direction;
  probability: number;
  confidence: number;
  rationale: string[];
  shapHive: number;
  shapAi: number;
  shapGeo: number;
  liquidityScore: number;
  parentIds: string[];
  // v3 delta fields — optional for full backward compatibility
  delta?: number;
  momentum?: number;

  previousTokenId?: string;
}

export interface DebateRound {
  round: number;
  agentType: string;
  challenge: string;
  adjustment: number;
  accepted: boolean;
}

export interface ShapBreakdown {
  hive: number;
  ai: number;
  geo: number;
}

export interface LatticePrediction {
  direction: Direction;
  targetPrice: number;
  confidence: number;
  hivemindScore: number;
}

export interface LatticeResult {
  runId: string;
  symbol: string;
  timeframe: string;
  regime: Regime;
  regimeScore: number;
  tokens: BeliefToken[];
  debateRounds: DebateRound[];
  shap: ShapBreakdown;
  finalPrediction: LatticePrediction;
  causalNarrative: string;
  minorityReport: string | null;
  agentConsensus: number;
  // v3 extension — undefined when useV3 is false
  beliefDynamics?: BeliefDynamics;
}

export interface AgentState {
  agentId: string;
  agentType: string;
  reputation: number;
  brierScore: number;
  totalRuns: number;
  correctRuns: number;
}

export interface RegimeStatus {
  symbol: string;
  regime: Regime;
  regimeScore: number;
  volatility: number;
  description: string;
}

export interface RegimeContext {
  regime: Regime;
  regimeScore: number;
  volatility: number;
  closes: number[];
}

export interface HiveSignal {
  probability: number;
  confidence: number;
  liquidityScore: number;
  relevantMarkets: string[];
  geoPressure: number;
}

export interface TechnicalFeatures {
  rsi: number;
  macdHistogram: number;
  bollingerPercentB: number;
  maCross: number;
  momentum5d: number;
  volatility: number;
}

export interface NewsContext {
  sentiment: number;
  weight: number;
  headlines: string[];
  breakingAlert: boolean;
}

// ─── v3: Persistent Delta Belief State ───────────────────────────────────────

/**
 * Persisted per-symbol state. One row per symbol in `belief_states`.
 * Loaded at the start of each v3 run and saved at the end.
 */
export interface BeliefState {
  symbol: string;
  runId: string;
  finalProbability: number;
  finalDirection: Direction;
  /** agentType → probability from the last run */
  agentProbabilities: Record<string, number>;
  hivemindScore: number;
  regime: Regime;
  /** Exponential moving average of recent probability deltas */
  momentum: number;
  /** Last N probability deltas (most recent last) */
  deltaHistory: number[];
  sessionCount: number;
}

/**
 * Computed belief dynamics returned alongside a v3 lattice result.
 * Describes how the lattice's conviction has changed since the last run.
 */
export interface BeliefDynamics {
  /** finalProbability - previous finalProbability (signed) */
  delta: number;
  /** Rolling average of deltaHistory */
  momentum: number;

  convictionShift: "strengthening" | "weakening" | "reversing" | "stable";
  previousRunId: string | null;
  previousDirection: Direction | null;
  sessionCount: number;
}
