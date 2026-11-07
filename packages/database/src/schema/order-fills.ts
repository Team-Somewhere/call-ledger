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
import { orders } from "./orders";

export const orderFills = pgTable(
  "order_fills",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    flashOrderId: varchar("flash_order_id", { length: 255 }).notNull(),
    fillKey: varchar("fill_key", { length: 512 }).notNull(),
    transactionHash: varchar("transaction_hash", { length: 255 }),
    chain: varchar("chain", { length: 50 }).notNull(),
    inputAmount: numeric("input_amount", { precision: 28, scale: 12 }),
    outputAmount: numeric("output_amount", { precision: 28, scale: 12 }),
    executionPrice: numeric("execution_price", { precision: 28, scale: 12 }),
    fees: jsonb("fees"),
    fillTimestamp: timestamp("fill_timestamp", { withTimezone: true }),
    status: varchar("status", { length: 40 }),
    raw: jsonb("raw"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("order_fills_fill_key_uidx").on(table.fillKey),
    index("order_fills_order_id_idx").on(table.orderId),
    index("order_fills_flash_order_id_idx").on(table.flashOrderId),
    index("order_fills_tx_idx").on(table.transactionHash),
  ],
);

export type OrderFillSelect = typeof orderFills.$inferSelect;
