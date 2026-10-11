// What the dictionary has for the spellings rule `it-word-shape/v1`
// (src/italian/wordShape.ts) names for a query nothing else answers (#809):
// `raccontare` for `raccontarvi`, `quello` for `quei`. One keyed read gives,
// for every spelling at once, the source's rows as the search reads them, the
// curated cells (#743), the page-only entries and the hand-kept readings each
// spelling heads, each row with what the rule judges. `lookup()` builds its
// readings from the rows that answer (src/lookup/lookup.ts), and a batch its
// candidates from the same rows (src/lookup/batch.ts), so the two never
// disagree.

import { answeringSpellings, shapedSpellings, type AnsweringSpelling, type ShapedRecord } from "../italian/wordShape.js";
import { keyedRead, readKeys, type KeyedRead, type LookupDatabase } from "./database.js";
import { handKeptHeadOf, type HandKeptHead } from "./handKept.js";
import { servedBy, type DictionaryTables } from "./served.js";

/**
 * A source record's spelling a shaped spelling reaches, with the columns
 * `SEARCH_SQL` (src/lookup/lookup.ts) reads, its record's part-of-speech
 * title, and what the rule judges: whether the source states the spelling a
 * plural there, and whether it is a table cell the source places as the past
 * participle.
 */
export interface ShapeHitRow {
  record_id: number;
  release_id: string;
  line_no: number;
  line_sha256: string;
  record_word: string;
  record_pos: string;
  record_pos_title: string;
  origin: "headword" | "embedded-form";
  json_pointer: string;
  form_source: string | null;
  surface: string;
  is_headword_hit: number;
  is_plural: number;
  is_past_participle: number;
  lists_forms: number;
}

/** A page-only entry a shaped spelling heads. */
export interface ShapePageRow {
  entry_id: number;
  revision_id: number;
  page_line: number;
  release_id: string;
  word: string;
  pos: string;
  pos_title: string;
}

/** A row a shaped spelling reaches: a source record's spelling, a page-only entry it heads, or a hand-kept reading it heads. */
export type ShapeRow =
  | { from: "source"; key: string; hit: ShapeHitRow }
  | { from: "page"; key: string; entry: ShapePageRow }
  | { from: "kept"; key: string; head: HandKeptHead };

/**
 * What rule `it-word-shape/v1` reads of a row's record. A page-only entry and
 * a hand-kept reading list no forms the lookup reads.
 */
export function shapedRecordOf(row: ShapeRow): ShapedRecord {
  switch (row.from) {
    case "source":
      return { pos: row.hit.record_pos, plural: row.hit.is_plural === 1, pastParticiple: row.hit.is_past_participle === 1, listsForms: row.hit.lists_forms === 1 };
    case "page":
      return { pos: row.entry.pos, plural: false, pastParticiple: false, listsForms: false };
    case "kept":
      return { pos: row.head.pos, plural: false, pastParticiple: false, listsForms: false };
  }
}

/** The auxiliary rule `SEARCH_SQL` applies: a `forms[]` entry the source tags `auxiliary` spells nothing. */
const NOT_AUXILIARY = `NOT EXISTS (
              SELECT 1 FROM grammar_claim g
               WHERE g.record_id = lf.record_id
                 AND g.scope = 'form' AND g.scope_index = lf.form_index
                 AND g.status = 'stated'
                 AND g.dimension = 'form-role' AND g.value = 'auxiliary')`;

/** Whether the source states a `lookup_form` row's spelling a plural: a headword by its record's number, a table cell by the cell's. */
const IS_PLURAL = `EXISTS (SELECT 1 FROM grammar_claim n
                     WHERE n.record_id = lf.record_id AND n.status = 'stated'
                       AND n.dimension = 'number' AND n.value = 'plural'
                       AND ((lf.origin = 'headword' AND n.scope = 'record')
                         OR (lf.origin = 'embedded-form' AND n.scope = 'form' AND n.scope_index = lf.form_index)))`;

/** Whether a `lookup_form` row is a table cell the source places as the past participle. */
const IS_PAST_PARTICIPLE = `(lf.origin = 'embedded-form'
             AND EXISTS (SELECT 1 FROM grammar_claim m
                          WHERE m.record_id = lf.record_id AND m.scope = 'form' AND m.scope_index = lf.form_index
                            AND m.status = 'stated' AND m.dimension = 'mood' AND m.value = 'participle')
             AND EXISTS (SELECT 1 FROM grammar_claim t
                          WHERE t.record_id = lf.record_id AND t.scope = 'form' AND t.scope_index = lf.form_index
                            AND t.status = 'stated' AND t.dimension = 'tense' AND t.value = 'past'))`;

/** Whether a `lookup_form` row's record lists any form in `forms[]`. */
const LISTS_FORMS = `EXISTS (SELECT 1 FROM lookup_form listed
                      WHERE listed.record_id = lf.record_id AND listed.origin = 'embedded-form')`;

/** The source's spellings, as `SEARCH_SQL` reads them. Its columns name every arm's. */
const SOURCE_ARM = `SELECT lf.surface_key AS set_key, 'source' AS kind, r.record_id, r.release_id, r.line_no, r.line_sha256,
            r.word AS record_word, r.pos AS record_pos, r.pos_title AS record_pos_title,
            lf.origin, lf.json_pointer, lf.form_source, lf.surface, (lf.origin = 'headword') AS is_headword_hit,
            ${IS_PLURAL} AS is_plural, ${IS_PAST_PARTICIPLE} AS is_past_participle, ${LISTS_FORMS} AS lists_forms,
            NULL AS entry_id, NULL AS revision_id, NULL AS page_line, NULL AS reading_id, NULL AS evidence_url, 0 AS arm
       FROM lookup_form lf
       JOIN source_record r ON r.record_id = lf.record_id
      WHERE lf.release_id IN (${servedBy("?2")}) AND lf.surface_key IN (SELECT value FROM json_each(?1))
        AND ${NOT_AUXILIARY}`;

/** The curated cells whose corrected spelling is a key, as `CORRECTED_CELL_SEARCH_SQL` reads them: never a headword. */
const CELL_ARM = `SELECT c.surface_key, 'cell', r.record_id, r.release_id, r.line_no, r.line_sha256,
            r.word, r.pos, r.pos_title,
            lf.origin, lf.json_pointer, lf.form_source, c.surface, 0,
            ${IS_PLURAL}, ${IS_PAST_PARTICIPLE}, ${LISTS_FORMS},
            NULL, NULL, NULL, NULL, NULL, 0
       FROM corrected_form c
       JOIN lookup_form lf ON lf.record_id = c.record_id AND lf.form_index = c.form_index
       JOIN source_record r ON r.record_id = c.record_id
      WHERE c.release_id IN (${servedBy("?2")}) AND c.surface_key IN (SELECT value FROM json_each(?1))
        AND ${NOT_AUXILIARY}`;

/** The page-only entries a key heads, as `PAGE_ENTRY_SQL` (src/lookup/pageEntry.ts) finds them. */
const PAGE_ARM = `SELECT e.word_key, 'page', NULL, e.release_id, NULL, NULL,
            e.word, e.pos, e.pos_title,
            NULL, NULL, NULL, NULL, 1, 0, 0, 0,
            e.entry_id, p.revision_id, e.page_line, NULL, NULL, 1
       FROM recovered_entry e JOIN raw_page p ON p.page_id = e.page_id
      WHERE e.release_id IN (${servedBy("?2")}) AND e.word_key IN (SELECT value FROM json_each(?1))
        AND NOT EXISTS (SELECT 1 FROM lookup_form present WHERE present.release_id IN (${servedBy("?2")})
                        AND present.surface_key = e.word_key AND present.origin = 'headword')`;

/** The hand-kept readings a key heads, each once, as `HAND_KEPT_HEADS_SQL` (src/lookup/handKept.ts) names them. */
const KEPT_ARM = `SELECT k.word_key, 'kept', NULL, NULL, NULL, NULL,
            k.word, k.pos, k.pos_title,
            NULL, NULL, NULL, NULL, 1, 0, 0, 0,
            NULL, NULL, k.section_line, k.reading_id, k.evidence_url, 2
       FROM (SELECT word_key, reading_id, MIN(definition_index) AS first_definition, word, pos, pos_title, section_line, evidence_url
               FROM hand_kept_definition WHERE word_key IN (SELECT value FROM json_each(?1))
              GROUP BY word_key, reading_id) k`;

/** Each key's rows: the source's in `SEARCH_SQL`'s order, then the page-only entries', then the hand-kept readings'. */
const ORDER = "ORDER BY set_key, arm, is_headword_hit DESC, line_no, json_pointer, entry_id, reading_id";

/** The read for a dictionary with these optional tables: an arm is sent only for a table the dictionary has. */
function shapeRead({ cellSearch, pageEntries, handKeptReadings }: Pick<DictionaryTables, "cellSearch" | "pageEntries" | "handKeptReadings">): KeyedRead {
  const arms = [SOURCE_ARM, ...(cellSearch ? [CELL_ARM] : []), ...(pageEntries ? [PAGE_ARM] : []), ...(handKeptReadings ? [KEPT_ARM] : [])];
  return keyedRead(`${arms.join("\n      UNION ALL\n     ")}\n      ${ORDER}`);
}

/** Every read `readShapeRows` may send, one per set of optional tables, built once. */
const SHAPE_READS = new Map<string, KeyedRead>();

/**
 * The shape read for a dictionary with these tables. Exported so a test can
 * assert the plan; `SHAPE_READ_SQL` is the one a dictionary with every table sends.
 */
export function shapeReadOf(tables: Pick<DictionaryTables, "cellSearch" | "pageEntries" | "handKeptReadings">): KeyedRead {
  const name = `${tables.cellSearch}${tables.pageEntries}${tables.handKeptReadings}`;
  let read = SHAPE_READS.get(name);
  if (read === undefined) {
    read = shapeRead(tables);
    SHAPE_READS.set(name, read);
  }
  return read;
}

export const SHAPE_READ_SQL: KeyedRead = shapeReadOf({ cellSearch: true, pageEntries: true, handKeptReadings: true });

/** A row of the shape read, every arm's columns. */
interface ShapeReadRow extends Omit<ShapeHitRow, "record_id" | "line_no" | "line_sha256" | "origin" | "json_pointer" | "surface"> {
  set_key: string;
  kind: "source" | "cell" | "page" | "kept";
  record_id: number | null;
  line_no: number | null;
  line_sha256: string | null;
  origin: "headword" | "embedded-form" | null;
  json_pointer: string | null;
  surface: string | null;
  entry_id: number | null;
  revision_id: number | null;
  page_line: number | null;
  reading_id: string | null;
  evidence_url: string | null;
  arm: number;
}

/**
 * Every row each key of `keys` reaches, in one statement (`shapeReadOf`). A
 * cell the source and its correction both spell is kept once, as the
 * correction spells it, as the search keeps it. Nothing is sent for no key.
 */
export async function readShapeRows(db: LookupDatabase, releaseId: string, tables: DictionaryTables, keys: readonly string[]): Promise<Map<string, ShapeRow[]>> {
  const rows = await readKeys<ShapeReadRow>(db, shapeReadOf(tables), keys, [releaseId]);
  const corrected = new Set(rows.filter((row) => row.kind === "cell").map((row) => `${row.set_key}:${row.record_id}${row.json_pointer}`));
  const byKey = new Map<string, ShapeRow[]>();
  for (const row of rows) {
    const one = rowOf(releaseId, row, corrected);
    if (one !== undefined) byKey.set(one.key, [...(byKey.get(one.key) ?? []), one]);
  }
  return byKey;
}

/** One read row as the rule and the lookup take it; undefined for a source row a correction stands in for. */
function rowOf(releaseId: string, row: ShapeReadRow, corrected: ReadonlySet<string>): ShapeRow | undefined {
  const key = row.set_key;
  switch (row.kind) {
    case "source":
    case "cell": {
      if (row.kind === "source" && corrected.has(`${key}:${row.record_id}${row.json_pointer}`)) return undefined;
      const hit: ShapeHitRow = {
        record_id: row.record_id as number, release_id: row.release_id, line_no: row.line_no as number, line_sha256: row.line_sha256 as string,
        record_word: row.record_word, record_pos: row.record_pos, record_pos_title: row.record_pos_title,
        origin: row.origin as ShapeHitRow["origin"], json_pointer: row.json_pointer as string, form_source: row.form_source,
        surface: row.surface as string, is_headword_hit: row.is_headword_hit, is_plural: row.is_plural, is_past_participle: row.is_past_participle,
        lists_forms: row.lists_forms,
      };
      return { from: "source", key, hit };
    }
    case "page":
      return {
        from: "page",
        key,
        entry: {
          entry_id: row.entry_id as number, revision_id: row.revision_id as number, page_line: row.page_line as number,
          release_id: row.release_id, word: row.record_word, pos: row.record_pos, pos_title: row.record_pos_title,
        },
      };
    case "kept":
      return {
        from: "kept",
        key,
        head: handKeptHeadOf(releaseId, {
          reading_id: row.reading_id as string, word: row.record_word, pos: row.record_pos, pos_title: row.record_pos_title,
          section_line: row.page_line as number, evidence_url: row.evidence_url as string,
        }),
      };
  }
}

/** The keys rule `it-word-shape/v1` names for `key`, each once. */
export const shapeKeysOf = (key: string): string[] => [...new Set(shapedSpellings(key).map((spelling) => spelling.key))];

/**
 * The spellings rule `it-word-shape/v1` names for `key` that answer, and
 * the rows each answers with (`answeringSpellings`); empty when none does.
 */
export function answeringShapes(key: string, rows: ReadonlyMap<string, readonly ShapeRow[]>): AnsweringSpelling<ShapeRow>[] {
  return answeringSpellings(shapedSpellings(key), (spelling) => rows.get(spelling) ?? [], shapedRecordOf);
}
