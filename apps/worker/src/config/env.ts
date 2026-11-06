import path from "path";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

const workerEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  WORKER_HEARTBEAT_INTERVAL_MS: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10000)),
  CREATOR_POLLING_ENABLED: z
    .string()
    .optional()
    .transform((val) => val !== "false"),
  CREATOR_POLLING_INTERVAL_MS: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 15000)),
  CREATOR_POLLING_MAX_CONCURRENCY: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 3)),
  X_CONTENT_RETENTION_MODE: z.enum(["store", "id_only"]).default("store"),
  DATABASE_URL: z.string().optional(),
  X_CLIENT_ID: z.string().optional(),
  X_CLIENT_SECRET: z.string().optional(),
  X_BEARER_TOKEN: z.string().optional(),
  OAUTH_ENCRYPTION_KEY: z.string().optional(),
  MONITORING_WORKER_ENABLED: z
    .string()
    .optional()
    .transform((value) => value !== "false"),
  MONITORING_POLL_INTERVAL_RSS_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(900),
  MONITORING_POLL_INTERVAL_BLUESKY_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(600),
  MONITORING_POLL_INTERVAL_WEBSITE_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(3600),
  MONITORING_DEFAULT_POST_LIMIT: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20),
  MONITORING_INITIAL_POST_LIMIT: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20),
  MONITORING_MAX_RETRIES: z.coerce.number().int().min(1).max(20).default(3),
  MONITORING_LOCK_LEASE_SECONDS: z.coerce
    .number()
    .int()
    .min(30)
    .max(3600)
    .default(300),
  MONITORING_WORKER_BATCH_SIZE: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(10),
  MONITORING_POLL_JITTER_SECONDS: z.coerce
    .number()
    .int()
    .min(0)
    .max(3600)
    .default(60),
  MONITORING_REQUEST_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(120000)
    .default(20000),
  MONITORING_MAX_RESPONSE_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .max(20 * 1024 * 1024)
    .default(2 * 1024 * 1024),
  MONITORING_WORKER_INTERVAL_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(300000)
    .default(5000),
  FIRECRAWL_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  FIRECRAWL_API_KEY: z.string().optional(),
  FIRECRAWL_MAX_PAGES_PER_RUN: z.coerce
    .number()
    .int()
    .min(1)
    .max(20)
    .default(5),
  FIRECRAWL_BASE_URL: z.string().optional(),
  X_INGESTION_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === "true"),
});

const parsed = workerEnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "❌ Invalid Worker environment configuration:",
    parsed.error.format(),
  );
  process.exit(1);
}

export const env = parsed.data;
