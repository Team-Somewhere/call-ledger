import {
  index,
  numeric,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { orders } from "./orders";
import { users } from "./users";

export const positions = pgTable(
  "positions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    assetAddress: varchar("asset_address", { length: 255 }).notNull(),
    chainId: varchar("chain_id", { length: 50 }).notNull(),
    quantity: numeric("quantity", { precision: 28, scale: 12 }).notNull(),
    averageEntryPrice: numeric("average_entry_price", {
      precision: 18,
      scale: 8,
    }).notNull(),
    currentPrice: numeric("current_price", { precision: 18, scale: 8 }),
    unrealizedPnl: numeric("unrealized_pnl", {
      precision: 18,
      scale: 4,
    }).default("0.0000"),
    realizedPnl: numeric("realized_pnl", { precision: 18, scale: 4 }).default(
      "0.0000",
    ),
    walletAddress: varchar("wallet_address", { length: 255 }),
    quoteAsset: varchar("quote_asset", { length: 255 }),
    investedAmount: numeric("invested_amount", { precision: 28, scale: 12 }).default(
      "0",
    ),
    remainingQuantity: numeric("remaining_quantity", { precision: 28, scale: 12 }),
    totalFilledQuantity: numeric("total_filled_quantity", {
      precision: 28,
      scale: 12,
    }),
    status: varchar("status", { length: 50 }).default("OPEN").notNull(), // OPEN / CLOSED
    openedAt: timestamp("opened_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("positions_user_id_idx").on(table.userId),
    index("positions_asset_address_idx").on(table.assetAddress),
    index("positions_status_idx").on(table.status),
  ],
);

export type PositionSelect = typeof positions.$inferSelect;
export type PositionInsert = typeof positions.$inferInsert;
