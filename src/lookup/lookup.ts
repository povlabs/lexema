// Exact lookup: one Italian surface in, every reading the source supports out.
// What it returns is in docs/LOOKUP.md; why it is shaped this way, including the
// two mistakes the data invites, is in docs/LOOKUP_DESIGN.md.

import { IT_NORMALIZER_VERSION, normalizeItalianExact } from "../italian/normalize.js";
import { readingPartOfSpeech } from "./articles.js";
import type { LookupDatabase } from "./database.js";
import { readSourceRecord, type SourceRecordFields } from "./sourceRecord.js";
import type {
  Evidence,
  Grammar,
  GrammarClaim,
  InflectionOf,
  LemmaCandidate,
  LemmaLink,
  LemmaListing,
  LookupResult,
  Reading,
  RecoveredDefinition,
  RecoveredRoute,
  ReleaseInfo,
  Review,
  Sense,
  SourceForm,
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

  const hits = await queryAll<HitRow>(db, SEARCH_SQL, releaseId, key);

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

  // A record's forms are read once, whether it becomes a reading, a lemma's
  // listing, or both.
  const tables = new Map<number, Promise<RecordTable>>();
  const tableOf = (group: HitRow[]): Promise<RecordTable> => {
    const recordId = group[0].record_id;
    let table = tables.get(recordId);
    if (table === undefined) {
      table = readTable(db, recordId, refOn(releaseId, group[0]));
      tables.set(recordId, table);
    }
    return table;
  };

  const declared = new Map(
    await Promise.all(
      groups.map(async (group) => {
        const recordId = group[0].record_id;
        return [recordId, await readLemmaLinks(db, releaseId, recordId, refOn(releaseId, group[0]))] as const;
      }),
    ),
  );

  // The lemmas the readings about the query point to. A record the query
  // matched only through its table, and that is one of these, is that
  // reading's lemma rather than a reading of its own: `sale` names `sala` and
  // `salire`, and both list `sale`.
  const lemmaIds = new Set(
    groups
      .filter(isAbout)
      .flatMap((group) => (declared.get(group[0].record_id) ?? []).flatMap(candidateIds)),
  );

  const listingOf = async (recordId: number): Promise<LemmaListing | undefined> => {
    const group = byRecord.get(recordId);
    if (group === undefined) return undefined;
    const [first, ...rest] = evidenceOf(releaseId, group).filter((occurrence) => occurrence.origin === "embedded-form");
    if (first === undefined) return undefined;
    return { forms: (await tableOf(group)).forms, evidence: [first, ...rest] };
  };

  const resolve = (links: DeclaredLink[]): Promise<LemmaLink[]> =>
    Promise.all(
      links.map(async (link): Promise<LemmaLink> => {
        if (link.kind === "dangling") return link;
        const candidates = await Promise.all(
          link.candidates.map(async (candidate) => ({ ...candidate, listing: await listingOf(candidate.recordId) })),
        );
        return { ...link, candidates };
      }),
    );

  const kept = groups.filter((group) => isAbout(group) || !lemmaIds.has(group[0].record_id));
  const build = async (group: HitRow[]): Promise<Reading> =>
    buildReading(db, releaseId, group, await tableOf(group), await resolve(declared.get(group[0].record_id) ?? []));

  // A lemma is only ever taken out on behalf of a reading about the query, so
  // at least one group is kept; the tuple is what `found` requires.
  const [head, ...tail] = kept;
  if (head === undefined) throw new Error("every match was a lemma of no reading");
  const readings: [Reading, ...Reading[]] = await Promise.all([build(head), ...tail.map(build)]);

  return { outcome: "found", query: queryInfo, release, readings };
}

/**
 * Every row that spells the query: headwords, and `forms[]` entries that are
 * spellings of their record.
 *
 * A `forms[]` entry the source tags `auxiliary` is not a spelling. It names the
 * verb a record conjugates with — `andare` lists `essere` — so it is a fact
 * about `andare`, and a hit on it would call 309 other verbs matches for
 * `essere` and 5,267 for `avere` (#109). The entry stays in the record: the
 * forms read below come off `lookup_form` by record, not through this query, so
 * the card still states its auxiliary.
 *
 * The test is the grammar claim the importer already wrote for that tag
 * (`form-role` = `auxiliary`, `src/import/grammarPolicy.ts`), probed per hit
 * through `grammar_claim_by_record`. It reads `lookup_form` rather than the
 * `surface_hit` view because the view does not carry `form_index`, which is
 * how a claim names its form. Exported so a test can assert the plan.
 */
export const SEARCH_SQL = `SELECT r.record_id, r.line_no, r.line_sha256, r.word AS record_word, r.pos AS record_pos,
            lf.origin, lf.json_pointer, lf.form_source, lf.surface,
            (lf.origin = 'headword') AS is_headword_hit
       FROM lookup_form lf
       JOIN source_record r ON r.record_id = lf.record_id
       JOIN source_release rel
         ON rel.release_id = lf.release_id AND rel.status = 'complete'
      WHERE lf.release_id = ? AND lf.surface_key = ?
        AND NOT EXISTS (
              SELECT 1 FROM grammar_claim g
               WHERE g.record_id = lf.record_id
                 AND g.scope = 'form' AND g.scope_index = lf.form_index
                 AND g.status = 'stated'
                 AND g.dimension = 'form-role' AND g.value = 'auxiliary')
      ORDER BY is_headword_hit DESC, r.line_no, lf.json_pointer`;

// --- rows as they come back from SQLite -------------------------------------

interface HitRow {
  record_id: number;
  line_no: number;
  line_sha256: string;
  record_word: string;
  record_pos: string;
  origin: "headword" | "embedded-form";
  json_pointer: string;
  form_source: string | null;
  surface: string;
  is_headword_hit: number;
}

/**
 * The identity of one complete release, or nothing if there is no such release.
 *
 * Exported because the attribution page asks for it on its own, without a
 * query: the release is what that page has to describe, and a lookup nobody
 * asked for is not the way to reach it.
 */
export async function readRelease(
  db: LookupDatabase,
  releaseId: string,
): Promise<ReleaseInfo | undefined> {
  const row = await queryOne<{
    release_id: string;
    normalizer: string;
    source_url: string | null;
    retrieved_at: string | null;
    archive_sha256: string;
    upstream_release: string | null;
    license: string | null;
    attribution: string | null;
  }>(
    db,
    `SELECT release_id, normalizer, source_url, retrieved_at, archive_sha256,
            upstream_release, license, attribution
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
        archiveSha256: row.archive_sha256,
        upstreamRelease: row.upstream_release,
        license: row.license,
        attribution: row.attribution,
      };
}

/** A record's grammar and the forms it lists, which the grammar is keyed into. */
interface RecordTable {
  grammar: Grammar;
  forms: SourceForm[];
}

/** A `form_of` edge as the record declares it, before this lookup's listings are attached. */
type DeclaredLink =
  | { kind: "dangling"; targetWord: string; ref: SourceRef }
  | { kind: "candidates"; targetWord: string; candidates: LemmaCandidate[]; ref: SourceRef };

const isAbout = (group: readonly HitRow[]): boolean => group.some((hit) => hit.origin === "headword");

const candidateIds = (link: DeclaredLink): number[] =>
  link.kind === "candidates" ? link.candidates.map((candidate) => candidate.recordId) : [];

/**
 * Refs on one record. Every value read off it shares the record's release,
 * line and digest, so a ref is the pointer plus those three.
 */
function refOn(releaseId: string, hit: HitRow): (pointer: string) => SourceRef {
  return (pointer) => ({ releaseId, lineNo: hit.line_no, jsonPointer: pointer, lineSha256: hit.line_sha256 });
}

/** Every occurrence of the surface on one record: headword hit first, then the forms table in its own order. */
function evidenceOf(releaseId: string, group: readonly HitRow[]): Evidence[] {
  const ref = refOn(releaseId, group[0]);
  return [...group]
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
}

async function readTable(
  db: LookupDatabase,
  recordId: number,
  ref: (pointer: string) => SourceRef,
): Promise<RecordTable> {
  // Read before the forms: a form's claims are the ones this grouped by index,
  // so the two must be one read rather than two.
  const grammar = await readGrammar(db, recordId, ref);
  return { grammar, forms: await readForms(db, recordId, ref, grammar) };
}

async function buildReading(
  db: LookupDatabase,
  releaseId: string,
  group: HitRow[],
  { grammar, forms }: RecordTable,
  lemmaLinks: LemmaLink[],
): Promise<Reading> {
  const first = group[0];
  const recordId = first.record_id;
  const record = await readRecord(db, recordId);
  const ref = refOn(releaseId, first);
  const source = readSourceRecord(record.rawJson, ref);

  return {
    recordId,
    ref: ref(""),
    word: first.record_word,
    posTitle: record.posTitle,
    wordFacts: source.wordFacts,
    isAboutQuery: isAbout(group),
    evidence: evidenceOf(releaseId, group),
    senses: await readSenses(db, recordId, ref, source),
    forms,
    grammar,
    lemmaLinks,
    inflections: await readInflections(db, releaseId, recordId),
    reviews: await readReviews(db, recordId, ref),
    recovered: await readRecovered(db, recordId),
    // Derived, not read: the release carries no article field. The headword and
    // the grammar the source stated about the record are the only inputs, and a
    // reading that is not a noun comes back carrying no articles at all.
    ...readingPartOfSpeech(first.record_pos, first.record_word, grammar.record, forms),
  };
}

async function readRecord(
  db: LookupDatabase,
  recordId: number,
): Promise<{ posTitle: string; rawJson: string }> {
  // The verbatim line is read here, once per returned reading, and never for a
  // record the query did not match: the table is split off for exactly that.
  const row = await queryOne<{ pos_title: string; raw_json: string }>(
    db,
    `SELECT r.pos_title, j.raw_json
       FROM source_record r
       JOIN source_record_json j ON j.record_id = r.record_id
      WHERE r.record_id = ?`,
    recordId,
  );
  if (row === undefined) throw new Error(`record ${recordId} vanished mid-lookup`);
  return { posTitle: row.pos_title, rawJson: row.raw_json };
}

async function readSenses(
  db: LookupDatabase,
  recordId: number,
  ref: (pointer: string) => SourceRef,
  source: SourceRecordFields,
): Promise<Sense[]> {
  const senses = new Map<number, Sense>();
  const ensure = (index: number, pointer: string): Sense => {
    let sense = senses.get(index);
    if (!sense) {
      sense = {
        index,
        ref: ref(pointer),
        examples: source.examplesBySense.get(index) ?? [],
        glosses: [],
        labels: [],
      };
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

/**
 * The record's own `forms[]` entries. Exported so a test can assert the plan as
 * well as the rows, like the two edge queries below.
 */
export const RECORD_FORM_SQL = `SELECT form_index, surface, json_pointer, form_source
       FROM lookup_form
      WHERE record_id = ? AND origin = 'embedded-form'`;

/**
 * Every form the record lists, in the order the source wrote them.
 *
 * The rows are ordered here rather than in the SQL: `ORDER BY json_pointer`
 * puts `/forms/10` before `/forms/2`, and the grammar a form carries is already
 * grouped by index on `grammar.byForm`, so the two are joined in memory instead
 * of read twice.
 */
async function readForms(
  db: LookupDatabase,
  recordId: number,
  ref: (pointer: string) => SourceRef,
  grammar: Grammar,
): Promise<SourceForm[]> {
  const rows = await queryAll<{
    form_index: number;
    surface: string;
    json_pointer: string;
    form_source: string | null;
  }>(db, RECORD_FORM_SQL, recordId);

  return rows
    .map((row) => ({
      index: row.form_index,
      surface: row.surface,
      ref: ref(row.json_pointer),
      formSource: row.form_source,
      claims: grammar.byForm.get(row.form_index) ?? [],
    }))
    .sort((a, b) => a.index - b.index);
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
    compareSourcePointers(a.ref.jsonPointer, b.ref.jsonPointer);
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
): Promise<DeclaredLink[]> {
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

  const byEdge = new Map<number, DeclaredLink>();
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
  return { releaseId, lineNo, jsonPointer: "/word", lineSha256 };
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

  // One row per declaring *record*, not per edge: `casetta` says it is a form
  // of `casa` on two of its senses, and that is one record pointing here twice,
  // not two records. Every edge's pointer is kept, so nothing about where the
  // claim came from is lost by the collapse.
  const byRecord = new Map<number, InflectionOf>();
  for (const row of rows) {
    // The edge lives on the declaring record, so the ref carries that record's
    // line, not this reading's.
    const edge: SourceRef = {
      releaseId,
      lineNo: row.line_no,
      jsonPointer: row.json_pointer,
      lineSha256: row.line_sha256,
    };
    const existing = byRecord.get(row.record_id);
    if (existing) {
      existing.refs.push(edge);
      continue;
    }
    byRecord.set(row.record_id, {
      recordId: row.record_id,
      word: row.word,
      pos: row.pos,
      refs: [edge],
      targetWord: row.target_word,
      targetCandidates,
    });
  }

  for (const inflection of byRecord.values()) {
    inflection.refs.sort((a, b) => compareSourcePointers(a.jsonPointer, b.jsonPointer));
  }

  return [...byRecord.values()].sort(
    (a, b) =>
      a.refs[0].lineNo - b.refs[0].lineNo ||
      compareSourcePointers(a.refs[0].jsonPointer, b.refs[0].jsonPointer),
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
        compareSourcePointers(a.ref.jsonPointer, b.ref.jsonPointer) ||
        (a.reviewedAt < b.reviewedAt ? -1 : a.reviewedAt > b.reviewedAt ? 1 : 0),
    );
}

/**
 * The recovered layer's definitions for one record, with their labels and
 * examples. Exported so a test can hold the query to its plan.
 */
export const RECOVERED_SQL = `SELECT d.recovered_id, d.route, d.term, d.page_line, d.text, d.held_as_example,
            p.wiki, p.title, p.revision_id
       FROM recovered_definition d
       JOIN raw_page p ON p.page_id = d.page_id
      WHERE d.record_id = ?
      ORDER BY d.definition_index`;

async function readRecovered(db: LookupDatabase, recordId: number): Promise<RecoveredDefinition[]> {
  const rows = await queryAll<{
    recovered_id: number;
    route: RecoveredRoute["route"];
    term: string | null;
    page_line: number;
    text: string;
    held_as_example: number;
    wiki: string;
    title: string;
    revision_id: number;
  }>(db, RECOVERED_SQL, recordId);
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.recovered_id);
  const marks = ids.map(() => "?").join(",");
  const labels = await queryAll<{ recovered_id: number; label: string }>(
    db,
    `SELECT recovered_id, label FROM recovered_label WHERE recovered_id IN (${marks}) ORDER BY recovered_id, label_index`,
    ...ids,
  );
  const examples = await queryAll<{ recovered_id: number; page_line: number; text: string }>(
    db,
    `SELECT recovered_id, page_line, text FROM recovered_example WHERE recovered_id IN (${marks}) ORDER BY recovered_id, example_index`,
    ...ids,
  );

  return rows.map((row) => {
    const at = (line: number) => ({ wiki: row.wiki, title: row.title, revisionId: row.revision_id, line });
    // The schema ties `term` to the sub-term route, so a null here is a
    // database nobody seeded through the schema.
    if (row.route === "sub-term" && row.term === null) throw new Error(`recovered ${row.recovered_id} has no term`);
    const route: RecoveredRoute =
      row.route === "sub-term" ? { route: "sub-term", term: row.term as string } : { route: row.route };
    return {
      ...route,
      text: row.text,
      labels: labels.filter((label) => label.recovered_id === row.recovered_id).map((label) => label.label),
      ref: at(row.page_line),
      examples: examples
        .filter((example) => example.recovered_id === row.recovered_id)
        .map((example) => ({ text: example.text, ref: at(example.page_line) })),
      heldAsExample: row.held_as_example === 1,
    };
  });
}
