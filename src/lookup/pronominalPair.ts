// What the dictionary has for the pronominal verbs rule `it-pronominal-pair/v2`
// (src/italian/pronominalPair.ts) reads a reflexive pronoun + verb pair as
// (#810, #834): `trasferirsi` for `mi trasferisco`. Two waits answer every
// pair of a lookup or a batch at once. The first sends two keyed reads side
// by side: the verb forms that spell each pair's form (table cells, curated
// cells and form-of records), and the verb records that confirm the rule's
// regular and built-table readings. The second reads, for the pronominal
// infinitives the rule names, the rows rule `it-word-shape/v1`'s read gives
// (src/lookup/wordShape.ts), so `lookup()` and a batch build their readings
// and candidates from the same rows a shape's are built from, beside the
// records of those infinitives the first wait did not read.

import {
  candidateKeysOf,
  confirmedForms,
  isPronominalVerb,
  pairCandidates,
  pairQueryOf,
  pronominalPairs,
  rowOfCell,
  rowOfFormGloss,
  type KnownForm,
  type PairCandidate,
  type PairQuery,
  type PronominalHead,
  type PronominalPair,
  type VerbHead,
} from "../italian/pronominalPair.js";
import { keyedRead, readKeys, type KeyedRead, type LookupDatabase } from "./database.js";
import { servedBy, type DictionaryTables } from "./served.js";
import { sourceTagsAt } from "./types.js";
import { readShapeRows, type ShapeRow } from "./wordShape.js";

/** The auxiliary rule `SEARCH_SQL` applies: a `forms[]` entry the source tags `auxiliary` spells nothing. */
const NOT_AUXILIARY = `NOT EXISTS (
              SELECT 1 FROM grammar_claim g
               WHERE g.record_id = lf.record_id
                 AND g.scope = 'form' AND g.scope_index = lf.form_index
                 AND g.status = 'stated'
                 AND g.dimension = 'form-role' AND g.value = 'auxiliary')`;

/** A cell's claims as the source wrote them, a JSON array of `[json_pointer, source_text]`, `missing` left out. */
const CLAIMS = `(SELECT json_group_array(json_array(t.json_pointer, t.source_text))
               FROM grammar_claim t
              WHERE t.record_id = lf.record_id AND t.scope = 'form' AND t.scope_index = lf.form_index
                AND t.status <> 'missing')`;

/** The verb table cells that spell each key, as `SEARCH_SQL` (src/lookup/lookup.ts) reads them, with their claims. */
const CELL_ARM = `SELECT lf.surface_key AS set_key, 'cell' AS kind, r.word, ${CLAIMS} AS claims, NULL AS gloss, r.line_no, lf.json_pointer, 0 AS arm
       FROM lookup_form lf
       JOIN source_record r ON r.record_id = lf.record_id
      WHERE lf.release_id IN (${servedBy("?2")}) AND lf.surface_key IN (SELECT value FROM json_each(?1))
        AND lf.origin = 'embedded-form' AND r.pos = 'verb'
        AND ${NOT_AUXILIARY}`;

/** The curated verb cells whose corrected spelling is a key, as `CORRECTED_CELL_SEARCH_SQL` reads them, with their cell's claims. */
const CORRECTED_ARM = `SELECT c.surface_key, 'corrected-cell', r.word, ${CLAIMS}, NULL, r.line_no, lf.json_pointer, 1
       FROM corrected_form c
       JOIN lookup_form lf ON lf.record_id = c.record_id AND lf.form_index = c.form_index
       JOIN source_record r ON r.record_id = c.record_id
      WHERE c.release_id IN (${servedBy("?2")}) AND c.surface_key IN (SELECT value FROM json_each(?1))
        AND r.pos = 'verb'
        AND ${NOT_AUXILIARY}`;

/** The verb records each key heads that are a form of another verb, one row per edge, with the first gloss of the sense that declares it. */
const FORM_OF_ARM = `SELECT lf.surface_key, 'form-of', e.target_word, NULL, g.text, r.line_no, e.json_pointer, 2
       FROM lookup_form lf
       JOIN source_record r ON r.record_id = lf.record_id
       JOIN form_of_edge e ON e.record_id = lf.record_id
       LEFT JOIN sense s ON s.record_id = e.record_id AND s.sense_index = e.sense_index
       LEFT JOIN sense_gloss g ON g.sense_id = s.sense_id AND g.gloss_index = 0
      WHERE lf.release_id IN (${servedBy("?2")}) AND lf.surface_key IN (SELECT value FROM json_each(?1))
        AND lf.origin = 'headword' AND r.pos = 'verb'`;

const ORDER = "ORDER BY set_key, arm, line_no, json_pointer";

/** Every read `pairedFormReadOf` may send, built once. */
const PAIRED_FORM_READS = new Map<boolean, KeyedRead>();

/**
 * The verb forms that spell each key: the source's cells, the curated cells
 * on a dictionary that has them, then the form-of records. Exported so a test
 * can assert the plan; `PAIRED_FORM_SQL` is the one a dictionary with every
 * table sends.
 */
export function pairedFormReadOf({ cellSearch }: Pick<DictionaryTables, "cellSearch">): KeyedRead {
  let read = PAIRED_FORM_READS.get(cellSearch);
  if (read === undefined) {
    read = keyedRead(`${[CELL_ARM, ...(cellSearch ? [CORRECTED_ARM] : []), FORM_OF_ARM].join("\n      UNION ALL\n     ")}\n      ${ORDER}`);
    PAIRED_FORM_READS.set(cellSearch, read);
  }
  return read;
}

export const PAIRED_FORM_SQL: KeyedRead = pairedFormReadOf({ cellSearch: true });

interface PairedFormRow {
  set_key: string;
  kind: "cell" | "corrected-cell" | "form-of";
  word: string;
  claims: string | null;
  gloss: string | null;
}

/** The form a row spells, when it fills a row of a simple tense. */
function knownFormOf(row: PairedFormRow): KnownForm | undefined {
  if (row.kind === "form-of") {
    const at = row.gloss === null ? undefined : rowOfFormGloss(row.gloss, row.word);
    return at === undefined ? undefined : { verb: row.word, row: at, from: "form-of" };
  }
  const claims = JSON.parse(row.claims ?? "[]") as [string, string][];
  const at = rowOfCell(sourceTagsAt(claims.map(([pointer, text]) => ({ pointer, text }))));
  return at === undefined ? undefined : { verb: row.word, row: at, from: row.kind };
}

/**
 * The verb records each key heads, in source order, with whether each lists
 * any form in `forms[]` and every gloss it has. Exported so a test can assert
 * the plan.
 */
export const VERB_HEAD_SQL: KeyedRead = keyedRead(`SELECT lf.surface_key AS set_key, r.record_id,
            EXISTS (SELECT 1 FROM lookup_form listed WHERE listed.record_id = r.record_id AND listed.origin = 'embedded-form') AS lists_forms,
            (SELECT json_group_array(g.text) FROM sense s JOIN sense_gloss g ON g.sense_id = s.sense_id WHERE s.record_id = r.record_id) AS glosses
       FROM lookup_form lf
       JOIN source_record r ON r.record_id = lf.record_id
      WHERE lf.release_id IN (${servedBy("?2")}) AND lf.surface_key IN (SELECT value FROM json_each(?1))
        AND lf.origin = 'headword' AND r.pos = 'verb'
      ORDER BY set_key, r.line_no`);

interface VerbHeadRow {
  set_key: string;
  record_id: number;
  lists_forms: number;
  glosses: string;
}

/** A verb record a key heads, as the rule reads it, and which record it is. */
interface ReadHead extends VerbHead {
  recordId: number;
}

/** The verb records `keys` head, by key; a key with none has an empty list, so it is not read again. */
async function readHeads(db: LookupDatabase, releaseId: string, keys: readonly string[]): Promise<Map<string, ReadHead[]>> {
  const heads = new Map<string, ReadHead[]>(keys.map((key) => [key, []]));
  for (const row of await readKeys<VerbHeadRow>(db, VERB_HEAD_SQL, keys, [releaseId])) {
    heads.get(row.set_key)?.push({ recordId: row.record_id, listsForms: row.lists_forms === 1, glosses: JSON.parse(row.glosses) as string[] });
  }
  return heads;
}

/** A pair that answers: the pronominal verb it reads as, and the rows of that verb the dictionary has. */
export interface AnsweringPair {
  pair: PronominalPair;
  rows: [ShapeRow, ...ShapeRow[]];
}

/** What the rule reads of a shape row the pronominal infinitive's key reaches; a source row's glosses are its record's. */
function headOf(row: ShapeRow, glossesOf: (recordId: number) => readonly string[]): PronominalHead {
  switch (row.from) {
    case "source":
      return { pos: row.hit.record_pos, headword: row.hit.is_headword_hit === 1, glosses: glossesOf(row.hit.record_id) };
    case "page":
      return { pos: row.entry.pos, headword: true, glosses: [] };
    case "kept":
      return { pos: row.head.pos, headword: true, glosses: [] };
  }
}

/**
 * Each key of `keys` that is a reflexive pronoun + verb pair, with the
 * pronominal verbs it answers with, in two waits however many keys: none for
 * keys that are no pair, one when no reading of a pair's form names a
 * pronominal verb. A key no pronominal verb answers is left out.
 */
export async function answeringPairs(
  db: LookupDatabase,
  releaseId: string,
  tables: DictionaryTables,
  keys: readonly string[],
): Promise<Map<string, AnsweringPair[]>> {
  const queries = keys.flatMap((key): { key: string; query: PairQuery; candidates: PairCandidate[] }[] => {
    const query = pairQueryOf(key);
    return query === undefined ? [] : [{ key, query, candidates: pairCandidates(query) }];
  });
  if (queries.length === 0) return new Map();
  const [formRows, heads] = await Promise.all([
    readKeys<PairedFormRow>(db, pairedFormReadOf(tables), queries.map(({ query }) => query.form), [releaseId]),
    readHeads(db, releaseId, [...new Set(queries.flatMap(({ candidates }) => candidateKeysOf(candidates)))]),
  ]);
  const headsOf = (key: string): readonly VerbHead[] => heads.get(key) ?? [];
  const pairsOf = new Map(
    queries.map(({ key, query, candidates }) => {
      const read = formRows.filter((row) => row.set_key === query.form).flatMap((row) => knownFormOf(row) ?? []);
      return [key, pronominalPairs(query, [...read, ...confirmedForms(query, candidates, headsOf)])] as const;
    }),
  );
  const verbKeys = [...new Set([...pairsOf.values()].flatMap((pairs) => pairs.map((pair) => pair.key)))];
  if (verbKeys.length === 0) return new Map();
  const [rows, more] = await Promise.all([
    readShapeRows(db, releaseId, tables, verbKeys),
    readHeads(db, releaseId, verbKeys.filter((key) => !heads.has(key))),
  ]);
  const glosses = new Map([...heads.values(), ...more.values()].flat().map((head) => [head.recordId, head.glosses]));
  const glossesOf = (recordId: number): readonly string[] => glosses.get(recordId) ?? [];
  const answering = new Map<string, AnsweringPair[]>();
  for (const [key, pairs] of pairsOf) {
    const answered = pairs.flatMap((pair): AnsweringPair[] => {
      const [first, ...rest] = (rows.get(pair.key) ?? []).filter((row) => isPronominalVerb(headOf(row, glossesOf)));
      return first === undefined ? [] : [{ pair, rows: [first, ...rest] }];
    });
    if (answered.length > 0) answering.set(key, answered);
  }
  return answering;
}
