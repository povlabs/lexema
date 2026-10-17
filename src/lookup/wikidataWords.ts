// The Wikidata words a dictionary serves (ADR 0033, #812): Italian lexemes
// from Wikidata, read from `wikidata_word` through `wikidata_word_key` by any
// spelling of the lexeme, lemma or form, and only a lexeme's newest snapshot.
// A lookup reads them in the statement that reads the hand-kept readings and
// the name entries (src/lookup/besideSource.ts), so they cost no statement
// more, and shows them for a spelling only when no Wiktionary reading answers
// it (src/lookup/lookup.ts, src/lookup/batch.ts), so Wiktionary wins wherever
// both have a word. `/exists` reads them on their own (`wikidataWordsOf`).
// Each is a reading of its own: its lemma, the part of speech its lexical
// category maps to, its forms the feature table maps (#833,
// src/wikidataWords/formFeatures.ts), and the Italian glosses of its senses
// as its definitions.
// `flebo` reads lexeme L1261627.

import { isLexicalCategory, partOfSpeechOf, type LexicalCategory } from "../wikidataWords/lexicalCategories.js";
import { mapRawTag, mapStructuralTag } from "../import/grammarPolicy.js";
import { formTagsOf } from "../wikidataWords/formFeatures.js";
import { normalizeItalianExact } from "../italian/normalize.js";
import { lexemeNumber, type LexemeForm as SnapshotForm, type LexemeGloss as SnapshotGloss } from "../wikidataWords/wikidataWord.js";

export { lexemePageUrl } from "../wikidataWords/wikidataWord.js";
import { readingPartOfSpeech } from "./articles.js";
import { keyedRead, readKeys, type DictionaryRead, type KeyedRead, type LookupDatabase } from "./database.js";
import { isDeclaredLemma } from "./declaredLemma.js";
import { NO_ENTRY_FACTS } from "./pageFacts.js";
import type { DictionaryTables } from "./served.js";
import type { GrammarClaim, LexemeEvidence, LexemeFormRef, LexemeRef, Reading, SourceForm } from "./types.js";

/** One Wikidata word, as `WIKIDATA_WORD_SQL` reads it. */
interface WordRow {
  lexeme: `L${number}`;
  snapshot: string;
  lemma: string;
  category: string;
  /** JSON: `[{"form", "spelling", "features"}]`. */
  forms: string;
  /** JSON: `[{"sense", "gloss"}]`. */
  glosses: string;
}

/** The newest row of each lexeme a key spells. */
const NEWEST = `k.snapshot = (SELECT MAX(l.snapshot) FROM wikidata_word l WHERE l.lexeme = k.lexeme)`;

/** Every Wikidata word a key spells, each lexeme's newest row. Exported so a test can assert the plan. */
export const WIKIDATA_WORD_SQL: DictionaryRead = `SELECT w.lexeme, w.snapshot, w.lemma, w.category, w.forms, w.glosses
  FROM wikidata_word_key k
  JOIN wikidata_word w ON w.lexeme = k.lexeme AND w.snapshot = k.snapshot
 WHERE k.word_key = ?1 AND ${NEWEST}`;

/** `WIKIDATA_WORD_SQL` for many keys in one read, light: each word named, without its glosses. Exported so a test can assert the plan. */
export const WIKIDATA_WORD_HEADS_SQL: KeyedRead = keyedRead(`SELECT k.word_key AS set_key, w.lexeme, w.lemma, w.category
  FROM wikidata_word_key k
  JOIN wikidata_word w ON w.lexeme = k.lexeme AND w.snapshot = k.snapshot
 WHERE k.word_key IN (SELECT value FROM json_each(?1)) AND ${NEWEST}`);

/** One Wikidata word named, as `WIKIDATA_WORD_HEADS_SQL` reads it. */
type HeadRow = Pick<WordRow, "lexeme" | "lemma" | "category"> & { set_key: string };

/** A Wikidata word named, without its glosses: what a batch candidate carries (src/lookup/batch.ts). */
export interface WikidataWordHead {
  lexeme: `L${number}`;
  releaseId: string;
  word: string;
  pos: string;
  posTitle: string;
}

/** The Wikidata words of a dictionary. */
export interface WikidataWords {
  /** The words spelled as the query key, in lexeme order. */
  readings(key: string): Promise<Reading[]>;
  /** The words of each of `keys`, named, in the order `readings` gives them: one statement for every key. */
  heads(keys: readonly string[]): Promise<Map<string, WikidataWordHead[]>>;
}

const NONE: WikidataWords = { readings: async () => [], heads: async () => new Map() };

/** A row whose category the table maps, typed so; a row stored under a category the table no longer maps is not served. */
const mapped = <T extends { category: string }>(rows: readonly T[]): (T & { category: LexicalCategory })[] =>
  rows.filter((row): row is T & { category: LexicalCategory } => isLexicalCategory(row.category));

/** Lexeme order: an older lexeme (lower number) first. */
const inLexemeOrder = <T extends { lexeme: `L${number}` }>(rows: readonly T[]): T[] => [...rows].sort((a, b) => lexemeNumber(a.lexeme) - lexemeNumber(b.lexeme));

/** The dictionary's Wikidata words; none on one seeded before their tables (#812), which is never sent a statement that names them. */
export function wikidataWordsOf(db: LookupDatabase, releaseId: string, tables: Pick<DictionaryTables, "wikidataWords">): WikidataWords {
  if (!tables.wikidataWords) return NONE;
  return {
    readings: async (key) => inLexemeOrder(mapped(await db.all<WordRow>(WIKIDATA_WORD_SQL, [key]))).map((row) => wikidataWordReading(releaseId, row, key)),
    heads: async (keys) => {
      const byKey = new Map<string, WikidataWordHead[]>();
      for (const row of mapped(await readKeys<HeadRow>(db, WIKIDATA_WORD_HEADS_SQL, keys))) {
        byKey.set(row.set_key, [...(byKey.get(row.set_key) ?? []), wikidataWordHeadOf(releaseId, row)]);
      }
      return new Map([...byKey].map(([key, heads]) => [key, inLexemeOrder(heads)]));
    },
  };
}

/**
 * `words`, the Wikidata words of a key no other Wiktionary reading answers,
 * or none when the page answers the key as a declared lemma (#453), which is
 * a Wiktionary reading too, so the declared lemma's page stays. The declared
 * lemma is read only for a key some Wikidata word spells.
 */
export async function unlessDeclaredLemma<T>(
  db: LookupDatabase,
  releaseId: string,
  tables: Pick<DictionaryTables, "corrections" | "edgeCorrections">,
  key: string,
  words: readonly T[],
): Promise<T[]> {
  if (words.length === 0 || (await isDeclaredLemma(db, releaseId, key, tables))) return [];
  return [...words];
}

/** A Wikidata word named by its row: what a batch candidate carries. */
export const wikidataWordHeadOf = (releaseId: string, row: Pick<WordRow, "lexeme" | "lemma"> & { category: LexicalCategory }): WikidataWordHead => {
  const { pos, posTitle } = partOfSpeechOf(row.category);
  return { lexeme: row.lexeme, releaseId, word: row.lemma, pos, posTitle };
};

/**
 * A Wikidata word's forms as a record's `forms[]` entries (#833): each form
 * whose every feature the table maps (`formTagsOf`), its tags read off them
 * and pointing at the form, at its index in the lexeme's forms. A form with a
 * feature the table does not map (`trucchetto`, a diminutive; `prof.`, an
 * abbreviation) is left off, never guessed.
 */
export function wikidataFormsOf(ref: LexemeRef, forms: readonly SnapshotForm[]): SourceForm[] {
  return forms.flatMap((form, index): SourceForm[] => {
    const tags = formTagsOf(form.features);
    if (tags === undefined) return [];
    const at: LexemeFormRef = { ...ref, form: form.form };
    const claims = [...tags.tags.map(mapStructuralTag), ...tags.rawTags.map(mapRawTag)].map((claim): GrammarClaim => ({ ...claim, ref: at }));
    return [{ index, surface: form.spelling, ref: at, formSource: null, claims }];
  });
}

/**
 * Where `key` spells a Wikidata word (#851): its lemma, then each form it
 * spells, in the lexeme's order, as a record's evidence names its headword
 * and its `forms[]` entries. A form the table leaves off (`prof`, an
 * abbreviation) is named too, since the key spells it; no cell holds it.
 */
export function wikidataEvidenceOf(ref: LexemeRef, lemma: string, forms: readonly SnapshotForm[], key: string): LexemeEvidence[] {
  return [
    ...(normalizeItalianExact(lemma) === key ? [{ origin: "headword", surface: lemma, ref, formSource: null } as const] : []),
    ...forms
      .filter((form) => normalizeItalianExact(form.spelling) === key)
      .map((form) => ({ origin: "embedded-form", surface: form.spelling, ref: { ...ref, form: form.form }, formSource: null }) as const),
  ];
}

/**
 * One Wikidata word as a reading of `key`: its lemma, its part of speech, its
 * forms and its glosses, and nothing else, since it keys to no record. Its
 * evidence is where `key` spells it, so, as a record, it is about the query
 * when the key spells its lemma, and otherwise lists the query in its forms
 * (#851): the page marks the form, and the API names it, as a record's.
 */
export function wikidataWordReading(releaseId: string, row: Omit<WordRow, "category"> & { category: LexicalCategory }, key: string): Reading {
  const ref: LexemeRef = { releaseId, wiki: "www.wikidata.org", lexeme: row.lexeme, snapshot: row.snapshot };
  const { pos, posTitle } = partOfSpeechOf(row.category);
  const { claims, wordFacts, lemmaLinks } = NO_ENTRY_FACTS;
  const glosses = JSON.parse(row.glosses) as SnapshotGloss[];
  const lexemeForms = JSON.parse(row.forms) as SnapshotForm[];
  const forms = wikidataFormsOf(ref, lexemeForms);
  const evidence = wikidataEvidenceOf(ref, row.lemma, lexemeForms, key);
  return {
    lexeme: row.lexeme, lexemeGlosses: glosses.map(({ sense, gloss }) => ({ sense, text: gloss })), ref, word: row.lemma,
    ...readingPartOfSpeech(pos, row.lemma, claims), posTitle,
    isAboutQuery: evidence.some((occurrence) => occurrence.origin === "headword"), evidence, senses: [], recovered: [], forms, wordFacts, translations: [],
    grammar: { record: claims, byForm: new Map(forms.map((form) => [form.index, form.claims])), bySense: new Map() },
    lemmaLinks, inflections: [], reviews: [],
  };
}
