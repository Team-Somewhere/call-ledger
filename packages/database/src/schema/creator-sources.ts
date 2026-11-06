import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { creators } from "./creators";

/**
 * A `creator_sources` row represents one external profile / feed that belongs
 * to a global creator. One creator may own many sources (X + Bluesky + RSS +
 * Website). Sources are provider-independent: the adapter layer translates
 * provider payloads into the columns below.
 *
 * Status semantics:
 * - ACTIVE                        — the platform may fetch this source
 * - WAITING_FOR_AUTHORIZED_ACCESS — record saved, live monitoring not enabled
 *                                   (e.g. X with no authorized data provider)
 * - DISABLED                      — user/admin paused monitoring
 * - ERROR                         — last monitoring attempt failed
 *
 * Verification semantics: identities are UNVERIFIED unless there is an
 * explicit proof. We never auto-merge two handles just because they look alike.
 *
 * Monitoring columns (lastFetchedAt / nextFetchAt / lastCursor / retryCount /
 * etag / lastModified ...) are intentionally populated ready for the Phase 2B
 * worker; no worker is implemented in Phase 2A.
 */
export const creatorSources = pgTable(
  "creator_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => creators.id, { onDelete: "cascade" }),
    // 'X' | 'BLUESKY' | 'RSS' | 'WEBSITE'
    sourceType: varchar("source_type", { length: 20 }).notNull(),
    // Stable provider identity: X user id, Bluesky DID, normalized feed id...
    externalId: varchar("external_id", { length: 500 }),
    // Human handle: X username, Bluesky handle, feed host...
    handle: varchar("handle", { length: 255 }),
    canonicalUrl: varchar("canonical_url", { length: 2048 }).notNull(),
    status: varchar("status", { length: 50 })
      .default("ACTIVE")
      .notNull(),
    verificationStatus: varchar("verification_status", { length: 30 })
      .default("UNVERIFIED")
      .notNull(),
    // Profile metadata resolved from the provider (never fabricated)
    displayName: varchar("display_name", { length: 255 }),
    description: text("description"),
    avatarUrl: text("avatar_url"),
    // --- Phase 2B monitoring state -------------------------------------
    lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
    nextFetchAt: timestamp("next_fetch_at", { withTimezone: true }),
    lastCursor: text("last_cursor"),
    lastError: text("last_error"),
    lastErrorAt: timestamp("last_error_at", { withTimezone: true }),
    retryCount: integer("retry_count").default(0).notNull(),
    etag: varchar("etag", { length: 500 }),
    lastModified: varchar("last_modified", { length: 255 }),
    /** True once an admin confirms we are authorized to crawl this website. */
    crawlAuthorized: boolean("crawl_authorized").default(false).notNull(),
    /** Provider-specific, non-secret metadata (feed format, DID doc, ...). */
    providerMeta: text("provider_meta"),
    // --- Phase 2B: lease-based scheduling lock -------------------------
    // A worker claims a source by atomically setting lock_expires_at into the
    // future. A crashed worker's lease simply expires and the source becomes
    // claimable again. locked_by is informational (worker instance id).
    lockExpiresAt: timestamp("lock_expires_at", { withTimezone: true }),
    lockedBy: varchar("locked_by", { length: 120 }),
    /** Consecutive failures; drives exponential backoff. Reset on success. */
    consecutiveFailures: integer("consecutive_failures").default(0).notNull(),
    /** Set when a permanent configuration error stops automatic polling. */
    permanentErrorCode: varchar("permanent_error_code", { length: 80 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // A creator cannot own the same source identity twice.
    uniqueIndex("creator_sources_creator_type_identity_idx").on(
      table.creatorId,
      table.sourceType,
      sql`coalesce(${table.externalId}, ${table.handle}, ${table.canonicalUrl})`,
    ),
    index("creator_sources_creator_id_idx").on(table.creatorId),
    index("creator_sources_type_idx").on(table.sourceType),
    index("creator_sources_status_idx").on(table.status),
    index("creator_sources_next_fetch_at_idx").on(table.nextFetchAt),
    index("creator_sources_lock_expires_at_idx").on(table.lockExpiresAt),
  ],
);

export type CreatorSourceSelect = typeof creatorSources.$inferSelect;
export type CreatorSourceInsert = typeof creatorSources.$inferInsert;
