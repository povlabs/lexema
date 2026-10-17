// One Wikidata word (ADR 0033, #812): an Italian lexeme from Wikidata (CC0),
// as imported. Its lemma, its lexical category (and so its part of speech),
// the grammatical genders the lexeme states (P5185, ADR 0033's 2026-10-17
// amendment, #849), its forms with their grammatical features, and the
// Italian glosses of its senses; glosses in other languages are not kept. `wikidataWord` is the only
// way to make one, so a lexeme with no lemma, of a category the table does not
// map, or with a form or sense of another lexeme, is not a value the
// dictionary can hold. `paralimpico` is lexeme L1247138.

import { normalizeItalianExact } from "../italian/normalize.js";
import { isLexicalCategory, partOfSpeechOf, type LexicalCategory } from "./lexicalCategories.js";
import type { StatedPartOfSpeech } from "../italian/partOfSpeech.js";

/** A lexeme id: `L1247138`. */
export type LexemeId = `L${number}`;

/** One form of a lexeme: its id, its Italian spelling and the grammatical features Wikidata states for it, in its order. */
export interface LexemeForm {
  form: `L${number}-F${number}`;
  spelling: string;
  features: `Q${number}`[];
}

/** The Italian gloss of one sense of a lexeme, and the sense's id. */
export interface LexemeGloss {
  sense: `L${number}-S${number}`;
  gloss: string;
}

/** What a Wikidata word is made from; `wikidataWord` checks it. */
export interface WikidataWordSpec {
  lexeme: LexemeId;
  /** The Italian lemma, as Wikidata states it. */
  lemma: string;
  category: LexicalCategory;
  /**
   * The lexeme's grammatical genders (P5185), as Wikidata items in its order:
   * `targhetta` states femminile (Q1775415) once for the whole word, not on
   * its forms. Empty when it states none, as most verbs and adjectives.
   */
  genders: `Q${number}`[];
  /** Every form with an Italian spelling, in Wikidata's order. */
  forms: LexemeForm[];
  /** Every sense with an Italian gloss, in Wikidata's order; empty for most lexemes. */
  glosses: LexemeGloss[];
}

declare const checked: unique symbol;

/** A Wikidata word `wikidataWord` checked; no other value has this type. */
export type WikidataWord = Readonly<WikidataWordSpec> & { readonly [checked]: true };

/** Why a spec is not a Wikidata word. */
export class InvalidWikidataWord extends Error {
  override readonly name = "InvalidWikidataWord";
}

const LEXEME = /^L[1-9]\d*$/;
const ITEM = /^Q[1-9]\d*$/;

/** Empty, or only spaces: no spelling or gloss. A value with spaces around it is kept as Wikidata states it. */
const blank = (text: string): boolean => text.trim() === "";

export function wikidataWord(spec: WikidataWordSpec): WikidataWord {
  const refuse = (why: string): never => {
    throw new InvalidWikidataWord(`Wikidata word ${JSON.stringify(spec.lexeme)}: ${why}`);
  };
  if (!LEXEME.test(spec.lexeme)) refuse("not a lexeme id");
  if (blank(spec.lemma)) refuse("its lemma is empty");
  if (!isLexicalCategory(spec.category)) refuse(`${spec.category} is not a lexical category the table maps`);
  for (const gender of spec.genders) if (!ITEM.test(gender)) refuse(`its gender ${gender} is not an item`);
  const own = (id: string, kind: "F" | "S"): boolean => new RegExp(`^${spec.lexeme}-${kind}[1-9]\\d*$`).test(id);
  for (const form of spec.forms) {
    if (!own(form.form, "F")) refuse(`${form.form} is not one of its forms`);
    if (blank(form.spelling)) refuse(`form ${form.form}'s spelling is empty`);
    for (const feature of form.features) if (!ITEM.test(feature)) refuse(`form ${form.form}'s feature ${feature} is not an item`);
  }
  for (const gloss of spec.glosses) {
    if (!own(gloss.sense, "S")) refuse(`${gloss.sense} is not one of its senses`);
    if (blank(gloss.gloss)) refuse(`sense ${gloss.sense}'s gloss is empty`);
  }
  const twice = (ids: readonly string[]): string | undefined => ids.find((id, index) => ids.indexOf(id) !== index);
  const gender = twice(spec.genders);
  if (gender !== undefined) refuse(`gender ${gender} is listed twice`);
  const form = twice(spec.forms.map((one) => one.form));
  if (form !== undefined) refuse(`form ${form} is listed twice`);
  const sense = twice(spec.glosses.map((one) => one.sense));
  if (sense !== undefined) refuse(`sense ${sense} is listed twice`);
  return Object.freeze({
    lexeme: spec.lexeme,
    lemma: spec.lemma,
    category: spec.category,
    genders: [...spec.genders],
    forms: spec.forms.map((one) => Object.freeze({ form: one.form, spelling: one.spelling, features: [...one.features] })),
    glosses: spec.glosses.map((one) => Object.freeze({ sense: one.sense, gloss: one.gloss })),
  }) as WikidataWord;
}

/** The lexeme's number, for ordering: `L1247138` is 1247138. */
export const lexemeNumber = (lexeme: LexemeId): number => Number(lexeme.slice(1));

/** The part of speech the word reads as, from its lexical category. */
export const partOfSpeechOfWord = (word: Pick<WikidataWord, "category">): StatedPartOfSpeech => partOfSpeechOf(word.category);

/**
 * Whether the word has a meaning to show: at least one Italian gloss. Only
 * such a word is served; one with none stays in the snapshot as imported and
 * is left out of the load (ADR 0033's 2026-10-12 amendment).
 */
export const hasItalianGloss = (word: Pick<WikidataWord, "glosses">): boolean => word.glosses.length > 0;

/** Every search key the word is spelled by, its lemma's first, each once: `paralimpico`, `paralimpici`, `paralimpica`, `paralimpiche`. */
export const keysOfWord = (word: Pick<WikidataWord, "lemma" | "forms">): string[] => [
  ...new Set([word.lemma, ...word.forms.map((form) => form.spelling)].map(normalizeItalianExact)),
];

/** A lexeme's page on Wikidata, which a Wikidata word's *Fonte* link and its API credit open. */
export const lexemePageUrl = (lexeme: LexemeId): string => `https://www.wikidata.org/wiki/Lexeme:${lexeme}`;

/** The parts of a lexeme of the Wikidata dump this reads: anything else it states is left as Wikidata has it. */
interface DumpLexeme {
  type?: unknown;
  id?: unknown;
  language?: unknown;
  lexicalCategory?: unknown;
  claims?: Record<string, { rank?: unknown; mainsnak?: { snaktype?: unknown; datavalue?: { value?: { id?: unknown } } } }[]>;
  lemmas?: Record<string, { value?: unknown }>;
  forms?: { id?: unknown; representations?: Record<string, { value?: unknown }>; grammaticalFeatures?: unknown }[];
  senses?: { id?: unknown; glosses?: Record<string, { value?: unknown }> }[];
}

/** Grammatical gender, the property a lexeme states its gender with. */
export const GRAMMATICAL_GENDER = "P5185";

/**
 * The items a lexeme's P5185 statements name, in its order, each once. A
 * deprecated statement, which Wikidata marks as wrong, and one with no value
 * (`novalue`, `somevalue`) name none.
 */
function gendersOfDump(entity: DumpLexeme): `Q${number}`[] {
  const items = (entity.claims?.[GRAMMATICAL_GENDER] ?? []).flatMap((claim) => {
    const id = claim.mainsnak?.datavalue?.value?.id;
    return claim.rank !== "deprecated" && claim.mainsnak?.snaktype === "value" && typeof id === "string" ? [id as `Q${number}`] : [];
  });
  return [...new Set(items)];
}

/** Italian, as Wikidata names the language of a lexeme. */
export const ITALIAN = "Q652";

/**
 * The Wikidata word a lexeme of the dump is, or undefined when it is not one
 * Lexema keeps: not Italian, with no Italian lemma, or of a category the
 * table does not map. A form with no Italian spelling and a sense with no
 * Italian gloss are left out of it; every other value is kept as stated. Of
 * the lexeme's statements only its grammatical genders (P5185) are read.
 */
export function wikidataWordOfDump(entity: DumpLexeme): WikidataWord | undefined {
  if (entity.type !== "lexeme" || entity.language !== ITALIAN) return undefined;
  const lemma = entity.lemmas?.it?.value;
  const category = entity.lexicalCategory;
  if (typeof lemma !== "string" || blank(lemma) || typeof category !== "string" || !isLexicalCategory(category)) return undefined;
  const forms = (entity.forms ?? []).flatMap((form): LexemeForm[] => {
    const spelling = form.representations?.it?.value;
    if (typeof spelling !== "string" || blank(spelling)) return [];
    const features = Array.isArray(form.grammaticalFeatures) ? (form.grammaticalFeatures as `Q${number}`[]) : [];
    return [{ form: form.id as LexemeForm["form"], spelling, features }];
  });
  const glosses = (entity.senses ?? []).flatMap((sense): LexemeGloss[] => {
    const gloss = sense.glosses?.it?.value;
    return typeof gloss === "string" && !blank(gloss) ? [{ sense: sense.id as LexemeGloss["sense"], gloss }] : [];
  });
  return wikidataWord({ lexeme: entity.id as LexemeId, lemma, category, genders: gendersOfDump(entity), forms, glosses });
}
