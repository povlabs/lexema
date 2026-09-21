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

/**
 * Source order for two RFC 6901 pointers. An array index is a number, so
 * `/forms/2/form` comes before `/forms/10/form` — which is exactly what
 * comparing the two pointers as text reverses. SQLite has no numeric-aware
 * collation for this, so the ordering of anything keyed by a pointer is settled
 * here rather than in an `ORDER BY`.
 */
function compareSourcePointers(a: string, b: string): number {
  const left = a.split("/");
  const right = b.split("/");
  const shared = Math.min(left.length, right.length);

  for (let i = 0; i < shared; i += 1) {
    const one = left[i];
    const other = right[i];
    if (one === other) continue;
    // Both numeric is an array index pair; anything else is an object key, and
    // those have no order but their spelling.
    if (/^\d+$/.test(one) && /^\d+$/.test(other)) return Number(one) - Number(other);
    return one < other ? -1 : 1;
  }

  // `/forms/2` before `/forms/2/form`: the container precedes what it holds.
  return left.length - right.length;
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

  // Group evidence by record. This is the step that keeps five lookup rows from
  // becoming five readings.
  const byRecord = new Map<number, HitRow[]>();
  for (const hit of hits) {
    const existing = byRecord.get(hit.record_id);
    if (existing) existing.push(hit);
    else byRecord.set(hit.record_id, [hit]);
  }

  const groups = [...byRecord.values()]
    // Source order, so the result does not imply a ranking it has not earned.
    .sort((a, b) => a[0].line_no - b[0].line_no);

  if (groups.length === 0) {
    return { outcome: "not-found", query: queryInfo, release };
  }

  // Built as a tuple rather than an array, so the non-empty `readings` a
  // `found` requires is what the construction produces.
  const readings: [Reading, ...Reading[]] = await Promise.all([
    buildReading(db, releaseId, groups[0]),
    ...groups.slice(1).map((group) => buildReading(db, releaseId, group)),
  ]);

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

async function buildReading(db: LookupDatabase, releaseId: string, group: HitRow[]): Promise<Reading> {
  const first = group[0];
  const recordId = first.record_id;
  const record = await readRecord(db, recordId);
  // Every value read off this record shares the record's release, line and
  // digest, so a ref is the pointer plus those three.
  const ref = (pointer: string): SourceRef => ({
    releaseId,
    lineNo: first.line_no,
    pointer,
    lineSha256: record.lineSha256,
  });

  const evidence: Evidence[] = [...group]
    // Headword hit first, then the forms table in its own order.
    .sort(
      (a, b) =>
        b.is_headword_hit - a.is_headword_hit ||
        compareSourcePointers(a.json_pointer, b.json_pointer),
    )
    .map((hit) => ({
      origin: hit.origin,
      surface: hit.surface,
      ref: ref(hit.json_pointer),
      formSource: hit.form_source,
    }));

  return {
    recordId,
    ref: ref(""),
    word: first.record_word,
    pos: first.record_pos,
    posTitle: record.posTitle,
    isAboutQuery: group.some((hit) => hit.origin === "headword"),
    evidence,
    senses: await readSenses(db, recordId, ref),
    grammar: await readGrammar(db, recordId, ref),
    lemmaLinks: await readLemmaLinks(db, releaseId, recordId, ref),
    inflections: await readInflections(db, releaseId, recordId),
    reviews: await readReviews(db, recordId, ref),
  };
}

async function readRecord(
  db: LookupDatabase,
  recordId: number,
): Promise<{ posTitle: string; lineSha256: string }> {
  const row = await queryOne<{ pos_title: string; line_sha256: string }>(
    db,
    `SELECT pos_title, line_sha256 FROM source_record WHERE record_id = ?`,
    recordId,
  );
  if (row === undefined) throw new Error(`record ${recordId} vanished mid-lookup`);
  return { posTitle: row.pos_title, lineSha256: row.line_sha256 };
}

async function readSenses(
  db: LookupDatabase,
  recordId: number,
  ref: (pointer: string) => SourceRef,
): Promise<Sense[]> {
  const senses = new Map<number, Sense>();
  const ensure = (index: number, pointer: string): Sense => {
    let sense = senses.get(index);
    if (!sense) {
      sense = { index, ref: ref(pointer), glosses: [], labels: [] };
      senses.set(index, sense);
    }
    return sense;
  };

  // A sense with no gloss still gets a row, because "this sense exists and says
  // nothing" is a fact worth showing rather than a sense to drop.
  const glossRows = await queryAll<{
    sense_index: number;
    sense_pointer: string;
    text: string | null;
    json_pointer: string | null;
  }>(
    db,
    `SELECT s.sense_index, s.json_pointer AS sense_pointer, g.text, g.json_pointer
       FROM sense s
       LEFT JOIN sense_gloss g ON g.sense_id = s.sense_id
      WHERE s.record_id = ?
      ORDER BY s.sense_index, g.gloss_index`, recordId,
  );

  for (const row of glossRows) {
    const sense = ensure(row.sense_index, row.sense_pointer);
    if (row.text !== null && row.json_pointer !== null) {
      sense.glosses.push({ text: row.text, ref: ref(row.json_pointer) });
    }
  }

  const labelRows = await queryAll<{
    sense_index: number;
    sense_pointer: string;
    kind: "tag" | "raw_tag";
    label: string;
    json_pointer: string;
  }>(
    db,
    `SELECT s.sense_index, s.json_pointer AS sense_pointer, l.kind, l.label, l.json_pointer
       FROM sense s
       JOIN sense_label l ON l.sense_id = s.sense_id
      WHERE s.record_id = ?
      ORDER BY s.sense_index, l.kind, l.label_index`, recordId,
  );

  for (const row of labelRows) {
    ensure(row.sense_index, row.sense_pointer).labels.push({
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

  // The rows arrive ordered by pointer as text, so put each bucket back into
  // the order the source wrote its tags in.
  const byPointer = (a: GrammarClaim, b: GrammarClaim): number =>
    compareSourcePointers(a.ref.pointer, b.ref.pointer);
  grammar.record.sort(byPointer);
  for (const claims of grammar.byForm.values()) claims.sort(byPointer);
  for (const claims of grammar.bySense.values()) claims.sort(byPointer);

  return grammar;
}

/**
 * Exported so a test can assert the plan, not just the rows. Reintroducing the
 * view here costs four orders of magnitude and nothing else changes — exactly
 * the regression a rows-only test sails past. See
 * docs/LOOKUP_DESIGN.md#the-view-that-costs-four-orders-of-magnitude.
 */
export const LEMMA_LINK_SQL = `SELECT e.edge_id, e.json_pointer, e.target_word,
            t.record_id   AS candidate_record_id,
            t.line_no     AS candidate_line_no,
            t.line_sha256 AS candidate_line_sha256,
            t.pos         AS candidate_pos,
            t.word        AS candidate_word
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
  releaseId: string,
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
    candidate_line_sha256: string | null;
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
      word: row.candidate_word as string,
      pos: row.candidate_pos as string,
      // A candidate is a headword record, so its spelling is its own `/word`.
      ref: headwordRef(releaseId, row.candidate_line_no as number, row.candidate_line_sha256 as string),
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
export const INFLECTION_SQL = `SELECT f.record_id, f.line_no, f.line_sha256, f.word, f.pos,
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
export const INFLECTION_CANDIDATE_SQL = `SELECT t.record_id, t.line_no, t.line_sha256, t.word, t.pos
       FROM lookup_form self
       JOIN lookup_form other
         ON other.release_id = self.release_id
        AND other.surface_key = self.surface_key
        AND other.origin = 'headword'
       JOIN source_record t ON t.record_id = other.record_id
      WHERE self.record_id = ? AND self.origin = 'headword'
      ORDER BY t.line_no, t.record_id`;

/** The `/word` field of a headword record, which is where its spelling is. */
function headwordRef(releaseId: string, lineNo: number, lineSha256: string): SourceRef {
  return { releaseId, lineNo, pointer: "/word", lineSha256 };
}

async function readInflections(
  db: LookupDatabase,
  releaseId: string,
  recordId: number,
): Promise<InflectionOf[]> {
  const rows = await queryAll<{
    record_id: number;
    line_no: number;
    line_sha256: string;
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
    line_sha256: string;
    word: string;
    pos: string;
  }>(db, INFLECTION_CANDIDATE_SQL, recordId);

  const targetCandidates = candidates.map((row) => ({
    recordId: row.record_id,
    word: row.word,
    pos: row.pos,
    ref: headwordRef(releaseId, row.line_no, row.line_sha256),
  }));

  return rows
    .map((row) => ({
      recordId: row.record_id,
      word: row.word,
      pos: row.pos,
      // The edge lives on the declaring record, so the ref carries that
      // record's line, not this reading's.
      ref: {
        releaseId,
        lineNo: row.line_no,
        pointer: row.json_pointer,
        lineSha256: row.line_sha256,
      },
      targetWord: row.target_word,
      targetCandidates,
    }))
    .sort(
      (a, b) =>
        a.ref.lineNo - b.ref.lineNo || compareSourcePointers(a.ref.pointer, b.ref.pointer),
    );
}

async function readReviews(
  db: LookupDatabase,
  recordId: number,
  ref: (pointer: string) => SourceRef,
): Promise<Review[]> {
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

  return rows
    .map((row) => ({
      ref: ref(row.json_pointer),
      status: row.status,
      note: row.note,
      evidenceUrl: row.evidence_url,
      reviewedAt: row.reviewed_at,
      reviewedBy: row.reviewed_by,
    }))
    .sort(
      (a, b) =>
        compareSourcePointers(a.ref.pointer, b.ref.pointer) ||
        (a.reviewedAt < b.reviewedAt ? -1 : a.reviewedAt > b.reviewedAt ? 1 : 0),
    );
}
