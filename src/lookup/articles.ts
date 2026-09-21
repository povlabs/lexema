// Which articles a reading gets, and which silence stopped it when it gets none.
//
// The rule is `it-articles/v1` in src/italian/articles.ts and it is used exactly
// as it stands: nothing here derives an article, and nothing here widens what
// that rule accepts. What this module owns is the step before and the step
// after — reading the gender and number the *source stated about the record*,
// and turning the rule's refusal into the one thing that blocked it, so a page
// can say it in a sentence instead of showing an empty section.

import { generateItalianArticles } from "../italian/articles.js";
import type { ArticleWithholding, GrammarClaim, ReadingArticles } from "./types.js";

/** The two values `it-articles/v1` can make an article agree with. */
const AGREEING_GENDERS = ["masculine", "feminine"] as const;
const AGREEING_NUMBERS = ["singular", "plural"] as const;

type AgreeingGender = (typeof AGREEING_GENDERS)[number];
type AgreeingNumber = (typeof AGREEING_NUMBERS)[number];

/** What the source stated for one dimension of the record itself, if anything. */
function statedValue(claims: readonly GrammarClaim[], dimension: string): string | undefined {
  for (const claim of claims) {
    if (claim.status === "stated" && claim.dimension === dimension) return claim.value;
  }
  return undefined;
}

/**
 * The articles for one reading.
 *
 * `surface` is the record's own headword and never a row of its forms table:
 * `studente` lists `studente/studentessa`, which is a pair the source wrote,
 * not a word an article goes in front of.
 */
export function deriveReadingArticles(
  pos: string,
  surface: string,
  claims: readonly GrammarClaim[],
): ReadingArticles {
  if (pos !== "noun") return { status: "not-a-noun" };

  const gender = statedValue(claims, "gender");
  const number = statedValue(claims, "number");
  // `invariable` is a number the importer states (src/import/grammarPolicy.ts)
  // and not one an article agrees with, so it reaches the rule as no number at
  // all — the same reading src/italian/tags.ts takes.
  const agreeingGender = AGREEING_GENDERS.find((value): value is AgreeingGender => value === gender);
  const agreeingNumber = AGREEING_NUMBERS.find((value): value is AgreeingNumber => value === number);

  const { articles } = generateItalianArticles(surface, agreeingGender, agreeingNumber);
  const [first, ...rest] = articles;
  if (first !== undefined) return { status: "derived", articles: [first, ...rest] };

  return {
    status: "withheld",
    withholding: whyWithheld(surface, gender, number, agreeingGender, agreeingNumber),
  };
}

/** The first thing that stopped the rule, in the source's own terms. */
function whyWithheld(
  surface: string,
  gender: string | undefined,
  number: string | undefined,
  agreeingGender: AgreeingGender | undefined,
  agreeingNumber: AgreeingNumber | undefined,
): ArticleWithholding {
  if (gender === undefined && number === undefined) return { reason: "no-gender-or-number-stated" };
  if (gender === undefined) return { reason: "gender-not-stated" };
  if (agreeingGender === undefined) {
    return { reason: "gender-is-not-masculine-or-feminine", statedGender: gender };
  }
  if (number === undefined) return { reason: "number-not-stated" };
  if (agreeingNumber === undefined) {
    return { reason: "number-is-not-singular-or-plural", statedNumber: number };
  }
  // Both dimensions agree, so the rule read the surface itself and refused it.
  return { reason: "surface-not-handled", surface };
}
