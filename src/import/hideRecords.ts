// The one-off update for a dictionary seeded before the hiding rules hid
// records (#382, #389, ADR 0023). It brings the master to what a seed now
// writes for the records the rules find in another language: each gets its
// `hidden_record` row, naming the rule and its evidence, and loses its
// `lookup_form` and `form_of_edge` rows; the `accent_fold` and `typo_key` rows
// of the keys they spelled are recomputed with the seed's rules. Nothing else
// of the record is touched, `source_record_json` least of all: a corrected
// edge on it stays, and no lookup reads it (`correctedEdgeServed`,
// src/lookup/correctedEdge.ts).
//
// The SQL is one file, run as one transaction, like an apply
// (src/update/apply.ts). A record already hidden is left alone, so a second
// run plans nothing. It holds no DDL (#509): `update:upgrade` creates
// `hidden_record` and `hide_version`, and rebuilds a `hidden_record` written
// before `form-of-foreign-lemma/v1`, which cannot hold that rule's rows
// (src/update/masterUpgrade.ts). The command refuses to write until it has
// (`missingForHide`).

import { readMasterRelease, select, upgradeNeededFor, type MasterReader } from "../update/master.js";
import { HIDE_TABLES } from "../update/masterUpgrade.js";
import { NO_NEARBY_EDITS, nearbyEdits } from "../update/apply.js";
import { PlanCounts } from "../update/planCounts.js";
import { SECTION_LANGUAGE_RULE } from "../italian/sectionLanguage.js";
import { COLUMNS, literal, tupleOf } from "./seedSql.js";
import { type FoundRecord, hiddenRowValues } from "./hiddenLayer.js";

/** One record the update hides. */
export interface PlannedHide {
  recordId: number;
  found: FoundRecord;
}

/** The update, ready to run, or nothing to do. */
export interface HidePlan {
  masterReleaseId: string;
  /** Records this run hides, in archive order. */
  hides: PlannedHide[];
  /** Records the rules find that the master already hides. */
  alreadyHidden: number;
  /** Rows this run deletes from the hidden records. */
  removed: { lookup_form: number; form_of_edge: number };
  /** `accent_fold` and `typo_key` rows deleted because the keys they rank lost a record. */
  replacedIndexRows: number;
  /** What the SQL writes and deletes: each hide is a removal. */
  counts: PlanCounts;
  /** Empty when there is nothing to hide. */
  sql: string;
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

/** The upgrade names a hide writes into that the master lacks, or still holds from before #389: run `update:upgrade` before the hide's SQL while any is listed. */
export const missingForHide = (reader: MasterReader): string[] => upgradeNeededFor(reader, HIDE_TABLES);

/**
 * Plan hiding `found`, the records the rules find in the archive the master
 * was seeded from. It reads the master; it writes nothing. A master without
 * `hidden_record` is read as hiding nothing yet, so the plan counts the same
 * before the upgrade as after it. Throws when a found record is not the
 * master's record at that line, or a page row the master holds names another
 * revision than the one judged.
 */
export function planHide(reader: MasterReader, found: readonly FoundRecord[]): HidePlan {
  const master = readMasterRelease(reader);
  const release = literal(master.releaseId);
  const hasTable = select<{ name: string }>(reader, "SELECT name FROM sqlite_schema WHERE type = 'table' AND name = 'hidden_record'").length > 0;

  const atLine = new Map(
    select<{ record_id: number; line_no: number; word: string }>(
      reader,
      `SELECT record_id, line_no, word FROM source_record WHERE release_id = ${release}
          AND line_no IN (SELECT value FROM json_each(${json(found.map(({ lineNo }) => lineNo))}))`,
    ).map((row) => [row.line_no, row]),
  );
  const mismatched = found.filter(({ word, lineNo }) => atLine.get(lineNo)?.word !== word);
  if (mismatched.length > 0) {
    throw new Error(
      `the master ${master.releaseId} does not hold these records at the archive's lines: ` +
        mismatched.map(({ word, lineNo }) => `${word} (line ${lineNo})`).join(", "),
    );
  }
  const planned = found.map((record) => ({ recordId: (atLine.get(record.lineNo) as { record_id: number }).record_id, found: record }));
  const hidden = new Set(
    hasTable
      ? select<{ record_id: number }>(
          reader,
          `SELECT record_id FROM hidden_record WHERE record_id IN (SELECT value FROM json_each(${json(planned.map(({ recordId }) => recordId))}))`,
        ).map((row) => row.record_id)
      : [],
  );
  const hides = planned.filter(({ recordId }) => !hidden.has(recordId));
  const nothing: HidePlan = {
    masterReleaseId: master.releaseId,
    hides,
    alreadyHidden: hidden.size,
    removed: { lookup_form: 0, form_of_edge: 0 },
    replacedIndexRows: 0,
    counts: PlanCounts.NONE,
    sql: "",
  };
  if (hides.length === 0) return nothing;
  const ids = hides.map(({ recordId }) => recordId);
  const byRecord = `IN (SELECT value FROM json_each(${json(ids)}))`;

  // One page row per title, shared with any definition recovered from it.
  // Only a section-language verdict was read off a page.
  const onPages = hides.flatMap(({ found: record }) => (record.rule === SECTION_LANGUAGE_RULE ? [record.page] : []));
  const titles = [...new Set(onPages.map((page) => page.title))];
  const pages = new Map(
    select<{ page_id: number; title: string; revision_id: number }>(
      reader,
      `SELECT page_id, title, revision_id FROM raw_page WHERE release_id = ${release} AND title IN (SELECT value FROM json_each(${json(titles)}))`,
    ).map((row) => [row.title, row]),
  );
  const [{ max }] = select<{ max: number | null }>(reader, "SELECT max(page_id) AS max FROM raw_page");
  let nextPageId = (max ?? 0) + 1;
  const newPages: unknown[][] = [];
  const pageIdOf = new Map<string, number>();
  for (const page of onPages) {
    if (pageIdOf.has(page.title)) continue;
    const held = pages.get(page.title);
    if (held !== undefined && held.revision_id !== page.revisionId) {
      throw new Error(`the master holds revision ${held.revision_id} of ${page.title}, the rule read revision ${page.revisionId}`);
    }
    const pageId = held?.page_id ?? nextPageId++;
    if (held === undefined) newPages.push([pageId, master.releaseId, page.wiki, page.title, page.revisionId, page.timestamp]);
    pageIdOf.set(page.title, pageId);
  }

  const keys = select<{ surface_key: string }>(reader, `SELECT DISTINCT surface_key FROM lookup_form WHERE record_id ${byRecord}`).map((row) => row.surface_key).sort();
  const [{ n: lookupRows }] = select<{ n: number }>(reader, `SELECT count(*) AS n FROM lookup_form WHERE record_id ${byRecord}`);
  const [{ n: edgeRows }] = select<{ n: number }>(reader, `SELECT count(*) AS n FROM form_of_edge WHERE record_id ${byRecord}`);
  const served = [master.releaseId, ...master.feeds.map((feed) => feed.releaseId)];
  const nearby = keys.length === 0 ? NO_NEARBY_EDITS : nearbyEdits(reader, served, keys, new Set(ids), [], []);
  const rules = [...new Set(hides.map(({ found: record }) => record.rule))].sort();

  const sql = [
    `-- Generated by src/import/hideRecords.ts: ${hides.length} record(s) of ${master.releaseId} hidden by ${rules.join(", ")}.`,
    `INSERT INTO hide_version (singleton, revision) VALUES (1, 1)
       ON CONFLICT(singleton) DO UPDATE SET revision = revision + 1;`,
    ...inserts("raw_page", newPages),
    `DELETE FROM lookup_form WHERE record_id ${byRecord};`,
    `DELETE FROM form_of_edge WHERE record_id ${byRecord};`,
    ...inserts(
      "hidden_record",
      hides.map(({ recordId, found: record }) => [
        recordId,
        master.releaseId,
        ...hiddenRowValues(record, record.rule === SECTION_LANGUAGE_RULE ? pageIdOf.get(record.page.title) : undefined),
      ]),
    ),
    ...nearby.deletes,
    ...inserts("accent_fold", nearby.accent.map((row) => [master.releaseId, row.foldKey, row.surfaceKey, row.headword, row.languages, row.richness])),
    ...inserts("typo_key", nearby.typo.map((row) => [master.releaseId, row.deletionKey, row.surfaceKey, row.languages, row.richness])),
  ];
  return {
    ...nothing,
    removed: { lookup_form: lookupRows, form_of_edge: edgeRows },
    replacedIndexRows: nearby.replaced.accent_fold + nearby.replaced.typo_key,
    counts: new PlanCounts(
      { added: 0, changed: 0, removed: hides.length },
      { hide_version: 1, raw_page: newPages.length, hidden_record: hides.length, accent_fold: nearby.accent.length, typo_key: nearby.typo.length },
      { lookup_form: lookupRows, form_of_edge: edgeRows, ...nearby.replaced },
    ),
    sql: `${sql.join("\n")}\n`,
  };
}

/** Records the plan hides that the master does not read back as hidden: a `hidden_record` row, and no search row or edge. */
export function unhidden(reader: MasterReader, plan: HidePlan): number[] {
  if (plan.hides.length === 0) return [];
  const ids = json(plan.hides.map(({ recordId }) => recordId));
  const rows = select<{ record_id: number; hidden: number; searchable: number }>(
    reader,
    `SELECT value AS record_id,
            EXISTS (SELECT 1 FROM hidden_record h WHERE h.record_id = value) AS hidden,
            EXISTS (SELECT 1 FROM lookup_form l WHERE l.record_id = value)
              OR EXISTS (SELECT 1 FROM form_of_edge e WHERE e.record_id = value) AS searchable
       FROM json_each(${ids})`,
  );
  return rows.filter((row) => row.hidden !== 1 || row.searchable !== 0).map((row) => row.record_id);
}
