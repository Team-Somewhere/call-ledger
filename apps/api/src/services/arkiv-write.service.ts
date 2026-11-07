/**
 * Arkiv write path used by manual "Fetch Latest Posts".
 *
 * Always archives — no local or on-chain deduplication.
 * Private key stays server-side only.
 */

import {
  archivePost,
  createArkivPublicClient,
  createArkivWalletClient,
} from "@call-ledger/arkiv";
import {
  arkivRecords,
  arkivTransactions,
  creators,
  db,
} from "@call-ledger/database";
import { eq } from "drizzle-orm";
import { env } from "../config/env";
import { classifyPost } from "./signal-classifier";

type WalletClientPair = ReturnType<typeof createArkivWalletClient>;

let _walletPair: WalletClientPair | null = null;

function getWalletPair(): WalletClientPair | null {
  if (_walletPair) return _walletPair;
  const accessKey = env.ARKIV_ACCESS_KEY;
  const privateKey = process.env.ARKIV_ARCHIVER_PRIVATE_KEY;
  if (!accessKey || !privateKey) return null;
  try {
    _walletPair = createArkivWalletClient({
      accessKey,
      rpcUrl: env.ARKIV_RPC_URL,
      privateKey,
    });
    return _walletPair;
  } catch {
    return null;
  }
}

export function isApiArkivWriteReady(): boolean {
  return Boolean(env.ARKIV_ACCESS_KEY && process.env.ARKIV_ARCHIVER_PRIVATE_KEY);
}

export interface PostToArchive {
  creatorSourcePostId: string;
  creatorId: string;
  sourcePostId: string;
  authorHandle: string;
  authorDisplayName: string;
  content: string | null;
  canonicalUrl: string | null;
  publishedAt: Date | null;
}

export interface ArchiveWriteResult {
  skipped: boolean;
  reason?: string;
  entityKey?: string;
  txHash?: string;
}

/**
 * Archive a post to Arkiv without deduplication checks.
 * Always creates a new on-chain entity when write credentials are configured.
 */
export async function archivePostAlways(
  post: PostToArchive,
): Promise<ArchiveWriteResult> {
  const walletPair = getWalletPair();
  if (!walletPair) {
    return { skipped: true, reason: "arkiv-write-not-configured" };
  }

  // Ensure public client can be constructed (validates access key format).
  if (env.ARKIV_ACCESS_KEY) {
    try {
      createArkivPublicClient({
        accessKey: env.ARKIV_ACCESS_KEY,
        rpcUrl: env.ARKIV_RPC_URL,
      });
    } catch {
      return { skipped: true, reason: "arkiv-client-init-failed" };
    }
  }

  const classification = classifyPost(post.content);
  const submittedAt = new Date();
  const expiryDays = Number(process.env.ARKIV_POST_EXPIRY_DAYS ?? 365);

  let archiveResult: { entityKey: string; txHash: string; expiresAt: Date };
  try {
    archiveResult = await archivePost(walletPair.client, {
      sourcePostId: post.sourcePostId,
      authorUsername: post.authorHandle,
      authorDisplayName: post.authorDisplayName,
      postText: post.content ?? "",
      postUrl:
        post.canonicalUrl ??
        `https://x.com/${post.authorHandle}/status/${post.sourcePostId}`,
      originalCreatedAt: post.publishedAt,
      capturedAt: new Date(),
      contentFidelity: "UNKNOWN",
      tradingRelated: classification.tradingRelated,
      topics: classification.topics,
      assets: classification.assets,
      expiryDays: Number.isFinite(expiryDays) ? expiryDays : 365,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown Arkiv write error";
    return { skipped: false, reason: `arkiv-write-failed: ${msg}` };
  }

  const confirmedAt = new Date();

  let traderUsername: string | null = post.authorHandle ?? null;
  try {
    const [creatorRow] = await db
      .select({ xUsername: creators.xUsername })
      .from(creators)
      .where(eq(creators.id, post.creatorId))
      .limit(1);
    if (creatorRow?.xUsername) traderUsername = creatorRow.xUsername;
  } catch {
    // non-fatal
  }

  // Upsert local reference (unique on platform+postId) to the latest entity.
  const existing = await db
    .select({ id: arkivRecords.id })
    .from(arkivRecords)
    .where(eq(arkivRecords.sourcePostId, post.sourcePostId))
    .limit(1);

  if (existing[0]) {
    await db
      .update(arkivRecords)
      .set({
        entityKey: archiveResult.entityKey,
        entityId: post.sourcePostId,
        txHash: archiveResult.txHash,
        authorUsername: post.authorHandle.toLowerCase(),
        contentFidelity: "UNKNOWN",
        tradingRelated: classification.tradingRelated,
        expiresAt: archiveResult.expiresAt,
        relatedCreatorId: post.creatorId,
        creatorSourcePostId: post.creatorSourcePostId,
        updatedAt: confirmedAt,
      })
      .where(eq(arkivRecords.id, existing[0].id));
  } else {
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
    });
  }

  try {
    await db.insert(arkivTransactions).values({
      entityKey: archiveResult.entityKey,
      txHash: archiveResult.txHash,
      sourcePostId: post.sourcePostId,
      traderId: post.creatorId,
      traderUsername: traderUsername ?? post.authorHandle,
      status: "CONFIRMED",
      submittedAt,
      confirmedAt,
      expiresAt: archiveResult.expiresAt,
    });
  } catch (err) {
    // On-chain write already succeeded — log so topbar history can be repaired.
    console.error(
      `[ARKIV] Failed to persist tx receipt ${archiveResult.txHash} for post ${post.sourcePostId}:`,
      err,
    );
  }

  return {
    skipped: false,
    entityKey: archiveResult.entityKey,
    txHash: archiveResult.txHash,
  };
}
