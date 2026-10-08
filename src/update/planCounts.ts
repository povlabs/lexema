// What a plan of one of the seven dictionary write commands would do, counted
// (#455): `update:upgrade`, `update:auto`, `hide:records`,
// `normalize:source-text`, `correct:records`, `load:page-entries` and
// `load:recovered-definitions` each build one SQL file, and a
// plan-only run returns these counts without running it. A change declaration states the counts a
// change expects (src/update/declaration.ts); the deploy compares the two and
// stops on any difference or on a hard limit (#446).

import { select, type MasterReader } from "./master.js";

/** Every table the seven commands write a row of or delete one from. */
export const COUNTED_TABLES = [
  "source_release",
  "feed_release",
  "applied_change",
  "release_table_rows",
  "source_record",
  "source_record_json",
  "lookup_form",
  "form_of_edge",
  "sense",
  "sense_gloss",
  "sense_label",
  "grammar_claim",
  "accent_fold",
  "typo_key",
  "raw_page",
  "recovered_definition",
  "recovered_label",
  "recovered_example",
  "hidden_record",
  "hide_version",
  "corrected_claim",
  "corrected_form",
  "corrected_definition",
  "correction_version",
  "recovered_entry",
  "entry_definition",
  "entry_label",
  "entry_example",
  "entry_fact",
] as const;

export type CountedTable = (typeof COUNTED_TABLES)[number];

export const isCountedTable = (name: string): name is CountedTable => (COUNTED_TABLES as readonly string[]).includes(name);

/** Rows by table; a table with no row is left out, so a missing table reads as 0. */
export type TableRows = Readonly<Partial<Record<CountedTable, number>>>;

/** Records a plan adds, changes in place or replaces, and takes out of search. */
export interface RecordCounts {
  readonly added: number;
  readonly changed: number;
  /** Records no search reaches afterwards: a hide is a removal. */
  readonly removed: number;
}

/**
 * The hard limits (Huey, 2026-10-03, #446): a plan that removes more than 100
 * records, or changes more than 5% of the dictionary's records, is refused.
 */
export const HARD_LIMITS = { removedRecords: 100, changedShare: 0.05 } as const;

/** One count a plan and a declaration disagree on, named as the declaration spells it. */
export interface CountDifference {
  readonly count: string;
  readonly declared: number;
  readonly planned: number;
}

const isCount = (value: number): boolean => Number.isSafeInteger(value) && value >= 0;

function rowsOf(rows: TableRows): TableRows {
  const kept: Partial<Record<CountedTable, number>> = {};
  for (const table of COUNTED_TABLES) {
    const value = rows[table] ?? 0;
    if (!isCount(value)) throw new RangeError(`${table}: ${value} is not a count of rows`);
    if (value > 0) kept[table] = value;
  }
  return kept;
}

/** The counts of one plan: records, then rows written (inserted or updated) and rows deleted, by table. */
export class PlanCounts {
  readonly records: RecordCounts;
  readonly written: TableRows;
  readonly deleted: TableRows;

  constructor(records: RecordCounts, written: TableRows = {}, deleted: TableRows = {}) {
    for (const [name, value] of Object.entries(records)) {
      if (!isCount(value)) throw new RangeError(`records.${name}: ${value} is not a count of records`);
    }
    this.records = { added: records.added, changed: records.changed, removed: records.removed };
    this.written = rowsOf(written);
    this.deleted = rowsOf(deleted);
  }

  /** A plan that writes nothing. */
  static readonly NONE = new PlanCounts({ added: 0, changed: 0, removed: 0 });

  /** Records the plan changes or removes: what the 5% limit counts. */
  get touchedRecords(): number {
    return this.records.changed + this.records.removed;
  }

  /** Each count that differs from `declared`, in a fixed order; empty when every count agrees. */
  differencesFrom(declared: PlanCounts): CountDifference[] {
    const pairs: [string, number, number][] = [
      ...(["added", "changed", "removed"] as const).map((name): [string, number, number] => [`records.${name}`, declared.records[name], this.records[name]]),
      ...COUNTED_TABLES.map((table): [string, number, number] => [`written.${table}`, declared.written[table] ?? 0, this.written[table] ?? 0]),
      ...COUNTED_TABLES.map((table): [string, number, number] => [`deleted.${table}`, declared.deleted[table] ?? 0, this.deleted[table] ?? 0]),
    ];
    return pairs.filter(([, a, b]) => a !== b).map(([count, a, b]) => ({ count, declared: a, planned: b }));
  }

  /** Each hard limit the plan crosses in a dictionary of `dictionaryRecords` records; empty when it crosses none. */
  limitBreaches(dictionaryRecords: number): string[] {
    const breaches: string[] = [];
    if (this.records.removed > HARD_LIMITS.removedRecords) {
      breaches.push(`removes ${this.records.removed} records, more than ${HARD_LIMITS.removedRecords}`);
    }
    if (this.touchedRecords > dictionaryRecords * HARD_LIMITS.changedShare) {
      breaches.push(
        `changes or removes ${this.touchedRecords} of ${dictionaryRecords} records, more than ${HARD_LIMITS.changedShare * 100}%`,
      );
    }
    return breaches;
  }

  toJSON(): { records: RecordCounts; written: TableRows; deleted: TableRows } {
    return { records: this.records, written: this.written, deleted: this.deleted };
  }
}

/** How many records the dictionary holds, served or not: what the 5% limit is a share of. */
export function dictionaryRecords(reader: MasterReader): number {
  const [{ n }] = select<{ n: number }>(reader, "SELECT count(*) AS n FROM source_record");
  return n;
}
