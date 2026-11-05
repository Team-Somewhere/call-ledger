import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

let client: postgres.Sql | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * Initializes and returns the postgres connection pool.
 */
export function getSqlClient(): postgres.Sql {
  if (!client) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not defined.");
    }

    client = postgres(connectionString, {
      max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX, 10) : 10,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl:
        process.env.NODE_ENV === "production" ||
        connectionString.includes("neon.tech")
          ? "require"
          : false,
    });
  }
  return client;
}

/**
 * Returns the singleton Drizzle ORM instance with loaded schema.
 */
export function getDb() {
  if (!dbInstance) {
    const sql = getSqlClient();
    dbInstance = drizzle(sql, { schema });
  }
  return dbInstance;
}

/**
 * Convenience proxy to access Drizzle database.
 */
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    const instance = getDb();
    // @ts-expect-error dynamic proxy access
    return instance[prop];
  },
});

/**
 * Actively checks database connectivity by executing a raw probe query.
 */
export async function checkDatabaseHealth(): Promise<{
  connected: boolean;
  error?: string;
  latencyMs?: number;
}> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return { connected: false, error: "DATABASE_URL is not configured" };
  }

  const start = Date.now();
  try {
    const sql = getSqlClient();
    await sql`SELECT 1`;
    return { connected: true, latencyMs: Date.now() - start };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Database query probe failed";
    return { connected: false, error: message, latencyMs: Date.now() - start };
  }
}

/**
 * Closes the database connection pool.
 */
export async function closeDatabaseConnection(): Promise<void> {
  if (client) {
    await client.end();
    client = null;
    dbInstance = null;
  }
}
