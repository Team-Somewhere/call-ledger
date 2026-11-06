/**
 * Archive service — all Arkiv reads go through here.
 *
 * Reads are served directly from Arkiv Rabdi; we never return
 * fabricated content from a PostgreSQL content cache.
 *
 * The local arkiv_records table is used for:
 *   - fast deduplication lookups (write path, in worker)
 *   - joining Arkiv metadata with creator context
 *   - expiry tracking
 *
 * This service never touches ARKIV_ARCHIVER_PRIVATE_KEY.
 */

import {
  getArchiveStats,
  getPostByEntityKey,
  queryPosts,
  createArkivPublicClient,
  type ArchivedPost,
} from "@call-ledger/arkiv";
import { arkivRecords, creators, db } from "@call-ledger/database";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { env } from "../config/env";

// ─── Public client singleton ──────────────────────────────────────────────

let _publicClient: ReturnType<typeof createArkivPublicClient> | null = null;

function getPublicClient() {
  if (_publicClient) return _publicClient;
  if (!env.ARKIV_ACCESS_KEY) return null;
  _publicClient = createArkivPublicClient({
    accessKey: env.ARKIV_ACCESS_KEY,
    rpcUrl: env.ARKIV_RPC_URL,
  });
  return _publicClient;
}

export function isArkivConfigured(): boolean {
  return Boolean(env.ARKIV_ACCESS_KEY);
}

// ─── Types ────────────────────────────────────────────────────────────────

export interface ArchiveQueryOptions {
  username?: string;
  sourcePostId?: string;
  tradingRelated?: boolean;
  from?: Date;
  to?: Date;
  limit?: number;
  cursor?: string; // nextKey from previous page
}

export interface ArchivePostResponse extends ArchivedPost {
  /** Local DB row id, if this was written by this CallLedger instance */
  localId?: string;
  /** Arkiv tx hash from local record (may differ from on-chain if re-queried) */
  localTxHash?: string | null;
  /** Creator display name enrichment from local DB */
  creatorDisplayName?: string | null;
  /** Creator UUID from local DB */
  creatorId?: string | null;
}

// ─── Queries ─────────────────────────────────────────────────────────────

/**
 * GET /api/archive/posts — paginated post list with optional filters.
 * Reads directly from Arkiv.
 */
export async function listArchivedPosts(options: ArchiveQueryOptions = {}): Promise<{
  posts: ArchivePostResponse[];
  hasMore: boolean;
  nextCursor: string | null;
  source: "arkiv" | "unavailable";
}> {
  const client = getPublicClient();
  if (!client) {
    return { posts: [], hasMore: false, nextCursor: null, source: "unavailable" };
  }

  const { posts, hasMore, nextKey } = await queryPosts(client, {
    authorUsername: options.username,
    sourcePostId: options.sourcePostId,
    tradingRelated: options.tradingRelated,
    fromDate: options.from,
    toDate: options.to,
    limit: options.limit ?? 20,
    afterKey: options.cursor,
  });

  // Enrich with local metadata where available
  const enriched = await enrichWithLocalData(posts);

  return {
    posts: enriched,
    hasMore,
    nextCursor: nextKey,
    source: "arkiv",
  };
}

/**
 * GET /api/archive/posts/:entityKey — single post by Arkiv entity key.
 */
export async function getArchivedPost(entityKey: string): Promise<{
  post: ArchivePostResponse | null;
  source: "arkiv" | "unavailable";
}> {
  const client = getPublicClient();
  if (!client) {
    return { post: null, source: "unavailable" };
  }

  const post = await getPostByEntityKey(client, entityKey);
  if (!post) return { post: null, source: "arkiv" };

  const [enriched] = await enrichWithLocalData([post]);
  return { post: enriched ?? null, source: "arkiv" };
}

/**
 * GET /api/archive/traders/:username/posts — posts for a specific trader.
 */
export async function listTraderArchivedPosts(
  username: string,
  options: Omit<ArchiveQueryOptions, "username"> = {},
): Promise<{
  posts: ArchivePostResponse[];
  hasMore: boolean;
  nextCursor: string | null;
  source: "arkiv" | "unavailable";
}> {
  return listArchivedPosts({ ...options, username: username.toLowerCase() });
}

/**
 * GET /api/archive/stats — aggregate archive statistics.
 */
export async function getArkivStats(): Promise<{
  arkiv: {
    totalPosts: number;
    tradingRelatedPosts: number;
    uniqueTraders: number;
    oldestPost: Date | null;
    newestPost: Date | null;
  };
  local: {
    totalRecords: number;
    recordsExpiringWithin30Days: number;
  };
  configured: boolean;
  source: "arkiv" | "unavailable";
}> {
  const client = getPublicClient();

  const [localStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      expiringSoon: sql<number>`count(*) filter (
        where expires_at is not null
        and expires_at < now() + interval '30 days'
        and expires_at > now()
      )::int`,
    })
    .from(arkivRecords)
    .where(eq(arkivRecords.sourcePlatform, "x"));

  if (!client) {
    return {
      arkiv: {
        totalPosts: 0,
        tradingRelatedPosts: 0,
        uniqueTraders: 0,
        oldestPost: null,
        newestPost: null,
      },
      local: {
        totalRecords: Number(localStats?.total ?? 0),
        recordsExpiringWithin30Days: Number(localStats?.expiringSoon ?? 0),
      },
      configured: false,
      source: "unavailable",
    };
  }

  const arkivStats = await getArchiveStats(client);

  return {
    arkiv: arkivStats,
    local: {
      totalRecords: Number(localStats?.total ?? 0),
      recordsExpiringWithin30Days: Number(localStats?.expiringSoon ?? 0),
    },
    configured: true,
    source: "arkiv",
  };
}

// ─── X-monitor status (for admin visibility) ─────────────────────────────

export async function getXMonitorStatus(): Promise<{
  enabled: boolean;
  arkivConfigured: boolean;
  arkivWriteConfigured: boolean;
  trackedXSources: number;
  activeSources: number;
  recentArchived: number;
}> {
  const { creatorSources } = await import("@call-ledger/database");
  const { count } = await import("drizzle-orm");

  const [xSourceStats] = await db
    .select({
      total: count(),
      active: sql<number>`count(*) filter (where status = 'ACTIVE')::int`,
    })
    .from(creatorSources)
    .where(eq(creatorSources.sourceType, "X"));

  const [recentCount] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(arkivRecords)
    .where(
      and(
        eq(arkivRecords.sourcePlatform, "x"),
        sql`created_at > now() - interval '24 hours'`,
      ),
    );

  return {
    enabled: Boolean(process.env.X_MONITOR_ENABLED === "true"),
    arkivConfigured: Boolean(env.ARKIV_ACCESS_KEY),
    arkivWriteConfigured: Boolean(process.env.ARKIV_ARCHIVER_PRIVATE_KEY),
    trackedXSources: Number(xSourceStats?.total ?? 0),
    activeSources: Number(xSourceStats?.active ?? 0),
    recentArchived: Number(recentCount?.total ?? 0),
  };
}

// ─── Enrichment ──────────────────────────────────────────────────────────

async function enrichWithLocalData(
  posts: ArchivedPost[],
): Promise<ArchivePostResponse[]> {
  if (posts.length === 0) return [];

  const sourcePostIds = posts.map((p) => p.sourcePostId).filter(Boolean);
  if (sourcePostIds.length === 0) return posts;

  // Batch-fetch local records for these post IDs
  const localRows = await db
    .select({
      id: arkivRecords.id,
      sourcePostId: arkivRecords.sourcePostId,
      entityKey: arkivRecords.entityKey,
      txHash: arkivRecords.txHash,
      relatedCreatorId: arkivRecords.relatedCreatorId,
      creatorDisplayName: creators.displayName,
    })
    .from(arkivRecords)
    .leftJoin(creators, eq(arkivRecords.relatedCreatorId, creators.id))
    .where(
      and(
        eq(arkivRecords.sourcePlatform, "x"),
        sql`${arkivRecords.sourcePostId} = any(${sql.raw(
          `array[${sourcePostIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(",")}]`,
        )})`,
      ),
    );

  const localByPostId = new Map(
    localRows.map((r) => [r.sourcePostId ?? "", r]),
  );

  return posts.map((post) => {
    const local = localByPostId.get(post.sourcePostId);
    return {
      ...post,
      localId: local?.id,
      localTxHash: local?.txHash ?? post.txHash,
      creatorDisplayName: local?.creatorDisplayName ?? null,
      creatorId: local?.relatedCreatorId ?? null,
    };
  });
}
