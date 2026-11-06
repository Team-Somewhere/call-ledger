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
 * Tracks polling state for each monitored creator.
 * One row per creator. Provides due-time scheduling and concurrency control.
 *
 * Key design decisions:
 * - next_poll_at drives scheduling (index for efficient querying)
 * - last_seen_post_id is the stable deduplication anchor
 * - pagination_token is the API cursor (may become stale — do not rely on alone)
 * - is_locked prevents concurrent polls of the same creator
 * - lock_acquired_at enables crash recovery (stale locks expire)
 */
export const creatorMonitoring = pgTable(
  "creator_monitoring",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => creators.id, { onDelete: "cascade" }),
    monitoringStatus: varchar("monitoring_status", { length: 50 })
      .default("ACTIVE")
      .notNull(),
    pollIntervalSeconds: integer("poll_interval_seconds")
      .default(900)
      .notNull(),
    nextPollAt: timestamp("next_poll_at", { withTimezone: true }).defaultNow(),
    lastPollStartedAt: timestamp("last_poll_started_at", {
      withTimezone: true,
    }),
    lastPollCompletedAt: timestamp("last_poll_completed_at", {
      withTimezone: true,
    }),
    lastSuccessfulPollAt: timestamp("last_successful_poll_at", {
      withTimezone: true,
    }),
    lastSeenPostId: varchar("last_seen_post_id", { length: 255 }),
    paginationToken: text("pagination_token"),
    consecutiveFailures: integer("consecutive_failures").default(0).notNull(),
    lastErrorCode: varchar("last_error_code", { length: 50 }),
    lastErrorMessage: text("last_error_message"),
    // Concurrency lock — prevents two workers polling the same creator simultaneously
    isLocked: boolean("is_locked").default(false).notNull(),
    lockAcquiredAt: timestamp("lock_acquired_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("creator_monitoring_creator_id_idx").on(table.creatorId),
    index("creator_monitoring_next_poll_at_idx").on(table.nextPollAt),
    index("creator_monitoring_status_idx").on(table.monitoringStatus),
  ],
);

export type CreatorMonitoringSelect = typeof creatorMonitoring.$inferSelect;
export type CreatorMonitoringInsert = typeof creatorMonitoring.$inferInsert;

