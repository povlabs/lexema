// What one word's page is made of, decided before anything renders.
//
// A lookup returns every record the query matches, and each is a reading on
// the page. Some are *about* the searched word (`isAboutQuery`); some merely
// list it in their own table. A reading that is a form of a verb carries that
// verb's table when the table lists the query: `andavano` shows *Forms of
// andare*. The lookup does not return the lemma as a record of its own, so
// nothing is counted twice: the readings are the lookup's records, and the
// tables are their lemmas'.

import { isFormOfReading, isVerbReading } from "@lexema/lookup/types.ts";
import type {
  LemmaListing,
  LemmaTarget,
  Pronunciation,
  Hyphenation,
  Reading,
  RelatedWord,
  SourceText,
  WordFacts,
} from "@lexema/lookup/types.ts";

/**
 * A verb lemma whose table lists the searched form: `andare` for `andavano`.
 * Its whole conjugation renders under the form's reading, as *Forms of andare*,
 * opened where the form sits (design-system-manifest.md § "The result").
 */
export interface LemmaTable {
  lemma: LemmaTarget;
  listing: LemmaListing;
}

export interface PageReading {
  /** 1-based, and the same number the jump links show. */
  number: number;
  reading: Reading;
  /**
   * The verb lemmas whose tables list the query, one per distinct table. Two
   * records with the same table (`chiusi` names `chiudere` twice) show it once;
   * tables that differ each show.
   */
  lemmaTables: LemmaTable[];
}

export interface WordPage {
  /** The headword as the source spells it, or the query when no record is about it. */
  headword: string;
  readings: [PageReading, ...PageReading[]];
  wordFacts: WordFacts;
  /**
   * Every Wiktionary page the readings and lemma tables on this page come from,
   * once each, for the page's Source links (ADR 0009).
   */
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

/** What a table shows: each form's spelling and the grammar the source states for it, in order. */
function tableKey(listing: LemmaListing): string {
  return JSON.stringify(
    listing.forms.map((form) => [
      form.surface,
      form.claims.map((claim) => (claim.status === "missing" ? "" : claim.sourceText)),
    ]),
  );
}

/**
 * The verb lemmas whose own tables list the query, for a verb reading that is
 * a form of them: every candidate of every link, once per distinct table.
 */
function lemmaTablesOf(reading: Reading): LemmaTable[] {
  if (!isVerbReading(reading)) return [];
  const tables = new Map<string, LemmaTable>();
  for (const link of reading.lemmaLinks) {
    if (link.kind !== "candidates") continue;
    for (const lemma of link.candidates) {
      if (lemma.pos !== "verb" || lemma.listing === undefined) continue;
      const key = `${lemma.word}\u0000${tableKey(lemma.listing)}`;
      if (!tables.has(key)) tables.set(key, { lemma, listing: lemma.listing });
    }
  }
  return [...tables.values()];
}

export function wordPage(query: string, readings: readonly [Reading, ...Reading[]]): WordPage {
  const ordered = pageOrder(readings);
  const about = ordered.filter((reading) => reading.isAboutQuery);
  const entries = ordered.map((reading, i): PageReading => ({ number: i + 1, reading, lemmaTables: lemmaTablesOf(reading) }));
  const [first, ...rest] = entries;
  if (first === undefined) throw new Error("a found result renders at least one reading");

  return {
    headword: about[0]?.word ?? query,
    readings: [first, ...rest],
    wordFacts: mergeWordFacts(about),
    sourceWords: [
      ...new Set(entries.flatMap((entry) => [entry.reading.word, ...entry.lemmaTables.map((table) => table.lemma.word)])),
    ],
  };
}

/**
 * The headword-level fields, once for the word.
 *
 * The source usually repeats them on every record of a headword, but not
 * always: 133 of the 16,792 headwords with several records in release
 * `it-0c432803` differ (docs/WEB.md). A union rather than the first record's
 * copy is what keeps a record that differs from being dropped without a word.
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
