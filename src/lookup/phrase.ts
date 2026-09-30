// The multi-word headwords a query spells word by word (#214): what the index
// says about each word, read for rule `it-phrase/v1` (src/italian/phrase.ts).
//
// Only ever run for a query the exact lookup found nothing for. Every read is
// an indexed probe by key, and the lemma sequences are probed as exact
// headword keys, so a sequence that is not a stored headword finds nothing:
// no ranking, no headword that is not in the release. `phraseMatches` is the
// lookup's answer; `nearPhrases` is what the "Did you mean" list of a search
// that found nothing adds, the same reading off by a word.

import {
  lemmaSequences,
  MAX_PHRASE_WORDS,
  oneEditSpellings,
  participleCandidates,
  phraseSlots,
  slotRuns,
  type PhraseSlot,
  type WordLemmas,
} from "../italian/phrase.js";
import type { LookupDatabase } from "./database.js";
import { prefixUpperBound } from "./keyRange.js";
import type { PhraseMatch, PhraseWord } from "./types.js";

/**
 * A word's lemmas: itself when it is a headword, and the word every form-of
 * edge on its headword records names — the edge `vado` declares to `andare`.
 * Exported so a test can assert the plan.
 */
export const WORD_LEMMA_SQL = `SELECT lf.surface_key AS lemma
       FROM lookup_form lf
      WHERE lf.release_id = ? AND lf.surface_key = ? AND lf.origin = 'headword'
     UNION
     SELECT e.target_word_key AS lemma
       FROM lookup_form lf
       JOIN form_of_edge e ON e.record_id = lf.record_id
      WHERE lf.release_id = ? AND lf.surface_key = ? AND lf.origin = 'headword'`;

/**
 * The verbs whose own table lists a spelling as their past participle: a
 * `forms[]` entry of a verb record the source tags both `participle` and
 * `past`. `andato` is `andare`'s. Exported so a test can assert the plan.
 */
export const PAST_PARTICIPLE_SQL = `SELECT DISTINCT hw.surface_key AS verb
       FROM lookup_form lf
       JOIN source_record r ON r.record_id = lf.record_id AND r.pos = 'verb'
       JOIN lookup_form hw ON hw.record_id = lf.record_id AND hw.origin = 'headword'
      WHERE lf.release_id = ? AND lf.surface_key = ? AND lf.origin = 'embedded-form'
        AND EXISTS (
              SELECT 1 FROM grammar_claim g
               WHERE g.record_id = lf.record_id
                 AND g.scope = 'form' AND g.scope_index = lf.form_index
                 AND g.status = 'stated' AND g.dimension = 'mood' AND g.value = 'participle')
        AND EXISTS (
              SELECT 1 FROM grammar_claim g
               WHERE g.record_id = lf.record_id
                 AND g.scope = 'form' AND g.scope_index = lf.form_index
                 AND g.status = 'stated' AND g.dimension = 'tense' AND g.value = 'past')`;

/** How many keys one headword probe binds, under D1's limit of 100 bound values. */
const PROBE_CHUNK = 90;

/** Which of the keys are headwords. Exported so a test can assert the plan. */
export const headwordKeySql = (count: number): string =>
  `SELECT DISTINCT surface_key
       FROM lookup_form
      WHERE release_id = ? AND origin = 'headword'
        AND surface_key IN (${Array.from({ length: count }, () => "?").join(", ")})`;

async function lemmasOf(db: LookupDatabase, releaseId: string, word: string): Promise<string[]> {
  const rows = await db.all<{ lemma: string }>(WORD_LEMMA_SQL, [releaseId, word, releaseId, word]);
  const others = rows.map((row) => row.lemma).filter((lemma) => lemma !== word).sort();
  // The word itself first, when it is a headword, then its lemmas in key order.
  return rows.some((row) => row.lemma === word) ? [word, ...others] : others;
}

/**
 * The verbs a word is the past participle of: through its own spelling, or
 * through a word it is a form of — `andati` names `andato`, which is
 * `andare`'s past participle.
 */
async function participleVerbs(db: LookupDatabase, releaseId: string, word: WordLemmas): Promise<string[]> {
  const spellings = [...new Set([word.typed, ...word.lemmas])];
  const verbs = await Promise.all(
    spellings.map((spelling) => db.all<{ verb: string }>(PAST_PARTICIPLE_SQL, [releaseId, spelling])),
  );
  return [...new Set(verbs.flat().map((row) => row.verb))].sort();
}

async function headwordKeys(db: LookupDatabase, releaseId: string, keys: readonly string[]): Promise<Set<string>> {
  const present = new Set<string>();
  for (let from = 0; from < keys.length; from += PROBE_CHUNK) {
    const chunk = keys.slice(from, from + PROBE_CHUNK);
    const rows = await db.all<{ surface_key: string }>(headwordKeySql(chunk.length), [releaseId, ...chunk]);
    for (const row of rows) present.add(row.surface_key);
  }
  return present;
}

/** Each typed word with its lemmas. */
function readWords(db: LookupDatabase, releaseId: string, typed: readonly string[]): Promise<WordLemmas[]> {
  return Promise.all(typed.map(async (word) => ({ typed: word, lemmas: await lemmasOf(db, releaseId, word) })));
}

/**
 * The slots the words fill (src/italian/phrase.ts), reading the participle
 * verbs of each word that follows an auxiliary. `verbs` keeps what was read, by
 * word, so a caller reading several variants of one query reads each once.
 */
async function readSlots(
  db: LookupDatabase,
  releaseId: string,
  words: readonly WordLemmas[],
  verbs: Map<WordLemmas, Promise<string[]>>,
): Promise<PhraseSlot[]> {
  const participles = new Map(
    await Promise.all(
      participleCandidates(words).map(async (index) => {
        const word = words[index];
        if (!verbs.has(word)) verbs.set(word, participleVerbs(db, releaseId, word));
        return [index, await verbs.get(word)!] as const;
      }),
    ),
  );
  return phraseSlots(words, (index) => participles.get(index) ?? []);
}

/** The distinct keys the slots' lemma sequences spell; none past `MAX_PHRASE_PROBES`. */
function spelledKeys(slots: readonly PhraseSlot[]): string[] {
  return [...new Set((lemmaSequences(slots) ?? []).map((sequence) => sequence.join(" ")))];
}

/**
 * The lemmas of every headword one edit from a word, in one read: each
 * spelling `oneEditSpellings` makes that some record heads, and every word
 * the form-of edges on those records name — `vadp` reaches `vado`, and through
 * it `andare`. The spellings are one JSON array, so the read binds two values
 * however many there are. Exported so a test can assert the plan.
 */
export const NEAR_LEMMA_SQL = `SELECT lf.surface_key AS lemma
       FROM lookup_form lf
      WHERE lf.release_id = ?1 AND lf.origin = 'headword'
        AND lf.surface_key IN (SELECT value FROM json_each(?2))
     UNION
     SELECT e.target_word_key AS lemma
       FROM lookup_form lf
       JOIN form_of_edge e ON e.record_id = lf.record_id
      WHERE lf.release_id = ?1 AND lf.origin = 'headword'
        AND lf.surface_key IN (SELECT value FROM json_each(?2))`;

async function nearLemmasOf(db: LookupDatabase, releaseId: string, word: string): Promise<string[]> {
  const spellings = oneEditSpellings(word);
  if (spellings.length === 0) return [];
  const rows = await db.all<{ lemma: string }>(NEAR_LEMMA_SQL, [releaseId, JSON.stringify(spellings)]);
  return [...new Set(rows.map((row) => row.lemma))].sort();
}

/**
 * The multi-word headwords that begin with a prefix, in key order, at most
 * `limit`. The same range probe on `lookup_form_headword_by_key` as
 * `SUGGEST_SQL` (src/lookup/suggest.ts). Exported so a test can assert the plan.
 */
export const HEADWORD_PREFIX_SQL = `SELECT DISTINCT surface_key
       FROM lookup_form
      WHERE release_id = ?1 AND origin = 'headword'
        AND surface_key >= ?2 AND surface_key < ?3
      ORDER BY surface_key
      LIMIT ?4`;

/**
 * The most prefixes the unfinished-word reading probes for one query: each is
 * a range read, so this bounds them far below the exact probes.
 */
export const MAX_PHRASE_PREFIX_PROBES = 16;

async function headwordsBeginning(db: LookupDatabase, releaseId: string, prefix: string, limit: number): Promise<string[]> {
  const rows = await db.all<{ surface_key: string }>(HEADWORD_PREFIX_SQL, [releaseId, prefix, prefixUpperBound(prefix), limit]);
  return rows.map((row) => row.surface_key);
}

/**
 * The multi-word headwords a query of several words nearly spells, for the
 * "Did you mean" list of a search that found nothing (#214, Huey's updated
 * ruling of 2026-09-30). The same reading as `phraseMatches`, off by one of:
 *
 * 1. one word misspelled: that word stands for the lemmas of the headwords one
 *    edit from it, every other word for its own (`tiro fouri` → `tirare fuori`);
 * 2. the last word not finished: every word before it stands for its lemmas,
 *    and a headword that begins with those lemmas and then the last word as
 *    typed is offered (`tiro fuo` → `tirare fuori`);
 * 3. only part of the query: a run of neighbouring words spells a headword
 *    (`vado via subito` → `andare via`).
 *
 * Keys, in that order and each once, at most `limit`, never the query's own.
 * Every one is a stored headword. `key` is the query as normalized for the index.
 */
export async function nearPhrases(db: LookupDatabase, releaseId: string, key: string, limit: number): Promise<string[]> {
  const typed = key.split(/\s+/).filter((word) => word !== "");
  if (typed.length < 2 || typed.length > MAX_PHRASE_WORDS) return [];

  const words = await readWords(db, releaseId, typed);
  const verbs = new Map<WordLemmas, Promise<string[]>>();
  const slots = await readSlots(db, releaseId, words, verbs);

  const misspelled = await Promise.all(
    words.map(async (word, index) => {
      const lemmas = await nearLemmasOf(db, releaseId, word.typed);
      if (lemmas.length === 0) return [];
      const corrected = words.map((other, i) => (i === index ? { typed: word.typed, lemmas } : other));
      const correctedSlots = await readSlots(db, releaseId, corrected, verbs);
      return correctedSlots.length < 2 ? [] : spelledKeys(correctedSlots);
    }),
  );

  const leading = await readSlots(db, releaseId, words.slice(0, -1), verbs);
  const heads = lemmaSequences(leading) ?? [];
  const last = typed[typed.length - 1];
  const prefixes = heads.length > MAX_PHRASE_PREFIX_PROBES ? [] : heads.map((head) => `${head.join(" ")} ${last}`);
  const unfinished = await Promise.all(prefixes.map((prefix) => headwordsBeginning(db, releaseId, prefix, limit)));

  const parts = slotRuns(slots).flatMap(spelledKeys);

  const corrected = misspelled.flat();
  const present = await headwordKeys(db, releaseId, [...new Set([...corrected, ...parts])]);
  const stored = (phrase: string) => present.has(phrase);
  const offered = [...corrected.filter(stored), ...unfinished.flat(), ...parts.filter(stored)];
  return [...new Set(offered)].filter((phrase) => phrase !== key).slice(0, limit);
}

/**
 * Every multi-word headword the query's words spell, each with the words that
 * spelled it, in the order the lemma sequences were tried. Empty when the
 * query is one word, more than `MAX_PHRASE_WORDS`, more than
 * `MAX_PHRASE_PROBES` sequences, or spells no headword.
 *
 * `key` is the query as normalized for the index.
 */
export async function phraseMatches(db: LookupDatabase, releaseId: string, key: string): Promise<PhraseMatch[]> {
  const typed = key.split(/\s+/).filter((word) => word !== "");
  if (typed.length < 2 || typed.length > MAX_PHRASE_WORDS) return [];

  const words = await readWords(db, releaseId, typed);
  const slots = await readSlots(db, releaseId, words, new Map());
  // Only a multi-word headword: a compound tense alone (`sono andati`) is one
  // slot, and its verb is a single word the exact lookup answers for.
  if (slots.length < 2) return [];
  const sequences = lemmaSequences(slots);
  if (sequences === undefined || sequences.length === 0) return [];

  const spelled = new Map<string, PhraseWord[]>();
  for (const sequence of sequences) {
    const phrase = sequence.join(" ");
    if (!spelled.has(phrase)) spelled.set(phrase, slots.map((slot, i) => ({ typed: slot.typed, lemma: sequence[i] })));
  }
  const present = await headwordKeys(db, releaseId, [...spelled.keys()]);
  return [...spelled].flatMap(([phrase, [first, second, ...rest]]) =>
    present.has(phrase) && first !== undefined && second !== undefined
      ? [{ key: phrase, words: [first, second, ...rest] }]
      : [],
  );
}
