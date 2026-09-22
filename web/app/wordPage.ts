// What one word's page is made of, decided before anything renders.
//
// A lookup returns every record that matched, and they are of two kinds: the
// records *about* the searched word (`isAboutQuery`), and records that merely
// list it in their own table. `sale` returns five — three about `sale`, and
// `sala` and `salire`, whose tables list it. Two of the three `sale` records
// say which word they are a form of, and that word is exactly `sala` and
// `salire`. So those two are not readings of `sale`: each is the lemma one of
// its readings points to, and it renders as that reading's lemma panel, named
// and linked, rather than as a card of its own.
//
// Nothing is dropped by that. A record the lookup returned is either a card or
// the lemma panel of a card, and `absorbed` below is the whole list of the
// second kind, so a test can check the two lists add up to what the lookup
// returned. A listing record no reading points to — `bella`, which lists
// `bello` — stays a card, because nothing else on the page names it.

import { isFormOfReading, searchedSpellings } from "@lexema/lookup/types.ts";
import type {
  LemmaLink,
  Pronunciation,
  Hyphenation,
  Reading,
  RelatedWord,
  SourceForm,
  SourceText,
  WordFacts,
} from "@lexema/lookup/types.ts";

/** One lemma a card points to, with the records of it this lookup returned. */
export interface LemmaPanel {
  link: LemmaLink;
  /** Returned records the link names, which this panel renders in their place. */
  returned: Reading[];
}

/**
 * The form a reading is, located inside its lemma's own table.
 *
 * `andavano`'s record says only that it is a form of `andare`; `andare`'s verb
 * record lists `andavano` at `/forms/16` with its person, number and tense. The
 * lemma's row is where those facts are stated, so a form reading reads them
 * from there — by the pointer the lookup matched, never by spelling.
 */
export interface LemmaRow {
  lemma: Reading;
  form: SourceForm;
}

export interface Card {
  /** 1-based, and the same number the reading index shows. */
  number: number;
  reading: Reading;
  lemmas: LemmaPanel[];
  /** Where this form sits in a returned lemma's table, if one lists it. */
  lemmaRow: LemmaRow | undefined;
  /**
   * The lemma whose whole conjugation renders inside this card — frame 03, a
   * page whose only reading is a verb form. With several readings a form card
   * points to its lemma and carries no table (frame 01, reading 3).
   */
  inlineParadigm: Reading | undefined;
}

export interface WordPage {
  /** The headword as the source spells it, or the query when no record is about it. */
  headword: string;
  cards: [Card, ...Card[]];
  /** Returned records rendered as a lemma panel rather than a card. */
  absorbed: Reading[];
  wordFacts: WordFacts;
  /** Every headword a card belongs to, once, for the page's Source links. */
  sourceWords: string[];
}

/**
 * Direct readings stay in the source's order: a word with a base reading
 * leads with it, as in the design's sale and studente frames. When only a
 * form-of record matches the queried headword, it leads.
 */
export function pageOrder(readings: readonly Reading[]): Reading[] {
  if (readings.some((reading) => reading.isAboutQuery && !isFormOfReading(reading))) {
    return [...readings];
  }
  return [
    ...readings.filter((reading) => isFormOfReading(reading)),
    ...readings.filter((reading) => !isFormOfReading(reading)),
  ];
}

const candidateIds = (link: LemmaLink): number[] =>
  link.kind === "candidates" ? link.candidates.map((candidate) => candidate.recordId) : [];

/** The row of `lemma`'s own table the lookup matched the query against. */
function matchedRow(lemma: Reading): SourceForm | undefined {
  const { formPointers } = searchedSpellings(lemma);
  return lemma.forms.find((form) => formPointers.has(form.ref.jsonPointer));
}

export function wordPage(query: string, readings: readonly [Reading, ...Reading[]]): WordPage {
  const ordered = pageOrder(readings);
  const about = ordered.filter((reading) => reading.isAboutQuery);

  // Only a record that lists the query, and that a reading about the query
  // names as its lemma, is taken into that reading's panel.
  const named = new Set(about.flatMap((reading) => reading.lemmaLinks.flatMap(candidateIds)));
  const absorbed = ordered.filter((reading) => !reading.isAboutQuery && named.has(reading.recordId));
  const shown = ordered.filter((reading) => !absorbed.includes(reading));

  const cards = shown.map((reading, i): Card => {
    const lemmas = reading.lemmaLinks.map((link) => ({
      link,
      returned: absorbed.filter((candidate) => candidateIds(link).includes(candidate.recordId)),
    }));
    const lemmaRow = lemmas
      .flatMap((panel) => panel.returned)
      .sort((a, b) => Number(b.pos === reading.pos) - Number(a.pos === reading.pos))
      .flatMap((lemma) => {
        const form = matchedRow(lemma);
        return form === undefined ? [] : [{ lemma, form }];
      })[0];
    return { number: i + 1, reading, lemmas, lemmaRow, inlineParadigm: undefined };
  });

  // Frame 03: a page whose one card is a verb form carries its lemma's table.
  if (cards.length === 1) {
    const [only] = cards;
    if (only.reading.pos === "verb" && only.lemmaRow?.lemma.pos === "verb") {
      only.inlineParadigm = only.lemmaRow.lemma;
    }
  }

  const [first, ...rest] = cards;
  if (first === undefined) throw new Error("a found result renders at least one card");

  return {
    headword: about[0]?.word ?? query,
    cards: [first, ...rest],
    absorbed,
    wordFacts: mergeWordFacts(about),
    sourceWords: [...new Set(shown.map((reading) => reading.word))],
  };
}

/**
 * The headword-level fields, once for the word.
 *
 * The source repeats them on every record of a headword, byte for byte on the
 * words checked (`andare`, `sale`), so the union is normally one record's copy.
 * A union rather than the first record's copy is what keeps a record that did
 * differ from being dropped without a word.
 */
function mergeWordFacts(readings: readonly Reading[]): WordFacts {
  const distinct = <T>(items: T[], key: (item: T) => string): T[] => {
    const seen = new Map<string, T>();
    for (const item of items) if (!seen.has(key(item))) seen.set(key(item), item);
    return [...seen.values()];
  };
  const related = (pick: (facts: WordFacts) => RelatedWord[]): RelatedWord[] => {
    const byWord = new Map<string, RelatedWord>();
    for (const word of readings.flatMap((reading) => pick(reading.wordFacts))) {
      const existing = byWord.get(word.word);
      if (existing) existing.refs.push(...word.refs);
      else byWord.set(word.word, { word: word.word, refs: [...word.refs] });
    }
    return [...byWord.values()];
  };
  const all = <T>(pick: (facts: WordFacts) => T[]): T[] => readings.flatMap((reading) => pick(reading.wordFacts));

  return {
    pronunciations: distinct<Pronunciation>(all((facts) => facts.pronunciations), (p) => `${p.ipa}\u0000${p.note}`),
    hyphenations: distinct<Hyphenation>(all((facts) => facts.hyphenations), (h) => h.parts.join("\u0000")),
    etymologies: distinct<SourceText>(all((facts) => facts.etymologies), (e) => e.text),
    synonyms: related((facts) => facts.synonyms),
    antonyms: related((facts) => facts.antonyms),
    derived: related((facts) => facts.derived),
  };
}
