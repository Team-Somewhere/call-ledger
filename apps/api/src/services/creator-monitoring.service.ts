import { and, count, desc, eq, gt, isNull, lt, or } from "drizzle-orm";
import {
  creatorMonitoring,
  creatorPollLogs,
  creators,
  db,
  sourcePosts,
} from "@call-ledger/database";
import { getXClient, XApiError, XPost } from "../integrations/x";

export interface EnableMonitoringOptions {
  pollIntervalSeconds?: number;
}

/**
 * Enables monitoring for an eligible creator.
 * Rules:
 * - Creator must be QUALIFIED (or MONITORING).
 * - REJECTED or SUSPENDED creators cannot be monitored.
 */
export async function enableMonitoring(
  creatorId: string,
  options: EnableMonitoringOptions = {},
) {
  const [creator] = await db
    .select()
    .from(creators)
    .where(eq(creators.id, creatorId))
    .limit(1);

  if (!creator) {
    throw new Error(`Creator with ID ${creatorId} not found`);
  }

  if (creator.status === "REJECTED" || creator.status === "SUSPENDED") {
    throw new Error(`Cannot enable monitoring for creator with status ${creator.status}`);
  }

  const interval = options.pollIntervalSeconds || 900; // default 15 min

  // Update creator
  const [updatedCreator] = await db
    .update(creators)
    .set({
      monitoringEnabled: true,
      status: "MONITORING",
      updatedAt: new Date(),
    })
    .where(eq(creators.id, creatorId))
    .returning();

  // Upsert creator_monitoring state
  const [existingMonitoring] = await db
    .select()
    .from(creatorMonitoring)
    .where(eq(creatorMonitoring.creatorId, creatorId))
    .limit(1);

  if (existingMonitoring) {
    await db
      .update(creatorMonitoring)
      .set({
        monitoringStatus: "ACTIVE",
        pollIntervalSeconds: interval,
        nextPollAt: new Date(), // Due immediately
        isLocked: false,
        updatedAt: new Date(),
      })
      .where(eq(creatorMonitoring.id, existingMonitoring.id));
  } else {
    await db.insert(creatorMonitoring).values({
      creatorId,
      monitoringStatus: "ACTIVE",
      pollIntervalSeconds: interval,
      nextPollAt: new Date(),
      isLocked: false,
    });
  }

  return updatedCreator;
}

/**
 * Disables monitoring for a creator.
 */
export async function disableMonitoring(creatorId: string) {
  const [updatedCreator] = await db
    .update(creators)
    .set({
      monitoringEnabled: false,
      status: "QUALIFIED",
      updatedAt: new Date(),
    })
    .where(eq(creators.id, creatorId))
    .returning();

  if (!updatedCreator) {
    throw new Error(`Creator with ID ${creatorId} not found`);
  }

  await db
    .update(creatorMonitoring)
    .set({
      monitoringStatus: "PAUSED",
      isLocked: false,
      updatedAt: new Date(),
    })
    .where(eq(creatorMonitoring.creatorId, creatorId));

  return updatedCreator;
}

/**
 * Gets monitoring state and recent poll logs for a creator.
 */
export async function getCreatorMonitoringDetails(creatorId: string) {
  const [monitoring] = await db
    .select()
    .from(creatorMonitoring)
    .where(eq(creatorMonitoring.creatorId, creatorId))
    .limit(1);

  const logs = await db
    .select()
    .from(creatorPollLogs)
    .where(eq(creatorPollLogs.creatorId, creatorId))
    .orderBy(desc(creatorPollLogs.startedAt))
    .limit(20);

  const [postCountResult] = await db
    .select({ total: count() })
    .from(sourcePosts)
    .where(eq(sourcePosts.creatorId, creatorId));

  return {
    monitoring,
    recentLogs: logs,
    totalPostsIngested: Number(postCountResult?.total || 0),
  };
}

/**
 * Overview statistics across the entire monitoring pipeline.
 */
export async function getMonitoringOverview() {
  const [activeCountResult] = await db
    .select({ total: count() })
    .from(creators)
    .where(eq(creators.monitoringEnabled, true));

  const [totalMonitoredResult] = await db
    .select({ total: count() })
    .from(creatorMonitoring);

  const [totalPostsResult] = await db
    .select({ total: count() })
    .from(sourcePosts);

  const recentLogs = await db
    .select({
      id: creatorPollLogs.id,
      creatorId: creatorPollLogs.creatorId,
      status: creatorPollLogs.status,
      postsFetched: creatorPollLogs.postsFetched,
      postsInserted: creatorPollLogs.postsInserted,
      postsRejected: creatorPollLogs.postsRejected,
      httpStatus: creatorPollLogs.httpStatus,
      startedAt: creatorPollLogs.startedAt,
      completedAt: creatorPollLogs.completedAt,
      errorCode: creatorPollLogs.errorCode,
      errorMessage: creatorPollLogs.errorMessage,
      creatorUsername: creators.xUsername,
      creatorDisplayName: creators.displayName,
    })
    .from(creatorPollLogs)
    .innerJoin(creators, eq(creatorPollLogs.creatorId, creators.id))
    .orderBy(desc(creatorPollLogs.startedAt))
    .limit(25);

  return {
    activeMonitoredCount: Number(activeCountResult?.total || 0),
    totalMonitoredEntities: Number(totalMonitoredResult?.total || 0),
    totalPostsIngested: Number(totalPostsResult?.total || 0),
    recentLogs,
  };
}

