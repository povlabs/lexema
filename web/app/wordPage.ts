// What one word's page is made of, decided before anything renders.
//
// A lookup returns every record the query matches, and each is a card. Some
// are *about* the searched word (`isAboutQuery`); some merely list it in their
// own table, and say so. A card that is a form of another word ends in its
// lemma panel, which is the whole of the reading's `lemmaLinks`: `sale`'s
// plural-of-`sala` reading names `sala`, and `sala`'s own table, which lists
// `sale`, arrives on that link as its `listing`. The lookup does not return
// `sala` as a record of its own, so there is nothing here to absorb or count
// twice: the cards are the lookup's records, and the panels are their lemmas.

import { isFormOfReading, searchedSpellings } from "@lexema/lookup/types.ts";
import type {
  LemmaTarget,
  Pronunciation,
  Hyphenation,
  Reading,
  RelatedWord,
  SourceForm,
  SourceText,
  WordFacts,
} from "@lexema/lookup/types.ts";

/**
 * The form a reading is, located inside its lemma's own table.
 *
 * `andavano`'s record says only that it is a form of `andare`; `andare`'s verb
 * record lists `andavano` at `/forms/16` with its person, number and tense. The
 * lemma's row is where those facts are stated, so a form reading reads them
 * from there — by the pointer the lookup matched, never by spelling.
 */
export interface LemmaRow {
  lemma: LemmaTarget;
  form: SourceForm;
}

export interface Card {
  /** 1-based, and the same number the reading index shows. */
  number: number;
  reading: Reading;
  /** Where this form sits in its lemma's table, if the lemma's table lists it. */
  lemmaRow: LemmaRow | undefined;
  /**
   * The lemma whose whole conjugation renders inside this card — frame 03, a
   * page whose only reading is a verb form. With several readings a form card
   * points to its lemma and carries no table (frame 01, reading 3).
   */
  inlineParadigm: LemmaTarget | undefined;
}

export interface WordPage {
  /** The headword as the source spells it, or the query when no record is about it. */
  headword: string;
  cards: [Card, ...Card[]];
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

/** The row of `lemma`'s own table the lookup matched the query against. */
function matchedRow(lemma: LemmaTarget): SourceForm | undefined {
  if (lemma.listing === undefined) return undefined;
  const { formPointers } = searchedSpellings(lemma.listing);
  return lemma.listing.forms.find((form) => formPointers.has(form.ref.jsonPointer));
}

export function wordPage(query: string, readings: readonly [Reading, ...Reading[]]): WordPage {
  const ordered = pageOrder(readings);
  const about = ordered.filter((reading) => reading.isAboutQuery);

  const cards = ordered.map((reading, i): Card => {
    const lemmaRow = reading.lemmaLinks
      .flatMap((link) => (link.kind === "candidates" ? link.candidates : []))
      // A lemma of the reading's own part of speech places it first: `sale`
      // the plural noun is a row of `sala` the noun, not of `sala` the verb.
      .sort((a, b) => Number(b.pos === reading.pos) - Number(a.pos === reading.pos))
      .flatMap((lemma) => {
        const form = matchedRow(lemma);
        return form === undefined ? [] : [{ lemma, form }];
      })[0];
    return { number: i + 1, reading, lemmaRow, inlineParadigm: undefined };
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
    wordFacts: mergeWordFacts(about),
    sourceWords: [...new Set(ordered.map((reading) => reading.word))],
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
