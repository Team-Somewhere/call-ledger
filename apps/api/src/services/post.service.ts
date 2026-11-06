import { and, count, desc, eq } from "drizzle-orm";
import { creators, db, sourcePosts } from "@call-ledger/database";
import type { ApiPaginationMeta } from "@call-ledger/shared";

export async function findPostsByCreatorId(
  creatorId: string,
  query: { page: number; limit: number },
) {
  const { page, limit } = query;
  const offset = (page - 1) * limit;

  const [totalResult] = await db
    .select({ total: count() })
    .from(sourcePosts)
    .where(eq(sourcePosts.creatorId, creatorId));

  const total = Number(totalResult?.total || 0);

  const rows = await db
    .select({
      id: sourcePosts.id,
      creatorId: sourcePosts.creatorId,
      source: sourcePosts.source,
      sourcePostId: sourcePosts.sourcePostId,
      sourceAuthorId: sourcePosts.sourceAuthorId,
      createdAtSource: sourcePosts.createdAtSource,
      capturedAt: sourcePosts.capturedAt,
      lastSeenAt: sourcePosts.lastSeenAt,
      contentStorageStatus: sourcePosts.contentStorageStatus,
      contentText: sourcePosts.contentText,
      publicMetrics: sourcePosts.publicMetrics,
      editHistory: sourcePosts.editHistory,
    })
    .from(sourcePosts)
    .where(eq(sourcePosts.creatorId, creatorId))
    .orderBy(desc(sourcePosts.createdAtSource))
    .limit(limit)
    .offset(offset);

  const meta: ApiPaginationMeta = {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };

  return { data: rows, meta };
}

export async function findPostById(id: string) {
  const [post] = await db
    .select()
    .from(sourcePosts)
    .where(eq(sourcePosts.id, id))
    .limit(1);

  return post || null;
}

