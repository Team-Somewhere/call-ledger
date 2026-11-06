"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle, Gauge, Loader2 } from "lucide-react";
import { SourceBadge } from "../../components/source-badge";
import {
  api,
  ApiRequestError,
  type MonitoringDashboard,
  type MonitoringLog,
} from "../../lib/api";
import { useWalletSession } from "../../lib/use-wallet-session";

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-sm border border-[#E8DFD1] bg-[#FFFAF3] p-4">
      <div className="text-[10px] uppercase tracking-wide text-[#78716C]">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold text-[#171717]">{value}</div>
    </div>
  );
}

export default function MonitoringPage() {
  const { isAuthenticated } = useWalletSession();
  const [overview, setOverview] = useState<MonitoringDashboard | null>(null);
  const [logs, setLogs] = useState<MonitoringLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!isAuthenticated) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    void Promise.all([api.monitoringDashboard(), api.monitoringLogs(25)])
      .then(([dashboard, recent]) => {
        if (!active) return;
        setOverview(dashboard.data);
        setLogs(recent.data);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(
          err instanceof ApiRequestError
            ? err.message
            : "Could not load monitoring data.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-3xl rounded-sm border border-[#E8DFD1] bg-[#FFFAF3] p-8 text-center">
        <Gauge className="mx-auto mb-2 h-5 w-5 text-[#78716C]" />
        <p className="text-sm font-bold text-[#171717]">
          Admin access required
        </p>
        <p className="mt-1 font-sans text-xs text-[#78716C]">
          Sign in with an administrator wallet to view monitoring operations.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 font-mono">
      <header className="space-y-1 border-b border-[#E8DFD1] pb-4">
        <div className="text-[10px] uppercase tracking-widest text-[#78716C]">
          // GLOBAL SOURCE HEALTH
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-[#171717]">
          Monitoring
        </h1>
        <p className="font-sans text-xs text-[#78716C]">
          One scheduled poll per global source, shared by every follower.
        </p>
      </header>

      {error && (
        <div className="flex items-center gap-2 border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {loading ? (
        <div className="flex items-center gap-2 py-12 text-xs text-[#78716C]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading monitoring
          status…
        </div>
      ) : overview ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Creators" value={overview.totals.creators} />
            <Metric
              label="Active sources"
              value={overview.totals.activeSources}
            />
            <Metric
              label="Posts collected"
              value={overview.totals.postsCollected}
            />
            <Metric
              label="Collected today"
              value={overview.totals.postsCollectedToday}
            />
            <Metric
              label="Active RSS"
              value={overview.sourcesByType.RSS ?? 0}
            />
            <Metric
              label="Active Bluesky"
              value={overview.sourcesByType.BLUESKY ?? 0}
            />
            <Metric
              label="Active websites"
              value={overview.sourcesByType.WEBSITE ?? 0}
            />
            <Metric
              label="X waiting for access"
              value={overview.totals.waitingForAuthorizedAccess}
            />
            <Metric
              label="Failed runs (24h)"
              value={overview.totals.failedRunsLast24Hours}
            />
            <Metric
              label="Sources backing off"
              value={overview.totals.sourcesBackingOff}
            />
            <Metric
              label="Last successful fetch"
              value={
                overview.lastSuccessfulFetch
                  ? new Date(overview.lastSuccessfulFetch).toLocaleString()
                  : "—"
              }
            />
          </section>

          <section className="overflow-hidden rounded-sm border border-[#E8DFD1] bg-[#FFFAF3]">
            <div className="border-b border-[#E8DFD1] px-4 py-3 text-xs font-bold uppercase tracking-wide text-[#171717]">
              Recent monitoring runs
            </div>
            {logs.length === 0 ? (
              <p className="p-6 text-center font-sans text-xs text-[#78716C]">
                No monitoring runs recorded yet.
              </p>
            ) : (
              <div className="divide-y divide-[#E8DFD1]">
                {logs.map((log) => (
                  <article
                    key={log.id}
                    className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-start"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-[#171717]">
                          {log.creatorName}
                        </span>
                        <SourceBadge sourceType={log.sourceType} />
                        <span className="text-[10px] text-[#78716C]">
                          {log.status}
                        </span>
                      </div>
                      <p className="font-sans text-xs text-[#78716C]">
                        {log.itemsInserted} new of {log.itemsFound} found
                        {log.errorMessage ? ` · ${log.errorMessage}` : ""}
                      </p>
                      {log.errorCode && (
                        <p className="text-[9px] text-[#A8A29E]">
                          {log.errorCode}
                        </p>
                      )}
                    </div>
                    <time
                      dateTime={log.startedAt}
                      className="whitespace-nowrap text-[10px] text-[#78716C]"
                    >
                      {new Date(log.startedAt).toLocaleString()}
                    </time>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
