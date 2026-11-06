import {
  boolean,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { creators } from "./creators";
import { users } from "./users";

/**
 * Wallet-based follow relationship between a CallLedger user and a creator.
 *
 * This is an OFF-CHAIN database operation. Following a creator never creates a
 * blockchain transaction and never performs an X/Bluesky follow.
 *
 * Multiple users may follow the same global creator; a single user may follow
 * a creator at most once (enforced by the unique index). Unfollowing flips
 * `is_active` to false so notification preferences / follow history survive.
 */
export const userCreatorFollows = pgTable(
  "user_creator_follows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => creators.id, { onDelete: "cascade" }),
    isActive: boolean("is_active").default(true).notNull(),
    notificationEnabled: boolean("notification_enabled")
      .default(true)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("user_creator_follows_user_creator_idx").on(
      table.userId,
      table.creatorId,
    ),
    index("user_creator_follows_user_active_idx").on(
      table.userId,
      table.isActive,
    ),
    index("user_creator_follows_creator_idx").on(table.creatorId),
  ],
);

export type UserCreatorFollowSelect =
  typeof userCreatorFollows.$inferSelect;
export type UserCreatorFollowInsert =
  typeof userCreatorFollows.$inferInsert;
