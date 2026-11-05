import { relations } from "drizzle-orm";
import { arkivRecords } from "./arkiv-records";
import { creatorFollows } from "./creator-follows";
import { creatorMetrics } from "./creator-metrics";
import { creators } from "./creators";
import { orders } from "./orders";
import { positions } from "./positions";
import { signalVerifications } from "./signal-verifications";
import { signals } from "./signals";
import { strategies } from "./strategies";
import { users } from "./users";
import { wallets } from "./wallets";

export const usersRelations = relations(users, ({ many }) => ({
  wallets: many(wallets),
  follows: many(creatorFollows),
  strategies: many(strategies),
  orders: many(orders),
  positions: many(positions),
}));

export const walletsRelations = relations(wallets, ({ one }) => ({
  user: one(users, {
    fields: [wallets.userId],
    references: [users.id],
  }),
}));

export const creatorsRelations = relations(creators, ({ one, many }) => ({
  metrics: one(creatorMetrics, {
    fields: [creators.id],
    references: [creatorMetrics.creatorId],
  }),
  followers: many(creatorFollows),
  strategies: many(strategies),
  signals: many(signals),
  arkivRecords: many(arkivRecords),
}));

export const creatorMetricsRelations = relations(creatorMetrics, ({ one }) => ({
  creator: one(creators, {
    fields: [creatorMetrics.creatorId],
    references: [creators.id],
  }),
}));

export const creatorFollowsRelations = relations(creatorFollows, ({ one }) => ({
  user: one(users, {
    fields: [creatorFollows.userId],
    references: [users.id],
  }),
  creator: one(creators, {
    fields: [creatorFollows.creatorId],
    references: [creators.id],
  }),
}));

export const strategiesRelations = relations(strategies, ({ one, many }) => ({
  user: one(users, {
    fields: [strategies.userId],
    references: [users.id],
  }),
  creator: one(creators, {
    fields: [strategies.creatorId],
    references: [creators.id],
  }),
  orders: many(orders),
}));

export const signalsRelations = relations(signals, ({ one, many }) => ({
  creator: one(creators, {
    fields: [signals.creatorId],
    references: [creators.id],
  }),
  verifications: many(signalVerifications),
  orders: many(orders),
  arkivRecords: many(arkivRecords),
}));

export const signalVerificationsRelations = relations(
  signalVerifications,
  ({ one }) => ({
    signal: one(signals, {
      fields: [signalVerifications.signalId],
      references: [signals.id],
    }),
  }),
);

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  signal: one(signals, {
    fields: [orders.signalId],
    references: [signals.id],
  }),
  strategy: one(strategies, {
    fields: [orders.strategyId],
    references: [strategies.id],
  }),
  positions: many(positions),
}));

export const positionsRelations = relations(positions, ({ one }) => ({
  user: one(users, {
    fields: [positions.userId],
    references: [users.id],
  }),
  order: one(orders, {
    fields: [positions.orderId],
    references: [orders.id],
  }),
}));

export const arkivRecordsRelations = relations(arkivRecords, ({ one }) => ({
  creator: one(creators, {
    fields: [arkivRecords.relatedCreatorId],
    references: [creators.id],
  }),
  signal: one(signals, {
    fields: [arkivRecords.relatedSignalId],
    references: [signals.id],
  }),
}));
