// A headword typed without its final accent or apostrophe (#468): the pure
// parts of `pnpm run measure:bare-spellings` (src/lookup/bareSpelling.ts) and
// of the accentless spelling rule (src/italian/finalAccent.ts, #846), then
// what the search answers over real archive lines.

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { gzipSync } from "node:zlib";
import { seedSql } from "../src/import/seedSql.js";
import { accentlessProbe, accentlessSpelling, openedHeadword } from "../src/italian/finalAccent.js";
import { bareSpelling, bareSpellingOutcome, type BareSpellingAnswer } from "../src/lookup/bareSpelling.js";
import { lookupBatch, type CandidateRecord } from "../src/lookup/batch.js";
import type { LookupDatabase } from "../src/lookup/database.js";
import { exists, lookup } from "../src/lookup/lookup.js";
import { findNearby, writtenSpellings } from "../src/lookup/nearby.js";
import { entryKey, isFormOfReading, lemmasOfPartOfSpeech, type FoundResult } from "../src/lookup/types.js";
import { readOnlyDictionary } from "./databases.js";

test("a bare spelling takes off a final accented vowel's accent or a final apostrophe, and nothing else", () => {
  assert.equal(bareSpelling("città"), "citta");
  assert.equal(bareSpelling("perché"), "perche");
  assert.equal(bareSpelling("abbandonò"), "abbandono");
  assert.equal(bareSpelling("po'"), "po");
  assert.equal(bareSpelling("è"), "e");
  assert.equal(bareSpelling("'"), undefined, "a lone apostrophe has no spelling left to search");
  assert.equal(bareSpelling("casa"), undefined);
  assert.equal(bareSpelling("caffè latte"), undefined, "two words");
  assert.equal(bareSpelling("çà"), "ça", "only the final mark goes");
});

test("an accentless spelling takes off a final accent only: a final apostrophe is no accent", () => {
  assert.equal(accentlessSpelling("perché"), "perche");
  assert.equal(accentlessSpelling("più"), "piu");
  assert.equal(accentlessSpelling("piú"), "piu");
  assert.equal(accentlessSpelling("è"), "e");
  assert.equal(accentlessSpelling("po'"), undefined);
  assert.equal(accentlessSpelling("casa"), undefined);
  assert.equal(accentlessSpelling("caffè latte"), undefined, "two words");
  assert.equal(accentlessProbe("perche"), "perche");
  assert.equal(accentlessProbe("ùltima"), "ultima", "probed under its letters, as accent_fold keys a headword");
  assert.equal(accentlessProbe("caffé"), undefined, "ends in no plain vowel");
  assert.equal(accentlessProbe("citta'"), undefined, "ends in an apostrophe");
  assert.equal(accentlessProbe("vado via"), undefined, "two words");
});

test("a query opens the one headword it is the accentless spelling of, and none when two are or none is", () => {
  assert.equal(openedHeadword("perche", ["perché"]), "perché");
  assert.equal(openedHeadword("piu", ["più", "piú"]), undefined, "two headwords share it");
  assert.equal(openedHeadword("perchè", ["perché"]), undefined, "a wrong accent is no accentless spelling");
  assert.equal(openedHeadword("caffe", ["caffè", "càffe"]), "caffè", "an accent inside the word is not the final accent");
  assert.equal(openedHeadword("perche", []), undefined);
});

test("the outcome is opened, found, the best offer, offered later, or not offered", () => {
  assert.equal(bareSpellingOutcome("perché", { found: true, opened: "perché" }), "opened");
  assert.equal(bareSpellingOutcome("Perché", { found: true, opened: "perché" }), "opened", "compared as keys");
  assert.equal(bareSpellingOutcome("è", { found: true }), "found");
  const accent: BareSpellingAnswer = { found: false, nearby: { kind: "accent", best: "città", others: ["cittadino"], phrases: [] } };
  assert.equal(bareSpellingOutcome("città", accent), "best");
  assert.equal(bareSpellingOutcome("cittadino", accent), "offered");
  assert.equal(bareSpellingOutcome("po’", { found: false, nearby: { kind: "accent", best: "po'", others: [], phrases: [] } }), "best", "apostrophes compare as one");
  // Words that begin with the query are a list, not a best guess.
  assert.equal(bareSpellingOutcome("be'", { found: false, nearby: { kind: "prefix", words: ["be'", "bea"] } }), "offered");
  assert.equal(bareSpellingOutcome("be'", { found: false, nearby: { kind: "none" } }), "missed");
});

// The search over real archive lines of it-0c432803, verbatim, in
// fixtures/bare-spellings.jsonl: è (line 2673), caffè (2886), e (15951 and
// 15952), po' (31245 and 31246), città (31998), abbandono (32174 and 32175),
// più (33196 to 33198), perché (33262 to 33264), dallo (37981), dalla
// (37982), dall' (37990), Po (78748) and abbandonò (141526), then, added for
// #846, papa (17770) and papà (52197). `extra` adds lines of other fixtures:
// fixtures/citto.jsonl holds citto (119981), whose table spells `citta`, and
// fixtures/piu-acute.jsonl holds piú (125475), a second headword `piu` lacks
// a final accent of.
async function withBareSpellings(run: (db: LookupDatabase) => Promise<void>, ...extra: string[]): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-bare-spellings-"));
  const archive = join(dir, "fixture.jsonl.gz");
  const lines = await Promise.all(["fixtures/bare-spellings.jsonl", ...extra].map((file) => readFile(file, "utf8")));
  await writeFile(archive, gzipSync(lines.join("")));
  const { parts } = await seedSql({
    input: archive,
    outputDir: join(dir, "sql"),
    schema: "src/db/schema.sql",
    releaseId: RELEASE,
    archiveR2Key: `releases/${RELEASE}.jsonl.gz`,
    license: "CC-BY-SA-4.0",
    onRejection: (rejection) => {
      throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
    },
  });
  const sqlite = new DatabaseSync(":memory:");
  try {
    for (const part of parts) sqlite.exec(await readFile(part, "utf8"));
    await run(readOnlyDictionary(sqlite));
  } finally {
    sqlite.close();
    await rm(dir, { recursive: true, force: true });
  }
}

const RELEASE = "it-0c432803";

async function search(db: LookupDatabase, query: string): Promise<BareSpellingAnswer> {
  const result = await lookup({ db, releaseId: RELEASE, query });
  if (result.outcome === "not-found") return { found: false, nearby: await findNearby({ db, releaseId: RELEASE, query }) };
  return result.outcome === "found" && result.route.kind === "accentless" ? { found: true, opened: result.route.headword } : { found: true };
}

async function found(db: LookupDatabase, query: string): Promise<FoundResult> {
  const result = await lookup({ db, releaseId: RELEASE, query });
  assert.equal(result.outcome, "found", `${query} is found`);
  return result as FoundResult;
}

/** A batch candidate named as `entryKey` names an entry. */
const candidateKey = (record: CandidateRecord): string => (record.recordId !== undefined ? String(record.recordId) : `page-${record.entryId}`);

/** The entries `/v1/lookup` answers with, as `candidatesOf` (web/worker/api/lookupAnswer.ts) makes them. */
const candidateKeys = (result: FoundResult): string[] => [
  ...new Set(
    result.readings.flatMap((reading) => {
      const lemmas = isFormOfReading(reading) ? lemmasOfPartOfSpeech(reading.pos, reading.lemmaLinks) : [];
      return lemmas.length === 0 ? [entryKey(reading)] : lemmas.map(entryKey);
    }),
  ),
];

/** Single lookup, batch and `exists()` answer each of `words` alike. */
async function assertAgree(db: LookupDatabase, words: readonly string[]): Promise<void> {
  const { answers } = await lookupBatch({ db, releaseId: RELEASE, queries: words });
  for (const [at, word] of words.entries()) {
    const single = await lookup({ db, releaseId: RELEASE, query: word });
    const answer = answers[at];
    const batch = answer.outcome === "found" ? answer.candidates.map(candidateKey) : [];
    assert.deepEqual(batch, single.outcome === "found" ? candidateKeys(single) : [], `${word}: the batch answers as the lookup does`);
    const present = await exists({ db, releaseId: RELEASE, query: word });
    assert.equal(present.outcome === "present", single.outcome === "found", `${word}: exists() agrees`);
  }
}

test("a word typed without its final accent opens the one headword that has it, with that headword's own readings (#846)", async () => {
  await withBareSpellings(async (db) => {
    for (const [query, headword] of [
      ["perche", "perché"],
      ["piu", "più"],
      ["citta", "città"],
      ["caffe", "caffè"],
      ["Perche", "perché"],
    ] as const) {
      const opened = await found(db, query);
      assert.deepEqual(opened.route, { kind: "accentless", headword }, `${query} opens ${headword}`);
      assert.equal(opened.query.raw, query, "the query stays as typed");
      const own = await found(db, headword);
      assert.deepEqual(opened.readings, own.readings, `${query} answers with ${headword}'s own readings`);
      assert.equal(bareSpellingOutcome(headword, await search(db, query)), "opened");
      const present = await exists({ db, releaseId: RELEASE, query });
      assert.ok(present.outcome === "present" && present.word === headword, `${query}: exists() credits ${headword}`);
    }
    await assertAgree(db, ["perche", "piu", "citta", "caffe", "papa", "e", "perchè", "caffé", "citta'", "dall", "po", "qqqq"]);
  });
});

test("a word of its own keeps its answer: papa is papa, e is the conjunction, po and abbandono are themselves (#846)", async () => {
  await withBareSpellings(async (db) => {
    const papa = await found(db, "papa");
    assert.equal(papa.route.kind, "surface");
    assert.deepEqual(papa.readings.map((reading) => reading.word), ["papa"], "never papà");
    const e = await found(db, "e");
    assert.equal(e.route.kind, "surface");
    assert.deepEqual(e.readings.map((reading) => `${reading.word} ${reading.pos}`), ["e conj", "e character"], "never è");
    for (const query of ["po", "abbandono"]) assert.equal((await found(db, query)).route.kind, "surface", query);
  });
});

test("a wrong accent, an apostrophe, or a final apostrophe left off stays not found and offers the written word first (#468, #846)", async () => {
  await withBareSpellings(async (db) => {
    for (const [query, written] of [
      ["perchè", "perché"],
      ["caffé", "caffè"],
      ["cittá", "città"],
      // The apostrophe case: before #468, `dall` led with `dalla`, one edit away.
      ["dall", "dall'"],
    ] as const) {
      const answer = await search(db, query);
      assert.ok(!answer.found && answer.nearby.kind === "accent", `${query} is not found and offers a spelling with the same letters`);
      assert.equal(bareSpellingOutcome(written, answer), "best", `${query} offers ${written} first`);
    }
    assert.equal((await lookup({ db, releaseId: RELEASE, query: "citta'" })).outcome, "not-found", "an accent written as an apostrophe opens nothing");
  });
});

test("citta keeps citto's answer where citto's table spells it, and still offers città (#478, #846)", async () => {
  await withBareSpellings(async (db) => {
    const citta = await found(db, "citta");
    assert.equal(citta.route.kind, "surface");
    assert.deepEqual(citta.readings.map((reading) => reading.word), ["citto"]);
    assert.deepEqual(await writtenSpellings({ db, releaseId: RELEASE, query: "citta" }), ["città"]);
    await assertAgree(db, ["citta"]);
  }, "fixtures/citto.jsonl");
});

test("piu opens nothing where two headwords lack it a final accent, più and piú, and offers them instead (#846)", async () => {
  await withBareSpellings(async (db) => {
    const answer = await search(db, "piu");
    assert.ok(!answer.found && answer.nearby.kind === "accent", "piu is not found and offers a spelling with the same letters");
    assert.deepEqual([answer.nearby.best, ...answer.nearby.others].sort(), ["più", "piú"]);
    await assertAgree(db, ["piu"]);
  }, "fixtures/piu-acute.jsonl");
});

// A bare spelling that is a word of its own stays found, and also carries the
// headwords that write it with a mark it lacks (#478).
test("a found word carries the headwords that add an accent or a final apostrophe, and never one that takes a mark away", async () => {
  await withBareSpellings(async (db) => {
    const written = (query: string) => writtenSpellings({ db, releaseId: RELEASE, query });
    assert.deepEqual(await written("abbandono"), ["abbandonò"], "a bare found word offers its accented headword");
    assert.deepEqual(await written("e"), ["è"], "the conjunction offers the verb form");
    assert.deepEqual(await written("po"), ["po'"], "a bare found word offers its apostrophe headword");
    assert.deepEqual(await written("Po"), ["po'"], "the query's case does not matter");
    assert.deepEqual(await written("papa"), ["papà"], "papa offers papà, and stays papa");
    assert.deepEqual(await written("abbandonò"), [], "an accented query offers no unaccented spelling");
    assert.deepEqual(await written("città"), [], "nor its own spelling");
    assert.deepEqual(await written("po'"), [], "an apostrophe query offers nothing it already has");
    assert.deepEqual(await written("dalla"), [], "a found word with no such headword offers nothing");
  });
});
