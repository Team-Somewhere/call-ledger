import path from "path";
import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
  verbose: true,
  strict: true,
});
