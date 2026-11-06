import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { creators } from "./creators";

/**
 * Immutable audit log of polling operations.
 * Never update or delete rows — only insert.
 * Credentials and token values must never appear here.
 */
export const creatorPollLogs = pgTable(
  "creator_poll_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => creators.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    // 'SUCCESS' | 'FAILED' | 'RATE_LIMITED' | 'SKIPPED' | 'AUTHOR_MISMATCH'
    status: varchar("status", { length: 50 }).notNull(),
    postsFetched: integer("posts_fetched").default(0).notNull(),
    postsInserted: integer("posts_inserted").default(0).notNull(),
    postsUpdated: integer("posts_updated").default(0).notNull(),
    postsRejected: integer("posts_rejected").default(0).notNull(),
    httpStatus: integer("http_status"),
    rateLimitRemaining: integer("rate_limit_remaining"),
    rateLimitResetAt: timestamp("rate_limit_reset_at", { withTimezone: true }),
    errorCode: varchar("error_code", { length: 100 }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("poll_logs_creator_id_idx").on(table.creatorId),
    index("poll_logs_started_at_idx").on(table.startedAt),
    index("poll_logs_status_idx").on(table.status),
  ],
);

export type CreatorPollLogSelect = typeof creatorPollLogs.$inferSelect;
export type CreatorPollLogInsert = typeof creatorPollLogs.$inferInsert;

