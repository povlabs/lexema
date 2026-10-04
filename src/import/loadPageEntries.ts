// The update that loads page-only entries (ADR 0024, ADR 0028) into a
// dictionary seeded before them (#440, #477). It writes what a seed now writes for
// each entry and nothing else: the `raw_page` row of the revision it was read
// from, its `recovered_entry`, `entry_definition`, `entry_label`,
// `entry_example` and `entry_fact` rows (pageEntryRows.ts), the `corrected_definition` rows the
// curated list gives it (correctedDefinitions.ts), and the `accent_fold` and
// `typo_key` rows of its word's key. It writes rows only: the five tables and
// `corrected_definition` come from `update:upgrade` (src/update/masterUpgrade.ts),
// which the dictionary deploy runs as its own step before any data (#507). No
// record is touched, `source_record_json` least of all, and no applied change
// or hide is undone.
//
// Which pages give entries is the seed's rule (seedSql.ts): every page of the
// master's dump whose title no record of the master's archive spells, read by
// `recoverPageEntry`, one entry per part-of-speech section. A title a record
// of any release spells, hidden or replaced included, gets none, as in the
// seed; the dictionary is read for the records a feed added.
//
// The SQL is one batch, run as one transaction, like a hide
// (src/import/hideRecords.ts). An entry the dictionary already holds, by its
// word and the page line that states its part of speech, is left alone, so a
// second run plans nothing. A dictionary loaded under rule v1 alone (#440)
// keeps those entries: rule v2 reads a page rule v1 recovers as v1 still
// (pageEntry.ts), so the load adds only the entries rule v2 gives.

import { correctionId, definitionCorrections, definitionMismatch, type CuratedCorrection } from "../italian/curatedCorrections.js";
import { normalizeItalianExact } from "../italian/normalize.js";
import { PAGE_ENTRY_RULE, PAGE_ENTRY_RULE_V2, recoverPageEntry, type RecoveredEntry } from "../italian/pageEntry.js";
import { PAGE_ENTRY_TABLES } from "../lookup/served.js";
import type { RawPage } from "../source/rawPage.js";
import { missingUpgrade, readMasterRelease, select, type MasterReader } from "../update/master.js";
import { PAGE_ENTRY_CORRECTION_TABLES, PAGE_ENTRY_FACT_TABLES, PAGE_ENTRY_INDEXES } from "../update/masterUpgrade.js";
import { PlanCounts } from "../update/planCounts.js";
import { correctedDefinitionValues, correctsEntry } from "./correctedDefinitions.js";
import { parseArchive } from "./importRelease.js";
import { entryDefinitionsOf, pageEntryRows } from "./pageEntryRows.js";
import { nearbyEdits } from "../update/apply.js";
import { COLUMNS, literal, tupleOf } from "./seedSql.js";

/** The rules the load reads pages by; a declaration names them all. */
export const PAGE_ENTRY_RULES = [PAGE_ENTRY_RULE, PAGE_ENTRY_RULE_V2] as const;

/** What a run does with one entry the rule reads off the dump. */
export type PlannedEntry =
  | { readonly state: "write"; readonly entry: RecoveredEntry; readonly entryId: number; readonly pageId: number }
  | { readonly state: "already"; readonly entry: RecoveredEntry; readonly entryId: number }
  /** A record of some release spells the title, hidden or replaced included: the seed recovers no entry for it either. */
  | { readonly state: "spelled-by-a-record"; readonly entry: RecoveredEntry };

/** One curated definition correction the load writes beside an entry it writes. */
export interface PlannedDefinitionCorrection {
  readonly id: string;
  readonly entryId: number;
  readonly title: string;
}

export interface PageEntryPlan {
  readonly masterReleaseId: string;
  /** Every entry the rule read, by title. */
  readonly entries: readonly PlannedEntry[];
  readonly corrections: readonly PlannedDefinitionCorrection[];
  /** Empty when there is nothing to write. */
  readonly sql: string;
  /** What `sql` writes and deletes; `PlanCounts.NONE` when it is empty. A page-only entry is not a record, so every record count is 0. */
  readonly counts: PlanCounts;
}

const json = (values: readonly unknown[]): string => literal(JSON.stringify(values));
/** Where an entry sits: its word and the page line that states its part of speech, which tell a word's entries apart. */
const placeOf = (word: string, pageLine: number): string => `${word}\u0000${pageLine}`;
const CHUNK = 200;

/** `tuples` as INSERTs into `table` of at most `CHUNK` rows each. */
function inserts(table: keyof typeof COLUMNS, tuples: readonly (readonly unknown[])[]): string[] {
  const statements: string[] = [];
  for (let start = 0; start < tuples.length; start += CHUNK) {
    statements.push(`INSERT INTO ${table} (${COLUMNS[table]}) VALUES\n  ${tuples.slice(start, start + CHUNK).map((values) => tupleOf(table, values)).join(",\n  ")};`);
  }
  return statements;
}

/**
 * What the upgrade creates for the load to write into. A plan reads a
 * dictionary without them as one holding no entry yet, so a plan-only run
 * counts the same before the upgrade as after it. The load's SQL needs them:
 * the deploy runs the upgrade first, and `load:page-entries` refuses to write
 * without them.
 */
const PAGE_ENTRY_UPGRADE: readonly string[] = [...PAGE_ENTRY_TABLES, ...PAGE_ENTRY_FACT_TABLES, ...PAGE_ENTRY_CORRECTION_TABLES, ...PAGE_ENTRY_INDEXES];

/** The upgrade names the load writes into that the dictionary lacks: run `update:upgrade` before the load's SQL while any is listed. */
export const missingForLoad = (reader: MasterReader): string[] => missingUpgrade(reader).filter((name) => PAGE_ENTRY_UPGRADE.includes(name));

/** Throws unless the dictionary has every table and view the upgrade adds, the page-entry ones aside. */
function requireUpdateTables(reader: MasterReader): void {
  const missing = missingUpgrade(reader).filter((name) => !PAGE_ENTRY_UPGRADE.includes(name));
  if (missing.length > 0) throw new Error(`the dictionary lacks ${missing.join(", ")}; run pnpm run update:upgrade first`);
}

/** Which of `names` the dictionary has. */
const tablesIn = (reader: MasterReader, names: readonly string[]): Set<string> =>
  new Set(select<{ name: string }>(reader, `SELECT name FROM sqlite_schema WHERE type = 'table' AND name IN (SELECT value FROM json_each(${json(names)}))`).map((row) => row.name));

/**
 * The words the records of `archive` spell, hidden ones included: the seed
 * reads no page-only entry for a page of one of these titles (seedSql.ts).
 */
export async function archiveWords(archive: string): Promise<Set<string>> {
  const words = new Set<string>();
  await parseArchive({ input: archive, onRejection: () => {}, onRecord: ({ record }) => void words.add(record.word) });
  return words;
}

/** Entries by title, then by the page line that states their part of speech. */
const byPlace = (a: RecoveredEntry, b: RecoveredEntry): number =>
  a.page.title < b.page.title ? -1 : a.page.title > b.page.title ? 1 : a.posRef.line - b.posRef.line;

/**
 * The entries the rule reads off `pages` for every title `spelled` lacks, as
 * the seed reads them: one per part-of-speech section, by title and line.
 * Reads each page once and keeps nothing else.
 */
export async function findPageEntries(pages: AsyncIterable<RawPage> | Iterable<RawPage>, spelled: ReadonlySet<string>): Promise<RecoveredEntry[]> {
  const found: RecoveredEntry[] = [];
  for await (const page of pages) {
    if (spelled.has(page.title)) continue;
    const result = recoverPageEntry(page, spelled);
    if (result.outcome === "recovered") found.push(...result.entries);
  }
  return found.sort(byPlace);
}

/**
 * Plan loading `found`, the entries the rule read off the master's dump for
 * the titles its archive does not spell. It reads the dictionary; it writes
 * nothing. Its SQL holds no DDL: it writes into the tables `update:upgrade`
 * creates (`missingForLoad`). Throws when the dictionary holds some page-entry
 * tables but not all, or holds a title's page or entry from another revision
 * than the one read.
 */
export function planPageEntries(reader: MasterReader, found: readonly RecoveredEntry[], corrections: readonly CuratedCorrection[]): PageEntryPlan {
  requireUpdateTables(reader);
  const master = readMasterRelease(reader);
  const release = literal(master.releaseId);
  const tables = tablesIn(reader, PAGE_ENTRY_TABLES);
  const pageTables = PAGE_ENTRY_TABLES.filter((name) => tables.has(name));
  if (pageTables.length > 0 && pageTables.length < PAGE_ENTRY_TABLES.length) {
    throw new Error(`the dictionary has ${pageTables.join(", ")} but not every page-entry table (${PAGE_ENTRY_TABLES.join(", ")})`);
  }
  const hasEntries = pageTables.length === PAGE_ENTRY_TABLES.length;
  const titles = [...new Set(found.map((entry) => entry.page.title))];
  const nothing: PageEntryPlan = { masterReleaseId: master.releaseId, entries: [], corrections: [], sql: "", counts: PlanCounts.NONE };
  if (titles.length === 0) return nothing;

  const inTitles = `IN (SELECT value FROM json_each(${json(titles)}))`;
  const spelled = new Set(select<{ word: string }>(reader, `SELECT DISTINCT word FROM source_record WHERE word ${inTitles}`).map((row) => row.word));
  const heldEntries = new Map(
    hasEntries
      ? select<{ entry_id: number; word: string; page_line: number; revision_id: number }>(
          reader,
          `SELECT e.entry_id, e.word, e.page_line, p.revision_id FROM recovered_entry e JOIN raw_page p ON p.page_id = e.page_id
            WHERE e.release_id = ${release} AND e.word ${inTitles}`,
        ).map((row) => [placeOf(row.word, row.page_line), row])
      : [],
  );
  const heldPages = new Map(
    select<{ page_id: number; title: string; revision_id: number }>(
      reader,
      `SELECT page_id, title, revision_id FROM raw_page WHERE release_id = ${release} AND wiki = 'it.wiktionary.org' AND title ${inTitles}`,
    ).map((row) => [row.title, row]),
  );
  const [{ max: maxPage }] = select<{ max: number | null }>(reader, "SELECT max(page_id) AS max FROM raw_page");
  const [{ max: maxEntry }] = hasEntries ? select<{ max: number | null }>(reader, "SELECT max(entry_id) AS max FROM recovered_entry") : [{ max: null }];
  let nextPage = (maxPage ?? 0) + 1;
  let nextEntry = (maxEntry ?? 0) + 1;

  const newPages: unknown[][] = [];
  const entries = found.map((entry): PlannedEntry => {
    const { title, revisionId } = entry.page;
    if (spelled.has(title)) return { state: "spelled-by-a-record", entry };
    const heldPage = heldPages.get(title);
    if (heldPage !== undefined && heldPage.revision_id !== revisionId) {
      throw new Error(`the dictionary holds revision ${heldPage.revision_id} of ${title}, the rule read revision ${revisionId}`);
    }
    const held = heldEntries.get(placeOf(title, entry.posRef.line));
    if (held !== undefined) {
      if (held.revision_id !== revisionId) throw new Error(`the dictionary holds an entry of ${title} read from revision ${held.revision_id}, the rule read revision ${revisionId}`);
      return { state: "already", entry, entryId: held.entry_id };
    }
    const pageId = heldPage?.page_id ?? nextPage++;
    if (heldPage === undefined) {
      newPages.push([pageId, master.releaseId, entry.page.wiki, title, revisionId, entry.page.timestamp]);
      // A page gives several entries (ADR 0028); they share its one raw_page row.
      heldPages.set(title, { page_id: pageId, title, revision_id: revisionId });
    }
    return { state: "write", entry, entryId: nextEntry++, pageId };
  });
  const writes = entries.flatMap((planned) => (planned.state === "write" ? [planned] : []));
  if (writes.length === 0) return { ...nothing, entries };

  const rows = writes.map(({ entry, entryId, pageId }) => pageEntryRows(entryId, master.releaseId, pageId, entry));
  const definitionList = definitionCorrections(corrections);
  const correctionRows = writes.flatMap(({ entry, entryId }) =>
    definitionList
      .filter((correction) => correctsEntry(correction, { title: entry.page.title, pos: entry.pos }) && definitionMismatch(correction, entryDefinitionsOf(entry)) === undefined)
      .map((correction) => ({ id: correctionId(correction), entryId, title: entry.page.title, values: [entryId, correction.replaces.index, ...correctedDefinitionValues(correction)] })),
  );
  // The `accent_fold` and `typo_key` rows of the keys a write reaches, as the
  // seed writes them: each key headed, and ranked by its lemma records and the
  // definitions of every page-only entry of it, written now or held. Rows held
  // for a key that differ are deleted, whatever release wrote them.
  const written = new Set(writes.map(({ entry }) => entry.page.title));
  const writtenKeys = new Set([...written].map(normalizeItalianExact));
  const pageScores = new Map<string, number>();
  for (const planned of entries) {
    const key = normalizeItalianExact(planned.entry.page.title);
    if (planned.state !== "spelled-by-a-record" && writtenKeys.has(key)) pageScores.set(key, (pageScores.get(key) ?? 0) + planned.entry.definitions.length);
  }
  const nearby = nearbyEdits(reader, [master.releaseId, ...master.feeds.map((feed) => feed.releaseId)], [...writtenKeys], new Set(), [], [], pageScores);
  const all = <Table extends "entry_definition" | "entry_label" | "entry_example" | "entry_fact">(table: Table) => rows.flatMap((entry) => entry[table]);

  const sql = [
    `-- Generated by src/import/loadPageEntries.ts: ${writes.length} page-only entr${writes.length === 1 ? "y" : "ies"} of ${master.releaseId} by ${PAGE_ENTRY_RULES.join(", ")}: ${[...written].join(", ")}.`,
    ...inserts("raw_page", newPages),
    ...inserts("recovered_entry", rows.map((entry) => entry.recovered_entry)),
    ...inserts("entry_definition", all("entry_definition")),
    ...inserts("entry_label", all("entry_label")),
    ...inserts("entry_example", all("entry_example")),
    ...inserts("entry_fact", all("entry_fact")),
    ...inserts("corrected_definition", correctionRows.map((row) => row.values)),
    ...nearby.deletes,
    ...inserts("accent_fold", nearby.accent.map((row) => [master.releaseId, row.foldKey, row.surfaceKey, row.headword, row.languages, row.richness])),
    ...inserts("typo_key", nearby.typo.map((row) => [master.releaseId, row.deletionKey, row.surfaceKey, row.languages, row.richness])),
  ];
  return {
    masterReleaseId: master.releaseId,
    entries,
    corrections: correctionRows.map(({ id, entryId, title }) => ({ id, entryId, title })),
    sql: `${sql.join("\n")}\n`,
    counts: new PlanCounts(
      { added: 0, changed: 0, removed: 0 },
      {
        raw_page: newPages.length,
        recovered_entry: rows.length,
        entry_definition: all("entry_definition").length,
        entry_label: all("entry_label").length,
        entry_example: all("entry_example").length,
        entry_fact: all("entry_fact").length,
        corrected_definition: correctionRows.length,
        accent_fold: nearby.accent.length,
        typo_key: nearby.typo.length,
      },
      nearby.replaced,
    ),
  };
}

/** The entries the plan writes that the dictionary does not read back as planned: by title. */
export function unloaded(reader: MasterReader, plan: PageEntryPlan): string[] {
  const writes = plan.entries.flatMap((planned) => (planned.state === "write" ? [planned] : []));
  if (writes.length === 0) return [];
  const ids = json(writes.map(({ entryId }) => entryId));
  const held = new Map(
    select<{ entry_id: number; word: string; revision_id: number; definitions: number; labels: number; examples: number; facts: number; corrections: number }>(
      reader,
      `SELECT e.entry_id, e.word, p.revision_id,
              (SELECT count(*) FROM entry_definition d WHERE d.entry_id = e.entry_id) AS definitions,
              (SELECT count(*) FROM entry_label l WHERE l.entry_id = e.entry_id) AS labels,
              (SELECT count(*) FROM entry_example x WHERE x.entry_id = e.entry_id) AS examples,
              (SELECT count(*) FROM entry_fact f WHERE f.entry_id = e.entry_id) AS facts,
              ${plan.corrections.length === 0 ? "0" : "(SELECT count(*) FROM corrected_definition c WHERE c.entry_id = e.entry_id)"} AS corrections
         FROM recovered_entry e JOIN raw_page p ON p.page_id = e.page_id
        WHERE e.entry_id IN (SELECT value FROM json_each(${ids}))`,
    ).map((row) => [row.entry_id, row]),
  );
  return writes
    .filter(({ entry, entryId }) => {
      const row = held.get(entryId);
      const rows = pageEntryRows(entryId, plan.masterReleaseId, 0, entry);
      return (
        row === undefined ||
        row.word !== entry.page.title ||
        row.revision_id !== entry.page.revisionId ||
        row.definitions !== rows.entry_definition.length ||
        row.labels !== rows.entry_label.length ||
        row.examples !== rows.entry_example.length ||
        row.facts !== rows.entry_fact.length ||
        row.corrections !== plan.corrections.filter((correction) => correction.entryId === entryId).length
      );
    })
    .map(({ entry }) => entry.page.title);
}

/** One line per entry, for the run's report. */
export function describePlannedEntry(planned: PlannedEntry): string {
  const { title, revisionId } = planned.entry.page;
  const head = `  ${title} (revision ${revisionId}, line ${planned.entry.posRef.line}, ${planned.entry.pos}, ${planned.entry.definitions.length} definition(s))`;
  switch (planned.state) {
    case "write":
      return `${head}: entry ${planned.entryId}, written`;
    case "already":
      return `${head}: entry ${planned.entryId}, already written`;
    case "spelled-by-a-record":
      return `${head}: not written; a record spells the title`;
  }
}
