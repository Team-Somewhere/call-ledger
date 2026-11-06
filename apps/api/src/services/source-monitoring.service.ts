import { count, eq } from "drizzle-orm";
import { creatorSources, creators, db } from "@call-ledger/database";
import { env } from "../config/env";

/**
 * Provider configuration and global source status. Polling itself runs only
 * in the standalone worker.
 */
export interface SourceMonitoringOverview {
  configuration: {
    adapters: Array<{
      sourceType: "X" | "BLUESKY" | "RSS" | "WEBSITE";
      ingestionSupported: boolean;
      description: string;
    }>;
    xIngestionEnabled: boolean;
    firecrawlEnabled: boolean;
    firecrawlConfigured: boolean;
    firecrawlMaxPagesPerRun: number;
  };
  sourceCounts: Record<string, number>;
  totals: {
    creators: number;
    sources: number;
    activeSources: number;
    waitingForAuthorizedAccess: number;
  };
}

export async function getSourceMonitoringOverview(): Promise<SourceMonitoringOverview> {
  const sourceRows = await db
    .select({ sourceType: creatorSources.sourceType, total: count() })
    .from(creatorSources)
    .groupBy(creatorSources.sourceType);

  const sourceCounts: Record<string, number> = {};
  for (const row of sourceRows) {
    sourceCounts[row.sourceType] = Number(row.total);
  }

  const [creatorCount] = await db.select({ total: count() }).from(creators);

  const [totalSources] = await db
    .select({ total: count() })
    .from(creatorSources);

  const [activeSources] = await db
    .select({ total: count() })
    .from(creatorSources)
    .where(eq(creatorSources.status, "ACTIVE"));

  const [waitingSources] = await db
    .select({ total: count() })
    .from(creatorSources)
    .where(eq(creatorSources.status, "WAITING_FOR_AUTHORIZED_ACCESS"));

  const totalSourceCount = Number(totalSources?.total ?? 0);

  return {
    configuration: {
      adapters: [
        {
          sourceType: "X",
          ingestionSupported: Boolean(
            env.X_INGESTION_ENABLED ||
              (env.FIRECRAWL_ENABLED && env.FIRECRAWL_API_KEY),
          ),
          description:
            env.X_INGESTION_ENABLED ||
            (env.FIRECRAWL_ENABLED && env.FIRECRAWL_API_KEY)
              ? "Active X post search & monitoring enabled via Firecrawl."
              : "X ingestion disabled. Configure Firecrawl or an authorized X data provider.",
        },
        {
          sourceType: "BLUESKY",
          ingestionSupported: true,
          description:
            "Public Bluesky profile + author feed reads (no API key required).",
        },
        {
          sourceType: "RSS",
          ingestionSupported: true,
          description:
            "RSS 2.0 / Atom sources are conditionally polled by the worker.",
        },
        {
          sourceType: "WEBSITE",
          ingestionSupported: Boolean(
            env.FIRECRAWL_ENABLED && env.FIRECRAWL_API_KEY,
          ),
          description: "Authorized websites only, via Firecrawl.",
        },
      ],
      xIngestionEnabled: Boolean(env.X_INGESTION_ENABLED),
      firecrawlEnabled: Boolean(env.FIRECRAWL_ENABLED),
      // Never expose the key itself — only whether it is configured.
      firecrawlConfigured: Boolean(env.FIRECRAWL_API_KEY),
      firecrawlMaxPagesPerRun: env.FIRECRAWL_MAX_PAGES_PER_RUN,
    },
    sourceCounts,
    totals: {
      creators: Number(creatorCount?.total ?? 0),
      sources: totalSourceCount,
      activeSources: Number(activeSources?.total ?? 0),
      waitingForAuthorizedAccess: Number(waitingSources?.total ?? 0),
    },
  };
}
