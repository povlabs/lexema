// The multi-word headwords a query spells word by word (#214): what the index
// says about each word, read for rule `it-phrase/v1` (src/italian/phrase.ts).
//
// Every read is an indexed probe by key, and the lemma sequences are probed as
// exact headword keys, so a sequence that is not a stored headword finds
// nothing: no ranking, no headword that is not in the release.
//
// - `phraseMatches` is the lookup's answer for a query nothing spells.
// - `nearPhrases` is what the "Did you mean" list of a search that found
//   nothing adds: the query corrected, as the reader would have typed it, so
//   that it reads as a headword (`vadoo via` → `vado via`).
// - `phraseCompletions` is what the search field's suggestions add while a
//   query of several words is typed (`vado v` → `vado via`).
//
// An offer is always words a reader types, never the headword itself: choosing
// it runs the lookup, which opens the short page of `phraseMatches`. Huey's
// hand check of 2026-09-30 on #214. Every offer is read back through the same
// `PhraseReader.reading` the search runs, and keeps only the headwords that
// reading reaches, so no offer leads to "No entry".

import {
  lemmaSequences,
  MAX_PHRASE_PROBES,
  MAX_PHRASE_WORDS,
  oneEditSpellings,
  participleCandidates,
  phraseGloss,
  phraseSlots,
  slotRuns,
  type PhraseSlot,
  type WordLemmas,
} from "../italian/phrase.js";
import type { DictionaryRead, LookupDatabase } from "./database.js";
import { prefixUpperBound } from "./keyRange.js";
import type { PhraseDefinition, PhraseForm, PhraseMatch, PhraseWord } from "./types.js";

/**
 * Each spelling's lemmas, for any number of spellings in one read: the
 * spelling itself when it is a headword, and the word every form-of edge on
 * its headword records names — the edge `vado` declares to `andare`. The
 * spellings are one JSON array, so the read binds two values however many
 * there are. Exported so a test can assert the plan.
 */
export const WORD_LEMMAS_SQL = `SELECT lf.surface_key AS word, lf.surface_key AS lemma
       FROM lookup_form lf
      WHERE lf.release_id = ?1 AND lf.origin = 'headword'
        AND lf.surface_key IN (SELECT value FROM json_each(?2))
     UNION
     SELECT lf.surface_key AS word, e.target_word_key AS lemma
       FROM lookup_form lf
       JOIN form_of_edge e ON e.record_id = lf.record_id
      WHERE lf.release_id = ?1 AND lf.origin = 'headword'
        AND lf.surface_key IN (SELECT value FROM json_each(?2))`;

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

/**
 * Which of the keys are headwords, with how the source spells each. The keys
 * are one JSON array, so this is one read however many lemma sequences are
 * probed. Exported so a test can assert the plan.
 */
export const HEADWORD_SPELLING_SQL = `SELECT surface_key, surface
       FROM lookup_form
      WHERE release_id = ?1 AND origin = 'headword'
        AND surface_key IN (SELECT value FROM json_each(?2))`;

/**
 * The headwords that begin with a prefix, with how the source spells each, in
 * key order, at most `limit` rows. The same range probe on
 * `lookup_form_headword_by_key` as `SUGGEST_SQL` (src/lookup/suggest.ts).
 * Exported so a test can assert the plan.
 */
export const HEADWORD_PREFIX_SQL = `SELECT surface_key, surface
       FROM lookup_form
      WHERE release_id = ?1 AND origin = 'headword'
        AND surface_key >= ?2 AND surface_key < ?3
      ORDER BY surface_key
      LIMIT ?4`;

/**
 * Which of the keys the exact lookup answers for: a key `SEARCH_SQL`
 * (src/lookup/lookup.ts) finds a row for, under the same auxiliary rule. A
 * search for such a key never reads it word by word. The keys are one JSON
 * array, so this is one read however many phrases are offered. Exported so a
 * test can assert the plan.
 */
export const EXACT_KEY_SQL = `SELECT DISTINCT lf.surface_key
       FROM lookup_form lf
      WHERE lf.release_id = ?1
        AND lf.surface_key IN (SELECT value FROM json_each(?2))
        AND NOT EXISTS (
              SELECT 1 FROM grammar_claim g
               WHERE g.record_id = lf.record_id
                 AND g.scope = 'form' AND g.scope_index = lf.form_index
                 AND g.status = 'stated'
                 AND g.dimension = 'form-role' AND g.value = 'auxiliary')`;

/**
 * The most prefixes the unfinished-word reading probes for one query: each is
 * a range read, so this bounds them far below the exact probes.
 */
export const MAX_PHRASE_PREFIX_PROBES = 16;

/** What one spelling is to the rule, once read. */
interface ReadWord {
  /** Whether some record heads the spelling. */
  heads: boolean;
  /** Itself first, then every word the form-of edges on its headword records name. */
  lemmas: readonly string[];
}

/** A query's words read as places of at least two, and every lemma sequence they spell, within `MAX_PHRASE_PROBES`. */
interface PhraseReading {
  slots: readonly [PhraseSlot, PhraseSlot, ...PhraseSlot[]];
  sequences: readonly string[][];
}

const splitWords = (key: string): string[] => key.split(/\s+/).filter((word) => word !== "");

/**
 * One query's reading by rule `it-phrase/v1`: what the index says about each
 * spelling and each past participle, each read once however often the query's
 * offers ask. A phrase match and every phrase offered are read by the same
 * `reading`, which is what lets an offer promise its search.
 */
class PhraseReader {
  private readonly words = new Map<string, ReadWord>();
  private readonly participles = new Map<string, Promise<string[]>>();

  constructor(
    readonly db: LookupDatabase,
    readonly releaseId: string,
  ) {}

  /** Reads every spelling not read yet, all in one statement (`WORD_LEMMAS_SQL`). */
  async read(spellings: readonly string[]): Promise<void> {
    const asked = [...new Set(spellings)].filter((spelling) => !this.words.has(spelling));
    if (asked.length === 0) return;
    const rows = await this.db.all<{ word: string; lemma: string }>(WORD_LEMMAS_SQL, [this.releaseId, JSON.stringify(asked)]);
    const named = new Map<string, Set<string>>();
    for (const row of rows) named.set(row.word, (named.get(row.word) ?? new Set()).add(row.lemma));
    for (const spelling of asked) {
      const lemmas = named.get(spelling);
      const others = [...(lemmas ?? [])].filter((lemma) => lemma !== spelling).sort();
      this.words.set(spelling, { heads: lemmas !== undefined, lemmas: [spelling, ...others] });
    }
  }

  private known(spelling: string): ReadWord {
    const word = this.words.get(spelling);
    if (word === undefined) throw new Error(`'${spelling}' was used before it was read`);
    return word;
  }

  /** Whether some record heads a spelling already read. */
  heads(spelling: string): boolean {
    return this.known(spelling).heads;
  }

  /** A spelling already read, as the rule reads a word. */
  word(spelling: string): WordLemmas {
    return { typed: spelling, lemmas: this.known(spelling).lemmas };
  }

  /**
   * The verbs a word is the past participle of: through its own spelling, or
   * through a word it is a form of — `andati` names `andato`, which is
   * `andare`'s past participle.
   */
  private async participleVerbs(word: WordLemmas): Promise<string[]> {
    const read = (spelling: string): Promise<string[]> => {
      let verbs = this.participles.get(spelling);
      if (verbs === undefined) {
        verbs = this.db.all<{ verb: string }>(PAST_PARTICIPLE_SQL, [this.releaseId, spelling]).then((rows) => rows.map((row) => row.verb));
        this.participles.set(spelling, verbs);
      }
      return verbs;
    };
    const verbs = await Promise.all(word.lemmas.map(read));
    return [...new Set(verbs.flat())].sort();
  }

  /**
   * The places the words fill (src/italian/phrase.ts), reading the participle
   * verbs of each word that follows an auxiliary.
   */
  async slots(words: readonly WordLemmas[]): Promise<PhraseSlot[]> {
    const participles = new Map(
      await Promise.all(participleCandidates(words).map(async (index) => [index, await this.participleVerbs(words[index])] as const)),
    );
    return phraseSlots(words, (index) => participles.get(index) ?? []);
  }

  /**
   * The words as a search reads them (`phraseMatches`), or `undefined` when a
   * search would not read them as a phrase: fewer than two or more than
   * `MAX_PHRASE_WORDS` words, fewer than two places, or more than
   * `MAX_PHRASE_PROBES` sequences.
   */
  async reading(typed: readonly string[]): Promise<PhraseReading | undefined> {
    if (typed.length < 2 || typed.length > MAX_PHRASE_WORDS) return undefined;
    await this.read(typed);
    const [first, second, ...rest] = await this.slots(typed.map((spelling) => this.word(spelling)));
    if (first === undefined || second === undefined) return undefined;
    const sequences = lemmaSequences([first, second, ...rest]);
    return sequences === undefined ? undefined : { slots: [first, second, ...rest], sequences };
  }
}

/** The distinct keys some lemma sequences spell. */
const keysOf = (sequences: readonly (readonly string[])[]): string[] => [...new Set(sequences.map((sequence) => sequence.join(" ")))];

/** Which of the keys are headwords, each with how the source spells it. */
async function headwordSpellings(db: LookupDatabase, releaseId: string, keys: readonly string[]): Promise<Map<string, string>> {
  const asked = [...new Set(keys)];
  if (asked.length === 0) return new Map();
  const rows = await db.all<{ surface_key: string; surface: string }>(HEADWORD_SPELLING_SQL, [releaseId, JSON.stringify(asked)]);
  const spelled = new Map<string, string>();
  for (const row of rows) if (!spelled.has(row.surface_key)) spelled.set(row.surface_key, row.surface);
  return spelled;
}

/**
 * Words a reader could have meant to type, and the multi-word headwords they
 * reach by rule `it-phrase/v1`. Searching `phrase` finds every one of
 * `headwords`, so an offer is never a guess.
 */
export interface PhraseOffer {
  /** The words as the index keys a query: `vado via`. */
  phrase: string;
  /** The headwords it reaches, as the source spells them, in the order found. */
  headwords: readonly [string, ...string[]];
}

/** Words to offer, and the headword keys that make them worth offering if any is stored. */
interface OfferCandidate {
  phrase: string;
  keys: readonly string[];
}

/**
 * The candidates, each left with only the keys a search for its phrase finds,
 * the way `lookup()` searches: a phrase the index spells exactly opens what it
 * spells, so it keeps only the key that is the phrase itself (`aerei a
 * reazione` opens *aerei a reazione*, not *aereo a reazione*); any other phrase
 * keeps the keys the same `reading` `phraseMatches` runs reaches. A completion
 * is built from the typed words and a headword's own, and the search may still
 * read those words another way (an auxiliary and a participle among them) or
 * past a bound; such a key is dropped here rather than offered.
 */
async function reachable(reader: PhraseReader, candidates: readonly OfferCandidate[]): Promise<OfferCandidate[]> {
  const phrases = [...new Set(candidates.map((candidate) => candidate.phrase))];
  const [exact] = await Promise.all([
    reader.db
      .all<{ surface_key: string }>(EXACT_KEY_SQL, [reader.releaseId, JSON.stringify(phrases)])
      .then((rows) => new Set(rows.map((row) => row.surface_key))),
    reader.read(phrases.flatMap(splitWords)),
  ]);
  const reached = new Map<string, Promise<Set<string>>>();
  const reach = (phrase: string): Promise<Set<string>> => {
    let keys = reached.get(phrase);
    if (keys === undefined) {
      keys = reader.reading(splitWords(phrase)).then((reading) => new Set(reading === undefined ? [] : keysOf(reading.sequences)));
      reached.set(phrase, keys);
    }
    return keys;
  };
  return Promise.all(
    candidates.map(async ({ phrase, keys }) => {
      if (exact.has(phrase)) return { phrase, keys: keys.filter((key) => key === phrase) };
      const found = await reach(phrase);
      return { phrase, keys: keys.filter((key) => found.has(key)) };
    }),
  );
}

/** The candidates some stored headword backs, each phrase once, in the order first backed. */
function offersOf(candidates: readonly OfferCandidate[], stored: ReadonlyMap<string, string>): PhraseOffer[] {
  const backed = new Map<string, string[]>();
  for (const { phrase, keys } of candidates) {
    for (const key of keys) {
      const headword = stored.get(key);
      if (headword === undefined) continue;
      const headwords = backed.get(phrase) ?? [];
      if (!headwords.includes(headword)) headwords.push(headword);
      backed.set(phrase, headwords);
    }
  }
  return [...backed].flatMap(([phrase, [first, ...rest]]) => (first === undefined ? [] : [{ phrase, headwords: [first, ...rest] }]));
}

/**
 * The unfinished-last-word reading: the words before the last stand for their
 * lemma sequences, and each headword that begins with a sequence and then the
 * last word as typed is offered as the typed words it completes — `vado v`
 * reads `andare v`, reaches `andare via` and offers `vado via`. A sequence that
 * is the typed words themselves is left out when `besidesTyped`, because a
 * plain prefix probe already reads it. The leading words must be read first.
 */
async function completions(
  reader: PhraseReader,
  leading: readonly string[],
  last: string,
  limit: number,
  besidesTyped: boolean,
): Promise<{ candidates: OfferCandidate[]; stored: Map<string, string> }> {
  const typed = leading.join(" ");
  const slots = await reader.slots(leading.map((spelling) => reader.word(spelling)));
  const heads = keysOf(lemmaSequences(slots) ?? []).filter((head) => !(besidesTyped && head === typed));
  const stored = new Map<string, string>();
  if (heads.length > MAX_PHRASE_PREFIX_PROBES) return { candidates: [], stored };
  const read = await Promise.all(
    heads.map(async (head) => {
      const prefix = `${head} ${last}`;
      const rows = await reader.db.all<{ surface_key: string; surface: string }>(HEADWORD_PREFIX_SQL, [
        reader.releaseId,
        prefix,
        prefixUpperBound(prefix),
        limit,
      ]);
      return rows.map((row) => {
        if (!stored.has(row.surface_key)) stored.set(row.surface_key, row.surface);
        return { phrase: `${typed} ${row.surface_key.slice(head.length + 1)}`, keys: [row.surface_key] };
      });
    }),
  );
  return { candidates: read.flat(), stored };
}

/**
 * The typed queries a query of several words nearly is, for the "Did you mean"
 * list of a search that found nothing (#214). Each is the query corrected the
 * least it takes to read as a multi-word headword by `phraseMatches`, kept as
 * the reader typed it rather than turned into the headword (Huey's hand check
 * of 2026-09-30):
 *
 * 1. one word misspelled: that word replaced by a headword spelling one edit
 *    from it (`vadoo via` → `vado via`, `tiro fuory` → `tiro fuori`);
 * 2. the last word not finished: completed from a headword that begins with
 *    the other words' lemmas and it (`tiro fuo` → `tiro fuori`);
 * 3. only part of the query: a run of neighbouring words that reads as a
 *    headword (`vado via adesso` → `vado via`).
 *
 * In that order, each phrase once, at most `limit`, never the query itself.
 * Each offer names only the headwords searching it finds. `key` is the query
 * as normalized for the index.
 */
export async function nearPhrases(db: LookupDatabase, releaseId: string, key: string, limit: number): Promise<PhraseOffer[]> {
  const typed = splitWords(key);
  if (typed.length < 2 || typed.length > MAX_PHRASE_WORDS) return [];

  const reader = new PhraseReader(db, releaseId);
  const near = typed.map((word) => oneEditSpellings(word));
  await reader.read([...typed, ...near.flat()]);
  const slots = await reader.slots(typed.map((spelling) => reader.word(spelling)));

  const misspelled = await Promise.all(
    near.map(async (spellings, index) => {
      const corrections = await Promise.all(
        spellings
          .filter((spelling) => reader.heads(spelling))
          .map(async (spelling) => {
            const corrected = typed.map((word, i) => (i === index ? spelling : word));
            const reading = await reader.reading(corrected);
            return { phrase: corrected.join(" "), keys: reading === undefined ? [] : keysOf(reading.sequences) };
          }),
      );
      // The same bound one word's reading has: past it, this word is not corrected.
      return new Set(corrections.flatMap((c) => c.keys)).size > MAX_PHRASE_PROBES ? [] : corrections;
    }),
  );

  const unfinished = await completions(reader, typed.slice(0, -1), typed[typed.length - 1], limit, false);

  const parts = slotRuns(slots).map((run) => ({ phrase: run.map((slot) => slot.typed).join(" "), keys: keysOf(lemmaSequences(run) ?? []) }));

  const probed = [...misspelled.flat(), ...parts];
  const stored = await headwordSpellings(db, releaseId, probed.flatMap((candidate) => candidate.keys));
  for (const [headword, surface] of unfinished.stored) if (!stored.has(headword)) stored.set(headword, surface);
  const candidates = await reachable(reader, [...misspelled.flat(), ...unfinished.candidates, ...parts]);
  return offersOf(candidates, stored)
    .filter((offer) => offer.phrase !== key)
    .slice(0, limit);
}

/**
 * The typed queries a prefix of several words is the start of, for the search
 * field's suggestions (#214): the words before the last read as their lemmas,
 * and the last one unfinished (`vado v` → `vado via`, which reads as `andare
 * via`). Only a multi-word headword is ever reached, only one a search for the
 * offer finds, and a lemma sequence that is the typed words themselves is not
 * probed: the field's own prefix read already lists what begins with them
 * (`andare v` → `andare via`).
 *
 * `key` is the prefix as normalized for the index. A prefix of one word reads
 * nothing.
 */
export async function phraseCompletions(db: LookupDatabase, releaseId: string, key: string, limit: number): Promise<PhraseOffer[]> {
  const typed = splitWords(key);
  if (typed.length < 2 || typed.length > MAX_PHRASE_WORDS || limit <= 0) return [];
  const reader = new PhraseReader(db, releaseId);
  const leading = typed.slice(0, -1);
  await reader.read(leading);
  const { candidates, stored } = await completions(reader, leading, typed[typed.length - 1], limit, true);
  if (candidates.length === 0) return [];
  return offersOf(await reachable(reader, candidates), stored).slice(0, limit);
}

/** A multi-word headword the query spells, before its record is read for how the source spells it. */
export type PhraseProbe = Omit<PhraseMatch, "word">;

/**
 * Every multi-word headword the query's words spell, each with the words that
 * spelled it, in the order the lemma sequences were tried. Empty when the
 * query is one word, more than `MAX_PHRASE_WORDS`, more than
 * `MAX_PHRASE_PROBES` sequences, or spells no headword.
 *
 * `key` is the query as normalized for the index.
 */
export async function phraseMatches(db: LookupDatabase, releaseId: string, key: string): Promise<PhraseProbe[]> {
  return (await phraseMatchesOf(db, releaseId, [key])).get(key) ?? [];
}

/**
 * `phraseMatches` for many keys at once, each key's answer exactly what it
 * would be alone. One reader serves them all, so every key's words are one
 * read and every lemma sequence one headword read: a batch (src/lookup/batch.ts)
 * costs about what one query does.
 */
export async function phraseMatchesOf(
  db: LookupDatabase,
  releaseId: string,
  keys: readonly string[],
): Promise<Map<string, PhraseProbe[]>> {
  const reader = new PhraseReader(db, releaseId);
  // Only a multi-word headword: a compound tense alone (`sono andati`) is one
  // place, and its verb is a single word the exact lookup answers for. A key
  // `reading` refuses for its length is never read.
  const phrased = [...new Set(keys)]
    .map((key) => ({ key, typed: splitWords(key) }))
    .filter(({ typed }) => typed.length >= 2 && typed.length <= MAX_PHRASE_WORDS);
  await reader.read(phrased.flatMap(({ typed }) => typed));

  const spelledOf = new Map<string, Map<string, PhraseWord[]>>();
  for (const { key, reading } of await Promise.all(phrased.map(async ({ key, typed }) => ({ key, reading: await reader.reading(typed) })))) {
    if (reading === undefined) continue;
    const spelled = new Map<string, PhraseWord[]>();
    for (const sequence of reading.sequences) {
      const phrase = sequence.join(" ");
      if (!spelled.has(phrase)) {
        spelled.set(phrase, reading.slots.map((slot, i) => ({ typed: slot.typed, inflected: slot.inflected, lemma: sequence[i] })));
      }
    }
    spelledOf.set(key, spelled);
  }

  const present = await headwordSpellings(db, releaseId, [...spelledOf.values()].flatMap((spelled) => [...spelled.keys()]));
  return new Map(
    keys.map((key) => [
      key,
      [...(spelledOf.get(key) ?? [])].flatMap(([phrase, [first, second, ...rest]]): PhraseProbe[] =>
        present.has(phrase) && first !== undefined && second !== undefined
          ? [{ key: phrase, words: [first, second, ...rest] }]
          : [],
      ),
    ]),
  );
}

/**
 * The form entries of the records a word heads that name a lemma: each gloss
 * of each sense whose `form_of` edge points at it. `vado` and `andare` give
 * "prima persona singolare del presente semplice indicativo di andare". Exported
 * so a test can assert the plan.
 */
export const FORM_ENTRY_SQL = `SELECT DISTINCT r.record_id, r.word, r.pos_title, r.line_no, r.line_sha256,
            e.target_word AS lemma, s.sense_index, g.gloss_index, g.text, g.json_pointer
       FROM lookup_form lf
       JOIN source_record r ON r.record_id = lf.record_id
       JOIN form_of_edge e ON e.record_id = lf.record_id
       JOIN sense s ON s.record_id = e.record_id AND s.sense_index = e.sense_index
       JOIN sense_gloss g ON g.sense_id = s.sense_id
      WHERE lf.release_id = ?1 AND lf.surface_key = ?2 AND lf.origin = 'headword'
        AND e.target_word_key = ?3`;

/**
 * The form entries of the verb records a compound tense's participle heads
 * that name one of a verb's past participles: the same hop the rule reads the
 * participle through (`PAST_PARTICIPLE_SQL`). `fatte` names `fatto`, not
 * `fare`, and `fatto` is `fare`'s past participle, so `fatte` and `fare` give
 * "participio passato plurale femminile di fatto". Only a verb record: the
 * hop is a verb's, and `fatte` the adjective's "femminile plurale di fatto" is
 * not a form of `fare`. Exported so a test can assert the plan.
 */
export const PARTICIPLE_FORM_ENTRY_SQL = `SELECT DISTINCT r.record_id, r.word, r.pos_title, r.line_no, r.line_sha256,
            e.target_word AS lemma, s.sense_index, g.gloss_index, g.text, g.json_pointer
       FROM lookup_form lf
       JOIN source_record r ON r.record_id = lf.record_id AND r.pos = 'verb'
       JOIN form_of_edge e ON e.record_id = lf.record_id
       JOIN sense s ON s.record_id = e.record_id AND s.sense_index = e.sense_index
       JOIN sense_gloss g ON g.sense_id = s.sense_id
      WHERE lf.release_id = ?1 AND lf.surface_key = ?2 AND lf.origin = 'headword'
        AND e.target_word_key IN (
              SELECT pp.surface_key
                FROM lookup_form hw
                JOIN source_record v ON v.record_id = hw.record_id AND v.pos = 'verb'
                JOIN lookup_form pp ON pp.record_id = hw.record_id AND pp.origin = 'embedded-form'
               WHERE hw.release_id = ?1 AND hw.surface_key = ?3 AND hw.origin = 'headword'
                 AND EXISTS (
                       SELECT 1 FROM grammar_claim c
                        WHERE c.record_id = pp.record_id
                          AND c.scope = 'form' AND c.scope_index = pp.form_index
                          AND c.status = 'stated' AND c.dimension = 'mood' AND c.value = 'participle')
                 AND EXISTS (
                       SELECT 1 FROM grammar_claim c
                        WHERE c.record_id = pp.record_id
                          AND c.scope = 'form' AND c.scope_index = pp.form_index
                          AND c.status = 'stated' AND c.dimension = 'tense' AND c.value = 'past'))`;

interface FormEntryRow {
  record_id: number;
  word: string;
  pos_title: string;
  line_no: number;
  line_sha256: string;
  lemma: string;
  sense_index: number;
  gloss_index: number;
  text: string;
  json_pointer: string;
}

/**
 * What the short page of a searched expression shows (Huey's page-shape ruling
 * on #214, 2026-09-30). For each word of each phrase that stands for a lemma
 * other than itself, the form entries of the records it heads that name that
 * lemma, each gloss with the lemma replaced by the phrase (`phraseGloss`):
 * one entry per record, in source order. A gloss that never writes its lemma
 * as a word is left out, and so is a record left with none.
 *
 * A compound tense's participle may name the verb only through its past
 * participle, as the rule read it: `hanno fatte fuori` is *fare fuori*, and
 * `fatte`'s verb record says "participio passato plurale femminile di fatto",
 * which reads "… di *fare fuori*" (`PARTICIPLE_FORM_ENTRY_SQL`).
 */
export async function phraseForms(db: LookupDatabase, releaseId: string, phrases: readonly PhraseMatch[]): Promise<PhraseForm[]> {
  const read = async (phrase: PhraseMatch, sql: DictionaryRead, word: PhraseWord) => ({
    phrase,
    rows: await db.all<FormEntryRow>(sql, [releaseId, word.inflected, word.lemma]),
  });
  const reads = phrases.flatMap((phrase) =>
    phrase.words
      .filter((word) => word.inflected !== word.lemma)
      .flatMap((word) => [
        read(phrase, FORM_ENTRY_SQL, word),
        // Only a compound tense's word, `hanno fatte`, was read as a participle.
        ...(word.typed === word.inflected ? [] : [read(phrase, PARTICIPLE_FORM_ENTRY_SQL, word)]),
      ]),
  );
  const lines: { row: FormEntryRow; definition: PhraseDefinition }[] = [];
  const seen = new Set<string>();
  for (const { phrase, rows } of await Promise.all(reads)) {
    for (const row of rows) {
      const once = `${row.record_id} ${row.json_pointer} ${phrase.key}`;
      const swapped = phraseGloss(row.text, row.lemma, phrase.word);
      if (swapped === undefined || seen.has(once)) continue;
      seen.add(once);
      const ref = { releaseId, lineNo: row.line_no, jsonPointer: row.json_pointer, lineSha256: row.line_sha256 };
      lines.push({ row, definition: { ...swapped, ref } });
    }
  }
  lines.sort(
    (a, b) => a.row.line_no - b.row.line_no || a.row.sense_index - b.row.sense_index || a.row.gloss_index - b.row.gloss_index,
  );

  const byRecord = new Map<number, PhraseForm>();
  for (const { row, definition } of lines) {
    const form = byRecord.get(row.record_id);
    if (form !== undefined) {
      form.definitions.push(definition);
      continue;
    }
    byRecord.set(row.record_id, {
      recordId: row.record_id,
      word: row.word,
      posTitle: row.pos_title,
      ref: { releaseId, lineNo: row.line_no, jsonPointer: "", lineSha256: row.line_sha256 },
      definitions: [definition],
    });
  }
  return [...byRecord.values()];
}
