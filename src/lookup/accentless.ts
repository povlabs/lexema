// The last step of a lookup (#846, #900): a one-word query nothing else
// answers, typed without the final accent of a served headword or with the
// wrong mark on it, opens that headword (`openedHeadword` in
// src/italian/finalAccent.ts). `perche` and `perchè` open `perché`;
// `piu` opens `più`, since the other headword it lacks a final accent of,
// `piú`, is recorded as a variant of `più`. `papa` and `e` are words of their
// own, so the step never runs for them. `lookup()`, `exists()` and
// `lookupBatch()` all read it here, so the three agree.

import { accentlessProbe, openedHeadword, variantNamed, type AccentedHeadword } from "../italian/finalAccent.js";
import type { DictionaryRead, LookupDatabase } from "./database.js";
import { servedBy, type DictionaryTables } from "./served.js";

/** A headword a query opens: its key, and its spelling as its first headword row writes it. */
export interface OpenedHeadword {
  key: string;
  surface: string;
}

/**
 * The served headwords whose letters are each probe of the JSON array `?2`
 * once their accents are taken off: `accent_fold` names the keys, and only a
 * key some record heads in `lookup_form` counts. Each row carries the first
 * gloss of every sense of that record, but a sense a curated correction hides
 * (#857) where the master has `hidden_sense`, so a variant link
 * (`variantNamed`) can settle several matches. A key's rows come in
 * `lookup_id` order, so its first is the spelling shown. `CROSS JOIN` keeps
 * `accent_fold` the outer loop, so `lookup_form` is probed by key, never on
 * its release prefix alone.
 */
const accentedHeadwordRead = (hides: boolean): DictionaryRead => `SELECT a.fold_key, lf.surface_key, lf.surface,
            (SELECT json_group_array(g.text)
               FROM sense s
               JOIN sense_gloss g ON g.sense_id = s.sense_id AND g.gloss_index = 0
              WHERE s.record_id = lf.record_id${
                hides ? " AND NOT EXISTS (SELECT 1 FROM hidden_sense hs WHERE hs.record_id = s.record_id AND hs.sense_index = s.sense_index)" : ""
              }) AS glosses
       FROM accent_fold a
       CROSS JOIN lookup_form lf ON lf.surface_key = a.surface_key AND lf.origin = 'headword'
      WHERE a.release_id IN (${servedBy("?1")}) AND a.fold_key IN (SELECT value FROM json_each(?2)) AND a.headword = 1
        AND lf.release_id IN (${servedBy("?1")})
      ORDER BY lf.lookup_id`;

/** The read of a master without `hidden_sense`, and of one with it. Exported so a test can assert each plan. */
export const ACCENTED_HEADWORD_SQL: DictionaryRead = accentedHeadwordRead(false);
export const HIDING_ACCENTED_HEADWORD_SQL: DictionaryRead = accentedHeadwordRead(true);

/**
 * The headword each of `keys` opens, for the keys that open one, in one
 * statement. Nothing is sent when no key may lack or mis-mark a final accent
 * (`accentlessProbe`): `zzzz`, `vado via`, `citta'`.
 */
export async function openedHeadwords(
  db: LookupDatabase,
  releaseId: string,
  tables: Pick<DictionaryTables, "senseHides">,
  keys: Iterable<string>,
): Promise<Map<string, OpenedHeadword>> {
  const probes = new Map<string, string>();
  for (const key of keys) {
    const probe = accentlessProbe(key);
    if (probe !== undefined) probes.set(key, probe);
  }
  const opened = new Map<string, OpenedHeadword>();
  if (probes.size === 0) return opened;
  const rows = await db.all<{ fold_key: string; surface_key: string; surface: string; glosses: string }>(
    tables.senseHides ? HIDING_ACCENTED_HEADWORD_SQL : ACCENTED_HEADWORD_SQL,
    [releaseId, JSON.stringify([...new Set(probes.values())])],
  );
  const surfaces = new Map<string, string>();
  const byFold = new Map<string, AccentedHeadword[]>();
  for (const row of rows) {
    if (!surfaces.has(row.surface_key)) surfaces.set(row.surface_key, row.surface);
    const glosses = (JSON.parse(row.glosses) as (string | null)[]).filter((gloss) => gloss !== null);
    const variantOf = glosses.flatMap((gloss) => variantNamed(gloss) ?? []);
    byFold.set(row.fold_key, [...(byFold.get(row.fold_key) ?? []), { key: row.surface_key, variantOf }]);
  }
  for (const [key, probe] of probes) {
    const headword = openedHeadword(key, byFold.get(probe) ?? []);
    if (headword !== undefined) opened.set(key, { key: headword, surface: surfaces.get(headword) ?? headword });
  }
  return opened;
}
