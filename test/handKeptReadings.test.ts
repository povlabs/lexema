// Hand-kept readings (ADR 0031, #745): the committed list, checked against the
// verbatim en.wiktionary revisions each reading cites; the type and the table
// that refuse an invalid reading; the rows the seed writes, read back through
// `lookup()` beside the source's own readings; and `correct:records` writing
// them into a master seeded before them. Inputs are verbatim: archive lines
// 963 `si`, 113594 and 113595 `come` of it-0c432803, and revisions 93469502
// `si` and 93379611 `come` of en.wiktionary (fixtures/hand-kept-readings/).

import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { evidenceUrl } from "../src/italian/curatedCorrections.js";
import {
  HAND_KEPT_READINGS,
  handKeptId,
  handKeptReading,
  InvalidHandKeptReading,
  type HandKeptReading,
  type HandKeptReadingSpec,
} from "../src/italian/handKeptReadings.js";
import { statedPartOfSpeech } from "../src/italian/partOfSpeech.js";
import { describeReading, missingForCorrections, planCorrections, unwritten } from "../src/import/correctRecords.js";
import { COLUMNS, seedSql, tupleOf } from "../src/import/seedSql.js";
import { handKeptRows } from "../src/import/handKeptRows.js";
import { touchedWords, wordsOfCorrections } from "../src/deploy/touchedWords.js";
import { fromNodeSqlite } from "../src/lookup/database.js";
import { lookup } from "../src/lookup/lookup.js";
import { servedVersion, versionToken } from "../src/lookup/served.js";
import { entryKey, type Reading } from "../src/lookup/types.js";
import type { MasterReader } from "../src/update/master.js";
import { masterUpgradeSql } from "../src/update/masterUpgrade.js";
import { PlanCounts } from "../src/update/planCounts.js";

const RELEASE = "it-hand-kept";
const SCHEMA = "src/db/schema.sql";
const FIXTURES = resolve("fixtures/hand-kept-readings");
const ARCHIVE_LINES = (await readFile(join(FIXTURES, "archive-lines.jsonl"), "utf8")).trimEnd().split("\n");
const revisionLines = async (title: string): Promise<string[]> => (await readFile(join(FIXTURES, `${title}.wikitext`), "utf8")).split("\n");

const readingOf = (word: string): HandKeptReading => {
  const reading = HAND_KEPT_READINGS.find((one) => one.word === word);
  assert.ok(reading, word);
  return reading;
};

/** The heading level of a wikitext line, `====Pronoun====` 4; 0 for a line that heads nothing. */
const levelOf = (line: string): number => {
  const match = /^(=+)[^=].*[^=]\1\s*$/.exec(line);
  return match === null ? 0 : match[1].length;
};

test("the list keeps exactly si's pronoun and come's conjunction, each as its cited revision shows it", async () => {
  assert.deepEqual(HAND_KEPT_READINGS.map((reading) => [handKeptId(reading), reading.partOfSpeech.posTitle, reading.evidence.map(evidenceUrl)]), [
    ["si:pron", "Pronome", ["https://en.wiktionary.org/w/index.php?title=si&oldid=93469502"]],
    ["come:conj", "Congiunzione", ["https://en.wiktionary.org/w/index.php?title=come&oldid=93379611"]],
  ]);
  const etymologyOf = { si: "===Etymology 1===", come: undefined } as Record<string, string | undefined>;
  for (const reading of HAND_KEPT_READINGS) {
    const [evidence] = reading.evidence;
    const lines = await revisionLines(evidence.title);
    const at = (line: number): string => lines[line - 1];
    const { section } = reading;
    // The section heading is where the entry says, inside the revision's Italian section.
    assert.equal(at(section.line), section.wikitext, reading.word);
    const italian = lines.indexOf("==Italian==") + 1;
    assert.ok(italian > 0 && italian < section.line);
    assert.ok(lines.slice(italian, section.line - 1).every((line) => levelOf(line) !== 2), `${reading.word}: the section is Italian`);
    // What the revision shows that settles the reading: the section's headword line.
    assert.equal(at(section.line + 1), evidence.shows);
    // si's pronoun is its Etymology 1, not the Etymology 2 noun the source has.
    const enclosing = lines.slice(italian, section.line - 1).filter((line) => levelOf(line) === 3).at(-1);
    if (etymologyOf[reading.word] !== undefined) assert.equal(enclosing, etymologyOf[reading.word]);
    // Every definition paraphrases a sense line of that section, quoted verbatim.
    const end = lines.findIndex((line, i) => i >= section.line && levelOf(line) > 0 && levelOf(line) <= levelOf(section.wikitext)) + 1;
    for (const { paraphrases, text } of reading.definitions) {
      assert.equal(at(paraphrases.line), paraphrases.wikitext);
      assert.match(paraphrases.wikitext, /^# /);
      assert.ok(paraphrases.line > section.line && paraphrases.line < end, `${reading.word}: line ${paraphrases.line} is in its section`);
      assert.notEqual(text, "");
    }
    assert.equal(reading.ruling, "https://github.com/povlabs/lexema/issues/745#issuecomment-6080245573");
  }
});

const SI_SPEC: HandKeptReadingSpec = { ...readingOf("si") };

test("a reading without a word, a closed part of speech, a definition or an en.wiktionary permanent link cannot be made", () => {
  const refused = (spec: HandKeptReadingSpec) => assert.throws(() => handKeptReading(spec), InvalidHandKeptReading);
  refused({ ...SI_SPEC, word: "" });
  refused({ ...SI_SPEC, word: " si" });
  refused({ ...SI_SPEC, definitions: [{ ...SI_SPEC.definitions[0], text: "   " }] });
  refused({ ...SI_SPEC, definitions: [SI_SPEC.definitions[0], SI_SPEC.definitions[0]] });
  refused({ ...SI_SPEC, evidence: [{ ...SI_SPEC.evidence[0], revisionId: 0 }] });
  refused({ ...SI_SPEC, evidence: [{ ...SI_SPEC.evidence[0], title: "" }] });
  refused({ ...SI_SPEC, ruling: "yes" });
  // The type refuses what the check refuses again at run time.
  // @ts-expect-error a reading has at least one definition
  refused({ ...SI_SPEC, definitions: [] });
  // @ts-expect-error a reading cites at least one revision
  refused({ ...SI_SPEC, evidence: [] });
  // @ts-expect-error only en.wiktionary is cited
  refused({ ...SI_SPEC, evidence: [{ ...SI_SPEC.evidence[0], wiki: "it.wiktionary.org" }] });
  // @ts-expect-error a title and a part of speech that disagree are no pair
  refused({ ...SI_SPEC, partOfSpeech: { posTitle: "Pronome", pos: "conj" } });
  // @ts-expect-error `pronoun` is not in the closed set
  refused({ ...SI_SPEC, partOfSpeech: { posTitle: "Pronome", pos: "pronoun" } });
  assert.deepEqual(handKeptReading(SI_SPEC).partOfSpeech, statedPartOfSpeech("Pronome"));
  // @ts-expect-error a spec is not a reading until `handKeptReading` checks it
  const unchecked: HandKeptReading = SI_SPEC;
  assert.ok(unchecked);
});

interface Seeded {
  db: DatabaseSync;
  readingsOf: (word: string) => Promise<Reading[]>;
}

const all = (db: DatabaseSync, sql: string): unknown[] => db.prepare(sql).all().map((row) => ({ ...row }));

async function seeded(readings: readonly HandKeptReading[] | undefined): Promise<DatabaseSync> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-hand-kept-"));
  try {
    const archive = join(dir, "fixture.jsonl.gz");
    await writeFile(archive, gzipSync(await readFile(join(FIXTURES, "archive-lines.jsonl"))));
    const report = await seedSql({
      input: archive,
      outputDir: join(dir, "sql"),
      schema: SCHEMA,
      releaseId: RELEASE,
      license: "CC-BY-SA-4.0",
      handKeptReadings: readings,
      onRejection: (rejection) => {
        throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
      },
    });
    const db = new DatabaseSync(":memory:");
    for (const part of report.parts) db.exec(await readFile(part, "utf8"));
    return db;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function withSeed(readings: readonly HandKeptReading[] | undefined, run: (seed: Seeded) => Promise<void>): Promise<void> {
  const db = await seeded(readings);
  try {
    await run({
      db,
      readingsOf: async (word) => {
        const result = await lookup({ db: fromNodeSqlite(db), releaseId: RELEASE, query: word });
        assert.ok(result.outcome === "found", word);
        return result.readings;
      },
    });
  } finally {
    db.close();
  }
}

/** A reading as a page tells it apart: its identity, part of speech and definitions' text. */
const shown = (reading: Reading) => [entryKey(reading), reading.pos, reading.posTitle, [...reading.senses.flatMap((sense) => sense.glosses.map((gloss) => gloss.text)), ...reading.recovered.map((definition) => definition.text)]];
const textsOf = (reading: HandKeptReading): string[] => reading.definitions.map((definition) => definition.text);

test("a lookup reads each hand-kept reading beside the source's readings, as an ordinary reading", async () => {
  const plain = await seeded([]);
  try {
    await withSeed(undefined, async ({ db, readingsOf }) => {
      const si = await readingsOf("si");
      assert.deepEqual(si.map((reading) => [reading.recordId === undefined ? entryKey(reading) : "record", reading.pos]), [["record", "noun"], ["kept-si:pron", "pron"]]);
      assert.deepEqual(shown(si[1]), ["kept-si:pron", "pron", "Pronome", textsOf(readingOf("si"))]);
      const come = await readingsOf("come");
      assert.deepEqual(come.map((reading) => reading.pos), ["adv", "prep", "conj"]);
      assert.deepEqual(shown(come[2]), ["kept-come:conj", "conj", "Congiunzione", textsOf(readingOf("come"))]);

      // Plain data, with no correction and nothing else that marks where it came from (ADR 0016).
      const [, pronoun] = si;
      assert.equal(pronoun.isAboutQuery, true);
      assert.deepEqual(pronoun.ref, {
        releaseId: RELEASE, wiki: "en.wiktionary.org", title: "si", revisionId: 93469502, timestamp: "2026-10-09T07:58:42Z", line: 952, wikitext: "====Pronoun====",
      });
      for (const definition of pronoun.recovered) {
        assert.equal(definition.correction, null);
        assert.deepEqual([definition.labels, definition.examples, definition.items], [[], [], []]);
      }
      assert.deepEqual(pronoun.recovered.map((definition) => definition.ref.line), [955, 959, 961, 966]);

      // The source's records stay byte for byte: their lines and every imported row.
      assert.deepEqual(all(db, "SELECT raw_json FROM source_record_json ORDER BY record_id").map((row) => (row as { raw_json: string }).raw_json), ARCHIVE_LINES);
      for (const table of ["source_record", "source_record_json", "lookup_form", "sense", "sense_gloss", "grammar_claim", "form_of_edge"]) {
        assert.deepEqual(all(db, `SELECT * FROM ${table}`), all(plain, `SELECT * FROM ${table}`), table);
      }
      assert.deepEqual(all(db, "SELECT reading_id, count(*) AS n FROM hand_kept_definition GROUP BY reading_id ORDER BY reading_id"), [
        { reading_id: "come:conj", n: 1 },
        { reading_id: "si:pron", n: 4 },
      ]);
    });
    // Without the list, si is only its noun.
    await withSeed([], async ({ readingsOf }) => {
      assert.deepEqual((await readingsOf("si")).map((reading) => reading.pos), ["noun"]);
    });
  } finally {
    plain.close();
  }
});

test("the table refuses a row with no word, a part of speech outside the set, a blank definition or another wiki's link", async () => {
  const db = await seeded([]);
  try {
    const [row] = handKeptRows(readingOf("come"));
    const insert = (values: unknown[]) => db.exec(`INSERT INTO hand_kept_definition (${COLUMNS.hand_kept_definition}) VALUES ${tupleOf("hand_kept_definition", values)}`);
    const columns = COLUMNS.hand_kept_definition.split(",");
    const at = (column: string, value: unknown): unknown[] => row.map((cell, i) => (columns[i] === column ? value : cell));
    for (const bad of [
      at("word", ""),
      at("pos", "pronoun"),
      at("text", "  "),
      at("evidence_url", "https://it.wiktionary.org/w/index.php?title=come&oldid=4075938"),
      at("evidence_url", "https://en.wiktionary.org/wiki/come"),
      at("reading_id", "come:adv"),
      at("page_line", 1000),
    ]) {
      assert.throws(() => insert(bad), /CHECK constraint failed/, JSON.stringify(bad));
    }
    insert(row);
    assert.deepEqual(all(db, "SELECT count(*) AS n FROM hand_kept_definition"), [{ n: 1 }]);
  } finally {
    db.close();
  }
});

const readerOf = (db: DatabaseSync): MasterReader => ({ query: <Row>(sql: string) => db.prepare(sql).all() as Row[] });

/** Run the plan's SQL as one transaction, as `wrangler d1 execute --file` does. */
function execute(db: DatabaseSync, sql: string): void {
  db.exec("BEGIN");
  try {
    db.exec(sql);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

test("correct:records writes the readings into a master seeded before them, once, and reads them back", async () => {
  const schema = await readFile(SCHEMA, "utf8");
  const fresh = await seeded(undefined);
  const before = await seeded([]);
  try {
    // A master seeded before #745: no hand_kept_definition.
    before.exec("DROP INDEX hand_kept_definition_by_key; DROP TABLE hand_kept_definition;");
    const lookupOf = async (word: string) => {
      const result = await lookup({ db: fromNodeSqlite(before), releaseId: RELEASE, query: word });
      assert.ok(result.outcome === "found");
      return result.readings.map((reading) => reading.pos);
    };
    assert.deepEqual(await lookupOf("si"), ["noun"]);
    const versionBefore = versionToken(await servedVersion(fromNodeSqlite(before), RELEASE));
    const recordsBefore = all(before, "SELECT * FROM source_record_json ORDER BY record_id");

    const reader = readerOf(before);
    const plan = planCorrections(reader, [], HAND_KEPT_READINGS);
    assert.deepEqual(plan.readings.map(describeReading), ["  kept:si:pron: written, 4 definition(s)", "  kept:come:conj: written, 1 definition(s)"]);
    // A reading keys to no record; its rows are what the counts name.
    assert.deepEqual(plan.counts.toJSON(), { records: { added: 0, changed: 0, removed: 0 }, written: { hand_kept_definition: 5, correction_version: 1 }, deleted: {} });
    assert.deepEqual(wordsOfCorrections(plan), touchedWords(["come", "si"]));
    // The SQL creates nothing (#509): the upgrade gives the master the table, and the plan is the same after it.
    assert.doesNotMatch(plan.sql, /\b(CREATE|DROP|ALTER)\b/);
    assert.deepEqual(missingForCorrections(reader), ["hand_kept_definition", "hand_kept_definition_by_key"]);
    execute(before, masterUpgradeSql(schema));
    assert.deepEqual(missingForCorrections(reader), []);
    assert.equal(planCorrections(reader, [], HAND_KEPT_READINGS).sql, plan.sql);
    execute(before, plan.sql);
    assert.deepEqual(unwritten(reader, plan), []);

    const rows = (db: DatabaseSync) => all(db, "SELECT * FROM hand_kept_definition ORDER BY reading_id, definition_index");
    assert.deepEqual(rows(before), rows(fresh));
    assert.deepEqual(all(before, "SELECT * FROM source_record_json ORDER BY record_id"), recordsBefore);
    assert.deepEqual(await lookupOf("si"), ["noun", "pron"]);
    assert.deepEqual(await lookupOf("come"), ["adv", "prep", "conj"]);
    assert.equal(versionToken(await servedVersion(fromNodeSqlite(before), RELEASE)), `${versionBefore}.fix-1`);

    const again = planCorrections(reader, [], HAND_KEPT_READINGS);
    assert.equal(again.sql, "");
    assert.deepEqual(again.readings.map(describeReading), ["  kept:si:pron: already written", "  kept:come:conj: already written"]);
    assert.equal(again.counts, PlanCounts.NONE);

    // A held reading that differs is replaced whole: the counts name its rows deleted and written.
    before.exec("UPDATE hand_kept_definition SET text = 'altro' WHERE reading_id = 'si:pron' AND definition_index = 2");
    const rewrite = planCorrections(reader, [], HAND_KEPT_READINGS);
    assert.deepEqual(rewrite.readings.map((entry) => entry.state), ["write", "already"]);
    assert.deepEqual(rewrite.counts.toJSON(), {
      records: { added: 0, changed: 0, removed: 0 },
      written: { hand_kept_definition: 4, correction_version: 1 },
      deleted: { hand_kept_definition: 4 },
    });
    execute(before, rewrite.sql);
    assert.deepEqual(unwritten(reader, rewrite), []);
    assert.deepEqual(rows(before), rows(fresh));
  } finally {
    before.close();
    fresh.close();
  }
});
