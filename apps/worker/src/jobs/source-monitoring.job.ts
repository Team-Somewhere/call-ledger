import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import {
  creatorMonitoringLogs,
  creatorSources,
  creatorSourcePosts,
  creators,
  db,
} from "@call-ledger/database";
import {
  CREATOR_SOURCE_TYPES,
  SourceAdapterError,
  type CreatorSource,
  type CreatorSourceType,
  type FetchPostsResult,
} from "@call-ledger/shared";
import {
  createAdapterRegistry,
  getAdapter,
} from "@call-ledger/api/source-adapters";
import { env } from "../config/env";
import { logger } from "../services/logger";

const workerId = `worker-${randomUUID()}`;
const adapterRegistry = createAdapterRegistry({
  xIngestionEnabled: env.X_INGESTION_ENABLED,
  requestTimeoutMs: env.MONITORING_REQUEST_TIMEOUT_MS,
  maxResponseBytes: env.MONITORING_MAX_RESPONSE_BYTES,
  firecrawl: {
    enabled: env.FIRECRAWL_ENABLED,
    apiKey: env.FIRECRAWL_API_KEY ?? null,
    maxPagesPerRun: env.FIRECRAWL_MAX_PAGES_PER_RUN,
    timeoutMs: env.MONITORING_REQUEST_TIMEOUT_MS,
    maxResponseBytes: env.MONITORING_MAX_RESPONSE_BYTES,
    baseUrl: env.FIRECRAWL_BASE_URL,
  },
});

type ClaimedSource = typeof creatorSources.$inferSelect;

export class SourceMonitoringWorker {
  private stopping = false;
  private running = false;

  stop(): void {
    this.stopping = true;
  }

  async runOnce(): Promise<number> {
    if (this.running || this.stopping) return 0;
    this.running = true;
    try {
      let processed = 0;
      while (processed < env.MONITORING_WORKER_BATCH_SIZE && !this.stopping) {
        const [source] = await this.claimDueSources(1);
        if (!source) break;
        await this.processSource(source);
        processed += 1;
      }
      return processed;
    } finally {
      this.running = false;
    }
  }

  private async claimDueSources(limit: number): Promise<ClaimedSource[]> {
    const now = new Date();
    const leaseExpiresAt = new Date(
      now.getTime() + env.MONITORING_LOCK_LEASE_SECONDS * 1000,
    );

    return db.transaction(async (tx) => {
      const due = await tx
        .select({
          id: creatorSources.id,
          sourceType: creatorSources.sourceType,
          lockExpiresAt: creatorSources.lockExpiresAt,
          lockedBy: creatorSources.lockedBy,
        })
        .from(creatorSources)
        .where(
          and(
            eq(creatorSources.status, "ACTIVE"),
            inArray(creatorSources.sourceType, [
              "RSS",
              "BLUESKY",
              "WEBSITE",
              "X",
            ]),
            isNull(creatorSources.permanentErrorCode),
            or(
              isNull(creatorSources.nextFetchAt),
              lte(creatorSources.nextFetchAt, now),
            ),
            or(
              isNull(creatorSources.lockExpiresAt),
              lte(creatorSources.lockExpiresAt, now),
            ),
          ),
        )
        .orderBy(asc(creatorSources.nextFetchAt), asc(creatorSources.createdAt))
        .limit(limit)
        .for("update", { skipLocked: true });

      const claimed: ClaimedSource[] = [];
      for (const row of due) {
        const [source] = await tx
          .update(creatorSources)
          .set({
            lockExpiresAt: leaseExpiresAt,
            lockedBy: workerId,
            updatedAt: now,
          })
          .where(eq(creatorSources.id, row.id))
          .returning();
        if (source) {
          claimed.push(source);
          if (row.lockExpiresAt && row.lockedBy) {
            await tx.insert(creatorMonitoringLogs).values({
              creatorSourceId: source.id,
              sourceType: row.sourceType,
              status: "SKIPPED",
              itemsFound: 0,
              itemsInserted: 0,
              startedAt: now,
              completedAt: now,
              errorCode: "EXPIRED_LOCK_RECOVERED",
              errorMessage:
                "An expired monitoring lease was recovered by the worker.",
              trigger: "recovered",
            });
          }
        }
      }
      return claimed;
    });
  }

  private async processSource(source: ClaimedSource): Promise<void> {
    const startedAt = new Date();
    const leaseRenewal = setInterval(
      () => {
        void (async () => {
          try {
            await db
              .update(creatorSources)
              .set({
                lockExpiresAt: new Date(
                  Date.now() + env.MONITORING_LOCK_LEASE_SECONDS * 1000,
                ),
              })
              .where(
                and(
                  eq(creatorSources.id, source.id),
                  eq(creatorSources.lockedBy, workerId),
                ),
              );
          } catch (error) {
            logger.warn(
              `Could not renew source monitoring lease (${source.id}).`,
              {
                error:
                  error instanceof Error ? error.message : "Database error",
              },
            );
          }
        })();
      },
      Math.max(
        1000,
        Math.floor((env.MONITORING_LOCK_LEASE_SECONDS * 1000) / 3),
      ),
    );

    try {
      const type = sourceType(source.sourceType);
      const providerMeta = parseProviderMeta(source.providerMeta);
      const adapter = getAdapter(adapterRegistry, type);
      const adapterSource: CreatorSource = {
        id: source.id,
        creatorId: source.creatorId,
        sourceType: type,
        externalId: source.externalId,
        handle: source.handle,
        canonicalUrl: source.canonicalUrl,
        status: "ACTIVE",
        verificationStatus: "UNVERIFIED",
        displayName: source.displayName,
        description: source.description,
        avatarUrl: source.avatarUrl,
        lastFetchedAt: source.lastFetchedAt,
        nextFetchAt: source.nextFetchAt,
        lastCursor: source.lastCursor,
        lastError: source.lastError,
        lastErrorAt: source.lastErrorAt,
        retryCount: source.retryCount,
        etag: source.etag,
        lastModified: source.lastModified,
        crawlAuthorized: source.crawlAuthorized,
        providerMeta,
        createdAt: source.createdAt,
        updatedAt: source.updatedAt,
      };

      const result = await adapter.fetchLatestPosts({
        source: adapterSource,
        // Bluesky cursors page toward older history; each cycle intentionally
        // reads the latest bounded page and relies on stable IDs for dedupe.
        cursor: null,
        limit:
          source.lastFetchedAt === null
            ? env.MONITORING_INITIAL_POST_LIMIT
            : env.MONITORING_DEFAULT_POST_LIMIT,
        conditional: {
          etag: source.etag,
          lastModified: source.lastModified,
        },
      });

      if (!result.available) {
        await this.recordSkipped(
          source,
          startedAt,
          result.unavailableReason ?? "ADAPTER_UNAVAILABLE",
        );
        return;
      }

      await this.recordSuccess(source, startedAt, result);
    } catch (error) {
      if (
        error instanceof SourceAdapterError &&
        error.code === "FIRECRAWL_DISABLED"
      ) {
        await this.recordSkipped(source, startedAt, error.code);
        return;
      }
      await this.recordFailure(source, startedAt, error);
    } finally {
      clearInterval(leaseRenewal);
    }
  }

  private async recordSuccess(
    source: ClaimedSource,
    startedAt: Date,
    result: FetchPostsResult,
  ): Promise<void> {
    const completedAt = new Date();
    const type = sourceType(source.sourceType);
    const intervalSeconds = pollIntervalSeconds(type);
    const nextFetchAt = new Date(
      completedAt.getTime() + (intervalSeconds + jitterSeconds()) * 1000,
    );

    await db.transaction(async (tx) => {
      let itemsInserted = 0;
      for (const post of result.posts) {
        const content = post.text?.trim() || null;
        const title = post.title?.trim() || null;
        const values = {
          creatorSourceId: source.id,
          externalPostId: post.sourcePostId,
          sourceType: type,
          authorExternalId: post.sourceAuthorId,
          authorHandle: post.authorHandle ?? source.handle,
          title,
          content,
          canonicalUrl: post.url ?? source.canonicalUrl,
          publishedAt: post.publishedAt,
          fetchedAt: completedAt,
          contentHash: post.contentHash,
          mediaUrls: post.mediaUrls ?? [],
          isReply: post.isReply ?? false,
          isRepost: post.isRepost ?? false,
          status: post.status ?? "ACTIVE",
        } as const;

        const [inserted] = await tx
          .insert(creatorSourcePosts)
          .values(values)
          .onConflictDoNothing({
            target: [
              creatorSourcePosts.creatorSourceId,
              creatorSourcePosts.externalPostId,
            ],
          })
          .returning({ id: creatorSourcePosts.id });

        if (inserted) {
          itemsInserted += 1;
          continue;
        }

        await tx
          .update(creatorSourcePosts)
          .set({
            ...values,
            updatedAt: completedAt,
          })
          .where(
            and(
              eq(creatorSourcePosts.creatorSourceId, source.id),
              eq(creatorSourcePosts.externalPostId, post.sourcePostId),
              sql`${creatorSourcePosts.contentHash} <> ${post.contentHash} OR ${creatorSourcePosts.status} <> 'ACTIVE'`,
            ),
          );
      }

      await tx
        .update(creatorSources)
        .set({
          lastFetchedAt: completedAt,
          nextFetchAt,
          lastCursor:
            result.nextCursor ??
            result.posts[0]?.sourcePostId ??
            source.lastCursor,
          etag: result.etag ?? source.etag,
          lastModified: result.lastModified ?? source.lastModified,
          lastError: null,
          lastErrorAt: null,
          retryCount: 0,
          consecutiveFailures: 0,
          permanentErrorCode: null,
          lockExpiresAt: null,
          lockedBy: null,
          updatedAt: completedAt,
        })
        .where(
          and(
            eq(creatorSources.id, source.id),
            eq(creatorSources.lockedBy, workerId),
          ),
        );

      await tx.insert(creatorMonitoringLogs).values({
        creatorSourceId: source.id,
        sourceType: type,
        status: "SUCCESS",
        itemsFound: result.posts.length,
        itemsInserted,
        startedAt,
        completedAt,
      });
    });
  }

  private async recordSkipped(
    source: ClaimedSource,
    startedAt: Date,
    reason: string,
  ): Promise<void> {
    const completedAt = new Date();
    const type = sourceType(source.sourceType);
    const firecrawlDisabled = reason === "FIRECRAWL_DISABLED";
    await db.transaction(async (tx) => {
      await tx
        .update(creatorSources)
        .set({
          nextFetchAt: new Date(
            completedAt.getTime() +
              (pollIntervalSeconds(type) + jitterSeconds()) * 1000,
          ),
          ...(firecrawlDisabled
            ? {}
            : { status: "WAITING_FOR_AUTHORIZED_ACCESS" }),
          lastError: reason,
          lastErrorAt: completedAt,
          lockExpiresAt: null,
          lockedBy: null,
          updatedAt: completedAt,
        })
        .where(
          and(
            eq(creatorSources.id, source.id),
            eq(creatorSources.lockedBy, workerId),
          ),
        );
      await tx.insert(creatorMonitoringLogs).values({
        creatorSourceId: source.id,
        sourceType: type,
        status: "SKIPPED",
        itemsFound: 0,
        itemsInserted: 0,
        startedAt,
        completedAt,
        errorCode: reason,
        errorMessage:
          "This source was skipped because monitoring is unavailable.",
      });
    });
  }

  private async recordFailure(
    source: ClaimedSource,
    startedAt: Date,
    error: unknown,
  ): Promise<void> {
    const completedAt = new Date();
    const type = sourceType(source.sourceType);
    const adapterError = error instanceof SourceAdapterError ? error : null;
    const errorCode = adapterError?.code ?? "MONITORING_ERROR";
    const failureCount = source.consecutiveFailures + 1;
    const retryable = adapterError?.retryable ?? true;
    const permanent = !retryable;
    const retryAfter = adapterError?.retryAfterMs ?? 0;
    const retriesExhausted = failureCount >= env.MONITORING_MAX_RETRIES;
    const delayMs = computeRetryDelayMs({
      failureCount,
      intervalSeconds: pollIntervalSeconds(type),
      maxRetries: env.MONITORING_MAX_RETRIES,
      retryAfterMs: retryAfter,
      jitterSeconds: jitterSeconds(),
    });
    const safeMessage = adapterError
      ? adapterError.message.slice(0, 500)
      : "Unexpected monitoring error. See worker logs for diagnostics.";

    await db.transaction(async (tx) => {
      await tx
        .update(creatorSources)
        .set({
          status: permanent ? "ERROR" : "ACTIVE",
          nextFetchAt: new Date(completedAt.getTime() + delayMs),
          lastError: safeMessage,
          lastErrorAt: completedAt,
          retryCount: retriesExhausted ? 0 : failureCount,
          consecutiveFailures: failureCount,
          permanentErrorCode: permanent ? errorCode : null,
          lockExpiresAt: null,
          lockedBy: null,
          updatedAt: completedAt,
        })
        .where(
          and(
            eq(creatorSources.id, source.id),
            eq(creatorSources.lockedBy, workerId),
          ),
        );
      await tx.insert(creatorMonitoringLogs).values({
        creatorSourceId: source.id,
        sourceType: type,
        status: "FAILED",
        itemsFound: 0,
        itemsInserted: 0,
        startedAt,
        completedAt,
        errorCode,
        errorMessage: safeMessage,
      });
    });

    logger.warn(`Source monitoring failed (${source.id}, ${errorCode}).`);
  }
}

function sourceType(value: string): CreatorSourceType {
  if ((CREATOR_SOURCE_TYPES as readonly string[]).includes(value)) {
    return value as CreatorSourceType;
  }
  throw new SourceAdapterError(
    "UNSUPPORTED_SOURCE_TYPE",
    "This source type is not supported by the monitoring worker",
    400,
  );
}

function parseProviderMeta(
  value: string | null,
): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    throw new SourceAdapterError(
      "INVALID_SOURCE_METADATA",
      "Source monitoring metadata is malformed",
      400,
    );
  }
}

function pollIntervalSeconds(type: CreatorSourceType): number {
  switch (type) {
    case "RSS":
      return env.MONITORING_POLL_INTERVAL_RSS_SECONDS;
    case "BLUESKY":
      return env.MONITORING_POLL_INTERVAL_BLUESKY_SECONDS;
    case "WEBSITE":
      return env.MONITORING_POLL_INTERVAL_WEBSITE_SECONDS;
    case "X":
      return env.MONITORING_POLL_INTERVAL_RSS_SECONDS;
  }
}

function jitterSeconds(): number {
  return Math.floor(Math.random() * (env.MONITORING_POLL_JITTER_SECONDS + 1));
}

export function computeRetryDelayMs(options: {
  failureCount: number;
  intervalSeconds: number;
  maxRetries: number;
  retryAfterMs: number;
  jitterSeconds: number;
}): number {
  const backoffMs = Math.min(
    6 * 60 * 60 * 1000,
    options.intervalSeconds *
      1000 *
      2 ** Math.min(Math.max(0, options.failureCount - 1), 8),
  );
  const jitterMs = options.jitterSeconds * 1000;
  if (options.failureCount >= options.maxRetries) {
    return Math.max(
      options.retryAfterMs,
      options.intervalSeconds * 8 * 1000 + jitterMs,
    );
  }
  return Math.max(options.retryAfterMs, backoffMs + jitterMs);
}
