// A word typed with its article (#738): `una macchina` finds macchina's
// readings, by rule `it-article-query/v1`, the readings whose own articles
// include the typed one first. Read over `fixtures/article-query.jsonl`,
// verbatim lines of release it-0c432803 (archive lines 1197 `auto`, 1298
// `acqua`, 2058-2059 `macchina`, 2908-2910 `riso`, 8234-8236 `ancora`,
// 18097-18099 `volta`, 41346-41348 `porta`, 48699 `macchinare`, 55721-55722
// `zaino`, 64522 `macchine`, 78716-78718 `volte`, 111655 `zaini`,
// 624515-624516 `una volta`), seeded the way `pnpm run seed:dev` seeds D1.
// The page and the API over the same lines are tested in
// web/test/page.test.tsx and web/test/api.test.ts.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { seedSql } from "../src/import/seedSql.js";
import { fromNodeSqlite, type DictionaryRead, type LookupDatabase, type SqlValue } from "../src/lookup/database.js";
import { exists, lookup, SEARCH_SQL } from "../src/lookup/lookup.js";
import { HEADWORD_SPELLING_SQL } from "../src/lookup/phrase.js";
import type { FoundResult, LookupResult, Reading } from "../src/lookup/types.js";

const RELEASE = "it-article-query-test";

let dir: string;
let sqlite: DatabaseSync;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "lexema-article-query-"));
  const archive = join(dir, "article-query.jsonl.gz");
  await writeFile(archive, gzipSync(await readFile("fixtures/article-query.jsonl")));
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
  sqlite = new DatabaseSync(":memory:");
  for (const part of parts) sqlite.exec(await readFile(part, "utf8"));
});

after(async () => {
  sqlite.close();
  await rm(dir, { recursive: true, force: true });
});

const ask = (query: string, db: LookupDatabase = fromNodeSqlite(sqlite)): Promise<LookupResult> => lookup({ db, releaseId: RELEASE, query });

async function found(query: string): Promise<FoundResult> {
  const result = await ask(query);
  assert.equal(result.outcome, "found", `${query} is found`);
  return result as FoundResult;
}

/** A reading as its record, part of speech and articles: `porta noun la,una`, `riso noun withheld`, `porta adj`. */
const shapeOf = (reading: Reading): string =>
  [
    reading.word,
    reading.pos,
    ...(reading.articles === undefined
      ? []
      : [reading.articles.status === "derived" ? reading.articles.articles.map((one) => one.article).join(",") : "withheld"]),
  ].join(" ");

const shapes = (result: FoundResult): string[] => result.readings.map(shapeOf);

/** Each reading's record, so two answers can be compared reading for reading. */
const records = (readings: readonly Reading[]): (number | undefined)[] => readings.map((reading) => reading.recordId);

/** Every query of the article route below, the word it reads, and the article. */
const ARTICLE_QUERIES: readonly [string, string, string][] = [
  ["una macchina", "macchina", "una"],
  ["la macchina", "macchina", "la"],
  ["un macchina", "macchina", "un"],
  ["le macchine", "macchine", "le"],
  ["l'acqua", "acqua", "l'"],
  ["l’acqua", "acqua", "l'"],
  ["un'auto", "auto", "un'"],
  ["gli zaini", "zaini", "gli"],
  ["il riso", "riso", "il"],
  ["la porta", "porta", "la"],
  ["l'ancora", "ancora", "l'"],
];

test("una macchina and la macchina open macchina's readings, its feminine noun first, by the article route", async () => {
  for (const query of ["una macchina", "la macchina"]) {
    const result = await found(query);
    assert.equal(result.route.kind, "article", query);
    assert.ok(result.route.kind === "article");
    assert.equal(result.route.query.word, "macchina");
    assert.equal(result.query.raw, query, "the answer keeps the query as typed");
    // it-0c432803 states macchina feminine and no number, so `it-articles/v3`
    // withholds its articles and no reading agrees: the order is the search
    // for macchina's, which has the noun first.
    assert.deepEqual(shapes(result), ["macchina noun withheld", "macchina verb"], query);
    assert.deepEqual(records(result.readings), records((await found("macchina")).readings), query);
  }
});

test("le macchine opens macchine's reading first, and l'acqua, un'auto and gli zaini their words'", async () => {
  assert.deepEqual(shapes(await found("le macchine")), ["macchine noun le,delle"]);
  assert.deepEqual(shapes(await found("l'acqua")), ["acqua noun l',un'"]);
  assert.deepEqual(shapes(await found("l’acqua")), ["acqua noun l',un'"]);
  assert.deepEqual(shapes(await found("un'auto")), ["auto noun withheld"]);
  assert.deepEqual(shapes(await found("gli zaini")), ["zaini noun gli,degli"]);
});

test("the readings whose own articles include the typed one come first, the rest in the word's own order", async () => {
  // porta's adjective is first in the source; `la porta` is the noun's.
  assert.deepEqual(shapes(await found("porta")), ["porta adj", "porta noun la,una", "porta verb"]);
  assert.deepEqual(shapes(await found("la porta")), ["porta noun la,una", "porta adj", "porta verb"]);
  // ancora's adverb is first in the source; `l'ancora` is the noun's.
  assert.deepEqual(shapes(await found("ancora")), ["ancora adv", "ancora noun l',un'", "ancora verb"]);
  assert.deepEqual(shapes(await found("l'ancora")), ["ancora noun l',un'", "ancora adv", "ancora verb"]);
  // riso's first noun is stated invariable, so its articles are withheld and
  // it is never put first: `il riso` is the second noun's.
  assert.deepEqual(shapes(await found("riso")), ["riso noun withheld", "riso noun il,un", "riso verb"]);
  assert.deepEqual(shapes(await found("il riso")), ["riso noun il,un", "riso noun withheld", "riso verb"]);
  // An article no reading takes drops nothing and moves nothing.
  assert.deepEqual(shapes(await found("un macchina")), ["macchina noun withheld", "macchina verb"]);
  assert.deepEqual(shapes(await found("lo porta")), ["porta adj", "porta noun la,una", "porta verb"]);
});

test("every article query answers its word's readings, those agreeing first, and no other reading first", async () => {
  for (const [query, word, article] of ARTICLE_QUERIES) {
    const result = await found(query);
    const alone = await found(word);
    assert.ok(result.route.kind === "article", query);
    assert.equal(result.route.query.article, article, query);
    const agrees = (reading: Reading): boolean =>
      reading.articles?.status === "derived" && reading.articles.articles.some((one) => one.article === article);
    const expected = [...alone.readings.filter(agrees), ...alone.readings.filter((reading) => !agrees(reading))];
    assert.deepEqual(records(result.readings), records(expected), query);
    // A reading of another part of speech or with withheld articles is first only when no reading agrees.
    if (!agrees(result.readings[0])) assert.ok(!result.readings.some(agrees), `${query}: nothing agrees`);
  }
});

/** The database, with every statement it is sent and every answer it gives, in order. */
function recording(): { db: LookupDatabase; log: { event: "sent" | "answered"; sql: DictionaryRead; params: readonly SqlValue[] }[] } {
  const inner = fromNodeSqlite(sqlite);
  const log: { event: "sent" | "answered"; sql: DictionaryRead; params: readonly SqlValue[] }[] = [];
  return {
    db: {
      all: async <T,>(sql: DictionaryRead, params: readonly SqlValue[]) => {
        log.push({ event: "sent", sql, params });
        const rows = await inner.all<T>(sql, params);
        log.push({ event: "answered", sql, params });
        return rows;
      },
    },
    log,
  };
}

test("the article route runs last: a headword or a phrase of the rule's shape answers as before", async () => {
  // `una volta` is a headword, so it is found as typed and volta is never read.
  const headword = await found("una volta");
  assert.equal(headword.route.kind, "surface");
  assert.deepEqual(shapes(headword), ["una volta adv_phrase", "una volta phrase"]);
  // `una volte` spells nothing, and its words read as `una volta`, so the phrase route answers it.
  const phrase = await found("una volte");
  assert.equal(phrase.route.kind, "phrase");
  assert.deepEqual(shapes(phrase), ["una volta adv_phrase", "una volta phrase"]);

  // `una macchina`: the word is searched only after the query as typed and the phrase reading found nothing.
  const { db, log } = recording();
  assert.equal(((await ask("una macchina", db)) as FoundResult).route.kind, "article");
  const searched = (key: string): number => log.findIndex((entry) => entry.event === "sent" && entry.sql.startsWith(SEARCH_SQL) && entry.params[1] === key);
  const typed = searched("una macchina");
  const word = searched("macchina");
  const lastPhraseProbe = log.map((entry) => entry.event === "answered" && entry.sql === HEADWORD_SPELLING_SQL).lastIndexOf(true);
  assert.ok(typed >= 0 && lastPhraseProbe >= 0 && word >= 0, "each probe was sent");
  assert.ok(typed < lastPhraseProbe && lastPhraseProbe < word, "the query, then the phrase, then the word");

  // A query that is a headword sends no probe for the word after its article.
  const again = recording();
  await ask("una volta", again.db);
  assert.ok(!again.log.some((entry) => entry.sql.startsWith(SEARCH_SQL) && entry.params[1] === "volta"));
});

test("a word the index does not hold is not found, with an article or without", async () => {
  for (const query of ["la macchinetta", "l'acquario", "gli zzz", "della macchina", "la macchina rossa"]) {
    assert.equal((await ask(query)).outcome, "not-found", query);
  }
});

test("exists agrees with lookup for every case above", async () => {
  const db = fromNodeSqlite(sqlite);
  const queries = [
    ...ARTICLE_QUERIES.map(([query]) => query),
    "lo porta",
    "una volta",
    "una volte",
    "la macchinetta",
    "l'acquario",
    "gli zzz",
    "della macchina",
    "la macchina rossa",
  ];
  for (const query of queries) {
    const [answer, present] = await Promise.all([ask(query), exists({ db, releaseId: RELEASE, query })]);
    assert.ok(answer.outcome === "found" || answer.outcome === "not-found", query);
    assert.equal(present.outcome, answer.outcome === "found" ? "present" : "absent", query);
    if (answer.outcome === "found" && present.outcome === "present") {
      assert.ok(answer.readings.some((reading) => reading.word === present.word), `${query}: exists names a record lookup reads`);
    }
  }
});
