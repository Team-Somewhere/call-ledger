import http from "http";
import {
  checkDatabaseHealth,
  closeDatabaseConnection,
} from "@call-ledger/database";
import { env } from "./config/env";
import { WorkerPollingService } from "./jobs/creator-polling.job";
import { SourceMonitoringWorker } from "./jobs/source-monitoring.job";
import { logger } from "./services/logger";
import { getBudgetStats } from "./services/arkiv-archiver";

const worker = new SourceMonitoringWorker();
const legacyMaintenance = new WorkerPollingService();
let activeCycle: Promise<number> | null = null;
let cycleTimer: NodeJS.Timeout | null = null;
let maintenanceTimer: NodeJS.Timeout | null = null;
let shuttingDown = false;
let lastCycleAt: Date | null = null;
let lastCycleProcessed = 0;
let totalCycles = 0;
let workerStartedAt: Date | null = null;

async function poll(): Promise<void> {
  if (shuttingDown || activeCycle) return;
  activeCycle = worker.runOnce();
  try {
    const claimed = await activeCycle;
    lastCycleAt = new Date();
    lastCycleProcessed = claimed;
    totalCycles += 1;
    if (claimed > 0)
      logger.info(`[WORKER] Processed ${claimed} globally monitored sources.`);
  } catch (error) {
    logger.error(
      "[WORKER] Monitoring cycle failed",
      error instanceof Error ? error.message : "Unexpected worker error",
    );
  } finally {
    activeCycle = null;
  }
}

/**
 * Minimal HTTP health server on WORKER_STATUS_PORT (default 8001).
 *
 * GET /health  — liveness probe (always 200 once server is up)
 * GET /status  — worker metrics for monitoring dashboard
 *
 * Render and other platforms use /health as the healthcheck path.
 */
function startHealthServer(): void {
  const port = env.WORKER_STATUS_PORT ?? 8001;

  const server = http.createServer((req, res) => {
    if (req.method !== "GET") {
      res.writeHead(405).end();
      return;
    }

    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" }).end(
        JSON.stringify({ status: "ok", shuttingDown }),
      );
      return;
    }

    if (req.url === "/status") {
      const budget = getBudgetStats();
      const nextCycleInMs = env.MONITORING_WORKER_INTERVAL_MS;
      const nextCycleAt = lastCycleAt
        ? new Date(lastCycleAt.getTime() + nextCycleInMs)
        : null;

      res.writeHead(200, { "Content-Type": "application/json" }).end(
        JSON.stringify({
          status: shuttingDown ? "stopping" : "running",
          enabled: env.MONITORING_WORKER_ENABLED,
          startedAt: workerStartedAt,
          lastCycleAt,
          nextCycleAt,
          lastCycleProcessed,
          totalCycles,
          intervalMs: nextCycleInMs,
          intervalMinutes: Math.round(nextCycleInMs / 60000),
          budget,
          arkivConfigured: Boolean(env.ARKIV_ACCESS_KEY),
          arkivWriteConfigured: Boolean(
            env.ARKIV_ACCESS_KEY && env.ARKIV_ARCHIVER_PRIVATE_KEY,
          ),
        }),
      );
      return;
    }

    res.writeHead(404).end();
  });

  server.listen(port, () => {
    logger.info(`[WORKER] Health server listening on port ${port} (/health, /status)`);
  });

  server.on("error", (err) => {
    logger.warn(`[WORKER] Health server error: ${err.message}`);
  });
}

async function start(): Promise<void> {
  workerStartedAt = new Date();
  logger.info(
    `[WORKER] Starting source monitoring worker (${env.MONITORING_WORKER_ENABLED ? "enabled" : "disabled"}).`,
  );
  logger.info(
    `[WORKER] X poll interval: ${env.X_MONITOR_DEFAULT_INTERVAL_MINUTES} min | ` +
    `cycle check: ${env.MONITORING_WORKER_INTERVAL_MS / 1000}s | ` +
    `daily budget: ${env.X_MONITOR_MAX_REQUESTS_PER_DAY} requests`,
  );

  const health = await checkDatabaseHealth();
  if (!health.connected) {
    throw new Error(
      `PostgreSQL connection failed: ${health.error ?? "unknown error"}`,
    );
  }

  startHealthServer();

  maintenanceTimer = setInterval(
    () => void legacyMaintenance.cleanupExpiredOAuth(),
    10 * 60 * 1000,
  );

  if (!env.MONITORING_WORKER_ENABLED) {
    logger.info(
      "[WORKER] MONITORING_WORKER_ENABLED is false — worker is running but not polling. " +
      "Set MONITORING_WORKER_ENABLED=true to start automatic archiving.",
    );
    return;
  }

  // Run immediately on startup, then on the interval
  await poll();
  cycleTimer = setInterval(
    () => void poll(),
    env.MONITORING_WORKER_INTERVAL_MS,
  );
}

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  worker.stop();
  if (cycleTimer) clearInterval(cycleTimer);
  if (maintenanceTimer) clearInterval(maintenanceTimer);
  logger.info(`[WORKER] Received ${signal}; waiting for the active monitoring cycle.`);
  if (activeCycle) await activeCycle;
  await closeDatabaseConnection();
  logger.info("[WORKER] Monitoring worker stopped cleanly.");
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

start().catch(async (error: unknown) => {
  logger.error(
    "[WORKER] Fatal startup error",
    error instanceof Error ? error.message : "Unexpected startup error",
  );
  await closeDatabaseConnection();
  process.exitCode = 1;
});
