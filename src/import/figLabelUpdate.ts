// The one-off update for a dictionary seeded before rule
// `rendered-fig-label/v1` (#800, ADR 0019). `{{Fig}}` prints `senso figurato`
// (Template:Fig, read 2026-10-11), and the renderer now labels a line with it
// (src/italian/wikitext.ts, `LABEL_TEMPLATES`); it printed `figurato` before.
// A seed writes the new label; the shared dictionary holds the old one in
// `recovered_label` and `entry_label`, and `load:recovered-definitions` keeps a
// held definition's labels as they are (ADR 0029).
//
// `{{Term|figurato|it}}` and `{{Glossa|figurato}}` print `figurato`, so the
// string alone does not say which template printed a label. Each definition
// keeps its page line in `wikitext`, so the update renders that line again and
// rewrites only a label the line's `{{Fig}}` printed. Two kinds of definition
// carry labels their stored line does not print, and are left as they are,
// counted as undecided: a `wrapped-prose` definition, labelled by the `#` line
// above it (`pantomima`), and a `numbered-prose` one, whose stored line holds
// every numbered meaning. The text, the wikitext and every other column stay.

import { figLabels } from "../italian/wikitext.js";
import { select, type MasterReader } from "../update/master.js";
import type { CountedTable } from "../update/planCounts.js";
import { bodyOf, type DictionarySql, quoted, type RulePlanner, runRuleAlone } from "./sourceTextUpdate.js";

export const FIG_LABEL_RULE = "rendered-fig-label/v1" as const;

/** The label the renderer printed for `{{Fig}}` before #800: what a candidate holds. */
const OLD_FIG_LABEL = "figurato";

/** The label tables, the definition each row labels, and how to read that definition's headword. */
const TABLES = [
  {
    table: "recovered_label",
    from: "recovered_label l JOIN recovered_definition d ON d.recovered_id = l.recovered_id JOIN source_record r ON r.record_id = d.record_id",
    key: ["recovered_id"],
    record: "d.record_id",
  },
  {
    table: "entry_label",
    from: "entry_label l JOIN entry_definition d ON d.entry_id = l.entry_id AND d.definition_index = l.definition_index JOIN recovered_entry r ON r.entry_id = d.entry_id",
    key: ["entry_id", "definition_index"],
    record: "NULL",
  },
] as const satisfies readonly { table: CountedTable; from: string; key: readonly string[]; record: string }[];

type LabelTable = (typeof TABLES)[number]["table"];

/** What the update found and did. */
export interface FigLabelReport {
  readonly rule: typeof FIG_LABEL_RULE;
  /** Definitions holding a `figurato` label, read whether or not they need a change. */
  readonly candidates: number;
  /** Label rows this run rewrites, by table; all 0 on a dictionary already up to date. */
  readonly changed: Readonly<Record<LabelTable, number>>;
  /** Candidates whose labels their stored line does not print, so the rule cannot tell which template printed them. Left as they are. */
  readonly undecided: number;
}

/** One stored definition with its labels in order. */
interface Candidate {
  key: number[];
  record_id: number | null;
  route: string;
  word: string;
  wikitext: string;
  labels: string[];
}

/** Every definition of `source` that holds a `figurato` label, with all of its labels. */
function candidates(db: MasterReader, { table, from, key, record }: (typeof TABLES)[number]): Candidate[] {
  const present = select<{ name: string }>(db, `SELECT name FROM sqlite_schema WHERE type = 'table' AND name = ${quoted(table)}`);
  if (present.length === 0) return [];
  const keyOf = (alias: string): string => `json_array(${key.map((column) => `${alias}.${column}`).join(", ")})`;
  const rows = select<{ key: string; record_id: number | null; route: string; word: string; wikitext: string; label: string }>(
    db,
    `SELECT ${keyOf("d")} AS key, ${record} AS record_id, d.route, r.word, d.wikitext, l.label
       FROM ${from}
      WHERE EXISTS (SELECT 1 FROM ${table} f WHERE ${key.map((column) => `f.${column} = d.${column}`).join(" AND ")} AND f.label = ${quoted(OLD_FIG_LABEL)})
      ORDER BY ${key.map((column) => `d.${column}`).join(", ")}, l.label_index`,
  );
  const byKey = new Map<string, Candidate>();
  for (const row of rows) {
    const candidate = byKey.get(row.key) ?? { key: JSON.parse(row.key) as number[], record_id: row.record_id, route: row.route, word: row.word, wikitext: row.wikitext, labels: [] };
    candidate.labels.push(row.label);
    byKey.set(row.key, candidate);
  }
  return [...byKey.values()];
}

/** Whether two label lists hold the same labels in the same order. */
const same = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((label, index) => label === b[index]);

/**
 * Plan rule `rendered-fig-label/v1`: in every candidate whose labels are the
 * ones its stored line printed before #800, each label `{{Fig}}` printed,
 * rewritten to what it prints now. Each UPDATE names the label it replaces, so
 * a row that changed in between is left alone and a second run finds nothing
 * to do.
 */
export const planFigLabels: RulePlanner<FigLabelReport> = (db) => {
  const statements: string[] = [];
  const records = new Set<number>();
  const changed = Object.fromEntries(TABLES.map(({ table }) => [table, 0])) as Record<LabelTable, number>;
  let read = 0;
  let undecided = 0;
  for (const source of TABLES) {
    const rows = candidates(db, source);
    read += rows.length;
    for (const row of rows) {
      const printed = row.route === "numbered-prose" ? undefined : figLabels(bodyOf(row.wikitext), row.word);
      if (printed !== undefined && same(row.labels, printed.labels)) continue;
      if (printed === undefined || !same(row.labels, printed.kept)) {
        undecided += 1;
        continue;
      }
      const where = source.key.map((column, index) => `${column} = ${row.key[index]}`).join(" AND ");
      printed.kept.forEach((old, index) => {
        if (old === printed.labels[index]) return;
        statements.push(`UPDATE ${source.table} SET label = ${quoted(printed.labels[index])} WHERE ${where} AND label_index = ${index} AND label = ${quoted(old)};`);
        changed[source.table] += 1;
      });
      if (row.record_id !== null) records.add(row.record_id);
    }
  }
  const written: Partial<Record<CountedTable, number>> = {};
  for (const [table, rows] of Object.entries(changed) as [LabelTable, number][]) if (rows > 0) written[table] = rows;
  return { report: { rule: FIG_LABEL_RULE, candidates: read, changed, undecided }, statements, records: [...records], written, deleted: {} };
};

/**
 * Apply rule `rendered-fig-label/v1` to an already seeded dictionary, then
 * read it back. Throws when a row still needs it afterwards.
 */
export const relabelStoredFig = (db: DictionarySql): FigLabelReport => runRuleAlone(db, planFigLabels);
