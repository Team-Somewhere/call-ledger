import { relations } from "drizzle-orm";
import { arkivRecords } from "./arkiv-records";
import { creatorDiscoverySources } from "./creator-discovery-sources";
import { creatorFollows } from "./creator-follows";
import { creatorIdentityLinks } from "./creator-identity-links";
import { creatorMetrics } from "./creator-metrics";
import { creatorMonitoring } from "./creator-monitoring";
import { creatorPollLogs } from "./creator-poll-logs";
import { creatorSources } from "./creator-sources";
import { creators } from "./creators";
import { oauthStates } from "./oauth-states";
import { orders } from "./orders";
import { positions } from "./positions";
import { signalVerifications } from "./signal-verifications";
import { signals } from "./signals";
import { sourcePosts } from "./source-posts";
import { strategies } from "./strategies";
import { userCreatorFollows } from "./user-creator-follows";
import { users } from "./users";
import { walletNonces } from "./wallet-nonces";
import { wallets } from "./wallets";
import { xAccountConnections } from "./x-account-connections";

export const usersRelations = relations(users, ({ many }) => ({
  wallets: many(wallets),
  follows: many(creatorFollows),
  strategies: many(strategies),
  orders: many(orders),
  positions: many(positions),
  xAccountConnections: many(xAccountConnections),
  oauthStates: many(oauthStates),
  userCreatorFollows: many(userCreatorFollows),
  walletNonces: many(walletNonces),
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
  monitoring: one(creatorMonitoring, {
    fields: [creators.id],
    references: [creatorMonitoring.creatorId],
  }),
  sourcePosts: many(sourcePosts),
  discoverySources: many(creatorDiscoverySources),
  pollLogs: many(creatorPollLogs),
  sources: many(creatorSources),
  identityLinks: many(creatorIdentityLinks),
  userFollows: many(userCreatorFollows),
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

// Phase 2 relations
export const xAccountConnectionsRelations = relations(
  xAccountConnections,
  ({ one }) => ({
    user: one(users, {
      fields: [xAccountConnections.userId],
      references: [users.id],
    }),
  }),
);

export const oauthStatesRelations = relations(oauthStates, ({ one }) => ({
  user: one(users, {
    fields: [oauthStates.userId],
    references: [users.id],
  }),
}));

export const creatorMonitoringRelations = relations(
  creatorMonitoring,
  ({ one }) => ({
    creator: one(creators, {
      fields: [creatorMonitoring.creatorId],
      references: [creators.id],
    }),
  }),
);

export const sourcePostsRelations = relations(sourcePosts, ({ one }) => ({
  creator: one(creators, {
    fields: [sourcePosts.creatorId],
    references: [creators.id],
  }),
}));

export const creatorDiscoverySourcesRelations = relations(
  creatorDiscoverySources,
  ({ one }) => ({
    creator: one(creators, {
      fields: [creatorDiscoverySources.creatorId],
      references: [creators.id],
    }),
  }),
);

export const creatorPollLogsRelations = relations(
  creatorPollLogs,
  ({ one }) => ({
    creator: one(creators, {
      fields: [creatorPollLogs.creatorId],
      references: [creators.id],
    }),
  }),
);

// Phase 2A relations
export const creatorSourcesRelations = relations(
  creatorSources,
  ({ one, many }) => ({
    creator: one(creators, {
      fields: [creatorSources.creatorId],
      references: [creators.id],
    }),
    identityLink: one(creatorIdentityLinks, {
      fields: [creatorSources.id],
      references: [creatorIdentityLinks.creatorSourceId],
    }),
    follows: many(userCreatorFollows),
  }),
);

export const creatorIdentityLinksRelations = relations(
  creatorIdentityLinks,
  ({ one }) => ({
    creator: one(creators, {
      fields: [creatorIdentityLinks.creatorId],
      references: [creators.id],
    }),
    source: one(creatorSources, {
      fields: [creatorIdentityLinks.creatorSourceId],
      references: [creatorSources.id],
    }),
    verifiedBy: one(users, {
      fields: [creatorIdentityLinks.verifiedByUserId],
      references: [users.id],
    }),
  }),
);

export const userCreatorFollowsRelations = relations(
  userCreatorFollows,
  ({ one }) => ({
    user: one(users, {
      fields: [userCreatorFollows.userId],
      references: [users.id],
    }),
    creator: one(creators, {
      fields: [userCreatorFollows.creatorId],
      references: [creators.id],
    }),
  }),
);

export const walletNoncesRelations = relations(walletNonces, ({ one }) => ({
  user: one(users, {
    fields: [walletNonces.userId],
    references: [users.id],
  }),
}));
