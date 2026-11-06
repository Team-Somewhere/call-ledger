import { and, desc, eq } from "drizzle-orm";
import {
  creatorMonitoring,
  creatorPollLogs,
  creators,
  db,
  sourcePosts,
} from "@call-ledger/database";
import { getXClient, XApiError, XPost } from "../integrations/x";

export interface IngestPostsResult {
  postsFetched: number;
  postsInserted: number;
  postsUpdated: number;
  postsRejected: number;
  newCursor?: string;
}

/**
 * Ingests a set of posts for a creator:
 * 1. Checks author_id on every post against expected creator.xUserId (rejects mismatches).
 * 2. Deduplicates via unique constraint (source, source_post_id).
 * 3. Applies X Developer Policy content retention mode:
 *    - 'store': persists content_text with status = 'STORED'.
 *    - 'id_only': does not persist raw text, sets status = 'ID_ONLY'.
 * 4. Updates last_seen_at and detects edit history changes.
 * 5. Returns count of inserted, updated, and rejected posts.
 */
export async function ingestCreatorPosts(
  creator: typeof creators.$inferSelect,
  posts: XPost[],
): Promise<IngestPostsResult> {
  const retentionMode = process.env.X_CONTENT_RETENTION_MODE || "store";
  const defaultStatus = retentionMode === "id_only" ? "ID_ONLY" : "STORED";

  let postsInserted = 0;
  let postsUpdated = 0;
  let postsRejected = 0;
  let newestPostDate: Date | null = null;
  let newestPostId: string | null = null;

  for (const post of posts) {
    // AUTHOR VERIFICATION: Strictly reject posts where author_id != creator.xUserId
    if (post.author_id !== creator.xUserId) {
      console.warn(
        `[Ingestion Warning] Author mismatch! Monitored creator ${creator.xUsername} (${creator.xUserId}) received post ${post.id} authored by ${post.author_id}. Post rejected.`,
      );
      postsRejected++;
      continue;
    }

    const postDate = new Date(post.created_at);
    if (!newestPostDate || postDate > newestPostDate) {
      newestPostDate = postDate;
      newestPostId = post.id;
    }

    // Check if post already exists
    const [existing] = await db
      .select()
      .from(sourcePosts)
      .where(
        and(
          eq(sourcePosts.source, "X"),
          eq(sourcePosts.sourcePostId, post.id),
        ),
      )
      .limit(1);

    if (existing) {
      // Post exists — update last_seen_at and public metrics
      await db
        .update(sourcePosts)
        .set({
          lastSeenAt: new Date(),
          publicMetrics: post.public_metrics || existing.publicMetrics,
          editHistory: post.edit_history_tweet_ids || existing.editHistory,
          updatedAt: new Date(),
        })
        .where(eq(sourcePosts.id, existing.id));
      postsUpdated++;
    } else {
      // Insert new post
      await db.insert(sourcePosts).values({
        creatorId: creator.id,
        source: "X",
        sourcePostId: post.id,
        sourceAuthorId: post.author_id,
        createdAtSource: postDate,
        capturedAt: new Date(),
        lastSeenAt: new Date(),
        contentStorageStatus: defaultStatus,
        contentText: retentionMode === "id_only" ? null : post.text,
        publicMetrics: post.public_metrics || null,
        editHistory: post.edit_history_tweet_ids || null,
      });
      postsInserted++;
    }
  }

  // Update creator last_post_at if we saw newer posts
  if (newestPostDate) {
    await db
      .update(creators)
      .set({
        lastPostAt: newestPostDate,
        updatedAt: new Date(),
      })
      .where(eq(creators.id, creator.id));
  }

  return {
    postsFetched: posts.length,
    postsInserted,
    postsUpdated,
    postsRejected,
    newCursor: newestPostId || undefined,
  };
}

/**
 * Executes a full poll cycle for a single creator:
 * 1. Confirms eligibility (not REJECTED or SUSPENDED).
 * 2. Fetches recent tweets using cursor (since_id).
 * 3. Ingests and verifies posts.
 * 4. Updates creator_monitoring cursor and poll logs.
 * 5. Schedules next poll timestamp.
 */
export async function pollCreatorTimeline(creatorId: string) {
  const [creator] = await db
    .select()
    .from(creators)
    .where(eq(creators.id, creatorId))
    .limit(1);

  if (!creator) {
    throw new Error(`Creator with ID ${creatorId} not found`);
  }

  if (creator.status === "REJECTED" || creator.status === "SUSPENDED") {
    throw new Error(`Creator ${creator.xUsername} is ${creator.status}; skipping poll.`);
  }

  // Phase 2A: creators may exist without an X identity (RSS/Bluesky/Website).
  // X polling only applies to creators that own an X source.
  if (!creator.xUserId) {
    throw new Error(
      `Creator ${creator.id} has no X identity; X polling skipped.`,
    );
  }

  const [monitoring] = await db
    .select()
    .from(creatorMonitoring)
    .where(eq(creatorMonitoring.creatorId, creatorId))
    .limit(1);

  const startedAt = new Date();
  const xClient = getXClient();

  try {
    const fetchResult = await xClient.getUserPosts(creator.xUserId, {
      maxResults: 20,
      sinceId: monitoring?.lastSeenPostId || undefined,
    });

    const ingestion = await ingestCreatorPosts(creator, fetchResult.posts);

    const completedAt = new Date();
    const intervalSec = monitoring?.pollIntervalSeconds || 900;
    const nextPollAt = new Date(Date.now() + intervalSec * 1000);

    // Update monitoring record safely — do not lose cursor on failure
    await db
      .update(creatorMonitoring)
      .set({
        lastPollStartedAt: startedAt,
        lastPollCompletedAt: completedAt,
        lastSuccessfulPollAt: completedAt,
        lastSeenPostId: fetchResult.newestId || monitoring?.lastSeenPostId || null,
        paginationToken: fetchResult.nextToken || null,
        consecutiveFailures: 0,
        lastErrorCode: null,
        lastErrorMessage: null,
        nextPollAt,
        isLocked: false,
        updatedAt: completedAt,
      })
      .where(eq(creatorMonitoring.creatorId, creatorId));

    // Update creator lastPolledAt
    await db
      .update(creators)
      .set({ lastPolledAt: completedAt, updatedAt: completedAt })
      .where(eq(creators.id, creatorId));

    // Record audit log
    await db.insert(creatorPollLogs).values({
      creatorId,
      startedAt,
      completedAt,
      status: ingestion.postsRejected > 0 ? "AUTHOR_MISMATCH" : "SUCCESS",
      postsFetched: ingestion.postsFetched,
      postsInserted: ingestion.postsInserted,
      postsUpdated: ingestion.postsUpdated,
      postsRejected: ingestion.postsRejected,
      httpStatus: 200,
      rateLimitRemaining: fetchResult.rateLimit?.remaining || null,
      rateLimitResetAt: fetchResult.rateLimit?.resetAt || null,
    });

    return {
      success: true,
      ingestion,
      nextPollAt,
    };
  } catch (err: unknown) {
    const completedAt = new Date();
    const isRateLimit = err instanceof XApiError && err.category === "RATE_LIMITED";
    const status = isRateLimit ? "RATE_LIMITED" : "FAILED";
    const httpStatus = err instanceof XApiError ? err.httpStatus : 500;
    const errorCode = err instanceof XApiError ? err.category : "INTERNAL_ERROR";
    const errorMessage = err instanceof Error ? err.message : String(err);

    // If rate-limited, respect rateLimitResetAt; otherwise exponential backoff
    const failures = (monitoring?.consecutiveFailures || 0) + 1;
    const backoffSec = Math.min(3600, (monitoring?.pollIntervalSeconds || 900) * Math.pow(1.5, failures));
    const nextPollAt =
      isRateLimit && err instanceof XApiError && err.rateLimitResetAt
        ? err.rateLimitResetAt
        : new Date(Date.now() + backoffSec * 1000);

    // Update monitoring record preserving lastSeenPostId
    await db
      .update(creatorMonitoring)
      .set({
        lastPollStartedAt: startedAt,
        lastPollCompletedAt: completedAt,
        consecutiveFailures: failures,
        lastErrorCode: errorCode,
        lastErrorMessage: errorMessage,
        nextPollAt,
        isLocked: false,
        updatedAt: completedAt,
      })
      .where(eq(creatorMonitoring.creatorId, creatorId));

    // Record audit log
    await db.insert(creatorPollLogs).values({
      creatorId,
      startedAt,
      completedAt,
      status,
      postsFetched: 0,
      postsInserted: 0,
      postsUpdated: 0,
      postsRejected: 0,
      httpStatus,
      rateLimitResetAt: isRateLimit && err instanceof XApiError ? err.rateLimitResetAt : null,
      errorCode,
      errorMessage,
    });

    throw err;
  }
}

