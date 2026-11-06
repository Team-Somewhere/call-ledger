import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { creatorSources } from "./creator-sources";

/**
 * Normalized posts collected from a GLOBAL creator source (RSS item, Bluesky
 * post, scraped page). One row per source post, shared by every follower of
 * the creator. Followers never get per-user copies.
 *
 * Provider-specific shapes are normalized by the adapter before insert; this
 * table never depends on a provider response format.
 *
 * Retention: content is stored as provided by the source (public content).
 * `status` records lifecycle: ACTIVE, DELETED (the provider no longer returns
 * it), UNAVAILABLE (temporarily unreadable). Raw provider payloads are NOT
 * stored; only a minimal, non-sensitive `provider_meta` JSON is kept.
 */
export const creatorSourcePosts = pgTable(
  "creator_source_posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    creatorSourceId: uuid("creator_source_id")
      .notNull()
      .references(() => creatorSources.id, { onDelete: "cascade" }),
    /** Stable provider post id: AT URI, RSS guid, canonical URL, page hash. */
    externalPostId: varchar("external_post_id", { length: 1000 }).notNull(),
    /** Denormalized for fast source-type filtering in feeds. */
    sourceType: varchar("source_type", { length: 20 }).notNull(),
    authorExternalId: varchar("author_external_id", { length: 500 }),
    authorHandle: varchar("author_handle", { length: 255 }),
    title: varchar("title", { length: 500 }),
    content: text("content"),
    canonicalUrl: varchar("canonical_url", { length: 2048 }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    /** sha256 of normalized content; detects edits to an existing post. */
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    mediaUrls: jsonb("media_urls"),
    isReply: boolean("is_reply").default(false).notNull(),
    isRepost: boolean("is_repost").default(false).notNull(),
    /** 'ACTIVE' | 'DELETED' | 'UNAVAILABLE' */
    status: varchar("status", { length: 20 }).default("ACTIVE").notNull(),
    /** Minimal non-sensitive provider metadata (never tokens or raw payloads). */
    providerMeta: jsonb("provider_meta"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Idempotency: one row per (source, external post). Inserts use
    // ON CONFLICT DO NOTHING / DO UPDATE against this index.
    uniqueIndex("creator_source_posts_source_external_idx").on(
      table.creatorSourceId,
      table.externalPostId,
    ),
    index("creator_source_posts_source_idx").on(table.creatorSourceId),
    index("creator_source_posts_published_at_idx").on(table.publishedAt),
    index("creator_source_posts_fetched_at_idx").on(table.fetchedAt),
    index("creator_source_posts_external_post_id_idx").on(table.externalPostId),
    index("creator_source_posts_content_hash_idx").on(table.contentHash),
    index("creator_source_posts_feed_idx").on(
      table.sourceType,
      table.publishedAt,
    ),
  ],
);

export type CreatorSourcePostSelect = typeof creatorSourcePosts.$inferSelect;
export type CreatorSourcePostInsert = typeof creatorSourcePosts.$inferInsert;
