import {
  index,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { creators } from "./creators";

/**
 * Complete Arkiv transaction receipt history.
 *
 * One row per confirmed Arkiv write. This is NOT a content store — no post
 * text lives here. It is a lightweight index of on-chain transaction receipts
 * so that the UI can display a full transaction history and the latest hash.
 *
 * The arkiv_records table stores deduplication metadata (one row per unique
 * post). This table stores every write receipt (same post can only appear once
 * due to deduplication, but every confirmed hash is recorded here).
 */
export const arkivTransactions = pgTable(
  "arkiv_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    /** Arkiv entity key returned by createEntity(). */
    entityKey: varchar("entity_key", { length: 512 }).notNull(),

    /** Arkiv on-chain transaction hash. */
    txHash: varchar("tx_hash", { length: 512 }).notNull().unique(),

    /** The X status ID that was archived. */
    sourcePostId: varchar("source_post_id", { length: 500 }).notNull(),

    /** FK to creators table — which trader this post belongs to. */
    traderId: uuid("trader_id").references(() => creators.id, {
      onDelete: "set null",
    }),

    /** Denormalized handle for display without a join. */
    traderUsername: varchar("trader_username", { length: 255 }),

    /** CONFIRMED | PENDING | FAILED */
    status: varchar("status", { length: 20 }).notNull().default("CONFIRMED"),

    /** When the entity was submitted to Arkiv. */
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    /** When the transaction was confirmed (entity key returned). */
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),

    /** When the Arkiv entity expires. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("arkiv_tx_trader_id_idx").on(table.traderId),
    index("arkiv_tx_source_post_id_idx").on(table.sourcePostId),
    index("arkiv_tx_submitted_at_idx").on(table.submittedAt),
    index("arkiv_tx_status_idx").on(table.status),
    // For the "latest transaction" query
    index("arkiv_tx_confirmed_at_idx").on(table.confirmedAt),
  ],
);

export type ArkivTransactionSelect = typeof arkivTransactions.$inferSelect;
export type ArkivTransactionInsert = typeof arkivTransactions.$inferInsert;
