import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { creators } from "./creators";
import { users } from "./users";

export const strategies = pgTable(
  "strategies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => creators.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    status: varchar("status", { length: 50 }).default("ACTIVE").notNull(),
    executionMode: varchar("execution_mode", { length: 50 })
      .default("MANUAL")
      .notNull(),
    maxTradeAmount: numeric("max_trade_amount", {
      precision: 18,
      scale: 4,
    }).notNull(),
    maxDailyTrades: integer("max_daily_trades").default(5).notNull(),
    minCreatorWinRate: numeric("min_creator_win_rate", {
      precision: 5,
      scale: 2,
    }).default("50.00"),
    allowedDirections: varchar("allowed_directions", { length: 50 })
      .default("BOTH")
      .notNull(),
    entryOrderType: varchar("entry_order_type", { length: 50 })
      .default("MARKET")
      .notNull(),
    stopLossPercentage: numeric("stop_loss_percentage", {
      precision: 5,
      scale: 2,
    }),
    takeProfitPercentage: numeric("take_profit_percentage", {
      precision: 5,
      scale: 2,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("strategies_user_id_idx").on(table.userId),
    index("strategies_creator_id_idx").on(table.creatorId),
    index("strategies_status_idx").on(table.status),
  ],
);

export type StrategySelect = typeof strategies.$inferSelect;
export type StrategyInsert = typeof strategies.$inferInsert;
