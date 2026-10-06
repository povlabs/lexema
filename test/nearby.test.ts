// What a search that found nothing offers (src/lookup/nearby.ts): the pure
// parts, and one answer of each kind over the development fixture, read
// straight off SQLite and through the D1 adapter; the four steps on the page
// are in web/test/page.test.tsx.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { seedSql } from "../src/import/seedSql.js";
import { fromD1, fromNodeSqlite, type D1Like, type D1StatementLike, type SqlValue } from "../src/lookup/database.js";
import { addsMarksTo, deletionKeys, findNearby, foldKey, rankCandidates, withinOneEdit, type Candidate, type Nearby } from "../src/lookup/nearby.js";

const RELEASE = "it-nearby-test";

let dir: string;
let sqlite: DatabaseSync;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "lexema-nearby-"));
  const archive = join(dir, "dev-seed.jsonl.gz");
  await writeFile(archive, gzipSync(await readFile("fixtures/dev-seed.jsonl")));
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

/** A D1 over the local SQLite: a `batch()` answers each statement in order. */
function sqliteD1(db: DatabaseSync): D1Like {
  const statement = (sql: string, params: SqlValue[]): D1StatementLike & { run(): unknown[] } => ({
    bind: (...bound) => statement(sql, bound),
    run: () => db.prepare(sql).all(...params),
    all: async <T>() => ({ results: db.prepare(sql).all(...params) as T[] }),
  });
  return {
    prepare: (sql) => statement(sql, []),
    batch: async (statements) => (statements as ReturnType<typeof statement>[]).map((one) => ({ results: one.run() })),
  };
}

/** What `findNearby` answered at f6731dd, before its reads were sent in fewer D1 calls (#663). */
const PINNED: Record<string, Nearby> = {
  zzzz: { kind: "none" },
  citta: { kind: "accent", best: "città", others: [], phrases: [] },
  xqzt: { kind: "none" },
  qwrtz: { kind: "none" },
  mangare: { kind: "typo", best: "mangiare", others: [], phrases: [] },
  "vadoo via": { kind: "phrase", best: { phrase: "vado via", headwords: ["andare via"] }, others: [] },
  stud: { kind: "prefix", words: ["studente", "studentessa", "studenti", "studiare"] },
};

for (const [query, pinned] of Object.entries(PINNED)) {
  test(`'${query}' is offered what it was offered before #663, off SQLite and through D1`, async () => {
    assert.deepEqual(await findNearby({ db: fromNodeSqlite(sqlite), releaseId: RELEASE, query }), pinned);
    assert.deepEqual(await findNearby({ db: fromD1(sqliteD1(sqlite)), releaseId: RELEASE, query }), pinned);
  });
}

test("a written spelling adds accents or a final apostrophe to a key, and takes none away", () => {
  assert.ok(addsMarksTo("citta", "città"));
  assert.ok(addsMarksTo("e", "è"));
  assert.ok(addsMarksTo("po", "po'"));
  assert.ok(!addsMarksTo("città", "citta"), "drops the accent");
  assert.ok(!addsMarksTo("perchè", "perché"), "swaps the accent");
  assert.ok(!addsMarksTo("città", "città"), "a key is not its own");
  assert.ok(!addsMarksTo("l", "l'a"), "an apostrophe only at the end");
  assert.ok(!addsMarksTo("citta", "cittadino"), "letters are not marks");
});

test("folding takes accents off and leaves everything else", () => {
  assert.equal(foldKey("città"), "citta");
  assert.equal(foldKey("perché"), "perche");
  assert.equal(foldKey("andò"), "ando");
  assert.equal(foldKey("casa"), "casa");
  assert.equal(foldKey("l'acqua"), "l'acqua");
});

test("a key's deletion keys are itself and each spelling with one character left out, once each", () => {
  assert.deepEqual(deletionKeys("casa"), ["casa", "asa", "csa", "caa", "cas"]);
  assert.deepEqual(deletionKeys("aa"), ["aa", "a"], "a doubled letter gives one deletion");
  assert.deepEqual(deletionKeys("città"), ["città", "ittà", "cttà", "cità", "citt"]);
});

test("one edit is one insertion, deletion, replacement or swap of neighbours, and no more", () => {
  assert.ok(withinOneEdit("mangare", "mangiare"), "an insertion");
  assert.ok(withinOneEdit("mangiare", "mangare"), "a deletion");
  assert.ok(withinOneEdit("mancare", "mangare"), "a replacement");
  assert.ok(withinOneEdit("mnagiare", "mangiare"), "a swap of neighbours");
  assert.ok(withinOneEdit("casa", "casa"));
  assert.ok(!withinOneEdit("mangiare", "mangiate "), "two edits");
  assert.ok(!withinOneEdit("casa", "cosi"));
  assert.ok(!withinOneEdit("abc", "cba"), "a swap of non-neighbours is two edits");
  assert.ok(!withinOneEdit("casa", "casale"));
});

test("candidates rank by fewest edits, translation languages, senses and forms, headword first, length, then alphabet", () => {
  const c = (surface: string, edits: number, languages: number, richness: number, headword = true): Candidate => ({
    key: surface,
    surface,
    edits,
    languages,
    richness,
    headword,
  });
  const ranked = rankCandidates([
    c("mangiate", 1, 0, 0, false),
    c("magnare", 1, 0, 1),
    c("mandare", 1, 6, 40),
    c("mangiare", 1, 51, 99),
    c("mancare", 1, 5, 60),
    c("città", 0, 0, 1),
    c("vangare", 1, 0, 3),
    c("zappare", 1, 0, 3),
  ]).map((candidate) => candidate.surface);
  // città is fewer edits. Then most languages: mangiare, mandare (6), mancare
  // (5, though richer). With no translations, richness: vangare and zappare
  // (3, then alphabetical), magnare (1); the form mangiate last.
  assert.deepEqual(ranked, ["città", "mangiare", "mandare", "mancare", "vangare", "zappare", "magnare", "mangiate"]);
});
