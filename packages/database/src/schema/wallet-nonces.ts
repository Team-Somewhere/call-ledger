import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Single-use nonces for wallet signature authentication.
 *
 * Security properties:
 * - nonce is random (32 bytes hex) and stored hashed? -> stored raw for message
 *   construction, which is fine because it is single-use and short-lived.
 * - expires_at limits the window (default 5 minutes).
 * - used_at enforces single-use: a nonce can never authenticate twice.
 * - address is normalized to lowercase so `0xABC...` and `0xabc...` match.
 */
export const walletNonces = pgTable(
  "wallet_nonces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    address: varchar("address", { length: 42 }).notNull(),
    nonce: varchar("nonce", { length: 128 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    domain: varchar("domain", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    /** Housekeeping marker so expired nonces can be purged cheaply. */
    invalidatedAt: timestamp("invalidated_at", { withTimezone: true }),
    lastError: text("last_error"),
  },
  (table) => [
    uniqueIndex("wallet_nonces_nonce_idx").on(table.nonce),
    index("wallet_nonces_address_idx").on(table.address),
    index("wallet_nonces_expires_at_idx").on(table.expiresAt),
  ],
);

export type WalletNonceSelect = typeof walletNonces.$inferSelect;
export type WalletNonceInsert = typeof walletNonces.$inferInsert;
