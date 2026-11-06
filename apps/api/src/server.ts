import { closeDatabaseConnection } from "@call-ledger/database";
import { createApp } from "./app";
import { env } from "./config/env";

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`
==================================================
🚀 CallLedger API Server (Express 5)
==================================================
📍 Environment: ${env.NODE_ENV}
📡 Port:        ${env.PORT}
🌐 CORS Origin: ${env.API_CORS_ORIGIN}
🩺 Health:      http://localhost:${env.PORT}/api/health
👥 Users:       http://localhost:${env.PORT}/api/users
🌟 Creators:    http://localhost:${env.PORT}/api/creators
==================================================
  `);

  if (env.DATABASE_URL && env.FIRECRAWL_API_KEY) {
    void (async () => {
      try {
        const { db, creatorSources } = await import("@call-ledger/database");
        const { eq, and } = await import("drizzle-orm");
        await db
          .update(creatorSources)
          .set({ status: "ACTIVE", updatedAt: new Date() })
          .where(
            and(
              eq(creatorSources.sourceType, "X"),
              eq(creatorSources.status, "WAITING_FOR_AUTHORIZED_ACCESS"),
            ),
          );
      } catch {
        // Startup sync optional
      }
    })();
  }
});

// Graceful shutdown
async function handleShutdown(signal: string) {
  console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    try {
      await closeDatabaseConnection();
      console.log("🔌 Database connections closed.");
    } catch (err) {
      console.error("Error closing database connections:", err);
    }
    console.log("👋 Process terminated.");
    process.exit(0);
  });

  // Force close after 10s
  setTimeout(() => {
    console.error("⚠️ Forcefully terminating server after timeout.");
    process.exit(1);
  }, 10000);
}

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));
