import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { creatorSources } from "./creator-sources";
import { creators } from "./creators";
import { users } from "./users";

/**
 * Records *how* a source identity came to be associated with a creator.
 *
 * We deliberately never merge profiles automatically based on handle
 * similarity. Linking is always explicit (user or administrator), and the
 * evidence is captured here so the relationship is auditable.
 */
export const creatorIdentityLinks = pgTable(
  "creator_identity_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => creators.id, { onDelete: "cascade" }),
    creatorSourceId: uuid("creator_source_id")
      .notNull()
      .references(() => creatorSources.id, { onDelete: "cascade" }),
    // 'CREATED_WITH' | 'EXPLICIT_LINK' | 'SELF_CLAIM'
    relationshipType: varchar("relationship_type", { length: 40 }).notNull(),
    // 'NONE' | 'PROVIDER_OATH' | 'META_TAG' | 'HANDLE_BIO' | 'PROVIDER_DID' | 'MANUAL_ADMIN' | 'IMPORTED'
    verificationMethod: varchar("verification_method", { length: 40 })
      .default("NONE")
      .notNull(),
    verifiedByUserId: uuid("verified_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    evidence: text("evidence"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("creator_identity_links_source_idx").on(table.creatorSourceId),
    index("creator_identity_links_creator_idx").on(table.creatorId),
  ],
);

export type CreatorIdentityLinkSelect =
  typeof creatorIdentityLinks.$inferSelect;
export type CreatorIdentityLinkInsert =
  typeof creatorIdentityLinks.$inferInsert;
