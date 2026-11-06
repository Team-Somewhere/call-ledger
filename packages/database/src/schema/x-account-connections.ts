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
 * Stores OAuth 2.0 connections between CallLedger users and their X accounts.
 * Tokens are encrypted at rest — never stored as plaintext.
 */
export const xAccountConnections = pgTable(
  "x_account_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    xUserId: varchar("x_user_id", { length: 255 }).notNull(),
    xUsername: varchar("x_username", { length: 255 }).notNull(),
    // Tokens stored encrypted (AES-256-GCM) — never expose raw values
    accessTokenEncrypted: text("access_token_encrypted").notNull(),
    refreshTokenEncrypted: text("refresh_token_encrypted"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    scopes: varchar("scopes", { length: 500 }),
    connectionStatus: varchar("connection_status", { length: 50 })
      .default("CONNECTED")
      .notNull(),
    connectedAt: timestamp("connected_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // One user can have one X connection
    uniqueIndex("x_connections_user_id_idx").on(table.userId),
    // One X account can only be connected once across all users
    uniqueIndex("x_connections_x_user_id_idx").on(table.xUserId),
    index("x_connections_status_idx").on(table.connectionStatus),
  ],
);

export type XAccountConnectionSelect = typeof xAccountConnections.$inferSelect;
export type XAccountConnectionInsert = typeof xAccountConnections.$inferInsert;

