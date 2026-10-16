// The words whose pages the render diff asks for (#808): every headword, and
// every word a `form_of` edge names. The second set holds the declared lemmas
// (src/lookup/declaredLemma.ts): `verbalizzare` heads no record, yet its page
// is built from the edges of its form records. Most words it names also head
// a record; asking them twice costs nothing, as the list is a set.
//
// Plain SQL with no site code, so the diff command reads it in the running
// tree and renderPages.ts reads it in each commit's.

import type { DatabaseSync } from "node:sqlite";

/** Each distinct `word` of an archive record or a page-only entry, as #699 counted them. */
const HEADWORDS = `SELECT word FROM source_record WHERE release_id = ?1
  UNION SELECT word FROM recovered_entry WHERE release_id = ?1`;

/** Each word a served `form_of` edge names, as the declared-lemma read finds them. */
const EDGE_TARGETS = `SELECT target_word FROM form_of_edge
  WHERE release_id IN (SELECT release_id FROM served_release WHERE master_release_id = ?1)`;

/** Each word a curated edge names in place of the source's (#755), on a master that has them. */
const CORRECTED_EDGE_TARGETS = `SELECT target_word FROM corrected_edge
  WHERE target_word IS NOT NULL AND release_id IN (SELECT release_id FROM served_release WHERE master_release_id = ?1)`;

const hasTable = (db: DatabaseSync, name: string): boolean =>
  db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name) !== undefined;

/** The one release the dictionary serves. */
export function servedReleaseOf(db: DatabaseSync): string {
  const masters = db.prepare("SELECT DISTINCT master_release_id AS id FROM served_release").all() as { id: string }[];
  if (masters.length !== 1) throw new Error(`the dictionary serves ${masters.length} releases, not one`);
  return masters[0].id;
}

/** Every word with a page to ask for in `releaseId`: its headwords and the words its edges name, sorted. */
export function pageWordsOf(db: DatabaseSync, releaseId: string): string[] {
  const parts = [HEADWORDS, EDGE_TARGETS, ...(hasTable(db, "corrected_edge") ? [CORRECTED_EDGE_TARGETS] : [])];
  const sql = `SELECT word FROM (${parts.join("\n  UNION ")}) ORDER BY word`;
  return (db.prepare(sql).all(releaseId) as { word: string }[]).map(({ word }) => word);
}
