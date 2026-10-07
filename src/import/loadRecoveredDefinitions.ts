// The update that writes the definitions a section states outside its `#`
// list (#706, ADR 0029) into a dictionary seeded before the recovered layer
// read them: a `*` bullet line or a plain prose line under the part-of-speech
// heading, in a section no `#` line of which states a meaning
// (src/italian/wikitext.ts). For each archive record a section matches, it
// writes what a seed now writes for those lines and nothing else: their
// `recovered_definition` and `recovered_label` rows, and the `raw_page` row of
// the revision they were read from when the dictionary has none. No record is
// touched, `source_record_json` least of all, no row the dictionary holds is
// changed, and no other route's definition is written: those are the seed's
// already.
//
// A record a feed replaced (ADR 0025) keeps the rows written for it; the
// lookup reads them for the record that replaced it (src/lookup/recovered.ts).
// So a definition the served record now carries as a gloss is not written.
//
// The SQL is one batch, run as one transaction. A definition the dictionary
// already holds, by its record and page line, is left alone, so a second run
// plans nothing. It holds no DDL (#509): `update:upgrade` rebuilds
// `recovered_definition` to the CHECK that admits the two routes
// (src/update/masterUpgrade.ts), and the command refuses to write before it
// has.

import { carries, recordGlosses, recordText, recoverDefinitions, type RecoveredDefinition } from "../italian/recovery.js";
import { readItalianSections, type UnlistedRoute } from "../italian/wikitext.js";
import type { RawPage } from "../source/rawPage.js";
import { changedUpgrade, readMasterRelease, select, type MasterReader } from "../update/master.js";
import { RECOVERED_INDEXES, RECOVERED_TABLES } from "../update/masterUpgrade.js";
import { PlanCounts } from "../update/planCounts.js";
import { parseArchive } from "./importRelease.js";
import { COLUMNS, literal, tupleOf } from "./seedSql.js";

/** The rule that reads a `*` bullet line under the part-of-speech heading. */
export const BULLET_LINE_RULE = "recovered-bullet-line/v1";
/** The rule that reads a plain prose line under the part-of-speech heading. */
export const PROSE_LINE_RULE = "recovered-prose-line/v1";
/** The rules the load reads pages by; a declaration names them all. */
export const RECOVERED_DEFINITION_RULES = [BULLET_LINE_RULE, PROSE_LINE_RULE] as const;

/** The route each rule writes. */
const ROUTE_OF_RULE = { [BULLET_LINE_RULE]: "bullet-line", [PROSE_LINE_RULE]: "prose-line" } as const satisfies Record<(typeof RECOVERED_DEFINITION_RULES)[number], UnlistedRoute>;
const ROUTES: ReadonlySet<string> = new Set(Object.values(ROUTE_OF_RULE));

/** A definition one of the two rules reads. */
export type UnlistedDefinition = RecoveredDefinition & { route: UnlistedRoute };

const isUnlisted = (definition: RecoveredDefinition): definition is UnlistedDefinition => ROUTES.has(definition.route);

/** An archive record a section matches and the definitions the two rules read for it, in page order. */
export interface FoundRecord {
  /** The record's 1-based line in the archive. */
  readonly lineNo: number;
  readonly word: string;
  readonly posTitle: string;
  readonly page: RawPage;
  readonly definitions: readonly UnlistedDefinition[];
}

/**
 * The pages of `pages` with a section that states a definition outside its
 * `#` list, by title. Reads each page once and keeps no other.
 */
export async function pagesWithUnlistedLines(pages: AsyncIterable<RawPage> | Iterable<RawPage>): Promise<Map<string, RawPage>> {
  const found = new Map<string, RawPage>();
  for await (const page of pages) {
    if (readItalianSections(page).some((section) => section.unlisted.length > 0)) found.set(page.title, page);
  }
  return found;
}

/**
 * The records of the archive at `archive` the two rules recover a definition
 * for off `pages`, as the seed recovers it (`recoverDefinitions`): one per
 * record, in archive order. A definition the record carries as a gloss is not
 * one.
 */
export async function findUnlistedDefinitions(archive: string, pages: ReadonlyMap<string, RawPage>): Promise<FoundRecord[]> {
  const found: FoundRecord[] = [];
  await parseArchive({
    input: archive,
    onRejection: () => {},
    onRecord: ({ record, lineNo }) => {
      const page = pages.get(record.word);
      if (page === undefined) return;
      const recovery = recoverDefinitions(recordText(record), page);
      if (recovery.outcome !== "matched") return;
      const definitions = recovery.recovered.filter(isUnlisted);
      if (definitions.length > 0) found.push({ lineNo, word: record.word, posTitle: record.pos_title, page, definitions });
    },
  });
  return found;
}

/** What a run does with one definition a rule read. */
export type PlannedDefinition =
  | { readonly state: "write"; readonly definition: UnlistedDefinition; readonly recoveredId: number; readonly definitionIndex: number }
  /** The dictionary holds a recovered definition of this record read off this page line. */
  | { readonly state: "already"; readonly definition: UnlistedDefinition }
  /** A record a feed applied in its place carries it as a gloss, so the page shows it already. */
  | { readonly state: "carried-by-served"; readonly definition: UnlistedDefinition; readonly servedRecordId: number };

/** One record's planned definitions. */
export interface PlannedRecord {
  readonly recordId: number;
  /** The record served in its place: itself, unless a feed's change replaced it. */
  readonly servedRecordId: number;
  readonly found: FoundRecord;
  readonly pageId: number;
  readonly definitions: readonly PlannedDefinition[];
}

export interface RecoveredDefinitionPlan {
  readonly masterReleaseId: string;
  readonly records: readonly PlannedRecord[];
  /** Empty when there is nothing to write. */
  readonly sql: string;
  /** What `sql` writes; `PlanCounts.NONE` when it is empty. No record is added, changed or removed. */
  readonly counts: PlanCounts;
}

const json = (values: readonly unknown[]): string => literal(JSON.stringify(values));
const CHUNK = 200;

/** `tuples` as INSERTs into `table` of at most `CHUNK` rows each. */
function inserts(table: keyof typeof COLUMNS, tuples: readonly (readonly unknown[])[]): string[] {
  const statements: string[] = [];
  for (let start = 0; start < tuples.length; start += CHUNK) {
    statements.push(`INSERT INTO ${table} (${COLUMNS[table]}) VALUES\n  ${tuples.slice(start, start + CHUNK).map((values) => tupleOf(table, values)).join(",\n  ")};`);
  }
  return statements;
}

/** The recovered tables the dictionary stores unlike `schema`: run `update:upgrade` before the load's SQL while any is listed. */
export const changedForLoad = (reader: MasterReader, schema: string): string[] =>
  changedUpgrade(reader, schema).filter((name) => (RECOVERED_TABLES as readonly string[]).includes(name) || (RECOVERED_INDEXES as readonly string[]).includes(name));

/**
 * The record served in place of each of `recordIds`: the last record of the
 * chain of feed changes that replaced it, and its archive line. A record no
 * change replaced serves itself.
 */
function servedRecords(reader: MasterReader, recordIds: readonly number[]): Map<number, { recordId: number; rawJson: string }> {
  const rows = select<{ origin: number; record_id: number; raw_json: string }>(
    reader,
    `SELECT origin, record_id, raw_json FROM (
       WITH RECURSIVE chain(origin, record_id, depth) AS (
         SELECT value, value, 0 FROM json_each(${json(recordIds)})
         UNION ALL
         SELECT c.origin, a.record_id, c.depth + 1 FROM applied_change a JOIN chain c ON a.replaced_record_id = c.record_id)
       SELECT c.origin, c.record_id, j.raw_json
         FROM chain c JOIN source_record_json j ON j.record_id = c.record_id
        WHERE c.depth = (SELECT max(depth) FROM chain d WHERE d.origin = c.origin))`,
  );
  return new Map(rows.map((row) => [row.origin, { recordId: row.record_id, rawJson: row.raw_json }]));
}

/**
 * Plan writing `found`, the definitions the two rules read off the master's
 * dump for records of its archive. It reads the dictionary; it writes nothing,
 * and its SQL holds no DDL. Throws when a found record is not the master's
 * record at that line, or the dictionary holds the page from another revision
 * than the one read.
 */
export function planRecoveredDefinitions(reader: MasterReader, found: readonly FoundRecord[]): RecoveredDefinitionPlan {
  const master = readMasterRelease(reader);
  const release = literal(master.releaseId);
  const nothing: RecoveredDefinitionPlan = { masterReleaseId: master.releaseId, records: [], sql: "", counts: PlanCounts.NONE };
  if (found.length === 0) return nothing;

  const atLine = new Map(
    select<{ record_id: number; line_no: number; word: string; pos_title: string }>(
      reader,
      `SELECT record_id, line_no, word, pos_title FROM source_record WHERE release_id = ${release}
          AND line_no IN (SELECT value FROM json_each(${json(found.map(({ lineNo }) => lineNo))}))`,
    ).map((row) => [row.line_no, row]),
  );
  const mismatched = found.filter(({ word, posTitle, lineNo }) => atLine.get(lineNo)?.word !== word || atLine.get(lineNo)?.pos_title !== posTitle);
  if (mismatched.length > 0) {
    throw new Error(
      `the master ${master.releaseId} does not hold these records at the archive's lines: ` +
        mismatched.map(({ word, lineNo }) => `${word} (line ${lineNo})`).join(", "),
    );
  }
  const recordIdOf = (record: FoundRecord): number => (atLine.get(record.lineNo) as { record_id: number }).record_id;
  const recordIds = found.map(recordIdOf);
  const byRecord = `IN (SELECT value FROM json_each(${json(recordIds)}))`;
  const held = select<{ record_id: number; page_line: number; definition_index: number }>(
    reader,
    `SELECT record_id, page_line, definition_index FROM recovered_definition WHERE record_id ${byRecord}`,
  );
  const heldLines = new Set(held.map((row) => `${row.record_id}:${row.page_line}`));
  const nextIndex = new Map<number, number>();
  for (const row of held) nextIndex.set(row.record_id, Math.max(nextIndex.get(row.record_id) ?? 0, row.definition_index + 1));
  const served = servedRecords(reader, recordIds);

  const titles = [...new Set(found.map(({ page }) => page.title))];
  const heldPages = new Map(
    select<{ page_id: number; title: string; revision_id: number }>(
      reader,
      `SELECT page_id, title, revision_id FROM raw_page WHERE release_id = ${release} AND wiki = 'it.wiktionary.org' AND title IN (SELECT value FROM json_each(${json(titles)}))`,
    ).map((row) => [row.title, row]),
  );
  const [{ max: maxPage }] = select<{ max: number | null }>(reader, "SELECT max(page_id) AS max FROM raw_page");
  const [{ max: maxRecovered }] = select<{ max: number | null }>(reader, "SELECT max(recovered_id) AS max FROM recovered_definition");
  let nextPage = (maxPage ?? 0) + 1;
  let nextRecovered = (maxRecovered ?? 0) + 1;
  const newPages: unknown[][] = [];

  const records = found.map((record): PlannedRecord => {
    const recordId = recordIdOf(record);
    const { title, revisionId } = record.page;
    const heldPage = heldPages.get(title);
    if (heldPage !== undefined && heldPage.revision_id !== revisionId) {
      throw new Error(`the dictionary holds revision ${heldPage.revision_id} of ${title}, the rules read revision ${revisionId}`);
    }
    const pageId = heldPage?.page_id ?? nextPage++;
    if (heldPage === undefined) {
      newPages.push([pageId, master.releaseId, record.page.wiki, title, revisionId, record.page.timestamp]);
      heldPages.set(title, { page_id: pageId, title, revision_id: revisionId });
    }
    const servedRecord = served.get(recordId) ?? { recordId, rawJson: "{}" };
    const servedGlosses = servedRecord.recordId === recordId ? [] : recordGlosses((JSON.parse(servedRecord.rawJson) as { senses?: unknown }).senses);
    const definitions = record.definitions.map((definition): PlannedDefinition => {
      if (heldLines.has(`${recordId}:${definition.ref.line}`)) return { state: "already", definition };
      if (servedGlosses.some((gloss) => carries(gloss.text, definition.text))) return { state: "carried-by-served", definition, servedRecordId: servedRecord.recordId };
      const definitionIndex = nextIndex.get(recordId) ?? 0;
      nextIndex.set(recordId, definitionIndex + 1);
      return { state: "write", definition, recoveredId: nextRecovered++, definitionIndex };
    });
    return { recordId, servedRecordId: servedRecord.recordId, found: record, pageId, definitions };
  });

  const writes = records.flatMap((record) =>
    record.definitions.flatMap((planned) => (planned.state === "write" ? [{ record, planned }] : [])),
  );
  if (writes.length === 0) return { ...nothing, records };
  // Only the pages a written definition names: a record whose every definition is held or carried needs none.
  const pagesUsed = new Set(writes.map(({ record }) => record.pageId));
  const pageRows = newPages.filter(([pageId]) => pagesUsed.has(pageId as number));
  const definitionRows = writes.map(({ record, planned: { definition, recoveredId, definitionIndex } }) => [
    recoveredId,
    record.recordId,
    master.releaseId,
    record.pageId,
    definitionIndex,
    definition.route,
    null,
    definition.ref.line,
    definition.wikitext,
    definition.text,
    definition.heldAsExample,
    null,
    null,
  ]);
  const labelRows = writes.flatMap(({ planned: { definition, recoveredId } }) => definition.labels.map((label, index) => [recoveredId, index, label]));
  const exampleRows = writes.flatMap(({ planned: { definition, recoveredId } }) =>
    definition.examples.map((example, index) => [recoveredId, index, example.ref.line, example.wikitext, example.text]),
  );
  const words = [...new Set(writes.map(({ record }) => record.found.word))];
  const sql = [
    `-- Generated by src/import/loadRecoveredDefinitions.ts: ${writes.length} recovered definition(s) of ${master.releaseId} by ${RECOVERED_DEFINITION_RULES.join(", ")}: ${words.join(", ")}.`,
    ...inserts("raw_page", pageRows),
    ...inserts("recovered_definition", definitionRows),
    ...inserts("recovered_label", labelRows),
    ...inserts("recovered_example", exampleRows),
  ];
  return {
    masterReleaseId: master.releaseId,
    records,
    sql: `${sql.join("\n")}\n`,
    counts: new PlanCounts(
      { added: 0, changed: 0, removed: 0 },
      { raw_page: pageRows.length, recovered_definition: definitionRows.length, recovered_label: labelRows.length, recovered_example: exampleRows.length },
    ),
  };
}

/** The definitions the plan writes that the dictionary does not read back as planned: `word (line N)`. */
export function unwrittenDefinitions(reader: MasterReader, plan: RecoveredDefinitionPlan): string[] {
  const writes = plan.records.flatMap((record) => record.definitions.flatMap((planned) => (planned.state === "write" ? [{ record, planned }] : [])));
  if (writes.length === 0) return [];
  const rows = new Map(
    select<{ recovered_id: number; record_id: number; route: string; page_line: number; wikitext: string; text: string; labels: number }>(
      reader,
      `SELECT d.recovered_id, d.record_id, d.route, d.page_line, d.wikitext, d.text,
              (SELECT count(*) FROM recovered_label l WHERE l.recovered_id = d.recovered_id) AS labels
         FROM recovered_definition d WHERE d.recovered_id IN (SELECT value FROM json_each(${json(writes.map(({ planned }) => planned.recoveredId))}))`,
    ).map((row) => [row.recovered_id, row]),
  );
  return writes
    .filter(({ record, planned: { definition, recoveredId } }) => {
      const row = rows.get(recoveredId);
      return (
        row === undefined ||
        row.record_id !== record.recordId ||
        row.route !== definition.route ||
        row.page_line !== definition.ref.line ||
        row.wikitext !== definition.wikitext ||
        row.text !== definition.text ||
        row.labels !== definition.labels.length
      );
    })
    .map(({ record, planned }) => `${record.found.word} (line ${planned.definition.ref.line})`);
}

/** One line per definition, for the run's report: the word, its record, the page line, and what the run does with it. */
export function describePlannedRecord(record: PlannedRecord): string[] {
  const { word, posTitle, page } = record.found;
  return record.definitions.map((planned) => {
    const head = `${word} (${posTitle}, record ${record.recordId}, revision ${page.revisionId}, line ${planned.definition.ref.line}, ${planned.definition.route}): ${planned.definition.text}`;
    switch (planned.state) {
      case "write":
        return `${head} — written as recovered ${planned.recoveredId}`;
      case "already":
        return `${head} — already written`;
      case "carried-by-served":
        return `${head} — not written; record ${planned.servedRecordId}, applied in its place, carries it`;
    }
  });
}
