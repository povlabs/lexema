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
import {
  BATCH_AGREEMENT_SQL,
  BATCH_LEMMA_LINK_SQL,
  BATCH_SEARCH_SQL,
  CORRECTED_BATCH_LEMMA_LINK_SQL,
  CORRECTED_CELL_BATCH_AGREEMENT_SQL,
  CORRECTED_CELL_BATCH_SEARCH_SQL,
  lookupBatch,
  type BatchAnswer,
} from "../../src/lookup/batch.js";
import { CURATED_CORRECTIONS, cellCorrections, type CellCorrection } from "../../src/italian/curatedCorrections.js";
import { fromNodeSqlite, type DictionaryRead, type LookupDatabase } from "../../src/lookup/database.js";
import {
  CORRECTED_CLAIM_SQL,
  CORRECTED_RECORD_FORM_SQL,
  GRAMMAR_CLAIM_SQL,
  lookup,
  RECORD_FORM_SQL,
  RECORD_SOURCE_LINE_SQL,
} from "../../src/lookup/lookup.js";
import { ENTRY_AGREEMENT_FACT_SQL } from "../../src/lookup/pageFacts.js";
import { OPTIONAL_TABLES_SQL } from "../../src/lookup/served.js";
import { entryKey, type LemmaTarget } from "../../src/lookup/types.js";
import { loadFixturePages, rawPageSource, readSavedPage } from "../../src/source/rawPage.js";
import { candidatesOf } from "@/worker/api/lookupAnswer.ts";
import { atFixtureLines } from "../../test/correctionFixture.js";

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
async function throughCandidatesOf(word: string, on: { db: LookupDatabase; releaseId: string } = { db, releaseId: RELEASE }): Promise<Light[]> {
  const result = await lookup({ db: on.db, releaseId: on.releaseId, query: word });
  if (result.outcome !== "found") return ["not found"];
  const readLemma = async (target: LemmaTarget) => {
    const lemma = await lookup({ db: on.db, releaseId: on.releaseId, query: target.word });
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
        id: `${candidate.releaseId}:${candidate.lineNo}`,
        lemma: candidate.word,
        pos: candidate.pos,
        pos_title: candidate.posTitle,
      }))
    : ["not found"];

/** A dictionary seeded from `lines` the way `pnpm run seed:dev` seeds D1, with the curated table cells `corrections`. */
async function seededWith(lines: readonly string[], releaseId: string, corrections: readonly CellCorrection[]): Promise<DatabaseSync> {
  const cellDir = await mkdtemp(join(tmpdir(), "lexema-batch-cells-"));
  try {
    const archive = join(cellDir, "fixture.jsonl.gz");
    await writeFile(archive, gzipSync(Buffer.from(`${lines.join("\n")}\n`, "utf8")));
    const { parts } = await seedSql({ input: archive, outputDir: join(cellDir, "sql"), schema: join(REPO, "src/db/schema.sql"), releaseId, license: "CC-BY-SA-4.0", corrections });
    const seededDb = new DatabaseSync(":memory:");
    for (const part of parts) seededDb.exec(await readFile(part, "utf8"));
    return seededDb;
  } finally {
    await rm(cellDir, { recursive: true, force: true });
  }
}

/** Whether a statement reads `corrected_form`, rather than only naming it, as the optional-tables read does. */
const readsCells = (sql: string): boolean => /\b(FROM|JOIN) corrected_form\b/.test(sql);

/**
 * A dictionary that keeps every statement it was asked. With `cellSearch`
 * false it reports no `corrected_form_by_key`, as a master whose
 * `corrected_form` predates the key does.
 */
function recording(over: LookupDatabase = db, { cellSearch = true } = {}): { db: LookupDatabase; asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    db: {
      async all<T>(sql: DictionaryRead, params: Parameters<LookupDatabase["all"]>[1]): Promise<T[]> {
        asked.push(sql);
        const rows = await over.all<T>(sql, params);
        return sql === OPTIONAL_TABLES_SQL && !cellSearch ? rows.filter((row) => (row as { name: string }).name !== "corrected_form_by_key") : rows;
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
    // Compound forms of essere verbs by rule `it-essere-agreement/v1` (#756), and two it does not read.
    ...["sono andata", "siamo andate", "Sono Andata", "ho mangiata", "sono andat"],
  ];
  const { release, answers } = await lookupBatch({ db, releaseId: RELEASE, queries: words });
  assert.equal(release.releaseId, RELEASE);
  assert.equal(answers.length, words.length);

  const expected = await Promise.all(words.map((word) => throughCandidatesOf(word)));
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

  // A schema.sql seed keys its corrected cells (#743), so the search reads them
  // in the same statement (#748); a master without the key reads the source alone.
  for (const [cellSearch, searchSql] of [[true, CORRECTED_CELL_BATCH_SEARCH_SQL], [false, BATCH_SEARCH_SQL]] as const) {
    const one = recording(db, { cellSearch });
    await lookupBatch({ db: one.db, releaseId: RELEASE, queries: ["andavano"] });
    const many = recording(db, { cellSearch });
    await lookupBatch({ db: many.db, releaseId: RELEASE, queries: [...spellings, "qqqqqq"] });

    for (const { asked } of [one, many]) {
      assert.equal(releaseReads(asked), 1, asked.join("\n---\n"));
      assert.equal(asked.filter((sql) => sql === searchSql).length, 1, asked.join("\n---\n"));
      if (!cellSearch) assert.ok(!asked.some(readsCells), asked.join("\n---\n"));
      // A schema.sql seed has `corrected_edge`, so the links read the corrected edges beside the source's (#722).
      assert.equal(asked.filter((sql) => sql === CORRECTED_BATCH_LEMMA_LINK_SQL).length, 1, asked.join("\n---\n"));
      assert.equal(asked.filter((sql) => sql === OPTIONAL_TABLES_SQL).length, 1, asked.join("\n---\n"));
      // The release and the optional tables (one D1 call), the search and the
      // lemma links: a single word nothing spells is never read word by word.
      assert.equal(asked.length, 4, asked.join("\n---\n"));
    }
  }
});

test("the batch's search and lemma-link reads stay on indexes rather than scanning", () => {
  const plan = (sql: string, ...params: string[]) =>
    (sqlite.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params) as { detail: string }[]).map((row) => row.detail);

  const search = plan(BATCH_SEARCH_SQL, RELEASE, JSON.stringify(["avere", "sale"]));
  assert.ok(!search.some((step) => /SCAN (lookup_form|grammar_claim|lf|g)\b/.test(step)), search.join("\n"));
  assert.ok(search.some((step) => step.includes("lookup_form_by_key")), search.join("\n"));
  assert.ok(search.some((step) => step.includes("grammar_claim_by_record")), search.join("\n"));

  // The corrected-cell arm (#748) probes `corrected_form` by its key, as the single lookup's does.
  const cells = plan(CORRECTED_CELL_BATCH_SEARCH_SQL, RELEASE, JSON.stringify(["siamo assorbiti, assorti", "sale"]));
  assert.ok(!cells.some((step) => /SCAN (corrected_form|lookup_form|grammar_claim|source_record|c|lf|r|g)\b/.test(step)), cells.join("\n"));
  assert.ok(cells.some((step) => /^SEARCH c USING INDEX corrected_form_by_key \(release_id=\? AND surface_key=\?\)/.test(step)), cells.join("\n"));
  assert.ok(cells.some((step) => step.includes("lookup_form_by_key")), cells.join("\n"));

  const links = plan(BATCH_LEMMA_LINK_SQL, JSON.stringify([1, 2]));
  assert.ok(!links.some((step) => /MATERIALIZE|SCAN lookup_form|SCAN form_of_edge/.test(step)), links.join("\n"));
  assert.ok(links.some((step) => step.includes("form_of_edge_by_record")), links.join("\n"));

  // With corrected edges (#722): each arm on its own index, a source edge's sense probed by the correction's key.
  const corrected = plan(CORRECTED_BATCH_LEMMA_LINK_SQL, JSON.stringify([1, 2]));
  assert.ok(!corrected.some((step) => /MATERIALIZE|SCAN (lookup_form|form_of_edge|corrected_edge|e|ce)\b/.test(step)), corrected.join("\n"));
  assert.ok(corrected.some((step) => /^SEARCH e USING INDEX \S*form_of_edge\S* \(record_id=\?/.test(step)), corrected.join("\n"));
  assert.ok(corrected.some((step) => /^SEARCH e USING INDEX sqlite_autoindex_corrected_edge_1 \(record_id=\?\)/.test(step)), corrected.join("\n"));
  assert.ok(corrected.some((step) => /^SEARCH ce USING COVERING INDEX sqlite_autoindex_corrected_edge_1 \(record_id=\? AND sense_index=\?\)/.test(step)), corrected.join("\n"));
});

test("a word's page-only entries come in entry_id order, as the single lookup reads them, heading the query or through a form", async () => {
  // `lungo` has no Italian record; its page gives an Aggettivo, then a
  // Preposizione (ADR 0028). Archive line 93815, `lunga`, is a form of it.
  const pageDir = await mkdtemp(join(tmpdir(), "lexema-batch-pages-"));
  const pageDb = new DatabaseSync(":memory:");
  try {
    const releaseId = "it-batch-page-test";
    const pages = await loadFixturePages(join(REPO, "fixtures"));
    const lungo = pages.page("lungo");
    assert.ok(lungo);
    const { parts } = await seedSql({
      input: join(REPO, "fixtures/page-entry-v2-forms.jsonl"),
      outputDir: join(pageDir, "sql"),
      schema: join(REPO, "src/db/schema.sql"),
      releaseId,
      rawPages: rawPageSource([lungo]),
    });
    for (const part of parts) pageDb.exec(await readFile(part, "utf8"));
    const read = fromNodeSqlite(pageDb);

    const entries = pageDb.prepare("SELECT entry_id, pos FROM recovered_entry WHERE word = 'lungo' ORDER BY entry_id").all() as { entry_id: number; pos: string }[];
    assert.deepEqual(entries.map((entry) => entry.pos), ["adj", "prep"]);
    const [adj, prep] = entries.map((entry) => `page-${entry.entry_id}`);

    // The single path: a whole lookup of the word, and of each lemma a form-of reading names.
    const single = async (word: string): Promise<string[]> => {
      const result = await lookup({ db: read, releaseId, query: word });
      assert.ok(result.outcome === "found", word);
      const readLemma = async (target: LemmaTarget) => {
        const lemma = await lookup({ db: read, releaseId, query: target.word });
        return lemma.outcome === "found" ? lemma.readings.find((reading) => entryKey(reading) === entryKey(target)) : undefined;
      };
      return (await candidatesOf(result, readLemma)).map(({ reading }) => entryKey(reading));
    };

    const words = ["lungo", "lunga"];
    const { answers } = await lookupBatch({ db: read, releaseId, queries: words });
    const batch = answers.map((answer) => {
      assert.ok(answer.outcome === "found");
      return answer.candidates.map((candidate) => (candidate.recordId === undefined ? `page-${candidate.entryId}` : String(candidate.recordId)));
    });

    const lunga = pageDb.prepare("SELECT record_id FROM source_record WHERE word = 'lunga'").get() as { record_id: number };
    // The word itself: the form whose table spells it, then both entries, the adjective first.
    assert.deepEqual(batch[0], [String(lunga.record_id), adj, prep]);
    // Its form reaches it through `form_of`; the form's part of speech keeps the adjective.
    assert.deepEqual(batch[1], [adj]);
    for (const [at, word] of words.entries()) assert.deepEqual(batch[at], await single(word), word);

    // The form's edge itself names both entries, in entry_id order.
    const links = pageDb.prepare(BATCH_LEMMA_LINK_SQL).all(JSON.stringify([lunga.record_id]), releaseId) as { candidate_entry_id: number }[];
    assert.deepEqual(links.map((link) => `page-${link.candidate_entry_id}`), [adj, prep]);
  } finally {
    pageDb.close();
    await rm(pageDir, { recursive: true, force: true });
  }
});

test("the batch finds a curated table cell by its corrected spelling and by the source's, as the single lookup does, and only where the master keys it (#748)", async () => {
  // assorbire's plural essere cells (ADR 0030, #723): release it-0c432803's
  // line 113784 verbatim, beside three verbs of the same shape.
  const releaseId = "it-batch-cells";
  const lines = (await readFile(join(REPO, "fixtures/essere-compound-cells.jsonl"), "utf8")).trimEnd().split("\n");
  const [assorbire] = cellCorrections(CURATED_CORRECTIONS);
  const keyed: CellCorrection[] = atFixtureLines(lines, releaseId, [assorbire]);
  const seeded = (corrections: readonly CellCorrection[]): Promise<DatabaseSync> => seededWith(lines, releaseId, corrections);
  const corrected = await seeded(keyed);
  const source = await seeded([]);
  // The same corrected rows on a master whose `corrected_form` predates its key.
  const unkeyed = await seeded(keyed);
  unkeyed.exec("DROP INDEX corrected_form_by_key");
  try {
    const cells = keyed.flatMap((correction) => correction.cells);
    const spellings = [...new Set(cells.map((cell) => cell.surface))];
    const replaced = [...new Set(cells.map((cell) => cell.replaces))];
    assert.ok(spellings.length > 1 && spellings.every((spelling) => !replaced.includes(spelling)));
    const words = [...spellings, ...replaced, "assorbire", "accorgersi", "qqqqqq"];

    const batchOf = async (read: DatabaseSync) => {
      const asked = recording(fromNodeSqlite(read));
      const { answers } = await lookupBatch({ db: asked.db, releaseId, queries: words });
      return { answers: answers.map(light), asked: asked.asked };
    };
    const singleOf = (read: DatabaseSync) => Promise.all(words.map((word) => throughCandidatesOf(word, { db: fromNodeSqlite(read), releaseId })));

    // Keyed: each corrected spelling finds assorbire, and each source spelling what it found before.
    const keyedBatch = await batchOf(corrected);
    const keyedSingle = await singleOf(corrected);
    for (const [at, word] of words.entries()) assert.deepEqual(keyedBatch.answers[at], keyedSingle[at], word);
    for (const spelling of spellings) {
      const answer = keyedBatch.answers[words.indexOf(spelling)];
      assert.deepEqual(answer.map((candidate) => candidate !== "not found" && candidate.lemma), ["assorbire"], spelling);
    }
    assert.equal(keyedBatch.asked.filter((sql) => sql === CORRECTED_CELL_BATCH_SEARCH_SQL).length, 1);
    const sourceBatch = await batchOf(source);
    for (const spelling of replaced) assert.deepEqual(keyedBatch.answers[words.indexOf(spelling)], sourceBatch.answers[words.indexOf(spelling)], spelling);

    // Unkeyed: no statement reads `corrected_form`, and every answer is the source's.
    const unkeyedBatch = await batchOf(unkeyed);
    assert.ok(!unkeyedBatch.asked.some(readsCells), unkeyedBatch.asked.join("\n---\n"));
    assert.deepEqual(unkeyedBatch.answers, sourceBatch.answers);
    assert.deepEqual(unkeyedBatch.answers, await singleOf(unkeyed));

    // A cell set to another record's own spelling is a candidate beside that record, in source order.
    corrected.exec("UPDATE corrected_form SET surface = 'accorgersi', surface_key = 'accorgersi' WHERE form_index = 36");
    const [both] = (await lookupBatch({ db: fromNodeSqlite(corrected), releaseId, queries: ["accorgersi"] })).answers.map(light);
    assert.deepEqual(both.map((candidate) => candidate !== "not found" && candidate.lemma), ["accorgersi", "assorbire"]);
    assert.deepEqual(both, await throughCandidatesOf("accorgersi", { db: fromNodeSqlite(corrected), releaseId }));
  } finally {
    corrected.close();
    source.close();
    unkeyed.close();
  }
});

/** Whether a statement is the batch's agreement read, on either kind of master. */
const readsAgreement = (sql: string): boolean => sql === BATCH_AGREEMENT_SQL || sql === CORRECTED_CELL_BATCH_AGREEMENT_SQL;

test("the batch reads an essere verb's compound form by rule it-essere-agreement/v1, as the single lookup does (#756)", async () => {
  // The development fixture and the lines of accorgersi, arrendersi, assorbire
  // and perdersi, with assorbire's corrected cells keyed where the master keys them.
  const releaseId = "it-batch-agreement";
  const lines = [
    ...(await readFile(join(REPO, "fixtures/dev-seed.jsonl"), "utf8")).trimEnd().split("\n"),
    ...(await readFile(join(REPO, "fixtures/essere-compound-cells.jsonl"), "utf8")).trimEnd().split("\n"),
  ];
  const [assorbire] = cellCorrections(CURATED_CORRECTIONS);
  const corrected = await seededWith(lines, releaseId, atFixtureLines(lines, releaseId, [assorbire]));
  const source = await seededWith(lines, releaseId, []);
  try {
    const words = ["sono andata", "siamo andate", "mi sono arresa", "mi sono arreso", "siamo assorbite", "sono andato", "ho mangiata", "qqqqqq"];
    for (const [read, expectedRoutes] of [
      [corrected, ["feminine", "feminine", "feminine", "first-spelling", "feminine", "surface", "not-found", "not-found"]],
      // Without assorbire's corrected cell, `siamo assorbite` names no cell the source lists.
      [source, ["feminine", "feminine", "feminine", "first-spelling", "not-found", "surface", "not-found", "not-found"]],
    ] as const) {
      const on = { db: fromNodeSqlite(read), releaseId };
      // Each word's route through the single lookup, so the routes the criterion names are all covered.
      const routes = await Promise.all(
        words.map(async (word) => {
          const result = await lookup({ ...on, query: word });
          return result.outcome === "found" ? result.route.kind : result.outcome;
        }),
      );
      assert.deepEqual(routes, expectedRoutes);

      const { answers } = await lookupBatch({ ...on, queries: words });
      const single = await Promise.all(words.map((word) => throughCandidatesOf(word, on)));
      for (const [at, word] of words.entries()) assert.deepEqual(light(answers[at]), single[at], word);

      const lemmas = (word: string) => light(answers[words.indexOf(word)]).map((candidate) => candidate !== "not found" && candidate.lemma);
      assert.deepEqual(lemmas("sono andata"), ["andare"]);
      assert.deepEqual(lemmas("mi sono arresa"), ["arrendersi"]);
      assert.deepEqual(lemmas("mi sono arreso"), ["arrendersi"]);
      assert.deepEqual(lemmas("siamo assorbite"), read === corrected ? ["assorbire"] : [false]);
    }
  } finally {
    corrected.close();
    source.close();
  }
});

test("a batch of words without the agreement rule's shape sends no agreement read and keeps its answers (#756)", async () => {
  // `sono andato` has the shape, but the search spells it, so it is not asked either.
  const words = ["casa", "ho mangiata", "sono andat", "sono andato", "qqqqqq"];
  const asked = recording();
  const { answers } = await lookupBatch({ db: asked.db, releaseId: RELEASE, queries: words });
  assert.ok(!asked.asked.some(readsAgreement), asked.asked.join("\n---\n"));
  for (const [at, word] of words.entries()) assert.deepEqual(light(answers[at]), await throughCandidatesOf(word), word);
  assert.deepEqual(light(answers[words.indexOf("ho mangiata")]), ["not found"]);
  assert.deepEqual(light(answers[words.indexOf("sono andat")]), ["not found"]);
});

test("a batch with agreement-route words runs the same statements for a few words or a hundred, the agreement read once (#756)", async () => {
  const spellings = (sqlite.prepare("SELECT DISTINCT surface FROM lookup_form ORDER BY surface LIMIT 100").all() as { surface: string }[]).map(
    (row) => row.surface,
  );
  // The few send every statement a batch can: the search and its links, the
  // multi-word reading's words, participles and headwords, and the agreement read.
  const one = recording();
  await lookupBatch({ db: one.db, releaseId: RELEASE, queries: ["andavano", "sono andata", "è andata"] });
  // Compound forms of many verbs: each verb's participle is not a statement of its own.
  const compounds = ["sono vissuta", "sono finita", "sono partita", "sono venuta", "sono morta", "sono salita", "siamo andate", "è andata", "eravamo partite", "ho mangiata"];
  const many = recording();
  await lookupBatch({ db: many.db, releaseId: RELEASE, queries: [...spellings, "qqqqqq", ...compounds] });
  const { answers } = await lookupBatch({ db, releaseId: RELEASE, queries: compounds });
  for (const [at, word] of compounds.entries()) assert.deepEqual(light(answers[at]), await throughCandidatesOf(word), word);
  assert.ok(answers.filter((answer) => answer.outcome === "found").length > 5, JSON.stringify(answers.map(light)));

  for (const { asked } of [one, many]) {
    assert.equal(asked.filter((sql) => sql === CORRECTED_CELL_BATCH_AGREEMENT_SQL).length, 1, asked.join("\n---\n"));
    assert.equal(asked.filter((sql) => sql === CORRECTED_CELL_BATCH_SEARCH_SQL).length, 1, asked.join("\n---\n"));
  }
  // The same statements, whatever order the concurrent reads went out in.
  assert.deepEqual([...many.asked].sort(), [...one.asked].sort());
  // The release and the optional tables, the search, the links, the words, the participles, the headwords, the agreement.
  assert.equal(one.asked.length, 8, one.asked.join("\n---\n"));
});

test("the batch's agreement read stays on indexes rather than scanning (#756)", () => {
  const plan = (sql: string, ...params: string[]) =>
    (sqlite.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params) as { detail: string }[]).map((row) => row.detail);
  const params = [RELEASE, JSON.stringify(["sono andato"]), JSON.stringify([["sono andato, ", "sono andato,!"]])];

  const source = plan(BATCH_AGREEMENT_SQL, ...params);
  assert.ok(!source.some((step) => /SCAN (lookup_form|grammar_claim|source_record|lf|r|g)\b/.test(step)), source.join("\n"));
  assert.ok(source.some((step) => /^SEARCH lf USING INDEX lookup_form_by_key \(release_id=\? AND surface_key=\?\)/.test(step)), source.join("\n"));
  assert.ok(source.some((step) => /^SEARCH lf USING INDEX lookup_form_by_key \(release_id=\? AND surface_key>\? AND surface_key<\?\)/.test(step)), source.join("\n"));
  assert.ok(source.some((step) => step.includes("grammar_claim_by_record")), source.join("\n"));

  const cells = plan(CORRECTED_CELL_BATCH_AGREEMENT_SQL, ...params);
  assert.ok(!cells.some((step) => /SCAN (corrected_form|lookup_form|grammar_claim|source_record|c|lf|r|g)\b/.test(step)), cells.join("\n"));
  assert.ok(cells.some((step) => /^SEARCH c USING INDEX corrected_form_by_key \(release_id=\? AND surface_key=\?\)/.test(step)), cells.join("\n"));
  assert.ok(cells.some((step) => /^SEARCH c USING INDEX corrected_form_by_key \(release_id=\? AND surface_key>\? AND surface_key<\?\)/.test(step)), cells.join("\n"));
});

/** The statements the batch reads a word typed with its article with (#766): its readings' lines, grammar, corrections and forms, and its page entries' facts. */
const ARTICLE_READS: readonly string[] = [RECORD_SOURCE_LINE_SQL, GRAMMAR_CLAIM_SQL, CORRECTED_CLAIM_SQL, RECORD_FORM_SQL, CORRECTED_RECORD_FORM_SQL, ENTRY_AGREEMENT_FACT_SQL];
const readsArticles = (sql: string): boolean => ARTICLE_READS.includes(sql);

/**
 * `fixtures/article-query.jsonl`, the verbatim lines of release it-0c432803
 * test/articleLookup.test.ts reads (macchina, acqua, riso, porta, ancora,
 * zaini, `una volta`, ...), seeded the way `pnpm run seed:dev` seeds D1.
 */
const ARTICLE_RELEASE = "it-batch-article";
let articleSqlite: DatabaseSync;
let articleDb: LookupDatabase;

before(async () => {
  const lines = (await readFile(join(REPO, "fixtures/article-query.jsonl"), "utf8")).trimEnd().split("\n");
  articleSqlite = await seededWith(lines, ARTICLE_RELEASE, []);
  articleDb = fromNodeSqlite(articleSqlite);
});

after(() => articleSqlite.close());

/** Each word's route through the single lookup, or its outcome when nothing finds it. */
const routesOf = (words: readonly string[], on: LookupDatabase, releaseId: string): Promise<string[]> =>
  Promise.all(
    words.map(async (word) => {
      const result = await lookup({ db: on, releaseId, query: word });
      return result.outcome === "found" ? result.route.kind : result.outcome;
    }),
  );

test("the batch reads a word typed with its article by rule it-article-query/v1, in the single lookup's order (#766)", async () => {
  const words = ["una macchina", "la macchina", "un macchina", "le macchine", "l'acqua", "l’acqua", "un'auto", "gli zaini", "il riso", "la porta", "l'ancora", "lo porta"];
  assert.deepEqual(await routesOf(words, articleDb, ARTICLE_RELEASE), words.map(() => "article"));

  const { answers } = await lookupBatch({ db: articleDb, releaseId: ARTICLE_RELEASE, queries: [...words, "porta", "riso"] });
  const on = { db: articleDb, releaseId: ARTICLE_RELEASE };
  for (const [at, word] of words.entries()) assert.deepEqual(light(answers[at]), await throughCandidatesOf(word, on), word);

  const shapes = (at: number) => light(answers[at]).map((candidate) => candidate !== "not found" && `${candidate.lemma} ${candidate.pos}`);
  assert.deepEqual(shapes(words.indexOf("una macchina")), ["macchina noun", "macchinare verb"]);
  assert.deepEqual(shapes(words.indexOf("l'acqua")), ["acqua noun"]);
  assert.deepEqual(shapes(words.indexOf("l’acqua")), ["acqua noun"]);
  // The article puts the reading that takes it first: porta's adjective, then
  // its noun, alone; `la porta` the noun. riso's first noun is stated
  // invariable and takes no article, so `il riso` is the second noun's.
  assert.deepEqual(shapes(words.length), ["porta adj", "porta noun", "porta verb"]);
  assert.deepEqual(shapes(words.indexOf("la porta")), ["porta noun", "porta adj", "porta verb"]);
  const riso = light(answers[words.length + 1]);
  const ilRiso = light(answers[words.indexOf("il riso")]);
  assert.deepEqual(ilRiso, [riso[1], riso[0], ...riso.slice(2)]);
});

test("a batch of words the article route does not answer sends no article read and keeps its answers (#766)", async () => {
  // Without the rule's shape, then a headword and a phrase of its shape, which earlier routes answer.
  const words = ["della macchina", "la", "la macchina rossa", "una volta", "una volte", "macchina", "qqqqqq"];
  assert.deepEqual(await routesOf(words, articleDb, ARTICLE_RELEASE), ["not-found", "not-found", "not-found", "surface", "phrase", "surface", "not-found"]);
  const asked = recording(articleDb);
  const { answers } = await lookupBatch({ db: asked.db, releaseId: ARTICLE_RELEASE, queries: words });
  assert.ok(!asked.asked.some(readsArticles), asked.asked.join("\n---\n"));
  const on = { db: articleDb, releaseId: ARTICLE_RELEASE };
  for (const [at, word] of words.entries()) assert.deepEqual(light(answers[at]), await throughCandidatesOf(word, on), word);
});

test("a batch with article-route words runs the same statements for a few words or a hundred, each article read once (#766)", async () => {
  const surfaces = (sql: string) => (articleSqlite.prepare(sql).all() as { surface: string }[]).map((row) => row.surface);
  const spellings = surfaces("SELECT DISTINCT surface FROM lookup_form ORDER BY surface LIMIT 30");
  const headwords = surfaces("SELECT DISTINCT surface FROM lookup_form WHERE origin = 'headword' AND surface NOT LIKE '% %' ORDER BY surface");
  const few = recording(articleDb);
  await lookupBatch({ db: few.db, releaseId: ARTICLE_RELEASE, queries: ["la porta", "l'acqua", "porta"] });
  // Spellings, and each headword with every article: most agree with nothing, and none is a statement of its own.
  const articled = headwords.flatMap((word) => ["il", "lo", "la", "i", "gli", "le", "un", "uno", "una"].map((article) => `${article} ${word}`));
  const words = [...spellings, ...articled].slice(0, 100);
  assert.equal(words.length, 100);
  const many = recording(articleDb);
  const { answers } = await lookupBatch({ db: many.db, releaseId: ARTICLE_RELEASE, queries: words });
  assert.ok(answers.filter((answer, at) => answer.outcome === "found" && words[at].includes(" ")).length > 10);
  const on = { db: articleDb, releaseId: ARTICLE_RELEASE };
  for (const [at, word] of words.entries()) assert.deepEqual(light(answers[at]), await throughCandidatesOf(word, on), word);

  for (const { asked } of [few, many]) {
    // A schema.sql seed has `corrected_claim` and `corrected_form`, so the corrected reads are the ones sent.
    for (const sql of [RECORD_SOURCE_LINE_SQL, GRAMMAR_CLAIM_SQL, CORRECTED_CLAIM_SQL, CORRECTED_RECORD_FORM_SQL]) {
      assert.equal(asked.filter((one) => one === sql).length, 1, asked.join("\n---\n"));
    }
    assert.equal(asked.filter((sql) => sql === CORRECTED_CELL_BATCH_SEARCH_SQL).length, 1, asked.join("\n---\n"));
  }
  assert.deepEqual([...many.asked].sort(), [...few.asked].sort());
});

test("the batch orders a page-only entry by the articles its page facts give, as the single lookup does (#766)", async () => {
  // mastoide (fixtures/upstream-pages) is a page-only feminine noun;
  // avventurieri (fixtures/page-facts) gives an adjective, then a masculine plural noun.
  const pageDir = await mkdtemp(join(tmpdir(), "lexema-batch-article-pages-"));
  const pageDb = new DatabaseSync(":memory:");
  try {
    const releaseId = "it-batch-article-pages";
    const mastoide = (await loadFixturePages(join(REPO, "fixtures"))).page("mastoide");
    assert.ok(mastoide);
    const avventurieri = readSavedPage(await readFile(join(REPO, "fixtures/page-facts/avventurieri.wikitext"), "utf8"), "avventurieri.wikitext");
    const { parts } = await seedSql({
      input: join(REPO, "fixtures/page-entry-forms.jsonl"),
      outputDir: join(pageDir, "sql"),
      schema: join(REPO, "src/db/schema.sql"),
      releaseId,
      rawPages: rawPageSource([mastoide, avventurieri]),
    });
    for (const part of parts) pageDb.exec(await readFile(part, "utf8"));
    const read = fromNodeSqlite(pageDb);

    const words = ["la mastoide", "gli avventurieri", "un avventurieri", "avventurieri"];
    assert.deepEqual(await routesOf(words, read, releaseId), ["article", "article", "article", "surface"]);
    const single = async (word: string): Promise<string[]> => {
      const result = await lookup({ db: read, releaseId, query: word });
      assert.ok(result.outcome === "found", word);
      return (await candidatesOf(result, async () => undefined)).map(({ reading }) => `${entryKey(reading)} ${reading.pos}`);
    };
    const asked = recording(read);
    const { answers } = await lookupBatch({ db: asked.db, releaseId, queries: words });
    const batch = answers.map((answer) => {
      assert.ok(answer.outcome === "found");
      // As `entryKey` names a reading.
      return answer.candidates.map((candidate) => `${candidate.recordId === undefined ? `page-${candidate.entryId}` : candidate.recordId} ${candidate.pos}`);
    });
    for (const [at, word] of words.entries()) assert.deepEqual(batch[at], await single(word), word);
    const [glAvventurieri, unAvventurieri, alone] = batch.slice(1);
    assert.deepEqual(alone.map((candidate) => candidate.split(" ")[1]), ["adj", "noun"]);
    assert.deepEqual(glAvventurieri, [alone[1], alone[0]]);
    assert.deepEqual(unAvventurieri, alone);
    assert.equal(asked.asked.filter((sql) => sql === ENTRY_AGREEMENT_FACT_SQL).length, 1, asked.asked.join("\n---\n"));
  } finally {
    pageDb.close();
    await rm(pageDir, { recursive: true, force: true });
  }
});

test("the batch's article reads stay on indexes rather than scanning (#766)", () => {
  const plan = (sql: string, ...params: string[]) =>
    (sqlite.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params) as { detail: string }[]).map((row) => row.detail);
  const keys = JSON.stringify([1, 2]);
  for (const sql of ARTICLE_READS) {
    const steps = plan(sql, keys);
    assert.ok(
      !steps.some((step) => /SCAN (source_record|source_record_json|grammar_claim|corrected_claim|lookup_form|corrected_form|entry_fact|recovered_entry|raw_page|r|j|f|c|e|p)\b/.test(step)),
      `${sql}\n${steps.join("\n")}`,
    );
  }
  const facts = plan(ENTRY_AGREEMENT_FACT_SQL, keys);
  assert.ok(facts.some((step) => /^SEARCH f USING (PRIMARY KEY|INDEX sqlite_autoindex_entry_fact_1) \(entry_id=\?\)/.test(step)), facts.join("\n"));
});
