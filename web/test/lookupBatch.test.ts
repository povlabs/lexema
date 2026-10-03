// The batch's light lookup (#335) against the path it replaced: a full
// `lookup()` of each word and `candidatesOf`, over the development fixture
// seeded the way `pnpm run seed:dev` seeds D1. The two must answer every word
// with the same records in the same order; the light one does it in a fixed
// number of statements, the release read once.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { seedSql } from "../../src/import/seedSql.js";
import { BATCH_LEMMA_LINK_SQL, BATCH_SEARCH_SQL, lookupBatch, type BatchAnswer } from "../../src/lookup/batch.js";
import { fromNodeSqlite, type DictionaryRead, type LookupDatabase } from "../../src/lookup/database.js";
import { lookup } from "../../src/lookup/lookup.js";
import { OPTIONAL_TABLES_SQL } from "../../src/lookup/served.js";
import type { LemmaTarget } from "../../src/lookup/types.js";
import { candidatesOf } from "@/worker/api/lookupAnswer.ts";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const RELEASE = "it-batch-test";

let dir: string;
let sqlite: DatabaseSync;
let db: LookupDatabase;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "lexema-batch-"));
  const archive = join(dir, "dev-seed.jsonl.gz");
  await writeFile(archive, gzipSync(await readFile(join(REPO, "fixtures/dev-seed.jsonl"))));
  const { parts } = await seedSql({
    input: archive,
    outputDir: join(dir, "sql"),
    schema: join(REPO, "src/db/schema.sql"),
    releaseId: RELEASE,
    archiveR2Key: `releases/${RELEASE}.jsonl.gz`,
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

/** One candidate as the batch answers it: id, lemma and part of speech. */
type Light = { id: string; lemma: string; pos: string; pos_title: string } | "not found";

/** The path `/lookup/batch` took before #335: a whole lookup of the word, and one of each lemma a form-of reading names. */
async function throughCandidatesOf(word: string): Promise<Light[]> {
  const result = await lookup({ db, releaseId: RELEASE, query: word });
  if (result.outcome !== "found") return ["not found"];
  const readLemma = async (target: LemmaTarget) => {
    const lemma = await lookup({ db, releaseId: RELEASE, query: target.word });
    return lemma.outcome === "found" ? lemma.readings.find((reading) => reading.recordId === target.recordId) : undefined;
  };
  return (await candidatesOf(result, readLemma)).map(({ reading }) => ({
    id: `${reading.ref.releaseId}:${reading.ref.lineNo}`,
    lemma: reading.word,
    pos: reading.pos,
    pos_title: reading.posTitle,
  }));
}

const light = (answer: BatchAnswer): Light[] =>
  answer.outcome === "found"
    ? answer.candidates.map((candidate) => ({
        id: `${RELEASE}:${candidate.lineNo}`,
        lemma: candidate.word,
        pos: candidate.pos,
        pos_title: candidate.posTitle,
      }))
    : ["not found"];

/** A dictionary that keeps every statement it was asked. */
function recording(): { db: LookupDatabase; asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    db: {
      all<T>(sql: DictionaryRead, params: Parameters<LookupDatabase["all"]>[1]): Promise<T[]> {
        asked.push(sql);
        return db.all<T>(sql, params);
      },
    },
  };
}

test("the batch answers every word with the candidates candidatesOf makes of its lookup, in the same order", async () => {
  // Every spelling the fixture holds, headword or form: form-of readings
  // (`andavano`), words with several candidates (`sale`), lemmas folded into
  // the reading that names them; then multi-word headwords said through their
  // forms (#214), a word sent twice, and words the release does not have.
  const spellings = (sqlite.prepare("SELECT DISTINCT surface FROM lookup_form ORDER BY surface").all() as { surface: string }[]).map(
    (row) => row.surface,
  );
  const words = [
    ...spellings,
    ...["vado via", "sono andati via", "faccio l'abitudine", "hanno fatte fuori", "tiro fuori", "aerei a reazione"],
    ...["sale", "andavano", "qqqqqq", "vado viaa", "Casa", " sale "],
  ];
  const { release, answers } = await lookupBatch({ db, releaseId: RELEASE, queries: words });
  assert.equal(release.releaseId, RELEASE);
  assert.equal(answers.length, words.length);

  const expected = await Promise.all(words.map(throughCandidatesOf));
  for (const [at, word] of words.entries()) assert.deepEqual(light(answers[at]), expected[at], word);

  // The shapes the criterion names are all there, so the comparison above is not vacuous.
  const of = (word: string) => light(answers[words.indexOf(word)]);
  assert.deepEqual(
    of("andavano").map((candidate) => candidate !== "not found" && candidate.lemma),
    ["andare"],
  );
  assert.ok(of("sale").length > 1, JSON.stringify(of("sale")));
  assert.deepEqual(of("qqqqqq"), ["not found"]);
  assert.deepEqual(
    of("vado via").map((candidate) => candidate !== "not found" && candidate.lemma),
    ["andare via"],
  );
});

test("a batch reads the release once and runs the same few statements for one word or a hundred", async () => {
  const spellings = (sqlite.prepare("SELECT DISTINCT surface FROM lookup_form ORDER BY surface LIMIT 100").all() as { surface: string }[]).map(
    (row) => row.surface,
  );
  const releaseReads = (asked: readonly string[]) => asked.filter((sql) => sql.includes("FROM source_release\n")).length;

  const one = recording();
  await lookupBatch({ db: one.db, releaseId: RELEASE, queries: ["andavano"] });
  const many = recording();
  await lookupBatch({ db: many.db, releaseId: RELEASE, queries: [...spellings, "qqqqqq"] });

  for (const { asked } of [one, many]) {
    assert.equal(releaseReads(asked), 1, asked.join("\n---\n"));
    assert.equal(asked.filter((sql) => sql === BATCH_SEARCH_SQL).length, 1, asked.join("\n---\n"));
    assert.equal(asked.filter((sql) => sql === BATCH_LEMMA_LINK_SQL).length, 1, asked.join("\n---\n"));
    assert.equal(asked.filter((sql) => sql === OPTIONAL_TABLES_SQL).length, 1, asked.join("\n---\n"));
    // The release and the optional tables (one D1 call), the search and the
    // lemma links: a single word nothing spells is never read word by word.
    assert.equal(asked.length, 4, asked.join("\n---\n"));
  }
});

test("the batch's search and lemma-link reads stay on indexes rather than scanning", () => {
  const plan = (sql: string, ...params: string[]) =>
    (sqlite.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params) as { detail: string }[]).map((row) => row.detail);

  const search = plan(BATCH_SEARCH_SQL, RELEASE, JSON.stringify(["avere", "sale"]));
  assert.ok(!search.some((step) => /SCAN (lookup_form|grammar_claim|lf|g)\b/.test(step)), search.join("\n"));
  assert.ok(search.some((step) => step.includes("lookup_form_by_key")), search.join("\n"));
  assert.ok(search.some((step) => step.includes("grammar_claim_by_record")), search.join("\n"));

  const links = plan(BATCH_LEMMA_LINK_SQL, JSON.stringify([1, 2]));
  assert.ok(!links.some((step) => /MATERIALIZE|SCAN lookup_form|SCAN form_of_edge/.test(step)), links.join("\n"));
  assert.ok(links.some((step) => step.includes("form_of_edge_by_record")), links.join("\n"));
});
