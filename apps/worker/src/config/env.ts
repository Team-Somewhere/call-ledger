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
    .transform((val) => (val ? parseInt(val, 10) : 30000)),
  DATABASE_URL: z.string().optional(),
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
