// The update that writes into a seeded dictionary every definition a fresh seed
// now recovers off the master's dump and the dictionary lacks (#706, #770,
// ADR 0029). A renderer change that makes more lines readable gives a fresh
// seed rows the shared dictionary never gets, since only a seed writes them;
// this load writes them through a declaration.
//
// - Record-backed: for each archive record a section matches, the recovered
//   definitions `recoverDefinitions` gives it, on every route a seed writes
//   (`below-page-control`, `sub-term`, `lead-in-item`, `wrapped-prose`,
//   `bullet-line`, `prose-line`), each with its `recovered_label` and
//   `recovered_example` rows and the `raw_page` row of its revision when the
//   dictionary has none.
// - Page-only: for each page-only entry the dictionary holds (ADR 0024, ADR
//   0028), the definitions `recoverPageEntry` reads for it, with their
//   `entry_label` and `entry_example` rows. A page-only entry the dictionary
//   lacks is `load:page-entries`' to write, and a curated correction of a
//   definition `correct:records`'.
//
// A definition is held when the dictionary has one of that record or entry read
// off that page line; a held one keeps its text, labels and examples, so a
// second run plans nothing. No record is touched, `source_record_json` least of
// all. A held row a fresh seed writes otherwise is reported, never rewritten:
// text changes are `normalize:source-text`'s.
//
// A written definition takes the next free index of its record or entry, so the
// page lists it after the ones held. That is where a fresh seed lists it when no
// held definition follows it in the seed's order. When one does, a record's
// definitions take the indexes a fresh seed gives them: the held ones that
// change index move, and nothing else of them changes. A page-only entry's
// index keys its labels, examples, facts and corrections, so there the plan is
// refused, naming it, rather than showing the page in another order.
//
// A record a feed replaced (ADR 0025) keeps the rows written for it; the
// lookup reads them for the record that replaced it (src/lookup/recovered.ts).
// So a definition the served record now carries as a gloss is not written.
//
// The SQL is one batch, run as one transaction. It holds no DDL (#509):
// `update:upgrade` rebuilds `recovered_definition` to the CHECK that admits
// every route (src/update/masterUpgrade.ts), and the command refuses to write
// before it has.

import { normalizeItalianExact } from "../italian/normalize.js";
import { recoverPageEntry, type RecoveredEntry } from "../italian/pageEntry.js";
import { carries, recordGlosses, recordText, recoverDefinitions, type RecoveredDefinition } from "../italian/recovery.js";
import { readItalianSections, type PageDefinition } from "../italian/wikitext.js";
import { PAGE_ENTRY_TABLES } from "../lookup/served.js";
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
/** The rule that writes a record's lacking recovered definition on every route a seed writes (#770). */
export const EVERY_ROUTE_RULE = "recovered-every-route/v1";
/** The rule that writes a held page-only entry's lacking definitions (#770). */
export const ENTRY_DEFINITION_RULE = "page-entry-definitions/v1";
/** The rules the load reads pages by; a declaration names them all. */
export const RECOVERED_DEFINITION_RULES = [BULLET_LINE_RULE, PROSE_LINE_RULE, EVERY_ROUTE_RULE, ENTRY_DEFINITION_RULE] as const;

/** An archive record a section matches and every definition a seed recovers for it, in the seed's order. */
export interface FoundRecord {
  /** The record's 1-based line in the archive. */
  readonly lineNo: number;
  readonly word: string;
  readonly posTitle: string;
  readonly page: RawPage;
  readonly definitions: readonly RecoveredDefinition[];
}

/** What the rules read off the master's dump and archive. */
export interface FoundDefinitions {
  /** One per archive record a seed recovers a definition for, in archive order. */
  readonly records: readonly FoundRecord[];
  /** The page-only entries a seed reads off the pages no archive record spells, by title and line. */
  readonly entries: readonly RecoveredEntry[];
}

/** Whether a seed reads a recovered definition of some record off `page`: a line below a `#` line, or one outside the `#` list. */
const hasRecoveredLines = (page: RawPage): boolean =>
  readItalianSections(page).some((section) => section.unlisted.length > 0 || section.senseLines.some((line) => line.below.length > 0));

/**
 * Read `pages` once, as a seed reads them: the pages of a title `spelled` holds
 * that give some record a recovered definition, by title, and the page-only
 * entries of every other title, by title and line. Keeps no other page.
 */
export async function readPagesForTheRules(
  pages: AsyncIterable<RawPage> | Iterable<RawPage>,
  spelled: ReadonlySet<string>,
): Promise<{ pages: Map<string, RawPage>; entries: RecoveredEntry[] }> {
  const recordPages = new Map<string, RawPage>();
  const entries: RecoveredEntry[] = [];
  for await (const page of pages) {
    if (spelled.has(page.title)) {
      if (hasRecoveredLines(page)) recordPages.set(page.title, page);
      continue;
    }
    const result = recoverPageEntry(page, spelled);
    if (result.outcome === "recovered") entries.push(...result.entries);
  }
  entries.sort((a, b) => (a.page.title < b.page.title ? -1 : a.page.title > b.page.title ? 1 : a.posRef.line - b.posRef.line));
  return { pages: recordPages, entries };
}

/**
 * The records of the archive at `archive` a seed recovers a definition for off
 * `pages`, each with what it recovers (`recoverDefinitions`), in archive order.
 */
export async function findRecoveredDefinitions(archive: string, pages: ReadonlyMap<string, RawPage>): Promise<FoundRecord[]> {
  const found: FoundRecord[] = [];
  await parseArchive({
    input: archive,
    onRejection: () => {},
    onRecord: ({ record, lineNo }) => {
      const page = pages.get(record.word);
      if (page === undefined) return;
      const recovery = recoverDefinitions(recordText(record), page);
      if (recovery.outcome === "matched" && recovery.recovered.length > 0) {
        found.push({ lineNo, word: record.word, posTitle: record.pos_title, page, definitions: recovery.recovered });
      }
    },
  });
  return found;
}

/**
 * Whether writing the lacking definitions after the held ones keeps a fresh
 * seed's order: `states` is each definition a seed writes, in its order, and no
 * held one may follow one that is lacking. One not written either way, such as
 * one a served record carries, sits anywhere.
 */
export function appendKeepsSeedOrder(states: readonly ("held" | "lacking" | "skipped")[]): boolean {
  const firstLacking = states.indexOf("lacking");
  return firstLacking === -1 || !states.slice(firstLacking).includes("held");
}

/** The definition a written recovered definition is listed under, as its row names it. */
export type WrittenLeadIn = { readonly in: "sense"; readonly senseIndex: number } | { readonly in: "recovered"; readonly recoveredId: number } | null;

/** What a run does with one definition a seed recovers for a record. */
export type PlannedDefinition =
  | {
      readonly state: "write";
      readonly definition: RecoveredDefinition;
      readonly recoveredId: number;
      readonly definitionIndex: number;
      readonly leadIn: WrittenLeadIn;
    }
  /** The dictionary holds a recovered definition of this record read off this page line. */
  | { readonly state: "already"; readonly definition: RecoveredDefinition; readonly recoveredId: number }
  /** A record a feed applied in its place carries it as a gloss, so the page shows it already. */
  | { readonly state: "carried-by-served"; readonly definition: RecoveredDefinition; readonly servedRecordId: number };

/** A held row a fresh seed does not write as it is: read off a line the seed reads nothing for the record or entry off, or with other text. Reported, never changed. */
export interface DifferingRow {
  readonly pageLine: number;
  readonly route: string;
  readonly text: string;
}

/** A held recovered definition that takes another index, so its record lists its definitions in a fresh seed's order. Its row is otherwise left as it is. */
export interface RecoveredMove {
  readonly recoveredId: number;
  readonly pageLine: number;
  readonly from: number;
  readonly to: number;
}

/** One record's planned definitions. */
export interface PlannedRecord {
  readonly recordId: number;
  /** The record served in its place: itself, unless a feed's change replaced it. */
  readonly servedRecordId: number;
  readonly found: FoundRecord;
  readonly pageId: number;
  readonly definitions: readonly PlannedDefinition[];
  /** Empty unless a written definition goes before a held one in a fresh seed's order. */
  readonly moves: readonly RecoveredMove[];
  readonly differing: readonly DifferingRow[];
}

/** What a run does with one definition a seed reads for a page-only entry. */
export type PlannedEntryDefinition =
  | { readonly state: "write"; readonly definition: PageDefinition; readonly definitionIndex: number; readonly leadInIndex: number | null }
  /** The entry holds a definition read off this page line. */
  | { readonly state: "already"; readonly definition: PageDefinition; readonly definitionIndex: number };

/** One held page-only entry's planned definitions. */
export interface PlannedEntry {
  readonly entryId: number;
  readonly entry: RecoveredEntry;
  readonly definitions: readonly PlannedEntryDefinition[];
  readonly differing: readonly DifferingRow[];
}

export interface RecoveredDefinitionPlan {
  readonly masterReleaseId: string;
  readonly records: readonly PlannedRecord[];
  /** The page-only entries the dictionary holds that a seed reads definitions for. */
  readonly entries: readonly PlannedEntry[];
  /** Empty when there is nothing to write. */
  readonly sql: string;
  /** What `sql` writes; `PlanCounts.NONE` when it is empty. No record is added, changed or removed. */
  readonly counts: PlanCounts;
}

const json = (values: readonly unknown[]): string => literal(JSON.stringify(values));
/** Above any index a record holds: a moved row waits there while the rows it passes take their places. */
const MOVE_OFFSET = 1_000_000;
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

/** A held row as the plan compares it: its place, line and text. */
interface HeldRow {
  readonly id: number;
  readonly definitionIndex: number;
  readonly pageLine: number;
  readonly route: string;
  readonly text: string;
}

/** The held rows a fresh seed does not write as they are, against what it reads by page line. */
const differingFrom = (held: readonly HeldRow[], read: ReadonlyMap<number, { text: string }>): DifferingRow[] =>
  held.filter((row) => read.get(row.pageLine)?.text !== row.text).map(({ pageLine, route, text }) => ({ pageLine, route, text }));

/** Throws, naming each, when a run would list a written definition before a held one a fresh seed lists after it. */
function requireSeedOrder(unordered: readonly string[]): void {
  if (unordered.length > 0) {
    throw new Error(`a fresh seed lists a lacking definition before a held one of: ${unordered.join(", ")}; writing it after them would show these pages in another order`);
  }
}

/**
 * Plan writing what `found` reads that the dictionary lacks: the recovered
 * definitions of the master's records and the definitions of the page-only
 * entries it holds. It reads the dictionary; it writes nothing, and its SQL
 * holds no DDL. Throws when a found record is not the master's record at that
 * line, the dictionary holds a page or entry from another revision than the one
 * read, or a written definition would be listed out of a fresh seed's order.
 */
export function planRecoveredDefinitions(reader: MasterReader, found: FoundDefinitions): RecoveredDefinitionPlan {
  const master = readMasterRelease(reader);
  const records = planRecords(reader, master.releaseId, found.records);
  const entries = planEntries(reader, master.releaseId, found.entries);
  const nothing: RecoveredDefinitionPlan = { masterReleaseId: master.releaseId, records: records.planned, entries, sql: "", counts: PlanCounts.NONE };

  const writes = records.planned.flatMap((record) => record.definitions.flatMap((planned) => (planned.state === "write" ? [{ record, planned }] : [])));
  const moves = records.planned.flatMap((record) => record.moves);
  const entryWrites = entries.flatMap((entry) => entry.definitions.flatMap((planned) => (planned.state === "write" ? [{ entry, planned }] : [])));
  if (writes.length === 0 && entryWrites.length === 0) return nothing;

  // Only the pages a written definition names: a record whose every definition is held or carried needs none.
  const pagesUsed = new Set(writes.map(({ record }) => record.pageId));
  const pageRows = records.newPages.filter(([pageId]) => pagesUsed.has(pageId as number));
  const definitionRows = writes.map(({ record, planned: { definition, recoveredId, definitionIndex, leadIn } }) => [
    recoveredId,
    record.recordId,
    master.releaseId,
    record.pageId,
    definitionIndex,
    definition.route,
    definition.route === "sub-term" ? definition.term : null,
    definition.ref.line,
    definition.wikitext,
    definition.text,
    definition.heldAsExample,
    leadIn?.in === "sense" ? leadIn.senseIndex : null,
    leadIn?.in === "recovered" ? leadIn.recoveredId : null,
  ]);
  const labelRows = writes.flatMap(({ planned: { definition, recoveredId } }) => definition.labels.map((label, index) => [recoveredId, index, label]));
  const exampleRows = writes.flatMap(({ planned: { definition, recoveredId } }) =>
    definition.examples.map((example, index) => [recoveredId, index, example.ref.line, example.wikitext, example.text]),
  );
  const entryDefinitionRows = entryWrites.map(({ entry, planned: { definition, definitionIndex, leadInIndex } }) => [
    entry.entryId,
    definitionIndex,
    definition.route,
    definition.route === "sub-term" ? definition.term : null,
    definition.ref.line,
    definition.wikitext,
    definition.text,
    leadInIndex,
  ]);
  const entryLabelRows = entryWrites.flatMap(({ entry, planned: { definition, definitionIndex } }) =>
    definition.labels.map((label, index) => [entry.entryId, definitionIndex, index, label]),
  );
  const entryExampleRows = entryWrites.flatMap(({ entry, planned: { definition, definitionIndex } }) =>
    definition.examples.map((example, index) => [entry.entryId, definitionIndex, index, example.ref.line, example.wikitext, example.text]),
  );
  const words = [...new Set(writes.map(({ record }) => record.found.word))];
  const titles = [...new Set(entryWrites.map(({ entry }) => entry.entry.page.title))];
  const movedWords = [...new Set(records.planned.filter((record) => record.moves.length > 0).map((record) => record.found.word))];
  const sql = [
    `-- Generated by src/import/loadRecoveredDefinitions.ts by ${RECOVERED_DEFINITION_RULES.join(", ")} over ${master.releaseId}.`,
    ...(writes.length === 0 ? [] : [`-- ${writes.length} recovered definition(s) of records: ${words.join(", ")}.`]),
    ...(entryWrites.length === 0 ? [] : [`-- ${entryWrites.length} definition(s) of held page-only entries: ${titles.join(", ")}.`]),
    ...(moves.length === 0
      ? []
      : [
          `-- ${moves.length} held recovered definition(s) take a fresh seed's index, out of the way first: ${movedWords.join(", ")}.`,
          `UPDATE recovered_definition SET definition_index = definition_index + ${MOVE_OFFSET} WHERE recovered_id IN (SELECT value FROM json_each(${json(moves.map(({ recoveredId }) => recoveredId))}));`,
          ...moves.map(({ recoveredId, to }) => `UPDATE recovered_definition SET definition_index = ${to} WHERE recovered_id = ${recoveredId};`),
        ]),
    ...inserts("raw_page", pageRows),
    ...inserts("recovered_definition", definitionRows),
    ...inserts("recovered_label", labelRows),
    ...inserts("recovered_example", exampleRows),
    ...inserts("entry_definition", entryDefinitionRows),
    ...inserts("entry_label", entryLabelRows),
    ...inserts("entry_example", entryExampleRows),
  ];
  return {
    ...nothing,
    sql: `${sql.join("\n")}\n`,
    counts: new PlanCounts(
      { added: 0, changed: 0, removed: 0 },
      {
        raw_page: pageRows.length,
        recovered_definition: definitionRows.length + moves.length,
        recovered_label: labelRows.length,
        recovered_example: exampleRows.length,
        entry_definition: entryDefinitionRows.length,
        entry_label: entryLabelRows.length,
        entry_example: entryExampleRows.length,
      },
    ),
  };
}

/** Plan the record-backed definitions of `found`, with the `raw_page` rows a written one may need. */
function planRecords(reader: MasterReader, releaseId: string, found: readonly FoundRecord[]): { planned: PlannedRecord[]; newPages: unknown[][] } {
  if (found.length === 0) return { planned: [], newPages: [] };
  const release = literal(releaseId);
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
      `the master ${releaseId} does not hold these records at the archive's lines: ` + mismatched.map(({ word, lineNo }) => `${word} (line ${lineNo})`).join(", "),
    );
  }
  const recordIdOf = (record: FoundRecord): number => (atLine.get(record.lineNo) as { record_id: number }).record_id;
  const recordIds = found.map(recordIdOf);
  const heldByRecord = new Map<number, HeldRow[]>();
  for (const row of select<{ recovered_id: number; record_id: number; definition_index: number; page_line: number; route: string; text: string }>(
    reader,
    `SELECT recovered_id, record_id, definition_index, page_line, route, text FROM recovered_definition
      WHERE record_id IN (SELECT value FROM json_each(${json(recordIds)})) ORDER BY record_id, definition_index`,
  )) {
    const rows = heldByRecord.get(row.record_id) ?? [];
    rows.push({ id: row.recovered_id, definitionIndex: row.definition_index, pageLine: row.page_line, route: row.route, text: row.text });
    heldByRecord.set(row.record_id, rows);
  }
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

  const planned = found.map((record): PlannedRecord => {
    const recordId = recordIdOf(record);
    const { title, revisionId } = record.page;
    const heldPage = heldPages.get(title);
    if (heldPage !== undefined && heldPage.revision_id !== revisionId) {
      throw new Error(`the dictionary holds revision ${heldPage.revision_id} of ${title}, the rules read revision ${revisionId}`);
    }
    const pageId = heldPage?.page_id ?? nextPage++;
    if (heldPage === undefined) {
      newPages.push([pageId, releaseId, record.page.wiki, title, revisionId, record.page.timestamp]);
      heldPages.set(title, { page_id: pageId, title, revision_id: revisionId });
    }
    const held = heldByRecord.get(recordId) ?? [];
    const heldAt = new Map(held.map((row) => [row.pageLine, row]));
    const servedRecord = served.get(recordId) ?? { recordId, rawJson: "{}" };
    const servedGlosses = servedRecord.recordId === recordId ? [] : recordGlosses((JSON.parse(servedRecord.rawJson) as { senses?: unknown }).senses);
    const states = record.definitions.map((definition) =>
      heldAt.has(definition.ref.line) ? "held" : servedGlosses.some((gloss) => carries(gloss.text, definition.text)) ? "skipped" : "lacking",
    );
    const places = placeInSeedOrder(held, record.definitions, states);
    const definitions: PlannedDefinition[] = [];
    record.definitions.forEach((definition, position) => {
      const heldRow = heldAt.get(definition.ref.line);
      if (heldRow !== undefined) definitions.push({ state: "already", definition, recoveredId: heldRow.id });
      else if (states[position] === "skipped") definitions.push({ state: "carried-by-served", definition, servedRecordId: servedRecord.recordId });
      else {
        const definitionIndex = places.written[position] as number;
        definitions.push({ state: "write", definition, recoveredId: nextRecovered++, definitionIndex, leadIn: leadInOf(definition, definitions) });
      }
    });
    const read = new Map(record.definitions.map((definition) => [definition.ref.line, definition]));
    return { recordId, servedRecordId: servedRecord.recordId, found: record, pageId, definitions, moves: places.moves, differing: differingFrom(held, read) };
  });
  return { planned, newPages };
}

/**
 * Where a record's lacking definitions go, and which held ones move. When
 * appending keeps a fresh seed's order, each takes the next free index and no
 * held one moves. Otherwise every definition the seed writes takes its place in
 * the seed's list, as a fresh seed numbers it, and a held one the seed no longer
 * writes goes after them in the order it had; each held one whose index that
 * changes moves (`magrebina`'s held prose line, after a wrapped-prose line the
 * seed now reads above it). A held row keeps its id, so a lead-in still names
 * its items, and the lookup lists the record's definitions by index.
 */
function placeInSeedOrder(
  held: readonly HeldRow[],
  read: readonly RecoveredDefinition[],
  states: readonly ("held" | "lacking" | "skipped")[],
): { written: (number | undefined)[]; moves: RecoveredMove[] } {
  const written: (number | undefined)[] = [];
  if (appendKeepsSeedOrder(states)) {
    let next = held.reduce((max, row) => Math.max(max, row.definitionIndex + 1), 0);
    states.forEach((state, position) => (written[position] = state === "lacking" ? next++ : undefined));
    return { written, moves: [] };
  }
  const target = new Map<number, number>();
  const heldAt = new Map(held.map((row) => [row.pageLine, row]));
  read.forEach((definition, position) => {
    const row = heldAt.get(definition.ref.line);
    if (row !== undefined) target.set(row.id, position);
    written[position] = states[position] === "lacking" ? position : undefined;
  });
  let next = read.length;
  for (const row of held) if (!target.has(row.id)) target.set(row.id, next++);
  const moves = held.flatMap((row) => {
    const to = target.get(row.id) as number;
    return to === row.definitionIndex ? [] : [{ recoveredId: row.id, pageLine: row.pageLine, from: row.definitionIndex, to }];
  });
  return { written, moves };
}

/**
 * The row a written recovered definition names as its lead-in, from what the
 * seed placed it under: a sense of its record, or a definition recovered before
 * it, held or written now. A lead-in a served record carries is not written, so
 * an item under it is read at the top of the list, as the lookup reads one whose
 * lead-in it drops.
 */
function leadInOf(definition: RecoveredDefinition, before: readonly PlannedDefinition[]): WrittenLeadIn {
  const under = definition.listedUnder;
  if (under === null) return null;
  if (under.in === "sense") return { in: "sense", senseIndex: under.senseIndex };
  const leadIn = before[under.index];
  if (leadIn === undefined) throw new Error(`a recovered definition at line ${definition.ref.line} is listed under one not recovered before it`);
  return leadIn.state === "carried-by-served" ? null : { in: "recovered", recoveredId: leadIn.recoveredId };
}

/** Plan the definitions of the page-only entries of `found` the dictionary holds. */
function planEntries(reader: MasterReader, releaseId: string, found: readonly RecoveredEntry[]): PlannedEntry[] {
  if (found.length === 0) return [];
  const tables = new Set(
    select<{ name: string }>(reader, `SELECT name FROM sqlite_schema WHERE type = 'table' AND name IN (SELECT value FROM json_each(${json(PAGE_ENTRY_TABLES)}))`).map((row) => row.name),
  );
  // A dictionary without the page-only tables holds no entry yet: `load:page-entries` writes them whole.
  if (!PAGE_ENTRY_TABLES.every((name) => tables.has(name))) return [];
  const titles = [...new Set(found.map((entry) => entry.page.title))];
  const place = (word: string, line: number): string => `${word}\u0000${line}`;
  const heldEntries = new Map(
    select<{ entry_id: number; word: string; page_line: number; revision_id: number }>(
      reader,
      `SELECT e.entry_id, e.word, e.page_line, p.revision_id FROM recovered_entry e JOIN raw_page p ON p.page_id = e.page_id
        WHERE e.release_id = ${literal(releaseId)} AND e.word IN (SELECT value FROM json_each(${json(titles)}))`,
    ).map((row) => [place(row.word, row.page_line), row]),
  );
  const heldIds = [...heldEntries.values()].map((row) => row.entry_id);
  const heldByEntry = new Map<number, HeldRow[]>();
  for (const row of select<{ entry_id: number; definition_index: number; page_line: number; route: string; text: string }>(
    reader,
    `SELECT entry_id, definition_index, page_line, route, text FROM entry_definition
      WHERE entry_id IN (SELECT value FROM json_each(${json(heldIds)})) ORDER BY entry_id, definition_index`,
  )) {
    const rows = heldByEntry.get(row.entry_id) ?? [];
    rows.push({ id: row.entry_id, definitionIndex: row.definition_index, pageLine: row.page_line, route: row.route, text: row.text });
    heldByEntry.set(row.entry_id, rows);
  }

  const unordered: string[] = [];
  const planned = found.flatMap((entry): PlannedEntry[] => {
    const heldEntry = heldEntries.get(place(entry.page.title, entry.posRef.line));
    if (heldEntry === undefined) return [];
    if (heldEntry.revision_id !== entry.page.revisionId) {
      throw new Error(`the dictionary holds an entry of ${entry.page.title} read from revision ${heldEntry.revision_id}, the rule read revision ${entry.page.revisionId}`);
    }
    const held = heldByEntry.get(heldEntry.entry_id) ?? [];
    const heldAt = new Map(held.map((row) => [row.pageLine, row]));
    let nextIndex = held.reduce((next, row) => Math.max(next, row.definitionIndex + 1), 0);
    const definitions: PlannedEntryDefinition[] = [];
    for (const definition of entry.definitions) {
      const heldRow = heldAt.get(definition.ref.line);
      if (heldRow !== undefined) {
        definitions.push({ state: "already", definition, definitionIndex: heldRow.definitionIndex });
        continue;
      }
      // As the seed writes it (pageEntryRows.ts): the definition above it whose line its lead-in names.
      const leadIn = definition.leadIn === null ? undefined : definitions.find((before) => before.definition.ref.line === definition.leadIn?.ref.line);
      definitions.push({ state: "write", definition, definitionIndex: nextIndex++, leadInIndex: leadIn?.definitionIndex ?? null });
    }
    if (!appendKeepsSeedOrder(definitions.map(({ state }) => (state === "already" ? "held" : "lacking")))) {
      unordered.push(`${entry.page.title} (entry ${heldEntry.entry_id}, line ${entry.posRef.line})`);
    }
    const read = new Map(entry.definitions.map((definition) => [definition.ref.line, definition]));
    return [{ entryId: heldEntry.entry_id, entry, definitions, differing: differingFrom(held, read) }];
  });
  requireSeedOrder(unordered);
  return planned;
}

/** The definitions the plan writes that the dictionary does not read back as planned: `word (line N)`. */
export function unwrittenDefinitions(reader: MasterReader, plan: RecoveredDefinitionPlan): string[] {
  const writes = plan.records.flatMap((record) => record.definitions.flatMap((planned) => (planned.state === "write" ? [{ record, planned }] : [])));
  const entryWrites = plan.entries.flatMap((entry) => entry.definitions.flatMap((planned) => (planned.state === "write" ? [{ entry, planned }] : [])));
  const rows =
    writes.length === 0
      ? new Map()
      : new Map(
          select<{ recovered_id: number; record_id: number; route: string; page_line: number; wikitext: string; text: string; labels: number; examples: number }>(
            reader,
            `SELECT d.recovered_id, d.record_id, d.route, d.page_line, d.wikitext, d.text,
                    (SELECT count(*) FROM recovered_label l WHERE l.recovered_id = d.recovered_id) AS labels,
                    (SELECT count(*) FROM recovered_example x WHERE x.recovered_id = d.recovered_id) AS examples
               FROM recovered_definition d WHERE d.recovered_id IN (SELECT value FROM json_each(${json(writes.map(({ planned }) => planned.recoveredId))}))`,
          ).map((row) => [row.recovered_id, row]),
        );
  const entryRows =
    entryWrites.length === 0
      ? new Map()
      : new Map(
          select<{ entry_id: number; definition_index: number; route: string; page_line: number; wikitext: string; text: string; labels: number; examples: number }>(
            reader,
            `SELECT d.entry_id, d.definition_index, d.route, d.page_line, d.wikitext, d.text,
                    (SELECT count(*) FROM entry_label l WHERE l.entry_id = d.entry_id AND l.definition_index = d.definition_index) AS labels,
                    (SELECT count(*) FROM entry_example x WHERE x.entry_id = d.entry_id AND x.definition_index = d.definition_index) AS examples
               FROM entry_definition d WHERE d.entry_id IN (SELECT value FROM json_each(${json([...new Set(entryWrites.map(({ entry }) => entry.entryId))])}))`,
          ).map((row) => [`${row.entry_id}:${row.definition_index}`, row]),
        );
  const differs = (row: { route: string; page_line: number; wikitext: string; text: string; labels: number; examples: number } | undefined, definition: PageDefinition): boolean =>
    row === undefined ||
    row.route !== definition.route ||
    row.page_line !== definition.ref.line ||
    row.wikitext !== definition.wikitext ||
    row.text !== definition.text ||
    row.labels !== definition.labels.length ||
    row.examples !== definition.examples.length;
  return [
    ...writes
      .filter(({ record, planned }) => {
        const row = rows.get(planned.recoveredId);
        return differs(row, planned.definition) || row.record_id !== record.recordId;
      })
      .map(({ record, planned }) => `${record.found.word} (line ${planned.definition.ref.line})`),
    ...entryWrites
      .filter(({ entry, planned }) => differs(entryRows.get(`${entry.entryId}:${planned.definitionIndex}`), planned.definition))
      .map(({ entry, planned }) => `${entry.entry.page.title} (line ${planned.definition.ref.line})`),
    ...unmoved(reader, plan),
  ];
}

/** The held definitions the plan moves that the dictionary does not hold at their new index: `word (line N, index M)`. */
function unmoved(reader: MasterReader, plan: RecoveredDefinitionPlan): string[] {
  const moves = plan.records.flatMap((record) => record.moves.map((move) => ({ record, move })));
  if (moves.length === 0) return [];
  const indexes = new Map(
    select<{ recovered_id: number; definition_index: number }>(
      reader,
      `SELECT recovered_id, definition_index FROM recovered_definition WHERE recovered_id IN (SELECT value FROM json_each(${json(moves.map(({ move }) => move.recoveredId))}))`,
    ).map((row) => [row.recovered_id, row.definition_index]),
  );
  return moves.filter(({ move }) => indexes.get(move.recoveredId) !== move.to).map(({ record, move }) => `${record.found.word} (line ${move.pageLine}, index ${move.to})`);
}

const labelled = (definition: PageDefinition): string => (definition.labels.length === 0 ? "" : ` [${definition.labels.join(", ")}]`);

/** One line per definition, for the run's report: the word, its record, the page line, and what the run does with it. */
export function describePlannedRecord(record: PlannedRecord): string[] {
  const { word, posTitle, page, lineNo } = record.found;
  return [
    ...record.definitions.map((planned) => {
      const head = `${word} (${posTitle}, archive line ${lineNo}, record ${record.recordId}, revision ${page.revisionId}, line ${planned.definition.ref.line}, ${planned.definition.route}): ${planned.definition.text}${labelled(planned.definition)}`;
      switch (planned.state) {
        case "write":
          return `${head} — written as recovered ${planned.recoveredId}`;
        case "already":
          return `${head} — already written`;
        case "carried-by-served":
          return `${head} — not written; record ${planned.servedRecordId}, applied in its place, carries it`;
      }
    }),
    ...record.differing.map(
      (row) => `${word} (${posTitle}, archive line ${lineNo}, record ${record.recordId}, line ${row.pageLine}, ${row.route}): ${row.text} — held, and a fresh seed does not write it so; left as it is`,
    ),
    ...record.moves.map(
      (move) => `${word} (${posTitle}, archive line ${lineNo}, record ${record.recordId}, line ${move.pageLine}): held as recovered ${move.recoveredId} — moved from index ${move.from} to ${move.to}, a fresh seed's`,
    ),
  ];
}

/** One line per definition of a held page-only entry, for the run's report. */
export function describePlannedEntry(planned: PlannedEntry): string[] {
  const { page, posRef, pos } = planned.entry;
  const at = `${page.title} (page-only entry ${planned.entryId}, ${pos}, line ${posRef.line}, revision ${page.revisionId}`;
  return [
    ...planned.definitions.map((definition) => {
      const head = `${at}, line ${definition.definition.ref.line}, ${definition.definition.route}): ${definition.definition.text}${labelled(definition.definition)}`;
      return definition.state === "write" ? `${head} — written as definition ${definition.definitionIndex}` : `${head} — already written`;
    }),
    ...planned.differing.map((row) => `${at}, line ${row.pageLine}, ${row.route}): ${row.text} — held, and a fresh seed does not write it so; left as it is`),
  ];
}

/** What the plan writes, one line per definition, and what it leaves: the list the pull request plan check prints. */
export function planListing(plan: RecoveredDefinitionPlan): string[] {
  const described = [...plan.records.flatMap(describePlannedRecord), ...plan.entries.flatMap(describePlannedEntry)];
  const written = described.filter((line) => line.includes(" — written as "));
  const moved = described.filter((line) => line.includes(" — moved from index "));
  const differing = plan.records.reduce((total, record) => total + record.differing.length, 0) + plan.entries.reduce((total, entry) => total + entry.differing.length, 0);
  const keys = new Set([...plan.records.flatMap((record) => (record.definitions.some((planned) => planned.state === "write") ? [record.found.word] : [])), ...plan.entries.flatMap((entry) => (entry.definitions.some((planned) => planned.state === "write") ? [entry.entry.page.title] : []))].map(normalizeItalianExact));
  return [
    ...written,
    ...moved,
    `${written.length} definition(s) written for ${keys.size} word(s), and ${moved.length} held one(s) moved to a fresh seed's index; afterwards the dictionary lacks none a fresh seed writes for the records and held entries read.`,
    `${differing} held definition(s) of those records and entries a fresh seed does not write as held; left as they are.`,
  ];
}
