// The fields a page shows that the lookup tables do not carry, read straight off
// the record's own archive line.
//
// `source_record_json.raw_json` is the line exactly as the release wrote it, so
// everything here is a copy of source text with the pointer it was read from —
// nothing is cleaned, translated or completed, except that Wikizionario's
// missing-field placeholder is taken out of the hyphenation and the etymologies
// (`withoutPlaceholder`, #255), because it is a template, not data, and that an
// expression's phrase is tidied by the item rules of src/italian/expressions.ts
// (ADR 0019). What the tables already hold
// (senses, glosses, forms, grammar) is not re-read here: this module owns only
// the pronunciation, the hyphenation, the etymologies, the three related-word
// lists and each sense's examples, which is the data half of #20, and the
// `proverbs[]` items a page lists as *Expressions* (#213).
//
// The line is untrusted JSON as far as the type system knows, so every field is
// checked for the shape it must have and skipped when it does not have it. A
// field the source left out is an empty list, never a placeholder.
//
// A lookup reads the line cut down to `LINE_FIELDS` in SQL, or a lemma's to
// `EXPRESSION_FIELDS` (src/lookup/projection.ts, #646). The cut keeps every
// list index, so each pointer below names the same value in the stored line.

import { expressionPhrase } from "../italian/expressions.js";
import { withoutPlaceholder } from "../italian/placeholder.js";
import type { ReadFields } from "../update/content.js";
import type {
  ExpressionItem,
  Hyphenation,
  Pronunciation,
  RelatedWord,
  SynonymEntry,
  SourceRef,
  SourceText,
  WordFacts,
} from "./types.js";

/** What one archive line gives a reading beyond the lookup tables. */
export interface SourceRecordFields {
  /** Every word fact but the expressions, which need the index to say which phrases are headwords. */
  wordFacts: Omit<WordFacts, "expressions">;
  /** `proverbs[]`, one per item that gives a row, in source order. */
  expressionItems: ExpressionItem[];
  /** Each sense's examples, keyed by the sense's index in `senses[]`. */
  examplesBySense: Map<number, SourceText[]>;
}

type Json = unknown;

/**
 * The fields of a reading's archive line a lookup reads: those this module
 * reads, and `senses[].glosses`, by which a recovered definition finds the
 * sense it leads (`recordGlosses`, src/italian/recovery.ts).
 */
export const LINE_FIELDS = {
  sounds: { each: { ipa: "whole", sense: "whole" } },
  hyphenations: { each: { parts: "whole" } },
  etymology_texts: "whole",
  synonyms: { each: { word: "whole", raw_tags: "whole" } },
  antonyms: { each: { word: "whole" } },
  derived: { each: { word: "whole" } },
  proverbs: { each: { word: "whole", sense: "whole" } },
  senses: { each: { glosses: "whole", examples: { each: { text: "whole" } } } },
} as const satisfies ReadFields;

/** The fields of a lemma's archive line a lookup reads: its expressions. */
export const EXPRESSION_FIELDS = { proverbs: LINE_FIELDS.proverbs } as const satisfies ReadFields;

declare const cutTo: unique symbol;

/**
 * An archive line as a statement returned it, cut down to `Fields`
 * (`projectedJsonSql`). A line cut for its expressions has no sounds to read,
 * so it is not a line `readSourceRecord` takes.
 */
export type CutLine<Fields extends ReadFields> = string & { readonly [cutTo]: Fields };

/** A reading's line: every field `readSourceRecord` and the recovered glosses read. */
export type ReadingLine = CutLine<typeof LINE_FIELDS>;

/** A line cut to its expressions: a lemma's, or a reading's, which holds them too. */
export type ExpressionLine = CutLine<typeof EXPRESSION_FIELDS> | ReadingLine;

const isObject = (value: Json): value is Record<string, Json> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const arrayAt = (record: Record<string, Json>, key: string): Json[] => {
  const value = record[key];
  return Array.isArray(value) ? value : [];
};

const nonEmptyString = (value: Json): value is string =>
  typeof value === "string" && value.trim() !== "";

/**
 * Read one record's archive line.
 *
 * `ref` makes a pointer into this same line, so every value carries the
 * release, line and digest of the record it came from.
 */
export function readSourceRecord(line: ReadingLine, ref: (pointer: string) => SourceRef): SourceRecordFields {
  return readSourceFields(JSON.parse(line), ref);
}

/** A line's `proverbs[]` items, as `readSourceRecord` reads them. */
export function readExpressionItems(line: ExpressionLine, ref: (pointer: string) => SourceRef): ExpressionItem[] {
  const parsed: Json = JSON.parse(line);
  return isObject(parsed) ? expressionItems(parsed, ref) : [];
}

/** `readSourceRecord` over a line already parsed. */
export function readSourceFields(parsed: Json, ref: (pointer: string) => SourceRef): SourceRecordFields {
  if (!isObject(parsed)) {
    return { wordFacts: emptyWordFacts(), expressionItems: [], examplesBySense: new Map() };
  }

  return {
    wordFacts: {
      pronunciations: pronunciations(parsed, ref),
      hyphenations: hyphenations(parsed, ref),
      etymologies: arrayAt(parsed, "etymology_texts").flatMap((text, i) => {
        const real = typeof text === "string" ? withoutPlaceholder(text) : undefined;
        return real === undefined ? [] : [{ text: real, ref: ref(`/etymology_texts/${i}`) }];
      }),
      synonyms: relatedWords(parsed, "synonyms", ref),
      synonymList: synonymList(parsed, ref),
      antonyms: relatedWords(parsed, "antonyms", ref),
      derived: relatedWords(parsed, "derived", ref),
    },
    expressionItems: expressionItems(parsed, ref),
    examplesBySense: examples(parsed, ref),
  };
}

export function emptyWordFacts(): Omit<WordFacts, "expressions"> {
  return { pronunciations: [], hyphenations: [], etymologies: [], synonyms: [], synonymList: [], antonyms: [], derived: [] };
}

/**
 * Every `sounds[].ipa`, with the qualifier the source wrote beside it.
 *
 * `casa` gives two, `/ˈkaza/` for `italiano settentrionale` and `/ˈkasa/` for
 * `italiano standard`; the qualifier is what tells them apart, so it travels
 * with the transcription rather than being dropped.
 */
function pronunciations(record: Record<string, Json>, ref: (pointer: string) => SourceRef): Pronunciation[] {
  return arrayAt(record, "sounds").flatMap((sound, i) => {
    if (!isObject(sound) || !nonEmptyString(sound.ipa)) return [];
    return [{
      ipa: sound.ipa,
      note: nonEmptyString(sound.sense) ? sound.sense : null,
      ref: ref(`/sounds/${i}/ipa`),
    }];
  });
}

/**
 * Every `hyphenations[].parts` with at least one real part, parts verbatim. A
 * part that is only the placeholder (`→ Divisione in sillabe mancante. …`)
 * divides nothing, so an entry holding only that is left out.
 */
function hyphenations(record: Record<string, Json>, ref: (pointer: string) => SourceRef): Hyphenation[] {
  return arrayAt(record, "hyphenations").flatMap((entry, i) => {
    if (!isObject(entry)) return [];
    const parts = arrayAt(entry, "parts").flatMap((part) => {
      const real = typeof part === "string" ? withoutPlaceholder(part) : undefined;
      return real === undefined ? [] : [real];
    });
    const [first, ...rest] = parts;
    return first === undefined ? [] : [{ parts: [first, ...rest], ref: ref(`/hyphenations/${i}/parts`) }];
  });
}

/**
 * One related-word list, one entry per distinct spelling.
 *
 * The source repeats a word once per sense it relates to — `sale` lists 86
 * synonyms and 70 spellings — and a reader is owed each spelling once. Every
 * pointer is kept on the entry, so the collapse loses nothing about where a
 * word came from; the same shape `InflectionOf` takes for the same reason.
 */
function relatedWords(
  record: Record<string, Json>,
  key: "synonyms" | "antonyms" | "derived",
  ref: (pointer: string) => SourceRef,
): RelatedWord[] {
  const byWord = new Map<string, RelatedWord>();
  arrayAt(record, key).forEach((entry, i) => {
    if (!isObject(entry) || !nonEmptyString(entry.word)) return;
    const pointer = ref(`/${key}/${i}/word`);
    const existing = byWord.get(entry.word);
    if (existing) existing.refs.push(pointer);
    else byWord.set(entry.word, { word: entry.word, refs: [pointer] });
  });
  return [...byWord.values()];
}

/** Every `synonyms[]` entry with a word, uncollapsed, with its `raw_tags` verbatim. */
function synonymList(record: Record<string, Json>, ref: (pointer: string) => SourceRef): SynonymEntry[] {
  return arrayAt(record, "synonyms").flatMap((entry, i) =>
    isObject(entry) && nonEmptyString(entry.word)
      ? [{ word: entry.word, rawTags: arrayAt(entry, "raw_tags").filter(nonEmptyString), ref: ref(`/synonyms/${i}/word`) }]
      : [],
  );
}

/**
 * Every `proverbs[]` item with a `word` that gives a row: its phrase under the
 * item rules, its `sense` verbatim. An item whose word has no letters gives none.
 */
function expressionItems(record: Record<string, Json>, ref: (pointer: string) => SourceRef): ExpressionItem[] {
  return arrayAt(record, "proverbs").flatMap((item, i) => {
    if (!isObject(item) || !nonEmptyString(item.word)) return [];
    const phrase = expressionPhrase(item.word);
    if (phrase === undefined) return [];
    return [{ phrase, meaning: nonEmptyString(item.sense) ? item.sense : null, ref: ref(`/proverbs/${i}`) }];
  });
}

/** `senses[i].examples[j].text`, by sense index, in source order. */
function examples(record: Record<string, Json>, ref: (pointer: string) => SourceRef): Map<number, SourceText[]> {
  const bySense = new Map<number, SourceText[]>();
  arrayAt(record, "senses").forEach((sense, i) => {
    if (!isObject(sense)) return;
    const texts = arrayAt(sense, "examples").flatMap((example, j) =>
      isObject(example) && nonEmptyString(example.text)
        ? [{ text: example.text, ref: ref(`/senses/${i}/examples/${j}/text`) }]
        : [],
    );
    if (texts.length > 0) bySense.set(i, texts);
  });
  return bySense;
}
