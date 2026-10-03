// Plan-only runs of `update:upgrade` and `normalize:source-text` (#455),
// through each command's own entry point against a local D1 file: the run
// prints its counts and leaves the file byte for byte as it was, and
// `normalize:source-text` writes its rules as one file run in one step.
// `update:auto` and `hide:records` read archives a fixture cannot stand in for
// at the command line, so their plan-only runs are tested in update.test.ts and
// hiddenRecords.test.ts.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { main as normalizeMain } from "../src/import/normalizeSourceTextCli.js";
import { seedSql } from "../src/import/seedSql.js";
import { PLURAL_PLACEHOLDER_FORM } from "../src/italian/sourceTextNormalization.js";
import { PAGE_ENTRY_INDEXES, PAGE_ENTRY_TABLES } from "../src/update/masterUpgrade.js";
import { main as updateMain } from "../src/update/updateCli.js";
import { localD1, type LocalD1 } from "./localD1.js";

const RELEASE = "it-test";
const record = (fields: Record<string, unknown>): string => JSON.stringify({ lang_code: "it", ...fields });

// `vado`'s gloss needs both gloss rules: the lead comes off, then the ordinal is
// spelled out, which the ordinal rule can only see once the lead is gone.
const VADO_SOURCE = "vado ( approfondimento) 1ª persona singolare del presente indicativo di andare";
const VADO_STORED = "prima persona singolare del presente indicativo di andare";
const FATE_SOURCE = "2ª persona plurale dell'indicativo presente di fare";
const FATE_STORED = "seconda persona plurale dell'indicativo presente di fare";
const LINES = [
  record({ word: "vado", pos: "verb", pos_title: "Voce verbale", tags: ["form-of"], senses: [{ glosses: [VADO_SOURCE] }] }),
  record({ word: "fate", pos: "verb", pos_title: "Voce verbale", tags: ["form-of"], senses: [{ glosses: [FATE_SOURCE] }] }),
  record({ word: "cane", pos: "noun", pos_title: "Sostantivo", tags: ["masculine"], senses: [{ glosses: ["mammifero domestico"] }] }),
  record({ word: "pittore", pos: "noun", pos_title: "Sostantivo", tags: ["masculine"], senses: [{ glosses: ["chi dipinge"] }] }),
];

async function seeded(): Promise<{ dir: string; db: DatabaseSync }> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-plan-only-"));
  const input = join(dir, "fixture.jsonl");
  await writeFile(input, `${LINES.join("\n")}\n`);
  const report = await seedSql({
    input, outputDir: join(dir, "sql"), schema: resolve("src/db/schema.sql"), releaseId: RELEASE,
    requiredWords: [], validateFixtureClosure: false,
  });
  const db = new DatabaseSync(":memory:");
  for (const part of report.parts) db.exec(await readFile(part, "utf8"));
  return { dir, db };
}

async function withLocalD1(prepare: (db: DatabaseSync) => void, run: (d1: LocalD1, dir: string) => Promise<void>): Promise<void> {
  const { dir, db } = await seeded();
  try {
    prepare(db);
    await run(localD1(dir, db), dir);
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
}

/** As a seed before the rules wrote it: the source's glosses, and a lookup row and a form claim for the plural template. */
function beforeTheRules(db: DatabaseSync): void {
  db.prepare("UPDATE sense_gloss SET text = ? WHERE text = ?").run(VADO_SOURCE, VADO_STORED);
  db.prepare("UPDATE sense_gloss SET text = ? WHERE text = ?").run(FATE_SOURCE, FATE_STORED);
  const { record_id: pittore } = db.prepare("SELECT record_id FROM source_record WHERE word = 'pittore'").get() as { record_id: number };
  db.prepare(`INSERT INTO lookup_form (record_id, release_id, origin, surface, surface_key, json_pointer, form_index, form_source)
              VALUES (?, ?, 'embedded-form', ?, ?, '/forms/0/form', 0, NULL)`).run(pittore, RELEASE, PLURAL_PLACEHOLDER_FORM, PLURAL_PLACEHOLDER_FORM);
  db.prepare(`INSERT INTO grammar_claim (record_id, scope, scope_index, json_pointer, status, dimension, value, source_text)
              VALUES (?, 'form', 0, '/forms/0/tags/0', 'stated', 'number', 'plural', 'plural')`).run(pittore);
}

const glosses = (db: DatabaseSync): string[] =>
  (db.prepare("SELECT text FROM sense_gloss ORDER BY gloss_id").all() as { text: string }[]).map(({ text }) => text);

const writes = (d1: LocalD1): string[][] => d1.calls.filter((call) => call[0] === "--file");

test("update:upgrade --plan-only names what it adds, counts no row, and leaves the local D1 byte-identical", async () => {
  await withLocalD1((db) => {
    for (const table of [...PAGE_ENTRY_TABLES].reverse()) db.exec(`DROP TABLE ${table}`);
  }, async (d1, dir) => {
    const before = d1.sha256();
    const result = await updateMain(["upgrade", "--plan-only", "--out", join(dir, "out")], d1.wrangler, { SEED_STATE: d1.persistTo });
    assert.equal(result.status, 0, result.out);
    const answer = JSON.parse(result.out);
    assert.equal(answer.command, "update:upgrade");
    assert.deepEqual(answer.adds, [...PAGE_ENTRY_TABLES, ...PAGE_ENTRY_INDEXES]);
    assert.deepEqual(answer.counts, { records: { added: 0, changed: 0, removed: 0 }, written: {}, deleted: {} });
    assert.equal(answer.dictionaryRecords, LINES.length);
    assert.ok(typeof answer.sql === "string" && (await readFile(answer.sql, "utf8")).includes("CREATE TABLE IF NOT EXISTS"));
    assert.equal(d1.sha256(), before);
    assert.deepEqual(writes(d1), []);

    // Without the flag the same command writes.
    assert.equal((await updateMain(["upgrade", "--out", join(dir, "out")], d1.wrangler, { SEED_STATE: d1.persistTo })).status, 0);
    assert.notEqual(d1.sha256(), before);
  });
});

test("normalize:source-text --plan-only returns every rule's counts and leaves the local D1 byte-identical", async () => {
  await withLocalD1(beforeTheRules, async (d1, dir) => {
    const before = d1.sha256();
    const result = await normalizeMain({ SEED_STATE: d1.persistTo }, ["--plan-only", "--out", join(dir, "out")], d1.wrangler);
    assert.equal(result.status, 0, result.out);
    const answer = JSON.parse(result.out);
    assert.equal(answer.command, "normalize:source-text");
    assert.deepEqual(answer.counts, {
      records: { added: 0, changed: 3, removed: 0 },
      written: { sense_gloss: 2 },
      deleted: { lookup_form: 1, grammar_claim: 1 },
    });
    assert.deepEqual(
      [answer.reports.headwordLeads.changed, answer.reports.glosses.changed, answer.reports.forms.forms],
      [1, 2, 1],
      "the ordinal rule reads vado's gloss as the lead rule leaves it",
    );
    assert.deepEqual(answer.limitBreaches, ["changes or removes 3 of 4 records, more than 5%"]);
    assert.equal(d1.sha256(), before);
    assert.deepEqual(writes(d1), []);
  });
});

test("normalize:source-text applies every rule as one file in one step, and a second run finds nothing", async () => {
  await withLocalD1(beforeTheRules, async (d1, dir) => {
    const result = await normalizeMain({ SEED_STATE: d1.persistTo }, ["--out", join(dir, "out")], d1.wrangler);
    assert.equal(result.status, 0, result.out);
    assert.equal(writes(d1).length, 1, "one file");
    assert.ok(d1.calls.every((call) => call[0] === "--file" || /^\s*SELECT\s/i.test(call[2])), "every other call reads");
    const db = d1.open();
    try {
      assert.deepEqual(glosses(db), [VADO_STORED, FATE_STORED, "mammifero domestico", "chi dipinge"]);
      assert.equal((db.prepare("SELECT count(*) AS n FROM lookup_form WHERE surface = ?").get(PLURAL_PLACEHOLDER_FORM) as { n: number }).n, 0);
    } finally {
      db.close();
    }

    const settled = d1.sha256();
    const again = JSON.parse((await normalizeMain({ SEED_STATE: d1.persistTo }, ["--plan-only", "--out", join(dir, "out")], d1.wrangler)).out);
    assert.deepEqual(again.counts, { records: { added: 0, changed: 0, removed: 0 }, written: {}, deleted: {} });
    assert.equal(again.sql, null);
    assert.equal(d1.sha256(), settled);
  });
});
