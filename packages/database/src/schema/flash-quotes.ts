import {
  index,
  jsonb,
  numeric,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { signals } from "./signals";
import { users } from "./users";

export const flashQuotes = pgTable(
  "flash_quotes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    walletAddress: varchar("wallet_address", { length: 255 }).notNull(),
    signalId: uuid("signal_id").references(() => signals.id, {
      onDelete: "set null",
    }),
    chain: varchar("chain", { length: 50 }).notNull(),
    flashQuoteId: varchar("flash_quote_id", { length: 255 }).notNull(),
    orderType: varchar("order_type", { length: 40 }).notNull(),
    side: varchar("side", { length: 10 }).notNull(),
    targetAsset: varchar("target_asset", { length: 255 }).notNull(),
    contraAsset: varchar("contra_asset", { length: 255 }).notNull(),
    qty: numeric("qty", { precision: 28, scale: 12 }).notNull(),
    quoteRequest: jsonb("quote_request").notNull(),
    quoteResponse: jsonb("quote_response").notNull(),
    status: varchar("status", { length: 30 }).default("ACTIVE").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("flash_quotes_wallet_quote_uidx").on(
      table.walletAddress,
      table.flashQuoteId,
    ),
    index("flash_quotes_user_id_idx").on(table.userId),
    index("flash_quotes_signal_id_idx").on(table.signalId),
  ],
);

export type FlashQuoteSelect = typeof flashQuotes.$inferSelect;
