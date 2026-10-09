// Which articles a reading gets, and which silence stopped it when it gets none.
//
// The rule is `it-articles/v3` in src/italian/articles.ts and it is used exactly
// as it stands: nothing here derives an article, and nothing here widens what
// that rule accepts. What this module owns is the step before and the step
// after — reading the gender and number the *source stated about the record*,
// and the IPA it wrote for the record's own word, and turning the rule's
// refusal into the one thing that blocked it, so a page can say it in a
// sentence instead of showing an empty section.
//
// It runs once per reading, never once per query: `readingPartOfSpeech` is
// called with one record's own word and claims (src/lookup/lookup.ts), so two
// records spelled alike each get the articles of their own gender and number.

import { articlesFor, spokenOpening, type ArticleGender, type ArticleNumber } from "../italian/articles.js";
import { asserts } from "./types.js";
import type {
  ArticleWithholding,
  NonNounPos,
  Pronunciation,
  ReadingArticles,
  ReadingPartOfSpeech,
  RecordClaim,
  SourceForm,
} from "./types.js";

/** The two values `it-articles/v3` can make an article agree with. */
const AGREEING_GENDERS = ["masculine", "feminine"] as const satisfies readonly ArticleGender[];
const AGREEING_NUMBERS = ["singular", "plural"] as const satisfies readonly ArticleNumber[];

/**
 * Every distinct value the source stated for one dimension, in source order,
 * or the curated correction standing in for them (#420).
 */
function statedValues(claims: readonly RecordClaim[], dimension: string): string[] {
  const values: string[] = [];
  for (const claim of claims) {
    if (asserts(claim) && claim.dimension === dimension && !values.includes(claim.value)) {
      values.push(claim.value);
    }
  }
  return values;
}

/**
 * A reading's part of speech, carrying articles exactly when it is a noun.
 *
 * This is the one place `NonNounPos` is minted, and it is minted only on the
 * branch that has just proved the part of speech is not `noun` — which is what
 * keeps "a noun without articles" out of the type.
 *
 * `surface` is the record's own headword and never a row of its forms table:
 * `studente` lists `studente/studentessa`, which is a pair the source wrote,
 * not a word an article goes in front of.
 *
 * `pronunciations` are the record's own `sounds[].ipa`. They say how `surface`
 * is said, and so reach its articles only: a plural form's are read from its
 * spelling alone.
 */
export function readingPartOfSpeech(
  pos: string,
  surface: string,
  claims: readonly RecordClaim[],
  forms: readonly SourceForm[] = [],
  pronunciations: readonly Pronunciation[] = [],
): ReadingPartOfSpeech {
  if (pos !== "noun") return { pos: pos as NonNounPos };
  return { pos, articles: deriveArticles(surface, claims, forms, pronunciations) };
}

/**
 * The one plural spelling the source files for a singular noun, when it files
 * exactly one — and states that form's gender itself, as the record's own.
 *
 * `studente` lists `studenti` tagged masculine and plural, so the rule has both
 * halves from the source. `sale` lists `sali` tagged plural and nothing else;
 * reading the record's gender onto it would be an inference the source did not
 * make, so `sali` gets no article here.
 */
function pluralSurface(gender: ArticleGender, forms: readonly SourceForm[]): string | undefined {
  const spellings = new Set(
    forms
      .filter((form) => {
        const numbers = statedValues(form.claims, "number");
        const genders = statedValues(form.claims, "gender");
        return numbers.length === 1 && numbers[0] === "plural" && genders.length === 1 && genders[0] === gender;
      })
      .map((form) => form.surface),
  );
  return spellings.size === 1 ? [...spellings][0] : undefined;
}

/** The one agreement the record states, or the first silence or excess that stops it. */
function agreementOf(
  claims: readonly RecordClaim[],
): { gender: ArticleGender; number: ArticleNumber } | { withholding: ArticleWithholding } {
  const [gender, ...otherGenders] = statedValues(claims, "gender");
  const [number, ...otherNumbers] = statedValues(claims, "number");
  if (gender === undefined && number === undefined) return { withholding: { reason: "no-gender-or-number-stated" } };
  if (gender === undefined) return { withholding: { reason: "gender-not-stated" } };
  if (otherGenders.length > 0) {
    return { withholding: { reason: "more-than-one-gender-stated", statedGenders: [gender, ...otherGenders] as [string, string, ...string[]] } };
  }
  const agreeingGender = AGREEING_GENDERS.find((value) => value === gender);
  if (agreeingGender === undefined) {
    return { withholding: { reason: "gender-is-not-masculine-or-feminine", statedGender: gender } };
  }
  if (number === undefined) return { withholding: { reason: "number-not-stated" } };
  if (otherNumbers.length > 0) {
    return { withholding: { reason: "more-than-one-number-stated", statedNumbers: [number, ...otherNumbers] as [string, string, ...string[]] } };
  }
  // `invariable` is a number the importer states (src/import/grammarPolicy.ts)
  // and not one an article agrees with: `città` is `la città` and `le città`,
  // and choosing one would claim a number the source did not state.
  const agreeingNumber = AGREEING_NUMBERS.find((value) => value === number);
  if (agreeingNumber === undefined) {
    return { withholding: { reason: "number-is-not-singular-or-plural", statedNumber: number } };
  }
  return { gender: agreeingGender, number: agreeingNumber };
}

/** The articles for one noun reading, or the reason there are none. */
function deriveArticles(
  surface: string,
  claims: readonly RecordClaim[],
  forms: readonly SourceForm[],
  pronunciations: readonly Pronunciation[],
): ReadingArticles {
  const agreement = agreementOf(claims);
  if ("withholding" in agreement) return { status: "withheld", withholding: agreement.withholding };

  const { gender, number } = agreement;
  const own = articlesFor(surface, gender, number, spokenOpening(pronunciations.map((sound) => sound.ipa)));
  if (own.status === "withheld") {
    return { status: "withheld", withholding: { reason: "surface-not-handled", surface, cause: own.cause } };
  }

  // A singular noun's plural gets its articles from the same rule, applied to
  // the plural spelling the source itself filed — never to one built here.
  const plural = number === "singular" ? pluralSurface(gender, forms) : undefined;
  const pluralArticles = plural === undefined ? undefined : articlesFor(plural, gender, "plural");
  return {
    status: "derived",
    articles: pluralArticles?.status === "derived" ? [...own.articles, ...pluralArticles.articles] : own.articles,
  };
}
