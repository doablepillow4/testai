import { pgTable, serial, text, real, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const predictionsTable = pgTable("predictions", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  direction: text("direction").notNull(),
  targetPrice: real("target_price").notNull(),
  currentPrice: real("current_price").notNull(),
  confidence: real("confidence").notNull(),
  timeframe: text("timeframe").notNull().default("7d"),
  signals: text("signals").notNull().default("[]"),
  outcome: text("outcome"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});

export const insertPredictionSchema = createInsertSchema(predictionsTable).omit({
  id: true,
  createdAt: true,
  resolvedAt: true,
});

export type InsertPrediction = z.infer<typeof insertPredictionSchema>;
export type Prediction = typeof predictionsTable.$inferSelect;
