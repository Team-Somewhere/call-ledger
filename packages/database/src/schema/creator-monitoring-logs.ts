import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { creatorSources } from "./creator-sources";

/**
 * Append-only monitoring audit log for GLOBAL creator sources. Written by the
 * worker. Never stores secrets, authorization headers or raw payloads.
 *
 * status: SUCCESS | PARTIAL | FAILED | SKIPPED
 */
export const creatorMonitoringLogs = pgTable(
  "creator_monitoring_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    creatorSourceId: uuid("creator_source_id")
      .notNull()
      .references(() => creatorSources.id, { onDelete: "cascade" }),
    sourceType: varchar("source_type", { length: 20 }).notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    itemsFound: integer("items_found").default(0).notNull(),
    itemsInserted: integer("items_inserted").default(0).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    errorCode: varchar("error_code", { length: 80 }),
    errorMessage: text("error_message"),
    /** Short machine label, e.g. 'scheduled', 'recovered', 'manual'. */
    trigger: varchar("trigger", { length: 30 }).default("scheduled").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("creator_monitoring_logs_source_idx").on(
      table.creatorSourceId,
      table.startedAt,
    ),
    index("creator_monitoring_logs_started_at_idx").on(table.startedAt),
    index("creator_monitoring_logs_status_idx").on(table.status),
  ],
);

export type CreatorMonitoringLogSelect = typeof creatorMonitoringLogs.$inferSelect;
export type CreatorMonitoringLogInsert = typeof creatorMonitoringLogs.$inferInsert;
