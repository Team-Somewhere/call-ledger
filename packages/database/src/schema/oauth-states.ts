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
 * Stores OAuth 2.0 PKCE state records for in-flight authorization flows.
 * - state_hash: SHA-256 of the random state value (never store raw state)
 * - code_verifier_encrypted: AES-256-GCM encrypted PKCE verifier
 * - consumed_at: set on first callback use to prevent replay attacks
 * - expires_at: records expire after a short window (default 10 minutes)
 */
export const oauthStates = pgTable(
  "oauth_states",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    stateHash: varchar("state_hash", { length: 128 }).notNull(),
    codeVerifierEncrypted: text("code_verifier_encrypted").notNull(),
    // User ID is nullable because unauthenticated users can start the flow
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("oauth_states_state_hash_idx").on(table.stateHash),
    index("oauth_states_expires_at_idx").on(table.expiresAt),
  ],
);

export type OAuthStateSelect = typeof oauthStates.$inferSelect;
export type OAuthStateInsert = typeof oauthStates.$inferInsert;

