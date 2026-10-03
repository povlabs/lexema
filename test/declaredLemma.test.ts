// A declared lemma (#453): a word no record heads, that form-of records name.
// The archive is fixtures/declared-lemmas.jsonl, real lines of it-0c432803,
// plus three made-up lines for the hidden case: a Spanish verb that lists an
// Italian-tagged gerund, so `form-of-foreign-lemma/v1` hides that gerund, and
// one Italian form of the same verb it does not hide.

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, before, test } from "node:test";
import { gzipSync } from "node:zlib";
import { seedSql } from "../src/import/seedSql.js";
import { fromNodeSqlite } from "../src/lookup/database.js";
import { DECLARED_LEMMA_GENDER_SQL, DECLARED_LEMMA_SQL, declaredLemma } from "../src/lookup/declaredLemma.js";
import { exists, lookup } from "../src/lookup/lookup.js";
import { lookupBatch } from "../src/lookup/batch.js";
import type { DeclaredLemmaResult, NotFoundResult } from "../src/lookup/types.js";

const RELEASE = "it-declared-test";

const verb = (word: string, gloss: string, lemma: string): string =>
  JSON.stringify({ word, lang_code: "it", lang: "Italiano", pos: "verb", pos_title: "Voce verbale", senses: [{ glosses: [gloss], tags: ["form-of"], form_of: [{ word: lemma }] }], tags: ["form-of"] });

const HIDDEN_CASE = [
  JSON.stringify({ word: "zapatear", lang_code: "es", lang: "Spagnolo", pos: "verb", pos_title: "Verbo", senses: [{ glosses: ["battere i piedi"] }], forms: [{ form: "zapateando", tags: ["gerund"] }] }),
  verb("zapateando", "gerundio di zapatear", "zapatear"),
  verb("zapateo", "prima persona singolare dell'indicativo presente di zapatear", "zapatear"),
];

const FIXTURE_LINES = (await readFile("fixtures/declared-lemmas.jsonl", "utf8")).trimEnd().split("\n");
const LINES = [...FIXTURE_LINES, ...HIDDEN_CASE];
const lineOf = (word: string, pos = "verb"): number =>
  LINES.findIndex((line) => {
    const record = JSON.parse(line) as { word: string; pos: string; lang_code: string };
    return record.word === word && record.pos === pos && record.lang_code === "it";
  }) + 1;

let dir: string;
let sqlite: DatabaseSync;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "lexema-declared-"));
  const archive = join(dir, "archive.jsonl.gz");
  await writeFile(archive, gzipSync(`${LINES.join("\n")}\n`));
  const { parts } = await seedSql({ input: archive, outputDir: join(dir, "sql"), schema: "src/db/schema.sql", releaseId: RELEASE });
  sqlite = new DatabaseSync(":memory:");
  for (const part of parts) sqlite.exec(await readFile(part, "utf8"));
  sqlite.exec("PRAGMA query_only = ON");
});

after(async () => {
  sqlite.close();
  await rm(dir, { recursive: true, force: true });
});

async function notFound(query: string): Promise<NotFoundResult> {
  const result = await lookup({ db: fromNodeSqlite(sqlite), releaseId: RELEASE, query });
  assert.ok(result.outcome === "not-found", `${query}: ${result.outcome}`);
  return result;
}

async function declared(query: string): Promise<DeclaredLemmaResult | undefined> {
  return declaredLemma(fromNodeSqlite(sqlite), RELEASE, await notFound(query));
}

test("the lookup and the developer API still find no lemma no record heads: the probe is the page's alone", async () => {
  const db = fromNodeSqlite(sqlite);
  for (const query of ["verbalizzare", "videoregistrare", "aggrapparsi", "fratellino", "calabro"]) {
    await notFound(query);
    assert.equal((await exists({ db, releaseId: RELEASE, query })).outcome, "absent", query);
  }
  const batch = await lookupBatch({ db, releaseId: RELEASE, queries: ["verbalizzare", "verbalizzo"] });
  assert.deepEqual(batch.answers.map((answer) => answer.outcome), ["not-found", "found"]);
});

test("a verb lemma's forms are its declaring records, each where its gloss puts it, pointing at the record's own line", async () => {
  const result = await declared("verbalizzare");
  assert.ok(result !== undefined);
  assert.deepEqual(result.readings.map(({ pos, posTitle, word }) => ({ pos, posTitle, word })), [
    { pos: "verb", posTitle: "Verbo", word: "verbalizzare" },
  ]);
  const [reading] = result.readings;
  assert.ok(reading.pos === "verb");
  const verbalizzo = reading.forms.find((form) => form.surface === "verbalizzo");
  assert.deepEqual(verbalizzo, {
    surface: "verbalizzo",
    ref: { releaseId: RELEASE, lineNo: lineOf("verbalizzo"), jsonPointer: "/word", lineSha256: verbalizzo?.ref.lineSha256 },
    gloss: {
      text: "prima persona singolare dell'indicativo presente di verbalizzare",
      ref: { releaseId: RELEASE, lineNo: lineOf("verbalizzo"), jsonPointer: "/senses/0/glosses/0", lineSha256: verbalizzo?.ref.lineSha256 },
    },
    slot: { kind: "finite", tense: "presente", person: "first", number: "singular" },
  });
  // The line's digest is the archive line's, so the ref can be checked against it.
  const stored = sqlite.prepare("SELECT line_sha256 FROM source_record WHERE release_id = ? AND line_no = ?").get(RELEASE, lineOf("verbalizzo"));
  assert.equal(verbalizzo?.ref.lineSha256, (stored as { line_sha256: string }).line_sha256);
  // `verbalizzi` names five slots on five senses: five forms, each with its own gloss.
  assert.deepEqual(
    reading.forms.filter((form) => form.surface === "verbalizzi").map((form) => form.gloss.ref.jsonPointer),
    ["/senses/0/glosses/0", "/senses/1/glosses/0", "/senses/2/glosses/0", "/senses/3/glosses/0", "/senses/4/glosses/0"],
  );
});

test("a gloss the rule refuses gives no form; one naming the verb as half of a pair gives one", async () => {
  const lussare = await declared("lussare");
  assert.ok(lussare !== undefined);
  assert.deepEqual(lussare.readings.flatMap((reading) => reading.forms.map((form) => form.surface)), ["lussando"]);
  // `aggrappato` names `aggrapparsi` as the second of a pair.
  const aggrapparsi = await declared("aggrapparsi");
  assert.deepEqual(aggrapparsi?.readings.flatMap((reading) => reading.forms.map((form) => form.surface)), ["aggrappato"]);
});

test("nouns and adjectives take their forms from the plural gloss; two parts of speech are two readings, in source order", async () => {
  const fratellino = await declared("fratellino");
  assert.ok(fratellino !== undefined);
  const [noun] = fratellino.readings;
  assert.ok(noun.pos === "noun");
  assert.deepEqual(noun.forms.map((form) => [form.surface, form.plural.glossGender, form.plural.recordGenders.map((claim) => claim.value)]), [
    ["fratellini", undefined, ["masculine"]],
  ]);
  const calabro = await declared("calabro");
  assert.deepEqual(
    calabro?.readings.map((reading) => [reading.posTitle, reading.forms.map((form) => form.surface)]),
    [
      ["Aggettivo", ["calabre", "calabri"]],
      ["Sostantivo", ["calabre", "calabri"]],
    ],
  );
});

test("a word no edge names is no declared lemma", async () => {
  assert.equal(await declared("parolanessuna"), undefined);
});

test("a hidden declaring record gives no form: its edges are not served", async () => {
  const hidden = sqlite.prepare("SELECT r.word FROM hidden_record h JOIN source_record r ON r.record_id = h.record_id").all();
  assert.deepEqual(hidden.map((row) => ({ ...row })), [{ word: "zapateando" }]);
  const result = await declared("zapatear");
  assert.deepEqual(result?.readings.flatMap((reading) => reading.forms.map((form) => form.surface)), ["zapateo"]);
});

test("both probes read form_of_edge_by_target on its whole key, and walk no table", () => {
  for (const [name, sql] of [["DECLARED_LEMMA_SQL", DECLARED_LEMMA_SQL], ["DECLARED_LEMMA_GENDER_SQL", DECLARED_LEMMA_GENDER_SQL]]) {
    const plan = (sqlite.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(RELEASE, "verbalizzare") as { detail: string }[]).map((row) => row.detail);
    // The first step; `served_release`'s own steps follow it, under its aliases.
    assert.equal(plan[0], "SEARCH e USING INDEX form_of_edge_by_target (release_id=? AND target_word_key=?)", name);
    assert.ok(plan.includes("SEARCH d USING INTEGER PRIMARY KEY (rowid=?)"), `${name}: ${plan.join(" | ")}`);
    assert.deepEqual(plan.filter((step) => /^SCAN (e|d|s|g|c)$/.test(step)), [], name);
  }
});
