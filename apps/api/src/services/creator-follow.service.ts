import { and, count, desc, eq, inArray } from "drizzle-orm";
import {
  creatorSources,
  creators,
  db,
  userCreatorFollows,
} from "@call-ledger/database";
import {
  SourceAdapterError,
  type CreatorSourceType,
} from "@call-ledger/shared";
import { toSourceSummary } from "./creator-source.service";

/**
 * Wallet-based following.
 *
 * Following a creator is an OFF-CHAIN database operation:
 * - no blockchain transaction
 * - no X follow is performed (CallLedger follows are not X follows)
 * - global creators are shared: N users -> 1 creator row
 */

export interface FollowResult {
  followId: string;
  creatorId: string;
  userId: string;
  isActive: boolean;
  notificationEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  created: boolean;
}

export async function followCreator(params: {
  userId: string;
  creatorId: string;
  notificationEnabled?: boolean;
}): Promise<FollowResult> {
  const { userId, creatorId } = params;

  const [creator] = await db
    .select({ id: creators.id })
    .from(creators)
    .where(eq(creators.id, creatorId))
    .limit(1);

  if (!creator) {
    throw new SourceAdapterError(
      "CREATOR_NOT_FOUND",
      `Creator '${creatorId}' was not found`,
      404,
    );
  }

  const existing = await db
    .select()
    .from(userCreatorFollows)
    .where(
      and(
        eq(userCreatorFollows.userId, userId),
        eq(userCreatorFollows.creatorId, creatorId),
      ),
    )
    .limit(1);

  const existingRow = existing[0];

  if (existingRow) {
    if (!existingRow.isActive) {
      // Re-activate the previous follow (idempotent re-follow).
      const [updated] = await db
        .update(userCreatorFollows)
        .set({
          isActive: true,
          notificationEnabled:
            params.notificationEnabled ?? existingRow.notificationEnabled,
          updatedAt: new Date(),
        })
        .where(eq(userCreatorFollows.id, existingRow.id))
        .returning();

      return {
        ...toFollowResult(updated ?? existingRow),
        created: false,
      };
    }

    // Already following: idempotent success, no duplicate row is created.
    return { ...toFollowResult(existingRow), created: false };
  }

  const [inserted] = await db
    .insert(userCreatorFollows)
    .values({
      userId,
      creatorId,
      isActive: true,
      notificationEnabled: params.notificationEnabled ?? true,
    })
    .returning();

  if (!inserted) throw new Error("Failed to create follow");

  return { ...toFollowResult(inserted), created: true };
}

/** Unfollow deactivates the relationship (history + preferences are retained). */
export async function unfollowCreator(params: {
  userId: string;
  creatorId: string;
}) {
  const [updated] = await db
    .update(userCreatorFollows)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(
        eq(userCreatorFollows.userId, params.userId),
        eq(userCreatorFollows.creatorId, params.creatorId),
        eq(userCreatorFollows.isActive, true),
      ),
    )
    .returning();

  if (!updated) {
    // Idempotent: already not following.
    return { creatorId: params.creatorId, unfollowed: false };
  }

  return { creatorId: params.creatorId, unfollowed: true };
}

export async function isFollowing(userId: string, creatorId: string) {
  const [row] = await db
    .select({ id: userCreatorFollows.id })
    .from(userCreatorFollows)
    .where(
      and(
        eq(userCreatorFollows.userId, userId),
        eq(userCreatorFollows.creatorId, creatorId),
        eq(userCreatorFollows.isActive, true),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export interface ListFollowingQuery {
  page: number;
  limit: number;
  sourceType?: CreatorSourceType;
}

export async function listFollowing(userId: string, query: ListFollowingQuery) {
  const { page, limit, sourceType } = query;
  const offset = (page - 1) * limit;

  const baseCondition = and(
    eq(userCreatorFollows.userId, userId),
    eq(userCreatorFollows.isActive, true),
  );

  const [totalResult] = await db
    .select({ total: count() })
    .from(userCreatorFollows)
    .where(baseCondition);
  const total = Number(totalResult?.total ?? 0);

  let followRows = await db
    .select({
      followId: userCreatorFollows.id,
      followedAt: userCreatorFollows.createdAt,
      notificationEnabled: userCreatorFollows.notificationEnabled,
      creator: creators,
    })
    .from(userCreatorFollows)
    .innerJoin(creators, eq(userCreatorFollows.creatorId, creators.id))
    .where(baseCondition)
    .orderBy(desc(userCreatorFollows.createdAt));

  if (followRows.length > 0) {
    const creatorIds = followRows.map((r) => r.creator.id);
    const sources = await db
      .select()
      .from(creatorSources)
      .where(inArray(creatorSources.creatorId, creatorIds));

    let mapped = followRows.map((row) => ({
      followId: row.followId,
      followedAt: row.followedAt,
      notificationEnabled: row.notificationEnabled,
      creator: {
        id: row.creator.id,
        displayName: row.creator.displayName,
        description: row.creator.description ?? row.creator.bio ?? null,
        avatarUrl: row.creator.avatarUrl,
        status: row.creator.status,
        createdAt: row.creator.createdAt,
        sources: sources
          .filter((s) => s.creatorId === row.creator.id)
          .map((s) => toSourceSummary(s)),
      },
    }));

    if (sourceType) {
      mapped = mapped.filter((row) =>
        row.creator.sources.some((s) => s.sourceType === sourceType),
      );
    }

    // Apply pagination after the source-type filter so counts stay accurate.
    const filteredTotal = sourceType ? mapped.length : total;
    const paged = mapped.slice(offset, offset + limit);

    return {
      data: paged,
      meta: {
        page,
        limit,
        total: filteredTotal,
        totalPages: Math.ceil(filteredTotal / limit) || 1,
      },
    };
  }

  return {
    data: [],
    meta: { page, limit, total: 0, totalPages: 1 },
  };
}

function toFollowResult(row: typeof userCreatorFollows.$inferSelect) {
  return {
    followId: row.id,
    creatorId: row.creatorId,
    userId: row.userId,
    isActive: row.isActive,
    notificationEnabled: row.notificationEnabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
