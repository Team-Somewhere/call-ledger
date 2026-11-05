import {
  index,
  numeric,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { creators } from "./creators";

export const signals = pgTable(
  "signals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => creators.id, { onDelete: "cascade" }),
    sourcePostId: varchar("source_post_id", { length: 255 }),
    assetSymbol: varchar("asset_symbol", { length: 50 }).notNull(),
    assetAddress: varchar("asset_address", { length: 255 }),
    chainId: varchar("chain_id", { length: 50 }),
    direction: varchar("direction", { length: 10 }).notNull(), // BUY / SELL
    entryPrice: numeric("entry_price", { precision: 18, scale: 8 }),
    takeProfit: numeric("take_profit", { precision: 18, scale: 8 }),
    stopLoss: numeric("stop_loss", { precision: 18, scale: 8 }),
    timeframe: varchar("timeframe", { length: 50 }),
    confidence: numeric("confidence", { precision: 5, scale: 2 }),
    classification: varchar("classification", { length: 50 })
      .default("TRADE_SIGNAL")
      .notNull(),
    signalStatus: varchar("signal_status", { length: 50 })
      .default("ACTIVE")
      .notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("signals_source_post_id_idx").on(table.sourcePostId),
    index("signals_creator_id_idx").on(table.creatorId),
    index("signals_asset_symbol_idx").on(table.assetSymbol),
    index("signals_classification_idx").on(table.classification),
    index("signals_signal_status_idx").on(table.signalStatus),
    index("signals_captured_at_idx").on(table.capturedAt),
  ],
);

export type SignalSelect = typeof signals.$inferSelect;
export type SignalInsert = typeof signals.$inferInsert;
