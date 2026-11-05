import {
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { creators } from "./creators";
import { users } from "./users";

export const creatorFollows = pgTable(
  "creator_follows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => creators.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("creator_follows_user_creator_idx").on(
      table.userId,
      table.creatorId,
    ),
    index("creator_follows_user_id_idx").on(table.userId),
    index("creator_follows_creator_id_idx").on(table.creatorId),
  ],
);

export type CreatorFollowSelect = typeof creatorFollows.$inferSelect;
export type CreatorFollowInsert = typeof creatorFollows.$inferInsert;
