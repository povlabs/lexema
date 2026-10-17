// Rule `it-pronominal-pair/v2` (#810, #834): a reflexive pronoun + verb pair
// finds the pronominal verb it is said for, for every person, and wherever the
// lookup knows the verb form. Over the development fixture seeded the way
// `pnpm run seed:dev` seeds D1, and the release lines of
// `fixtures/pronominal-pairs.jsonl`, all of release it-0c432803, in archive
// order: amare (2338), dare (2340), piacere (33110), chiamare (33249), amarsi
// (47595, 47596), trasferire (50299), trasferirsi (50301), sdarsi (106042),
// inostrare (116879), inostrarsi (116880), accertare (422393), sporsi
// (441282), pentirsi (448681), accertarsi (456263), susseguirsi (456884),
// darsi (462512), chiamarsi (604038), sdavano (703015) and spone (796280).
// addolorare and addolorarsi are the development fixture's.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { FixtureLines } from "../src/italian/correctionsAtLines.js";
import type { CellCorrection } from "../src/italian/curatedCorrections.js";
import {
  pairCandidates,
  pairQueryOf,
  pronominalInfinitiveOf,
  pronominalPairs,
  rowOfCell,
  rowOfFormGloss,
  type PairQuery,
} from "../src/italian/pronominalPair.js";
import { seedSql } from "../src/import/seedSql.js";
import { PageOnlyCandidates, readUnrecordedPageTitles, UNRECORDED_PAGE_TITLES_FILE } from "../src/import/pageOnlyCandidates.js";
import { lookupBatch, type CandidateRecord } from "../src/lookup/batch.js";
import { fromNodeSqlite, type DictionaryRead, type LookupDatabase, type SqlValue } from "../src/lookup/database.js";
import { exists, lookup } from "../src/lookup/lookup.js";
import { PAIRED_FORM_SQL, VERB_HEAD_SQL } from "../src/lookup/pronominalPair.js";
import { entryKey, isFormOfReading, lemmasOfPartOfSpeech, type FoundResult, type LookupResult } from "../src/lookup/types.js";
import { loadFixturePages } from "../src/source/rawPage.js";

const RELEASE = "it-pronominal-pair-test";

let dir: string;
let sqlite: DatabaseSync;
let db: LookupDatabase;

/** trasferire's line in the pair fixture, and the curated cell this test sets on it: its `voi` present, `trasferite`, spelled `trasfferite`. */
const TRASFERIRE_LINE = 7;
const TRASFFERITE = "trasfferite";

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "lexema-pronominal-pair-"));
  const archive = join(dir, "archive.jsonl.gz");
  const pairLines = (await readFile("fixtures/pronominal-pairs.jsonl", "utf8")).trimEnd().split("\n");
  const lines = [...(await readFile("fixtures/dev-seed.jsonl", "utf8")).trimEnd().split("\n"), ...pairLines];
  await writeFile(archive, gzipSync(`${lines.join("\n")}\n`));
  // A cell correction made for this test, keyed to trasferire's line as the
  // committed list keys its own (#743): the rule reads it as the search does.
  const trasferire = pairLines[TRASFERIRE_LINE - 1];
  const correction: CellCorrection = {
    record: { releaseId: "it-0c432803", lineNo: 50299, lineSha256: createHash("sha256").update(trasferire, "utf8").digest("hex"), word: "trasferire", pos: "verb" },
    cells: [{ index: 9, replaces: "trasferite", surface: TRASFFERITE }],
    evidence: [{ wiki: "it.wiktionary.org", title: "Appendice:Coniugazioni/Italiano/trasferire", revisionId: 1, shows: "{{It-conj|trasfer|ire-b|avere}}" }],
  };
  const { held } = FixtureLines.of(lines, RELEASE).key([correction]);
  assert.equal(held.length, 1, "the correction is keyed to trasferire's line");
  const { parts } = await seedSql({
    input: archive,
    outputDir: join(dir, "sql"),
    schema: "src/db/schema.sql",
    releaseId: RELEASE,
    archiveR2Key: `releases/${RELEASE}.jsonl.gz`,
    license: "CC-BY-SA-4.0",
    rawPages: await loadFixturePages(resolve("fixtures")),
    pageOnly: PageOnlyCandidates.listed(await readUnrecordedPageTitles(resolve(UNRECORDED_PAGE_TITLES_FILE))),
    corrections: held,
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

const pair = (key: string): PairQuery => {
  const query = pairQueryOf(key);
  assert.ok(query !== undefined, key);
  return query;
};

test("the rule reads a reflexive pronoun and one word as a pair, and nothing else (#834)", () => {
  for (const pronoun of ["mi", "ti", "ci", "vi", "si"]) {
    assert.deepEqual(pairQueryOf(`${pronoun} trasferisco`), { rule: "it-pronominal-pair/v2", pronoun, form: "trasferisco" });
  }
  for (const key of ["trasferiscono", "si", "lo trasferisco", "gli trasferisco", "si si trasferiscono", "si  trasferiscono", "si l'ha", "trasferiscono si", "mi"]) {
    assert.equal(pairQueryOf(key), undefined, key);
  }
});

test("an infinitive gives its pronominal infinitive: trasferire trasferirsi, porre porsi; a pronominal one gives itself (#810)", () => {
  assert.equal(pronominalInfinitiveOf("trasferire"), "trasferirsi");
  assert.equal(pronominalInfinitiveOf("vedere"), "vedersi");
  assert.equal(pronominalInfinitiveOf("porre"), "porsi");
  assert.equal(pronominalInfinitiveOf("condurre"), "condursi");
  assert.equal(pronominalInfinitiveOf("addolorarsi"), "addolorarsi");
  for (const word of ["casa", "trasferisce", "re"]) assert.equal(pronominalInfinitiveOf(word), undefined, word);
});

test("only a simple tense's cell has a row: the indicative's, the subjunctive's, the conditional's (#834)", () => {
  assert.deepEqual(rowOfCell({ tags: ["plural", "first-person", "present"], rawTags: ["noi"] }), { person: "first", number: "plural" });
  assert.deepEqual(rowOfCell({ tags: ["present"], rawTags: ["che lui/che lei"] }), { person: "third", number: "singular" });
  assert.deepEqual(rowOfCell({ tags: ["present"], rawTags: ["voi"] }), { person: "second", number: "plural" });
  assert.equal(rowOfCell({ tags: ["imperative"], rawTags: ["voi"] }), undefined);
  assert.equal(rowOfCell({ tags: ["singular", "first-person", "past", "perfect"], rawTags: ["io"] }), undefined);
  assert.equal(rowOfCell({ tags: ["gerund"], rawTags: [] }), undefined);
  assert.deepEqual(rowOfFormGloss("terza persona plurale dell'indicativo imperfetto di sdare", "sdare"), { person: "third", number: "plural" });
  assert.equal(rowOfFormGloss("seconda persona singolare dell'imperativo di sdare", "sdare"), undefined);
  assert.equal(rowOfFormGloss("gerundio di sdare", "sdare"), undefined);
});

test("each pronoun takes the forms of its own person and number, each pronominal verb once (#834)", () => {
  const forms = [
    { verb: "trasferire", row: { person: "first", number: "singular" }, from: "cell" },
    { verb: "trasferire", row: { person: "first", number: "singular" }, from: "regular-table" },
    { verb: "trasferare", row: { person: "second", number: "singular" }, from: "cell" },
    { verb: "casa", row: { person: "first", number: "singular" }, from: "cell" },
  ] as const;
  assert.deepEqual(pronominalPairs(pair("mi trasferisco"), forms), [
    { rule: "it-pronominal-pair/v2", pronoun: "mi", form: "trasferisco", verb: "trasferire", from: "cell", key: "trasferirsi" },
  ]);
  assert.deepEqual(pronominalPairs(pair("ti trasferisco"), forms).map(({ key }) => key), ["trasferarsi"]);
  for (const pronoun of ["ci", "vi", "si"]) assert.deepEqual(pronominalPairs(pair(`${pronoun} trasferisco`), forms), [], pronoun);
});

test("a regular reading names the verb its ending gives in a row the pronoun takes, and no stem without a vowel (#834)", () => {
  const conjugated = (key: string): string[] =>
    pairCandidates(pair(key)).flatMap((candidate) => (candidate.kind === "conjugated" ? [`${candidate.verb} ${candidate.row.person} ${candidate.row.number}`] : []));
  assert.ok(conjugated("ci inostriamo").includes("inostrare first plural"));
  assert.ok(conjugated("si annette").includes("annettere third singular"));
  assert.ok(!conjugated("mi inostriamo").some((one) => one.startsWith("inostrare")));
  // dai is dare's second singular, and its one-letter stem names no first singular of it.
  assert.ok(!conjugated("mi dai").some((one) => one.startsWith("dare ")));
});

async function found(query: string): Promise<FoundResult> {
  const result = await lookup({ db, releaseId: RELEASE, query });
  assert.equal(result.outcome, "found", `${query} is found`);
  return result as FoundResult;
}

/** The pairs that answered, as `verb>key (from)`. */
const pairsOf = (result: LookupResult): string[] =>
  result.outcome === "found" && result.route.kind === "pronominal" ? result.route.pairs.map(({ verb, key, from }) => `${verb}>${key} (${from})`) : [];

/** Each reading as `word pos`, marked `(table)` when the query reached it only through its table. */
const readingsOf = (result: FoundResult): string[] => result.readings.map((reading) => `${reading.word} ${reading.pos}${reading.isAboutQuery ? "" : " (table)"}`);

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

/** Every query a test below asks, so the batch and `exists()` are asked each one too. */
const ASKED: string[] = [];

/** `query`'s pairs, after asserting it is found as the pronominal verb `verb` alone. */
async function pairedAs(query: string, verb: string): Promise<string[]> {
  ASKED.push(query);
  const result = await found(query);
  assert.deepEqual(readingsOf(result), [`${verb} verb`], query);
  return pairsOf(result);
}

/** Asserts no pair answers `query`, and, when `nothing`, that nothing does. */
async function unpaired(query: string, nothing = true): Promise<void> {
  ASKED.push(query);
  const result = await lookup({ db, releaseId: RELEASE, query });
  assert.deepEqual(pairsOf(result), [], query);
  if (nothing) assert.equal(result.outcome, "not-found", query);
}

test("si trasferiscono finds trasferirsi, the pronominal verb, and not trasferire (#810)", async () => {
  for (const query of ["si trasferiscono", "Si trasferiscono", "si trasferisce", " si trasferiscono "]) {
    assert.deepEqual(await pairedAs(query, "trasferirsi"), ["trasferire>trasferirsi (cell)"], query);
  }
});

test("mi, ti, ci and vi find trasferirsi with their own person, and mi chiamo finds chiamarsi (#834)", async () => {
  for (const query of ["mi trasferisco", "ti trasferisci", "ci trasferiamo", "vi trasferite", "ci trasferiremo", "vi trasferireste", "ti trasferisca", "Mi trasferivo"]) {
    assert.deepEqual(await pairedAs(query, "trasferirsi"), ["trasferire>trasferirsi (cell)"], query);
  }
  assert.deepEqual(await pairedAs("mi chiamo", "chiamarsi"), ["chiamare>chiamarsi (cell)"]);
  assert.deepEqual(await pairedAs("si chiamano", "chiamarsi"), ["chiamare>chiamarsi (cell)"]);
});

test("si addolorano finds addolorarsi, the development fixture's pronominal verb (#810)", async () => {
  assert.deepEqual(await pairedAs("si addolorano", "addolorarsi"), ["addolorare>addolorarsi (cell)"]);
});

test("a pronoun and a verb of another person are no pair: mi piace, ti amo, mi dai, si trasferisco (#834)", async () => {
  // piacere's piace, amare's amo and dare's dai are cells of the third, the
  // first and the second singular; the dictionary has amarsi and darsi.
  for (const query of ["mi piace", "ti amo", "mi dai", "si trasferisco", "mi trasferiamo", "vi trasferisci", "ci trasferite"]) await unpaired(query);
});

test("a pair answers nothing where the pronominal verb is not in the dictionary, or is a form of another word (#810, #834)", async () => {
  // vivere's table lists vive, and the dictionary has no viversi. casa is no
  // verb form. sporsi heads a record, and every gloss of it names it a form of
  // sporgere: spone, a form of sporre, is no form of sporsi.
  for (const query of ["si vive", "si casa", "si qqqqqq", "si spone", "ci andiamo"]) {
    await unpaired(query);
    assert.equal((await exists({ db, releaseId: RELEASE, query })).outcome, "absent", query);
  }
});

test("a form no record's table holds answers where the page builds the table: pentirsi's regular one, susseguirsi's hand-kept one (#834)", async () => {
  // pentire has no record; pentirsi's table is the regular one its pinned
  // `{{It-conj|pent|irsi|essere}}` settles (#838).
  assert.deepEqual(await pairedAs("si pente", "pentirsi"), ["pentire>pentirsi (regular-table)"]);
  assert.deepEqual(await pairedAs("si pentono", "pentirsi"), ["pentire>pentirsi (regular-table)"]);
  assert.deepEqual(await pairedAs("mi pento", "pentirsi"), ["pentire>pentirsi (regular-table)"]);
  // accertare's record lists no forms, so its regular forms are read twice:
  // as its `conjugated` shape, and in the regular table of accertarsi's page.
  assert.deepEqual(await pairedAs("si accertano", "accertarsi"), ["accertare>accertarsi (conjugated)"]);
  // susseguire has no record; susseguirsi's table is hand-kept (#844).
  assert.deepEqual(await pairedAs("si susseguono", "susseguirsi"), ["susseguire>susseguirsi (hand-kept-table)"]);
  assert.deepEqual(await pairedAs("si susseguivano", "susseguirsi"), ["susseguire>susseguirsi (hand-kept-table)"]);
});

test("a form only a form-of record, or only a verb's `conjugated` shape, knows answers its pronominal verb (#834)", async () => {
  // sdavano is a form-of record of sdare, which has no record; sdarsi's page
  // builds no table (a verb made on dare, with no hand-kept one).
  assert.deepEqual(await pairedAs("si sdavano", "sdarsi"), ["sdare>sdarsi (form-of)"]);
  await unpaired("si sdava");
  // inostrare's record lists no forms, and inostrarsi's page builds no table
  // (a `-trarsi` verb may be trarre's); the fixture holds no record of inostriamo.
  assert.deepEqual(await pairedAs("ci inostriamo", "inostrarsi"), ["inostrare>inostrarsi (conjugated)"]);
  assert.deepEqual(await pairedAs("si inostrerebbe", "inostrarsi"), ["inostrare>inostrarsi (conjugated)"]);
  await unpaired("mi inostriamo");
});

test("a curated cell answers a pair as the search reads it, in the corrected spelling (#743, #834)", async () => {
  const cell = await found(TRASFFERITE);
  assert.deepEqual(readingsOf(cell), ["trasferire verb (table)"]);
  assert.deepEqual(await pairedAs(`vi ${TRASFFERITE}`, "trasferirsi"), ["trasferire>trasferirsi (corrected-cell)"]);
  // The source's spelling of the cell is still searched, as SEARCH_SQL reads it.
  assert.deepEqual(await pairedAs("vi trasferite", "trasferirsi"), ["trasferire>trasferirsi (cell)"]);
  await unpaired(`mi ${TRASFFERITE}`);
});

test("the batch answers each query with the records /v1/lookup answers it with, and exists() agrees (#810, #834)", async () => {
  const words = [...new Set([...ASKED, "trasferirsi", "raccontarvi", "si trasferisce"])];
  assert.ok(words.length > 30, "the tests above asked their queries");
  const { answers } = await lookupBatch({ db, releaseId: RELEASE, queries: words });
  for (const [at, word] of words.entries()) {
    const single = await lookup({ db, releaseId: RELEASE, query: word });
    const answer = answers[at];
    const batch = answer.outcome === "found" ? answer.candidates.map(candidateKey) : [];
    assert.deepEqual(batch, single.outcome === "found" ? candidateKeys(single) : [], word);
    const present = await exists({ db, releaseId: RELEASE, query: word });
    assert.equal(present.outcome === "present", single.outcome === "found", word);
    if (single.outcome === "found" && single.route.kind === "pronominal") {
      assert.equal(present.outcome === "present" ? present.word : undefined, single.readings[0].word, word);
    }
  }
});

test("a word the dictionary spells keeps its answer, and a query that is no pair sends no pair read (#810, #834)", async () => {
  assert.equal((await found("trasferirsi")).route.kind, "surface");
  assert.equal((await found("trasferisco")).route.kind, "surface");
  const sent: DictionaryRead[] = [];
  const recording: LookupDatabase = {
    all: <T,>(sql: DictionaryRead, params: readonly SqlValue[]) => {
      sent.push(sql);
      return db.all<T>(sql, params);
    },
  };
  for (const query of ["qqqqqq", "trasferiscono", "raccontarvi", "lo trasferisco", "trasferirsi"]) await lookup({ db: recording, releaseId: RELEASE, query });
  await lookupBatch({ db: recording, releaseId: RELEASE, queries: ["qqqqqq", "trasferiscono", "raccontarvi", "trasferirsi"] });
  assert.ok(!sent.includes(PAIRED_FORM_SQL) && !sent.includes(VERB_HEAD_SQL), "no pair read");
});
