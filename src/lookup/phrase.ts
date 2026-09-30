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
// hand check of 2026-09-30 on #214.

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
import type { LookupDatabase } from "./database.js";
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
 * The most prefixes the unfinished-word reading probes for one query: each is
 * a range read, so this bounds them far below the exact probes.
 */
export const MAX_PHRASE_PREFIX_PROBES = 16;

/** The lemmas of each spelling some record heads, the spelling itself first; a spelling none heads is absent. */
async function lemmasOfEach(db: LookupDatabase, releaseId: string, spellings: readonly string[]): Promise<Map<string, string[]>> {
  const asked = [...new Set(spellings)];
  if (asked.length === 0) return new Map();
  const rows = await db.all<{ word: string; lemma: string }>(WORD_LEMMAS_SQL, [releaseId, JSON.stringify(asked)]);
  const read = new Map<string, Set<string>>();
  for (const row of rows) read.set(row.word, (read.get(row.word) ?? new Set()).add(row.lemma));
  return new Map(
    [...read].map(([word, lemmas]) => {
      const others = [...lemmas].filter((lemma) => lemma !== word).sort();
      return [word, lemmas.has(word) ? [word, ...others] : others];
    }),
  );
}

/** The past-participle verbs read so far, by spelling, so no spelling is read twice for one query. */
type ParticipleReads = Map<string, Promise<string[]>>;

/**
 * The verbs a word is the past participle of: through its own spelling, or
 * through a word it is a form of — `andati` names `andato`, which is
 * `andare`'s past participle.
 */
async function participleVerbs(db: LookupDatabase, releaseId: string, word: WordLemmas, reads: ParticipleReads): Promise<string[]> {
  const read = (spelling: string): Promise<string[]> => {
    let verbs = reads.get(spelling);
    if (verbs === undefined) {
      verbs = db.all<{ verb: string }>(PAST_PARTICIPLE_SQL, [releaseId, spelling]).then((rows) => rows.map((row) => row.verb));
      reads.set(spelling, verbs);
    }
    return verbs;
  };
  const verbs = await Promise.all([...new Set([word.typed, ...word.lemmas])].map(read));
  return [...new Set(verbs.flat())].sort();
}

/**
 * The slots the words fill (src/italian/phrase.ts), reading the participle
 * verbs of each word that follows an auxiliary.
 */
async function readSlots(
  db: LookupDatabase,
  releaseId: string,
  words: readonly WordLemmas[],
  reads: ParticipleReads,
): Promise<PhraseSlot[]> {
  const participles = new Map(
    await Promise.all(
      participleCandidates(words).map(async (index) => [index, await participleVerbs(db, releaseId, words[index], reads)] as const),
    ),
  );
  return phraseSlots(words, (index) => participles.get(index) ?? []);
}

/** The distinct keys the slots' lemma sequences spell; none past `MAX_PHRASE_PROBES`. */
function spelledKeys(slots: readonly PhraseSlot[]): string[] {
  return [...new Set((lemmaSequences(slots) ?? []).map((sequence) => sequence.join(" ")))];
}

/** Which of the keys are headwords, each with how the source spells it. */
async function headwordSpellings(db: LookupDatabase, releaseId: string, keys: readonly string[]): Promise<Map<string, string>> {
  const asked = [...new Set(keys)];
  if (asked.length === 0) return new Map();
  const rows = await db.all<{ surface_key: string; surface: string }>(HEADWORD_SPELLING_SQL, [releaseId, JSON.stringify(asked)]);
  const spelled = new Map<string, string>();
  for (const row of rows) if (!spelled.has(row.surface_key)) spelled.set(row.surface_key, row.surface);
  return spelled;
}

const splitWords = (key: string): string[] => key.split(/\s+/).filter((word) => word !== "");

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
 * plain prefix probe already reads it.
 */
async function completions(
  db: LookupDatabase,
  releaseId: string,
  leading: readonly WordLemmas[],
  last: string,
  limit: number,
  reads: ParticipleReads,
  besidesTyped: boolean,
): Promise<{ candidates: OfferCandidate[]; stored: Map<string, string> }> {
  const typed = leading.map((word) => word.typed).join(" ");
  const heads = [...new Set((lemmaSequences(await readSlots(db, releaseId, leading, reads)) ?? []).map((head) => head.join(" ")))].filter(
    (head) => !(besidesTyped && head === typed),
  );
  const stored = new Map<string, string>();
  if (heads.length > MAX_PHRASE_PREFIX_PROBES) return { candidates: [], stored };
  const read = await Promise.all(
    heads.map(async (head) => {
      const prefix = `${head} ${last}`;
      const rows = await db.all<{ surface_key: string; surface: string }>(HEADWORD_PREFIX_SQL, [releaseId, prefix, prefixUpperBound(prefix), limit]);
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
 * `key` is the query as normalized for the index.
 */
export async function nearPhrases(db: LookupDatabase, releaseId: string, key: string, limit: number): Promise<PhraseOffer[]> {
  const typed = splitWords(key);
  if (typed.length < 2 || typed.length > MAX_PHRASE_WORDS) return [];

  const near = typed.map((word) => oneEditSpellings(word));
  const lemmas = await lemmasOfEach(db, releaseId, [...typed, ...near.flat()]);
  const wordOf = (spelling: string): WordLemmas => ({ typed: spelling, lemmas: lemmas.get(spelling) ?? [] });
  const words = typed.map(wordOf);
  const reads: ParticipleReads = new Map();
  const slots = await readSlots(db, releaseId, words, reads);

  const misspelled = await Promise.all(
    near.map(async (spellings, index) => {
      const corrections = await Promise.all(
        spellings
          .filter((spelling) => lemmas.has(spelling))
          .map(async (spelling) => {
            const corrected = words.map((word, i) => (i === index ? wordOf(spelling) : word));
            const correctedSlots = await readSlots(db, releaseId, corrected, reads);
            const keys = correctedSlots.length < 2 ? [] : spelledKeys(correctedSlots);
            return { phrase: corrected.map((word) => word.typed).join(" "), keys };
          }),
      );
      // The same bound one word's reading has: past it, this word is not corrected.
      return new Set(corrections.flatMap((c) => c.keys)).size > MAX_PHRASE_PROBES ? [] : corrections;
    }),
  );

  const unfinished = await completions(db, releaseId, words.slice(0, -1), typed[typed.length - 1], limit, reads, false);

  const parts = slotRuns(slots).map((run) => ({ phrase: run.map((slot) => slot.typed).join(" "), keys: spelledKeys(run) }));

  const probed = [...misspelled.flat(), ...parts];
  const stored = await headwordSpellings(db, releaseId, probed.flatMap((candidate) => candidate.keys));
  for (const [headword, surface] of unfinished.stored) if (!stored.has(headword)) stored.set(headword, surface);
  return offersOf([...misspelled.flat(), ...unfinished.candidates, ...parts], stored)
    .filter((offer) => offer.phrase !== key)
    .slice(0, limit);
}

/**
 * The typed queries a prefix of several words is the start of, for the search
 * field's suggestions (#214): the words before the last read as their lemmas,
 * and the last one unfinished (`vado v` → `vado via`, which reads as `andare
 * via`). Only a multi-word headword is ever reached, and a lemma sequence that
 * is the typed words themselves is not probed: the field's own prefix read
 * already lists what begins with them (`andare v` → `andare via`).
 *
 * `key` is the prefix as normalized for the index. A prefix of one word reads
 * nothing.
 */
export async function phraseCompletions(db: LookupDatabase, releaseId: string, key: string, limit: number): Promise<PhraseOffer[]> {
  const typed = splitWords(key);
  if (typed.length < 2 || typed.length > MAX_PHRASE_WORDS || limit <= 0) return [];
  const leading = typed.slice(0, -1);
  const lemmas = await lemmasOfEach(db, releaseId, leading);
  const words = leading.map((word): WordLemmas => ({ typed: word, lemmas: lemmas.get(word) ?? [] }));
  const { candidates, stored } = await completions(db, releaseId, words, typed[typed.length - 1], limit, new Map(), true);
  return offersOf(candidates, stored).slice(0, limit);
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
  const typed = splitWords(key);
  if (typed.length < 2 || typed.length > MAX_PHRASE_WORDS) return [];

  const lemmas = await lemmasOfEach(db, releaseId, typed);
  const words = typed.map((word): WordLemmas => ({ typed: word, lemmas: lemmas.get(word) ?? [] }));
  const slots = await readSlots(db, releaseId, words, new Map());
  // Only a multi-word headword: a compound tense alone (`sono andati`) is one
  // slot, and its verb is a single word the exact lookup answers for.
  if (slots.length < 2) return [];
  const sequences = lemmaSequences(slots);
  if (sequences === undefined || sequences.length === 0) return [];

  const spelled = new Map<string, PhraseWord[]>();
  for (const sequence of sequences) {
    const phrase = sequence.join(" ");
    if (!spelled.has(phrase)) spelled.set(phrase, slots.map((slot, i) => ({ typed: slot.typed, inflected: slot.inflected, lemma: sequence[i] })));
  }
  const present = await headwordSpellings(db, releaseId, [...spelled.keys()]);
  return [...spelled].flatMap(([phrase, [first, second, ...rest]]) =>
    present.has(phrase) && first !== undefined && second !== undefined
      ? [{ key: phrase, words: [first, second, ...rest] }]
      : [],
  );
}

/**
 * The form entries of the records a word heads that name a lemma: each gloss
 * of each sense whose `form_of` edge points at it. `vado` and `andare` give
 * "1ª persona singolare del presente semplice indicativo di andare". Exported
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
 */
export async function phraseForms(db: LookupDatabase, releaseId: string, phrases: readonly PhraseMatch[]): Promise<PhraseForm[]> {
  const reads = phrases.flatMap((phrase) =>
    phrase.words
      .filter((word) => word.inflected !== word.lemma)
      .map(async (word) => ({ phrase, rows: await db.all<FormEntryRow>(FORM_ENTRY_SQL, [releaseId, word.inflected, word.lemma]) })),
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
