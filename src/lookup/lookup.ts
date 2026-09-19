// Exact lookup: one Italian surface in, every reading the source supports out.
// What it returns is in docs/LOOKUP.md; why it is shaped this way, including the
// two mistakes the data invites, is in docs/LOOKUP_DESIGN.md.

import { IT_NORMALIZER_VERSION, normalizeItalianExact } from "../italian/normalize.js";
import type { LookupDatabase } from "./database.js";
import type {
  Evidence,
  Grammar,
  GrammarClaim,
  InflectionOf,
  LemmaLink,
  LookupResult,
  Reading,
  ReleaseInfo,
  Review,
  Sense,
  SourceRef,
} from "./types.js";

/** Longest surface we will look up, so a pathological query cannot become a
 * pathological index probe. Well past the longest headword in this release. */
export const MAX_QUERY_LENGTH = 128;

export interface LookupOptions {
  db: LookupDatabase;
  releaseId: string;
  query: string;
}

// Both drivers type columns loosely, so a row shape is asserted here rather
// than at every call site.
function queryAll<T>(db: LookupDatabase, sql: string, ...params: (string | number)[]): Promise<T[]> {
  return db.all<T>(sql, params);
}

// D1 has no `get`, so "one row" is "the first of all rows". The queries that use
// this are all primary-key reads, so there is never more than one.
async function queryOne<T>(db: LookupDatabase, sql: string, ...params: (string | number)[]): Promise<T | undefined> {
  return (await db.all<T>(sql, params))[0];
}

export async function lookup({ db, releaseId, query }: LookupOptions): Promise<LookupResult> {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return { outcome: "rejected", query: { raw: query }, rejection: { reason: "empty" } };
  }
  if (trimmed.length > MAX_QUERY_LENGTH) {
    return {
      outcome: "rejected",
      query: { raw: query },
      rejection: { reason: "too-long", length: trimmed.length, limit: MAX_QUERY_LENGTH },
    };
  }

  const release = await readRelease(db, releaseId);
  if (release === undefined) {
    // A release that is absent, still importing, failed or superseded is not
    // servable, and saying "no results" would be a different, false claim.
    throw new Error(`no complete release '${releaseId}'`);
  }

  // The stored keys were produced by the release's own normalizer, so the query
  // has to go through the same one. A release built by a different normalizer
  // would silently mis-probe the index.
  if (release.normalizer !== IT_NORMALIZER_VERSION) {
    throw new Error(
      `release '${releaseId}' was built with normalizer '${release.normalizer}', this build has '${IT_NORMALIZER_VERSION}'`,
    );
  }
  const key = normalizeItalianExact(trimmed);
  const queryInfo = { raw: query, key, normalizer: release.normalizer };

  const hits = await queryAll<HitRow>(
    db,
    `SELECT record_id, line_no, record_word, record_pos, origin, json_pointer,
            form_source, surface, is_headword_hit
       FROM surface_hit
      WHERE release_id = ? AND surface_key = ?
      ORDER BY is_headword_hit DESC, line_no, json_pointer`,
    releaseId,
    key,
  );

  if (hits.length === 0) {
    return { outcome: "not-found", query: queryInfo, release, readings: [] };
  }

  // Group evidence by record. This is the step that keeps five lookup rows from
  // becoming five readings.
  const byRecord = new Map<number, HitRow[]>();
  for (const hit of hits) {
    const existing = byRecord.get(hit.record_id);
    if (existing) existing.push(hit);
    else byRecord.set(hit.record_id, [hit]);
  }

  const readings = await Promise.all(
    [...byRecord.values()]
      // Source order, so the result does not imply a ranking it has not earned.
      .sort((a, b) => a[0].line_no - b[0].line_no)
      .map((group) => buildReading(db, group)),
  );

  return { outcome: "found", query: queryInfo, release, readings };
}

// --- rows as they come back from SQLite -------------------------------------

interface HitRow {
  record_id: number;
  line_no: number;
  record_word: string;
  record_pos: string;
  origin: "headword" | "embedded-form";
  json_pointer: string;
  form_source: string | null;
  surface: string;
  is_headword_hit: number;
}

async function readRelease(db: LookupDatabase, releaseId: string): Promise<ReleaseInfo | undefined> {
  const row = await queryOne<{
    release_id: string;
    normalizer: string;
    source_url: string | null;
    retrieved_at: string | null;
    license: string | null;
    attribution: string | null;
  }>(
    db,
    `SELECT release_id, normalizer, source_url, retrieved_at, license, attribution
       FROM source_release
      WHERE release_id = ? AND status = 'complete'`,
    releaseId,
  );

  return row === undefined
    ? undefined
    : {
        releaseId: row.release_id,
        normalizer: row.normalizer,
        sourceUrl: row.source_url,
        retrievedAt: row.retrieved_at,
        license: row.license,
        attribution: row.attribution,
      };
}

async function buildReading(db: LookupDatabase, group: HitRow[]): Promise<Reading> {
  const first = group[0];
  const recordId = first.record_id;
  const ref = (pointer: string): SourceRef => ({ lineNo: first.line_no, pointer });

  const evidence: Evidence[] = group.map((hit) => ({
    origin: hit.origin,
    surface: hit.surface,
    pointer: hit.json_pointer,
    formSource: hit.form_source,
  }));

  return {
    recordId,
    lineNo: first.line_no,
    word: first.record_word,
    pos: first.record_pos,
    posTitle: await readPosTitle(db, recordId),
    isAboutQuery: group.some((hit) => hit.origin === "headword"),
    evidence,
    senses: await readSenses(db, recordId, ref),
    grammar: await readGrammar(db, recordId, ref),
    lemmaLinks: await readLemmaLinks(db, recordId, ref),
    inflections: await readInflections(db, recordId),
    reviews: await readReviews(db, recordId),
  };
}

async function readPosTitle(db: LookupDatabase, recordId: number): Promise<string> {
  const row = await queryOne<{ pos_title: string }>(
    db,
    `SELECT pos_title FROM source_record WHERE record_id = ?`,
    recordId,
  );
  if (row === undefined) throw new Error(`record ${recordId} vanished mid-lookup`);
  return row.pos_title;
}

async function readSenses(
  db: LookupDatabase,
  recordId: number,
  ref: (pointer: string) => SourceRef,
): Promise<Sense[]> {
  const senses = new Map<number, Sense>();
  const ensure = (index: number): Sense => {
    let sense = senses.get(index);
    if (!sense) {
      sense = { index, glosses: [], labels: [] };
      senses.set(index, sense);
    }
    return sense;
  };

  // A sense with no gloss still gets a row, because "this sense exists and says
  // nothing" is a fact worth showing rather than a sense to drop.
  const glossRows = await queryAll<{ sense_index: number; text: string | null; json_pointer: string | null }>(
    db,
    `SELECT s.sense_index, g.text, g.json_pointer
       FROM sense s
       LEFT JOIN sense_gloss g ON g.sense_id = s.sense_id
      WHERE s.record_id = ?
      ORDER BY s.sense_index, g.gloss_index`, recordId,
  );

  for (const row of glossRows) {
    const sense = ensure(row.sense_index);
    if (row.text !== null && row.json_pointer !== null) {
      sense.glosses.push({ text: row.text, ref: ref(row.json_pointer) });
    }
  }

  const labelRows = await queryAll<{ sense_index: number; kind: "tag" | "raw_tag"; label: string; json_pointer: string }>(
    db,
    `SELECT s.sense_index, l.kind, l.label, l.json_pointer
       FROM sense s
       JOIN sense_label l ON l.sense_id = s.sense_id
      WHERE s.record_id = ?
      ORDER BY s.sense_index, l.kind, l.label_index`, recordId,
  );

  for (const row of labelRows) {
    ensure(row.sense_index).labels.push({
      kind: row.kind,
      label: row.label,
      ref: ref(row.json_pointer),
    });
  }

  return [...senses.values()].sort((a, b) => a.index - b.index);
}

async function readGrammar(
  db: LookupDatabase,
  recordId: number,
  ref: (pointer: string) => SourceRef,
): Promise<Grammar> {
  const rows = await queryAll<{
    scope: "record" | "sense" | "form";
    scope_index: number | null;
    status: "stated" | "unclassified" | "missing";
    dimension: string | null;
    value: string | null;
    source_text: string | null;
    json_pointer: string;
  }>(
    db,
    `SELECT scope, scope_index, status, dimension, value, source_text, json_pointer
       FROM grammar_claim
      WHERE record_id = ?
      ORDER BY scope, scope_index, json_pointer`, recordId,
  );

  const grammar: Grammar = { record: [], byForm: new Map(), bySense: new Map() };

  for (const row of rows) {
    // The schema's CHECK constraints already guarantee which columns are set for
    // which status, so this narrows without inventing defaults.
    let claim: GrammarClaim;
    if (row.status === "stated") {
      claim = {
        status: "stated",
        dimension: row.dimension as string,
        value: row.value as string,
        sourceText: row.source_text as string,
        ref: ref(row.json_pointer),
      };
    } else if (row.status === "unclassified") {
      claim = {
        status: "unclassified",
        sourceText: row.source_text as string,
        ref: ref(row.json_pointer),
      };
    } else {
      claim = {
        status: "missing",
        dimension: row.dimension as string,
        ref: ref(row.json_pointer),
      };
    }

    if (row.scope === "record") {
      grammar.record.push(claim);
    } else {
      const target = row.scope === "form" ? grammar.byForm : grammar.bySense;
      const index = row.scope_index as number;
      const list = target.get(index);
      if (list) list.push(claim);
      else target.set(index, [claim]);
    }
  }

  return grammar;
}

/**
 * Exported so a test can assert the plan, not just the rows. Reintroducing the
 * view here costs four orders of magnitude and nothing else changes — exactly
 * the regression a rows-only test sails past. See
 * docs/LOOKUP_DESIGN.md#the-view-that-costs-four-orders-of-magnitude.
 */
export const LEMMA_LINK_SQL = `SELECT e.edge_id, e.json_pointer, e.target_word,
            t.record_id AS candidate_record_id,
            t.line_no   AS candidate_line_no,
            t.pos       AS candidate_pos,
            t.word      AS candidate_word
       FROM form_of_edge e
       JOIN source_release rel
         ON rel.release_id = e.release_id AND rel.status = 'complete'
       LEFT JOIN lookup_form lf
         ON lf.release_id = e.release_id
        AND lf.surface_key = e.target_word_key
        AND lf.origin = 'headword'
       LEFT JOIN source_record t ON t.record_id = lf.record_id
      WHERE e.record_id = ?
      ORDER BY e.edge_id, t.line_no`;

async function readLemmaLinks(
  db: LookupDatabase,
  recordId: number,
  ref: (pointer: string) => SourceRef,
): Promise<LemmaLink[]> {
  // LEFT JOIN on purpose: an edge whose target word matches no headword record
  // must still appear. Dropping it would turn "the source points somewhere we
  // cannot follow" into "the source points nowhere".
  const rows = await queryAll<{
    edge_id: number;
    json_pointer: string;
    target_word: string;
    candidate_record_id: number | null;
    candidate_line_no: number | null;
    candidate_pos: string | null;
    candidate_word: string | null;
  }>(
    db,
    LEMMA_LINK_SQL, recordId,
  );

  const byEdge = new Map<number, LemmaLink>();
  for (const row of rows) {
    if (row.candidate_record_id === null) {
      byEdge.set(row.edge_id, {
        kind: "dangling",
        targetWord: row.target_word,
        ref: ref(row.json_pointer),
      });
      continue;
    }
    const existing = byEdge.get(row.edge_id);
    const candidate = {
      recordId: row.candidate_record_id,
      lineNo: row.candidate_line_no as number,
      word: row.candidate_word as string,
      pos: row.candidate_pos as string,
    };
    if (existing !== undefined && existing.kind === "candidates") {
      existing.candidates.push(candidate);
    } else {
      byEdge.set(row.edge_id, {
        kind: "candidates",
        targetWord: row.target_word,
        candidates: [candidate],
        ref: ref(row.json_pointer),
      });
    }
  }

  return [...byEdge.values()];
}

/**
 * Incoming edges: the records that declare themselves forms of the word this
 * record spells. Exported alongside the candidate query below so a test can
 * assert the plan as well as the rows.
 */
export const INFLECTION_SQL = `SELECT f.record_id, f.line_no, f.word, f.pos,
            e.json_pointer, e.target_word
       FROM lookup_form lf
       JOIN source_release rel
         ON rel.release_id = lf.release_id AND rel.status = 'complete'
       JOIN form_of_edge e
         ON e.release_id = lf.release_id AND e.target_word_key = lf.surface_key
       JOIN source_record f ON f.record_id = e.record_id
      WHERE lf.record_id = ? AND lf.origin = 'headword'
      ORDER BY f.line_no, e.json_pointer`;

/**
 * Every headword record spelling what this one spells — itself included. An
 * incoming edge matches on the target word key, so it lands on all of them at
 * once; this is the set the source left unresolved.
 */
export const INFLECTION_CANDIDATE_SQL = `SELECT t.record_id, t.line_no, t.word, t.pos
       FROM lookup_form self
       JOIN lookup_form other
         ON other.release_id = self.release_id
        AND other.surface_key = self.surface_key
        AND other.origin = 'headword'
       JOIN source_record t ON t.record_id = other.record_id
      WHERE self.record_id = ? AND self.origin = 'headword'
      ORDER BY t.line_no, t.record_id`;

async function readInflections(db: LookupDatabase, recordId: number): Promise<InflectionOf[]> {
  const rows = await queryAll<{
    record_id: number;
    line_no: number;
    word: string;
    pos: string;
    json_pointer: string;
    target_word: string;
  }>(db, INFLECTION_SQL, recordId);

  if (rows.length === 0) return [];

  // One extra read, not one per edge: every incoming edge on this record
  // matched the same surface key, so they all resolve to the same candidate set.
  const candidates = await queryAll<{
    record_id: number;
    line_no: number;
    word: string;
    pos: string;
  }>(db, INFLECTION_CANDIDATE_SQL, recordId);

  const targetCandidates = candidates.map((row) => ({
    recordId: row.record_id,
    lineNo: row.line_no,
    word: row.word,
    pos: row.pos,
  }));

  return rows.map((row) => ({
    recordId: row.record_id,
    lineNo: row.line_no,
    word: row.word,
    pos: row.pos,
    pointer: row.json_pointer,
    targetWord: row.target_word,
    targetCandidates,
  }));
}

async function readReviews(db: LookupDatabase, recordId: number): Promise<Review[]> {
  const rows = await queryAll<{
    json_pointer: string;
    status: "disputed" | "corroborated";
    note: string;
    evidence_url: string;
    reviewed_at: string;
    reviewed_by: string;
  }>(
    db,
    `SELECT json_pointer, status, note, evidence_url, reviewed_at, reviewed_by
       FROM claim_review
      WHERE record_id = ?
      ORDER BY json_pointer, reviewed_at`, recordId,
  );

  return rows.map((row) => ({
    pointer: row.json_pointer,
    status: row.status,
    note: row.note,
    evidenceUrl: row.evidence_url,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
  }));
}
