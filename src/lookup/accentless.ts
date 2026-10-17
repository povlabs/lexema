// The last step of a lookup (#846): a one-word query nothing else answers,
// typed without the final accent of exactly one served headword, opens that
// headword (`openedHeadword` in src/italian/finalAccent.ts). `perche` opens
// `perché`; `papa` and `e` are words of their own, so the step never runs for
// them. `lookup()`, `exists()` and `lookupBatch()` all read it here, so the
// three agree.

import { accentlessProbe, openedHeadword } from "../italian/finalAccent.js";
import type { DictionaryRead, LookupDatabase } from "./database.js";
import { servedBy } from "./served.js";

/** A headword a query opens: its key, and its spelling as its first headword row writes it. */
export interface OpenedHeadword {
  key: string;
  surface: string;
}

/**
 * The served headwords whose letters are each probe of the JSON array `?2`
 * once their accents are taken off: `accent_fold` names the keys, and only a
 * key some record heads in `lookup_form` counts. A key's rows come in
 * `lookup_id` order, so its first is the spelling shown. `CROSS JOIN` keeps
 * `accent_fold` the outer loop, so `lookup_form` is probed by key, never on
 * its release prefix alone. Exported so a test can assert the plan.
 */
export const ACCENTED_HEADWORD_SQL: DictionaryRead = `SELECT a.fold_key, lf.surface_key, lf.surface
       FROM accent_fold a
       CROSS JOIN lookup_form lf ON lf.surface_key = a.surface_key AND lf.origin = 'headword'
      WHERE a.release_id IN (${servedBy("?1")}) AND a.fold_key IN (SELECT value FROM json_each(?2)) AND a.headword = 1
        AND lf.release_id IN (${servedBy("?1")})
      ORDER BY lf.lookup_id`;

/**
 * The headword each of `keys` opens, for the keys that open one, in one
 * statement. Nothing is sent when no key may lack a final accent
 * (`accentlessProbe`): `zzzz`, `vado via`.
 */
export async function openedHeadwords(db: LookupDatabase, releaseId: string, keys: Iterable<string>): Promise<Map<string, OpenedHeadword>> {
  const probes = new Map<string, string>();
  for (const key of keys) {
    const probe = accentlessProbe(key);
    if (probe !== undefined) probes.set(key, probe);
  }
  const opened = new Map<string, OpenedHeadword>();
  if (probes.size === 0) return opened;
  const rows = await db.all<{ fold_key: string; surface_key: string; surface: string }>(ACCENTED_HEADWORD_SQL, [
    releaseId,
    JSON.stringify([...new Set(probes.values())]),
  ]);
  const surfaces = new Map<string, string>();
  const byFold = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!surfaces.has(row.surface_key)) surfaces.set(row.surface_key, row.surface);
    byFold.set(row.fold_key, (byFold.get(row.fold_key) ?? new Set()).add(row.surface_key));
  }
  for (const [key, probe] of probes) {
    const headword = openedHeadword(key, byFold.get(probe) ?? []);
    if (headword !== undefined) opened.set(key, { key: headword, surface: surfaces.get(headword) ?? headword });
  }
  return opened;
}
