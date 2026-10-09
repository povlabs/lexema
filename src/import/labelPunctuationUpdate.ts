// The one-off update for a dictionary seeded before rule
// `rendered-label-punctuation/v1` (#712, ADR 0019). The renderer now drops a
// comma, semicolon or colon that only separates usage labels
// (src/italian/wikitext.ts, `renderInline`), so a seed no longer writes
// `, numero che viene dopo il cinquantuno…` for `cinquantadue`. This brings
// the rows a seed wrote before to the text it writes now: the definitions and
// examples read off a page, recovered for a record or for a page-only entry.
// Each row keeps its page line verbatim in `wikitext`, so the update renders
// that line again and changes only a row that still holds the old rendering.
// Labels, the wikitext and every other column stay as they are.

import { labelPunctuation } from "../italian/wikitext.js";
import { select, type MasterReader } from "../update/master.js";
import type { CountedTable } from "../update/planCounts.js";
import { type DictionarySql, quoted, type RulePlanner, runRuleAlone } from "./sourceTextUpdate.js";

export const LABEL_PUNCTUATION_RULE = "rendered-label-punctuation/v1" as const;

/** The tables that hold a page line's rendered text beside the line, and how to read one row's headword and key. */
const TABLES = [
  {
    table: "recovered_definition",
    from: "recovered_definition t JOIN source_record r ON r.record_id = t.record_id",
    key: ["recovered_id"],
    record: "t.record_id",
  },
  {
    table: "recovered_example",
    from: "recovered_example t JOIN recovered_definition d ON d.recovered_id = t.recovered_id JOIN source_record r ON r.record_id = d.record_id",
    key: ["recovered_id", "example_index"],
    record: "d.record_id",
  },
  {
    table: "entry_definition",
    from: "entry_definition t JOIN recovered_entry r ON r.entry_id = t.entry_id",
    key: ["entry_id", "definition_index"],
    record: "NULL",
  },
  {
    table: "entry_example",
    from: "entry_example t JOIN recovered_entry r ON r.entry_id = t.entry_id",
    key: ["entry_id", "definition_index", "example_index"],
    record: "NULL",
  },
] as const satisfies readonly { table: CountedTable; from: string; key: readonly string[]; record: string }[];

type LabelTable = (typeof TABLES)[number]["table"];

/** What the update found and did. */
export interface LabelPunctuationReport {
  readonly rule: typeof LABEL_PUNCTUATION_RULE;
  /** Rows whose text may hold punctuation a label left, read whether or not they need a change. */
  readonly candidates: number;
  /** Rows this run rewrites, by table; all 0 on a dictionary already up to date. */
  readonly changed: Readonly<Record<LabelTable, number>>;
}

interface Candidate {
  key: number[];
  record_id: number | null;
  word: string;
  wikitext: string;
  text: string;
}

/**
 * `[,;:]` as a GLOB character class. A read may hold no `;` (`readOnly` in
 * src/lookup/database.ts), so the semicolon is `char(59)`.
 */
const PUNCTUATION = "'[,' || char(59) || ':]'";

/**
 * Candidates: a row of a line with a template whose text opens with
 * punctuation, or holds punctuation after a space. A label printed as a space,
 * so the old renderer left either shape where a label stood before the
 * punctuation that separated it; `labelPunctuation` decides.
 */
function candidates(db: MasterReader, { table, from, key, record }: (typeof TABLES)[number]): Candidate[] {
  const present = select<{ name: string }>(db, `SELECT name FROM sqlite_schema WHERE type = 'table' AND name = ${quoted(table)}`);
  if (present.length === 0) return [];
  return select<{ key: string; record_id: number | null; word: string; wikitext: string; text: string }>(
    db,
    `SELECT json_array(${key.map((column) => `t.${column}`).join(", ")}) AS key, ${record} AS record_id, r.word, t.wikitext, t.text
       FROM ${from}
      WHERE t.wikitext GLOB '*{{*' AND (t.text GLOB ${PUNCTUATION} || '*' OR t.text GLOB '* ' || ${PUNCTUATION} || '*')
      ORDER BY ${key.map((column) => `t.${column}`).join(", ")}`,
  ).map((row) => ({ ...row, key: JSON.parse(row.key) as number[] }));
}

/** The body a stored line was rendered from: the line without its list mark. */
const bodyOf = (wikitext: string): string => wikitext.trim().replace(/^[#*:;]+\s*/, "");

/**
 * Plan rule `rendered-label-punctuation/v1`: every candidate whose stored text
 * is what the renderer gave before #712, rewritten to what it gives now. Each
 * UPDATE names the text it replaces, so a row that changed in between is left
 * alone and a second run finds nothing to do.
 */
export const planLabelPunctuation: RulePlanner<LabelPunctuationReport> = (db) => {
  const statements: string[] = [];
  const records = new Set<number>();
  const changed = Object.fromEntries(TABLES.map(({ table }) => [table, 0])) as Record<LabelTable, number>;
  let read = 0;
  for (const source of TABLES) {
    const rows = candidates(db, source);
    read += rows.length;
    for (const row of rows) {
      const rendered = labelPunctuation(bodyOf(row.wikitext), row.word);
      if (rendered === undefined || rendered.kept !== row.text || rendered.text === row.text) continue;
      const where = source.key.map((column, index) => `${column} = ${row.key[index]}`).join(" AND ");
      statements.push(`UPDATE ${source.table} SET text = ${quoted(rendered.text)} WHERE ${where} AND text = ${quoted(row.text)};`);
      changed[source.table] += 1;
      if (row.record_id !== null) records.add(row.record_id);
    }
  }
  const written: Partial<Record<CountedTable, number>> = {};
  for (const [table, rows] of Object.entries(changed) as [LabelTable, number][]) if (rows > 0) written[table] = rows;
  return { report: { rule: LABEL_PUNCTUATION_RULE, candidates: read, changed }, statements, records: [...records], written, deleted: {} };
};

/**
 * Apply rule `rendered-label-punctuation/v1` to an already seeded dictionary,
 * then read it back. Throws when a row still needs it afterwards.
 */
export const dropStoredLabelPunctuation = (db: DictionarySql): LabelPunctuationReport => runRuleAlone(db, planLabelPunctuation);
