// The one-off update for a dictionary seeded before rule
// `rendered-fig-label/v1` (#800, ADR 0019). `{{Fig}}` prints `senso figurato`
// (Template:Fig, read 2026-10-11), and the renderer now labels a line with it
// (src/italian/wikitext.ts, `LABEL_TEMPLATES`); it printed `figurato` before.
// A seed writes the new label; the shared dictionary holds the old one in
// `recovered_label` and `entry_label`, and `load:recovered-definitions` keeps a
// held definition's labels as they are (ADR 0029).
//
// `{{Term|figurato|it}}` and `{{Glossa|figurato}}` print `figurato`, so the
// string alone does not say which template printed a label. The rule reads
// the page line that printed each label and rewrites only a label that line's
// `{{Fig}}` printed. A definition keeps its page line in `wikitext`, so for
// most the stored line is the one to render again. Two kinds carry labels
// their stored line does not print alone (#814): a `wrapped-prose`
// definition, labelled by the `#` line above it (`pantomima`), and a
// `numbered-prose` one, whose line numbers several meanings. For those the
// rule reads the page from the verified dump of the master's release
// (`readFigLabelPages`) and finds the labels there (`pageFigLabels`). A
// candidate whose page the dump does not hold at the stored revision, or whose
// lines do not decide its labels, is left as it is and counted as undecided.
// The text, the wikitext and every other column stay.

import { type FigLabels, figLabels, pageFigLabels } from "../italian/wikitext.js";
import { type RawPage, type RawPageSource, rawPageSource } from "../source/rawPage.js";
import type { VerifiedDump } from "../source/wiktionaryDump.js";
import { select, type MasterReader } from "../update/master.js";
import type { CountedTable } from "../update/planCounts.js";
import { bodyOf, type DictionarySql, quoted, type RulePlanner, runRuleAlone } from "./sourceTextUpdate.js";

export const FIG_LABEL_RULE = "rendered-fig-label/v1" as const;

/** The label the renderer printed for `{{Fig}}` before #800: what a candidate holds. */
const OLD_FIG_LABEL = "figurato";

/** The routes whose stored line does not print every label of its definition, so the rule reads the page. */
const PAGE_ROUTES = ["wrapped-prose", "numbered-prose"] as const;
type PageRoute = (typeof PAGE_ROUTES)[number];
const isPageRoute = (route: string): route is PageRoute => (PAGE_ROUTES as readonly string[]).includes(route);

/** The label tables, the definition each row labels, how to read that definition's headword, and its page. */
const TABLES = [
  {
    table: "recovered_label",
    from: "recovered_label l JOIN recovered_definition d ON d.recovered_id = l.recovered_id JOIN source_record r ON r.record_id = d.record_id"
      + " JOIN raw_page p ON p.page_id = d.page_id AND p.release_id = d.release_id",
    key: ["recovered_id"],
    record: "d.record_id",
  },
  {
    table: "entry_label",
    from: "entry_label l JOIN entry_definition d ON d.entry_id = l.entry_id AND d.definition_index = l.definition_index JOIN recovered_entry r ON r.entry_id = d.entry_id"
      + " JOIN raw_page p ON p.page_id = r.page_id AND p.release_id = r.release_id",
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
  /** Candidates whose page lines do not say which template printed their labels. Left as they are. */
  readonly undecided: number;
}

/** One stored definition with its labels in order, and the page revision it was read off. */
interface Candidate {
  key: number[];
  record_id: number | null;
  route: string;
  word: string;
  title: string;
  revision_id: number;
  page_line: number;
  wikitext: string;
  labels: string[];
}

/** Every definition of `source` that holds a `figurato` label, with all of its labels. */
function candidates(db: MasterReader, { table, from, key, record }: (typeof TABLES)[number]): Candidate[] {
  const present = select<{ name: string }>(db, `SELECT name FROM sqlite_schema WHERE type = 'table' AND name = ${quoted(table)}`);
  if (present.length === 0) return [];
  const keyOf = (alias: string): string => `json_array(${key.map((column) => `${alias}.${column}`).join(", ")})`;
  const rows = select<Omit<Candidate, "key" | "labels"> & { key: string; label: string }>(
    db,
    `SELECT ${keyOf("d")} AS key, ${record} AS record_id, d.route, r.word, p.title, p.revision_id, d.page_line, d.wikitext, l.label
       FROM ${from}
      WHERE EXISTS (SELECT 1 FROM ${table} f WHERE ${key.map((column) => `f.${column} = d.${column}`).join(" AND ")} AND f.label = ${quoted(OLD_FIG_LABEL)})
      ORDER BY ${key.map((column) => `d.${column}`).join(", ")}, l.label_index`,
  );
  const byKey = new Map<string, Candidate>();
  for (const { key: json, label, ...row } of rows) {
    const candidate = byKey.get(json) ?? { ...row, key: JSON.parse(json) as number[], labels: [] };
    candidate.labels.push(label);
    byKey.set(json, candidate);
  }
  return [...byKey.values()];
}

/** Whether two label lists hold the same labels in the same order. */
const same = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((label, index) => label === b[index]);

/**
 * The titles of the pages the rule reads from the dump: those of the
 * candidates on a route whose stored line does not print every label.
 */
export function figLabelPageTitles(db: MasterReader): Set<string> {
  return new Set(TABLES.flatMap((source) => candidates(db, source)).filter(({ route }) => isPageRoute(route)).map(({ title }) => title));
}

/**
 * The pages the rule reads for the dictionary `db` reads: the pages
 * `figLabelPageTitles` names, as the verified dump of the master's release
 * holds them. `openDump` opens that dump; it is not opened when no candidate
 * needs a page, and it is closed once read.
 */
export async function readFigLabelPages(db: MasterReader, openDump: () => Promise<VerifiedDump>): Promise<RawPageSource> {
  const titles = figLabelPageTitles(db);
  const pages: RawPage[] = [];
  if (titles.size > 0) {
    const dump = await openDump();
    try {
      for await (const page of dump.pages()) if (titles.has(page.title)) pages.push(page);
    } finally {
      await dump.close();
    }
  }
  return rawPageSource(pages);
}

/**
 * The readings of the lines that printed a candidate's labels: its stored
 * line's, or, on a route whose stored line does not print them all, its page
 * lines' at the revision it was read off. Empty when no line is there to read.
 */
function readingsOf(row: Candidate, pages: RawPageSource): FigLabels[] {
  if (!isPageRoute(row.route)) {
    const printed = figLabels(bodyOf(row.wikitext), row.word);
    return printed === undefined ? [] : [printed];
  }
  const page = pages.page(row.title);
  return page === undefined || page.revisionId !== row.revision_id ? [] : pageFigLabels(page, row.route, row.page_line, row.wikitext);
}

/** What the rule does with one candidate: nothing, rewrite its labels to `labels`, or leave it undecided. */
type Decision = { kind: "current" } | { kind: "rewrite"; labels: string[] } | { kind: "undecided" };

/**
 * Decide one candidate from its readings. A reading whose labels before #800
 * are the stored ones says what the labels read now; the candidate is
 * rewritten to that when every such reading agrees on it. A candidate whose
 * labels already read as one reading prints them is current.
 */
function decide(stored: readonly string[], readings: readonly FigLabels[]): Decision {
  const targets = readings.filter(({ kept }) => same(kept, stored)).map(({ labels }) => labels);
  const [target, ...others] = targets;
  if (target === undefined) return readings.some(({ labels }) => same(labels, stored)) ? { kind: "current" } : { kind: "undecided" };
  if (others.some((other) => !same(other, target))) return { kind: "undecided" };
  return same(target, stored) ? { kind: "current" } : { kind: "rewrite", labels: target };
}

/**
 * Plan rule `rendered-fig-label/v1`, reading `pages` for the candidates whose
 * stored line does not print every label: in every candidate whose labels are
 * the ones its lines printed before #800, each label `{{Fig}}` printed,
 * rewritten to what it prints now. Each UPDATE names the label it replaces, so
 * a row that changed in between is left alone and a second run finds nothing
 * to do.
 */
export const figLabelPlanner = (pages: RawPageSource): RulePlanner<FigLabelReport> => (db) => {
  const statements: string[] = [];
  const records = new Set<number>();
  const changed = Object.fromEntries(TABLES.map(({ table }) => [table, 0])) as Record<LabelTable, number>;
  let read = 0;
  let undecided = 0;
  for (const source of TABLES) {
    const rows = candidates(db, source);
    read += rows.length;
    for (const row of rows) {
      const decision = decide(row.labels, readingsOf(row, pages));
      if (decision.kind === "current") continue;
      if (decision.kind === "undecided") {
        undecided += 1;
        continue;
      }
      const where = source.key.map((column, index) => `${column} = ${row.key[index]}`).join(" AND ");
      row.labels.forEach((old, index) => {
        const to = decision.labels[index];
        if (old === to) return;
        statements.push(`UPDATE ${source.table} SET label = ${quoted(to)} WHERE ${where} AND label_index = ${index} AND label = ${quoted(old)};`);
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
 * Apply rule `rendered-fig-label/v1` to an already seeded dictionary, reading
 * `pages` (`readFigLabelPages`), then read it back. Throws when a row still
 * needs it afterwards.
 */
export const relabelStoredFig = (db: DictionarySql, pages: RawPageSource): FigLabelReport => runRuleAlone(db, figLabelPlanner(pages));
