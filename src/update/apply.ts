// Apply selected changes to the master (#18), from automatic selection or ids.
//
// The whole apply is one SQL file, run as one transaction: `wrangler d1
// execute --file` runs a file atomically, locally (one D1 batch) and remotely
// (D1's import, which leaves the database as it was if any statement fails).
// So a lookup never sees part of an apply, and an apply that stops leaves the
// master as it was. What the file does:
//
// - writes each chosen record through `writeRecord`, the seed's own import
//   path with its source text normalizations (ADR 0019), as a new record of
//   the later release, its line stored byte for byte;
// - retires the record a `changed` change replaces: its lookup_form and
//   form_of_edge rows go, so no search reaches it, and nothing else of it is
//   touched, the rows written by hand beside it least of all: its curated
//   corrections stay, no lookup reads them (`correctedEdgeServed`,
//   src/lookup/correctedEdge.ts), and the update reports them. A hidden
//   recovered definition (#773) stays hidden: the definition stays beside
//   the retired record and is read for the one that replaced it
//   (src/lookup/recovered.ts), and so is its hide;
// - recomputes the `accent_fold` and `typo_key` rows of every key those
//   records spell, with the seed's own rules, writing only rows that change;
// - records the later release ('partial', with its checksum), the master it
//   feeds, and each change under its id.
//
// It never deletes a record, never touches a table written by hand beside the
// records (raw_page, recovered_*, claim_review, corrected_claim, corrected_form, corrected_edge,
// hidden_recovered_definition), and never applies a lost
// word: removing a record is not ruled.
//
// The file holds no DDL and changes no schema (#509): it writes into the
// tables `update:upgrade` creates (src/update/masterUpgrade.ts), and the
// commands that run it refuse to write while those are missing
// (`missingForApply`). The dictionary deploy runs the upgrade first.

import { IT_NORMALIZER_VERSION } from "../italian/normalize.js";
import {
  IMPORTER_VERSION,
  SCHEMA_VERSION,
  italianRecordOf,
  writeRecord,
  type ArchiveRecord,
  type ImportStatement,
  type ImportStatements,
} from "../import/importRelease.js";
import {
  COLUMNS,
  accentFoldRowOf,
  addLemmaRecord,
  addPageEntryScore,
  literal,
  tupleOf,
  typoKeyRowsOf,
  type AccentFoldRow,
  type LemmaScore,
  type TableName,
  type TypoKeyRow,
} from "../import/seedSql.js";
import { ARCHIVE_FACTS, archiveFactsFor, type ArchiveFactsCatalog } from "../source/archiveFacts.js";
import { deletionKeys, foldKey } from "../lookup/nearby.js";
import { changeIdOf, type Change, type ChangeId } from "./changes.js";
import type { MasterDiff } from "./diff.js";
import { feedLines } from "./feed.js";
import { readLines, select, upgradeNeededFor, type MasterReader } from "./master.js";
import { verifyFeedOrdering } from "./ordering.js";
import { SERVING_VIEWS, UPDATE_TABLES } from "./masterUpgrade.js";
import { PlanCounts } from "./planCounts.js";

/** The licence a kaikki release is published under, as the seed records it (src/import/seedDev.ts). */
const LICENSE = "CC-BY-SA-4.0";

/** The tables an apply writes rows of the later release to, in foreign-key order. */
export const APPLIED_TABLES = [
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
] as const satisfies readonly TableName[];

type AppliedTable = (typeof APPLIED_TABLES)[number];

/** A change that can be applied: lost words are reported, never applied. */
export type ApplicableChange = Exclude<Change, { kind: "lost" }>;

/** Why an apply wrote nothing: every reason found, so one run names them all. */
export class ApplyRefused extends Error {
  constructor(readonly reasons: readonly string[]) {
    super(`nothing was applied:\n${reasons.map((reason) => `- ${reason}`).join("\n")}`);
    this.name = "ApplyRefused";
  }
}

/** One chosen change and the record id it writes. */
export interface PlannedChange {
  change: ApplicableChange;
  recordId: number;
}

/** The apply, ready to run: its SQL and what that SQL writes. */
export interface ApplyPlan {
  masterReleaseId: string;
  feedReleaseId: string;
  changes: PlannedChange[];
  /** Records a `changed` change retires. */
  retired: number[];
  /**
   * The curated corrections (#420) on records this apply retires. They stay on
   * the retired record, and the record that replaces it does not take them:
   * the newer source may state the fact differently, so each is reported.
   */
  retiredCorrections: RetiredCorrection[];
  /** Rows written under the later release, by table. */
  rows: Record<AppliedTable, number>;
  /** `accent_fold` and `typo_key` rows of other releases the apply replaces. */
  replacedIndexRows: number;
  /** What the SQL writes and deletes: a `changed` change changes the record it retires. */
  counts: PlanCounts;
  sql: string;
}

/** A curated correction left on a record a change retires. */
export interface RetiredCorrection {
  correctionId: string;
  recordId: number;
  /** The record the change writes in its place, which the correction does not reach. */
  replacedBy: number;
  changeId: ChangeId;
}

/** The changes `texts` name, or every reason they cannot be applied. */
export function chooseChanges(found: MasterDiff, texts: readonly string[]): ApplicableChange[] {
  const reasons: string[] = [];
  const byId = new Map(found.diff.changes.map((change) => [change.id as string, change]));
  const chosen = new Map<ChangeId, ApplicableChange>();
  for (const text of texts) {
    const id = changeIdOf(text);
    const change = id === undefined ? undefined : byId.get(id);
    if (id === undefined) reasons.push(`${JSON.stringify(text)} is not a change id (new-, chg- or lost- and twelve hex digits)`);
    else if (change === undefined) reasons.push(`${id} is not a change this diff finds: the master or the file differs from the report's`);
    else if (change.kind === "lost") reasons.push(`${id} is a lost word: a lost word is reported, never removed (#18)`);
    else chosen.set(id, change);
  }
  if (texts.length === 0) reasons.push("no change id was given");
  if (reasons.length > 0) throw new ApplyRefused(reasons);
  return [...chosen.values()].sort((a, b) => a.feed.lineNo - b.feed.lineNo);
}

const json = (values: readonly unknown[]): string => literal(JSON.stringify(values));

/**
 * The most bytes one INSERT holds, the seed's own bound (src/import/seedSql.ts):
 * D1 refuses a statement over 100 KB with SQLITE_TOOBIG, locally and remotely.
 * A record's stored line can be tens of kilobytes, so a count of rows is no bound.
 */
const MAX_STATEMENT_BYTES = 64 * 1024;

/** `tuples` of one table as INSERT statements of at most `MAX_STATEMENT_BYTES` each; a tuple bigger than that stands alone. */
export function boundedInserts(table: TableName, tuples: readonly string[]): string[] {
  const head = `INSERT INTO ${table} (${COLUMNS[table]}) VALUES\n  `;
  const statements: string[] = [];
  let batch: string[] = [];
  let bytes = Buffer.byteLength(head);
  for (const tuple of tuples) {
    const size = Buffer.byteLength(tuple) + 4;
    if (batch.length > 0 && bytes + size > MAX_STATEMENT_BYTES) {
      statements.push(`${head}${batch.join(",\n  ")};`);
      batch = [];
      bytes = Buffer.byteLength(head);
    }
    batch.push(tuple);
    bytes += size;
  }
  if (batch.length > 0) statements.push(`${head}${batch.join(",\n  ")};`);
  return statements;
}

/**
 * `values` in runs whose bytes, as `sizeOf` counts them, stay at most
 * `maxBytes`: for statements that name every value of a run and must stay
 * under D1's 100 KB statement limit. A value bigger than that stands alone.
 */
function inRuns<Value>(
  values: readonly Value[],
  maxBytes = 32 * 1024,
  sizeOf: (value: Value) => number = (value) => Buffer.byteLength(JSON.stringify(value)) + 1,
): Value[][] {
  const runs: Value[][] = [];
  let run: Value[] = [];
  let bytes = 2;
  for (const value of values) {
    const size = sizeOf(value);
    if (run.length > 0 && bytes + size > maxBytes) {
      runs.push(run);
      run = [];
      bytes = 2;
    }
    run.push(value);
    bytes += size;
  }
  if (run.length > 0) runs.push(run);
  return runs;
}

class Inserts {
  private readonly tuples = new Map<TableName, string[]>();

  statement(table: TableName): ImportStatement {
    return {
      run: (...values: unknown[]) => {
        this.tuples.set(table, [...(this.tuples.get(table) ?? []), tupleOf(table, values)]);
      },
    };
  }

  count(table: TableName): number {
    return this.tuples.get(table)?.length ?? 0;
  }

  sql(table: TableName): string[] {
    return boundedInserts(table, this.tuples.get(table) ?? []);
  }
}

/** A row of `lookup_form` as the nearby indexes need it. */
export interface KeyRow {
  recordId: number;
  key: string;
  headword: boolean;
}

/** What the upgrade creates for an apply: the tables it records changes in, and the views that serve them. */
const APPLY_UPGRADE: readonly string[] = [...UPDATE_TABLES, ...SERVING_VIEWS];

/** The upgrade names an apply needs that the master lacks: run `update:upgrade` before the apply's SQL while any is listed. */
export const missingForApply = (reader: MasterReader): string[] => upgradeNeededFor(reader, APPLY_UPGRADE);

/**
 * Plan the apply of `chosen` to the master `found` was read from. It reads the
 * master again for the index rows the change touches; it writes nothing. A
 * master the upgrade has not reached plans the same, read as one with no feed
 * yet (`readMaster`); its SQL needs `missingForApply` empty to run.
 */
export async function planApply(
  reader: MasterReader,
  found: MasterDiff,
  chosen: readonly ApplicableChange[],
  { appliedAt, catalog = ARCHIVE_FACTS }: { appliedAt: string; catalog?: ArchiveFactsCatalog },
): Promise<ApplyPlan> {
  verifyFeedOrdering(found, catalog);
  const { master, feed } = found;
  const reasons: string[] = [];
  if (chosen.length === 0) reasons.push("no changes selected");
  if (new Set(chosen.map((change) => change.id)).size !== chosen.length) reasons.push("duplicate changes selected");
  for (const change of chosen) {
    if (!found.diff.changes.includes(change)) reasons.push(`${change.id} is not a change in the current diff`);
  }
  if (master.normalizer !== IT_NORMALIZER_VERSION) {
    reasons.push(`the master was built with normalizer ${master.normalizer}, this build has ${IT_NORMALIZER_VERSION}: their keys do not compare`);
  }
  if (feed.releaseId === master.releaseId) reasons.push(`${feed.path} is the master's own release, ${master.releaseId}`);
  const known = select<{ archive_sha256: string; status: string }>(
    reader,
    `SELECT archive_sha256, status FROM source_release WHERE release_id = ${literal(feed.releaseId)}`,
  );
  const isFeed = master.feeds.some((release) => release.releaseId === feed.releaseId);
  if (known.length > 0 && !isFeed) {
    reasons.push(`the database already holds release ${feed.releaseId} (${known[0].status}), and not as a feed of ${master.releaseId}`);
  }
  if (known.length > 0 && known[0].archive_sha256 !== feed.archiveSha256) {
    reasons.push(`release ${feed.releaseId} in the database has SHA-256 ${known[0].archive_sha256}, the file has ${feed.archiveSha256}`);
  }
  if (reasons.length > 0) throw new ApplyRefused(reasons);

  const records = await feedLines(feed, new Set(chosen.map((change) => change.feed.lineNo)));
  const served = [master.releaseId, ...master.feeds.map((release) => release.releaseId)];
  const inserts = new Inserts();
  const rows: Record<string, number> = Object.fromEntries(APPLIED_TABLES.map((table) => [table, 0]));
  const newKeys: KeyRow[] = [];
  const newLemmas: ArchiveRecord["record"][] = [];
  const planned: PlannedChange[] = [];

  const statements: ImportStatements = {
    insertRelease: { run: () => undefined },
    finishRelease: { run: () => undefined },
    insertTableRows: { run: () => undefined },
    insertRecord: inserts.statement("source_record"),
    insertJson: inserts.statement("source_record_json"),
    insertLookup: { run: () => undefined },
    insertEdge: inserts.statement("form_of_edge"),
    insertSense: inserts.statement("sense"),
    insertGloss: inserts.statement("sense_gloss"),
    insertLabel: inserts.statement("sense_label"),
    insertClaim: inserts.statement("grammar_claim"),
  };
  const lookupRow = inserts.statement("lookup_form");
  let recordId = master.maxRecordId;
  for (const change of chosen) {
    const archiveRecord = records.get(change.feed.lineNo);
    if (archiveRecord === undefined) throw new Error(`no record read at line ${change.feed.lineNo} for ${change.id}`);
    recordId += 1;
    const id = recordId;
    statements.insertLookup = {
      run: (...values: unknown[]) => {
        newKeys.push({ recordId: id, key: values[4] as string, headword: values[2] === "headword" });
        lookupRow.run(...values);
      },
    };
    // The seed's own path: the same rows, pointers and normalizations a seed of
    // the later release would write for this line. Its leaf refusals are the
    // seed's too, and an apply writes the record the seed would.
    writeRecord(statements, rows, {
      recordId: id,
      releaseId: feed.releaseId,
      lineNo: archiveRecord.lineNo,
      line: archiveRecord.line,
      record: archiveRecord.record,
      word: archiveRecord.record.word,
      pos: archiveRecord.record.pos,
      posTitle: archiveRecord.record.pos_title,
      reportMember: () => {},
      // A feed is read without its raw pages, so the section-language rule
      // cannot judge it (ADR 0023).
      hidden: false,
    });
    newLemmas.push(archiveRecord.record);
    planned.push({ change, recordId: id });
  }
  const retired = chosen.flatMap((change) => (change.kind === "changed" ? [change.master.recordId] : []));
  const retiredCorrections = correctionsOn(reader, planned);

  // The keys whose nearby rows can move: every key a written or a retired record spells.
  const retiredKeys = retired.length === 0
    ? []
    : select<{ record_id: number; surface_key: string; origin: string }>(
        reader,
        `SELECT record_id, surface_key, origin FROM lookup_form WHERE record_id IN (SELECT value FROM json_each(${json(retired)}))`,
      );
  const keys = [...new Set([...newKeys.map((row) => row.key), ...retiredKeys.map((row) => row.surface_key)])].sort();
  const nearby = keys.length === 0 ? NO_NEARBY_EDITS : nearbyEdits(reader, served, keys, new Set(retired), newKeys, newLemmas);
  const [{ n: retiredEdges }] = retired.length === 0
    ? [{ n: 0 }]
    : select<{ n: number }>(reader, `SELECT count(*) AS n FROM form_of_edge WHERE record_id IN (SELECT value FROM json_each(${json(retired)}))`);

  const writtenAccent = nearby.accent.length;
  const writtenTypo = nearby.typo.length;
  const counts = {
    source_record: inserts.count("source_record"),
    source_record_json: inserts.count("source_record_json"),
    lookup_form: inserts.count("lookup_form"),
    form_of_edge: inserts.count("form_of_edge"),
    sense: inserts.count("sense"),
    sense_gloss: inserts.count("sense_gloss"),
    sense_label: inserts.count("sense_label"),
    grammar_claim: inserts.count("grammar_claim"),
    accent_fold: writtenAccent,
    typo_key: writtenTypo,
  } satisfies Record<AppliedTable, number>;

  const facts = archiveFactsFor(feed.archiveSha256, catalog);
  const sql: string[] = [
    `-- Generated by src/update/apply.ts: ${chosen.length} change(s) from ${feed.releaseId} applied to ${master.releaseId}.`,
    `-- ${chosen.map((change) => change.id).join(" ")}`,
  ];
  if (known.length === 0) {
    sql.push(
      `INSERT INTO source_release (release_id,source_name,source_url,retrieved_at,upstream_release,upstream_release_basis,archive_r2_key,archive_sha256,archive_bytes,normalizer,importer_version,schema_version,license,attribution,status,lines_read,admitted,skipped_other_language,malformed_lines,malformed_members)\nVALUES (${[
        feed.releaseId,
        "kaikki-it-wiktextract",
        facts?.sourceUrl ?? null,
        facts?.retrievedAt ?? null,
        facts?.dump.id ?? null,
        facts?.dump.basis ?? null,
        `releases/${feed.releaseId}.jsonl.gz`,
        feed.archiveSha256,
        feed.archiveBytes,
        IT_NORMALIZER_VERSION,
        IMPORTER_VERSION,
        SCHEMA_VERSION,
        LICENSE,
        null,
        "partial",
        feed.linesRead,
        feed.admitted,
        feed.skippedOtherLanguage,
        feed.malformed,
        feed.malformedMembers,
      ].map(literal).join(",")});`,
      `INSERT INTO feed_release (release_id, master_release_id) VALUES (${literal(feed.releaseId)}, ${literal(master.releaseId)});`,
    );
  }
  if (retired.length > 0) {
    sql.push(
      `DELETE FROM lookup_form WHERE record_id IN (${retired.join(",")});`,
      `DELETE FROM form_of_edge WHERE record_id IN (${retired.join(",")});`,
    );
  }
  for (const table of APPLIED_TABLES.slice(0, -2)) sql.push(...inserts.sql(table));
  const appliedTuples = planned.map(({ change, recordId: id }) =>
    `(${[change.id, feed.releaseId, change.kind, id, change.kind === "changed" ? change.master.recordId : null, appliedAt].map(literal).join(",")})`,
  );
  for (const run of inRuns(appliedTuples)) {
    sql.push(`INSERT INTO applied_change (change_id, release_id, kind, record_id, replaced_record_id, applied_at) VALUES\n  ${run.join(",\n  ")};`);
  }
  sql.push(...nearby.deletes);
  const accentRows = nearby.accent.map((row) => [feed.releaseId, row.foldKey, row.surfaceKey, row.headword, row.languages, row.richness]);
  const typoRows = nearby.typo.map((row) => [feed.releaseId, row.deletionKey, row.surfaceKey, row.languages, row.richness]);
  for (const [table, tuples] of [["accent_fold", accentRows], ["typo_key", typoRows]] as const) {
    sql.push(...boundedInserts(table, tuples.map((values) => tupleOf(table, values))));
  }
  sql.push(
    `INSERT INTO release_table_rows (release_id, table_name, rows) VALUES\n  ${APPLIED_TABLES.map(
      (table) => `(${literal(feed.releaseId)},${literal(table)},${counts[table]})`,
    ).join(",\n  ")}\n  ON CONFLICT (release_id, table_name) DO UPDATE SET rows = rows + excluded.rows;`,
  );
  return {
    masterReleaseId: master.releaseId,
    feedReleaseId: feed.releaseId,
    changes: planned,
    retired,
    retiredCorrections,
    rows: counts,
    replacedIndexRows: nearby.replaced.accent_fold + nearby.replaced.typo_key,
    counts: new PlanCounts(
      { added: chosen.filter((change) => change.kind === "new").length, changed: retired.length, removed: 0 },
      {
        ...counts,
        ...(known.length === 0 ? { source_release: 1, feed_release: 1 } : {}),
        applied_change: appliedTuples.length,
        release_table_rows: APPLIED_TABLES.length,
      },
      { lookup_form: retiredKeys.length, form_of_edge: retiredEdges, ...nearby.replaced },
    ),
    sql: `${sql.join("\n")}\n`,
  };
}

/** The nearby index rows that differ from what the seed would write: the deletes, the rows wanted, and the rows deleted by table. */
export interface NearbyEdits {
  deletes: string[];
  accent: AccentFoldRow[];
  typo: TypoKeyRow[];
  replaced: { accent_fold: number; typo_key: number };
}

/** Nothing to recompute: no key moved. */
export const NO_NEARBY_EDITS: NearbyEdits = { deletes: [], accent: [], typo: [], replaced: { accent_fold: 0, typo_key: 0 } };

/** Which of the tables a record's curated corrections are written to the master has: `corrected_claim` (#420), `corrected_edge` (#722), `corrected_form` (#723). */
const correctionTablesIn = (reader: MasterReader): string[] =>
  select<{ name: string }>(reader, "SELECT name FROM sqlite_schema WHERE type = 'table' AND name IN ('corrected_claim', 'corrected_edge', 'corrected_form') ORDER BY name").map((row) => row.name);

/** The curated corrections on the records `planned` changes retire, read where the master holds them. */
function correctionsOn(reader: MasterReader, planned: readonly PlannedChange[]): RetiredCorrection[] {
  const replacing = new Map(
    planned.flatMap(({ change, recordId }) => (change.kind === "changed" ? [[change.master.recordId, { recordId, changeId: change.id }] as const] : [])),
  );
  if (replacing.size === 0) return [];
  // A master seeded before #420, #722 or #723 holds none of that kind until `correct:records` writes some.
  const tables = correctionTablesIn(reader);
  if (tables.length === 0) return [];
  return select<{ record_id: number; correction_id: string }>(
    reader,
    `SELECT record_id, correction_id FROM (${tables
      .map((table) => `SELECT record_id, correction_id FROM ${table} WHERE record_id IN (SELECT value FROM json_each(${json([...replacing.keys()])}))`)
      .join(" UNION ")}) ORDER BY record_id, correction_id`,
  ).map((row) => {
    const by = replacing.get(row.record_id) as { recordId: number; changeId: ChangeId };
    return { correctionId: row.correction_id, recordId: row.record_id, replacedBy: by.recordId, changeId: by.changeId };
  });
}

const sameAccent = (a: AccentFoldRow, b: AccentFoldRow): boolean =>
  a.foldKey === b.foldKey && a.surfaceKey === b.surfaceKey && a.headword === b.headword && a.languages === b.languages && a.richness === b.richness;

const sameTypo = (a: TypoKeyRow, b: TypoKeyRow): boolean =>
  a.deletionKey === b.deletionKey && a.surfaceKey === b.surfaceKey && a.languages === b.languages && a.richness === b.richness;

/**
 * The `accent_fold` and `typo_key` rows of `keys` as the seed would write them
 * for the master after the apply, against the rows the master holds now: the
 * rows that differ are deleted, whatever release wrote them, and the rows
 * wanted are returned for the caller to write: an apply writes them under the
 * later release. A row already right is left in its own release. Hiding
 * records (src/import/hideRecords.ts) reads it too, with the hidden records as
 * `retired` and nothing new, and writes them under the master's release.
 * `pages` are the definitions of the page-only entries (ADR 0024) heading
 * each key: a page-only entry heads its key and adds its definitions to the
 * key's rank, as the seed counts it. The load of page-only entries
 * (src/import/loadPageEntries.ts) passes them.
 */
export function nearbyEdits(
  reader: MasterReader,
  served: readonly string[],
  keys: readonly string[],
  retired: ReadonlySet<number>,
  newKeys: readonly KeyRow[],
  newLemmas: readonly ArchiveRecord["record"][],
  pages: ReadonlyMap<string, number> = new Map(),
): NearbyEdits {
  const inServed = `IN (SELECT value FROM json_each(${json(served)}))`;
  // The reads name every key, so they run over a few hundred keys at a time:
  // one statement naming them all would pass D1's 100 KB limit.
  const runs = inRuns(keys, 16 * 1024);
  const inKeys = (run: readonly string[]): string => `IN (SELECT value FROM json_each(${json(run)}))`;

  // After the apply: every row spelling a key, but a retired record's, and the new ones.
  const kept: KeyRow[] = runs
    .flatMap((run) =>
      select<{ record_id: number; surface_key: string; origin: string }>(
        reader,
        `SELECT record_id, surface_key, origin FROM lookup_form WHERE release_id ${inServed} AND surface_key ${inKeys(run)}`,
      ),
    )
    .filter((row) => !retired.has(row.record_id))
    .map((row) => ({ recordId: row.record_id, key: row.surface_key, headword: row.origin === "headword" }));
  const headed = new Map<string, boolean>();
  for (const row of [...kept, ...newKeys]) headed.set(row.key, headed.get(row.key) === true || row.headword);

  // The lemma records heading each key, read the way the seed reads them.
  const scores = new Map<string, LemmaScore>();
  const heads = [...new Set(kept.filter((row) => row.headword).map((row) => row.recordId))];
  for (const line of readLines(reader, heads).values()) {
    const record = italianRecordOf(line);
    if (record === undefined) throw new Error(`a stored line is not one the import admits: ${line.slice(0, 80)}`);
    addLemmaRecord(scores, record);
  }
  for (const record of newLemmas) addLemmaRecord(scores, record);
  // Page-only entries (ADR 0024, ADR 0028) head their word's key, ranked by
  // their definitions beside any lemma record, as the seed ranks them. The
  // caller's `pages` count every entry of a key they name, held or about to be
  // written; any other key takes the served entries the master holds, so a
  // hide or an apply keeps their search rows (#501).
  const pageDefinitions = new Map(pages);
  for (const entry of pageEntriesOf(reader, inServed, runs.map(inKeys))) {
    if (!pages.has(entry.word_key)) pageDefinitions.set(entry.word_key, (pageDefinitions.get(entry.word_key) ?? 0) + entry.definitions);
  }
  for (const [key, definitions] of pageDefinitions) {
    headed.set(key, true);
    addPageEntryScore(scores, key, definitions);
  }
  const wantedKeys = new Set(keys);

  const accent = keys.flatMap((key) => {
    const headword = headed.get(key);
    const row = headword === undefined ? undefined : accentFoldRowOf(key, headword, scores.get(key));
    return row === undefined ? [] : [row];
  });
  const typo = keys.flatMap((key) => {
    const score = scores.get(key);
    return score === undefined ? [] : typoKeyRowsOf(key, score);
  });

  const heldAccent = runs
    .flatMap((run) =>
      select<{ release_id: string; fold_key: string; surface_key: string; headword: 0 | 1; languages: number; richness: number }>(
        reader,
        `SELECT release_id, fold_key, surface_key, headword, languages, richness FROM accent_fold
          WHERE release_id ${inServed} AND fold_key IN (SELECT value FROM json_each(${json([...new Set(run.map(foldKey))])}))
            AND surface_key ${inKeys(run)}`,
      ),
    )
    .filter((row) => wantedKeys.has(row.surface_key));
  // A key has a deletion key per character, so these runs are counted in deletion keys.
  const heldTypo = inRuns(keys, 32 * 1024, (key) => Buffer.byteLength(JSON.stringify(deletionKeys(key))) + Buffer.byteLength(JSON.stringify(key))).flatMap((run) =>
    select<{ release_id: string; deletion_key: string; surface_key: string; languages: number; richness: number }>(
      reader,
      `SELECT release_id, deletion_key, surface_key, languages, richness FROM typo_key
        WHERE release_id ${inServed} AND deletion_key IN (SELECT value FROM json_each(${json([...new Set(run.flatMap(deletionKeys))])}))
          AND surface_key ${inKeys(run)}`,
    ),
  );

  const deletes: string[] = [];
  const keptAccent = heldAccent.filter((held) => {
    const row: AccentFoldRow = { foldKey: held.fold_key, surfaceKey: held.surface_key, headword: held.headword, languages: held.languages, richness: held.richness };
    if (accent.some((wanted) => sameAccent(wanted, row))) return true;
    deletes.push(
      `DELETE FROM accent_fold WHERE release_id = ${literal(held.release_id)} AND fold_key = ${literal(held.fold_key)} AND surface_key = ${literal(held.surface_key)};`,
    );
    return false;
  });
  const keptTypo = heldTypo.filter((held) => {
    const row: TypoKeyRow = { deletionKey: held.deletion_key, surfaceKey: held.surface_key, languages: held.languages, richness: held.richness };
    if (typo.some((wanted) => sameTypo(wanted, row))) return true;
    deletes.push(
      `DELETE FROM typo_key WHERE release_id = ${literal(held.release_id)} AND deletion_key = ${literal(held.deletion_key)} AND surface_key = ${literal(held.surface_key)};`,
    );
    return false;
  });
  return {
    deletes,
    accent: accent.filter((wanted) => !keptAccent.some((held) => sameAccent(wanted, { foldKey: held.fold_key, surfaceKey: held.surface_key, headword: held.headword, languages: held.languages, richness: held.richness }))),
    typo: typo.filter((wanted) => !keptTypo.some((held) => sameTypo(wanted, { deletionKey: held.deletion_key, surfaceKey: held.surface_key, languages: held.languages, richness: held.richness }))),
    replaced: { accent_fold: heldAccent.length - keptAccent.length, typo_key: heldTypo.length - keptTypo.length },
  };
}

/**
 * The served page-only entries whose word key is in one of `keyRuns`, with
 * their definition counts. None in a dictionary the upgrade has not given the
 * page-entry tables.
 */
function pageEntriesOf(reader: MasterReader, inServed: string, keyRuns: readonly string[]): { word_key: string; definitions: number }[] {
  const tables = select<{ name: string }>(reader, "SELECT name FROM sqlite_schema WHERE type = 'table' AND name IN ('recovered_entry', 'entry_definition')");
  if (tables.length < 2) return [];
  return keyRuns.flatMap((inKeys) =>
    select<{ entry_id: number; word_key: string; definitions: number }>(
      reader,
      `SELECT e.entry_id, e.word_key, (SELECT count(*) FROM entry_definition d WHERE d.entry_id = e.entry_id) AS definitions
         FROM recovered_entry e WHERE e.release_id ${inServed} AND e.word_key ${inKeys}`,
    ),
  );
}

/** What a read back of the master found after the apply ran, against the plan. */
export interface AppliedCheck {
  /** Change ids the master does not hold with the record id planned. */
  missing: ChangeId[];
  /** Tables whose rows for the new records differ from the plan's count. */
  differing: { table: string; planned: number; found: number }[];
}

/** Read the master back after the apply: every change recorded, and every record's rows there. */
export function checkApplied(reader: MasterReader, plan: ApplyPlan): AppliedCheck {
  const held = new Map(
    select<{ change_id: string; record_id: number }>(
      reader,
      `SELECT change_id, record_id FROM applied_change WHERE change_id IN (SELECT value FROM json_each(${json(plan.changes.map(({ change }) => change.id))}))`,
    ).map((row) => [row.change_id, row.record_id]),
  );
  const missing = plan.changes.filter(({ change, recordId }) => held.get(change.id) !== recordId).map(({ change }) => change.id);
  const ids = json(plan.changes.map(({ recordId }) => recordId));
  const byRecord = `IN (SELECT value FROM json_each(${ids}))`;
  const counted: Record<string, string> = {
    source_record: `SELECT count(*) AS n FROM source_record WHERE record_id ${byRecord}`,
    source_record_json: `SELECT count(*) AS n FROM source_record_json WHERE record_id ${byRecord}`,
    lookup_form: `SELECT count(*) AS n FROM lookup_form WHERE record_id ${byRecord}`,
    form_of_edge: `SELECT count(*) AS n FROM form_of_edge WHERE record_id ${byRecord}`,
    sense: `SELECT count(*) AS n FROM sense WHERE record_id ${byRecord}`,
    sense_gloss: `SELECT count(*) AS n FROM sense_gloss WHERE sense_id IN (SELECT sense_id FROM sense WHERE record_id ${byRecord})`,
    sense_label: `SELECT count(*) AS n FROM sense_label WHERE sense_id IN (SELECT sense_id FROM sense WHERE record_id ${byRecord})`,
    grammar_claim: `SELECT count(*) AS n FROM grammar_claim WHERE record_id ${byRecord}`,
  };
  const differing = Object.entries(counted).flatMap(([table, sql]) => {
    const [{ n }] = select<{ n: number }>(reader, sql);
    const planned = plan.rows[table as AppliedTable];
    return n === planned ? [] : [{ table, planned, found: n }];
  });
  return { missing, differing };
}
