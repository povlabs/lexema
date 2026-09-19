// Build a small development release and load it into the Worker's local D1.
//
//   pnpm run seed:dev
//
// A few thousand records is enough to build a page against and loads in
// seconds. The full release is 560,357 records and 1.3 GB, which is a
// deployment problem (#18), not a development one.

import { execFileSync } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { exportSql } from "./exportSql.js";
import { importRelease } from "./importRelease.js";

// 25,000 records reaches source line 60,501, which is where the words this
// page is built against stop being absent: `sale`, `sala`, `salire`, `casa`,
// `studenti`, `bella`, `città`. A smaller default makes the page's own
// suggested searches find nothing.
const RECORDS = Number(process.env.SEED_RECORDS ?? 25000);
const RELEASE = process.env.SEED_RELEASE ?? "it-dev";
const DB = resolve(".data/dev.sqlite");
const SQL = resolve(".data/dev.sql");
const STATE = resolve("web/.wrangler/state");

await mkdir(".data", { recursive: true });
for (const path of [DB, `${DB}-wal`, `${DB}-shm`, SQL]) await rm(path, { force: true });

// The generated SQL creates the schema and inserts the release, so loading it
// into a database that already holds a seed collides on duplicate rows. Local
// D1 is a miniflare SQLite file under the persist directory, and it holds
// nothing this script cannot rebuild, so the seed drops it and starts clean.
// That is what makes `pnpm run seed:dev` repeatable.
process.stderr.write(`clearing local D1 under ${STATE}\n`);
await rm(resolve(STATE, "v3/d1"), { recursive: true, force: true });

process.stderr.write(`importing ${RECORDS} records as ${RELEASE}\n`);
const report = await importRelease({
  input: "it-extract.jsonl.gz",
  database: DB,
  schema: "src/db/schema.sql",
  releaseId: RELEASE,
  archiveR2Key: `releases/${RELEASE}.jsonl.gz`,
  sourceUrl: "https://kaikki.org/dictionary/downloads/it/it-extract.jsonl.gz",
  license: "CC-BY-SA-4.0",
  limit: RECORDS,
});
process.stderr.write(`  ${report.admitted} records, ${report.rows.lookup_form} lookup rows\n`);

const { statements } = await exportSql({ database: DB, schema: "src/db/schema.sql", output: SQL });
process.stderr.write(`wrote ${statements} statements to ${SQL}\n`);

// Wrangler resolves --persist-to relative to the config file, so it must be
// absolute; the spike lost an afternoon to exactly that.
process.stderr.write("loading into local D1\n");
execFileSync(
  "pnpm",
  ["exec", "wrangler", "d1", "execute", "lexema", "--local",
   "--persist-to", resolve("web/.wrangler/state"), "--file", SQL, "--yes"],
  { cwd: resolve("web"), stdio: "inherit", env: { ...process.env, CI: "1" } },
);
process.stderr.write("\nseeded. run `pnpm --filter @lexema/web dev`\n");
