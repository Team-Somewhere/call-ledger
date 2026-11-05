import { index, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { creators } from "./creators";
import { signals } from "./signals";

export const arkivRecords = pgTable(
  "arkiv_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recordType: varchar("record_type", { length: 100 }).notNull(),
    entityKey: varchar("entity_key", { length: 255 }).notNull(),
    entityId: varchar("entity_id", { length: 255 }).notNull(),
    ownerAddress: varchar("owner_address", { length: 255 }).notNull(),
    relatedCreatorId: uuid("related_creator_id").references(() => creators.id, {
      onDelete: "set null",
    }),
    relatedSignalId: uuid("related_signal_id").references(() => signals.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("arkiv_records_creator_id_idx").on(table.relatedCreatorId),
    index("arkiv_records_signal_id_idx").on(table.relatedSignalId),
    index("arkiv_records_type_idx").on(table.recordType),
    index("arkiv_records_entity_key_idx").on(table.entityKey),
  ],
);

export type ArkivRecordSelect = typeof arkivRecords.$inferSelect;
export type ArkivRecordInsert = typeof arkivRecords.$inferInsert;
