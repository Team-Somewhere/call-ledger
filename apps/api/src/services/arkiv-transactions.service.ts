/**
 * Arkiv transaction history service.
 *
 * Surfacing every confirmed write this platform made to Arkiv Rabdi so the
 * topbar can show live tx hashes / entity keys for judges.
 *
 * Sources (merged, newest first):
 *  1. arkiv_transactions — local receipt log written after each createEntity
 *  2. arkiv_records with tx_hash — backfilled into (1) on read
 *  3. Live Arkiv query — on-chain entities from this deployment (entity keys)
 */

import { and, desc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import {
  createArkivPublicClient,
  queryPosts,
} from "@call-ledger/arkiv";
import {
  arkivRecords,
  arkivTransactions,
  creators,
  db,
} from "@call-ledger/database";
import { env } from "../config/env";

export interface ArkivTransactionRow {
  id: string;
  entityKey: string;
  /** On-chain write hash when known; null for on-chain-only entity proofs. */
  txHash: string | null;
  sourcePostId: string;
  traderId: string | null;
  traderUsername: string | null;
  traderDisplayName: string | null;
  status: string;
  submittedAt: Date;
  confirmedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  /** Rabdi explorer URL when a real tx hash exists. */
  explorerUrl: string | null;
  /** Where this row came from. */
  proofSource: "local_tx" | "local_record" | "arkiv_chain";
}

const EXPLORER_BASE = "https://rabdi.explorer.arkiv.network/tx";

function explorerUrlFor(txHash: string | null | undefined): string | null {
  if (!txHash || !txHash.trim()) return null;
  // Entity keys are not transaction hashes — don't invent explorer links.
  if (txHash.startsWith("0x") && txHash.length >= 66) {
    return `${EXPLORER_BASE}/${txHash}`;
  }
  return null;
}

function toRow(
  tx: typeof arkivTransactions.$inferSelect & {
    traderDisplayName?: string | null;
  },
  proofSource: ArkivTransactionRow["proofSource"] = "local_tx",
): ArkivTransactionRow {
  return {
    id: tx.id,
    entityKey: tx.entityKey,
    txHash: tx.txHash,
    sourcePostId: tx.sourcePostId,
    traderId: tx.traderId ?? null,
    traderUsername: tx.traderUsername ?? null,
    traderDisplayName: tx.traderDisplayName ?? null,
    status: tx.status,
    submittedAt: tx.submittedAt,
    confirmedAt: tx.confirmedAt ?? null,
    expiresAt: tx.expiresAt ?? null,
    createdAt: tx.createdAt,
    explorerUrl: explorerUrlFor(tx.txHash),
    proofSource,
  };
}

/**
 * Copy any arkiv_records rows that have a tx_hash into arkiv_transactions
 * so the topbar history stays complete even after older writes.
 */
async function backfillFromRecords(): Promise<number> {
  const records = await db
    .select({
      entityKey: arkivRecords.entityKey,
      txHash: arkivRecords.txHash,
      sourcePostId: arkivRecords.sourcePostId,
      traderId: arkivRecords.relatedCreatorId,
      traderUsername: arkivRecords.authorUsername,
      expiresAt: arkivRecords.expiresAt,
      createdAt: arkivRecords.createdAt,
    })
    .from(arkivRecords)
    .where(
      and(
        isNotNull(arkivRecords.txHash),
        ne(arkivRecords.txHash, ""),
        isNotNull(arkivRecords.sourcePostId),
      ),
    )
    .orderBy(desc(arkivRecords.createdAt))
    .limit(100);

  let inserted = 0;
  for (const record of records) {
    if (!record.txHash || !record.sourcePostId) continue;
    try {
      const [row] = await db
        .insert(arkivTransactions)
        .values({
          entityKey: record.entityKey,
          txHash: record.txHash,
          sourcePostId: record.sourcePostId,
          traderId: record.traderId,
          traderUsername: record.traderUsername,
          status: "CONFIRMED",
          submittedAt: record.createdAt,
          confirmedAt: record.createdAt,
          expiresAt: record.expiresAt,
        })
        .onConflictDoNothing()
        .returning({ id: arkivTransactions.id });
      if (row) inserted += 1;
    } catch {
      // ignore individual conflicts / malformed rows
    }
  }
  return inserted;
}

function getPublicClient() {
  if (!env.ARKIV_ACCESS_KEY) return null;
  try {
    return createArkivPublicClient({
      accessKey: env.ARKIV_ACCESS_KEY,
      rpcUrl: env.ARKIV_RPC_URL,
    });
  } catch {
    return null;
  }
}

/**
 * List recent platform Arkiv writes for the topbar / judges.
 * Merges local receipts with live on-chain entities.
 */
export async function listTransactions(opts: {
  limit?: number;
  traderId?: string;
}): Promise<{ transactions: ArkivTransactionRow[]; total: number; onChainCount: number }> {
  const limit = Math.min(opts.limit ?? 20, 100);

  await backfillFromRecords();

  const conditions = [
    eq(arkivTransactions.status, "CONFIRMED"),
    ...(opts.traderId ? [eq(arkivTransactions.traderId, opts.traderId)] : []),
  ];

  const [rows, countRow] = await Promise.all([
    db
      .select({
        id: arkivTransactions.id,
        entityKey: arkivTransactions.entityKey,
        txHash: arkivTransactions.txHash,
        sourcePostId: arkivTransactions.sourcePostId,
        traderId: arkivTransactions.traderId,
        traderUsername: arkivTransactions.traderUsername,
        traderDisplayName: creators.displayName,
        status: arkivTransactions.status,
        submittedAt: arkivTransactions.submittedAt,
        confirmedAt: arkivTransactions.confirmedAt,
        expiresAt: arkivTransactions.expiresAt,
        createdAt: arkivTransactions.createdAt,
      })
      .from(arkivTransactions)
      .leftJoin(creators, eq(arkivTransactions.traderId, creators.id))
      .where(and(...conditions))
      .orderBy(
        desc(arkivTransactions.confirmedAt),
        desc(arkivTransactions.createdAt),
      )
      .limit(limit),

    db
      .select({ total: sql<number>`count(*)::int` })
      .from(arkivTransactions)
      .where(and(...conditions)),
  ]);

  const localRows = rows.map((row) => toRow(row, "local_tx"));
  const seenEntityKeys = new Set(localRows.map((r) => r.entityKey.toLowerCase()));
  const seenTxHashes = new Set(
    localRows
      .map((r) => r.txHash?.toLowerCase())
      .filter((h): h is string => Boolean(h)),
  );

  // Live on-chain entities this platform schema owns — prove Arkiv DB usage.
  let onChainCount = 0;
  const chainRows: ArkivTransactionRow[] = [];
  const client = getPublicClient();
  if (client && !opts.traderId) {
    try {
      const { posts } = await queryPosts(client, { limit });
      onChainCount = posts.length;

      const postIds = posts.map((p) => p.sourcePostId).filter(Boolean);
      const localByPostId = new Map<
        string,
        { txHash: string | null; entityKey: string; relatedCreatorId: string | null }
      >();
      if (postIds.length > 0) {
        const local = await db
          .select({
            sourcePostId: arkivRecords.sourcePostId,
            txHash: arkivRecords.txHash,
            entityKey: arkivRecords.entityKey,
            relatedCreatorId: arkivRecords.relatedCreatorId,
          })
          .from(arkivRecords)
          .where(
            and(
              eq(arkivRecords.sourcePlatform, "x"),
              inArray(arkivRecords.sourcePostId, postIds),
            ),
          );
        for (const row of local) {
          if (row.sourcePostId) {
            localByPostId.set(row.sourcePostId, {
              txHash: row.txHash,
              entityKey: row.entityKey,
              relatedCreatorId: row.relatedCreatorId,
            });
          }
        }
      }

      for (const post of posts) {
        const key = post.entityKey?.toLowerCase();
        if (!key || seenEntityKeys.has(key)) continue;

        const local = localByPostId.get(post.sourcePostId);
        const txHash = local?.txHash?.trim() || post.txHash || null;
        if (txHash && seenTxHashes.has(txHash.toLowerCase())) continue;

        seenEntityKeys.add(key);
        if (txHash) seenTxHashes.add(txHash.toLowerCase());

        chainRows.push({
          id: `chain:${post.entityKey}`,
          entityKey: post.entityKey,
          txHash,
          sourcePostId: post.sourcePostId,
          traderId: local?.relatedCreatorId ?? null,
          traderUsername: post.authorUsername || null,
          traderDisplayName: post.authorDisplayName || null,
          status: "CONFIRMED",
          submittedAt: post.capturedAt,
          confirmedAt: post.capturedAt,
          expiresAt: post.expiresAt,
          createdAt: post.capturedAt,
          explorerUrl: explorerUrlFor(txHash),
          proofSource: txHash ? "local_record" : "arkiv_chain",
        });
      }
    } catch {
      // On-chain read is best-effort for the topbar.
    }
  }

  const merged = [...localRows, ...chainRows].sort((a, b) => {
    const at = (a.confirmedAt ?? a.createdAt).getTime();
    const bt = (b.confirmedAt ?? b.createdAt).getTime();
    return bt - at;
  });

  return {
    transactions: merged.slice(0, limit),
    total: Math.max(Number(countRow[0]?.total ?? 0), merged.length),
    onChainCount,
  };
}

/**
 * Get the single most recent confirmed platform write.
 */
export async function getLatestTransaction(): Promise<ArkivTransactionRow | null> {
  const { transactions } = await listTransactions({ limit: 1 });
  return transactions[0] ?? null;
}
