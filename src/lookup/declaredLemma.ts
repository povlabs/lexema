// A declared lemma (#453): a word no record heads, lists or spells as a phrase,
// that `form_of` edges of served records still name. `verbalizzare` has no
// record of its own, and its fifty bot-made form records say "prima persona
// singolare dell'indicativo presente di verbalizzare" and so on. Huey ruled on
// 2026-10-03 that searching such a word shows it with its forms table, built
// from those edges, with no definition and no note.
//
// The probe runs only after a lookup found nothing: it takes the `not-found`
// itself, so it cannot run in place of the search or the phrase rule. The page
// runs it (web/lib/dictionary/searchAttempt.ts); the developer API does not.
//
// Each edge's gloss is read by a closed rule: `it-verb-form-gloss/v1` for a
// verb record, `it-plural-gloss/v1` for a noun or adjective record. A gloss the
// rule refuses gives no form. Nothing is written: the rules read at lookup time.

import { POS_TITLE_BY_TEMPLATE } from "../italian/wikitext.js";
import { readPluralGloss } from "../italian/pluralGloss.js";
import { readVerbFormGloss } from "../italian/verbFormGloss.js";
import type { DictionaryRead, LookupDatabase } from "./database.js";
import { servedBy } from "./served.js";
import type {
  DeclaredLemmaReading,
  DeclaredLemmaResult,
  DeclaredPluralForm,
  DeclaredVerbForm,
  NotFoundResult,
  SourceRef,
  StatedClaim,
} from "./types.js";

/**
 * Every served edge naming the query's key, with the declaring record and the
 * first gloss of the sense that declares it. It starts from
 * `form_of_edge_by_target` on its whole key, once per served release, and
 * reads every other table by key from there. A hidden or retired record has no
 * edge rows, so neither reaches this. Exported so a test can hold the plan.
 */
export const DECLARED_LEMMA_SQL: DictionaryRead = `SELECT d.record_id, d.release_id, d.line_no, d.line_sha256, d.word, d.pos,
            e.target_word, g.text AS gloss, g.json_pointer AS gloss_pointer
       FROM form_of_edge e
       JOIN source_record d ON d.record_id = e.record_id
       LEFT JOIN sense s ON s.record_id = e.record_id AND s.sense_index = e.sense_index
       LEFT JOIN sense_gloss g ON g.sense_id = s.sense_id AND g.gloss_index = 0
      WHERE e.release_id IN (${servedBy("?1")}) AND e.target_word_key = ?2
      ORDER BY d.line_no, e.json_pointer`;

/**
 * The stated genders of the same declaring records, which place a plural whose
 * gloss names no gender. Read off the same edges, beside the read above.
 */
export const DECLARED_LEMMA_GENDER_SQL: DictionaryRead = `SELECT DISTINCT c.record_id, c.value, c.source_text, c.json_pointer,
            d.release_id, d.line_no, d.line_sha256
       FROM form_of_edge e
       JOIN source_record d ON d.record_id = e.record_id
       JOIN grammar_claim c
         ON c.record_id = e.record_id AND c.scope = 'record' AND c.status = 'stated' AND c.dimension = 'gender'
      WHERE e.release_id IN (${servedBy("?1")}) AND e.target_word_key = ?2
      ORDER BY c.record_id, c.json_pointer`;

/** The declaring records' parts of speech a declared lemma reads, to their section template. */
const TEMPLATE = { verb: "verb", noun: "sost", adj: "adj" } as const;
type DeclaredPos = keyof typeof TEMPLATE;
const isDeclaredPos = (pos: string): pos is DeclaredPos => Object.hasOwn(TEMPLATE, pos);

interface EdgeRow {
  record_id: number;
  release_id: string;
  line_no: number;
  line_sha256: string;
  word: string;
  pos: string;
  target_word: string;
  gloss: string | null;
  gloss_pointer: string | null;
}

interface GenderRow {
  record_id: number;
  value: string;
  source_text: string;
  json_pointer: string;
  release_id: string;
  line_no: number;
  line_sha256: string;
}

const lineRef = (row: { release_id: string; line_no: number; line_sha256: string }, jsonPointer: string): SourceRef => ({
  releaseId: row.release_id,
  lineNo: row.line_no,
  jsonPointer,
  lineSha256: row.line_sha256,
});

const nonEmpty = <T>(items: readonly T[]): [T, ...T[]] | undefined => {
  const [first, ...rest] = items;
  return first === undefined ? undefined : [first, ...rest];
};

/**
 * The declared lemma a `not-found` query names, or undefined when no served
 * edge names it or no gloss on those edges places a form.
 */
export async function declaredLemma(
  db: LookupDatabase,
  releaseId: string,
  notFound: NotFoundResult,
): Promise<DeclaredLemmaResult | undefined> {
  const { key } = notFound.query;
  const [edges, genderRows] = await Promise.all([
    db.all<EdgeRow>(DECLARED_LEMMA_SQL, [releaseId, key]),
    db.all<GenderRow>(DECLARED_LEMMA_GENDER_SQL, [releaseId, key]),
  ]);

  const genders = new Map<number, StatedClaim[]>();
  for (const row of genderRows) {
    genders.set(row.record_id, [
      ...(genders.get(row.record_id) ?? []),
      { status: "stated", dimension: "gender", value: row.value, sourceText: row.source_text, ref: lineRef(row, row.json_pointer) },
    ]);
  }

  // One reading per part of speech, in the order the source first places a
  // form of it, each spelled as its first placed edge names the word.
  const words = new Map<DeclaredPos, string>();
  const verbs: DeclaredVerbForm[] = [];
  const plurals: Record<"noun" | "adj", DeclaredPluralForm[]> = { noun: [], adj: [] };
  for (const row of edges) {
    if (row.gloss === null || row.gloss_pointer === null || !isDeclaredPos(row.pos)) continue;
    const gloss = { text: row.gloss, ref: lineRef(row, row.gloss_pointer) };
    const form = { surface: row.word, ref: lineRef(row, "/word") };
    if (row.pos === "verb") {
      const slot = readVerbFormGloss(row.gloss, row.target_word);
      if (slot === undefined) continue;
      verbs.push({ ...form, gloss, slot });
    } else {
      const plural = readPluralGloss(row.gloss, row.target_word);
      if (plural === undefined) continue;
      const recordGenders = genders.get(row.record_id) ?? [];
      plurals[row.pos].push({ ...form, plural: { gloss, glossGender: plural.gender, recordGenders, correctedNumber: undefined } });
    }
    if (!words.has(row.pos)) words.set(row.pos, row.target_word);
  }

  const readings = [...words].flatMap(([pos, word]): DeclaredLemmaReading[] => {
    const posTitle = POS_TITLE_BY_TEMPLATE[TEMPLATE[pos]];
    if (pos === "verb") {
      const forms = nonEmpty(verbs);
      return forms === undefined ? [] : [{ pos, posTitle, word, forms }];
    }
    const forms = nonEmpty(plurals[pos]);
    return forms === undefined ? [] : [{ pos, posTitle, word, forms }];
  });
  const [first, ...rest] = readings;
  if (first === undefined) return undefined;
  return { outcome: "declared-lemma", query: notFound.query, release: notFound.release, readings: [first, ...rest] };
}
