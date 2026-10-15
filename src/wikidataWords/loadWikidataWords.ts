// `load:wikidata-words` (ADR 0033, #812): bring the dictionary's Wikidata
// words in line with the committed snapshot. It reads the master and writes
// nothing: the plan is the SQL a run applies, counted.
//
// A lexeme is kept when it has an Italian gloss (`hasItalianGloss`, ADR
// 0033's 2026-10-12 amendment) and at least one of its spellings, lemma or
// form, is a spelling the dictionary does not already answer with something
// to read (`answeredKeys`, src/names/loadNames.ts). A lookup reads a Wikidata word
// only when no Wiktionary reading answers the spelling asked
// (src/lookup/wikidataWords.ts), so a kept lexeme never shows where
// Wiktionary has the word. Each run writes a lexeme the master lacks, and a
// lexeme the master holds with other content as a row of the snapshot's date
// beside the older row, which stays as history; a lookup reads the newest. A
// held lexeme the snapshot no longer has is reported and left serving, and
// one whose spellings the dictionary now answers is left as held: the lookup
// stops showing it, and no row is deleted. No source row is touched.

import { literal } from "../import/seedSql.js";
import { answeredKeys } from "../names/loadNames.js";
import { readMasterRelease, select, upgradeNeededFor, type MasterReader } from "../update/master.js";
import { WIKIDATA_WORD_TABLES } from "../update/masterUpgrade.js";
import { PlanCounts } from "../update/planCounts.js";
import { PINNED_LEXEME_DUMP } from "./lexemeDump.js";
import { hasItalianGloss, keysOfWord, type WikidataWord } from "./wikidataWord.js";
import { snapshotOf } from "./wordSnapshot.js";

/** One `wikidata_word` row, as stored. */
interface WordRow {
  lexeme: string;
  snapshot: string;
  lemma: string;
  category: string;
  forms: string;
  glosses: string;
}

const COLUMNS = ["lexeme", "snapshot", "lemma", "category", "forms", "glosses"] as const;

/** The row a word is stored as, under the snapshot it was taken from. */
export const wordRow = (word: WikidataWord, snapshot: string): WordRow => ({
  lexeme: word.lexeme,
  snapshot,
  lemma: word.lemma,
  category: word.category,
  forms: JSON.stringify(word.forms),
  glosses: JSON.stringify(word.glosses),
});

/** Whether two rows hold the same lexeme content, whatever snapshot each is of. */
const sameContent = (a: WordRow, b: WordRow): boolean => a.lemma === b.lemma && a.category === b.category && a.forms === b.forms && a.glosses === b.glosses;

/** What a run does. */
export interface WikidataWordPlan {
  masterReleaseId: string;
  /** The date of the dump the snapshot was taken from: the snapshot every written row names. */
  snapshot: string;
  /** Words written: absent from the master, or held with other content. */
  written: WikidataWord[];
  /** Held lexemes the snapshot no longer has: reported, and left serving. */
  absent: string[];
  /** Snapshot words left out: none has an Italian gloss. */
  unglossed: WikidataWord[];
  /** Snapshot words left out: the dictionary already answers every spelling of each. */
  answered: WikidataWord[];
  /** Empty when there is nothing to do. */
  sql: string;
  counts: PlanCounts;
}

/** The upgrade names the words write into that the master lacks: run `update:upgrade` before the plan's SQL while any is listed. */
export const missingForWikidataWords = (reader: MasterReader): string[] => upgradeNeededFor(reader, WIKIDATA_WORD_TABLES);

/** Whether the master has the Wikidata word tables. */
const hasTables = (reader: MasterReader): boolean =>
  select<{ name: string }>(reader, "SELECT name FROM sqlite_schema WHERE type = 'table' AND name IN ('wikidata_word', 'wikidata_word_key')").length === WIKIDATA_WORD_TABLES.length;

/** How many rows one read of `wikidata_word` returns. */
const HELD_PAGE = 2_000;

/** The newest `wikidata_word` row of each lexeme the master holds, by lexeme, a page at a time; none when it has no such table yet. */
function heldRows(reader: MasterReader): Map<string, WordRow> {
  const held = new Map<string, WordRow>();
  if (!hasTables(reader)) return held;
  for (let after = "";;) {
    const page = select<WordRow>(
      reader,
      `SELECT ${COLUMNS.join(", ")} FROM wikidata_word w
        WHERE w.lexeme > ${literal(after)} AND w.snapshot = (SELECT MAX(l.snapshot) FROM wikidata_word l WHERE l.lexeme = w.lexeme)
        ORDER BY w.lexeme LIMIT ${HELD_PAGE}`,
    );
    for (const row of page) held.set(row.lexeme, row);
    if (page.length < HELD_PAGE) return held;
    after = page[page.length - 1].lexeme;
  }
}

/** At most this many bytes of SQL in one statement, as the update's other writes (src/update/apply.ts). */
const MAX_STATEMENT_BYTES = 64 * 1024;

/** `tuples` as INSERT statements into `table` of at most `MAX_STATEMENT_BYTES` each. */
function inserts(table: string, columns: readonly string[], tuples: readonly string[]): string[] {
  const head = `INSERT INTO ${table} (${columns.join(", ")}) VALUES\n  `;
  const statements: string[] = [];
  let batch: string[] = [];
  let bytes = head.length;
  for (const tuple of tuples) {
    const size = Buffer.byteLength(tuple) + 4;
    if (batch.length > 0 && bytes + size > MAX_STATEMENT_BYTES) {
      statements.push(`${head}${batch.join(",\n  ")};`);
      batch = [];
      bytes = head.length;
    }
    batch.push(tuple);
    bytes += size;
  }
  if (batch.length > 0) statements.push(`${head}${batch.join(",\n  ")};`);
  return statements;
}

/**
 * Plan bringing the master's Wikidata words in line with `snapshot`, taken
 * from the dump of `date`. It reads the master; it writes nothing. A master
 * without the tables is read as holding none, so the plan counts the same
 * before the upgrade as after it.
 */
export async function planWikidataWords(reader: MasterReader, snapshot: readonly WikidataWord[], date: string = PINNED_LEXEME_DUMP.date): Promise<WikidataWordPlan> {
  const master = readMasterRelease(reader);
  const all = snapshotOf(snapshot);
  const words = all.filter(hasItalianGloss);
  const unglossed = all.filter((word) => !hasItalianGloss(word));
  const answered = await answeredKeys(reader, master.releaseId, words.flatMap(keysOfWord));
  const left = words.filter((word) => keysOfWord(word).every((key) => answered.has(key)));
  const kept = words.filter((word) => !left.includes(word));
  const held = heldRows(reader);
  const written = kept.filter((word) => {
    const row = held.get(word.lexeme);
    return row === undefined || !sameContent(row, wordRow(word, date));
  });
  const inSnapshot = new Set<string>(all.map((word) => word.lexeme));
  const absent = [...held.keys()].filter((lexeme) => !inSnapshot.has(lexeme)).sort();
  const base = { masterReleaseId: master.releaseId, snapshot: date, written, absent, unglossed, answered: left };
  if (written.length === 0) return { ...base, sql: "", counts: PlanCounts.NONE };

  // A row of this very snapshot that differs is replaced; one of an older snapshot stays as history.
  const replaced = written.filter((word) => held.get(word.lexeme)?.snapshot === date).map((word) => word.lexeme);
  const json = literal(JSON.stringify(replaced));
  const keyTuples = written.flatMap((word) => keysOfWord(word).map((key) => `(${[key, word.lexeme, date].map(literal).join(", ")})`));
  const sql = [
    `-- Generated by src/wikidataWords/loadWikidataWords.ts: ${written.length} Wikidata word(s) of the dump of ${date} written in ${master.releaseId}.`,
    ...(replaced.length === 0
      ? []
      : [
          `DELETE FROM wikidata_word_key WHERE snapshot = ${literal(date)} AND lexeme IN (SELECT value FROM json_each(${json}));`,
          `DELETE FROM wikidata_word WHERE snapshot = ${literal(date)} AND lexeme IN (SELECT value FROM json_each(${json}));`,
        ]),
    ...inserts("wikidata_word", COLUMNS, written.map((word) => `(${COLUMNS.map((column) => literal(wordRow(word, date)[column])).join(", ")})`)),
    ...inserts("wikidata_word_key", ["word_key", "lexeme", "snapshot"], keyTuples),
  ];
  // The key rows a replaced row had, read off its own lemma and forms.
  const replacedKeys = replaced.reduce((sum, lexeme) => {
    const row = held.get(lexeme) as WordRow;
    return sum + keysOfWord({ lemma: row.lemma, forms: JSON.parse(row.forms) as WikidataWord["forms"] }).length;
  }, 0);
  const counts = new PlanCounts(
    { added: 0, changed: 0, removed: 0 },
    { wikidata_word: written.length, wikidata_word_key: keyTuples.length },
    replaced.length === 0 ? {} : { wikidata_word: replaced.length, wikidata_word_key: replacedKeys },
  );
  return { ...base, sql: `${sql.join("\n")}\n`, counts };
}

/** Words the plan writes whose newest row the master does not read back as planned. */
export function unwrittenWikidataWords(reader: MasterReader, plan: WikidataWordPlan): string[] {
  const held = heldRows(reader);
  return plan.written
    .filter((word) => {
      const row = held.get(word.lexeme);
      return row === undefined || row.snapshot !== plan.snapshot || !sameContent(row, wordRow(word, plan.snapshot));
    })
    .map((word) => `${word.lexeme} (${word.lemma})`);
}
