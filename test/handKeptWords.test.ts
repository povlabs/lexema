// Words Italian Wiktionary lacks, found through their hand-kept readings
// (#819, ADR 0031): `sig.` and `Sig.` open `Sig.`, `cosette` reaches the noun
// `cosetta` as its regular plural, and `cosetta` shows that noun beside the
// proper name `Cosetta`. `dr.` keeps the `Dr.` record it opens today. Inputs
// are verbatim (fixtures/hand-kept-readings/PROVENANCE.md): line 36245
// `Cosetta` of it-0c432803 and line 801536 `Dr.` of it-78385b62, seeded with
// the committed list `HAND_KEPT_READINGS`. #915 adds the forty common words of
// the 2026-10-20 recount, the plurals barrette and scartoffie that reach two of
// them, and lines 1654 `società` and 47726 `attività` of it-0c432803, which
// `societa'` and `attivita'` open.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { seedSql } from "../src/import/seedSql.js";
import { HAND_KEPT_READINGS, handKeptId, type HandKeptReading } from "../src/italian/handKeptReadings.js";
import { lookupBatch, type CandidateRecord } from "../src/lookup/batch.js";
import { fromNodeSqlite, type LookupDatabase } from "../src/lookup/database.js";
import { exists, lookup } from "../src/lookup/lookup.js";
import { entryKey, type FoundResult, type Reading } from "../src/lookup/types.js";

const RELEASE = "it-hand-kept-words";
const LINES = resolve("fixtures/hand-kept-readings/lookup-lines.jsonl");

let dir: string;
let sqlite: DatabaseSync;
let db: LookupDatabase;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "lexema-hand-kept-words-"));
  const archive = join(dir, "archive.jsonl.gz");
  await writeFile(archive, gzipSync(await readFile(LINES)));
  const { parts } = await seedSql({
    input: archive,
    outputDir: join(dir, "sql"),
    schema: "src/db/schema.sql",
    releaseId: RELEASE,
    license: "CC-BY-SA-4.0",
    onRejection: (rejection) => {
      throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
    },
  });
  sqlite = new DatabaseSync(":memory:");
  for (const part of parts) sqlite.exec(await readFile(part, "utf8"));
  db = fromNodeSqlite(sqlite);
});

after(async () => {
  sqlite.close();
  await rm(dir, { recursive: true, force: true });
});

async function found(query: string): Promise<FoundResult> {
  const result = await lookup({ db, releaseId: RELEASE, query });
  assert.equal(result.outcome, "found", `${query} is found`);
  return result as FoundResult;
}

/** A reading as a page tells it apart: its identity, word, part of speech and definitions' text. */
const shown = (reading: Reading) => [
  reading.recordId === undefined ? entryKey(reading) : "record",
  reading.word,
  reading.posTitle,
  [...reading.senses.flatMap((sense) => sense.glosses.map((gloss) => gloss.text)), ...reading.recovered.map((definition) => definition.text)],
];

const candidateKey = (record: CandidateRecord): string =>
  record.recordId !== undefined ? `record ${record.word}` : record.handKeptId !== undefined ? `kept-${record.handKeptId}` : `page-${record.entryId}`;

test("sig. and Sig. find the hand-kept abbreviation Sig. through lookup(), lookupBatch and exists() (#819)", async () => {
  const queries = ["sig.", "Sig.", "SIG."];
  for (const query of queries) {
    const result = await found(query);
    assert.deepEqual(result.readings.map(shown), [["kept-Sig.:abbrev", "Sig.", "Acronimo / Abbreviazione", ["abbreviazione di signore"]]], query);
    assert.equal((await exists({ db, releaseId: RELEASE, query })).outcome, "present", query);
  }
  const { answers } = await lookupBatch({ db, releaseId: RELEASE, queries });
  for (const [at, query] of queries.entries()) {
    const answer = answers[at];
    assert.ok(answer.outcome === "found", query);
    assert.deepEqual(answer.candidates.map(candidateKey), ["kept-Sig.:abbrev"], query);
  }
});

test("cosette finds the noun cosetta as its plural; cosetta shows the noun and the proper name Cosetta (#819)", async () => {
  const cosette = await found("cosette");
  assert.equal(cosette.route.kind, "shape");
  assert.deepEqual(cosette.route.kind === "shape" ? cosette.route.spellings.map(({ shape, key }) => `${shape}:${key}`) : [], ["inflected:cosetta"]);
  assert.deepEqual(cosette.readings.map(shown), [["kept-cosetta:noun", "cosetta", "Sostantivo", ["cosa piccola o di poco conto"]]]);

  const cosetta = await found("cosetta");
  assert.deepEqual(cosetta.readings.map(shown), [
    ["record", "Cosetta", "Nome proprio", ["nome proprio di persona femminile"]],
    ["kept-cosetta:noun", "cosetta", "Sostantivo", ["cosa piccola o di poco conto"]],
  ]);

  const queries = ["cosette", "cosetta"];
  const { answers } = await lookupBatch({ db, releaseId: RELEASE, queries });
  assert.deepEqual(answers.map((answer) => (answer.outcome === "found" ? answer.candidates.map(candidateKey) : [])), [
    ["kept-cosetta:noun"],
    ["record Cosetta", "kept-cosetta:noun"],
  ]);
  for (const query of queries) assert.equal((await exists({ db, releaseId: RELEASE, query })).outcome, "present", query);
});

test("dr. keeps its answer, the Dr. record, and mr., p. and n. stay not found (#819)", async () => {
  const dr = await found("dr.");
  assert.deepEqual(dr.readings.map(shown), [["record", "Dr.", "Acronimo / Abbreviazione", ["variante di Dott."]]]);
  for (const query of ["mr.", "p.", "n."]) {
    assert.equal((await lookup({ db, releaseId: RELEASE, query })).outcome, "not-found", query);
  }
});

/** The words #915 gives a reading, each the reading its own word opens. */
const RECOUNT_WORDS = [
  "glielo", "gliel'", "gliela", "glieli", "gliele", "gliene",
  "stanotte", "stavolta", "city", "sottofondo", "eccome", "quaggiù", "quassù", "piccolino", "granché", "sottufficiale", "dopodiché",
  "studentesco", "cordone", "bigliettino", "camicetta", "orsetto", "barretta", "prematrimoniale", "quantomeno", "caposquadra",
  "minorile", "paranormale", "piacimento", "avvistamento", "domattina", "oddio", "paralimpico",
  "ehi", "evviva", "mah",
  "scartoffia", "portabagagli", "rilevatore", "cesareo",
];

const keptReadingOf = (word: string): HandKeptReading => {
  const reading = HAND_KEPT_READINGS.find((one) => one.word === word);
  assert.ok(reading, word);
  return reading;
};

/** The one reading a page of `word` shows: its hand-kept reading, as the list keeps it. */
const keptShown = (word: string) => {
  const reading = keptReadingOf(word);
  return [`kept-${handKeptId(reading)}`, reading.word, reading.partOfSpeech.posTitle, reading.definitions.map(({ text }) => text)];
};

test("each common word of the 2026-10-20 recount finds its hand-kept reading through lookup(), lookupBatch and exists() (#915)", async () => {
  // A plural reaches its noun as cosette reaches cosetta: barrette, and
  // scartoffie, which en.wiktionary gives only as scartoffia's plural.
  const plurals: [string, string][] = [["barrette", "barretta"], ["scartoffie", "scartoffia"]];
  const queries: [string, string][] = [...RECOUNT_WORDS.map((word): [string, string] => [word, word]), ...plurals, ["Ehi", "ehi"], ["gliel’", "gliel'"]];
  for (const [query, word] of queries) {
    const result = await found(query);
    assert.deepEqual(result.readings.map(shown), [keptShown(word)], query);
    assert.equal((await exists({ db, releaseId: RELEASE, query })).outcome, "present", query);
  }
  for (const [query, word] of plurals) {
    const { route } = await found(query);
    assert.deepEqual(route.kind === "shape" ? route.spellings.map(({ shape, key }) => `${shape}:${key}`) : route, [`inflected:${word}`], query);
  }
  const { answers } = await lookupBatch({ db, releaseId: RELEASE, queries: queries.map(([query]) => query) });
  for (const [at, [query, word]] of queries.entries()) {
    const answer = answers[at];
    assert.ok(answer.outcome === "found", query);
    assert.deepEqual(answer.candidates.map(candidateKey), [`kept-${handKeptId(keptReadingOf(word))}`], query);
  }
});

test("uh and superman, which en.wiktionary gives no Italian sense line, stay not found (#915)", async () => {
  for (const query of ["uh", "superman"]) {
    assert.equal((await lookup({ db, releaseId: RELEASE, query })).outcome, "not-found", query);
    assert.equal((await exists({ db, releaseId: RELEASE, query })).outcome, "absent", query);
  }
});

test("societa' opens società and attivita' opens attività: an apostrophe written for the accent (#915, #900)", async () => {
  for (const [query, headword] of [["societa'", "società"], ["attivita'", "attività"]]) {
    const result = await found(query);
    assert.deepEqual(result.route, { kind: "accentless", headword }, query);
    assert.deepEqual(result.readings.map((reading) => [reading.word, reading.posTitle]), [[headword, "Sostantivo"]], query);
  }
});
