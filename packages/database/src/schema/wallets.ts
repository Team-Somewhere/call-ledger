import {
  boolean,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const wallets = pgTable(
  "wallets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    address: varchar("address", { length: 255 }).notNull(),
    chainId: varchar("chain_id", { length: 50 }).notNull(),
    walletType: varchar("wallet_type", { length: 50 }).notNull(),
    isPrimary: boolean("is_primary").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("wallets_user_address_chain_idx").on(
      table.userId,
      table.address,
      table.chainId,
    ),
    index("wallets_user_id_idx").on(table.userId),
    index("wallets_address_idx").on(table.address),
  ],
);

export type WalletSelect = typeof wallets.$inferSelect;
export type WalletInsert = typeof wallets.$inferInsert;
