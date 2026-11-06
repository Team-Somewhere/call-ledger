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
 * Tracks where creators were originally discovered.
 * Source types: MANUAL | USER_SUBMISSION | DIRECTORY | API_SEARCH | OTHER
 */
export const creatorDiscoverySources = pgTable(
  "creator_discovery_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => creators.id, { onDelete: "cascade" }),
    sourceType: varchar("source_type", { length: 50 }).notNull(),
    sourceReference: varchar("source_reference", { length: 500 }),
    discoveredBy: uuid("discovered_by"),
    discoveredAt: timestamp("discovered_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    notes: text("notes"),
  },
  (table) => [
    index("discovery_sources_creator_id_idx").on(table.creatorId),
    index("discovery_sources_type_idx").on(table.sourceType),
  ],
);

export type CreatorDiscoverySourceSelect =
  typeof creatorDiscoverySources.$inferSelect;
export type CreatorDiscoverySourceInsert =
  typeof creatorDiscoverySources.$inferInsert;

