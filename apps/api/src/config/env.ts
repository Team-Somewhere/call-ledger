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
};
