import { and, desc, eq, gte, lte, or, sql, type SQL } from "drizzle-orm";
import {
  creatorSources,
  creatorSourcePosts,
  creators,
  db,
  userCreatorFollows,
} from "@call-ledger/database";
import type { CreatorSourceType } from "@call-ledger/shared";
import { sanitizePublicUrl } from "../utils/public-url";

export interface ActivityQuery {
  cursor?: { at: Date; id: string };
  limit: number;
  creatorId?: string;
  sourceType?: CreatorSourceType;
  startDate?: Date;
  endDate?: Date;
  includeReplies: boolean;
  includeReposts: boolean;
}

export async function listUserActivity(userId: string, query: ActivityQuery) {
  return listPosts(query, { userId });
}

export async function listCreatorPosts(
  creatorId: string,
  query: ActivityQuery,
) {
  return listPosts(query, { creatorId });
}

async function listPosts(
  query: ActivityQuery,
  scope: { userId?: string; creatorId?: string },
) {
  const conditions: SQL[] = [eq(creatorSourcePosts.status, "ACTIVE")];
  if (scope.creatorId) {
    conditions.push(eq(creators.id, scope.creatorId));
  } else {
    conditions.push(
      eq(userCreatorFollows.userId, scope.userId!),
      eq(userCreatorFollows.isActive, true),
    );
    if (query.creatorId) conditions.push(eq(creators.id, query.creatorId));
  }
  if (query.sourceType) {
    conditions.push(eq(creatorSourcePosts.sourceType, query.sourceType));
  }
  if (!query.includeReplies) {
    conditions.push(eq(creatorSourcePosts.isReply, false));
  }
  if (!query.includeReposts) {
    conditions.push(eq(creatorSourcePosts.isRepost, false));
  }
  if (query.startDate) {
    conditions.push(
      gte(
        sql`coalesce(${creatorSourcePosts.publishedAt}, ${creatorSourcePosts.fetchedAt})`,
        query.startDate,
      ),
    );
  }
  if (query.endDate) {
    conditions.push(
      lte(
        sql`coalesce(${creatorSourcePosts.publishedAt}, ${creatorSourcePosts.fetchedAt})`,
        query.endDate,
      ),
    );
  }
  if (query.cursor) {
    const sortDate = sql`coalesce(${creatorSourcePosts.publishedAt}, ${creatorSourcePosts.fetchedAt})`;
    conditions.push(
      or(
        sql`${sortDate} < ${query.cursor.at}`,
        and(
          sql`${sortDate} = ${query.cursor.at}`,
          sql`${creatorSourcePosts.id} < ${query.cursor.id}`,
        ),
      )!,
    );
  }

  const rows = await db
    .select({
      id: creatorSourcePosts.id,
      externalPostId: creatorSourcePosts.externalPostId,
      sourceType: creatorSourcePosts.sourceType,
      authorExternalId: creatorSourcePosts.authorExternalId,
      authorHandle: creatorSourcePosts.authorHandle,
      title: creatorSourcePosts.title,
      content: creatorSourcePosts.content,
      canonicalUrl: creatorSourcePosts.canonicalUrl,
      publishedAt: creatorSourcePosts.publishedAt,
      fetchedAt: creatorSourcePosts.fetchedAt,
      mediaUrls: creatorSourcePosts.mediaUrls,
      isReply: creatorSourcePosts.isReply,
      isRepost: creatorSourcePosts.isRepost,
      creatorId: creators.id,
      creatorName: creators.displayName,
      creatorAvatarUrl: creators.avatarUrl,
      sourceId: creatorSources.id,
      sourceHandle: creatorSources.handle,
      sourceUrl: creatorSources.canonicalUrl,
      sourceStatus: creatorSources.status,
    })
    .from(creatorSourcePosts)
    .innerJoin(
      creatorSources,
      eq(creatorSourcePosts.creatorSourceId, creatorSources.id),
    )
    .innerJoin(creators, eq(creatorSources.creatorId, creators.id))
    .leftJoin(
      userCreatorFollows,
      and(
        eq(userCreatorFollows.creatorId, creators.id),
        scope.userId ? eq(userCreatorFollows.userId, scope.userId) : sql`false`,
      ),
    )
    .where(and(...conditions))
    .orderBy(
      desc(
        sql`coalesce(${creatorSourcePosts.publishedAt}, ${creatorSourcePosts.fetchedAt})`,
      ),
      desc(creatorSourcePosts.id),
    )
    .limit(query.limit + 1);

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  const last = page.at(-1);
  const cursor =
    hasMore && last
      ? encodeCursor(last.publishedAt ?? last.fetchedAt, last.id)
      : null;

  return {
    data: page.map((row) => ({
      ...row,
      canonicalUrl: sanitizePublicUrl(row.canonicalUrl),
      sourceUrl: sanitizePublicUrl(row.sourceUrl) ?? "",
    })),
    nextCursor: cursor,
    hasMore,
  };
}

function encodeCursor(at: Date, id: string): string {
  return Buffer.from(JSON.stringify({ at: at.toISOString(), id })).toString(
    "base64url",
  );
}
