import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const creators = pgTable(
  "creators",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    displayName: varchar("display_name", { length: 255 }).notNull(),
    description: text("description"),
    // Legacy X columns. Phase 2A made creators source-agnostic: X identity now
    // lives in `creator_sources`. Nullable so non-X creators (RSS/Bluesky/Website)
    // can exist without fabricating an X identity.
    xUserId: varchar("x_user_id", { length: 255 }),
    xUsername: varchar("x_username", { length: 255 }),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    walletAddress: varchar("wallet_address", { length: 255 }),
    status: varchar("status", { length: 50 }).default("DISCOVERED").notNull(),
    // Phase 2 additions
    discoverySource: varchar("discovery_source", { length: 50 })
      .default("MANUAL")
      .notNull(),
    qualificationScore: integer("qualification_score"),
    qualificationNotes: text("qualification_notes"),
    qualifiedBy: uuid("qualified_by"),
    qualifiedAt: timestamp("qualified_at", { withTimezone: true }),
    // isXVerified: true when this creator's X account ownership has been
    // verified via OAuth. DISTINCT from the creator being qualified for signals.
    isXVerified: boolean("is_x_verified").default(false).notNull(),
    // monitoringEnabled must be explicitly set by an admin — not automatic
    monitoringEnabled: boolean("monitoring_enabled").default(false).notNull(),
    lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
    lastPostAt: timestamp("last_post_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("creators_x_user_id_idx").on(table.xUserId),
    uniqueIndex("creators_x_username_lower_idx").on(sql`lower(${table.xUsername})`),
    index("creators_x_username_idx").on(table.xUsername),
    index("creators_status_idx").on(table.status),
    index("creators_created_at_idx").on(table.createdAt),
    index("creators_monitoring_enabled_idx").on(table.monitoringEnabled),
  ],
);

export type CreatorSelect = typeof creators.$inferSelect;
export type CreatorInsert = typeof creators.$inferInsert;
