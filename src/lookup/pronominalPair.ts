// What the dictionary has for the pronominal verbs rule `it-pronominal-pair/v1`
// (src/italian/pronominalPair.ts) reads a `si` + verb pair as (#810):
// `trasferirsi` for `si trasferiscono`. Two keyed reads answer every pair of
// a lookup or a batch at once: the verb table cells that spell each pair's
// verb form, then, for the pronominal infinitives the rule names from them,
// the rows rule `it-word-shape/v1`'s read gives (src/lookup/wordShape.ts), so
// `lookup()` and a batch build their readings and candidates from the same
// rows a shape's are built from.

import { isPronominalVerb, pairQueryOf, pronominalPairs, type PairQuery, type PronominalHead, type PronominalPair } from "../italian/pronominalPair.js";
import { keyedRead, readKeys, type KeyedRead, type LookupDatabase } from "./database.js";
import { servedBy, type DictionaryTables } from "./served.js";
import { readShapeRows, type ShapeRow } from "./wordShape.js";

/**
 * The verb table cells that spell each key, as `SEARCH_SQL`
 * (src/lookup/lookup.ts) reads them, with their record's word and part of
 * speech and whether the source states the cell a third person's. A cell the
 * source tags `auxiliary` spells nothing.
 */
export const PAIRED_CELL_SQL: KeyedRead = keyedRead(`SELECT lf.surface_key AS set_key, r.word, r.pos,
            EXISTS (SELECT 1 FROM grammar_claim p
                     WHERE p.record_id = lf.record_id AND p.scope = 'form' AND p.scope_index = lf.form_index
                       AND p.status = 'stated' AND p.dimension = 'person' AND p.value = 'third-person') AS third_person
       FROM lookup_form lf
       JOIN source_record r ON r.record_id = lf.record_id
      WHERE lf.release_id IN (${servedBy("?2")}) AND lf.surface_key IN (SELECT value FROM json_each(?1))
        AND lf.origin = 'embedded-form' AND r.pos = 'verb'
        AND NOT EXISTS (
              SELECT 1 FROM grammar_claim g
               WHERE g.record_id = lf.record_id
                 AND g.scope = 'form' AND g.scope_index = lf.form_index
                 AND g.status = 'stated'
                 AND g.dimension = 'form-role' AND g.value = 'auxiliary')
      ORDER BY set_key, r.line_no, lf.json_pointer`);

interface PairedCellRow {
  set_key: string;
  word: string;
  pos: string;
  third_person: number;
}

/** A pair that answers: the pronominal verb it reads as, and the rows of that verb the dictionary has. */
export interface AnsweringPair {
  pair: PronominalPair;
  rows: [ShapeRow, ...ShapeRow[]];
}

/** What the rule reads of a shape row the pronominal infinitive's key reaches. */
function headOf(row: ShapeRow): PronominalHead {
  switch (row.from) {
    case "source":
      return { pos: row.hit.record_pos, headword: row.hit.is_headword_hit === 1 };
    case "page":
      return { pos: row.entry.pos, headword: true };
    case "kept":
      return { pos: row.head.pos, headword: true };
  }
}

/**
 * Each key of `keys` that is a `si` + verb pair, with the pronominal verbs it
 * answers with, in two statements however many keys: none for keys that are
 * no pair, one when no cell spells a pair's verb form. A key no pronominal
 * verb answers is left out.
 */
export async function answeringPairs(
  db: LookupDatabase,
  releaseId: string,
  tables: DictionaryTables,
  keys: readonly string[],
): Promise<Map<string, AnsweringPair[]>> {
  const queries = keys.flatMap((key): { key: string; query: PairQuery }[] => {
    const query = pairQueryOf(key);
    return query === undefined ? [] : [{ key, query }];
  });
  if (queries.length === 0) return new Map();
  const cells = await readKeys<PairedCellRow>(db, PAIRED_CELL_SQL, queries.map(({ query }) => query.form), [releaseId]);
  const pairsOf = new Map(
    queries.map(({ key, query }) => {
      const spelling = cells.filter((cell) => cell.set_key === query.form).map((cell) => ({ word: cell.word, pos: cell.pos, thirdPerson: cell.third_person === 1 }));
      return [key, pronominalPairs(query, spelling)] as const;
    }),
  );
  const verbKeys = [...new Set([...pairsOf.values()].flatMap((pairs) => pairs.map((pair) => pair.key)))];
  if (verbKeys.length === 0) return new Map();
  const rows = await readShapeRows(db, releaseId, tables, verbKeys);
  const answering = new Map<string, AnsweringPair[]>();
  for (const [key, pairs] of pairsOf) {
    const answered = pairs.flatMap((pair): AnsweringPair[] => {
      const [first, ...rest] = (rows.get(pair.key) ?? []).filter((row) => isPronominalVerb(headOf(row)));
      return first === undefined ? [] : [{ pair, rows: [first, ...rest] }];
    });
    if (answered.length > 0) answering.set(key, answered);
  }
  return answering;
}
