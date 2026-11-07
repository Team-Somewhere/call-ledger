import {
  index,
  numeric,
  pgTable,
  jsonb,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { signals } from "./signals";
import { strategies } from "./strategies";
import { users } from "./users";

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    signalId: uuid("signal_id").references(() => signals.id, {
      onDelete: "set null",
    }),
    strategyId: uuid("strategy_id").references(() => strategies.id, {
      onDelete: "set null",
    }),
    provider: varchar("provider", { length: 50 })
      .default("DEFINITIVE")
      .notNull(),
    providerOrderId: varchar("provider_order_id", { length: 255 }),
    chainId: varchar("chain_id", { length: 50 }).notNull(),
    walletAddress: varchar("wallet_address", { length: 255 }).notNull(),
    inputToken: varchar("input_token", { length: 255 }).notNull(),
    outputToken: varchar("output_token", { length: 255 }).notNull(),
    inputAmount: numeric("input_amount", {
      precision: 28,
      scale: 12,
    }).notNull(),
    outputAmount: numeric("output_amount", { precision: 28, scale: 12 }),
    orderType: varchar("order_type", { length: 50 })
      .default("MARKET")
      .notNull(),
    status: varchar("status", { length: 50 })
      .default("PENDING_SIGNATURE")
      .notNull(),
    transactionHash: varchar("transaction_hash", { length: 255 }),
    flashQuoteId: varchar("flash_quote_id", { length: 255 }),
    orderParameters: jsonb("order_parameters"),
    rawStatus: varchar("raw_status", { length: 80 }),
    closeReason: varchar("close_reason", { length: 160 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("orders_user_id_idx").on(table.userId),
    index("orders_signal_id_idx").on(table.signalId),
    index("orders_strategy_id_idx").on(table.strategyId),
    index("orders_status_idx").on(table.status),
    index("orders_provider_order_id_idx").on(table.providerOrderId),
    uniqueIndex("orders_flash_quote_id_uidx").on(table.flashQuoteId),
  ],
);

export type OrderSelect = typeof orders.$inferSelect;
export type OrderInsert = typeof orders.$inferInsert;
