import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

const databaseUrl =
  process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/persistence/postgres/schema.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
  dbCredentials: databaseUrl ? { url: databaseUrl } : undefined,
});
