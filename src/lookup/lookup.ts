// Exact lookup: one Italian surface in, every reading the source supports out.
// What it returns is in docs/LOOKUP.md; why it is shaped this way, including the
// two mistakes the data invites, is in docs/LOOKUP_DESIGN.md.

import { IT_NORMALIZER_VERSION, normalizeItalianExact } from "../italian/normalize.js";
import { shownGloss } from "../italian/headwordEcho.js";
import { recordGlosses, type RecordGloss } from "../italian/recovery.js";
import { readPluralGloss, type PluralGlossGender } from "../italian/pluralGloss.js";
import { readingPartOfSpeech } from "./articles.js";
import { keyedRead, readKeys, type DictionaryRead, type KeyedRead, type LookupDatabase } from "./database.js";
import { phraseForms, phraseMatches } from "./phrase.js";
import { pageEntriesOf, type PageEntries } from "./pageEntry.js";
import { readExpressions } from "./expressions.js";
import { placeRecovered, type RecoveredOfRecord, type StoredRecovered } from "./recovered.js";
import { dictionaryTables, lineagesOf, servedBy, type DictionaryTables } from "./served.js";
import { readSourceRecord, type SourceRecordFields } from "./sourceRecord.js";
import { correctionOf, correctionsByRecord, type CorrectionRow } from "./correctedClaim.js";
import { agreeingQuery, essereAgreement } from "../italian/essereAgreement.js";
import { prefixUpperBound } from "./keyRange.js";
import { personOfItalianVerbForm } from "../italian/moods.js";
import { correctRecordClaims, pluralDeclaration, sourcePointerOf, sourceTagsOf } from "./types.js";
import type {
  ArchiveClaim,
  Evidence,
  Expression,
  FoundResult,
  FoundRoute,
  Grammar,
  GrammarClaim,
  InflectionOf,
  LemmaCandidate,
  LemmaLink,
  LemmaListing,
  LemmaTarget,
  LookupResult,
  PhraseMatch,
  PluralDeclaration,
  QueryInfo,
  Reading,
  RecoveredDefinition,
  RecoveredRoute,
  ReleaseDump,
  ReleaseInfo,
  RejectedQuery,
  RejectedResult,
  Review,
  Sense,
  SourceForm,
  SourceRef,
  SourceText,
  StatedClaim,
  UnlistedTable,
} from "./types.js";

/** Longest surface we will look up, so a pathological query cannot become a
 * pathological index probe. Well past the longest headword in this release. */
export const MAX_QUERY_LENGTH = 128;

export interface LookupOptions {
  db: LookupDatabase;
  /**
   * The master the lookup reads: the release the dictionary was seeded from,
   * which names it with every change applied from a later release
   * (src/lookup/served.ts). Each value's own ref names the release it is in.
   */
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
function queryAll<T>(db: LookupDatabase, sql: DictionaryRead, ...params: (string | number)[]): Promise<T[]> {
  return db.all<T>(sql, params);
}

// D1 has no `get`, so "one row" is "the first of all rows". The queries that use
// this are all primary-key reads, so there is never more than one.
async function queryOne<T>(db: LookupDatabase, sql: DictionaryRead, ...params: (string | number)[]): Promise<T | undefined> {
  return (await db.all<T>(sql, params))[0];
}

/** Why a query is not sent to the index, or undefined when it may be: empty, or longer than the bound. */
export function rejectionOf(query: string): RejectedQuery | undefined {
  const trimmed = query.trim();
  if (trimmed.length === 0) return { reason: "empty" };
  if (trimmed.length > MAX_QUERY_LENGTH) return { reason: "too-long", length: trimmed.length, limit: MAX_QUERY_LENGTH };
  return undefined;
}

/** A query that passed every check and names a servable release, with what its probe of the index read. */
interface ProbedQuery<T> {
  outcome: "ready";
  query: QueryInfo;
  release: ReleaseInfo;
  probed: T;
}

/**
 * The checks every probe of the index makes first — a query that is not empty
 * and not too long, a complete release, and that release's own normalizer —
 * and the probe itself. The probe needs only the key, so it is sent beside the
 * release read rather than after it: one wait on the database, not two (#385).
 * Its rows count only once the release has passed; a release that fails
 * throws its own error, whatever the probe answered.
 */
async function probeQuery<T>(
  db: LookupDatabase,
  releaseId: string,
  query: string,
  probe: (key: string) => Promise<T>,
): Promise<RejectedResult | ProbedQuery<T>> {
  const rejection = rejectionOf(query);
  if (rejection !== undefined) return { outcome: "rejected", query: { raw: query }, rejection };
  const probing = probe(keyOf(query));
  // Settled here so a probe that fails while the release check throws is not
  // an unhandled rejection; it is still awaited, and thrown, below.
  probing.catch(() => undefined);
  const release = await servableRelease(db, releaseId);
  return { outcome: "ready", query: queryInfoOf(query, release), release, probed: await probing };
}

/**
 * The release a lookup may probe: complete, and built by this build's own
 * normalizer. A batch of words reads it once (src/lookup/batch.ts).
 */
export async function servableRelease(db: LookupDatabase, releaseId: string): Promise<ReleaseInfo> {
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
  return release;
}

/** A query `rejectionOf` accepts, keyed for the index by the release's normalizer. */
export function queryInfoOf(query: string, release: ReleaseInfo): QueryInfo {
  return { raw: query, key: keyOf(query), normalizer: release.normalizer };
}

/** The index key of a query `rejectionOf` accepts. */
const keyOf = (query: string): string => normalizeItalianExact(query.trim());

/**
 * Whether a lookup of the query would find anything, read without building a
 * reading: the first row of the lookup's own search, so the two never disagree.
 * `word` is that row's record, a headword hit before a form hit, so an answer
 * can credit the page the query was found on.
 */
export type ExistsResult =
  | RejectedResult
  | { outcome: "absent"; query: QueryInfo; release: ReleaseInfo }
  | { outcome: "present"; query: QueryInfo; release: ReleaseInfo; word: string };

export async function exists({ db, releaseId, query }: LookupOptions): Promise<ExistsResult> {
  const [prepared, pages, tables] = await probeWithPages(db, releaseId, query, (key) => queryAll<HitRow>(db, `${SEARCH_SQL}\n      LIMIT 1`, releaseId, key));
  if (prepared.outcome === "rejected") return prepared;
  const [first] = prepared.probed;
  const { key } = prepared.query;
  const word =
    first?.record_word ??
    (await pages.candidates(key))[0]?.word ??
    (await phraseHits(db, releaseId, key))?.hits[0].record_word ??
    (await agreementHits(db, releaseId, key, tables.corrections))?.hits[0].record_word;
  return word === undefined
    ? { outcome: "absent", query: prepared.query, release: prepared.release }
    : { outcome: "present", query: prepared.query, release: prepared.release, word };
}

/**
 * The headword rows of every multi-word headword the query spells word by word
 * (src/lookup/phrase.ts), or undefined when it spells none. Only a record's
 * headword counts: a table entry spelling the phrase is not the phrase.
 */
async function phraseHits(
  db: LookupDatabase,
  releaseId: string,
  key: string,
): Promise<{ hits: [HitRow, ...HitRow[]]; phrases: [PhraseMatch, ...PhraseMatch[]] } | undefined> {
  const probes = await phraseMatches(db, releaseId, key);
  const read = await Promise.all(
    probes.map(async (probe) => {
      const [head, ...others] = (await queryAll<HitRow>(db, SEARCH_SQL, releaseId, probe.key)).filter(
        (row) => row.origin === "headword",
      );
      // `phraseMatches` answers only keys some record heads, so there is a row.
      if (head === undefined) throw new Error(`no headword row for phrase '${probe.key}'`);
      const rows: [HitRow, ...HitRow[]] = [head, ...others];
      return { rows, phrase: { ...probe, word: head.record_word } };
    }),
  );
  const [first, ...rest] = read;
  if (first === undefined) return undefined;
  return {
    hits: [...first.rows, ...rest.flatMap(({ rows }) => rows)],
    phrases: [first.phrase, ...rest.map(({ phrase }) => phrase)],
  };
}

export async function lookup({ db, releaseId, query }: LookupOptions): Promise<LookupResult> {
  const [prepared, pages, tables] = await probeWithPages(db, releaseId, query, (key) => queryAll<HitRow>(db, SEARCH_SQL, releaseId, key));
  if (prepared.outcome === "rejected") return prepared;
  const { release, query: queryInfo, probed: hits } = prepared;
  const { key } = queryInfo;
  // A master seeded before #420 has no `corrected_claim` until
  // `pnpm run update:upgrade` creates it, and a read of a table that is not
  // there would fail every statement batched with it (`fromD1`), so no
  // correction is read where there is none.
  const corrected = tables.corrections;

  const pageReadings = pages.readings(key);
  if (hits.length > 0) {
    const [result, read] = await Promise.all([found(db, releaseId, pages, queryInfo, release, hits, { kind: "surface" }, corrected), pageReadings]);
    return { ...result, readings: [...result.readings, ...read] };
  }
  const [page, ...otherPages] = await pageReadings;
  if (page !== undefined) return { outcome: "found", query: queryInfo, release, route: { kind: "surface" }, readings: [page, ...otherPages] };

  // Nothing spells the query. A query of several words may still be a
  // multi-word headword said the way a speaker says it (#214).
  const phrase = await phraseHits(db, releaseId, key);
  if (phrase !== undefined) {
    const forms = await phraseForms(db, releaseId, phrase.phrases);
    return found(db, releaseId, pages, queryInfo, release, phrase.hits, { kind: "phrase", phrases: phrase.phrases, forms }, corrected);
  }

  // Nor a phrase. It may be the feminine of a compound form the source lists
  // only as the masculine, `sono andata` of `sono andato`, or the first of the
  // spellings one cell holds, `mi sono arreso` of `mi sono arreso, arresosi`
  // (#676).
  const agreement = await agreementHits(db, releaseId, key, corrected);
  if (agreement === undefined) return { outcome: "not-found", query: queryInfo, release };
  return found(db, releaseId, pages, queryInfo, release, agreement.hits, agreement.route, corrected, agreement.tables);
}

/**
 * The rows of a query rule `it-essere-agreement/v1` reads as an agreeing first
 * spelling (#676), and the route that says how. A feminine is read as its
 * masculine, `sono andata` as `sono andato`, and that key is probed. When it
 * finds no cell, or the query was typed as the masculine and so already found
 * nothing, the cells whose spelling starts with the masculine and `, ` are read
 * in one range: `mi sono arresa` and `mi sono arreso` both reach `mi sono
 * arreso, arresosi`. A row is kept only where it is a verb's `forms[]` cell, on
 * a row of the query's number, whose first spelling is the masculine and
 * agrees there. The tables read to place each cell come back with the rows, so
 * `found` reads none twice. Undefined when no cell is kept. Nothing is sent
 * for a query without the rule's shape (`casa`, `ho mangiata`, `sono andat`).
 */
async function agreementHits(
  db: LookupDatabase,
  releaseId: string,
  key: string,
  corrected: boolean,
): Promise<{ hits: [HitRow, ...HitRow[]]; route: FoundRoute; tables: ReadonlyMap<number, Promise<RecordTable>> } | undefined> {
  const query = agreeingQuery(key);
  if (query === undefined) return undefined;
  const { spelling } = query;
  const tables = new Map<number, Promise<RecordTable>>();
  const agreeing = async (rows: readonly HitRow[]): Promise<HitRow[]> => {
    const cells = rows.filter((row) => row.origin === "embedded-form" && row.record_pos === "verb");
    for (const row of cells) {
      if (!tables.has(row.record_id)) tables.set(row.record_id, handled(readTable(db, row.record_id, refOn(row), corrected)));
    }
    const kept = await Promise.all(
      cells.map(async (row) => {
        const form = (await tables.get(row.record_id))?.forms.find((one) => sourcePointerOf(one.ref) === row.json_pointer);
        const place = form === undefined ? undefined : personOfItalianVerbForm(sourceTagsOf(form));
        if (place?.number !== spelling.number) return false;
        const read = essereAgreement(row.surface, place.number);
        return read.kind === "agrees" && normalizeItalianExact(read.spelling.first) === spelling.first;
      }),
    );
    return cells.filter((_, i) => kept[i]);
  };
  const exact = query.spelled === "feminine" ? await agreeing(await queryAll<HitRow>(db, SEARCH_SQL, releaseId, spelling.first)) : [];
  const prefix = `${spelling.first}, `;
  const [first, ...rest] =
    exact.length > 0 ? exact : await agreeing(await queryAll<HitRow>(db, FIRST_SPELLING_SQL, releaseId, prefix, prefixUpperBound(prefix)));
  if (first === undefined) return undefined;
  const route: FoundRoute =
    query.spelled === "feminine" ? { kind: "feminine", agreement: spelling } : { kind: "first-spelling", agreement: spelling };
  return { hits: [first, ...rest], route, tables };
}

/**
 * `probeQuery`, the dictionary's page-only entries, and which optional tables
 * it has. The schema read is sent beside the probe and the release read, so on
 * D1 all three go in one batch and the check costs a statement, not a round trip.
 */
async function probeWithPages<T>(
  db: LookupDatabase,
  releaseId: string,
  query: string,
  probe: (key: string) => Promise<T>,
): Promise<[RejectedResult | ProbedQuery<T>, PageEntries, DictionaryTables]> {
  const [prepared, tables] = await Promise.all([probeQuery(db, releaseId, query, probe), dictionaryTables(db)]);
  return [prepared, pageEntriesOf(db, releaseId, tables), tables];
}

/** The readings of a probe that matched, and how the query reached them. */
async function found(
  db: LookupDatabase,
  releaseId: string,
  pages: PageEntries,
  queryInfo: QueryInfo,
  release: ReleaseInfo,
  hits: readonly HitRow[],
  route: FoundRoute,
  corrected: boolean,
  /** Record tables already read for these hits, so none is read again. */
  read: ReadonlyMap<number, Promise<RecordTable>> = new Map(),
): Promise<FoundResult> {
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

  // Every record's forms are read now, beside its lemma links: a record kept
  // as a reading shows them, and a record taken out as a reading's lemma is
  // listed by them, so none is read for nothing (#385).
  const tables = new Map(
    groups.map(
      (group) => [group[0].record_id, read.get(group[0].record_id) ?? handled(readTable(db, group[0].record_id, refOn(group[0]), corrected))] as const,
    ),
  );
  const tableOf = (group: readonly HitRow[]): Promise<RecordTable> => {
    const table = tables.get(group[0].record_id);
    if (table === undefined) throw new Error(`record ${group[0].record_id} matched nothing this lookup grouped`);
    return table;
  };

  // A record's verbatim line, read once whether it is a reading, a lemma a
  // link names, or both. Every matched record is one or the other, so each
  // line is read now, beside the links (#393).
  const records = new Map<number, Promise<RecordLine>>();
  const recordOf = (recordId: number): Promise<RecordLine> => {
    let record = records.get(recordId);
    if (record === undefined) {
      record = handled(readRecord(db, recordId));
      records.set(recordId, record);
    }
    return record;
  };
  for (const group of groups) recordOf(group[0].record_id);

  // A reading's own reads, started once. A reading about the query is always
  // kept, so its reads go out now, beside the links; so does every reading of
  // a lookup with no reading about the query, which takes no record out. Only
  // a record the query reached through its table alone, beside a reading
  // about the query, waits for the links that say whether it is that
  // reading's lemma (#393).
  const reads = new Map<number, ReadingReads>();
  const readsOf = (group: readonly HitRow[]): ReadingReads => {
    const recordId = group[0].record_id;
    let started = reads.get(recordId);
    if (started === undefined) {
      started = startReadingReads(db, releaseId, group[0], corrected, recordOf(recordId));
      reads.set(recordId, started);
    }
    return started;
  };
  const anyAbout = groups.some(isAbout);
  for (const group of groups) if (isAbout(group) || !anyAbout) readsOf(group);

  // The lines of the lemmas each record's links name, read beside the links,
  // so a lemma's expressions wait on nothing the links wait on.
  const lemmaLines = handled(readLemmaLines(db, releaseId, groups.map((group) => group[0].record_id)));
  const declared = new Map(
    await Promise.all(
      groups.map(async (group) => {
        const recordId = group[0].record_id;
        return [recordId, await readLemmaLinks(db, releaseId, recordId, refOn(group[0]))] as const;
      }),
    ),
  );
  for (const [recordId, line] of await lemmaLines) if (!records.has(recordId)) records.set(recordId, Promise.resolve(line));

  // The lemmas the readings about the query point to. A record the query
  // matched only through its table, and that is one of these, is that
  // reading's lemma rather than a reading of its own: `sale` names `sala` and
  // `salire`, and both list `sale`.
  const lemmaIds = new Set(
    groups
      .filter(isAbout)
      .flatMap((group) => (declared.get(group[0].record_id) ?? []).flatMap(candidateIds)),
  );

  /** Where a record's table spells the query, known from the hits alone, before its table is read. */
  const listedAt = (recordId: number): { group: HitRow[]; evidence: [Evidence, ...Evidence[]] } | undefined => {
    const group = byRecord.get(recordId);
    if (group === undefined) return undefined;
    const [first, ...rest] = evidenceOf(group).filter((occurrence) => occurrence.origin === "embedded-form");
    return first === undefined ? undefined : { group, evidence: [first, ...rest] };
  };
  const listingOf = async ({ group, evidence }: { group: HitRow[]; evidence: [Evidence, ...Evidence[]] }): Promise<LemmaListing> => ({
    forms: (await tableOf(group)).forms,
    evidence,
  });

  // A lemma's own expressions, read once per record however many links name it.
  const lemmaExpressions = new Map<number, Promise<Expression[]>>();
  const expressionsOf = (candidate: LemmaCandidate): Promise<Expression[]> => {
    if (candidate.recordId === undefined) return Promise.resolve([]);
    let expressions = lemmaExpressions.get(candidate.recordId);
    if (expressions === undefined) {
      expressions = readRecordExpressions(db, releaseId, recordOf(candidate.recordId), (pointer) => ({ ...candidate.ref, jsonPointer: pointer }));
      lemmaExpressions.set(candidate.recordId, expressions);
    }
    return expressions;
  };

  // A verb's whole table, read once per record, for a verb form about the
  // query that names it when its table lists nothing the query hit (`andare`
  // for `andati`, #666). Only then: a verb whose table lists the query came
  // with the lookup, so `andavano` reads nothing more.
  const unlistedTables = new Map<number, Promise<UnlistedTable | undefined>>();
  const unlistedOf = (candidate: LemmaCandidate & { recordId: number }): Promise<UnlistedTable | undefined> => {
    let table = unlistedTables.get(candidate.recordId);
    if (table === undefined) {
      const ref = (pointer: string): SourceRef => ({ ...candidate.ref, jsonPointer: pointer });
      table = handled(readTable(db, candidate.recordId, ref, corrected)).then(({ forms: [first, ...rest] }) =>
        first === undefined ? undefined : { forms: [first, ...rest] },
      );
      unlistedTables.set(candidate.recordId, table);
    }
    return table;
  };

  const resolve = (links: DeclaredLink[], verbForm: boolean): Promise<LemmaLink[]> =>
    Promise.all(
      links.map(async (link): Promise<LemmaLink> => {
        if (link.kind === "dangling") {
          const entries = await pages.candidates(link.targetWord);
          if (entries.length === 0) return link;
          return { ...link, kind: "candidates", candidates: entries.map((entry) => ({ ...entry, listing: undefined, expressions: [] })) };
        }
        const candidates = await Promise.all(
          link.candidates.map(async (candidate): Promise<LemmaTarget> => {
            const { recordId } = candidate;
            const listed = recordId === undefined ? undefined : listedAt(recordId);
            if (listed !== undefined) {
              const [listing, expressions] = await Promise.all([listingOf(listed), expressionsOf(candidate)]);
              return { ...candidate, listing, expressions };
            }
            const [unlisted, expressions] = await Promise.all([
              verbForm && recordId !== undefined && candidate.pos === "verb" ? unlistedOf({ ...candidate, recordId }) : undefined,
              expressionsOf(candidate),
            ]);
            return unlisted === undefined ? { ...candidate, listing: undefined, expressions } : { ...candidate, listing: undefined, expressions, unlisted };
          }),
        );
        return { ...link, candidates };
      }),
    );

  const kept = groups.filter((group) => isAbout(group) || !lemmaIds.has(group[0].record_id));
  const build = (group: HitRow[]): Promise<Reading> =>
    buildReading(db, releaseId, group, {
      table: tableOf(group),
      record: recordOf(group[0].record_id),
      lemmaLinks: resolve(declared.get(group[0].record_id) ?? [], isAbout(group) && group[0].record_pos === "verb"),
      reads: readsOf(group),
    });

  // A lemma is only ever taken out on behalf of a reading about the query, so
  // at least one group is kept; the tuple is what `found` requires.
  const [head, ...tail] = kept;
  if (head === undefined) throw new Error("every match was a lemma of no reading");
  const readings: [Reading, ...Reading[]] = await Promise.all([build(head), ...tail.map(build)]);

  return { outcome: "found", query: queryInfo, release, route, readings };
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
export const SEARCH_SQL: DictionaryRead = searchWhere("lf.surface_key = ?2");

/**
 * The rows of every cell whose spelling starts with `?2`, read in one range of
 * `lookup_form_by_key`: `surface_key >= ?2 AND surface_key < ?3`, the bounds
 * `prefixUpperBound` gives. The first-spelling probe of rule
 * `it-essere-agreement/v1` (#676) sends `mi sono arreso, ` to reach the cell
 * `mi sono arreso, arresosi`. Exported so a test can assert the plan.
 */
export const FIRST_SPELLING_SQL: DictionaryRead = searchWhere("lf.surface_key >= ?2 AND lf.surface_key < ?3");

/** `SEARCH_SQL`'s read, over the keys `keys` names. */
function searchWhere(keys: string): DictionaryRead {
  return `SELECT r.record_id, r.release_id, r.line_no, r.line_sha256, r.word AS record_word, r.pos AS record_pos,
            lf.origin, lf.json_pointer, lf.form_source, lf.surface,
            (lf.origin = 'headword') AS is_headword_hit
       FROM lookup_form lf
       JOIN source_record r ON r.record_id = lf.record_id
      WHERE lf.release_id IN (${servedBy("?1")}) AND ${keys}
        AND NOT EXISTS (
              SELECT 1 FROM grammar_claim g
               WHERE g.record_id = lf.record_id
                 AND g.scope = 'form' AND g.scope_index = lf.form_index
                 AND g.status = 'stated'
                 AND g.dimension = 'form-role' AND g.value = 'auxiliary')
      ORDER BY is_headword_hit DESC, r.line_no, lf.json_pointer`;
}

// --- rows as they come back from SQLite -------------------------------------

interface HitRow {
  record_id: number;
  /** The record's own release, which `line_no` counts in: the master's, or a feed's. */
  release_id: string;
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
    upstream_release_basis: "recorded" | "inferred" | null;
    license: string | null;
    attribution: string | null;
  }>(
    db,
    `SELECT release_id, normalizer, source_url, retrieved_at, archive_sha256,
            upstream_release, upstream_release_basis, license, attribution
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
        dump: releaseDump(row),
        license: row.license,
        attribution: row.attribution,
      };
}

/**
 * The dump columns as one value. The schema's checks make a dump without its
 * basis, or an id that is not `itwiktionary-YYYYMMDD`, impossible, so the date
 * and the dump's Wikimedia page are read off the id.
 */
function releaseDump(row: {
  upstream_release: string | null;
  upstream_release_basis: "recorded" | "inferred" | null;
}): ReleaseDump | null {
  const { upstream_release: id, upstream_release_basis: basis } = row;
  if (id === null) return null;
  if (basis === null) throw new Error(`source_release names dump '${id}' without its basis`);
  const digits = id.slice(-8);
  return {
    id,
    date: `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`,
    url: `https://dumps.wikimedia.org/itwiktionary/${digits}/`,
    basis,
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
  link.kind === "candidates" ? link.candidates.flatMap((candidate) => candidate.recordId ?? []) : [];

/**
 * Refs on one record. Every value read off it shares the record's release,
 * line and digest, so a ref is the pointer plus those three. The release is
 * the record's own, which in a master with changes applied is not always the
 * one the lookup was asked for.
 */
function refOn(record: { release_id: string; line_no: number; line_sha256: string }): (pointer: string) => SourceRef {
  return (pointer) => ({ releaseId: record.release_id, lineNo: record.line_no, jsonPointer: pointer, lineSha256: record.line_sha256 });
}

/** Every occurrence of the surface on one record: headword hit first, then the forms table in its own order. */
function evidenceOf(group: readonly HitRow[]): Evidence[] {
  const ref = refOn(group[0]);
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
  corrected: boolean,
): Promise<RecordTable> {
  // A form's claims are the ones the grammar groups by index, so the grammar is
  // one read joined to the forms here, not read again per form. Neither read
  // needs the other's rows, so both are sent at once.
  const [grammar, forms] = await Promise.all([readGrammar(db, recordId, ref, corrected), readFormRows(db, recordId)]);
  return { grammar, forms: formsOf(forms, ref, grammar) };
}

/** A promise, marked handled: it is awaited later, and a lookup that fails before then must not also leave it unhandled. */
function handled<T>(promise: Promise<T>): Promise<T> {
  promise.catch(() => undefined);
  return promise;
}

/** The reads of one reading that need only its record: started as soon as the lookup knows the reading is kept. */
interface ReadingReads {
  recovered: Promise<RecoveredOfRecord>;
  senseRows: Promise<SenseRows>;
  inflections: Promise<InflectionOf[]>;
  reviews: Promise<Review[]>;
}

function startReadingReads(
  db: LookupDatabase,
  releaseId: string,
  first: HitRow,
  corrected: boolean,
  record: Promise<RecordLine>,
): ReadingReads {
  return {
    recovered: handled(readRecovered(db, first.record_id, record)),
    senseRows: handled(readSenseRows(db, first.record_id)),
    inflections: handled(readInflections(db, releaseId, first.record_id, first.record_word, corrected)),
    reviews: handled(readReviews(db, first.record_id)),
  };
}

/** The reads one reading is built from that the lookup started before it. */
interface ReadingInputs {
  table: Promise<RecordTable>;
  record: Promise<RecordLine>;
  lemmaLinks: Promise<LemmaLink[]>;
  reads: ReadingReads;
}

async function buildReading(
  db: LookupDatabase,
  releaseId: string,
  group: HitRow[],
  inputs: ReadingInputs,
): Promise<Reading> {
  const first = group[0];
  const recordId = first.record_id;
  const ref = refOn(first);
  // Each read waits only on the ones it needs, and the rest go to the database
  // together: on D1 every wait is a network round trip (#385).
  const source = inputs.record.then((record) => readSourceRecord(record.rawJson, ref));
  const [{ grammar, forms }, lemmaLinks, record, fields, expressions, recovered, senseRows, inflections, reviews] =
    await Promise.all([
      inputs.table,
      inputs.lemmaLinks,
      inputs.record,
      source,
      source.then((fields) => readExpressions(db, releaseId, fields.expressionItems)),
      inputs.reads.recovered,
      inputs.reads.senseRows,
      inputs.reads.inflections,
      inputs.reads.reviews,
    ]);

  return {
    recordId,
    ref: ref(""),
    word: first.record_word,
    posTitle: record.posTitle,
    wordFacts: { ...fields.wordFacts, expressions },
    isAboutQuery: isAbout(group),
    evidence: evidenceOf(group),
    senses: sensesOf(senseRows, first.record_word, ref, fields, recovered.underSense),
    forms,
    grammar,
    lemmaLinks,
    inflections,
    reviews,
    recovered: recovered.topLevel,
    // Derived, not read: the release carries no article field. The headword, the
    // grammar the source stated about the record and the record's own IPA are
    // the only inputs, and a reading that is not a noun comes back carrying no
    // articles at all.
    ...readingPartOfSpeech(first.record_pos, first.record_word, grammar.record, forms, fields.wordFacts.pronunciations),
  };
}

/** A record's expressions, off its own archive line: a lemma's, which is not a reading. */
async function readRecordExpressions(
  db: LookupDatabase,
  releaseId: string,
  record: Promise<RecordLine>,
  ref: (pointer: string) => SourceRef,
): Promise<Expression[]> {
  return readExpressions(db, releaseId, readSourceRecord((await record).rawJson, ref).expressionItems);
}

/** A record's section title and its verbatim archive line. */
interface RecordLine {
  posTitle: string;
  rawJson: string;
}

/**
 * Records' section titles and verbatim lines. The line is read once per record
 * that is a returned reading or a lemma a reading names (for its expressions,
 * #213), and never for any other record: the table is split off for exactly that.
 */
export const RECORD_LINE_SQL: KeyedRead = keyedRead(`SELECT r.record_id AS set_key, r.pos_title, j.raw_json
       FROM source_record r
       JOIN source_record_json j ON j.record_id = r.record_id
      WHERE r.record_id IN (SELECT value FROM json_each(?1))`);

async function readRecord(db: LookupDatabase, recordId: number): Promise<RecordLine> {
  const [row] = await readKeys<{ pos_title: string; raw_json: string }>(db, RECORD_LINE_SQL, [recordId]);
  if (row === undefined) throw new Error(`record ${recordId} vanished mid-lookup`);
  return { posTitle: row.pos_title, rawJson: row.raw_json };
}

/**
 * The lines of every headword record the `form_of` edges of the records bound
 * at `?1` name: the candidates `LEMMA_LINK_SQL` reads, each once per record
 * that names it, however many of its edges do. Read beside the links, so a
 * lemma's expressions are one wait after them, not two (#393).
 */
export const LEMMA_LINE_SQL: KeyedRead = keyedRead(`SELECT c.set_key AS set_key, c.record_id, r.pos_title, j.raw_json
       FROM (SELECT DISTINCT e.record_id AS set_key, lf.record_id
               FROM form_of_edge e
               JOIN lookup_form lf
                 ON lf.release_id IN (${servedBy("?2")})
                AND lf.surface_key = e.target_word_key
                AND lf.origin = 'headword'
              WHERE e.record_id IN (SELECT value FROM json_each(?1)) AND e.release_id IN (${servedBy("?2")})) c
       JOIN source_record r ON r.record_id = c.record_id
       JOIN source_record_json j ON j.record_id = c.record_id`);

/** The lines of the lemmas the links of `recordIds` name, by lemma record. */
async function readLemmaLines(db: LookupDatabase, releaseId: string, recordIds: readonly number[]): Promise<Map<number, RecordLine>> {
  const rows = await readKeys<{ record_id: number; pos_title: string; raw_json: string }>(db, LEMMA_LINE_SQL, recordIds, [releaseId]);
  return new Map(rows.map((row) => [row.record_id, { posTitle: row.pos_title, rawJson: row.raw_json }]));
}

/** A record's senses as the database holds them: each gloss, and each label. */
interface SenseRows {
  glosses: { sense_index: number; sense_pointer: string; text: string | null; json_pointer: string | null }[];
  labels: { sense_index: number; sense_pointer: string; kind: "tag" | "raw_tag"; label: string; json_pointer: string }[];
}

/**
 * A record's glosses. A sense with no gloss still gets a row, because "this
 * sense exists and says nothing" is a fact worth showing rather than a sense
 * to drop.
 */
export const SENSE_GLOSS_SQL: KeyedRead = keyedRead(`SELECT s.record_id AS set_key, s.sense_index, s.json_pointer AS sense_pointer, g.text, g.json_pointer
       FROM sense s
       LEFT JOIN sense_gloss g ON g.sense_id = s.sense_id
      WHERE s.record_id IN (SELECT value FROM json_each(?1))
      ORDER BY s.record_id, s.sense_index, g.gloss_index`);

/** A record's sense labels. */
export const SENSE_LABEL_SQL: KeyedRead = keyedRead(`SELECT s.record_id AS set_key, s.sense_index, s.json_pointer AS sense_pointer, l.kind, l.label, l.json_pointer
       FROM sense s
       JOIN sense_label l ON l.sense_id = s.sense_id
      WHERE s.record_id IN (SELECT value FROM json_each(?1))
      ORDER BY s.record_id, s.sense_index, l.kind, l.label_index`);

/** Both reads of a record's senses, sent at once: neither needs the other's rows. */
async function readSenseRows(db: LookupDatabase, recordId: number): Promise<SenseRows> {
  const [glosses, labels] = await Promise.all([
    readKeys<SenseRows["glosses"][number]>(db, SENSE_GLOSS_SQL, [recordId]),
    readKeys<SenseRows["labels"][number]>(db, SENSE_LABEL_SQL, [recordId]),
  ]);
  return { glosses, labels };
}

/** A record's senses, built from its rows, its headword, its archive line and its recovered items. */
function sensesOf(
  rows: SenseRows,
  word: string,
  ref: (pointer: string) => SourceRef,
  source: SourceRecordFields,
  recoveredItems: ReadonlyMap<number, RecoveredDefinition[]>,
): Sense[] {
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
        recoveredItems: recoveredItems.get(index) ?? [],
      };
      senses.set(index, sense);
    }
    return sense;
  };

  // Wikizionario's "definizione mancante; se vuoi, aggiungila tu" is a template,
  // not a gloss (#255), and a gloss that only repeats the headword (`presina`)
  // says nothing (#395): a gloss that is only one of those is no gloss, so its
  // sense reads as one that says nothing.
  for (const row of rows.glosses) {
    const sense = ensure(row.sense_index, row.sense_pointer);
    const text = row.text === null ? undefined : shownGloss(row.text, word);
    if (text !== undefined && row.json_pointer !== null) {
      sense.glosses.push({ text, ref: ref(row.json_pointer) });
    }
  }

  for (const row of rows.labels) {
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
export const RECORD_FORM_SQL: KeyedRead = keyedRead(`SELECT record_id AS set_key, form_index, surface, json_pointer, form_source
       FROM lookup_form
      WHERE record_id IN (SELECT value FROM json_each(?1)) AND origin = 'embedded-form'`);

/** One of the record's own `forms[]` entries, as `RECORD_FORM_SQL` returns it. */
interface FormRow {
  form_index: number;
  surface: string;
  json_pointer: string;
  form_source: string | null;
}

const readFormRows = (db: LookupDatabase, recordId: number): Promise<FormRow[]> => readKeys<FormRow>(db, RECORD_FORM_SQL, [recordId]);

/**
 * Every form the record lists, in the order the source wrote them.
 *
 * The rows are ordered here rather than in the SQL: `ORDER BY json_pointer`
 * puts `/forms/10` before `/forms/2`, and the grammar a form carries is already
 * grouped by index on `grammar.byForm`, so the two are joined in memory instead
 * of read twice.
 */
function formsOf(rows: readonly FormRow[], ref: (pointer: string) => SourceRef, grammar: Grammar): SourceForm[] {
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

/**
 * A record's curated corrections (#420), read for that record alone. Unlike the
 * rows `lineageOf` reads, a correction does not pass to a record that replaced
 * it: the newer source may state the fact differently, and the update reports
 * the correction instead (src/update/apply.ts). Exported so a test can assert the
 * plan: `readGrammar` runs it once per record.
 */
export const CORRECTED_CLAIM_SQL: KeyedRead = keyedRead(`SELECT record_id AS set_key, record_id, dimension, value, correction_id, evidence_url
       FROM corrected_claim
      WHERE record_id IN (SELECT value FROM json_each(?1))
      ORDER BY record_id, dimension`);

/** A record's grammar claims, of every scope. */
export const GRAMMAR_CLAIM_SQL: KeyedRead = keyedRead(`SELECT record_id AS set_key, scope, scope_index, status, dimension, value, source_text, json_pointer
       FROM grammar_claim
      WHERE record_id IN (SELECT value FROM json_each(?1))
      ORDER BY record_id, scope, scope_index, json_pointer`);

async function readGrammar(
  db: LookupDatabase,
  recordId: number,
  ref: (pointer: string) => SourceRef,
  corrected: boolean,
): Promise<Grammar> {
  const corrections = handled(corrected ? readKeys<CorrectionRow>(db, CORRECTED_CLAIM_SQL, [recordId]) : Promise.resolve([]));
  const rows = await readKeys<{
    scope: "record" | "sense" | "form";
    scope_index: number | null;
    status: "stated" | "unclassified" | "missing";
    dimension: string | null;
    value: string | null;
    source_text: string | null;
    json_pointer: string;
  }>(db, GRAMMAR_CLAIM_SQL, [recordId]);

  const grammar: { record: ArchiveClaim[]; byForm: Map<number, ArchiveClaim[]>; bySense: Map<number, ArchiveClaim[]> } = {
    record: [],
    byForm: new Map(),
    bySense: new Map(),
  };

  for (const row of rows) {
    // The schema's CHECK constraints already guarantee which columns are set for
    // which status, so this narrows without inventing defaults.
    let claim: ArchiveClaim;
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
  const byPointer = (a: ArchiveClaim, b: ArchiveClaim): number =>
    compareSourcePointers(a.ref.jsonPointer, b.ref.jsonPointer);
  grammar.record.sort(byPointer);
  for (const claims of grammar.byForm.values()) claims.sort(byPointer);
  for (const claims of grammar.bySense.values()) claims.sort(byPointer);

  return { ...grammar, record: correctRecordClaims(grammar.record, (await corrections).map(correctionOf)) };
}

/**
 * Exported so a test can assert the plan, not just the rows. Reintroducing the
 * view here costs four orders of magnitude and nothing else changes — exactly
 * the regression a rows-only test sails past. See
 * docs/LOOKUP_DESIGN.md#the-view-that-costs-four-orders-of-magnitude.
 */
export const LEMMA_LINK_SQL: KeyedRead = keyedRead(`SELECT e.record_id AS set_key, e.edge_id, e.json_pointer, e.target_word,
            t.record_id   AS candidate_record_id,
            t.release_id  AS candidate_release_id,
            t.line_no     AS candidate_line_no,
            t.line_sha256 AS candidate_line_sha256,
            t.pos         AS candidate_pos,
            t.word        AS candidate_word
       FROM form_of_edge e
       LEFT JOIN lookup_form lf
         ON lf.release_id IN (${servedBy("?2")})
        AND lf.surface_key = e.target_word_key
        AND lf.origin = 'headword'
       LEFT JOIN source_record t ON t.record_id = lf.record_id
      WHERE e.record_id IN (SELECT value FROM json_each(?1)) AND e.release_id IN (${servedBy("?2")})
      ORDER BY e.edge_id, t.line_no`);

async function readLemmaLinks(
  db: LookupDatabase,
  releaseId: string,
  recordId: number,
  ref: (pointer: string) => SourceRef,
): Promise<DeclaredLink[]> {
  // LEFT JOIN on purpose: an edge whose target word matches no headword record
  // must still appear. Dropping it would turn "the source points somewhere we
  // cannot follow" into "the source points nowhere".
  const rows = await readKeys<{
    edge_id: number;
    json_pointer: string;
    target_word: string;
    candidate_record_id: number | null;
    candidate_release_id: string | null;
    candidate_line_no: number | null;
    candidate_line_sha256: string | null;
    candidate_pos: string | null;
    candidate_word: string | null;
  }>(db, LEMMA_LINK_SQL, [recordId], [releaseId]);

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
      ref: headwordRef(row.candidate_release_id as string, row.candidate_line_no as number, row.candidate_line_sha256 as string),
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
 *
 * Both queries start from this record's headword row, and `CROSS JOIN` is what
 * holds them there: it is SQLite's way to fix the join order. Left free, the
 * planner starts from the `servedBy` list instead and walks every row of the
 * release on the `release_id` prefix alone, about two million rows per record
 * on `it-0c432803` (#381).
 */
export const INFLECTION_SQL: KeyedRead = keyedRead(`SELECT lf.record_id AS set_key, f.record_id, f.release_id, f.line_no, f.line_sha256, f.word, f.pos,
            e.json_pointer, e.target_word, g.text AS gloss, g.json_pointer AS gloss_pointer
       FROM lookup_form lf
       CROSS JOIN form_of_edge e
         ON e.release_id IN (${servedBy("?2")}) AND e.target_word_key = lf.surface_key
       JOIN source_record f ON f.record_id = e.record_id
       LEFT JOIN sense s ON s.record_id = e.record_id AND s.sense_index = e.sense_index
       LEFT JOIN sense_gloss g ON g.sense_id = s.sense_id AND g.gloss_index = 0
      WHERE lf.record_id IN (SELECT value FROM json_each(?1)) AND lf.origin = 'headword' AND lf.release_id IN (${servedBy("?2")})
      ORDER BY f.line_no, e.json_pointer`);

/**
 * Every headword record spelling what this one spells — itself included. An
 * incoming edge matches on the target word key, so it lands on all of them at
 * once; this is the set the source left unresolved.
 */
export const INFLECTION_CANDIDATE_SQL: KeyedRead = keyedRead(`SELECT self.record_id AS set_key, t.record_id, t.release_id, t.line_no, t.line_sha256, t.word, t.pos
       FROM lookup_form self
       CROSS JOIN lookup_form other
         ON other.release_id IN (${servedBy("?2")})
        AND other.surface_key = self.surface_key
        AND other.origin = 'headword'
       JOIN source_record t ON t.record_id = other.record_id
      WHERE self.record_id IN (SELECT value FROM json_each(?1)) AND self.origin = 'headword'
      ORDER BY t.line_no, t.record_id`);

/**
 * The stated genders and numbers of every record declaring itself a form of
 * the word this record spells, read off the same edges as `INFLECTION_SQL` and
 * in the same join order. Sent only when one of those records glosses itself
 * this word's plural, and beside the candidate read, so it adds no round trip.
 * The numbers are read only so a correction of one can say what it replaces.
 */
export const INFLECTION_GRAMMAR_SQL: KeyedRead = keyedRead(`SELECT DISTINCT lf.record_id AS set_key, c.record_id, c.dimension, c.value, c.source_text, c.json_pointer,
            f.release_id, f.line_no, f.line_sha256
       FROM lookup_form lf
       CROSS JOIN form_of_edge e
         ON e.release_id IN (${servedBy("?2")}) AND e.target_word_key = lf.surface_key
       JOIN source_record f ON f.record_id = e.record_id
       JOIN grammar_claim c
         ON c.record_id = e.record_id AND c.scope = 'record' AND c.status = 'stated' AND c.dimension IN ('gender', 'number')
      WHERE lf.record_id IN (SELECT value FROM json_each(?1)) AND lf.origin = 'headword' AND lf.release_id IN (${servedBy("?2")})
      ORDER BY c.record_id, c.json_pointer`);

/** The `/word` field of a headword record, which is where its spelling is. */
function headwordRef(releaseId: string, lineNo: number, lineSha256: string): SourceRef {
  return { releaseId, lineNo, jsonPointer: "/word", lineSha256 };
}

/** A pointer into the line a row names. */
const lineRef = (row: { release_id: string; line_no: number; line_sha256: string }, jsonPointer: string): SourceRef => ({
  releaseId: row.release_id,
  lineNo: row.line_no,
  jsonPointer,
  lineSha256: row.line_sha256,
});

/**
 * The curated corrections of every record declaring itself a form of the word
 * this record spells, read off the same edges as `INFLECTION_SQL`. Sent beside
 * the gender read, and only when the master has corrections at all.
 */
export const INFLECTION_CORRECTION_SQL: KeyedRead = keyedRead(`SELECT DISTINCT lf.record_id AS set_key, k.record_id, k.dimension, k.value, k.correction_id, k.evidence_url
       FROM lookup_form lf
       CROSS JOIN form_of_edge e
         ON e.release_id IN (${servedBy("?2")}) AND e.target_word_key = lf.surface_key
       JOIN corrected_claim k ON k.record_id = e.record_id
      WHERE lf.record_id IN (SELECT value FROM json_each(?1)) AND lf.origin = 'headword' AND lf.release_id IN (${servedBy("?2")})
      ORDER BY k.record_id, k.dimension`);

/** `word` is the reading's own headword, which a plural gloss has to name. */
async function readInflections(
  db: LookupDatabase,
  releaseId: string,
  recordId: number,
  word: string,
  corrected: boolean,
): Promise<InflectionOf[]> {
  const rows = await readKeys<{
    record_id: number;
    release_id: string;
    line_no: number;
    line_sha256: string;
    word: string;
    pos: string;
    json_pointer: string;
    target_word: string;
    gloss: string | null;
    gloss_pointer: string | null;
  }>(db, INFLECTION_SQL, [recordId], [releaseId]);

  if (rows.length === 0) return [];

  // The edges whose sense glosses "plurale di <word>". A record keeps the one
  // on its first such edge in source order, which the rows' pointer-as-text
  // order is not (`compareSourcePointers`).
  const pluralGlosses = new Map<number, { edge: string; gloss: SourceText; gender: PluralGlossGender | undefined }>();
  for (const row of rows) {
    if (row.gloss === null || row.gloss_pointer === null) continue;
    const kept = pluralGlosses.get(row.record_id);
    if (kept !== undefined && compareSourcePointers(kept.edge, row.json_pointer) <= 0) continue;
    const plural = readPluralGloss(row.gloss, word);
    if (plural === undefined) continue;
    pluralGlosses.set(row.record_id, {
      edge: row.json_pointer,
      gloss: { text: row.gloss, ref: lineRef(row, row.gloss_pointer) },
      gender: plural.gender,
    });
  }

  // One extra read, not one per edge: every incoming edge on this record
  // matched the same surface key, so they all resolve to the same candidate set.
  // The genders go beside it, and only when a plural needs them.
  const [candidates, grammarRows, correctionRows] = await Promise.all([
    readKeys<{
      record_id: number;
      release_id: string;
      line_no: number;
      line_sha256: string;
      word: string;
      pos: string;
    }>(db, INFLECTION_CANDIDATE_SQL, [recordId], [releaseId]),
    pluralGlosses.size === 0
      ? Promise.resolve([])
      : readKeys<{
          record_id: number;
          dimension: "gender" | "number";
          value: string;
          source_text: string;
          json_pointer: string;
          release_id: string;
          line_no: number;
          line_sha256: string;
        }>(db, INFLECTION_GRAMMAR_SQL, [recordId], [releaseId]),
    pluralGlosses.size === 0 || !corrected
      ? Promise.resolve([])
      : readKeys<CorrectionRow>(db, INFLECTION_CORRECTION_SQL, [recordId], [releaseId]),
  ]);

  const targetCandidates = candidates.map((row) => ({
    recordId: row.record_id,
    word: row.word,
    pos: row.pos,
    ref: headwordRef(row.release_id, row.line_no, row.line_sha256),
  }));

  const recordClaims = new Map<number, (StatedClaim & ArchiveClaim)[]>();
  for (const row of grammarRows) {
    const claims = recordClaims.get(row.record_id) ?? [];
    claims.push({ status: "stated", dimension: row.dimension, value: row.value, sourceText: row.source_text, ref: lineRef(row, row.json_pointer) });
    recordClaims.set(row.record_id, claims);
  }
  for (const claims of recordClaims.values()) {
    claims.sort((a, b) => compareSourcePointers(a.ref.jsonPointer, b.ref.jsonPointer));
  }
  const corrections = correctionsByRecord(correctionRows);

  const pluralOf = (declaring: number): PluralDeclaration | undefined => {
    const plural = pluralGlosses.get(declaring);
    if (plural === undefined) return undefined;
    return pluralDeclaration(plural.gloss, plural.gender, recordClaims.get(declaring) ?? [], (corrections.get(declaring) ?? []).map(correctionOf));
  };

  // One row per declaring *record*, not per edge: `casetta` says it is a form
  // of `casa` on two of its senses, and that is one record pointing here twice,
  // not two records. Every edge's pointer is kept, so nothing about where the
  // claim came from is lost by the collapse.
  const byRecord = new Map<number, InflectionOf>();
  for (const row of rows) {
    // The edge lives on the declaring record, so the ref carries that record's
    // line, not this reading's.
    const edge = lineRef(row, row.json_pointer);
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
      plural: pluralOf(row.record_id),
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

/**
 * The reviews of a record and of every record it replaced (src/lookup/served.ts).
 * A review stays on the record it was written for, so its ref names that
 * record's line. Exported so a test can hold the query to its plan.
 */
export const REVIEW_SQL: KeyedRead = keyedRead(`SELECT l.set_key AS set_key, v.json_pointer, v.status, v.note, v.evidence_url, v.reviewed_at, v.reviewed_by,
            h.release_id, h.line_no, h.line_sha256
       FROM ${lineagesOf("?1")} l
       JOIN claim_review v ON v.record_id = l.record_id
       JOIN source_record h ON h.record_id = v.record_id
      ORDER BY v.json_pointer, v.reviewed_at`);

async function readReviews(db: LookupDatabase, recordId: number): Promise<Review[]> {
  const rows = await readKeys<{
    json_pointer: string;
    status: "disputed" | "corroborated";
    note: string;
    evidence_url: string;
    reviewed_at: string;
    reviewed_by: string;
    release_id: string;
    line_no: number;
    line_sha256: string;
  }>(db, REVIEW_SQL, [recordId]);

  return rows
    .map((row) => ({
      ref: refOn(row)(row.json_pointer),
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
export const RECOVERED_SQL: KeyedRead = keyedRead(`SELECT l.set_key AS set_key, d.recovered_id, d.record_id, d.route, d.term, d.page_line, d.text, d.held_as_example,
            d.lead_in_sense_index, d.lead_in_recovered_id, p.wiki, p.title, p.revision_id,
            h.release_id, h.line_no, h.line_sha256
       FROM ${lineagesOf("?1")} l
       JOIN recovered_definition d ON d.record_id = l.record_id
       JOIN raw_page p ON p.page_id = d.page_id
       JOIN source_record h ON h.record_id = d.record_id
      ORDER BY d.record_id, d.definition_index`);

/** The labels of recovered definitions, each definition's in its own order. */
export const RECOVERED_LABEL_SQL: KeyedRead = keyedRead(`SELECT recovered_id AS set_key, recovered_id, label
       FROM recovered_label
      WHERE recovered_id IN (SELECT value FROM json_each(?1))
      ORDER BY recovered_id, label_index`);

/** The examples of recovered definitions, each definition's in its own order. */
export const RECOVERED_EXAMPLE_SQL: KeyedRead = keyedRead(`SELECT recovered_id AS set_key, recovered_id, page_line, text
       FROM recovered_example
      WHERE recovered_id IN (SELECT value FROM json_each(?1))
      ORDER BY recovered_id, example_index`);

/**
 * The recovered definitions of a record and of every record it replaced: a
 * change applied from a later release leaves them on the record they were
 * recovered for, and the page reads them for the record that replaced it,
 * checked against its own line (`placeRecovered`).
 */
async function readRecovered(db: LookupDatabase, recordId: number, record: Promise<RecordLine>): Promise<RecoveredOfRecord> {
  const rows = await readKeys<{
    recovered_id: number;
    record_id: number;
    route: RecoveredRoute["route"];
    term: string | null;
    page_line: number;
    text: string;
    held_as_example: string | null;
    lead_in_sense_index: number | null;
    lead_in_recovered_id: number | null;
    wiki: string;
    title: string;
    revision_id: number;
    release_id: string;
    line_no: number;
    line_sha256: string;
  }>(db, RECOVERED_SQL, [recordId]);
  if (rows.length === 0) return { topLevel: [], underSense: new Map() };

  const ids = rows.map((row) => row.recovered_id);
  // A lead-in sense of a replaced record is found again by its glosses, so
  // that record's line is read, and only when some row needs it.
  const replaced = [
    ...new Set(rows.filter((row) => row.record_id !== recordId && row.lead_in_sense_index !== null).map((row) => row.record_id)),
  ];
  const [labels, examples, replacedLines, served] = await Promise.all([
    readKeys<{ recovered_id: number; label: string }>(db, RECOVERED_LABEL_SQL, ids),
    readKeys<{ recovered_id: number; page_line: number; text: string }>(db, RECOVERED_EXAMPLE_SQL, ids),
    Promise.all(replaced.map(async (id) => ({ record_id: id, raw_json: (await readRecord(db, id)).rawJson }))),
    record,
  ]);
  const glossesOf = (rawJson: string): RecordGloss[] => {
    const parsed: unknown = JSON.parse(rawJson);
    return recordGlosses(typeof parsed === "object" && parsed !== null ? (parsed as { senses?: unknown }).senses : undefined);
  };
  const replacedGlosses = new Map(replacedLines.map((line) => [line.record_id, glossesOf(line.raw_json)]));

  const stored: StoredRecovered[] = [];
  for (const row of rows) {
    const at = (line: number) => ({ wiki: row.wiki, title: row.title, revisionId: row.revision_id, line });
    // The schema ties `term` to the sub-term route, so a null here is a
    // database nobody seeded through the schema.
    if (row.route === "sub-term" && row.term === null) throw new Error(`recovered ${row.recovered_id} has no term`);
    const route: RecoveredRoute =
      row.route === "sub-term" ? { route: "sub-term", term: row.term as string } : { route: row.route };
    const definition: RecoveredDefinition = {
      ...route,
      text: row.text,
      correction: null,
      labels: labels.filter((label) => label.recovered_id === row.recovered_id).map((label) => label.label),
      ref: at(row.page_line),
      examples: examples
        .filter((example) => example.recovered_id === row.recovered_id)
        .map((example) => ({ text: example.text, ref: at(example.page_line) })),
      // The pointer is into the record it was recovered for, which may be one this replaced.
      heldAsExample: row.held_as_example === null ? null : refOn(row)(row.held_as_example),
      items: [],
    };
    const id = row.recovered_id;
    const recovered = row.lead_in_recovered_id === null ? null : { in: "recovered" as const, id: row.lead_in_recovered_id };
    const sense = row.lead_in_sense_index;
    if (row.record_id === recordId) {
      stored.push({ id, definition, writtenFor: "served", leadIn: recovered ?? (sense === null ? null : { in: "sense", senseIndex: sense }) });
    } else {
      const old = sense === null ? undefined : replacedGlosses.get(row.record_id);
      if (sense !== null && old === undefined) throw new Error(`record ${row.record_id} vanished mid-lookup`);
      const glosses = (old ?? []).filter((gloss) => gloss.senseIndex === sense).map((gloss) => gloss.text);
      stored.push({ id, definition, writtenFor: "replaced", leadIn: recovered ?? (sense === null ? null : { in: "sense", glosses }) });
    }
  }
  return placeRecovered(stored, glossesOf(served.rawJson));
}
