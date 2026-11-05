import {
  index,
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
    xUserId: varchar("x_user_id", { length: 255 }).notNull(),
    xUsername: varchar("x_username", { length: 255 }).notNull(),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    walletAddress: varchar("wallet_address", { length: 255 }),
    status: varchar("status", { length: 50 }).default("DISCOVERED").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("creators_x_user_id_idx").on(table.xUserId),
    index("creators_x_username_idx").on(table.xUsername),
    index("creators_status_idx").on(table.status),
    index("creators_created_at_idx").on(table.createdAt),
  ],
);

export type CreatorSelect = typeof creators.$inferSelect;
export type CreatorInsert = typeof creators.$inferInsert;
