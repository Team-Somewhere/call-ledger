import {
  checkDatabaseHealth,
  closeDatabaseConnection,
} from "@call-ledger/database";
import { env } from "./config/env";
import { futureWorkerJobs } from "./jobs/placeholder";
import { logger } from "./services/logger";

let isShuttingDown = false;
let heartbeatTimer: NodeJS.Timeout | null = null;

async function startWorker() {
  console.log(`
==================================================
⚙️  CallLedger Background Worker
==================================================
📍 Environment:        ${env.NODE_ENV}
⏱️  Heartbeat Cadence:  ${env.WORKER_HEARTBEAT_INTERVAL_MS}ms
📋 Registered Jobs:    ${futureWorkerJobs.length} (Phase 2-6 queued)
==================================================
  `);

  logger.info("Initializing background worker process...");

  // Database probe check
  try {
    const dbStatus = await checkDatabaseHealth();
    if (dbStatus.connected) {
      logger.info("Connected to PostgreSQL database successfully", {
        latencyMs: dbStatus.latencyMs,
      });
    } else {
      logger.warn(
        "Database is currently not connected or DATABASE_URL is not configured",
        { error: dbStatus.error },
      );
    }
  } catch (err) {
    logger.warn(
      "Initial database probe check failed; worker running in standalone mode",
      {
        error: err instanceof Error ? err.message : String(err),
      },
    );
  }

  // Periodic heartbeat loop
  heartbeatTimer = setInterval(() => {
    if (isShuttingDown) return;
    logger.info(
      "Worker heartbeat check: idle state healthy, awaiting job queue triggers.",
    );
  }, env.WORKER_HEARTBEAT_INTERVAL_MS);
}

// Graceful shutdown handling
async function handleShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Received ${signal}. Gracefully stopping worker tasks...`);

  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  try {
    await closeDatabaseConnection();
    logger.info("Closed database connection pool.");
  } catch (err) {
    logger.error("Error closing database connection", err);
  }

  logger.info("Worker process terminated cleanly.");
  process.exit(0);
}

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));

startWorker().catch((err) => {
  logger.error("Fatal worker startup error", err);
  process.exit(1);
});
