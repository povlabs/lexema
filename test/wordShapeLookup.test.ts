// A form the source lists nowhere, read by rule `it-word-shape/v1` as a
// shape of a word the dictionary has (#809): `quei` and `quegli` of quello,
// `raccontarvi` of raccontare, `dammi` of dare, `aver` of avere. Real words
// from the missing-word count (reports/2026-10-11-missing-common-words.md),
// over the development fixture with its raw pages and page-only entries,
// seeded the way `pnpm run seed:dev` seeds D1, and the release lines of
// `fixtures/word-shapes.jsonl`: dare (lines 2340 and 2341), mi (12704),
// piacere (33110), quello (33211 and 33212) and bravo (70242) of release
// it-0c432803, none of which the development fixture has. `raccontare` is a
// page-only entry there, read from `fixtures/upstream-pages/raccontare.wikitext`.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { seedSql } from "../src/import/seedSql.js";
import { PageOnlyCandidates, readUnrecordedPageTitles, UNRECORDED_PAGE_TITLES_FILE } from "../src/import/pageOnlyCandidates.js";
import { lookupBatch, type CandidateRecord } from "../src/lookup/batch.js";
import { fromNodeSqlite, type DictionaryRead, type LookupDatabase, type SqlValue } from "../src/lookup/database.js";
import { SHAPE_READ_SQL } from "../src/lookup/wordShape.js";
import { exists, lookup } from "../src/lookup/lookup.js";
import { entryKey, isFormOfReading, lemmasOfPartOfSpeech, type FoundResult } from "../src/lookup/types.js";
import { loadFixturePages } from "../src/source/rawPage.js";

const RELEASE = "it-word-shape-test";

let dir: string;
let sqlite: DatabaseSync;
let db: LookupDatabase;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "lexema-word-shape-"));
  const archive = join(dir, "archive.jsonl.gz");
  const lines = `${(await readFile("fixtures/dev-seed.jsonl", "utf8")).trimEnd()}\n${await readFile("fixtures/word-shapes.jsonl", "utf8")}`;
  await writeFile(archive, gzipSync(lines));
  const { parts } = await seedSql({
    input: archive,
    outputDir: join(dir, "sql"),
    schema: "src/db/schema.sql",
    releaseId: RELEASE,
    archiveR2Key: `releases/${RELEASE}.jsonl.gz`,
    license: "CC-BY-SA-4.0",
    rawPages: await loadFixturePages(resolve("fixtures")),
    pageOnly: PageOnlyCandidates.listed(await readUnrecordedPageTitles(resolve(UNRECORDED_PAGE_TITLES_FILE))),
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

/** The spellings that answered, as `shape:key`. */
const spellingsOf = (result: FoundResult): string[] => (result.route.kind === "shape" ? result.route.spellings.map(({ shape, key }) => `${shape}:${key}`) : []);

/** Each reading as `word pos`, marked `(table)` when the query reached it only through its table. */
const readingsOf = (result: FoundResult): string[] =>
  result.readings.map((reading) => `${reading.word} ${reading.pos}${reading.isAboutQuery ? "" : " (table)"}`);

/** A batch candidate named as `entryKey` names an entry. */
const candidateKey = (record: CandidateRecord): string =>
  record.recordId !== undefined ? String(record.recordId) : record.entryId !== undefined ? `page-${record.entryId}` : `kept-${record.handKeptId}`;

/** The entries `/v1/lookup` answers with, as `candidatesOf` (web/worker/api/lookupAnswer.ts) makes them. */
const candidateKeys = (result: FoundResult): string[] => [
  ...new Set(
    result.readings.flatMap((reading) => {
      const lemmas = isFormOfReading(reading) ? lemmasOfPartOfSpeech(reading.pos, reading.lemmaLinks) : [];
      return lemmas.length === 0 ? [entryKey(reading)] : lemmas.map(entryKey);
    }),
  ),
];

test("quei and quegli find quello, the demonstrative adjective, and nothing else (#809)", async () => {
  for (const query of ["quei", "quegli", "Quei"]) {
    const result = await found(query);
    assert.deepEqual(spellingsOf(result), ["demonstrative:quello"], query);
    assert.deepEqual(readingsOf(result), ["quello adj"], query);
  }
});

test("raccontarvi finds raccontare, a page-only entry, and so do its other clitic forms (#809)", async () => {
  for (const query of ["raccontarvi", "raccontarmi", "raccontarlo"]) {
    const result = await found(query);
    assert.deepEqual(spellingsOf(result), ["clitic:raccontare"], query);
    assert.deepEqual(readingsOf(result), ["raccontare verb"], query);
    assert.ok(result.readings[0].entryId !== undefined, `${query}: raccontare is the page-only entry`);
  }
});

test("a verb with clitics finds its verb: dammi dare, dirlo dire, fammi fare, vederti vedere (#809)", async () => {
  const dammi = await found("dammi");
  assert.deepEqual(spellingsOf(dammi), ["clitic:da'"]);
  assert.deepEqual([...new Set(readingsOf(dammi))], ["dare verb (table)"]);
  assert.deepEqual(spellingsOf(await found("dirlo")), ["clitic:dire"]);
  assert.deepEqual(readingsOf(await found("dirlo")), ["dire verb"]);
  assert.deepEqual(spellingsOf(await found("vederti")), ["clitic:vedere"]);
  assert.ok(readingsOf(await found("fammi")).some((reading) => reading.startsWith("fare verb")), "fammi is fa' of fare");
});

test("an elided, a truncated and a superlative form find their word; a plural never answers: quell', bell', m', aver, far, bravissimo (#809)", async () => {
  const quell = await found("quell'");
  // quello's table lists quella, which elides too, and quelle, a plural, which does not.
  assert.deepEqual(spellingsOf(quell), ["elided:quello", "elided:quella"]);
  assert.deepEqual(readingsOf(quell), ["quello adj", "quello pron"]);
  assert.ok(readingsOf(await found("bell'")).includes("bello adj"));
  assert.ok(!readingsOf(await found("bell'")).includes("belle adj"), "belle is a plural, no elision");
  assert.deepEqual(readingsOf(await found("m'")), ["mi pron"]);
  assert.deepEqual(spellingsOf(await found("aver")), ["truncated:avere"]);
  assert.deepEqual(spellingsOf(await found("far")), ["truncated:fare"]);
  const bravissimo = await found("bravissimo");
  assert.deepEqual(spellingsOf(bravissimo), ["superlative:bravo"]);
  assert.deepEqual(readingsOf(bravissimo), ["bravo adj"]);
});

test("piaciute finds piacere through the past participle its table lists only as piaciuto (#809)", async () => {
  const result = await found("piaciute");
  assert.deepEqual(spellingsOf(result), ["participle:piaciuto"]);
  assert.deepEqual(readingsOf(result), ["piacere verb (table)"]);
});

test("the batch answers every shaped word with the records /v1/lookup answers it with, and exists() agrees (#809)", async () => {
  const words = ["quei", "quegli", "raccontarvi", "dammi", "dirlo", "fammi", "quell'", "bell'", "m'", "aver", "far", "bravissimo", "piaciute", "qqqqqq", "citta'"];
  const { answers } = await lookupBatch({ db, releaseId: RELEASE, queries: words });
  for (const [at, word] of words.entries()) {
    const single = await lookup({ db, releaseId: RELEASE, query: word });
    const answer = answers[at];
    const batch = answer.outcome === "found" ? answer.candidates.map(candidateKey) : [];
    assert.deepEqual(batch, single.outcome === "found" ? candidateKeys(single) : [], word);
    const present = await exists({ db, releaseId: RELEASE, query: word });
    assert.equal(present.outcome === "present", single.outcome === "found", word);
  }
  assert.equal(answers[words.indexOf("qqqqqq")].outcome, "not-found");
  // An accent written as an apostrophe stays the not-found page's accent offer.
  assert.equal(answers[words.indexOf("citta'")].outcome, "not-found");
});

test("a word the dictionary spells keeps its answer, and a query of none of the rule's shapes sends it no read (#809)", async () => {
  const bello = await found("bello");
  assert.equal(bello.route.kind, "surface");
  const sent: DictionaryRead[] = [];
  const recording: LookupDatabase = {
    all: <T,>(sql: DictionaryRead, params: readonly SqlValue[]) => {
      sent.push(sql);
      return db.all<T>(sql, params);
    },
  };
  for (const query of ["qqqqqq", "sono andat", "quello", "andavano"]) await lookup({ db: recording, releaseId: RELEASE, query });
  assert.ok(!sent.includes(SHAPE_READ_SQL), "no shape read");
});
