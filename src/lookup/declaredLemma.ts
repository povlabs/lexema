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
// A verb whose own record has no table reads the same edges (#799): `bellare`
// has a record, with no conjugation, and some thirty form records say "… di
// bellare". `declaredVerbForms` gives the verb forms those edges place, read
// exactly as a declared lemma's, and the page builds the verb's table from
// them. The page asks only for a verb none of whose records draws a table.
//
// Each edge's gloss is read by a closed rule: `it-verb-form-gloss/v1` for a
// verb record, `it-plural-gloss/v1` for a noun or adjective record. A gloss the
// rule refuses gives no form. Nothing is written: the rules read at lookup time.
// A curated correction of a plural's record (#420) stands in for its tags here
// exactly as on a word's own page (`pluralDeclaration`, #470).

import { POS_TITLE_BY_TEMPLATE } from "../italian/wikitext.js";
import { readPluralGloss } from "../italian/pluralGloss.js";
import { readVerbFormGloss } from "../italian/verbFormGloss.js";
import { correctionOf, correctionsByRecord, type CorrectionRow } from "./correctedClaim.js";
import { correctedEdgeServed, sourceEdgeServed } from "./correctedEdge.js";
import type { DictionaryRead, LookupDatabase } from "./database.js";
import { dictionaryTables, servedBy } from "./served.js";
import { pluralDeclaration } from "./types.js";
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
 * The stated genders and numbers of the same declaring records. The genders
 * place a plural whose gloss names no gender; the numbers are read only so a
 * correction of one can say what it replaces, as `INFLECTION_GRAMMAR_SQL`
 * reads them for a word's own page. Read off the same edges, beside the read
 * above.
 */
export const DECLARED_LEMMA_GENDER_SQL: DictionaryRead = `SELECT DISTINCT c.record_id, c.dimension, c.value, c.source_text, c.json_pointer,
            d.release_id, d.line_no, d.line_sha256
       FROM form_of_edge e
       JOIN source_record d ON d.record_id = e.record_id
       JOIN grammar_claim c
         ON c.record_id = e.record_id AND c.scope = 'record' AND c.status = 'stated' AND c.dimension IN ('gender', 'number')
      WHERE e.release_id IN (${servedBy("?1")}) AND e.target_word_key = ?2
      ORDER BY c.record_id, c.json_pointer`;

/**
 * The curated corrections (#420) of the same declaring records, read off the
 * same edges and beside the reads above, and only when the master has the
 * table (`dictionaryTables`).
 */
export const DECLARED_LEMMA_CORRECTION_SQL: DictionaryRead = `SELECT DISTINCT k.record_id, k.dimension, k.value, k.correction_id, k.evidence_url
       FROM form_of_edge e
       JOIN corrected_claim k ON k.record_id = e.record_id
      WHERE e.release_id IN (${servedBy("?1")}) AND e.target_word_key = ?2
      ORDER BY k.record_id, k.dimension`;

/** The edges a declared-lemma read takes on a master with corrected edges (src/lookup/correctedEdge.ts). */
type CorrectedArm = "served form_of_edge" | "corrected_edge";

/** The joins of each read above after the edge and its record: the first gloss of the edge's sense, the stated claims, the corrections. */
const DECLARED_GLOSS_JOINS = `
       LEFT JOIN sense s ON s.record_id = e.record_id AND s.sense_index = e.sense_index
       LEFT JOIN sense_gloss g ON g.sense_id = s.sense_id AND g.gloss_index = 0`;
const DECLARED_GRAMMAR_JOINS = `
       JOIN grammar_claim c
         ON c.record_id = e.record_id AND c.scope = 'record' AND c.status = 'stated' AND c.dimension IN ('gender', 'number')`;
const DECLARED_CORRECTION_JOINS = `
       JOIN corrected_claim k ON k.record_id = e.record_id`;

/** `FROM` and `WHERE` of one arm: the edges of `arm` naming the key at `?2`, with the declaring record `d`. */
const edgesNaming = (arm: CorrectedArm, joins: string): string => `FROM ${arm === "corrected_edge" ? "corrected_edge" : "form_of_edge"} e
       JOIN source_record d ON d.record_id = e.record_id${joins}
      WHERE e.release_id IN (${servedBy("?1")}) AND e.target_word_key = ?2 AND ${arm === "served form_of_edge" ? sourceEdgeServed("e") : correctedEdgeServed("e")}`;

/**
 * `DECLARED_LEMMA_SQL` on a master with corrected edges: a sense's corrected
 * edge names a word in place of its own. Exported so a test can hold the plan.
 */
export const CORRECTED_DECLARED_LEMMA_SQL: DictionaryRead = `SELECT d.record_id, d.release_id, d.line_no AS line_no, d.line_sha256, d.word, d.pos,
            e.target_word, g.text AS gloss, g.json_pointer AS gloss_pointer, e.json_pointer AS edge_pointer
       ${edgesNaming("served form_of_edge", DECLARED_GLOSS_JOINS)}
     UNION ALL
     SELECT d.record_id, d.release_id, d.line_no, d.line_sha256, d.word, d.pos,
            e.target_word, g.text AS gloss, g.json_pointer AS gloss_pointer, e.json_pointer AS edge_pointer
       ${edgesNaming("corrected_edge", DECLARED_GLOSS_JOINS)}
      ORDER BY line_no, edge_pointer`;

/** `DECLARED_LEMMA_GENDER_SQL` off `CORRECTED_DECLARED_LEMMA_SQL`'s edges; `UNION` keeps each row once. */
export const CORRECTED_DECLARED_LEMMA_GENDER_SQL: DictionaryRead = `SELECT c.record_id AS record_id, c.dimension, c.value, c.source_text, c.json_pointer AS json_pointer,
            d.release_id, d.line_no, d.line_sha256
       ${edgesNaming("served form_of_edge", DECLARED_GRAMMAR_JOINS)}
     UNION
     SELECT c.record_id, c.dimension, c.value, c.source_text, c.json_pointer,
            d.release_id, d.line_no, d.line_sha256
       ${edgesNaming("corrected_edge", DECLARED_GRAMMAR_JOINS)}
      ORDER BY record_id, json_pointer`;

/** `DECLARED_LEMMA_CORRECTION_SQL` off `CORRECTED_DECLARED_LEMMA_SQL`'s edges; `UNION` keeps each row once. */
export const CORRECTED_DECLARED_LEMMA_CORRECTION_SQL: DictionaryRead = `SELECT k.record_id AS record_id, k.dimension AS dimension, k.value, k.correction_id, k.evidence_url
       ${edgesNaming("served form_of_edge", DECLARED_CORRECTION_JOINS)}
     UNION
     SELECT k.record_id, k.dimension, k.value, k.correction_id, k.evidence_url
       ${edgesNaming("corrected_edge", DECLARED_CORRECTION_JOINS)}
      ORDER BY record_id, dimension`;

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

interface GrammarRow {
  record_id: number;
  dimension: "gender" | "number";
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
  const [first, ...rest] = await declaredReadings(db, releaseId, notFound.query.key);
  if (first === undefined) return undefined;
  return { outcome: "declared-lemma", query: notFound.query, release: notFound.release, readings: [first, ...rest] };
}

/**
 * The verb forms the served edges naming `key` declare, each where its gloss
 * places it, as a declared lemma's verb reading holds them; undefined when no
 * gloss places one (#799).
 */
export async function declaredVerbForms(
  db: LookupDatabase,
  releaseId: string,
  key: string,
): Promise<[DeclaredVerbForm, ...DeclaredVerbForm[]] | undefined> {
  return (await declaredReadings(db, releaseId, key)).find((reading) => reading.pos === "verb")?.forms;
}

/**
 * One reading per part of speech whose forms the served edges naming `key`
 * declare, in the order the source first places a form of it; none when no
 * gloss on those edges places a form.
 */
async function declaredReadings(db: LookupDatabase, releaseId: string, key: string): Promise<DeclaredLemmaReading[]> {
  // Which reads to send depends on the tables, so they wait on that one statement.
  const { corrections: corrected, edgeCorrections } = await dictionaryTables(db);
  const [edges, grammarRows, correctionRows] = await Promise.all([
    db.all<EdgeRow>(edgeCorrections ? CORRECTED_DECLARED_LEMMA_SQL : DECLARED_LEMMA_SQL, [releaseId, key]),
    db.all<GrammarRow>(edgeCorrections ? CORRECTED_DECLARED_LEMMA_GENDER_SQL : DECLARED_LEMMA_GENDER_SQL, [releaseId, key]),
    corrected ? db.all<CorrectionRow>(edgeCorrections ? CORRECTED_DECLARED_LEMMA_CORRECTION_SQL : DECLARED_LEMMA_CORRECTION_SQL, [releaseId, key]) : [],
  ]);

  const stated = new Map<number, StatedClaim[]>();
  for (const row of grammarRows) {
    stated.set(row.record_id, [
      ...(stated.get(row.record_id) ?? []),
      { status: "stated", dimension: row.dimension, value: row.value, sourceText: row.source_text, ref: lineRef(row, row.json_pointer) },
    ]);
  }
  const corrections = correctionsByRecord(correctionRows);

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
      const declaration = pluralDeclaration(
        gloss,
        plural.gender,
        stated.get(row.record_id) ?? [],
        (corrections.get(row.record_id) ?? []).map(correctionOf),
      );
      plurals[row.pos].push({ ...form, plural: declaration });
    }
    if (!words.has(row.pos)) words.set(row.pos, row.target_word);
  }

  return [...words].flatMap(([pos, word]): DeclaredLemmaReading[] => {
    const posTitle = POS_TITLE_BY_TEMPLATE[TEMPLATE[pos]];
    if (pos === "verb") {
      const forms = nonEmpty(verbs);
      return forms === undefined ? [] : [{ pos, posTitle, word, forms }];
    }
    const forms = nonEmpty(plurals[pos]);
    return forms === undefined ? [] : [{ pos, posTitle, word, forms }];
  });
}
