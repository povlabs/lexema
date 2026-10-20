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
import { accentlessProbe, accentlessSpelling, openedHeadword, plainFinalVowel, variantNamed } from "../src/italian/finalAccent.js";
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
  assert.equal(accentlessProbe("caffé"), "caffe", "a final vowel with the wrong mark is probed too (#900)");
  assert.equal(accentlessProbe("pò"), "po");
  assert.equal(accentlessProbe("bar"), undefined, "ends in no vowel");
  assert.equal(accentlessProbe("citta'"), undefined, "ends in an apostrophe");
  assert.equal(accentlessProbe("vado via"), undefined, "two words");
});

test("a plain final vowel takes any mark off the final vowel, and keeps a key that ends in a plain one", () => {
  assert.equal(plainFinalVowel("perché"), "perche");
  assert.equal(plainFinalVowel("perchè"), "perche");
  assert.equal(plainFinalVowel("perche"), "perche");
  assert.equal(plainFinalVowel("é"), "e");
  assert.equal(plainFinalVowel("ùltimà"), "ùltima", "only the final mark goes");
  assert.equal(plainFinalVowel("po'"), undefined, "ends in an apostrophe");
  assert.equal(plainFinalVowel("bar"), undefined, "ends in no vowel");
  assert.equal(plainFinalVowel("caffè latte"), undefined, "two words");
});

/** Headword keys with no variant link. */
const plain = (...keys: string[]) => keys.map((key) => ({ key, variantOf: [] }));

test("a query opens the one headword it lacks or mis-marks the final accent of, and none when two are with no variant link or none is", () => {
  assert.equal(openedHeadword("perche", plain("perché")), "perché");
  assert.equal(openedHeadword("piu", plain("più", "piú")), undefined, "two headwords share it, and neither is the other's variant");
  assert.equal(openedHeadword("perchè", plain("perché")), "perché", "a wrong final mark opens the headword with the right one (#900)");
  assert.equal(openedHeadword("caffé", plain("caffè")), "caffè");
  assert.equal(openedHeadword("é", plain("è", "e")), "è", "a headword with no final accent is no match");
  assert.equal(openedHeadword("perché", plain("perché")), undefined, "a query never opens itself");
  assert.equal(openedHeadword("perchè", plain("perché", "perchè")), "perché", "nor counts itself as a match");
  assert.equal(openedHeadword("pò", plain("po'", "po")), undefined, "an accent for an apostrophe, or on a word that has none, is not a wrong mark");
  assert.equal(openedHeadword("citta'", plain("città")), undefined, "an apostrophe for an accent opens none");
  assert.equal(openedHeadword("càffe", plain("caffè")), undefined, "an accent inside the word must match");
  assert.equal(openedHeadword("caffe", plain("caffè", "càffe")), "caffè", "an accent inside the word is not the final accent");
  assert.equal(openedHeadword("perche", []), undefined);
});

test("of several headwords a query lacks the final accent of, it opens the main word the others are recorded as variants of (#846)", () => {
  const piu = [
    { key: "più", variantOf: [] },
    { key: "piú", variantOf: ["più"] },
  ];
  assert.equal(openedHeadword("piu", piu), "più", "piú is a variant of più");
  assert.equal(openedHeadword("piu", [...piu].reverse()), "più", "whatever the order");
  assert.equal(
    openedHeadword("piu", [
      { key: "più", variantOf: ["piú"] },
      { key: "piú", variantOf: ["più"] },
    ]),
    undefined,
    "each recorded as the other's variant settles nothing",
  );
  assert.equal(openedHeadword("piu", [...piu, { key: "piû", variantOf: [] }]), undefined, "a third match that is no variant of più settles nothing");
  assert.equal(openedHeadword("piu", [...piu, { key: "piû", variantOf: ["più"] }]), "più", "every other match a variant of più");
  assert.equal(openedHeadword("piu", [{ key: "più", variantOf: [] }, { key: "più", variantOf: [] }, { key: "piú", variantOf: ["più"] }]), "più", "two rows of one headword are one match");
  assert.equal(openedHeadword("piu", [{ key: "più", variantOf: [] }, { key: "piú", variantOf: ["poco"] }]), undefined, "a variant of a word that is no match settles nothing");
});

test("a gloss records its headword a variant of the word it names after di, when it opens with variante", () => {
  assert.equal(variantNamed("variante ricercata di più"), "più");
  assert.equal(variantNamed("Variante grafica di Valigie"), "valigie");
  assert.equal(variantNamed("variante di uguaglianza"), "uguaglianza");
  assert.equal(variantNamed("forma tronca di poco"), undefined, "no variant");
  assert.equal(variantNamed("in maggior quantità"), undefined);
  assert.equal(variantNamed("variante"), undefined, "names no word");
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
// a final accent of, and fixtures/se-reflexive.jsonl holds se (21877 and
// 21878) and sé (120512 and 120513), added for #900.
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

// Huey's ruling of 2026-10-20 (https://github.com/povlabs/lexema/issues/900#issuecomment-6286828410):
// a final vowel typed with the wrong mark opens the headword with the right
// one, under the #846 guards. perché is lines 33262 to 33264, caffè 2886, sé
// 120512 and 120513, città 31998 and è 2673.
test("a word typed with the wrong mark on its final vowel opens the headword with the right one, with that headword's own readings (#900)", async () => {
  await withBareSpellings(async (db) => {
    for (const [query, headword] of [
      ["perchè", "perché"],
      ["caffé", "caffè"],
      ["sè", "sé"],
      ["cittá", "città"],
      ["é", "è"],
      ["Perchè", "perché"],
    ] as const) {
      const opened = await found(db, query);
      assert.deepEqual(opened.route, { kind: "accentless", headword }, `${query} opens ${headword}`);
      assert.equal(opened.query.raw, query, "the query stays as typed");
      assert.deepEqual(opened.readings, (await found(db, headword)).readings, `${query} answers with ${headword}'s own readings`);
      const present = await exists({ db, releaseId: RELEASE, query });
      assert.ok(present.outcome === "present" && present.word === headword, `${query}: exists() credits ${headword}`);
    }
    await assertAgree(db, ["perchè", "caffé", "sè", "cittá", "é", "se", "sé", "e", "è", "perche", "perché", "pò", "po'"]);
  }, "fixtures/se-reflexive.jsonl");
});

test("se, e and perche keep their answers beside the wrong-mark step (#846, #900)", async () => {
  await withBareSpellings(async (db) => {
    const se = await found(db, "se");
    assert.equal(se.route.kind, "surface");
    assert.deepEqual([...new Set(se.readings.map((reading) => reading.word))], ["se"], "never sé");
    const e = await found(db, "e");
    assert.equal(e.route.kind, "surface");
    assert.deepEqual(e.readings.map((reading) => `${reading.word} ${reading.pos}`), ["e conj", "e character"], "never è");
    assert.deepEqual((await found(db, "perche")).route, { kind: "accentless", headword: "perché" });
  }, "fixtures/se-reflexive.jsonl");
});

test("an accent for an apostrophe, an apostrophe for an accent, or a final apostrophe left off stays not found and offers the written word (#468, #846, #900)", async () => {
  await withBareSpellings(async (db) => {
    // The apostrophe case: before #468, `dall` led with `dalla`, one edit away.
    const dall = await search(db, "dall");
    assert.ok(!dall.found && dall.nearby.kind === "accent", "dall is not found and offers a spelling with the same letters");
    assert.equal(bareSpellingOutcome("dall'", dall), "best", "dall offers dall' first");
    assert.equal((await lookup({ db, releaseId: RELEASE, query: "citta'" })).outcome, "not-found", "an accent written as an apostrophe opens nothing");
    // pò for po' is #901's to open; until then it stays the not-found offer.
    const po = await search(db, "pò");
    assert.ok(!po.found && po.nearby.kind === "accent", "pò is not found and offers a spelling with the same letters");
    assert.notEqual(bareSpellingOutcome("po'", po), "missed", "pò offers po'");
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

// Huey's tie-break (https://github.com/povlabs/lexema/issues/846#issuecomment-6240679313):
// piú's only sense (line 125475) reads "variante ricercata di più".
test("piu opens più where piú, the other headword it lacks a final accent of, is recorded as più's variant (#846)", async () => {
  await withBareSpellings(async (db) => {
    const piu = await found(db, "piu");
    assert.deepEqual(piu.route, { kind: "accentless", headword: "più" });
    assert.deepEqual(piu.readings, (await found(db, "più")).readings, "piu answers with più's own readings");
    const present = await exists({ db, releaseId: RELEASE, query: "piu" });
    assert.ok(present.outcome === "present" && present.word === "più", "exists() credits più");
    assert.equal(bareSpellingOutcome("più", await search(db, "piu")), "opened");
    assert.equal(bareSpellingOutcome("piú", await search(db, "piu")), "found", "piu opens another word than piú");
    await assertAgree(db, ["piu", "più", "piú", "perche", "papa", "e"]);
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
