import {
  index,
  integer,
  numeric,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { creators } from "./creators";

export const creatorMetrics = pgTable(
  "creator_metrics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => creators.id, { onDelete: "cascade" }),
    totalSignals: integer("total_signals").default(0).notNull(),
    verifiedSignals: integer("verified_signals").default(0).notNull(),
    winningSignals: integer("winning_signals").default(0).notNull(),
    losingSignals: integer("losing_signals").default(0).notNull(),
    winRate: numeric("win_rate", { precision: 5, scale: 2 })
      .default("0.00")
      .notNull(),
    averageReturn: numeric("average_return", { precision: 10, scale: 4 })
      .default("0.0000")
      .notNull(),
    cumulativeReturn: numeric("cumulative_return", { precision: 12, scale: 4 })
      .default("0.0000")
      .notNull(),
    lastSignalAt: timestamp("last_signal_at", { withTimezone: true }),
    calculatedAt: timestamp("calculated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("creator_metrics_creator_id_idx").on(table.creatorId),
    index("creator_metrics_win_rate_idx").on(table.winRate),
    index("creator_metrics_cumulative_return_idx").on(table.cumulativeReturn),
    index("creator_metrics_calculated_at_idx").on(table.calculatedAt),
  ],
);

export type CreatorMetricsSelect = typeof creatorMetrics.$inferSelect;
export type CreatorMetricsInsert = typeof creatorMetrics.$inferInsert;
