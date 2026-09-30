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
import { labelParts, readingsNamed, splitLabel } from "./readingLabels.ts";
import { relatedItems, type RelatedItem } from "./relatedList.ts";
import type {
  FoundRoute,
  LemmaListing,
  LemmaTarget,
  Pronunciation,
  Hyphenation,
  Reading,
  RelatedWord,
  SourceRef,
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
  /** The etymologies the source ties to this reading, their bracket label dropped. */
  etymologies: SourceText[];
  /** The synonym groups the source labels with this reading's part of speech. */
  synonyms: RelatedItem[];
  /**
   * True when the search reached this record as a multi-word headword its words
   * spell (#214): `andare via` for `vado via`. The reading then names its
   * headword, as a searched form's reading names its lemma.
   */
  reachedByPhrase: boolean;
}

/** The word lists no reading took, as they show: words, and the notes among them. */
export interface WordLists {
  synonyms: RelatedItem[];
  antonyms: RelatedItem[];
  derived: RelatedItem[];
}

export interface WordPage {
  /**
   * What the page is titled: the headword, or the searched form when the
   * search reached multi-word headwords word by word (`vado via`), as a
   * searched verb form titles its own page (board 03).
   */
  heading: string;
  /** The headword as the source spells it, or the query when no record is about it. */
  headword: string;
  readings: [PageReading, ...PageReading[]];
  /** The facts about the word no reading took: shown once, after the readings. */
  wordFacts: WordFacts;
  /** `wordFacts`' synonyms, antonyms and derived words, as the page lists them. */
  wordLists: WordLists;
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

export function wordPage(query: string, readings: readonly [Reading, ...Reading[]], route: FoundRoute): WordPage {
  const byPhrase = route.kind === "phrase";
  const ordered = pageOrder(readings);
  const about = ordered.filter((reading) => reading.isAboutQuery);
  const merged = mergeWordFacts(about);
  const placed = placeWordFacts(about, merged);
  const entries = ordered.map(
    (reading, i): PageReading => ({
      number: i + 1,
      reading,
      lemmaTables: lemmaTablesOf(reading),
      etymologies: placed.etymologies.get(reading) ?? [],
      synonyms: relatedItems(placed.synonyms.get(reading) ?? []),
      reachedByPhrase: byPhrase,
    }),
  );
  const [first, ...rest] = entries;
  if (first === undefined) throw new Error("a found result renders at least one reading");
  const headword = about[0]?.word ?? query;

  return {
    heading: byPhrase ? query : headword,
    headword,
    readings: [first, ...rest],
    // A page titled with the searched phrase shows the pronunciation the source
    // records for the headword it reached, and none when the source has none
    // (Huey's updated ruling on #214, 2026-09-30).
    wordFacts: placed.rest,
    wordLists: {
      synonyms: relatedItems(placed.rest.synonyms),
      antonyms: relatedItems(placed.rest.antonyms),
      derived: relatedItems(placed.rest.derived),
    },
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
    synonymList: all((facts) => facts.synonymList),
    antonyms: related((facts) => facts.antonyms),
    derived: related((facts) => facts.derived),
  };
}

/**
 * The one reading a label names, or undefined. A label that names two
 * (`medico`'s `(aggettivo e sostantivo)`) would copy one text into both, so
 * it stays once after the readings instead (Huey: identical things show once).
 */
const onlyReading = (named: readonly Reading[]): Reading | undefined => (named.length === 1 ? named[0] : undefined);

/** A source position, the key an occurrence is placed by. */
const refKey = (ref: SourceRef): string => `${ref.lineNo}\u0000${ref.jsonPointer}`;

/**
 * Etymologies and synonym groups the source ties to one part of speech, moved
 * into the readings of that part of speech (design-system-manifest.md §
 * "Layout"). Only a word with two readings or more has anything to move.
 *
 * - An etymology moves when its bracket label names one reading on the page
 *   (`sale`: `(sostantivo plurale) vedi sala`), even when it is the word's only
 *   one (`strutto`: `(voce verbale) vedi struggere`). It shows there without
 *   the label, which the reading's heading already says.
 * - A synonym moves when a part-of-speech label earlier in its record's list
 *   opens the group it is in and names one reading (`vivere`: `sostantivo` on
 *   `esistenza`, `verbo` on `esistere`).
 *
 * Whatever is not moved stays in `rest`, verbatim, once for the word.
 */
function placeWordFacts(
  about: readonly Reading[],
  merged: WordFacts,
): { etymologies: Map<Reading, SourceText[]>; synonyms: Map<Reading, RelatedWord[]>; rest: WordFacts } {
  const etymologies = new Map<Reading, SourceText[]>();
  const synonyms = new Map<Reading, RelatedWord[]>();
  if (about.length < 2) return { etymologies, synonyms, rest: merged };

  const keptEtymologies: SourceText[] = [];
  for (const etymology of merged.etymologies) {
    const { label, rest } = splitLabel(etymology.text);
    const reading = label !== undefined ? onlyReading(readingsNamed(label, about)) : undefined;
    if (reading === undefined) keptEtymologies.push(etymology);
    // A text that was only its label says nothing the reading's heading does not.
    else if (rest !== "") etymologies.set(reading, [...(etymologies.get(reading) ?? []), { text: rest, ref: etymology.ref }]);
  }

  const placedRefs = new Set<string>();
  for (const record of about) {
    let group: Reading | undefined;
    for (const entry of record.wordFacts.synonymList) {
      const label = entry.rawTags.find((tag) => labelParts(tag).length > 0);
      if (label !== undefined) group = onlyReading(readingsNamed(label, about));
      if (group === undefined) continue;
      placedRefs.add(refKey(entry.ref));
      const words = synonyms.get(group) ?? [];
      const existing = words.find((word) => word.word === entry.word);
      if (existing === undefined) words.push({ word: entry.word, refs: [entry.ref] });
      else if (!existing.refs.some((ref) => refKey(ref) === refKey(entry.ref))) existing.refs.push(entry.ref);
      synonyms.set(group, words);
    }
  }
  const keptSynonyms = merged.synonyms.filter((word) => word.refs.some((ref) => !placedRefs.has(refKey(ref))));

  return { etymologies, synonyms, rest: { ...merged, etymologies: keptEtymologies, synonyms: keptSynonyms } };
}
