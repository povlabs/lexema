// The one-off update that loads page-only entries (ADR 0024, #403) into a
// dictionary seeded before them (#440). It writes what a seed now writes for
// each entry and nothing else: the `raw_page` row of the revision it was read
// from, its `recovered_entry`, `entry_definition`, `entry_label` and
// `entry_example` rows (pageEntryRows.ts), the `corrected_definition` rows the
// curated list gives it (correctedDefinitions.ts), and the `accent_fold` and
// `typo_key` rows of its word's key. It creates the four tables, and
// `corrected_definition`, when the dictionary lacks them. No record is touched,
// `source_record_json` least of all, and no applied change or hide is undone.
//
// Which titles get an entry is the seed's rule, read off the dictionary as it
// stands: a word a served record points at with `form_of`, which no record of
// any release spells, whose page in the master's dump the rule reads as one
// Italian verb (`recoverPageEntry`). A title a record spells, hidden or
// replaced included, gets none, as in the seed.
//
// The SQL is one file, run as one transaction, like a hide
// (src/import/hideRecords.ts). An entry the dictionary already holds is left
// alone, so a second run plans nothing.

import { correctionId, definitionCorrections, definitionMismatch, type CuratedCorrection } from "../italian/curatedCorrections.js";
import { normalizeItalianExact } from "../italian/normalize.js";
import { PAGE_ENTRY_RULE, recoverPageEntry, type RecoveredEntry } from "../italian/pageEntry.js";
import { deletionKeys, foldKey } from "../lookup/nearby.js";
import { PAGE_ENTRY_TABLES } from "../lookup/served.js";
import type { RawPage } from "../source/rawPage.js";
import { missingUpgrade, readMasterRelease, select, type MasterReader } from "../update/master.js";
import { createStatement, PAGE_ENTRY_INDEXES } from "../update/masterUpgrade.js";
import { PlanCounts } from "../update/planCounts.js";
import { correctedDefinitionValues } from "./correctedDefinitions.js";
import { entryDefinitionsOf, pageEntryRows } from "./pageEntryRows.js";
import { accentFoldRowOf, COLUMNS, literal, tupleOf, typoKeyRowsOf, type AccentFoldRow, type TypoKeyRow } from "./seedSql.js";

/** The rules the load reads pages by; a declaration names them all. */
export const PAGE_ENTRY_RULES = [PAGE_ENTRY_RULE] as const;

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
const CHUNK = 200;

/** `tuples` as INSERTs into `table` of at most `CHUNK` rows each. */
function inserts(table: keyof typeof COLUMNS, tuples: readonly (readonly unknown[])[]): string[] {
  const statements: string[] = [];
  for (let start = 0; start < tuples.length; start += CHUNK) {
    statements.push(`INSERT INTO ${table} (${COLUMNS[table]}) VALUES\n  ${tuples.slice(start, start + CHUNK).map((values) => tupleOf(table, values)).join(",\n  ")};`);
  }
  return statements;
}

/** Which of `names` the dictionary has. */
const tablesIn = (reader: MasterReader, names: readonly string[]): Set<string> =>
  new Set(select<{ name: string }>(reader, `SELECT name FROM sqlite_schema WHERE type = 'table' AND name IN (SELECT value FROM json_each(${json(names)}))`).map((row) => row.name));

/**
 * The titles a page-only entry may be read for: each word a served record
 * points at with `form_of` that no record heading its key spells. Exact words,
 * as the seed reads them. A hidden record has no search row, so a title only
 * a hidden record spells is still listed here; `planPageEntries` drops it.
 */
export function danglingTitles(reader: MasterReader): Set<string> {
  // The load creates the page-entry tables itself; the served views it reads come from the upgrade.
  const own: readonly string[] = [...PAGE_ENTRY_TABLES, ...PAGE_ENTRY_INDEXES];
  const missing = missingUpgrade(reader).filter((name) => !own.includes(name));
  if (missing.length > 0) throw new Error(`the dictionary lacks ${missing.join(", ")}; run pnpm run update:upgrade first`);
  const master = readMasterRelease(reader);
  // Naming the releases lets the probe use lookup_form_headword_by_key, which leads with release_id.
  const served = `IN (SELECT value FROM json_each(${json([master.releaseId, ...master.feeds.map((feed) => feed.releaseId)])}))`;
  return new Set(
    select<{ word: string }>(
      reader,
      `SELECT DISTINCT e.target_word AS word FROM form_of_edge e
         JOIN served_record r ON r.record_id = e.record_id
        WHERE NOT EXISTS (
          SELECT 1 FROM lookup_form lf JOIN source_record t ON t.record_id = lf.record_id
           WHERE lf.release_id ${served} AND lf.surface_key = e.target_word_key AND lf.origin = 'headword' AND t.word = e.target_word)`,
    ).map((row) => row.word),
  );
}

/** The entries the rule reads off `pages` for `titles`, by title. Reads each page once and keeps nothing else. */
export async function findPageEntries(pages: AsyncIterable<RawPage> | Iterable<RawPage>, titles: ReadonlySet<string>): Promise<RecoveredEntry[]> {
  const found: RecoveredEntry[] = [];
  const nothing = new Set<string>();
  for await (const page of pages) {
    if (!titles.has(page.title)) continue;
    const result = recoverPageEntry(page, nothing);
    if (result.outcome === "recovered") found.push(result.entry);
  }
  return found.sort((a, b) => (a.page.title < b.page.title ? -1 : a.page.title > b.page.title ? 1 : 0));
}

const sameAccent = (a: AccentFoldRow, b: AccentFoldRow): boolean =>
  a.foldKey === b.foldKey && a.surfaceKey === b.surfaceKey && a.headword === b.headword && a.languages === b.languages && a.richness === b.richness;

const sameTypo = (a: TypoKeyRow, b: TypoKeyRow): boolean =>
  a.deletionKey === b.deletionKey && a.surfaceKey === b.surfaceKey && a.languages === b.languages && a.richness === b.richness;

interface NearbyRows {
  readonly deletes: string[];
  readonly accent: AccentFoldRow[];
  readonly typo: TypoKeyRow[];
  readonly replaced: { accent_fold: number; typo_key: number };
}

/**
 * The `accent_fold` and `typo_key` rows of the entries' keys as the seed
 * writes them: each key is headed, and ranked by the entry's definitions and
 * no translation. Rows held for a key that differ are deleted, whatever
 * release wrote them, and rows already right are kept.
 */
function nearbyRows(reader: MasterReader, served: readonly string[], entries: readonly RecoveredEntry[]): NearbyRows {
  const wanted = entries.map((entry) => {
    const key = normalizeItalianExact(entry.page.title);
    const score = { languages: new Set<string>(), richness: entry.definitions.length };
    const accent = accentFoldRowOf(key, true, score);
    return { key, accent: accent === undefined ? [] : [accent], typo: typoKeyRowsOf(key, score) };
  });
  const keys = wanted.map(({ key }) => key);
  const inServed = `release_id IN (SELECT value FROM json_each(${json(served)}))`;
  const heldAccent = select<{ release_id: string; fold_key: string; surface_key: string; headword: 0 | 1; languages: number; richness: number }>(
    reader,
    `SELECT release_id, fold_key, surface_key, headword, languages, richness FROM accent_fold
      WHERE ${inServed} AND fold_key IN (SELECT value FROM json_each(${json([...new Set(keys.map(foldKey))])}))
        AND surface_key IN (SELECT value FROM json_each(${json(keys)}))`,
  );
  const heldTypo = select<{ release_id: string; deletion_key: string; surface_key: string; languages: number; richness: number }>(
    reader,
    `SELECT release_id, deletion_key, surface_key, languages, richness FROM typo_key
      WHERE ${inServed} AND deletion_key IN (SELECT value FROM json_each(${json([...new Set(keys.flatMap(deletionKeys))])}))
        AND surface_key IN (SELECT value FROM json_each(${json(keys)}))`,
  );
  const accent = wanted.flatMap((row) => row.accent);
  const typo = wanted.flatMap((row) => row.typo);
  const deletes: string[] = [];
  const keptAccent: AccentFoldRow[] = [];
  for (const held of heldAccent) {
    const row: AccentFoldRow = { foldKey: held.fold_key, surfaceKey: held.surface_key, headword: held.headword, languages: held.languages, richness: held.richness };
    if (accent.some((want) => sameAccent(want, row))) keptAccent.push(row);
    else deletes.push(`DELETE FROM accent_fold WHERE release_id = ${literal(held.release_id)} AND fold_key = ${literal(held.fold_key)} AND surface_key = ${literal(held.surface_key)};`);
  }
  const keptTypo: TypoKeyRow[] = [];
  for (const held of heldTypo) {
    const row: TypoKeyRow = { deletionKey: held.deletion_key, surfaceKey: held.surface_key, languages: held.languages, richness: held.richness };
    if (typo.some((want) => sameTypo(want, row))) keptTypo.push(row);
    else deletes.push(`DELETE FROM typo_key WHERE release_id = ${literal(held.release_id)} AND deletion_key = ${literal(held.deletion_key)} AND surface_key = ${literal(held.surface_key)};`);
  }
  return {
    deletes,
    accent: accent.filter((want) => !keptAccent.some((held) => sameAccent(want, held))),
    typo: typo.filter((want) => !keptTypo.some((held) => sameTypo(want, held))),
    replaced: { accent_fold: heldAccent.length - keptAccent.length, typo_key: heldTypo.length - keptTypo.length },
  };
}

/**
 * Plan loading `found`, the entries the rule read off the master's dump for
 * the dictionary's dangling titles. It reads the dictionary; it writes
 * nothing. `schema` is src/db/schema.sql, whose tables an older dictionary
 * gets. Throws when the dictionary holds some page-entry tables but not all,
 * or holds a title's page or entry from another revision than the one read.
 */
export function planPageEntries(reader: MasterReader, found: readonly RecoveredEntry[], schema: string, corrections: readonly CuratedCorrection[]): PageEntryPlan {
  const master = readMasterRelease(reader);
  const release = literal(master.releaseId);
  const tables = tablesIn(reader, [...PAGE_ENTRY_TABLES, "corrected_definition"]);
  const pageTables = PAGE_ENTRY_TABLES.filter((name) => tables.has(name));
  if (pageTables.length > 0 && pageTables.length < PAGE_ENTRY_TABLES.length) {
    throw new Error(`the dictionary has ${pageTables.join(", ")} but not every page-entry table (${PAGE_ENTRY_TABLES.join(", ")})`);
  }
  const hasEntries = pageTables.length === PAGE_ENTRY_TABLES.length;
  const titles = found.map((entry) => entry.page.title);
  const nothing: PageEntryPlan = { masterReleaseId: master.releaseId, entries: [], corrections: [], sql: "", counts: PlanCounts.NONE };
  if (titles.length === 0) return nothing;

  const inTitles = `IN (SELECT value FROM json_each(${json(titles)}))`;
  const spelled = new Set(select<{ word: string }>(reader, `SELECT DISTINCT word FROM source_record WHERE word ${inTitles}`).map((row) => row.word));
  const heldEntries = new Map(
    hasEntries
      ? select<{ entry_id: number; word: string; revision_id: number }>(
          reader,
          `SELECT e.entry_id, e.word, p.revision_id FROM recovered_entry e JOIN raw_page p ON p.page_id = e.page_id
            WHERE e.release_id = ${release} AND e.word ${inTitles}`,
        ).map((row) => [row.word, row])
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
    const held = heldEntries.get(title);
    if (held !== undefined) {
      if (held.revision_id !== revisionId) throw new Error(`the dictionary holds an entry of ${title} read from revision ${held.revision_id}, the rule read revision ${revisionId}`);
      return { state: "already", entry, entryId: held.entry_id };
    }
    const pageId = heldPage?.page_id ?? nextPage++;
    if (heldPage === undefined) newPages.push([pageId, master.releaseId, entry.page.wiki, title, revisionId, entry.page.timestamp]);
    return { state: "write", entry, entryId: nextEntry++, pageId };
  });
  const writes = entries.flatMap((planned) => (planned.state === "write" ? [planned] : []));
  if (writes.length === 0) return { ...nothing, entries };

  const rows = writes.map(({ entry, entryId, pageId }) => pageEntryRows(entryId, master.releaseId, pageId, entry));
  const definitionList = definitionCorrections(corrections);
  const correctionRows = writes.flatMap(({ entry, entryId }) =>
    definitionList
      .filter((correction) => correction.entry.title === entry.page.title && definitionMismatch(correction, entryDefinitionsOf(entry)) === undefined)
      .map((correction) => ({ id: correctionId(correction), entryId, title: entry.page.title, values: [entryId, correction.replaces.index, ...correctedDefinitionValues(correction)] })),
  );
  const nearby = nearbyRows(reader, [master.releaseId, ...master.feeds.map((feed) => feed.releaseId)], writes.map(({ entry }) => entry));
  const ifAbsent = (kind: "TABLE" | "INDEX", name: string): string => createStatement(schema, kind, name).replace(`CREATE ${kind} `, `CREATE ${kind} IF NOT EXISTS `);
  const all = <Table extends "entry_definition" | "entry_label" | "entry_example">(table: Table) => rows.flatMap((entry) => entry[table]);

  const sql = [
    `-- Generated by src/import/loadPageEntries.ts: ${writes.length} page-only entr${writes.length === 1 ? "y" : "ies"} of ${master.releaseId} by ${PAGE_ENTRY_RULE}: ${writes.map(({ entry }) => entry.page.title).join(", ")}.`,
    ...(hasEntries ? [] : [...PAGE_ENTRY_TABLES.map((name) => ifAbsent("TABLE", name)), ...PAGE_ENTRY_INDEXES.map((name) => ifAbsent("INDEX", name))]),
    ...(correctionRows.length === 0 || tables.has("corrected_definition") ? [] : [ifAbsent("TABLE", "corrected_definition")]),
    ...inserts("raw_page", newPages),
    ...inserts("recovered_entry", rows.map((entry) => entry.recovered_entry)),
    ...inserts("entry_definition", all("entry_definition")),
    ...inserts("entry_label", all("entry_label")),
    ...inserts("entry_example", all("entry_example")),
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
    select<{ entry_id: number; word: string; revision_id: number; definitions: number; labels: number; examples: number; corrections: number }>(
      reader,
      `SELECT e.entry_id, e.word, p.revision_id,
              (SELECT count(*) FROM entry_definition d WHERE d.entry_id = e.entry_id) AS definitions,
              (SELECT count(*) FROM entry_label l WHERE l.entry_id = e.entry_id) AS labels,
              (SELECT count(*) FROM entry_example x WHERE x.entry_id = e.entry_id) AS examples,
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
        row.corrections !== plan.corrections.filter((correction) => correction.entryId === entryId).length
      );
    })
    .map(({ entry }) => entry.page.title);
}

/** One line per entry, for the run's report. */
export function describePlannedEntry(planned: PlannedEntry): string {
  const { title, revisionId } = planned.entry.page;
  const head = `  ${title} (revision ${revisionId}, ${planned.entry.definitions.length} definition(s))`;
  switch (planned.state) {
    case "write":
      return `${head}: entry ${planned.entryId}, written`;
    case "already":
      return `${head}: entry ${planned.entryId}, already written`;
    case "spelled-by-a-record":
      return `${head}: not written; a record spells the title`;
  }
}
