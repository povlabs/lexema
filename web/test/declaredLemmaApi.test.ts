// The developer API answers a declared lemma (#818): a word no record heads
// that form-of records name, such as `fratellino`. Huey's ruling of
// 2026-10-18 (https://github.com/povlabs/lexema/issues/818#issuecomment-6254740211):
// `/v1/lookup` and `/v1/lookup/batch` answer it with its part of speech and
// its forms, no definition, and an id built from the word and the part of
// speech, and the 16 words of class `declared-lemma-only`
// (reports/2026-10-11-missing-common-words.md) are the real-word tests.
//
// fixtures/declared-lemma-words.jsonl holds, verbatim and in archive order,
// every Italian line of it-0c432803 whose `form_of` names one of the 16
// words: 213 lines, from 2165 (`bocconcini`) to 797871. No line of the
// release heads any of the 16.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { createKey } from "../../src/api/keys.js";
import type { AppTables } from "../../src/db/app/database.js";
import { seedSql } from "../../src/import/seedSql.js";
import { lookupBatch } from "../../src/lookup/batch.js";
import type { LookupDatabase } from "../../src/lookup/database.js";
import { exists, lookup } from "../../src/lookup/lookup.js";
import type { DeclaredLemmaResult } from "../../src/lookup/types.js";
import { freshAppDatabase, readOnlyDictionary } from "../../test/databases.js";
import type { DeclaredPageReading, DeclaredTable } from "@/lib/dictionary/declaredLemmaPage.ts";
import { searchAttempt } from "@/lib/dictionary/searchAttempt.ts";
import { handleApi } from "@/worker/api/handler.ts";
import { TestMetering } from "./metering.ts";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const RELEASE = "it-declared-api-test";
const NOW = Date.parse("2026-10-18T12:00:20Z");

/** Each of the 16 words, with the part of speech of each reading the lookup answers it with, in order. */
const WORDS: readonly (readonly [string, readonly string[]])[] = [
  ["fratellino", ["noun"]],
  ["dolcetto", ["noun"]],
  ["signorino", ["noun"]],
  ["camerino", ["noun"]],
  ["collare", ["verb"]],
  ["bicchierino", ["noun"]],
  ["camioncino", ["noun"]],
  ["lettino", ["noun"]],
  ["bocconcino", ["noun"]],
  ["riconsiderare", ["verb"]],
  ["vergognare", ["verb"]],
  ["patatina", ["noun"]],
  ["patteggiare", ["verb"]],
  ["sottotenente", ["noun"]],
  ["ingelosire", ["verb"]],
  ["pentire", ["verb"]],
];

let dir: string;
let dictionarySqlite: DatabaseSync;
let dictionary: LookupDatabase;
let appSqlite: DatabaseSync;
let appDb: AppTables;
let key: string;
const metering = new TestMetering();

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "lexema-declared-api-"));
  const archive = join(dir, "declared-lemma-words.jsonl.gz");
  await writeFile(archive, gzipSync(await readFile(join(REPO, "fixtures/declared-lemma-words.jsonl"))));
  const { parts } = await seedSql({
    input: archive,
    outputDir: join(dir, "sql"),
    schema: join(REPO, "src/db/schema.sql"),
    releaseId: RELEASE,
    onRejection: (rejection) => {
      throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
    },
  });
  dictionarySqlite = new DatabaseSync(":memory:");
  for (const part of parts) dictionarySqlite.exec(await readFile(part, "utf8"));
  dictionary = readOnlyDictionary(dictionarySqlite);
  ({ sqlite: appSqlite, appDb } = freshAppDatabase());
  ({ key } = await createKey(appDb, { label: "declared", perMinuteLimit: 600 }, NOW));
});

after(async () => {
  appSqlite.close();
  dictionarySqlite.close();
  await rm(dir, { recursive: true, force: true });
});

// Loose on purpose: each test reads the fields it asserts.
type Json = any;

/** One API request's 200 body, as the Worker answers it. */
async function okBody(path: string, body?: string): Promise<Json> {
  const response = await handleApi(
    new Request(`https://api.lexema.fyi/v1/${path}`, { method: body === undefined ? "GET" : "POST", headers: { "x-api-key": key }, body }),
    { db: dictionary, appDb, releaseId: RELEASE, now: NOW, metering },
  );
  assert.equal(response.status, 200, path);
  return response.json();
}

async function declared(word: string): Promise<DeclaredLemmaResult> {
  const result = await lookup({ db: dictionary, releaseId: RELEASE, query: word });
  assert.ok(result.outcome === "declared-lemma", `${word}: ${result.outcome}`);
  return result;
}

/** Every spelling a page table shows, sorted. */
function tableSurfaces(table: DeclaredTable): string[] {
  if (table.shape === "grid") return table.grid.rows.flatMap((row) => row.cells.flatMap((cell) => cell.spellings.map((spelling) => spelling.surface))).sort();
  const { nonFinite, moods } = table.conjugation;
  return [
    ...nonFinite.flatMap((entry) => entry.forms),
    ...moods.flatMap((mood) => [...mood.simple, ...mood.compound].flatMap((tense) => tense.cells.flatMap((cell) => cell.forms))),
  ]
    .map((form) => form.surface)
    .sort();
}

/** Every spelling a result's `forms` holds, sorted. */
function formsSurfaces(forms: Json): string[] {
  const leaves = (value: Json): string[] => (Array.isArray(value) ? value : typeof value === "object" && value !== null ? Object.values(value).flatMap(leaves) : []);
  if (forms.type === "gender_number") return leaves(forms.grid).sort();
  const { type: _type, moods, ...nonFinite } = forms;
  return [...leaves(nonFinite), ...leaves(moods)].sort();
}

test("lookup() answers each of the 16 words as a declared lemma, one reading per part of speech", async () => {
  for (const [word, parts] of WORDS) {
    const result = await declared(word);
    assert.deepEqual(result.readings.map((reading) => [reading.word, reading.pos]), parts.map((pos) => [word, pos]), word);
  }
});

test("/v1/lookup answers each with its part of speech and the forms its page shows, no definition, and an id of its word and part of speech", async () => {
  for (const [word] of WORDS) {
    const result = await declared(word);
    const body = await okBody(`lookup?q=${encodeURIComponent(word)}`);
    const attempt = await searchAttempt(dictionary, RELEASE, word);
    assert.ok(attempt.outcome === "declared-lemma", `${word}: the page shows ${attempt.outcome}`);
    assert.equal(body.results.length, result.readings.length, word);
    for (const [at, reading] of result.readings.entries()) {
      const shown = body.results[at];
      assert.equal(shown.id, `${RELEASE}:declared:${reading.pos}:${word}`, word);
      assert.doesNotMatch(shown.id, /^[^:]+:\d+$/, `${word}: a record's id`);
      assert.deepEqual([shown.word, shown.pos, shown.pos_title, shown.match.surface, shown.match.via], [word, reading.pos, reading.posTitle, word, "declared_lemma"], word);
      assert.deepEqual(shown.definitions, [], word);
      // The forms are the page's own table: the same spellings, built by the same rules.
      const page: DeclaredPageReading | undefined = attempt.page.readings.find((one) => one.reading.pos === reading.pos);
      assert.ok(page !== undefined, `${word}: no ${reading.pos} table on the page`);
      assert.ok(shown.forms !== null, word);
      assert.deepEqual(formsSurfaces(shown.forms), tableSurfaces(page.table), word);
      // Credited to the first record that declares a form, in source order.
      assert.equal(shown.attribution.source_url, `https://it.wiktionary.org/wiki/${encodeURIComponent(reading.forms[0].surface)}`, word);
    }
  }
});

test("a noun's lemma sits where its plural puts it, and a verb's forms sit where their glosses do", async () => {
  const [fratellino] = (await okBody("lookup?q=fratellino")).results;
  assert.deepEqual(fratellino.match.grammar, [{ gender: "maschile", number: "singolare" }]);
  assert.deepEqual(fratellino.forms, { type: "gender_number", grid: { maschile: { singolare: ["fratellino"], plurale: ["fratellini"] } }, superlativo: null });
  const [vergognare] = (await okBody("lookup?q=vergognare&mood=indicativo&tense=presente&person=io")).results;
  assert.deepEqual(vergognare.match.grammar, []);
  assert.deepEqual(vergognare.forms, { type: "conjugation", moods: { indicativo: { presente: { io: ["vergogno"] } } } });
  // `match=form` keeps no declared lemma: it is the query itself, as `exact` keeps it.
  assert.deepEqual((await okBody("lookup?q=fratellino&match=form")).results, []);
  assert.equal((await okBody("lookup?q=fratellino&match=exact")).results.length, 1);
});

test("/v1/lookup/batch and batch lookup answer each with the same result as /v1/lookup", async () => {
  const words = WORDS.map(([word]) => word);
  const { answers } = await lookupBatch({ db: dictionary, releaseId: RELEASE, queries: words });
  const batch = await okBody("lookup/batch", JSON.stringify({ q: words }));
  let at = 0;
  for (const [index, word] of words.entries()) {
    const answer = answers[index];
    assert.ok(answer.outcome === "found", `${word}: ${answer.outcome}`);
    const looked = (await okBody(`lookup?q=${encodeURIComponent(word)}`)).results;
    assert.equal(answer.candidates.length, looked.length, word);
    for (const one of looked) {
      const light = batch.results[at++];
      assert.deepEqual(light, { query: word, found: true, id: one.id, lemma: one.word, pos: one.pos, pos_title: one.pos_title, attribution: one.attribution }, word);
    }
  }
  assert.equal(at, batch.results.length);
});

test("exists() and /v1/exists answer present for each, credited as /v1/lookup credits it", async () => {
  for (const [word] of WORDS) {
    const present = await exists({ db: dictionary, releaseId: RELEASE, query: word });
    assert.equal(present.outcome, "present", word);
    const body = await okBody(`exists?q=${encodeURIComponent(word)}`);
    assert.equal(body.exists, true, word);
    const [first] = (await okBody(`lookup?q=${encodeURIComponent(word)}`)).results;
    assert.deepEqual(body.attribution, first.attribution, word);
  }
});

test("a word the fixture's records head keeps its answer: the plural record fratellini is a headword", async () => {
  const body = await okBody("lookup?q=fratellini");
  assert.deepEqual(body.results.map((result: Json) => [result.word, result.match.via]), [["fratellini", "headword"]]);
  assert.match(body.results[0].id, /^[^:]+:\d+$/);
});
