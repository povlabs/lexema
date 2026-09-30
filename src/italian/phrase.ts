// How a multi-word query is read word by word, by rule `it-phrase/v1` (#214).
//
// A query the index has no entry for, and that has a space in it, may still be
// an inflected multi-word headword: `vado via` is *andare via* said the way a
// speaker says it. Each word stands for its lemmas — itself, and every word
// its form-of records name — and each sequence of those lemmas is a headword
// the index is then asked for, exactly. A word stands for itself even when no
// record heads it: `l'amore` heads nothing, yet `faccio l'amore` is *fare
// l'amore*.
//
// One Italian rule reads two words as one: an auxiliary and a past participle.
// `sono andati` is a compound tense of *andare*, so it stands for *andare* and
// never for *essere* followed by *andare*. The auxiliary is a word whose lemmas
// include `essere` or `avere`; the participle is a word whose table entry is a
// past participle of some verb. Nothing here reads a spelling: which words are
// which comes from the source's own records (src/lookup/phrase.ts).
//
// This file is the rule and nothing else, free of the database, so a test can
// hold it to its cases directly.

export const IT_PHRASE_RULE = "it-phrase/v1";

/** The two verbs Italian forms its compound tenses with. */
export const AUXILIARIES: ReadonlySet<string> = new Set(["essere", "avere"]);

/**
 * The most lemma sequences one query is probed with. A word with several
 * lemmas multiplies the sequences, and past this bound the query is read as
 * no phrase at all rather than probed without end. Every query of up to four
 * words with four lemmas each is under it.
 */
export const MAX_PHRASE_PROBES = 256;

/**
 * The most words a query is read as a phrase with. The longest multi-word
 * headword in release `it-0c432803` has nine; a longer query cannot be one, and
 * reading it word by word would cost a probe per word for nothing.
 */
export const MAX_PHRASE_WORDS = 12;

/** One typed word, as the index reads it. */
export interface WordLemmas {
  /** The word as normalized for the index: `vado`. */
  typed: string;
  /** Itself first, whether or not a record heads it, then every word its form-of records name. */
  lemmas: readonly string[];
}

/** One place in the sequence: a word, or an auxiliary with its participle, and what it may stand for. */
export interface PhraseSlot {
  /** The typed word, or the two typed words of a compound tense: `sono andati`. */
  typed: string;
  /** The one typed word that stands for the lemmas: the word itself, or a compound tense's participle, `andati`. */
  inflected: string;
  lemmas: readonly string[];
}

const isAuxiliary = (word: WordLemmas): boolean => word.lemmas.some((lemma) => AUXILIARIES.has(lemma));

/**
 * The words that follow an auxiliary, by index: the only words whose
 * participle reading the rule needs, so the only ones a caller has to read it
 * for.
 */
export function participleCandidates(words: readonly WordLemmas[]): number[] {
  return words.flatMap((word, i) => (i + 1 < words.length && isAuxiliary(word) ? [i + 1] : []));
}

/**
 * The slots a query's words fill, left to right. An auxiliary followed by a
 * word that is a past participle becomes one slot standing for the verbs that
 * participle belongs to; every other word is a slot of its own.
 *
 * `participleOf` gives, for a word index, the verbs whose tables list that word
 * as their past participle; it is asked only about `participleCandidates`.
 */
export function phraseSlots(
  words: readonly WordLemmas[],
  participleOf: (index: number) => readonly string[],
): PhraseSlot[] {
  const slots: PhraseSlot[] = [];
  for (let i = 0; i < words.length; i += 1) {
    const word = words[i];
    const next = words[i + 1];
    if (next !== undefined && isAuxiliary(word)) {
      const verbs = participleOf(i + 1);
      if (verbs.length > 0) {
        slots.push({ typed: `${word.typed} ${next.typed}`, inflected: next.typed, lemmas: verbs });
        i += 1;
        continue;
      }
    }
    slots.push({ typed: word.typed, inflected: word.typed, lemmas: word.lemmas });
  }
  return slots;
}

/**
 * Every lemma sequence the slots spell, one lemma per slot, in slot order and
 * each slot's lemma order. `undefined` when there would be more than
 * `MAX_PHRASE_PROBES`; empty when any slot stands for nothing.
 */
export function lemmaSequences(slots: readonly PhraseSlot[]): string[][] | undefined {
  const count = slots.reduce((product, slot) => product * slot.lemmas.length, 1);
  if (count > MAX_PHRASE_PROBES) return undefined;
  return slots.reduce<string[][]>(
    (sequences, slot) => sequences.flatMap((sequence) => slot.lemmas.map((lemma) => [...sequence, lemma])),
    [[]],
  );
}

// When a query of several words finds nothing, the "Did you mean" list also
// offers the multi-word headwords this rule reaches from a query that is off
// by a little (#214, Huey's updated ruling of 2026-09-30): one word misspelled,
// a last word not finished, or a headword that is only part of the query. Each
// is still an exact probe for a stored headword, so nothing is invented.

/**
 * The letters a misspelled word is corrected with: the Italian alphabet, the
 * accented vowels Italian writes, and the apostrophe, all as the normalizer
 * keys them (lower case, NFC, one straight apostrophe).
 */
export const ITALIAN_LETTERS: readonly string[] = [..."abcdefghijklmnopqrstuvwxyzàèéìíîòóùú'"];

/**
 * The longest word the misspelling reading corrects. Its spellings grow with
 * its length times the alphabet; the single-word typo step stops at the same
 * length (`TYPO_MAX_LENGTH`, src/lookup/nearby.ts).
 */
export const MAX_CORRECTED_WORD_LENGTH = 30;

/**
 * Every spelling one edit from a word: a character left out, two neighbours
 * swapped, one replaced, or one inserted — the edits `withinOneEdit`
 * (src/lookup/nearby.ts) counts. The word itself is never one. Empty for a
 * word over `MAX_CORRECTED_WORD_LENGTH`.
 */
export function oneEditSpellings(word: string): string[] {
  const chars = [...word];
  if (chars.length > MAX_CORRECTED_WORD_LENGTH) return [];
  const spelled = new Set<string>();
  const spell = (...parts: readonly string[][]) => parts.flat().join("");
  for (let i = 0; i <= chars.length; i += 1) {
    const before = chars.slice(0, i);
    for (const letter of ITALIAN_LETTERS) spelled.add(spell(before, [letter], chars.slice(i)));
    if (i === chars.length) break;
    spelled.add(spell(before, chars.slice(i + 1)));
    for (const letter of ITALIAN_LETTERS) spelled.add(spell(before, [letter], chars.slice(i + 1)));
    if (i + 1 < chars.length) spelled.add(spell(before, [chars[i + 1], chars[i]], chars.slice(i + 2)));
  }
  spelled.delete(word);
  spelled.delete("");
  return [...spelled];
}

/**
 * Every run of at least two neighbouring slots that is not all of them, the
 * longer runs first and each length left to right: the parts of a query a
 * headword could be (`vado via` of `vado via subito`).
 */
export function slotRuns(slots: readonly PhraseSlot[]): PhraseSlot[][] {
  const runs: PhraseSlot[][] = [];
  for (let length = slots.length - 1; length >= 2; length -= 1) {
    for (let from = 0; from + length <= slots.length; from += 1) runs.push(slots.slice(from, from + length));
  }
  return runs;
}

// The page a searched expression opens is short (#214, Huey's page-shape ruling
// of 2026-09-30): the searched words, and each form entry of the inflected word
// with its lemma swapped for the expression. `vado`'s "1ª persona singolare del
// presente semplice indicativo di andare" reads "... di andare via" for `vado
// via`. The source's own words stay as they are; only the lemma is replaced.

/** A form entry's definition with its lemma replaced by the expression. */
export interface PhraseGloss {
  /** The gloss up to where it writes the lemma. */
  before: string;
  /** The expression, written where the lemma was. */
  phrase: string;
  /** The gloss after the lemma. */
  after: string;
}

const isLetter = (char: string | undefined): boolean => char !== undefined && /\p{L}/u.test(char);

/**
 * The gloss with the last place it writes the lemma as a whole word replaced
 * by the expression, or `undefined` when it never writes it so. The whole-word
 * test keeps `andare` from matching inside `riandare`.
 */
export function phraseGloss(gloss: string, lemma: string, phrase: string): PhraseGloss | undefined {
  if (lemma === "") return undefined;
  let at = gloss.lastIndexOf(lemma);
  while (at !== -1 && (isLetter(gloss[at - 1]) || isLetter(gloss[at + lemma.length]))) {
    at = at === 0 ? -1 : gloss.lastIndexOf(lemma, at - 1);
  }
  if (at === -1) return undefined;
  return { before: gloss.slice(0, at), phrase, after: gloss.slice(at + lemma.length) };
}
