import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Load .env from root or package
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("❌ Error: DATABASE_URL is not set.");
    console.error(
      "Please configure your Neon/PostgreSQL connection string in .env before running migrations.",
    );
    process.exit(1);
  }

  console.log("🔄 Connecting to PostgreSQL to run migrations...");
  const migrationClient = postgres(connectionString, {
    max: 1,
    ssl:
      process.env.NODE_ENV === "production" ||
      connectionString.includes("neon.tech")
        ? "require"
        : false,
  });

  const db = drizzle(migrationClient);
  const migrationsFolder = path.resolve(__dirname, "../drizzle");

  try {
    console.log(`📂 Applying migrations from ${migrationsFolder}...`);
    await migrate(db, { migrationsFolder });
    console.log("✅ Migrations applied successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await migrationClient.end();
  }
}

runMigrations();
