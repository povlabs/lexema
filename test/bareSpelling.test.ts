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
import { accentlessProbe, accentlessSpelling, addedAccentOff, endingAccentOff, finalVowel, marksOpen, openedHeadword, variantNamed } from "../src/italian/finalAccent.js";
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
  assert.deepEqual(accentlessProbe("perche"), { fold: "perche", spelled: [] });
  assert.deepEqual(accentlessProbe("ùltima"), { fold: "ultima", spelled: [] }, "probed under its letters, as accent_fold keys a headword");
  assert.deepEqual(accentlessProbe("caffé"), { fold: "caffe", spelled: ["caffe'", "caffe"] }, "a final vowel with a mark is probed under an apostrophe (#900) and under none (#902) too");
  assert.deepEqual(accentlessProbe("dài"), { fold: "dai", spelled: ["dai"] }, "an accent on the vowels it ends in is probed under none (#902)");
  assert.deepEqual(accentlessProbe("pò"), { fold: "po", spelled: ["po'", "po"] });
  assert.deepEqual(accentlessProbe("ùltimà"), { fold: "ultima", spelled: ["ùltima'", "ùltima"] }, "only the final mark goes");
  assert.deepEqual(accentlessProbe("citta'"), { fold: "citta", spelled: [] }, "an apostrophe for an accent is probed under its letters (#900)");
  assert.equal(accentlessProbe("bar"), undefined, "ends in no vowel");
  assert.equal(accentlessProbe("d'"), undefined, "an apostrophe after no vowel");
  assert.equal(accentlessProbe("vado via"), undefined, "two words");
});

test("a final vowel is plain, accented, or followed by an apostrophe, and only its mark goes", () => {
  assert.deepEqual(finalVowel("perché"), { plain: "perche", mark: "accent" });
  assert.deepEqual(finalVowel("perchè"), { plain: "perche", mark: "accent" });
  assert.deepEqual(finalVowel("perche"), { plain: "perche", mark: "none" });
  assert.deepEqual(finalVowel("é"), { plain: "e", mark: "accent" });
  assert.deepEqual(finalVowel("citta'"), { plain: "citta", mark: "apostrophe" });
  assert.deepEqual(finalVowel("po'"), { plain: "po", mark: "apostrophe" });
  assert.deepEqual(finalVowel("ùltimà"), { plain: "ùltima", mark: "accent" }, "only the final mark goes");
  assert.equal(finalVowel("pò'"), undefined, "an apostrophe after an accented vowel");
  assert.equal(finalVowel("bar"), undefined, "ends in no vowel");
  assert.equal(finalVowel("caffè latte"), undefined, "two words");
});

test("a final accent opens for any mark typed on its vowel, a final apostrophe only for an accent typed in its place (#846, #900)", () => {
  const marks = ["none", "accent", "apostrophe"] as const;
  const opens = marks.flatMap((typed) => marks.filter((written) => marksOpen(typed, written)).map((written) => `${typed} → ${written}`));
  assert.deepEqual(opens, ["none → accent", "accent → accent", "accent → apostrophe", "apostrophe → accent"]);
});

test("an accent on the vowels a word ends in comes off when it is the only one there (#902)", () => {
  assert.equal(endingAccentOff("dò"), "do");
  assert.equal(endingAccentOff("dài"), "dai", "the vowels it ends in, not only the last letter");
  assert.equal(endingAccentOff("è"), "e");
  assert.equal(endingAccentOff("ùltimà"), "ùltima", "an accent before them stays");
  assert.equal(endingAccentOff("do"), undefined, "no accent");
  assert.equal(endingAccentOff("ùltima"), undefined, "no accent on the vowels it ends in");
  assert.equal(endingAccentOff("dàì"), undefined, "more than one");
  assert.equal(endingAccentOff("po'"), undefined, "ends in no vowel");
  assert.equal(endingAccentOff("bàr"), undefined);
  assert.equal(endingAccentOff("caffè latte"), undefined, "two words");
});

// Huey's ask of 2026-10-20 (https://github.com/povlabs/lexema/pull/907#issuecomment-6289786349):
// a spelled number keeps its rule-built reading, so its final accent is never
// read as one added to a plain headword.
test("a spelled number is never read as an accent added to a plain headword (#902)", () => {
  for (const key of ["centotré", "seicentotré", "trecentoquarantatré", "ventitré"]) assert.equal(addedAccentOff(key), undefined, key);
  assert.deepEqual(accentlessProbe("centotré"), { fold: "centotre", spelled: ["centotre'"] }, "centotre is never probed as a plain headword");
  assert.equal(addedAccentOff("dò"), "do");
  assert.equal(addedAccentOff("dài"), "dai");
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
  assert.equal(openedHeadword("pò", plain("po'", "po")), "po'", "an accent for an apostrophe opens the apostrophe headword, never the word with no mark (#900)");
  assert.equal(openedHeadword("citta'", plain("città")), "città", "an apostrophe for an accent opens the accented headword (#900)");
  assert.equal(openedHeadword("liberta'", plain("libertà")), "libertà");
  assert.equal(openedHeadword("po", plain("po'")), undefined, "a final apostrophe left off is no mark to open");
  assert.equal(openedHeadword("dò", plain("do")), "do", "an accent on a word that has none opens the word (#902)");
  assert.equal(openedHeadword("dài", plain("dai")), "dai");
  assert.equal(openedHeadword("sè", plain("se", "sé")), "sé", "a headword with a final mark comes before one with none");
  assert.equal(openedHeadword("é", plain("e", "è", "é")), "è", "whatever the order");
  assert.equal(openedHeadword("piú", plain("piu", "più")), "più");
  assert.equal(openedHeadword("pò", plain("po", "pò", "po'")), "po'");
  assert.equal(openedHeadword("citta'", plain("citta")), undefined, "an apostrophe on a word that has none opens nothing");
  assert.equal(openedHeadword("do", plain("do")), undefined, "a word with no mark opens no word with none");
  assert.equal(openedHeadword("càffe", plain("caffè")), undefined, "an accent inside the word must match");
  assert.equal(openedHeadword("caffe", plain("caffè", "càffe")), "caffè", "an accent inside the word is not the final accent");
  assert.equal(openedHeadword("perche", []), undefined);
  assert.equal(openedHeadword("centotré", plain("centotre")), undefined, "a spelled number opens no plain headword");
  assert.equal(openedHeadword("ventitre", plain("ventitré")), "ventitré", "but a missing final accent still opens one that has it");
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
// 21878) and sé (120512 and 120513), added for #900, and fixtures/do-dai.jsonl
// holds do (10367 and 10368) and dai (37983 to 37985), added for #902.
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
const candidateKey = (record: CandidateRecord): string => {
  if (record.recordId !== undefined) return String(record.recordId);
  return record.cardinal !== undefined ? `cardinal-${record.cardinal.value}` : `page-${record.entryId}`;
};

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
// a final vowel typed with the wrong mark, or with an apostrophe and an accent
// swapped, opens the headword with the right one, under the #846 guards.
// perché is lines 33262 to 33264, caffè 2886, sé 120512 and 120513, città
// 31998, è 2673 and po' 31245 and 31246.
test("a word typed with the wrong mark on its final vowel opens the headword with the right one, with that headword's own readings (#900)", async () => {
  await withBareSpellings(async (db) => {
    for (const [query, headword] of [
      ["perchè", "perché"],
      ["caffé", "caffè"],
      ["sè", "sé"],
      ["cittá", "città"],
      ["é", "è"],
      ["Perchè", "perché"],
      ["citta'", "città"],
      ["Citta’", "città"],
      ["pò", "po'"],
    ] as const) {
      const opened = await found(db, query);
      assert.deepEqual(opened.route, { kind: "accentless", headword }, `${query} opens ${headword}`);
      assert.equal(opened.query.raw, query, "the query stays as typed");
      assert.deepEqual(opened.readings, (await found(db, headword)).readings, `${query} answers with ${headword}'s own readings`);
      const present = await exists({ db, releaseId: RELEASE, query });
      assert.ok(present.outcome === "present" && present.word === headword, `${query}: exists() credits ${headword}`);
    }
    await assertAgree(db, ["perchè", "caffé", "sè", "cittá", "é", "citta'", "pò", "se", "sé", "e", "è", "perche", "perché", "po", "po'"]);
  }, "fixtures/se-reflexive.jsonl");
});

test("se, e, po' and perche keep their answers beside the wrong-mark step (#846, #900)", async () => {
  await withBareSpellings(async (db) => {
    const se = await found(db, "se");
    assert.equal(se.route.kind, "surface");
    assert.deepEqual([...new Set(se.readings.map((reading) => reading.word))], ["se"], "never sé");
    const e = await found(db, "e");
    assert.equal(e.route.kind, "surface");
    assert.deepEqual(e.readings.map((reading) => `${reading.word} ${reading.pos}`), ["e conj", "e character"], "never è");
    assert.equal((await found(db, "po'")).route.kind, "surface", "po' is a word of its own");
    assert.deepEqual((await found(db, "perche")).route, { kind: "accentless", headword: "perché" });
  }, "fixtures/se-reflexive.jsonl");
});

// Huey's ruling of 2026-10-20 on #902 (https://github.com/povlabs/lexema/issues/902#issuecomment-6286868165):
// a final vowel typed with an accent its headword lacks opens the plain
// headword, under the #846 guards and tie-break. do is lines 10367 and 10368
// (the note and the verb form of dare), dai 37983 to 37985 (interjection,
// preposition and verb form of dare), è 2673, e 15951 and 15952, se 21877 and
// 21878, sé 120512 and 120513.
test("a word typed with an accent its headword lacks opens the plain headword, with every reading of it (#902)", async () => {
  await withBareSpellings(
    async (db) => {
      for (const [query, headword] of [
        ["dò", "do"],
        ["dó", "do"],
        ["dài", "dai"],
        ["Dài", "dai"],
      ] as const) {
        const opened = await found(db, query);
        assert.deepEqual(opened.route, { kind: "accentless", headword }, `${query} opens ${headword}`);
        assert.equal(opened.query.raw, query, "the query stays as typed");
        assert.deepEqual(opened.readings, (await found(db, headword)).readings, `${query} answers with ${headword}'s own readings`);
        const present = await exists({ db, releaseId: RELEASE, query });
        assert.ok(present.outcome === "present" && present.word === headword, `${query}: exists() credits ${headword}`);
      }
      assert.deepEqual(
        (await found(db, "dò")).readings.map((reading) => reading.pos),
        ["noun", "verb"],
        "the note and the verb form alike",
      );
      assert.deepEqual(
        (await found(db, "dài")).readings.map((reading) => reading.pos),
        ["intj", "prep", "verb"],
      );
      for (const query of ["do", "dai", "e", "se"]) assert.equal((await found(db, query)).route.kind, "surface", `${query} keeps its own answer`);
      assert.deepEqual((await found(db, "é")).route, { kind: "accentless", headword: "è" }, "a headword with a final mark comes first: é opens è, never e");
      assert.deepEqual((await found(db, "sè")).route, { kind: "accentless", headword: "sé" }, "sè opens sé, never se");
      assert.deepEqual((await found(db, "pò")).route, { kind: "accentless", headword: "po'" }, "pò opens po', never po");
      await assertAgree(db, ["dò", "dó", "dài", "do", "dai", "é", "è", "e", "sè", "sé", "se", "pò", "po", "po'", "dall", "qqqq"]);
    },
    "fixtures/se-reflexive.jsonl",
    "fixtures/do-dai.jsonl",
  );
});

// Huey's ask of 2026-10-20 (https://github.com/povlabs/lexema/pull/907#issuecomment-6289786349):
// the spelled-number step comes before the extra-accent step.
// fixtures/cardinal-accent.jsonl holds seicentotre (line 42983), centotre
// (42990) and trecentoquarantatre (423609) of it-0c432803, each a numeral
// record with no gloss; fixtures/cardinals.jsonl holds ventitré.
test("centotré, seicentotré and trecentoquarantatré keep the built number reading, never the source's plain numeral record (#902)", async () => {
  await withBareSpellings(
    async (db) => {
      for (const [query, value] of [
        ["centotré", 103],
        ["seicentotré", 603],
        ["trecentoquarantatré", 343],
      ] as const) {
        const answer = await found(db, query);
        assert.deepEqual(answer.route, { kind: "surface" }, `${query} opens no plain headword`);
        assert.deepEqual(
          answer.readings.map((reading) => reading.cardinal?.value),
          [value],
          `${query} is the number reading`,
        );
        const present = await exists({ db, releaseId: RELEASE, query });
        assert.ok(present.outcome === "present" && present.cardinal?.value === value, `${query}: exists() credits the number reading`);
      }
      for (const query of ["centotre", "seicentotre", "trecentoquarantatre"]) {
        const own = await found(db, query);
        assert.equal(own.route.kind, "surface", `${query} keeps its own answer`);
        assert.deepEqual(own.readings.map((reading) => reading.cardinal), [undefined], `${query} is the source's record`);
      }
      assert.deepEqual((await found(db, "ventitre")).route, { kind: "accentless", headword: "ventitré" }, "a missing final accent still opens ventitré");
      assert.deepEqual((await found(db, "dò")).route, { kind: "accentless", headword: "do" }, "dò still opens do");
      await assertAgree(db, ["centotré", "seicentotré", "trecentoquarantatré", "centotre", "seicentotre", "trecentoquarantatre", "ventitre", "dò", "dài"]);
    },
    "fixtures/cardinal-accent.jsonl",
    "fixtures/cardinals.jsonl",
    "fixtures/do-dai.jsonl",
  );
});

test("a final apostrophe left off stays not found and offers the written word (#468, #900)", async () => {
  await withBareSpellings(async (db) => {
    // The apostrophe case: before #468, `dall` led with `dalla`, one edit away.
    const dall = await search(db, "dall");
    assert.ok(!dall.found && dall.nearby.kind === "accent", "dall is not found and offers a spelling with the same letters");
    assert.equal(bareSpellingOutcome("dall'", dall), "best", "dall offers dall' first");
    // Only an accent typed for the apostrophe opens po' (#900); dall, with no
    // mark at all, does not open dall'.
    assert.equal(bareSpellingOutcome("po'", await search(db, "pò")), "opened");
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
