import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { creatorMetrics, creatorSources, creators, db, signals } from "@call-ledger/database";
import type { ApiPaginationMeta } from "@call-ledger/shared";
import { toSourceSummary } from "./creator-source.service";

export interface GetCreatorsQuery {
  page: number;
  limit: number;
  status?: string;
  search?: string;
  sortBy?: "winRate" | "totalSignals" | "cumulativeReturn" | "createdAt";
  order?: "asc" | "desc";
}

export async function findCreators(query: GetCreatorsQuery) {
  const { page, limit, status, search } = query;
  const offset = (page - 1) * limit;

  const conditions = [];

  if (status) {
    conditions.push(eq(creators.status, status));
  }

  if (search) {
    conditions.push(
      or(
        ilike(creators.displayName, `%${search}%`),
        ilike(creators.xUsername, `%${search}%`),
      ),
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult] = await db
    .select({ total: count() })
    .from(creators)
    .where(whereClause);
  const total = Number(totalResult?.total || 0);

  const rows = await db
    .select({
      id: creators.id,
      displayName: creators.displayName,
      xUserId: creators.xUserId,
      xUsername: creators.xUsername,
      bio: creators.bio,
      avatarUrl: creators.avatarUrl,
      walletAddress: creators.walletAddress,
      status: creators.status,
      createdAt: creators.createdAt,
      updatedAt: creators.updatedAt,
      metrics: {
        id: creatorMetrics.id,
        totalSignals: creatorMetrics.totalSignals,
        verifiedSignals: creatorMetrics.verifiedSignals,
        winningSignals: creatorMetrics.winningSignals,
        losingSignals: creatorMetrics.losingSignals,
        winRate: creatorMetrics.winRate,
        averageReturn: creatorMetrics.averageReturn,
        cumulativeReturn: creatorMetrics.cumulativeReturn,
        lastSignalAt: creatorMetrics.lastSignalAt,
        calculatedAt: creatorMetrics.calculatedAt,
      },
    })
    .from(creators)
    .leftJoin(creatorMetrics, eq(creators.id, creatorMetrics.creatorId))
    .where(whereClause)
    .orderBy(desc(creators.createdAt))
    .limit(limit)
    .offset(offset);

  // Fetch X sources for all creators (filter for X only)
  const creatorIds = rows.map((r) => r.id);
  const sources =
    creatorIds.length > 0
      ? await db
          .select({
            id: creatorSources.id,
            creatorId: creatorSources.creatorId,
            sourceType: creatorSources.sourceType,
            handle: creatorSources.handle,
            canonicalUrl: creatorSources.canonicalUrl,
            status: creatorSources.status,
          })
          .from(creatorSources)
          .where(
            and(
              or(...creatorIds.map((id) => eq(creatorSources.creatorId, id))),
              eq(creatorSources.sourceType, "X"), // Only X sources
            ),
          )
      : [];

  const sourcesByCreator = new Map<string, typeof sources>();
  for (const source of sources) {
    if (!sourcesByCreator.has(source.creatorId)) {
      sourcesByCreator.set(source.creatorId, []);
    }
    sourcesByCreator.get(source.creatorId)!.push(source);
  }

  const creatorsWithSources = rows.map((row) => ({
    ...row,
    sources: (sourcesByCreator.get(row.id) || []).map((s) => ({
      id: s.id,
      sourceType: s.sourceType as "X",
      handle: s.handle,
      canonicalUrl: s.canonicalUrl,
      status: s.status,
    })),
  }));

  const meta: ApiPaginationMeta = {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };

  return { data: creatorsWithSources, meta };
}

export async function findCreatorById(id: string) {
  const [creator] = await db
    .select({
      id: creators.id,
      displayName: creators.displayName,
      xUserId: creators.xUserId,
      xUsername: creators.xUsername,
      bio: creators.bio,
      avatarUrl: creators.avatarUrl,
      walletAddress: creators.walletAddress,
      status: creators.status,
      createdAt: creators.createdAt,
      updatedAt: creators.updatedAt,
      metrics: {
        id: creatorMetrics.id,
        totalSignals: creatorMetrics.totalSignals,
        verifiedSignals: creatorMetrics.verifiedSignals,
        winningSignals: creatorMetrics.winningSignals,
        losingSignals: creatorMetrics.losingSignals,
        winRate: creatorMetrics.winRate,
        averageReturn: creatorMetrics.averageReturn,
        cumulativeReturn: creatorMetrics.cumulativeReturn,
        lastSignalAt: creatorMetrics.lastSignalAt,
        calculatedAt: creatorMetrics.calculatedAt,
      },
    })
    .from(creators)
    .leftJoin(creatorMetrics, eq(creators.id, creatorMetrics.creatorId))
    .where(eq(creators.id, id))
    .limit(1);

  if (!creator) {
    return null;
  }

  // Fetch X sources for this creator
  const xSources = await db
    .select({
      id: creatorSources.id,
      sourceType: creatorSources.sourceType,
      handle: creatorSources.handle,
      canonicalUrl: creatorSources.canonicalUrl,
      status: creatorSources.status,
    })
    .from(creatorSources)
    .where(
      and(
        eq(creatorSources.creatorId, id),
        eq(creatorSources.sourceType, "X"), // Only X sources
      ),
    );

  // Fetch recent signals for this creator
  const recentSignals = await db
    .select()
    .from(signals)
    .where(eq(signals.creatorId, id))
    .orderBy(desc(signals.capturedAt))
    .limit(10);

  return {
    ...creator,
    sources: xSources.map((s) => ({
      id: s.id,
      sourceType: s.sourceType as "X",
      handle: s.handle,
      canonicalUrl: s.canonicalUrl,
      status: s.status,
    })),
    recentSignals,
  };
}
