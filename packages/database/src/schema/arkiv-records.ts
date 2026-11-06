import {
  boolean,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { creators } from "./creators";
import { creatorSourcePosts } from "./creator-source-posts";
import { signals } from "./signals";

/**
 * Off-chain reference table for Arkiv on-chain entities.
 *
 * Arkiv is the canonical store for archived X post content.
 * This table stores only the reference metadata (entity key, tx hash,
 * expiry, and deduplication keys). It is NOT a content cache.
 *
 * Deduplication key: (sourcePlatform, sourcePostId) must be unique per
 * archived post — Arkiv does not enforce application-level uniqueness.
 */
export const arkivRecords = pgTable(
  "arkiv_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // --- Legacy / general Arkiv record fields ---
    recordType: varchar("record_type", { length: 100 }).notNull().default("ARCHIVED_X_POST"),
    entityKey:  varchar("entity_key", { length: 512 }).notNull(),
    entityId:   varchar("entity_id", { length: 255 }),
    ownerAddress: varchar("owner_address", { length: 255 }),

    // --- On-chain reference ---
    /** Arkiv transaction hash from the write. May be null for legacy records. */
    txHash: varchar("tx_hash", { length: 512 }),

    // --- Source identification (dedup keys) ---
    /** "x" | "bluesky" | etc. */
    sourcePlatform: varchar("source_platform", { length: 50 }),
    /** The stable provider post ID (X status ID, etc.). */
    sourcePostId: varchar("source_post_id", { length: 500 }),

    // --- Content summary (for admin/monitoring — NOT a content cache) ---
    authorUsername:  varchar("author_username", { length: 255 }),
    contentFidelity: varchar("content_fidelity", { length: 30 }),
    tradingRelated:  boolean("trading_related"),

    // --- Expiry tracking ---
    /** When the Arkiv entity expires. Null = unknown or not set. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    // --- Relational links ---
    relatedCreatorId: uuid("related_creator_id").references(
      () => creators.id,
      { onDelete: "set null" },
    ),
    relatedSignalId: uuid("related_signal_id").references(() => signals.id, {
      onDelete: "set null",
    }),
    /** The creator_source_posts row this was archived from. */
    creatorSourcePostId: uuid("creator_source_post_id").references(
      () => creatorSourcePosts.id,
      { onDelete: "set null" },
    ),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("arkiv_records_creator_id_idx").on(table.relatedCreatorId),
    index("arkiv_records_signal_id_idx").on(table.relatedSignalId),
    index("arkiv_records_type_idx").on(table.recordType),
    index("arkiv_records_entity_key_idx").on(table.entityKey),
    index("arkiv_records_source_post_idx").on(table.sourcePostId),
    index("arkiv_records_author_idx").on(table.authorUsername),
    index("arkiv_records_trading_related_idx").on(table.tradingRelated),
    index("arkiv_records_expires_at_idx").on(table.expiresAt),
    // Prevent archiving the same post twice
    uniqueIndex("arkiv_records_platform_post_idx").on(
      table.sourcePlatform,
      table.sourcePostId,
    ),
  ],
);

export type ArkivRecordSelect = typeof arkivRecords.$inferSelect;
export type ArkivRecordInsert = typeof arkivRecords.$inferInsert;
