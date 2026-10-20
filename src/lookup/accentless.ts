// The last step of a lookup (#846, #900): a one-word query nothing else
// answers, typed without the final accent of a served headword, with the
// wrong mark on it, or with an apostrophe and an accent swapped, opens that
// headword (`openedHeadword` in src/italian/finalAccent.ts). `perche` and
// `perchè` open `perché`, `citta'` opens `città` and `pò` opens `po'`;
// `piu` opens `più`, since the other headword it lacks a final accent of,
// `piú`, is recorded as a variant of `più`. `papa` and `e` are words of their
// own, so the step never runs for them. `lookup()`, `exists()` and
// `lookupBatch()` all read it here, so the three agree.

import { accentlessProbe, openedHeadword, variantNamed, type AccentedHeadword, type AccentProbe } from "../italian/finalAccent.js";
import type { DictionaryRead, LookupDatabase } from "./database.js";
import { servedBy, type DictionaryTables } from "./served.js";

/** A headword a query opens: its key, and its spelling as its first headword row writes it. */
export interface OpenedHeadword {
  key: string;
  surface: string;
}

/**
 * The served headwords each probe names (`accentlessProbe`): those whose
 * letters are a fold of the JSON array `?2` once their accents are taken off,
 * which `accent_fold` names, and those spelled as an elided key of the JSON
 * array `?3`, which no fold names since they carry no accent. Only a key some
 * record heads in `lookup_form` counts, and each row names the probe that
 * found it. Each row carries the first gloss of every sense of that record,
 * but a sense a curated correction hides (#857) where the master has
 * `hidden_sense`, so a variant link (`variantNamed`) can settle several
 * matches. A key's rows come in `lookup_id` order, so its first is the
 * spelling shown. `CROSS JOIN` keeps the probes the outer loop, so
 * `lookup_form` is probed by key, never on its release prefix alone.
 */
const accentedHeadwordRead = (hides: boolean): DictionaryRead => `SELECT p.probe, lf.surface_key, lf.surface,
            (SELECT json_group_array(g.text)
               FROM sense s
               JOIN sense_gloss g ON g.sense_id = s.sense_id AND g.gloss_index = 0
              WHERE s.record_id = lf.record_id${
                hides ? " AND NOT EXISTS (SELECT 1 FROM hidden_sense hs WHERE hs.record_id = s.record_id AND hs.sense_index = s.sense_index)" : ""
              }) AS glosses
       FROM (SELECT a.fold_key AS probe, a.surface_key
               FROM accent_fold a
              WHERE a.release_id IN (${servedBy("?1")}) AND a.fold_key IN (SELECT value FROM json_each(?2)) AND a.headword = 1
             UNION ALL
             SELECT value AS probe, value AS surface_key FROM json_each(?3)) p
       CROSS JOIN lookup_form lf ON lf.surface_key = p.surface_key AND lf.origin = 'headword'
      WHERE lf.release_id IN (${servedBy("?1")})
      ORDER BY lf.lookup_id`;

/** The read of a master without `hidden_sense`, and of one with it. Exported so a test can assert each plan. */
export const ACCENTED_HEADWORD_SQL: DictionaryRead = accentedHeadwordRead(false);
export const HIDING_ACCENTED_HEADWORD_SQL: DictionaryRead = accentedHeadwordRead(true);

/**
 * The headword each of `keys` opens, for the keys that open one, in one
 * statement. Nothing is sent when no key may lack or mis-mark a final accent
 * (`accentlessProbe`): `zzzz`, `vado via`, `bar`.
 */
export async function openedHeadwords(
  db: LookupDatabase,
  releaseId: string,
  tables: Pick<DictionaryTables, "senseHides">,
  keys: Iterable<string>,
): Promise<Map<string, OpenedHeadword>> {
  const probes = new Map<string, AccentProbe>();
  for (const key of keys) {
    const probe = accentlessProbe(key);
    if (probe !== undefined) probes.set(key, probe);
  }
  const opened = new Map<string, OpenedHeadword>();
  if (probes.size === 0) return opened;
  const folds = new Set([...probes.values()].map((probe) => probe.fold));
  const elided = new Set([...probes.values()].flatMap((probe) => probe.elided ?? []));
  const rows = await db.all<{ probe: string; surface_key: string; surface: string; glosses: string }>(
    tables.senseHides ? HIDING_ACCENTED_HEADWORD_SQL : ACCENTED_HEADWORD_SQL,
    [releaseId, JSON.stringify([...folds]), JSON.stringify([...elided])],
  );
  const surfaces = new Map<string, string>();
  const byProbe = new Map<string, AccentedHeadword[]>();
  for (const row of rows) {
    if (!surfaces.has(row.surface_key)) surfaces.set(row.surface_key, row.surface);
    const glosses = (JSON.parse(row.glosses) as (string | null)[]).filter((gloss) => gloss !== null);
    const variantOf = glosses.flatMap((gloss) => variantNamed(gloss) ?? []);
    byProbe.set(row.probe, [...(byProbe.get(row.probe) ?? []), { key: row.surface_key, variantOf }]);
  }
  for (const [key, probe] of probes) {
    const read = [probe.fold, ...(probe.elided === undefined ? [] : [probe.elided])].flatMap((at) => byProbe.get(at) ?? []);
    const headword = openedHeadword(key, read);
    if (headword !== undefined) opened.set(key, { key: headword, surface: surfaces.get(headword) ?? headword });
  }
  return opened;
}
