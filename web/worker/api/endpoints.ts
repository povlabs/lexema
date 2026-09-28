// Every endpoint of the JSON API under /api/v1 (#150, #151, #152), each an
// answer to one request and nothing else: the key, the limits and the charge
// are the handler's (./handler.ts), and every cost is src/api/units.ts's.
//
// None of them ranks or places anew. `/lookup`, `/lemmatize`, `/inflect` and
// `/lookup/batch` read `lookup()` and its candidates (./lookupAnswer.ts);
// `/exists` reads the first row of lookup's own search; `/suggest` and
// `/nearby` are the search field's `suggest()` and the not-found page's
// `findNearby()`; `/random` is one keyed pick over an index.
//
// A request an endpoint cannot read is a 400 before any lookup, and costs
// nothing. Anything else did the work and is charged, found (200) or not (404).

import type { Endpoint } from "@lexema/api/units.ts";
import type { LookupDatabase } from "@lexema/lookup/database.ts";
import { exists, lookup, MAX_QUERY_LENGTH, rejectionOf } from "@lexema/lookup/lookup.ts";
import { findNearby } from "@lexema/lookup/nearby.ts";
import { randomHeadword } from "@lexema/lookup/random.ts";
import { suggest } from "@lexema/lookup/suggest.ts";
import { isFormOfReading, type LemmaTarget, type LookupResult, type RejectedQuery } from "@lexema/lookup/types.ts";
import { error, refused, type Answer, type Route } from "./answer.ts";
import {
  attributionOf,
  candidatesOf,
  foundJson,
  idOf,
  inflectionsOf,
  lemmaJson,
  notFoundJson,
  suggestionsOf,
  type AttributionJson,
  type LemmaReader,
} from "./lookupAnswer.ts";
import { fits, readGrammarNarrowing, readLookupFilters, readPartOfSpeech } from "./lookupFilters.ts";

/** What a query parameter the lookup refused is told: the parameter, and why. */
function queryRefusal(parameter: string, rejection: RejectedQuery): Answer {
  const message =
    rejection.reason === "empty"
      ? `Send the word as ${parameter}.`
      : `${parameter} is ${rejection.length} characters long; the limit is ${rejection.limit}.`;
  return refused("invalid_query", message);
}

/**
 * The lookups of one request, each word read once: a batch that names a word
 * twice, or a lemma several candidates share, costs one lookup.
 */
class Lookups {
  private readonly results = new Map<string, Promise<LookupResult>>();

  constructor(
    private readonly db: LookupDatabase,
    private readonly releaseId: string,
  ) {}

  of(word: string): Promise<LookupResult> {
    let result = this.results.get(word);
    if (result === undefined) {
      result = lookup({ db: this.db, releaseId: this.releaseId, query: word });
      this.results.set(word, result);
    }
    return result;
  }

  /** A lemma a form-of record names, read as the lookup reads any word: its headword, and the reading that is that record. */
  readonly lemma: LemmaReader = async (target: LemmaTarget) => {
    const answer = await this.of(target.word);
    return answer.outcome === "found" ? answer.readings.find((reading) => reading.recordId === target.recordId) : undefined;
  };
}

/**
 * `/lookup`: every candidate for `q`, narrowed by its filters
 * (./lookupFilters.ts). A word the release has is a 200 even when the filters
 * keep none of its candidates; only a word it does not have is a 404, offering
 * `findNearby`'s spellings.
 */
const lookupRoute: Route = async (_request, url, { db, releaseId }) => {
  const filters = readLookupFilters(url.searchParams);
  if (!filters.ok) return refused("invalid_parameter", filters.refusal.message);
  const result = await lookup({ db, releaseId, query: url.searchParams.get("q") ?? "" });
  if (result.outcome === "rejected") return queryRefusal("q", result.rejection);
  const charge = { endpoint: "lookup" } as const;
  if (result.outcome === "not-found") {
    const nearby = await findNearby({ db, releaseId, query: result.query.raw });
    return { status: 404, body: notFoundJson(result, nearby), charge };
  }
  return { status: 200, body: await foundJson(result, new Lookups(db, releaseId).lemma, filters.filters), charge };
};

/** `/lemmatize`: `/lookup`'s candidates with only their lemma and the match's grammar. */
const lemmatizeRoute: Route = async (_request, url, { db, releaseId }) => {
  const lookups = new Lookups(db, releaseId);
  const result = await lookups.of(url.searchParams.get("q") ?? "");
  if (result.outcome === "rejected") return queryRefusal("q", result.rejection);
  const charge = { endpoint: "lemmatize" } as const;
  const head = { query: result.query.raw, release_id: result.release.releaseId };
  if (result.outcome === "not-found") return { status: 404, body: { ...head, results: [] }, charge };
  const candidates = await candidatesOf(result, lookups.lemma);
  return { status: 200, body: { ...head, results: candidates.map(lemmaJson) }, charge };
};

/** What `/exists` answers: whether `/lookup` would find the word, and the page it was found on. */
export type ExistsJson = { query: string; release_id: string } & (
  | { exists: true; attribution: AttributionJson }
  | { exists: false; attribution: null }
);

/** `/exists`: always a 200 for a well-formed `q`. */
const existsRoute: Route = async (_request, url, { db, releaseId }) => {
  const result = await exists({ db, releaseId, query: url.searchParams.get("q") ?? "" });
  if (result.outcome === "rejected") return queryRefusal("q", result.rejection);
  const head = { query: result.query.raw, release_id: result.release.releaseId };
  const body: ExistsJson =
    result.outcome === "present"
      ? { ...head, exists: true, attribution: attributionOf(result.word) }
      : { ...head, exists: false, attribution: null };
  return { status: 200, body, charge: { endpoint: "exists" } };
};

/**
 * `/inflect`: the forms of `lemma` at the place the grammar filters name, in
 * `/lookup`'s grammar vocabulary. Each record headed by the lemma is a result
 * with the cells of its forms that fit every filter sent; a record with none
 * is left out. A word the release does not have as a headword is a 404.
 */
const inflectRoute: Route = async (_request, url, { db, releaseId }) => {
  const narrowing = readGrammarNarrowing(url.searchParams);
  if (!narrowing.ok) return refused("invalid_parameter", narrowing.refusal.message);
  const result = await lookup({ db, releaseId, query: url.searchParams.get("lemma") ?? "" });
  if (result.outcome === "rejected") return queryRefusal("lemma", result.rejection);
  const charge = { endpoint: "inflect" } as const;
  const lemmas = result.outcome === "found" ? result.readings.filter((reading) => reading.isAboutQuery && !isFormOfReading(reading)) : [];
  if (lemmas.length === 0) {
    return { status: 404, body: error("unknown_lemma", `${result.query.raw} is not a headword of this release.`), charge };
  }
  const places = { ...narrowing.value.verb, ...narrowing.value.agreement };
  const results = lemmas.flatMap((reading) => {
    const inflections = inflectionsOf(reading).filter((inflection) => fits(inflection.grammar, places));
    return inflections.length === 0
      ? []
      : [
          {
            id: idOf(reading),
            word: reading.word,
            pos: reading.pos,
            pos_title: reading.posTitle,
            inflections,
            attribution: attributionOf(reading.word),
          },
        ];
  });
  return { status: 200, body: { lemma: result.query.raw, release_id: result.release.releaseId, results }, charge };
};

/** `/suggest`: the search field's own prefix suggestions, in its order and limit. */
const suggestRoute: Route = async (_request, url, { db, releaseId }) => {
  const result = await suggest({ db, releaseId, prefix: url.searchParams.get("q") ?? "" });
  if (result.outcome === "rejected") {
    const { rejection } = result;
    return queryRefusal("q", rejection.reason === "too-short" ? { reason: "empty" } : rejection);
  }
  const results = result.suggestions.map((word) => ({ word, attribution: attributionOf(word) }));
  return { status: 200, body: { query: result.prefix.raw, release_id: releaseId, results }, charge: { endpoint: "suggest" } };
};

/** `/nearby`: the not-found page's did-you-mean, in its ranking, `typo` called `edit`. */
const nearbyRoute: Route = async (_request, url, { db, releaseId }) => {
  const query = url.searchParams.get("q") ?? "";
  const rejection = rejectionOf(query);
  if (rejection !== undefined) return queryRefusal("q", rejection);
  const nearby = await findNearby({ db, releaseId, query });
  const results = suggestionsOf(nearby, query).map((suggestion) => ({ ...suggestion, attribution: attributionOf(suggestion.word) }));
  return { status: 200, body: { query, release_id: releaseId, results }, charge: { endpoint: "nearby" } };
};

/** `/random`: one random headword, of `pos` when it is sent; no result when the release has none of it. */
const randomRoute: Route = async (_request, url, { db, releaseId }) => {
  const pos = readPartOfSpeech(url.searchParams);
  if (!pos.ok) return refused("invalid_parameter", pos.refusal.message);
  const picked = await randomHeadword({ db, releaseId, pos: pos.value });
  const results =
    picked === undefined
      ? []
      : [
          {
            id: `${releaseId}:${picked.lineNo}`,
            word: picked.word,
            pos: picked.pos,
            pos_title: picked.posTitle,
            attribution: attributionOf(picked.word),
          },
        ];
  return { status: 200, body: { release_id: releaseId, results }, charge: { endpoint: "random" } };
};

/** The most words one `/lookup/batch` takes. */
export const MAX_BATCH_WORDS = 200;

/**
 * One word of a batch, light: a candidate's lemma and part of speech, or that
 * the word was not found. A word with several candidates has one entry per
 * candidate, in the lookup's order, so none is dropped.
 */
export type LightJson =
  | { query: string; found: true; id: string; lemma: string; pos: string; pos_title: string; attribution: AttributionJson }
  | { query: string; found: false; lemma: null; pos: null; pos_title: null };

/** The words a batch body sends, or why it cannot be read. */
function batchWords(body: unknown): { ok: true; words: string[] } | { ok: false; message: string } {
  const shape = `Send a JSON object {"q": [...]} with 1 to ${MAX_BATCH_WORDS} words.`;
  if (typeof body !== "object" || body === null || !Array.isArray((body as { q?: unknown }).q)) return { ok: false, message: shape };
  const words: unknown[] = (body as { q: unknown[] }).q;
  if (words.length === 0) return { ok: false, message: `q is empty. ${shape}` };
  if (words.length > MAX_BATCH_WORDS) return { ok: false, message: `q has ${words.length} words; the limit is ${MAX_BATCH_WORDS}.` };
  for (const [at, word] of words.entries()) {
    if (typeof word !== "string") return { ok: false, message: `q[${at}] is not a string.` };
    const rejection = rejectionOf(word);
    if (rejection?.reason === "empty") return { ok: false, message: `q[${at}] is empty.` };
    if (rejection?.reason === "too-long") return { ok: false, message: `q[${at}] is ${rejection.length} characters long; the limit is ${MAX_QUERY_LENGTH}.` };
  }
  return { ok: true, words: words as string[] };
}

/** `POST /lookup/batch`: up to 200 words, each a light result, charged per word sent. */
const batchRoute: Route = async (request, _url, { db, releaseId }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return refused("invalid_body", `The body is not JSON. Send {"q": [...]} with 1 to ${MAX_BATCH_WORDS} words.`);
  }
  const read = batchWords(body);
  if (!read.ok) return refused("invalid_body", read.message);
  const lookups = new Lookups(db, releaseId);
  const perWord = await Promise.all(
    read.words.map(async (word): Promise<LightJson[]> => {
      const result = await lookups.of(word);
      if (result.outcome !== "found") return [{ query: word, found: false, lemma: null, pos: null, pos_title: null }];
      return (await candidatesOf(result, lookups.lemma)).map(({ reading }) => ({
        query: word,
        found: true,
        id: idOf(reading),
        lemma: reading.word,
        pos: reading.pos,
        pos_title: reading.posTitle,
        attribution: attributionOf(reading.word),
      }));
    }),
  );
  return {
    status: 200,
    body: { release_id: releaseId, results: perWord.flat() },
    charge: { endpoint: "lookup/batch", words: read.words.length },
  };
};

/** Every endpoint, the one method it answers, and its answer: one closed map, so none goes unrouted. */
export const ROUTES: Readonly<Record<Endpoint, { method: "GET" | "POST"; answer: Route }>> = {
  lookup: { method: "GET", answer: lookupRoute },
  lemmatize: { method: "GET", answer: lemmatizeRoute },
  exists: { method: "GET", answer: existsRoute },
  inflect: { method: "GET", answer: inflectRoute },
  suggest: { method: "GET", answer: suggestRoute },
  nearby: { method: "GET", answer: nearbyRoute },
  random: { method: "GET", answer: randomRoute },
  "lookup/batch": { method: "POST", answer: batchRoute },
};
