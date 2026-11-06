/**
 * Arkiv transaction history service.
 *
 * Reads from the arkiv_transactions table — a lightweight index of every
 * confirmed on-chain write made by the monitoring worker.
 * Post content is NOT stored here; it lives in Arkiv Rabdi.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { arkivTransactions, creators, db } from "@call-ledger/database";

export interface ArkivTransactionRow {
  id: string;
  entityKey: string;
  txHash: string;
  sourcePostId: string;
  traderId: string | null;
  traderUsername: string | null;
  traderDisplayName: string | null;
  status: string;
  submittedAt: Date;
  confirmedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  explorerUrl: string;
}

const EXPLORER_BASE = "https://rabdi.explorer.arkiv.network/tx";

function toRow(
  tx: typeof arkivTransactions.$inferSelect & { traderDisplayName?: string | null },
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
    explorerUrl: `${EXPLORER_BASE}/${tx.txHash}`,
  };
}

/**
 * List recent Arkiv transactions, newest first.
 */
export async function listTransactions(opts: {
  limit?: number;
  traderId?: string;
}): Promise<{ transactions: ArkivTransactionRow[]; total: number }> {
  const limit = Math.min(opts.limit ?? 20, 100);

  const conditions = opts.traderId
    ? [eq(arkivTransactions.traderId, opts.traderId)]
    : [];

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
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(arkivTransactions.confirmedAt), desc(arkivTransactions.createdAt))
      .limit(limit),

    db
      .select({ total: sql<number>`count(*)::int` })
      .from(arkivTransactions)
      .where(conditions.length ? and(...conditions) : undefined),
  ]);

  return {
    transactions: rows.map(toRow),
    total: Number(countRow[0]?.total ?? 0),
  };
}

/**
 * Get the single most recent confirmed transaction.
 * Used by the Topbar "LATEST ARKIV TX" widget.
 */
export async function getLatestTransaction(): Promise<ArkivTransactionRow | null> {
  const [row] = await db
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
    .where(eq(arkivTransactions.status, "CONFIRMED"))
    .orderBy(desc(arkivTransactions.confirmedAt), desc(arkivTransactions.createdAt))
    .limit(1);

  return row ? toRow(row) : null;
}
