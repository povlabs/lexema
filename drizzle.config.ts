// drizzle-kit's configuration for the app tables (ADR 0017). `pnpm run
// db:generate` writes a migration for each change to the schema; the dictionary
// tables stay in src/db/schema.sql and drizzle-kit never sees them.

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/app/schema.ts",
  out: "./src/db/app/migrations",
});
