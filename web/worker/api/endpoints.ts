// Every endpoint of the JSON API under /v1 on api.lexema.fyi (#150, #151,
// #152), each an answer to one request and nothing else: the key, the limits
// and the charge are the handler's (./handler.ts), and every cost is
// src/api/calls.ts's.
//
// None of them ranks or places anew. `/lookup`, `/lemmatize` and `/inflect`
// read `lookup()` and its candidates (./lookupAnswer.ts); `/lookup/batch` reads
// the same candidates light, for all its words at once (`lookupBatch`, #335);
// `/exists` reads the first row of lookup's own search; `/suggest` and
// `/nearby` are the search field's `suggest()` and the not-found page's
// `findNearby()`; `/random` is one keyed pick over an index.
//
// Each endpoint first reads its request, before any lookup: one it cannot read
// is a 400 and costs nothing. A request it reads is charged its calls when the
// handler admits them, and then answered, found (200) or not (404).

import type { Endpoint } from "@lexema/api/calls.ts";
import { lookupBatch } from "@lexema/lookup/batch.ts";
import type { LookupDatabase } from "@lexema/lookup/database.ts";
import { exists, lookup, MAX_QUERY_LENGTH, rejectionOf } from "@lexema/lookup/lookup.ts";
import { findNearby } from "@lexema/lookup/nearby.ts";
import { randomHeadword } from "@lexema/lookup/random.ts";
import { prefixRejectionOf, suggest } from "@lexema/lookup/suggest.ts";
import { entryKey, isFormOfReading, publicEntryId, type LemmaTarget, type LookupResult, type RejectedQuery } from "@lexema/lookup/types.ts";
import { error, read, refused, type Reading, type Route } from "./answer.ts";
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

/** What a query parameter the lookup refuses is told: the parameter, and why. */
function queryRefusal(parameter: string, rejection: RejectedQuery): Reading {
  const message =
    rejection.reason === "empty"
      ? `Send the word as ${parameter}.`
      : `${parameter} is ${rejection.length} characters long; the limit is ${rejection.limit}.`;
  return refused("invalid_query", message);
}

/** A query read as valid and then refused by the lookup: the two checks disagree, which is a fault, not a 400. */
const unreadable = (parameter: string, value: string): Error => new Error(`${parameter} ${JSON.stringify(value)} was read and then refused`);

/**
 * The lookups of one request, each word read once: a lemma several candidates
 * share costs one lookup.
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
    return answer.outcome === "found" ? answer.readings.find((reading) => entryKey(reading) === entryKey(target)) : undefined;
  };
}

/**
 * `/lookup`: every candidate for `q`, narrowed by its filters
 * (./lookupFilters.ts). A word the release has is a 200 even when the filters
 * keep none of its candidates; only a word it does not have is a 404, offering
 * `findNearby`'s spellings.
 */
const lookupRoute: Route = async (_request, url) => {
  const filters = readLookupFilters(url.searchParams);
  if (!filters.ok) return refused("invalid_parameter", filters.refusal.message);
  const q = url.searchParams.get("q") ?? "";
  const rejection = rejectionOf(q);
  if (rejection !== undefined) return queryRefusal("q", rejection);
  return read({ endpoint: "lookup" }, async ({ db, releaseId }) => {
    const result = await lookup({ db, releaseId, query: q });
    if (result.outcome === "rejected") throw unreadable("q", q);
    if (result.outcome === "not-found") {
      const nearby = await findNearby({ db, releaseId, query: result.query.raw });
      return { status: 404, body: notFoundJson(result, nearby) };
    }
    return { status: 200, body: await foundJson(result, new Lookups(db, releaseId).lemma, filters.filters) };
  });
};

/** `/lemmatize`: `/lookup`'s candidates with only their lemma and the match's grammar. */
const lemmatizeRoute: Route = async (_request, url) => {
  const q = url.searchParams.get("q") ?? "";
  const rejection = rejectionOf(q);
  if (rejection !== undefined) return queryRefusal("q", rejection);
  return read({ endpoint: "lemmatize" }, async ({ db, releaseId }) => {
    const lookups = new Lookups(db, releaseId);
    const result = await lookups.of(q);
    if (result.outcome === "rejected") throw unreadable("q", q);
    const head = { query: result.query.raw, release_id: result.release.releaseId };
    if (result.outcome === "not-found") return { status: 404, body: { ...head, results: [] } };
    const candidates = await candidatesOf(result, lookups.lemma);
    return { status: 200, body: { ...head, results: candidates.map(lemmaJson) } };
  });
};

/** What `/exists` answers: whether `/lookup` would find the word, and the page it was found on. */
export type ExistsJson = { query: string; release_id: string } & (
  | { exists: true; attribution: AttributionJson }
  | { exists: false; attribution: null }
);

/** `/exists`: always a 200 for a well-formed `q`. */
const existsRoute: Route = async (_request, url) => {
  const q = url.searchParams.get("q") ?? "";
  const rejection = rejectionOf(q);
  if (rejection !== undefined) return queryRefusal("q", rejection);
  return read({ endpoint: "exists" }, async ({ db, releaseId }) => {
    const result = await exists({ db, releaseId, query: q });
    if (result.outcome === "rejected") throw unreadable("q", q);
    const head = { query: result.query.raw, release_id: result.release.releaseId };
    const body: ExistsJson =
      result.outcome === "present"
        ? { ...head, exists: true, attribution: attributionOf(result.word) }
        : { ...head, exists: false, attribution: null };
    return { status: 200, body };
  });
};

/**
 * `/inflect`: the forms of `lemma` at the place the grammar filters name, in
 * `/lookup`'s grammar vocabulary. Each record headed by the lemma is a result
 * with the cells of its forms that fit every filter sent; a record with none
 * is left out. A word the release does not have as a headword is a 404.
 */
const inflectRoute: Route = async (_request, url) => {
  const narrowing = readGrammarNarrowing(url.searchParams);
  if (!narrowing.ok) return refused("invalid_parameter", narrowing.refusal.message);
  const lemma = url.searchParams.get("lemma") ?? "";
  const rejection = rejectionOf(lemma);
  if (rejection !== undefined) return queryRefusal("lemma", rejection);
  return read({ endpoint: "inflect" }, async ({ db, releaseId }) => {
    const result = await lookup({ db, releaseId, query: lemma });
    if (result.outcome === "rejected") throw unreadable("lemma", lemma);
    // A phrase `lemma`'s words spell (`vado via`) is not a headword of its own.
    const lemmas =
      result.outcome === "found" && result.route.kind === "surface"
        ? result.readings.filter((reading) => reading.isAboutQuery && !isFormOfReading(reading))
        : [];
    if (lemmas.length === 0) {
      return { status: 404, body: error("unknown_lemma", `${result.query.raw} is not a headword of this release.`) };
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
    return { status: 200, body: { lemma: result.query.raw, release_id: result.release.releaseId, results } };
  });
};

/** `/suggest`: the search field's own prefix suggestions, in its order and limit. */
const suggestRoute: Route = async (_request, url) => {
  const q = url.searchParams.get("q") ?? "";
  const rejection = prefixRejectionOf(q);
  if (rejection?.reason === "too-short") return refused("invalid_query", `Send at least ${rejection.limit} characters as q.`);
  if (rejection !== undefined) return queryRefusal("q", rejection);
  return read({ endpoint: "suggest" }, async ({ db, releaseId }) => {
    const result = await suggest({ db, releaseId, prefix: q });
    if (result.outcome === "rejected") throw unreadable("q", q);
    // A phrase's words (`vado via`) have no page of their own: its source is the headword it reaches.
    const results = [
      ...result.suggestions.map((word) => ({ word, attribution: attributionOf(word) })),
      ...result.phrases.map((offer) => ({ word: offer.phrase, attribution: attributionOf(offer.headwords[0]) })),
    ];
    return { status: 200, body: { query: result.prefix.raw, release_id: releaseId, results } };
  });
};

/** `/nearby`: the not-found page's did-you-mean, in its ranking, `typo` called `edit`. */
const nearbyRoute: Route = async (_request, url) => {
  const query = url.searchParams.get("q") ?? "";
  const rejection = rejectionOf(query);
  if (rejection !== undefined) return queryRefusal("q", rejection);
  return read({ endpoint: "nearby" }, async ({ db, releaseId }) => {
    const nearby = await findNearby({ db, releaseId, query });
    const results = suggestionsOf(nearby, query).map(({ word, kind, page }) => ({ word, kind, attribution: attributionOf(page) }));
    return { status: 200, body: { query, release_id: releaseId, results } };
  });
};

/** `/random`: one random headword, of `pos` when it is sent; no result when the release has none of it. */
const randomRoute: Route = async (_request, url) => {
  const pos = readPartOfSpeech(url.searchParams);
  if (!pos.ok) return refused("invalid_parameter", pos.refusal.message);
  return read({ endpoint: "random" }, async ({ db, releaseId }) => {
    const picked = await randomHeadword({ db, releaseId, pos: pos.value });
    const results =
      picked === undefined
        ? []
        : [
            {
              id: `${picked.releaseId}:${picked.lineNo}`,
              word: picked.word,
              pos: picked.pos,
              pos_title: picked.posTitle,
              attribution: attributionOf(picked.word),
            },
          ];
    return { status: 200, body: { release_id: releaseId, results } };
  });
};

/**
 * One word of a batch, light: a candidate's lemma and part of speech, or that
 * the word was not found. A word with several candidates has one entry per
 * candidate, in the lookup's order, so none is dropped.
 */
export type LightJson =
  | { query: string; found: true; id: string; lemma: string; pos: string; pos_title: string; attribution: AttributionJson }
  | { query: string; found: false; lemma: null; pos: null; pos_title: null };

/**
 * The words a batch body sends, or why it cannot be read. A batch takes at most
 * as many words as the key may make calls in a minute (Huey, #216): each word
 * is a call toward the minute, so a longer one could never be admitted.
 */
function batchWords(body: unknown, most: number): { ok: true; words: string[] } | { ok: false; message: string } {
  const shape = `Send a JSON object {"q": [...]} with 1 to ${most} words.`;
  if (typeof body !== "object" || body === null || !Array.isArray((body as { q?: unknown }).q)) return { ok: false, message: shape };
  const words: unknown[] = (body as { q: unknown[] }).q;
  if (words.length === 0) return { ok: false, message: `q is empty. ${shape}` };
  if (words.length > most) return { ok: false, message: `q has ${words.length} words; this key's limit is ${most}, its calls a minute.` };
  for (const [at, word] of words.entries()) {
    if (typeof word !== "string") return { ok: false, message: `q[${at}] is not a string.` };
    const rejection = rejectionOf(word);
    if (rejection?.reason === "empty") return { ok: false, message: `q[${at}] is empty.` };
    if (rejection?.reason === "too-long") return { ok: false, message: `q[${at}] is ${rejection.length} characters long; the limit is ${MAX_QUERY_LENGTH}.` };
  }
  return { ok: true, words: words as string[] };
}

/** `POST /lookup/batch`: up to the key's calls a minute in words, each a light result, charged per word sent. */
const batchRoute: Route = async (request, _url, { batchWords: most }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return refused("invalid_body", `The body is not JSON. Send {"q": [...]} with 1 to ${most} words.`);
  }
  const sent = batchWords(body, most);
  if (!sent.ok) return refused("invalid_body", sent.message);
  return read({ endpoint: "lookup/batch", words: sent.words.length }, async ({ db, releaseId }) => {
    const { answers } = await lookupBatch({ db, releaseId, queries: sent.words });
    const results = answers.flatMap((answer, at): LightJson[] => {
      const word = sent.words[at];
      if (answer.outcome === "rejected") throw unreadable(`q[${at}]`, word);
      if (answer.outcome === "not-found") return [{ query: word, found: false, lemma: null, pos: null, pos_title: null }];
      return answer.candidates.map((candidate) => ({
        query: word,
        found: true,
        id: publicEntryId(candidate),
        lemma: candidate.word,
        pos: candidate.pos,
        pos_title: candidate.posTitle,
        attribution: attributionOf(candidate.word),
      }));
    });
    return { status: 200, body: { release_id: releaseId, results } };
  });
};

/** Every endpoint, the one method it answers, and how it reads a request: one closed map, so none goes unrouted. */
export const ROUTES: Readonly<Record<Endpoint, { method: "GET" | "POST"; read: Route }>> = {
  lookup: { method: "GET", read: lookupRoute },
  lemmatize: { method: "GET", read: lemmatizeRoute },
  exists: { method: "GET", read: existsRoute },
  inflect: { method: "GET", read: inflectRoute },
  suggest: { method: "GET", read: suggestRoute },
  nearby: { method: "GET", read: nearbyRoute },
  random: { method: "GET", read: randomRoute },
  "lookup/batch": { method: "POST", read: batchRoute },
};
