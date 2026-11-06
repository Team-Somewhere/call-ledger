import { and, count, desc, eq, gte, max, sql } from "drizzle-orm";
import {
  creatorMonitoringLogs,
  creatorSources,
  creatorSourcePosts,
  creators,
  db,
} from "@call-ledger/database";
import { sanitizePublicUrl } from "../utils/public-url";

export async function getMonitoringDashboard() {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  const [
    creatorCount,
    sourceCount,
    activeSourceCount,
    waitingXCount,
    postCount,
    postTodayCount,
    failedCount,
    latestSuccess,
    backingOffCount,
  ] = await Promise.all([
    db.select({ total: count() }).from(creators),
    db.select({ total: count() }).from(creatorSources),
    db
      .select({ total: count() })
      .from(creatorSources)
      .where(eq(creatorSources.status, "ACTIVE")),
    db
      .select({ total: count() })
      .from(creatorSources)
      .where(
        and(
          eq(creatorSources.sourceType, "X"),
          eq(creatorSources.status, "WAITING_FOR_AUTHORIZED_ACCESS"),
        ),
      ),
    db.select({ total: count() }).from(creatorSourcePosts),
    db
      .select({ total: count() })
      .from(creatorSourcePosts)
      .where(gte(creatorSourcePosts.fetchedAt, dayStart)),
    db
      .select({ total: count() })
      .from(creatorMonitoringLogs)
      .where(
        and(
          eq(creatorMonitoringLogs.status, "FAILED"),
          gte(
            creatorMonitoringLogs.startedAt,
            new Date(now.getTime() - 24 * 60 * 60 * 1000),
          ),
        ),
      ),
    db
      .select({ at: max(creatorMonitoringLogs.completedAt) })
      .from(creatorMonitoringLogs)
      .where(eq(creatorMonitoringLogs.status, "SUCCESS")),
    db
      .select({ total: count() })
      .from(creatorSources)
      .where(
        and(
          eq(creatorSources.status, "ACTIVE"),
          sql`${creatorSources.consecutiveFailures} > 0`,
        ),
      ),
  ]);

  const sourceTypes = await db
    .select({
      sourceType: creatorSources.sourceType,
      active: sql<number>`count(*) filter (where ${creatorSources.status} = 'ACTIVE')`,
    })
    .from(creatorSources)
    .groupBy(creatorSources.sourceType);

  const postsCollected = Number(postCount[0]?.total ?? 0);
  const postsCollectedToday = Number(postTodayCount[0]?.total ?? 0);

  return {
    totals: {
      creators: Number(creatorCount[0]?.total ?? 0),
      sources: Number(sourceCount[0]?.total ?? 0),
      activeSources: Number(activeSourceCount[0]?.total ?? 0),
      waitingForAuthorizedAccess: Number(waitingXCount[0]?.total ?? 0),
      postsCollected,
      postsCollectedToday,
      failedRunsLast24Hours: Number(failedCount[0]?.total ?? 0),
      sourcesBackingOff: Number(backingOffCount[0]?.total ?? 0),
    },
    sourcesByType: Object.fromEntries(
      sourceTypes.map((row) => [row.sourceType, Number(row.active)]),
    ),
    lastSuccessfulFetch: latestSuccess[0]?.at ?? null,
  };
}

export async function listMonitoringLogs(limit: number, sourceId?: string) {
  const conditions = sourceId
    ? [eq(creatorMonitoringLogs.creatorSourceId, sourceId)]
    : [];
  const rows = await db
    .select({
      id: creatorMonitoringLogs.id,
      sourceId: creatorMonitoringLogs.creatorSourceId,
      sourceType: creatorMonitoringLogs.sourceType,
      status: creatorMonitoringLogs.status,
      itemsFound: creatorMonitoringLogs.itemsFound,
      itemsInserted: creatorMonitoringLogs.itemsInserted,
      startedAt: creatorMonitoringLogs.startedAt,
      completedAt: creatorMonitoringLogs.completedAt,
      errorCode: creatorMonitoringLogs.errorCode,
      errorMessage: creatorMonitoringLogs.errorMessage,
      creatorId: creators.id,
      creatorName: creators.displayName,
      creatorAvatarUrl: creators.avatarUrl,
      sourceHandle: creatorSources.handle,
      sourceUrl: creatorSources.canonicalUrl,
    })
    .from(creatorMonitoringLogs)
    .innerJoin(
      creatorSources,
      eq(creatorMonitoringLogs.creatorSourceId, creatorSources.id),
    )
    .innerJoin(creators, eq(creatorSources.creatorId, creators.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(creatorMonitoringLogs.startedAt))
    .limit(limit);
  return rows.map((row) => ({
    ...row,
    sourceUrl: sanitizePublicUrl(row.sourceUrl) ?? "",
  }));
}

export async function getCreatorSourceStatus(sourceId: string) {
  const [source] = await db
    .select({
      id: creatorSources.id,
      creatorId: creators.id,
      creatorName: creators.displayName,
      creatorAvatarUrl: creators.avatarUrl,
      sourceType: creatorSources.sourceType,
      handle: creatorSources.handle,
      canonicalUrl: creatorSources.canonicalUrl,
      status: creatorSources.status,
      lastFetchedAt: creatorSources.lastFetchedAt,
      nextFetchAt: creatorSources.nextFetchAt,
      lastError: creatorSources.lastError,
      retryCount: creatorSources.retryCount,
      consecutiveFailures: creatorSources.consecutiveFailures,
    })
    .from(creatorSources)
    .innerJoin(creators, eq(creatorSources.creatorId, creators.id))
    .where(eq(creatorSources.id, sourceId))
    .limit(1);

  if (!source) return null;
  const logs = await listMonitoringLogs(10, sourceId);
  return {
    ...source,
    canonicalUrl: sanitizePublicUrl(source.canonicalUrl) ?? "",
    recentLogs: logs,
  };
}
