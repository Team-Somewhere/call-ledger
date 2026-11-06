/**
 * Arkiv archiver service.
 *
 * Responsible for:
 *  1. Creating the Arkiv public + wallet clients (once, lazily).
 *  2. Checking whether a post is already archived (deduplication).
 *  3. Writing new archived post entities to Arkiv Rabdi.
 *  4. Recording the Arkiv reference in the local arkiv_records table.
 *
 * SECURITY:
 *  - ARKIV_ARCHIVER_PRIVATE_KEY is read from env and NEVER logged.
 *  - ARKIV_ACCESS_KEY is read from env and NEVER logged.
 *  - All Arkiv RPC calls originate from the worker process.
 */

import {
  archivePost,
  checkPostExists,
  createArkivPublicClient,
  createArkivWalletClient,
} from "@call-ledger/arkiv";
import { arkivRecords, db } from "@call-ledger/database";
import { eq, and } from "drizzle-orm";
import { env } from "../config/env";
import { logger } from "./logger";
import { classifyPost } from "./signal-classifier";

// ─── Client singletons ────────────────────────────────────────────────────

type PublicClient = ReturnType<typeof createArkivPublicClient>;
type WalletClientPair = ReturnType<typeof createArkivWalletClient>;

let _publicClient: PublicClient | null = null;
let _walletPair: WalletClientPair | null = null;
let _initAttempted = false;

function getPublicClient(): PublicClient | null {
  if (!_publicClient && !_initAttempted) {
    _initAttempted = true;
    if (!env.ARKIV_ACCESS_KEY) {
      logger.warn("[ARKIV] ARKIV_ACCESS_KEY is not set — archive reads disabled.");
      return null;
    }
    try {
      _publicClient = createArkivPublicClient({
        accessKey: env.ARKIV_ACCESS_KEY,
        rpcUrl: env.ARKIV_RPC_URL,
      });
    } catch (err) {
      logger.error("[ARKIV] Failed to create public client", err);
    }
  }
  return _publicClient;
}

function getWalletPair(): WalletClientPair | null {
  if (_walletPair) return _walletPair;
  if (!env.ARKIV_ACCESS_KEY) {
    logger.warn("[ARKIV] ARKIV_ACCESS_KEY is not set — archive writes disabled.");
    return null;
  }
  if (!env.ARKIV_ARCHIVER_PRIVATE_KEY) {
    logger.warn("[ARKIV] ARKIV_ARCHIVER_PRIVATE_KEY is not set — archive writes disabled.");
    return null;
  }
  try {
    _walletPair = createArkivWalletClient({
      accessKey: env.ARKIV_ACCESS_KEY,
      rpcUrl: env.ARKIV_RPC_URL,
      privateKey: env.ARKIV_ARCHIVER_PRIVATE_KEY,
    });
    return _walletPair;
  } catch (err) {
    logger.error("[ARKIV] Failed to create wallet client (check ARKIV_ARCHIVER_PRIVATE_KEY format)", err);
    return null;
  }
}

/** True when the archiver can make reads. */
export function isArkivReadReady(): boolean {
  return Boolean(env.ARKIV_ACCESS_KEY);
}

/** True when the archiver can write new entities. */
export function isArkivWriteReady(): boolean {
  return Boolean(env.ARKIV_ACCESS_KEY && env.ARKIV_ARCHIVER_PRIVATE_KEY);
}

// ─── Daily request budget ────────────────────────────────────────────────

const budget = {
  date: "",
  usedRequests: 0,
};

function resetBudgetIfNewDay(): void {
  const today = new Date().toISOString().slice(0, 10);
  if (budget.date !== today) {
    budget.date = today;
    budget.usedRequests = 0;
  }
}

export function getRemainingBudget(): number {
  resetBudgetIfNewDay();
  return Math.max(0, env.X_MONITOR_MAX_REQUESTS_PER_DAY - budget.usedRequests);
}

export function consumeBudget(): boolean {
  resetBudgetIfNewDay();
  if (budget.usedRequests >= env.X_MONITOR_MAX_REQUESTS_PER_DAY) {
    return false; // budget exhausted
  }
  budget.usedRequests++;
  return true;
}

export function getBudgetStats(): {
  date: string;
  usedRequests: number;
  maxRequests: number;
  remaining: number;
  estimatedCredits: number;
} {
  resetBudgetIfNewDay();
  return {
    date: budget.date,
    usedRequests: budget.usedRequests,
    maxRequests: env.X_MONITOR_MAX_REQUESTS_PER_DAY,
    remaining: getRemainingBudget(),
    estimatedCredits:
      budget.usedRequests * env.X_MONITOR_ESTIMATED_CREDITS_PER_REQUEST,
  };
}

// ─── Archive a post ───────────────────────────────────────────────────────

export interface PostToArchive {
  /** creator_source_posts.id */
  creatorSourcePostId: string;
  /** creator.id */
  creatorId: string;
  /** stable X status ID */
  sourcePostId: string;
  /** normalized handle */
  authorHandle: string;
  /** display name */
  authorDisplayName: string;
  /** post text */
  content: string | null;
  /** canonical URL */
  canonicalUrl: string | null;
  /** original publish time */
  publishedAt: Date | null;
}

export interface ArchiveResult {
  skipped: boolean;
  reason?: string;
  entityKey?: string;
  txHash?: string;
  expiresAt?: Date;
}

/**
 * Archive a single post to Arkiv.
 *
 * Steps:
 *  1. Check arkiv_records (fast local dedup).
 *  2. Check Arkiv directly (slow dedup, catches cross-instance races).
 *  3. Classify trading-related content.
 *  4. Write entity to Arkiv.
 *  5. Record reference in arkiv_records.
 *
 * Returns `skipped=true` if the post was already archived or couldn't be written.
 */
export async function archivePostIfNew(
  post: PostToArchive,
): Promise<ArchiveResult> {
  // 1. Fast local dedup — check arkiv_records first
  const existing = await db
    .select({ id: arkivRecords.id, entityKey: arkivRecords.entityKey })
    .from(arkivRecords)
    .where(
      and(
        eq(arkivRecords.sourcePlatform, "x"),
        eq(arkivRecords.sourcePostId, post.sourcePostId),
      ),
    )
    .limit(1);

  if (existing[0]) {
    return { skipped: true, reason: "already-in-local-db", entityKey: existing[0].entityKey };
  }

  const publicClient = getPublicClient();
  const walletPair = getWalletPair();

  if (!walletPair) {
    return { skipped: true, reason: "arkiv-write-not-configured" };
  }

  // 2. Slow dedup — query Arkiv directly (catches concurrent workers)
  if (publicClient) {
    const existingKey = await checkPostExists(publicClient, post.sourcePostId);
    if (existingKey) {
      // Record this locally so we don't check Arkiv again next time
      await db.insert(arkivRecords).values({
        recordType: "ARCHIVED_X_POST",
        entityKey: existingKey,
        entityId: post.sourcePostId,
        sourcePlatform: "x",
        sourcePostId: post.sourcePostId,
        authorUsername: post.authorHandle.toLowerCase(),
        relatedCreatorId: post.creatorId,
        creatorSourcePostId: post.creatorSourcePostId,
        tradingRelated: false,
      }).onConflictDoNothing();
      return { skipped: true, reason: "already-in-arkiv", entityKey: existingKey };
    }
  }

  // 3. Classify content
  const classification = classifyPost(post.content);
  logger.info(
    `[FILTER] Post ${post.sourcePostId} classified: tradingRelated=${classification.tradingRelated} (score=${classification.confidence})`,
  );

  // 4. Archive to Arkiv
  logger.info(`[ARKIV] Archiving post ${post.sourcePostId} by @${post.authorHandle}`);

  let archiveResult: { entityKey: string; txHash: string; expiresAt: Date };
  try {
    archiveResult = await archivePost(walletPair.client, {
      sourcePostId: post.sourcePostId,
      authorUsername: post.authorHandle,
      authorDisplayName: post.authorDisplayName,
      postText: post.content ?? "",
      postUrl: post.canonicalUrl ?? `https://x.com/${post.authorHandle}/status/${post.sourcePostId}`,
      originalCreatedAt: post.publishedAt,
      capturedAt: new Date(),
      contentFidelity: "UNKNOWN",
      tradingRelated: classification.tradingRelated,
      topics: classification.topics,
      assets: classification.assets,
      expiryDays: env.ARKIV_POST_EXPIRY_DAYS,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown Arkiv write error";
    logger.error(`[ARKIV] Failed to archive post ${post.sourcePostId}: ${msg}`);
    // Do NOT mark as archived — caller will see skipped=false and can retry
    return { skipped: false, reason: `arkiv-write-failed: ${msg}` };
  }

  logger.info(
    `[ARKIV] Entity creation successful — key=${archiveResult.entityKey} tx=${archiveResult.txHash}`,
  );

  // 5. Record reference in local DB
  await db.insert(arkivRecords).values({
    recordType: "ARCHIVED_X_POST",
    entityKey: archiveResult.entityKey,
    entityId: post.sourcePostId,
    txHash: archiveResult.txHash,
    sourcePlatform: "x",
    sourcePostId: post.sourcePostId,
    authorUsername: post.authorHandle.toLowerCase(),
    contentFidelity: "UNKNOWN",
    tradingRelated: classification.tradingRelated,
    expiresAt: archiveResult.expiresAt,
    relatedCreatorId: post.creatorId,
    creatorSourcePostId: post.creatorSourcePostId,
  }).onConflictDoNothing();

  return {
    skipped: false,
    entityKey: archiveResult.entityKey,
    txHash: archiveResult.txHash,
    expiresAt: archiveResult.expiresAt,
  };
}
