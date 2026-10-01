// Source text normalization (ADR 0019): fixed rewrites of source-derived text,
// so one meaning reads one way across the dictionary. The seed applies them to
// the structured rows, and a one-off update applies the same function to a
// database seeded before a rule existed (src/import/normalizeGlosses.ts,
// src/import/normalizeForms.ts, src/import/headwordLeadUpdate.ts). The
// raw line in `source_record_json` never passes through here. This is not the
// search normalization in normalize.ts, which only builds lookup keys.

import { readHeadwordLine } from "./furniture.js";

/**
 * Each source text normalization's name and version, as the seed and the
 * one-off update report it. The id says which rule stored a value, so a row
 * can be traced to the rule that changed it. Changing what a rule matches or
 * writes is a new version, never an edit of the old one.
 */
export const SOURCE_TEXT_RULES = {
  /** #257: `normalizeGloss`. */
  personOrdinalGloss: "gloss-person-ordinal/v1",
  /** #342: `normalizeFormSurface`. */
  pluralPlaceholderForm: "form-plural-placeholder/v1",
  /** #325: `withoutHeadwordLead`. */
  headwordLeadGloss: "gloss-headword-lead/v1",
} as const;

export type SourceTextRuleId = (typeof SOURCE_TEXT_RULES)[keyof typeof SOURCE_TEXT_RULES];

const ORDINAL_PERSON = /^([123])ª(?= persona(?!\p{L}))/u;
const ORDINAL_WORD = { "1": "prima", "2": "seconda", "3": "terza" } as const;

/**
 * A gloss as Lexema stores it. #257: a gloss opening "1ª/2ª/3ª persona" opens
 * "prima/seconda/terza persona", the way 499,427 glosses of release
 * `it-0c432803` already do; 177 did not. Only the opening ordinal changes, and
 * only before " persona"; a "1ª" anywhere else in the gloss stays as written.
 */
export function normalizeGloss(text: string): string {
  return text.replace(ORDINAL_PERSON, (_, digit: keyof typeof ORDINAL_WORD) => ORDINAL_WORD[digit]);
}

/**
 * A SQLite GLOB that matches every stored gloss `normalizeGloss` would change,
 * and possibly more. The one-off update reads only these rows and lets
 * `normalizeGloss` decide, so the rule is written once.
 */
export const NORMALIZABLE_GLOSS_GLOB = "[123]ª persona*";

/**
 * A gloss of `word`'s record as Lexema stores it. #325: where the headword and
 * its `( approfondimento)` link lead a definition (`palo ( approfondimento)
 * pezza onorevole…`), the gloss is the definition alone, so the page numbers it
 * like any other; 12 glosses in 11 records of release `it-0c432803`. A bare
 * headword line, stamps and all, stays as written for the page to hide
 * (`readHeadwordLine` in furniture.ts), and so does any gloss of another word.
 */
export function withoutHeadwordLead(word: string, text: string): string {
  const line = readHeadwordLine(text, word);
  return line?.kind === "lead" ? line.prose : text;
}

/**
 * A SQLite GLOB that matches every stored gloss `withoutHeadwordLead` would
 * change, and more. The one-off update reads only these rows and lets the rule
 * decide.
 */
export const HEADWORD_LEAD_GLOSS_GLOB = "* ( approfondimento)*";

/**
 * Wikizionario's empty plural template: where an editor never filled in a
 * noun's plural, the page keeps the template's prompt and the extraction lists
 * it as the plural form. In release `it-0c432803`, 110 Italian records carry it,
 * each once, always tagged `plural`.
 */
export const PLURAL_PLACEHOLDER_FORM = "inserisci qui voce al plurale";

/**
 * A `forms[].form` as Lexema stores it, or undefined when the entry is no form
 * at all. #342: the plural template is a prompt, not a spelling, so it gets no
 * lookup row and no form claims. Only the exact text matches; any other form,
 * however it reads, is kept as written.
 */
export function normalizeFormSurface(surface: string): string | undefined {
  return surface === PLURAL_PLACEHOLDER_FORM ? undefined : surface;
}
