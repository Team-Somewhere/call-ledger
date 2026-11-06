import path from "path";
import dotenv from "dotenv";
import { z } from "zod";

// Load local and monorepo root environment files
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : undefined)),
  API_PORT: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 8000)),
  API_CORS_ORIGIN: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string().optional(),

  // --- Phase 2A: multi-source integration configuration ----------------
  // Optional Firecrawl integration for authorized website sources and X public search.
  FIRECRAWL_ENABLED: z
    .string()
    .optional()
    .transform((val) => val === "true" || (!val && Boolean(process.env.FIRECRAWL_API_KEY))),
  FIRECRAWL_API_KEY: z.string().optional(),
  FIRECRAWL_MAX_PAGES_PER_RUN: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 5)),
  FIRECRAWL_MAX_RESPONSE_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .max(20 * 1024 * 1024)
    .default(2 * 1024 * 1024),
  FIRECRAWL_BASE_URL: z.string().optional(),

  // X ingestion is disabled unless an authorized provider is configured.
  X_INGESTION_ENABLED: z
    .string()
    .optional()
    .transform((val) => val === "true"),

  // --- Arkiv Rabdi testnet configuration ---
  ARKIV_ACCESS_KEY: z.string().optional(),
  ARKIV_RPC_URL: z.string().optional(),

  // Wallet auth session lifetime (nonce TTL in milliseconds)
  WALLET_NONCE_TTL_MS: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 5 * 60 * 1000)),

  // Comma-separated list of wallet addresses granted admin privileges.
  ADMIN_WALLET_ADDRESSES: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "❌ Invalid API environment configuration:",
    parsed.error.format(),
  );
  process.exit(1);
}

export const env = {
  ...parsed.data,
  PORT: parsed.data.PORT || parsed.data.API_PORT || 8000,
  FIRECRAWL_MAX_PAGES_PER_RUN: parsed.data.FIRECRAWL_MAX_PAGES_PER_RUN ?? 5,
  FIRECRAWL_MAX_RESPONSE_BYTES: parsed.data.FIRECRAWL_MAX_RESPONSE_BYTES,
  WALLET_NONCE_TTL_MS: parsed.data.WALLET_NONCE_TTL_MS ?? 5 * 60 * 1000,
  ADMIN_WALLET_ADDRESSES: (parsed.data.ADMIN_WALLET_ADDRESSES ?? "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean),
};

export type ApiEnv = typeof env;
