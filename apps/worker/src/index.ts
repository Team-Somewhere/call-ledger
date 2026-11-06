import {
  checkDatabaseHealth,
  closeDatabaseConnection,
} from "@call-ledger/database";
import { env } from "./config/env";
import { WorkerPollingService } from "./jobs/creator-polling.job";
import { SourceMonitoringWorker } from "./jobs/source-monitoring.job";
import { logger } from "./services/logger";

const worker = new SourceMonitoringWorker();
const legacyMaintenance = new WorkerPollingService();
let activeCycle: Promise<number> | null = null;
let cycleTimer: NodeJS.Timeout | null = null;
let maintenanceTimer: NodeJS.Timeout | null = null;
let shuttingDown = false;

async function poll(): Promise<void> {
  if (shuttingDown || activeCycle) return;
  activeCycle = worker.runOnce();
  try {
    const claimed = await activeCycle;
    if (claimed > 0)
      logger.info(`Processed ${claimed} globally monitored sources.`);
  } catch (error) {
    logger.error(
      "Monitoring worker cycle failed",
      error instanceof Error ? error.message : "Unexpected worker error",
    );
  } finally {
    activeCycle = null;
  }
}

async function start(): Promise<void> {
  logger.info(
    `Starting source monitoring worker (${env.MONITORING_WORKER_ENABLED ? "enabled" : "disabled"}).`,
  );
  const health = await checkDatabaseHealth();
  if (!health.connected) {
    throw new Error(
      `PostgreSQL connection failed: ${health.error ?? "unknown error"}`,
    );
  }

  maintenanceTimer = setInterval(
    () => void legacyMaintenance.cleanupExpiredOAuth(),
    10 * 60 * 1000,
  );
  if (!env.MONITORING_WORKER_ENABLED) return;
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
  logger.info(`Received ${signal}; waiting for the active monitoring cycle.`);
  await activeCycle;
  await closeDatabaseConnection();
  logger.info("Monitoring worker stopped.");
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

start().catch(async (error: unknown) => {
  logger.error(
    "Fatal monitoring worker startup error",
    error instanceof Error ? error.message : "Unexpected startup error",
  );
  await closeDatabaseConnection();
  process.exitCode = 1;
});
