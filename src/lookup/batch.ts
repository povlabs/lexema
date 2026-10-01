// The lookup of many words at once, light (#335): for each word, the records a
// full `lookup()` would answer it with, as the candidates
// `candidatesOf` (web/worker/api/lookupAnswer.ts) makes of them, but carrying
// only each record's identity and part of speech.
//
// `POST /v1/lookup/batch` answers with nothing more, and a full lookup reads a
// record's grammar, forms, senses and raw line one statement at a time: 20 to
// 110 statements a word, where Cloudflare allows a request 1,000
// (reports/2026-10-01-batch-d1-statements.md). Here every step is one
// statement for all the words: the release, the search, the lemma links, and
// for words nothing spells, the multi-word reading (src/lookup/phrase.ts).
//
// The answer is the full lookup's, made the same way: records grouped and put
// in source order, a lemma the query also matched folded into the reading that
// names it, a form-of reading answered with its lemmas of its own part of
// speech (`lemmasOfPartOfSpeech`), each record once.

import type { DictionaryRead, LookupDatabase } from "./database.js";
import { queryInfoOf, rejectionOf, servableRelease } from "./lookup.js";
import { phraseMatchesOf } from "./phrase.js";
import { servedBy } from "./served.js";
import { lemmasOfPartOfSpeech, type QueryInfo, type RejectedResult, type ReleaseInfo } from "./types.js";

/** One record a word is answered with: where it is in its release, its headword and its part of speech. */
export interface CandidateRecord {
  recordId: number;
  /** The record's own release, which `lineNo` counts in: the master's, or a feed's (src/lookup/served.ts). */
  releaseId: string;
  lineNo: number;
  word: string;
  pos: string;
  posTitle: string;
}

/** One word of a batch: refused before the index, not found, or its candidates in the lookup's order. */
export type BatchAnswer =
  | RejectedResult
  | { outcome: "not-found"; query: QueryInfo }
  | { outcome: "found"; query: QueryInfo; candidates: [CandidateRecord, ...CandidateRecord[]] };

export interface BatchLookup {
  release: ReleaseInfo;
  /** One answer per query, in the order the queries came. */
  answers: BatchAnswer[];
}

/**
 * `SEARCH_SQL` (src/lookup/lookup.ts) for many keys in one read, one row per
 * key and record: the same rows, the auxiliary rule included, with only what a
 * candidate carries and whether any of the record's hits is its headword. The
 * keys are one JSON array, so the read binds two values however many words a
 * batch sends. Exported so a test can assert the plan.
 */
export const BATCH_SEARCH_SQL: DictionaryRead = `SELECT lf.surface_key, r.record_id, r.release_id, r.line_no, r.word, r.pos, r.pos_title,
            MAX(lf.origin = 'headword') AS is_about
       FROM lookup_form lf
       JOIN source_record r ON r.record_id = lf.record_id
      WHERE lf.release_id IN (${servedBy("?1")}) AND lf.surface_key IN (SELECT value FROM json_each(?2))
        AND NOT EXISTS (
              SELECT 1 FROM grammar_claim g
               WHERE g.record_id = lf.record_id
                 AND g.scope = 'form' AND g.scope_index = lf.form_index
                 AND g.status = 'stated'
                 AND g.dimension = 'form-role' AND g.value = 'auxiliary')
      GROUP BY lf.surface_key, r.record_id`;

/**
 * `LEMMA_LINK_SQL` (src/lookup/lookup.ts) for many records in one read, with
 * each candidate's title: every `form_of` edge the records declare, in edge
 * order, each with every headword record its target word names, or none when
 * it dangles. Exported so a test can assert the plan.
 */
export const BATCH_LEMMA_LINK_SQL: DictionaryRead = `SELECT e.record_id, e.edge_id,
            t.record_id   AS candidate_record_id,
            t.release_id  AS candidate_release_id,
            t.line_no     AS candidate_line_no,
            t.word        AS candidate_word,
            t.pos         AS candidate_pos,
            t.pos_title   AS candidate_pos_title
       FROM form_of_edge e
       LEFT JOIN lookup_form lf
         ON lf.release_id IN (${servedBy("?2")})
        AND lf.surface_key = e.target_word_key
        AND lf.origin = 'headword'
       LEFT JOIN source_record t ON t.record_id = lf.record_id
      WHERE e.record_id IN (SELECT value FROM json_each(?1)) AND e.release_id IN (${servedBy("?2")})
      ORDER BY e.record_id, e.edge_id, t.line_no`;

interface HitRow {
  surface_key: string;
  record_id: number;
  release_id: string;
  line_no: number;
  word: string;
  pos: string;
  pos_title: string;
  is_about: number;
}

interface LinkRow {
  record_id: number;
  edge_id: number;
  candidate_record_id: number | null;
  candidate_release_id: string | null;
  candidate_line_no: number | null;
  candidate_word: string | null;
  candidate_pos: string | null;
  candidate_pos_title: string | null;
}

/** A record one key matched, and whether the key is its headword rather than only a form in its table. */
interface Match {
  record: CandidateRecord;
  about: boolean;
}

/** A `form_of` edge a record declares, light: the records its word names, or none. */
type LightLink = { kind: "dangling" } | { kind: "candidates"; candidates: CandidateRecord[] };

const recordOf = (row: HitRow): CandidateRecord => ({
  recordId: row.record_id,
  releaseId: row.release_id,
  lineNo: row.line_no,
  word: row.word,
  pos: row.pos,
  posTitle: row.pos_title,
});

/** Every key's matched records, by key and then by record, in one read. */
async function search(db: LookupDatabase, releaseId: string, keys: readonly string[]): Promise<Map<string, Map<number, Match>>> {
  const byKey = new Map<string, Map<number, Match>>();
  if (keys.length === 0) return byKey;
  for (const row of await db.all<HitRow>(BATCH_SEARCH_SQL, [releaseId, JSON.stringify(keys)])) {
    const matches = byKey.get(row.surface_key) ?? new Map<number, Match>();
    matches.set(row.record_id, { record: recordOf(row), about: row.is_about === 1 });
    byKey.set(row.surface_key, matches);
  }
  return byKey;
}

/** Every `form_of` edge the records declare, by record, in one read. */
async function linksOf(db: LookupDatabase, releaseId: string, recordIds: readonly number[]): Promise<Map<number, LightLink[]>> {
  const byRecord = new Map<number, LightLink[]>();
  if (recordIds.length === 0) return byRecord;
  const byEdge = new Map<number, LightLink>();
  for (const row of await db.all<LinkRow>(BATCH_LEMMA_LINK_SQL, [JSON.stringify(recordIds), releaseId])) {
    let link = byEdge.get(row.edge_id);
    if (link === undefined) {
      link = row.candidate_record_id === null ? { kind: "dangling" } : { kind: "candidates", candidates: [] };
      byEdge.set(row.edge_id, link);
      byRecord.set(row.record_id, [...(byRecord.get(row.record_id) ?? []), link]);
    }
    if (link.kind === "candidates" && row.candidate_record_id !== null) {
      link.candidates.push({
        recordId: row.candidate_record_id,
        releaseId: row.candidate_release_id as string,
        lineNo: row.candidate_line_no as number,
        word: row.candidate_word as string,
        pos: row.candidate_pos as string,
        posTitle: row.candidate_pos_title as string,
      });
    }
  }
  return byRecord;
}

/** Each record once, the first time it comes. */
function eachOnce(records: readonly CandidateRecord[]): CandidateRecord[] {
  const seen = new Set<number>();
  return records.filter((record) => !seen.has(record.recordId) && seen.add(record.recordId));
}

const inSourceOrder = (matches: Iterable<Match>): Match[] => [...matches].sort((a, b) => a.record.lineNo - b.record.lineNo);

/**
 * The candidates of a word something spells, as `found` and `candidatesOf`
 * make them: a record the word matched only through its table, and that a
 * record about the word names as its lemma, is that reading's lemma and not a
 * candidate of its own; a record about the word that declares itself a form of
 * another is answered with its lemmas.
 */
function surfaceCandidates(matches: Iterable<Match>, links: ReadonlyMap<number, readonly LightLink[]>): CandidateRecord[] {
  const ordered = inSourceOrder(matches);
  const linksOn = (match: Match): readonly LightLink[] => (match.about ? (links.get(match.record.recordId) ?? []) : []);
  const lemmaIds = new Set(
    ordered.flatMap((match) => linksOn(match).flatMap((link) => (link.kind === "candidates" ? link.candidates.map((lemma) => lemma.recordId) : []))),
  );
  return eachOnce(
    ordered
      .filter((match) => match.about || !lemmaIds.has(match.record.recordId))
      .flatMap((match) => {
        const lemmas = lemmasOfPartOfSpeech(match.record.pos, linksOn(match));
        return lemmas.length === 0 ? [match.record] : lemmas;
      }),
  );
}

/**
 * The words of a batch, each answered as `lookup()` and `candidatesOf` answer
 * it, in a fixed number of statements however many words there are: the
 * release once, then the search, the lemma links and, when some word nothing
 * spells has several words, the multi-word reading.
 */
export async function lookupBatch({
  db,
  releaseId,
  queries,
}: {
  db: LookupDatabase;
  releaseId: string;
  queries: readonly string[];
}): Promise<BatchLookup> {
  const release = await servableRelease(db, releaseId);
  const prepared = queries.map((raw): RejectedResult | QueryInfo => {
    const rejection = rejectionOf(raw);
    return rejection === undefined ? queryInfoOf(raw, release) : { outcome: "rejected", query: { raw }, rejection };
  });
  const keys = [...new Set(prepared.flatMap((query) => ("outcome" in query ? [] : [query.key])))];

  const spelled = await search(db, releaseId, keys);
  const aboutIds = [...new Set([...spelled.values()].flatMap((matches) => [...matches.values()].filter((match) => match.about).map((match) => match.record.recordId)))];

  // A word nothing spells may still be a multi-word headword said the way a
  // speaker says it (#214). Each headword it reaches is a candidate as it is.
  const unspelled = keys.filter((key) => !spelled.has(key));
  const [links, phrases] = await Promise.all([linksOf(db, releaseId, aboutIds), phraseMatchesOf(db, releaseId, unspelled)]);
  const probeKeys = [...new Set([...phrases.values()].flatMap((probes) => probes.map((probe) => probe.key)))];
  const headwords = await search(db, releaseId, probeKeys);

  const candidatesOf = (key: string): CandidateRecord[] => {
    const matches = spelled.get(key);
    if (matches !== undefined) return surfaceCandidates(matches.values(), links);
    const reached = (phrases.get(key) ?? []).flatMap((probe) => {
      const heads = [...(headwords.get(probe.key)?.values() ?? [])].filter((match) => match.about);
      // `phraseMatchesOf` answers only keys some record heads, so there is one.
      if (heads.length === 0) throw new Error(`no headword row for phrase '${probe.key}'`);
      return heads;
    });
    return eachOnce(inSourceOrder(reached).map((match) => match.record));
  };

  const answers = prepared.map((query): BatchAnswer => {
    if ("outcome" in query) return query;
    const [first, ...rest] = candidatesOf(query.key);
    return first === undefined ? { outcome: "not-found", query } : { outcome: "found", query, candidates: [first, ...rest] };
  });
  return { release, answers };
}
