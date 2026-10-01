// Every exported lookup statement that reads through `servedBy` probes
// `lookup_form` and `form_of_edge` on a full key, never on the `release_id`
// prefix alone (#381). Such a probe is a `SEARCH`, so the scan tests let it
// through, but it walks every row of a served release: about two million rows
// per record on `it-0c432803`. Node's SQLite on the bare schema, with no rows
// and no statistics, picks the same plan D1 does, so the plan is checked here.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { servedBy } from "../src/lookup/served.js";

const LOOKUP = new URL("../src/lookup/", import.meta.url);

const sqlite = new DatabaseSync(":memory:");
sqlite.exec(readFileSync(new URL("../src/db/schema.sql", import.meta.url), "utf8"));

/** Every index on the two tables a served-release probe must not walk. */
const guarded = new Set(
  (
    sqlite
      .prepare(`SELECT name FROM sqlite_schema WHERE type = 'index' AND tbl_name IN ('lookup_form', 'form_of_edge')`)
      .all() as { name: string }[]
  ).map((row) => row.name),
);

/** A plan step that probes one of those indexes on `release_id` and nothing after it. */
function prefixOnly(step: string): boolean {
  const probe = /^SEARCH \S+ USING (?:COVERING )?INDEX (\S+) \(release_id=\?\)$/.exec(step);
  return probe !== null && guarded.has(probe[1]);
}

const readsServed = (sql: string): boolean =>
  Array.from({ length: 9 }, (_, i) => servedBy(`?${i + 1}`)).some((list) => sql.includes(list));

/** Every exported statement of every module in src/lookup that reads through `servedBy`, by name. */
async function servedStatements(): Promise<Map<string, string>> {
  const statements = new Map<string, string>();
  for (const file of readdirSync(LOOKUP).filter((name) => name.endsWith(".ts")).sort()) {
    const module = (await import(new URL(file, LOOKUP).href)) as Record<string, unknown>;
    for (const [name, value] of Object.entries(module)) {
      if (typeof value === "string" && readsServed(value)) statements.set(name, value);
    }
  }
  return statements;
}

test("no served-release lookup probes lookup_form or form_of_edge on the release_id prefix alone", async () => {
  const statements = await servedStatements();

  // The statements #381 names, so a rename cannot drop one from the sweep unseen.
  for (const name of [
    "SEARCH_SQL",
    "LEMMA_LINK_SQL",
    "INFLECTION_SQL",
    "INFLECTION_CANDIDATE_SQL",
    "BATCH_SEARCH_SQL",
    "BATCH_LEMMA_LINK_SQL",
    "FORM_ENTRY_SQL",
    "PARTICIPLE_FORM_ENTRY_SQL",
  ]) {
    assert.ok(statements.has(name), `${name} is no longer an exported servedBy statement`);
  }

  for (const [name, sql] of statements) {
    const plan = (sqlite.prepare(`EXPLAIN QUERY PLAN ${sql}`).all() as { detail: string }[]).map((row) => row.detail);
    assert.ok(!plan.some(prefixOnly), `${name} probes on the release_id prefix alone:\n${plan.join("\n")}`);
  }
});
