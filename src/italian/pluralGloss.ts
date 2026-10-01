// The gloss a plural record writes about its singular: `case` says "plurale di
// casa" (#145). A noun whose own record lists no plural can take its plural
// cell from such a record, and from no other kind of form-of record: `casetta`
// says "diminutivo di casa" and is not casa's plural. This file reads that one
// shape; where the spelling goes is the grid's call
// (web/lib/dictionary/genderGrid.ts).

/** The rule's name and version. */
export const PLURAL_GLOSS_RULE = "it-plural-gloss/v1" as const;

export type PluralGlossGender = "masculine" | "feminine";

/** Each opening the rule reads, and the gender it names, if any. Longest first. */
const OPENINGS: readonly (readonly [string, PluralGlossGender | undefined])[] = [
  ["femminile plurale di ", "feminine"],
  ["plurale femminile di ", "feminine"],
  ["maschile plurale di ", "masculine"],
  ["plurale maschile di ", "masculine"],
  ["plurale di ", undefined],
];

/** What a plural gloss says: that it is a plural, and of which gender when it names one. */
export interface PluralGloss {
  /** `feminine` for "femminile plurale di casa"; undefined for a bare "plurale di casa". */
  readonly gender: PluralGlossGender | undefined;
}

/** A letter or a digit straight after the word means the gloss names a longer word. */
const WORD_GOES_ON = /^[\p{L}\p{M}\p{Nd}]/u;

/**
 * Whether `gloss` says it is a plural of `word`, and of which gender.
 *
 * The gloss has to open with one of the five openings, then `word` exactly as
 * the lemma spells it, then the end of the gloss or anything that is not a
 * letter or digit: "plurale di colpa.", "plurale di lettone (letto grande)".
 * "plurale di osso; …, si usa ossa" is not a plural of `ossa`, and
 * "plurale di cazzara, vedi cazzaro" is not a plural of `cazzaro`.
 */
export function readPluralGloss(gloss: string, word: string): PluralGloss | undefined {
  if (word === "") return undefined;
  for (const [opening, gender] of OPENINGS) {
    if (!gloss.startsWith(opening)) continue;
    const rest = gloss.slice(opening.length);
    if (!rest.startsWith(word) || WORD_GOES_ON.test(rest.slice(word.length))) return undefined;
    return { gender };
  }
  return undefined;
}
