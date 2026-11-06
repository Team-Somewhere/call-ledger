import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { creators } from "./creators";

/**
 * Stores posts retrieved from X for monitored creators.
 *
 * X Developer Policy Compliance:
 * - content_text is stored only when content_storage_status = 'STORED'
 * - If a post is deleted on X, we must update content_storage_status to 'DELETED'
 *   and null out content_text within a reasonable time (targeting 24h)
 * - X_CONTENT_RETENTION_MODE=id_only: never store text, only IDs and metadata
 * - X_CONTENT_RETENTION_MODE=store: store text with deletion synchronization
 * - Do NOT publish raw text to Arkiv or any third-party service
 * - Do NOT use content to train AI/ML models
 *
 * The source field is always 'X' for this phase.
 * source_post_id is the stable X post ID.
 * source_author_id is verified against the creator's x_user_id before acceptance.
 */
export const sourcePosts = pgTable(
  "source_posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => creators.id, { onDelete: "restrict" }),
    source: varchar("source", { length: 50 }).default("X").notNull(),
    sourcePostId: varchar("source_post_id", { length: 255 }).notNull(),
    sourceAuthorId: varchar("source_author_id", { length: 255 }).notNull(),
    createdAtSource: timestamp("created_at_source", {
      withTimezone: true,
    }).notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    // 'STORED' | 'DELETED' | 'WITHHELD' | 'ID_ONLY'
    contentStorageStatus: varchar("content_storage_status", { length: 50 })
      .default("STORED")
      .notNull(),
    contentText: text("content_text"),
    // Stored as JSONB — only public_metrics returned by X API (like_count etc)
    publicMetrics: jsonb("public_metrics"),
    // Array of post IDs representing edit history
    editHistory: jsonb("edit_history"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Primary deduplication constraint
    uniqueIndex("source_posts_source_post_id_idx").on(
      table.source,
      table.sourcePostId,
    ),
    index("source_posts_creator_id_idx").on(table.creatorId),
    index("source_posts_created_at_source_idx").on(table.createdAtSource),
    index("source_posts_captured_at_idx").on(table.capturedAt),
    index("source_posts_content_status_idx").on(table.contentStorageStatus),
  ],
);

export type SourcePostSelect = typeof sourcePosts.$inferSelect;
export type SourcePostInsert = typeof sourcePosts.$inferInsert;

