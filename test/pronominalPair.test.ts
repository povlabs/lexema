// Rule `it-pronominal-pair/v1` (#810): a `si` + verb pair finds the
// pronominal verb it is said for. `si trasferiscono` is the pair the
// missing-word count names (reports/2026-10-11-missing-common-words.md), over
// the development fixture seeded the way `pnpm run seed:dev` seeds D1, and the
// release lines of `fixtures/pronominal-pairs.jsonl`: trasferire (line 50299)
// and trasferirsi (50301) of release it-0c432803, which the development
// fixture lacks. addolorare and addolorarsi are the development fixture's.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { pairQueryOf, pronominalInfinitiveOf, pronominalPairs, type PairQuery } from "../src/italian/pronominalPair.js";
import { seedSql } from "../src/import/seedSql.js";
import { PageOnlyCandidates, readUnrecordedPageTitles, UNRECORDED_PAGE_TITLES_FILE } from "../src/import/pageOnlyCandidates.js";
import { lookupBatch, type CandidateRecord } from "../src/lookup/batch.js";
import { fromNodeSqlite, type DictionaryRead, type LookupDatabase, type SqlValue } from "../src/lookup/database.js";
import { exists, lookup } from "../src/lookup/lookup.js";
import { PAIRED_CELL_SQL } from "../src/lookup/pronominalPair.js";
import { entryKey, isFormOfReading, lemmasOfPartOfSpeech, type FoundResult } from "../src/lookup/types.js";
import { loadFixturePages } from "../src/source/rawPage.js";

const RELEASE = "it-pronominal-pair-test";

let dir: string;
let sqlite: DatabaseSync;
let db: LookupDatabase;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "lexema-pronominal-pair-"));
  const archive = join(dir, "archive.jsonl.gz");
  const lines = `${(await readFile("fixtures/dev-seed.jsonl", "utf8")).trimEnd()}\n${await readFile("fixtures/pronominal-pairs.jsonl", "utf8")}`;
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

const pair = (key: string): PairQuery => {
  const query = pairQueryOf(key);
  assert.ok(query !== undefined, key);
  return query;
};

test("the rule reads `si` and one word as a pair, and nothing else (#810)", () => {
  assert.deepEqual(pairQueryOf("si trasferiscono"), { rule: "it-pronominal-pair/v1", form: "trasferiscono" });
  for (const key of ["trasferiscono", "si", "mi trasferisco", "si si trasferiscono", "si  trasferiscono", "si l'ha", "trasferiscono si"]) {
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

test("only a verb's third person cell names a pronominal verb, each once (#810)", () => {
  const query = pair("si trasferiscono");
  assert.deepEqual(
    pronominalPairs(query, [
      { word: "trasferire", pos: "verb", thirdPerson: true },
      { word: "trasferire", pos: "verb", thirdPerson: true },
      { word: "mare", pos: "noun", thirdPerson: true },
      { word: "trasferare", pos: "verb", thirdPerson: false },
    ]),
    [{ rule: "it-pronominal-pair/v1", form: "trasferiscono", verb: "trasferire", key: "trasferirsi" }],
  );
});

async function found(query: string): Promise<FoundResult> {
  const result = await lookup({ db, releaseId: RELEASE, query });
  assert.equal(result.outcome, "found", `${query} is found`);
  return result as FoundResult;
}

/** The pairs that answered, as `verb>key`. */
const pairsOf = (result: FoundResult): string[] => (result.route.kind === "pronominal" ? result.route.pairs.map(({ verb, key }) => `${verb}>${key}`) : []);

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

test("si trasferiscono finds trasferirsi, the pronominal verb, and not trasferire (#810)", async () => {
  for (const query of ["si trasferiscono", "Si trasferiscono", "si trasferisce", " si trasferiscono "]) {
    const result = await found(query);
    assert.deepEqual(pairsOf(result), ["trasferire>trasferirsi"], query);
    assert.deepEqual(readingsOf(result), ["trasferirsi verb"], query);
  }
});

test("si addolorano finds addolorarsi, the development fixture's pronominal verb (#810)", async () => {
  const result = await found("si addolorano");
  assert.deepEqual(pairsOf(result), ["addolorare>addolorarsi"]);
  assert.deepEqual(readingsOf(result), ["addolorarsi verb"]);
});

test("a pair answers nothing where the pronominal verb is not in the dictionary, or the cell is not a third person's (#810)", async () => {
  // vivere's table lists vive, and the dictionary has no viversi.
  // trasferisco is the first person: `si` takes the third.
  // casa is no verb form.
  for (const query of ["si vive", "si trasferisco", "si casa", "si qqqqqq"]) {
    assert.equal((await lookup({ db, releaseId: RELEASE, query })).outcome, "not-found", query);
    assert.equal((await exists({ db, releaseId: RELEASE, query })).outcome, "absent", query);
  }
});

test("the batch answers each pair with the records /v1/lookup answers it with, and exists() agrees (#810)", async () => {
  const words = ["si trasferiscono", "si trasferisce", "si addolorano", "trasferirsi", "si vive", "si trasferisco", "raccontarvi"];
  const { answers } = await lookupBatch({ db, releaseId: RELEASE, queries: words });
  for (const [at, word] of words.entries()) {
    const single = await lookup({ db, releaseId: RELEASE, query: word });
    const answer = answers[at];
    const batch = answer.outcome === "found" ? answer.candidates.map(candidateKey) : [];
    assert.deepEqual(batch, single.outcome === "found" ? candidateKeys(single) : [], word);
    const present = await exists({ db, releaseId: RELEASE, query: word });
    assert.equal(present.outcome === "present", single.outcome === "found", word);
  }
  const trasferiscono = answers[0];
  assert.equal(trasferiscono.outcome, "found");
  assert.deepEqual(
    trasferiscono.outcome === "found" ? trasferiscono.candidates.map((candidate) => candidate.word) : [],
    ["trasferirsi"],
  );
  const present = await exists({ db, releaseId: RELEASE, query: "si trasferiscono" });
  assert.equal(present.outcome === "present" ? present.word : undefined, "trasferirsi");
});

test("a word the dictionary spells keeps its answer, and a query that is no pair sends no pair read (#810)", async () => {
  assert.equal((await found("trasferirsi")).route.kind, "surface");
  const sent: DictionaryRead[] = [];
  const recording: LookupDatabase = {
    all: <T,>(sql: DictionaryRead, params: readonly SqlValue[]) => {
      sent.push(sql);
      return db.all<T>(sql, params);
    },
  };
  for (const query of ["qqqqqq", "trasferiscono", "raccontarvi", "mi trasferisco"]) await lookup({ db: recording, releaseId: RELEASE, query });
  await lookupBatch({ db: recording, releaseId: RELEASE, queries: ["qqqqqq", "trasferiscono", "raccontarvi"] });
  assert.ok(!sent.includes(PAIRED_CELL_SQL), "no pair read");
});
