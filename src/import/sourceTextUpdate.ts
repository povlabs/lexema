// What every one-off source text update shares (ADR 0019): the plan of one
// rule over an already seeded dictionary, and the glosses the rules before it
// in the same file have already rewritten. `normalize:source-text` plans all
// its rules into one SQL file and runs that file in one step
// (normalizeSourceText.ts), so a rule cannot read what an earlier rule wrote:
// it reads the database and the planned glosses together instead.

import { select, type MasterReader } from "../update/master.js";
import type { TableRows } from "../update/planCounts.js";

/** What the update needs from a dictionary database: read rows, run statements. */
export interface DictionarySql {
  query<Row>(sql: string): Row[];
  run(sql: string): void;
}

export const quoted = (value: string): string => `'${value.replaceAll("'", "''")}'`;

/** One gloss as the statements planned so far leave it: its new text, or `null` once deleted. */
export interface PlannedGloss {
  readonly recordId: number;
  readonly word: string;
  readonly text: string | null;
}

/** The glosses a file's earlier statements rewrite or delete, by `gloss_id`. */
export class PlannedGlosses {
  private readonly glosses = new Map<number, PlannedGloss>();

  /** The text gloss `glossId` has after the planned statements: the stored text when none touches it. */
  textOf(glossId: number, stored: string): string | null {
    const planned = this.glosses.get(glossId);
    return planned === undefined ? stored : planned.text;
  }

  has(glossId: number): boolean {
    return this.glosses.has(glossId);
  }

  /** Every planned gloss that still has a text, by id. */
  *kept(): Generator<[number, PlannedGloss & { text: string }]> {
    for (const [glossId, gloss] of this.glosses) {
      if (gloss.text !== null) yield [glossId, gloss as PlannedGloss & { text: string }];
    }
  }

  set(glossId: number, gloss: PlannedGloss): void {
    this.glosses.set(glossId, gloss);
  }

  /** The `sense_gloss` rows the planned statements write and delete. */
  rows(): { written: number; deleted: number } {
    let written = 0;
    for (const { text } of this.glosses.values()) if (text !== null) written += 1;
    return { written, deleted: this.glosses.size - written };
  }

  /** The records whose glosses the planned statements change. */
  records(): number[] {
    return [...this.glosses.values()].map(({ recordId }) => recordId);
  }
}

/** One rule's share of a file: its report, its statements, and the rows beside `sense_gloss` they change. */
export interface RulePlan<Report> {
  readonly report: Report;
  readonly statements: readonly string[];
  /** Records whose rows beside `sense_gloss` the statements change. */
  readonly records: readonly number[];
  readonly written: TableRows;
  readonly deleted: TableRows;
}

/** Plans one rule, reading the database and the glosses earlier rules planned; it writes nothing, but notes its own gloss rewrites in `glosses`. */
export type RulePlanner<Report> = (db: MasterReader, glosses: PlannedGlosses) => RulePlan<Report>;

/** Whether SQLite's `text GLOB glob` holds: `*`, `?` and `[...]` (with `^` to negate), case-sensitive. */
export function globMatches(glob: string, text: string): boolean {
  let pattern = "";
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i];
    if (char === "*") pattern += "[\\s\\S]*";
    else if (char === "?") pattern += "[\\s\\S]";
    else if (char === "[") {
      const end = glob.indexOf("]", i + 2);
      if (end === -1) pattern += "\\[";
      else {
        const body = glob.slice(i + 1, end);
        pattern += body.startsWith("^") ? `[^${body.slice(1).replace(/\\/g, "\\\\")}]` : `[${body.replace(/\\/g, "\\\\")}]`;
        i = end;
      }
    } else pattern += char.replace(/[.*+?^${}()|[\]\\]/u, "\\$&");
  }
  return new RegExp(`^${pattern}$`, "u").test(text);
}

/** What a rule that rewrites gloss text found and did. */
export interface GlossRewriteReport<Rule extends string> {
  readonly rule: Rule;
  /** Rows the GLOB selected, whether or not they needed a change. */
  readonly candidates: number;
  /** Rows the rule rewrites; 0 on a database already normalized. */
  readonly changed: number;
}

/**
 * Plan a rule that rewrites gloss text: every gloss whose text, as the
 * earlier rules leave it, `glob` selects, rewritten by `rewrite`. Each UPDATE
 * names the text it replaces, so a row that changed in between is left alone.
 */
export function planGlossRewrite<Rule extends string>(
  db: MasterReader,
  glosses: PlannedGlosses,
  { rule, glob, rewrite }: { rule: Rule; glob: string; rewrite: (word: string, text: string) => string },
): RulePlan<GlossRewriteReport<Rule>> {
  const stored = select<{ gloss_id: number; text: string; word: string; record_id: number }>(
    db,
    `SELECT g.gloss_id, g.text, r.word, r.record_id
       FROM sense_gloss g JOIN sense s ON s.sense_id = g.sense_id JOIN source_record r ON r.record_id = s.record_id
      WHERE g.text GLOB ${quoted(glob)} ORDER BY g.gloss_id`,
  ).filter(({ gloss_id }) => !glosses.has(gloss_id));
  const planned = [...glosses.kept()]
    .filter(([, { text }]) => globMatches(glob, text))
    .map(([glossId, { text, word, recordId }]) => ({ gloss_id: glossId, text, word, record_id: recordId }));
  const candidates = [...stored, ...planned].sort((a, b) => a.gloss_id - b.gloss_id);
  const statements: string[] = [];
  for (const { gloss_id: glossId, text, word, record_id: recordId } of candidates) {
    const to = rewrite(word, text);
    if (to === text) continue;
    statements.push(`UPDATE sense_gloss SET text = ${quoted(to)} WHERE gloss_id = ${glossId} AND text = ${quoted(text)};`);
    glosses.set(glossId, { recordId, word, text: to });
  }
  return { report: { rule, candidates: candidates.length, changed: statements.length }, statements, records: [], written: {}, deleted: {} };
}

/**
 * Run one rule alone: plan it, run its statements, and read the database
 * back. Throws when anything is still pending afterwards.
 */
export function runRuleAlone<Report extends { rule: string }>(db: DictionarySql, plan: RulePlanner<Report>): Report {
  const before = plan(db, new PlannedGlosses());
  if (before.statements.length > 0) db.run(before.statements.join("\n"));
  const after = plan(db, new PlannedGlosses());
  if (after.statements.length > 0) {
    throw new Error(`${after.statements.length} change(s) of ${before.report.rule} still pending after the update`);
  }
  return before.report;
}
