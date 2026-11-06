/**
 * Monitoring status service — Phase 3 worker visibility.
 *
 * Provides:
 *  - Worker status (polled from worker health endpoint or derived from DB)
 *  - Per-trader monitoring state
 *  - Pause / resume trader monitoring
 *  - Admin "run now" trigger (resets nextFetchAt → due immediately)
 */

import { and, asc, desc, eq, isNull, lte, or, sql } from "drizzle-orm";
import {
  arkivRecords,
  arkivTransactions,
  creatorMonitoringLogs,
  creatorSources,
  creators,
  db,
} from "@call-ledger/database";
import { env } from "../config/env";

// ─── Worker status ────────────────────────────────────────────────────────

export interface WorkerStatus {
  reachable: boolean;
  status: "running" | "stopped" | "unknown";
  startedAt: string | null;
  lastCycleAt: string | null;
  nextCycleAt: string | null;
  totalCycles: number;
  lastCycleProcessed: number;
  intervalMinutes: number;
  budget: {
    date: string;
    usedRequests: number;
    maxRequests: number;
    remaining: number;
  } | null;
  arkivConfigured: boolean;
  arkivWriteConfigured: boolean;
  // Derived from DB when worker is unreachable
  lastSuccessfulFetch: Date | null;
  totalArchived: number;
  archivedLast24h: number;
}

/**
 * Attempts to reach the worker health/status endpoint.
 * Falls back gracefully to DB-derived stats if the worker is not reachable.
 */
export async function getWorkerStatus(): Promise<WorkerStatus> {
  const workerStatusUrl = process.env.WORKER_STATUS_URL ?? "http://localhost:8001/status";

  // DB-derived stats (always available)
  const [lastLog] = await db
    .select({ completedAt: creatorMonitoringLogs.completedAt })
    .from(creatorMonitoringLogs)
    .where(eq(creatorMonitoringLogs.status, "SUCCESS"))
    .orderBy(desc(creatorMonitoringLogs.completedAt))
    .limit(1);

  const totalArchivedResult = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(arkivTransactions)
    .where(eq(arkivTransactions.status, "CONFIRMED"));

  const archivedLast24hResult = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(arkivTransactions)
    .where(
      and(
        eq(arkivTransactions.status, "CONFIRMED"),
        sql`${arkivTransactions.confirmedAt} > now() - interval '24 hours'`,
      ),
    );

  const base = {
    lastSuccessfulFetch: lastLog?.completedAt ?? null,
    totalArchived: Number(totalArchivedResult[0]?.total ?? 0),
    archivedLast24h: Number(archivedLast24hResult[0]?.total ?? 0),
  };

  // Try the worker status endpoint
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const resp = await fetch(workerStatusUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (resp.ok) {
      const data = (await resp.json()) as {
        status?: string;
        startedAt?: string;
        lastCycleAt?: string;
        nextCycleAt?: string;
        totalCycles?: number;
        lastCycleProcessed?: number;
        intervalMinutes?: number;
        budget?: WorkerStatus["budget"];
        arkivConfigured?: boolean;
        arkivWriteConfigured?: boolean;
      };
      return {
        reachable: true,
        status: (data.status as WorkerStatus["status"]) ?? "running",
        startedAt: data.startedAt ?? null,
        lastCycleAt: data.lastCycleAt ?? null,
        nextCycleAt: data.nextCycleAt ?? null,
        totalCycles: data.totalCycles ?? 0,
        lastCycleProcessed: data.lastCycleProcessed ?? 0,
        intervalMinutes: data.intervalMinutes ?? 15,
        budget: data.budget ?? null,
        arkivConfigured: data.arkivConfigured ?? false,
        arkivWriteConfigured: data.arkivWriteConfigured ?? false,
        ...base,
      };
    }
  } catch {
    // Worker not reachable — fall through to DB-derived response
  }

  return {
    reachable: false,
    status: "unknown",
    startedAt: null,
    lastCycleAt: base.lastSuccessfulFetch?.toISOString() ?? null,
    nextCycleAt: null,
    totalCycles: 0,
    lastCycleProcessed: 0,
    intervalMinutes: 15,
    budget: null,
    arkivConfigured: Boolean(env.ARKIV_ACCESS_KEY),
    arkivWriteConfigured: false,
    ...base,
  };
}

// ─── Per-trader monitoring state ──────────────────────────────────────────

export interface TraderMonitoringState {
  traderId: string;
  traderDisplayName: string;
  xUsername: string | null;
  monitoringEnabled: boolean;
  sourceId: string | null;
  sourceStatus: string | null;
  lastFetchedAt: Date | null;
  nextFetchAt: Date | null;
  consecutiveFailures: number;
  lastError: string | null;
  postsArchived: number;
  lastArchivedAt: Date | null;
}

export async function listTraderMonitoringStates(): Promise<TraderMonitoringState[]> {
  const rows = await db
    .select({
      traderId: creators.id,
      traderDisplayName: creators.displayName,
      xUsername: creators.xUsername,
      monitoringEnabled: creators.monitoringEnabled,
      sourceId: creatorSources.id,
      sourceStatus: creatorSources.status,
      lastFetchedAt: creatorSources.lastFetchedAt,
      nextFetchAt: creatorSources.nextFetchAt,
      consecutiveFailures: creatorSources.consecutiveFailures,
      lastError: creatorSources.lastError,
    })
    .from(creators)
    .leftJoin(
      creatorSources,
      and(
        eq(creatorSources.creatorId, creators.id),
        eq(creatorSources.sourceType, "X"),
        eq(creatorSources.status, "ACTIVE"),
      ),
    )
    .orderBy(asc(creators.displayName));

  // Batch-fetch archive counts per trader
  const traderIds = rows.map((r) => r.traderId);
  const archiveCounts =
    traderIds.length > 0
      ? await db
          .select({
            traderId: arkivTransactions.traderId,
            total: sql<number>`count(*)::int`,
            lastAt: sql<Date>`max(${arkivTransactions.confirmedAt})`,
          })
          .from(arkivTransactions)
          .where(
            and(
              eq(arkivTransactions.status, "CONFIRMED"),
              sql`${arkivTransactions.traderId} = any(${sql.raw(
                `array[${traderIds.map((id) => `'${id}'`).join(",")}]::uuid[]`,
              )})`,
            ),
          )
          .groupBy(arkivTransactions.traderId)
      : [];

  const countMap = new Map(
    archiveCounts.map((r) => [r.traderId ?? "", { total: r.total, lastAt: r.lastAt }]),
  );

  return rows.map((row) => {
    const counts = countMap.get(row.traderId);
    return {
      traderId: row.traderId,
      traderDisplayName: row.traderDisplayName,
      xUsername: row.xUsername,
      monitoringEnabled: row.monitoringEnabled,
      sourceId: row.sourceId ?? null,
      sourceStatus: row.sourceStatus ?? null,
      lastFetchedAt: row.lastFetchedAt ?? null,
      nextFetchAt: row.nextFetchAt ?? null,
      consecutiveFailures: row.consecutiveFailures ?? 0,
      lastError: row.lastError ?? null,
      postsArchived: Number(counts?.total ?? 0),
      lastArchivedAt: counts?.lastAt ?? null,
    };
  });
}

// ─── Pause / Resume ───────────────────────────────────────────────────────

export async function pauseTraderMonitoring(traderId: string): Promise<void> {
  await db
    .update(creatorSources)
    .set({ status: "DISABLED", updatedAt: new Date() })
    .where(
      and(eq(creatorSources.creatorId, traderId), eq(creatorSources.sourceType, "X")),
    );
  await db
    .update(creators)
    .set({ monitoringEnabled: false, updatedAt: new Date() })
    .where(eq(creators.id, traderId));
}

export async function resumeTraderMonitoring(traderId: string): Promise<void> {
  await db
    .update(creatorSources)
    .set({ status: "ACTIVE", updatedAt: new Date() })
    .where(
      and(eq(creatorSources.creatorId, traderId), eq(creatorSources.sourceType, "X")),
    );
  await db
    .update(creators)
    .set({ monitoringEnabled: true, updatedAt: new Date() })
    .where(eq(creators.id, traderId));
}

/** Pause ALL X monitoring globally. */
export async function pauseAllMonitoring(): Promise<void> {
  await db
    .update(creatorSources)
    .set({ status: "DISABLED", updatedAt: new Date() })
    .where(eq(creatorSources.sourceType, "X"));
}

/** Resume ALL X monitoring globally. */
export async function resumeAllMonitoring(): Promise<void> {
  await db
    .update(creatorSources)
    .set({ status: "ACTIVE", updatedAt: new Date() })
    .where(eq(creatorSources.sourceType, "X"));
}

/**
 * "Run Now" — reset nextFetchAt to now() for all due X sources,
 * clearing any existing lease so the worker picks them up on its next cycle.
 * Uses the same eligibility rules as the worker: ACTIVE sources only.
 */
export async function triggerRunNow(): Promise<{ sourcesReset: number }> {
  const now = new Date();
  const result = await db
    .update(creatorSources)
    .set({
      nextFetchAt: now,
      lockExpiresAt: null,
      lockedBy: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(creatorSources.sourceType, "X"),
        eq(creatorSources.status, "ACTIVE"),
        isNull(creatorSources.permanentErrorCode),
        or(
          isNull(creatorSources.lockExpiresAt),
          lte(creatorSources.lockExpiresAt, now),
        ),
      ),
    )
    .returning({ id: creatorSources.id });

  return { sourcesReset: result.length };
}
