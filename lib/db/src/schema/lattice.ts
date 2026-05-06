import { pgTable, text, real, integer, timestamp } from "drizzle-orm/pg-core";

export const latticeRunsTable = pgTable("lattice_runs", {
  id: text("id").primaryKey(),
  symbol: text("symbol").notNull(),
  timeframe: text("timeframe").notNull(),
  regime: text("regime").notNull(),
  regimeScore: real("regime_score").notNull(),
  finalDirection: text("final_direction").notNull(),
  finalConfidence: real("final_confidence").notNull(),
  hivemindScore: real("hivemind_score").notNull(),
  shapHive: real("shap_hive").notNull(),
  shapAi: real("shap_ai").notNull(),
  shapGeo: real("shap_geo").notNull(),
  tokens: text("tokens").notNull().default("[]"),
  debateRounds: text("debate_rounds").notNull().default("[]"),
  causalNarrative: text("causal_narrative").notNull(),
  minorityReport: text("minority_report"),
  agentConsensus: real("agent_consensus").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agentStatesTable = pgTable("agent_states", {
  agentId: text("agent_id").primaryKey(),
  agentType: text("agent_type").notNull(),
  reputation: real("reputation").notNull().default(1.0),
  brierScore: real("brier_score").notNull().default(0.25),
  totalRuns: integer("total_runs").notNull().default(0),
  correctRuns: integer("correct_runs").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const beliefStatesTable = pgTable("belief_states", {
  symbol: text("symbol").primaryKey(),
  runId: text("run_id").notNull(),
  finalProbability: real("final_probability").notNull(),
  finalDirection: text("final_direction").notNull(),
  agentProbabilities: text("agent_probabilities").notNull().default("{}"),
  hivemindScore: real("hivemind_score").notNull(),
  regime: text("regime").notNull(),
  momentum: real("momentum").notNull().default(0),
  acceleration: real("acceleration").notNull().default(0),
  deltaHistory: text("delta_history").notNull().default("[]"),
  sessionCount: integer("session_count").notNull().default(1),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type LatticeRun = typeof latticeRunsTable.$inferSelect;
export type AgentStateRow = typeof agentStatesTable.$inferSelect;
export type BeliefStateRow = typeof beliefStatesTable.$inferSelect;
