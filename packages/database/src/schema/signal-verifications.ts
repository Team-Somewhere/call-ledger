import {
  index,
  numeric,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { signals } from "./signals";

export const signalVerifications = pgTable(
  "signal_verifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    signalId: uuid("signal_id")
      .notNull()
      .references(() => signals.id, { onDelete: "cascade" }),
    verificationStatus: varchar("verification_status", { length: 50 })
      .default("PENDING")
      .notNull(),
    entryPrice: numeric("entry_price", { precision: 18, scale: 8 }),
    exitPrice: numeric("exit_price", { precision: 18, scale: 8 }),
    returnPercentage: numeric("return_percentage", { precision: 10, scale: 4 }),
    outcome: varchar("outcome", { length: 50 }), // WIN, LOSS, BREAKEVEN, PENDING
    verificationMethod: varchar("verification_method", { length: 100 }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("signal_verifications_signal_id_idx").on(table.signalId),
    index("signal_verifications_status_idx").on(table.verificationStatus),
    index("signal_verifications_outcome_idx").on(table.outcome),
  ],
);

export type SignalVerificationSelect = typeof signalVerifications.$inferSelect;
export type SignalVerificationInsert = typeof signalVerifications.$inferInsert;
