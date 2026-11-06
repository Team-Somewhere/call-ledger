import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import {
  creatorMonitoring,
  creatorPollLogs,
  creators,
  db,
  oauthStates,
  sourcePosts,
} from "@call-ledger/database";
import { logger } from "../services/logger";

export interface XPostItem {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  edit_history_tweet_ids?: string[];
  public_metrics?: Record<string, unknown>;
}

export class WorkerPollingService {
  /**
   * Safe atomic PostgreSQL work claim:
   * Finds due creators who:
   * 1. Have monitoringEnabled = true
   * 2. Status in ('MONITORING', 'QUALIFIED') - not REJECTED or SUSPENDED
   * 3. MonitoringStatus = 'ACTIVE'
   * 4. nextPollAt <= NOW() or nextPollAt IS NULL
   * 5. isLocked = false OR (isLocked = true AND lockAcquiredAt < NOW() - 5 minutes [stale lock recovery])
   */
  async claimDueCreators(limit = 3) {
    const now = new Date();
    const staleLockThreshold = new Date(Date.now() - 5 * 60 * 1000);

    const dueList = await db
      .select({
        monitoringId: creatorMonitoring.id,
        creatorId: creators.id,
        xUserId: creators.xUserId,
        xUsername: creators.xUsername,
        displayName: creators.displayName,
        status: creators.status,
        lastSeenPostId: creatorMonitoring.lastSeenPostId,
        pollIntervalSeconds: creatorMonitoring.pollIntervalSeconds,
        consecutiveFailures: creatorMonitoring.consecutiveFailures,
      })
      .from(creatorMonitoring)
      .innerJoin(creators, eq(creatorMonitoring.creatorId, creators.id))
      .where(
        and(
          eq(creators.monitoringEnabled, true),
          // Phase 2A: creators without an X identity (RSS/Bluesky/Website) are
          // never claimed by the X polling loop.
          sql`${creators.xUserId} is not null`,
          or(
            eq(creators.status, "MONITORING"),
            eq(creators.status, "QUALIFIED"),
          ),
          eq(creatorMonitoring.monitoringStatus, "ACTIVE"),
          or(
            isNull(creatorMonitoring.nextPollAt),
            lt(creatorMonitoring.nextPollAt, now),
          ),
          or(
            eq(creatorMonitoring.isLocked, false),
            lt(creatorMonitoring.lockAcquiredAt, staleLockThreshold),
          ),
        ),
      )
      .limit(limit);

    const claimed = [];

    for (const item of dueList) {
      // Atomic lock acquisition
      const [updated] = await db
        .update(creatorMonitoring)
        .set({
          isLocked: true,
          lockAcquiredAt: now,
          lastPollStartedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(creatorMonitoring.id, item.monitoringId),
            or(
              eq(creatorMonitoring.isLocked, false),
              lt(creatorMonitoring.lockAcquiredAt, staleLockThreshold),
            ),
          ),
        )
        .returning();

      if (updated) {
        claimed.push(item);
      }
    }

    return claimed;
  }

  /**
   * Fetches posts for a creator using Bearer Token or mock data in testing.
   */
  async fetchPostsFromX(
    xUserId: string,
    xUsername: string,
    sinceId?: string | null,
  ): Promise<{
    posts: XPostItem[];
    newestId?: string;
    rateLimitRemaining?: number;
    rateLimitResetAt?: Date;
  }> {
    if (process.env.X_INGESTION_ENABLED !== "true") {
      throw new Error("X ingestion is disabled.");
    }

    const bearerToken = process.env.X_BEARER_TOKEN;

    if (bearerToken) {
      const params = new URLSearchParams({
        max_results: "10",
        "tweet.fields":
          "id,text,author_id,created_at,edit_history_tweet_ids,public_metrics",
      });
      if (sinceId) {
        params.set("since_id", sinceId);
      }

      const res = await fetch(
        `https://api.x.com/2/users/${xUserId}/tweets?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${bearerToken}` },
        },
      );

      const remaining = res.headers.get("x-rate-limit-remaining");
      const reset = res.headers.get("x-rate-limit-reset");

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`X API error ${res.status}: ${text}`);
      }

      const json = await res.json();
      return {
        posts: json.data || [],
        newestId: json.meta?.newest_id,
        rateLimitRemaining: remaining ? parseInt(remaining, 10) : undefined,
        rateLimitResetAt: reset
          ? new Date(parseInt(reset, 10) * 1000)
          : undefined,
      };
    }

    throw new Error("An authorized X API bearer token is not configured.");
  }

  /**
   * Ingests retrieved posts into source_posts table with:
   * - Author verification (author_id === creator.xUserId)
   * - Deduplication on (source, source_post_id)
   * - Retention policy application (store vs id_only)
   */
  async processCreator(creatorItem: {
    creatorId: string;
    xUserId: string;
    xUsername: string;
    lastSeenPostId: string | null;
    pollIntervalSeconds: number;
    consecutiveFailures: number;
  }) {
    const startedAt = new Date();
    logger.info(
      `Polling posts for creator @${creatorItem.xUsername} (ID: ${creatorItem.xUserId})...`,
    );

    try {
      const fetchResult = await this.fetchPostsFromX(
        creatorItem.xUserId,
        creatorItem.xUsername,
        creatorItem.lastSeenPostId,
      );

      let insertedCount = 0;
      let updatedCount = 0;
      let rejectedCount = 0;
      let newestDate: Date | null = null;
      let newestId: string | null = null;

      for (const post of fetchResult.posts) {
        // STRICT AUTHOR VERIFICATION
        if (post.author_id !== creatorItem.xUserId) {
          logger.warn(
            `Author ID mismatch! Expected ${creatorItem.xUserId}, received ${post.author_id}. Rejecting.`,
          );
          rejectedCount++;
          continue;
        }

        const createdAtSource = new Date(post.created_at);
        if (!newestDate || createdAtSource > newestDate) {
          newestDate = createdAtSource;
          newestId = post.id;
        }

        // Deduplication lookup
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
          await db
            .update(sourcePosts)
            .set({
              lastSeenAt: new Date(),
              publicMetrics: post.public_metrics || existing.publicMetrics,
              updatedAt: new Date(),
            })
            .where(eq(sourcePosts.id, existing.id));
          updatedCount++;
        } else {
          const retentionMode = process.env.X_CONTENT_RETENTION_MODE || "store";
          await db.insert(sourcePosts).values({
            creatorId: creatorItem.creatorId,
            source: "X",
            sourcePostId: post.id,
            sourceAuthorId: post.author_id,
            createdAtSource,
            capturedAt: new Date(),
            lastSeenAt: new Date(),
            contentStorageStatus:
              retentionMode === "id_only" ? "ID_ONLY" : "STORED",
            contentText: retentionMode === "id_only" ? null : post.text,
            publicMetrics: post.public_metrics || null,
            editHistory: post.edit_history_tweet_ids || null,
          });
          insertedCount++;
        }
      }

      const completedAt = new Date();
      const nextPollAt = new Date(
        Date.now() + creatorItem.pollIntervalSeconds * 1000,
      );

      // Safe cursor update
      await db
        .update(creatorMonitoring)
        .set({
          lastPollCompletedAt: completedAt,
          lastSuccessfulPollAt: completedAt,
          lastSeenPostId:
            newestId || fetchResult.newestId || creatorItem.lastSeenPostId,
          consecutiveFailures: 0,
          lastErrorCode: null,
          lastErrorMessage: null,
          nextPollAt,
          isLocked: false,
          lockAcquiredAt: null,
          updatedAt: completedAt,
        })
        .where(eq(creatorMonitoring.creatorId, creatorItem.creatorId));

      await db
        .update(creators)
        .set({
          lastPolledAt: completedAt,
          ...(newestDate ? { lastPostAt: newestDate } : {}),
          updatedAt: completedAt,
        })
        .where(eq(creators.id, creatorItem.creatorId));

      // Record audit log
      await db.insert(creatorPollLogs).values({
        creatorId: creatorItem.creatorId,
        startedAt,
        completedAt,
        status: rejectedCount > 0 ? "AUTHOR_MISMATCH" : "SUCCESS",
        postsFetched: fetchResult.posts.length,
        postsInserted: insertedCount,
        postsUpdated: updatedCount,
        postsRejected: rejectedCount,
        httpStatus: 200,
        rateLimitRemaining: fetchResult.rateLimitRemaining || null,
        rateLimitResetAt: fetchResult.rateLimitResetAt || null,
      });

      logger.info(
        `Successfully polled @${creatorItem.xUsername}: ${insertedCount} inserted, ${updatedCount} updated, ${rejectedCount} rejected. Next poll at: ${nextPollAt.toISOString()}`,
      );
    } catch (err: unknown) {
      const completedAt = new Date();
      const message = err instanceof Error ? err.message : String(err);
      const is429 = message.includes("429");
      const failures = creatorItem.consecutiveFailures + 1;
      const backoffSec = Math.min(
        3600,
        creatorItem.pollIntervalSeconds * Math.pow(1.5, failures),
      );
      const nextPollAt = new Date(Date.now() + backoffSec * 1000);

      logger.error(`Failed to poll @${creatorItem.xUsername}: ${message}`);

      // Safe error update (preserves previous successful cursor)
      await db
        .update(creatorMonitoring)
        .set({
          lastPollCompletedAt: completedAt,
          consecutiveFailures: failures,
          lastErrorCode: is429 ? "RATE_LIMITED" : "API_ERROR",
          lastErrorMessage: message,
          nextPollAt,
          isLocked: false,
          lockAcquiredAt: null,
          updatedAt: completedAt,
        })
        .where(eq(creatorMonitoring.creatorId, creatorItem.creatorId));

      await db.insert(creatorPollLogs).values({
        creatorId: creatorItem.creatorId,
        startedAt,
        completedAt,
        status: is429 ? "RATE_LIMITED" : "FAILED",
        postsFetched: 0,
        postsInserted: 0,
        postsUpdated: 0,
        postsRejected: 0,
        httpStatus: is429 ? 429 : 500,
        errorCode: is429 ? "RATE_LIMITED" : "POLL_ERROR",
        errorMessage: message,
      });
    }
  }

  /**
   * Cleans up expired OAuth states.
   */
  async cleanupExpiredOAuth() {
    try {
      const now = new Date();
      const deleted = await db
        .delete(oauthStates)
        .where(lt(oauthStates.expiresAt, now))
        .returning();
      if (deleted.length > 0) {
        logger.info(
          `OAuth state cleanup: purged ${deleted.length} expired records.`,
        );
      }
    } catch (err) {
      logger.error("Error during OAuth state cleanup", err);
    }
  }
}
