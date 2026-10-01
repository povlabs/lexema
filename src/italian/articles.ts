// Rule `it-articles/v2`: the Italian articles for one spelling, given the
// gender and number the source stated for it — or the reason there are none.
//
// What the rule follows, and where it stops, is checked against two Treccani
// references in reports/2026-10-01-italian-articles.md: the article forms and
// the missing indefinite plural (La grammatica italiana, 2012), and which
// initial takes which form (Enciclopedia dell'Italiano, 2010, «Articolo»).
// Where the spelling does not settle the sound the article depends on, the
// rule withholds rather than guesses.

import type { ArticleDisplay } from "../core/types.js";

export type ArticleGender = ArticleDisplay["gender"];
export type ArticleNumber = ArticleDisplay["number"];

/**
 * Why a spelling gets no article even with its gender and number known.
 *
 * - `composite-surface`: more than one word, or a word joined by a hyphen,
 *   slash or apostrophe (`spina dorsale`, `e-mail`, `'ndrangheta`, `po'`).
 *   The rule attaches to single words only.
 * - `not-a-spelled-word`: a letter name, an acronym or a symbol (`x`, `mms`,
 *   `mmHg`, `mp3`), read aloud as something its letters do not spell.
 * - `initial-sound-not-settled`: the spelling does not fix the sound the
 *   article agrees with — `h`, `j`, `w`, `y`, an `i` before a vowel (`iato`
 *   or `ione`), a cluster Italian spelling does not use (`pt`, `th`, `ch`
 *   before `a`, `o`, `u`) or a letter outside the Italian alphabet.
 * - `irregular-surface`: a spelling whose articles are a listed exception, in
 *   an agreement the exception does not cover.
 */
export type SurfaceWithholding =
  | "composite-surface"
  | "not-a-spelled-word"
  | "initial-sound-not-settled"
  | "irregular-surface";

export type RuleWithholding = "missing-or-ambiguous-gender-number" | SurfaceWithholding;

export type SurfaceArticles =
  | { status: "derived"; articles: [ArticleDisplay, ...ArticleDisplay[]] }
  | { status: "withheld"; cause: SurfaceWithholding };

export type ArticleResult =
  | { articles: [ArticleDisplay, ...ArticleDisplay[]]; withheldReason?: undefined }
  | { articles: []; withheldReason: RuleWithholding };

/** Which masculine singular article an initial takes, by the reference's three groups. */
type Initial = "vowel" | "lo" | "il";

const VOWEL = "aeiouàèéìíîòóù";

/**
 * Spellings whose articles are not their initial's. Each is named by the
 * reference: "anche, isolato, gli dei" (Enciclopedia dell'Italiano, «Articolo»).
 */
const EXCEPTIONS: ReadonlyMap<string, { gender: ArticleGender; number: ArticleNumber; definite: string; partitive: string }> =
  new Map(
    ["dèi", "dei"].map((surface) => [
      surface,
      { gender: "masculine", number: "plural", definite: "gli", partitive: "degli" },
    ]),
  );

/** The surface as a single spelled word, or why it is not one. */
function spelledWord(surface: string): SurfaceWithholding | undefined {
  if (/[\s/'’‘-]/u.test(surface)) return "composite-surface";
  if (!/^\p{L}+$/u.test(surface)) return "not-a-spelled-word";
  // A capital after the first letter is an acronym or a unit (`mmHg`, `rRNA`).
  if (/^.\p{L}*\p{Lu}/u.test(surface)) return "not-a-spelled-word";
  // No vowel in any alphabet (`föhn` has one): a letter name or an acronym.
  const bare = surface.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("it-IT");
  if (!/[aeiouy]/u.test(bare)) return "not-a-spelled-word";
  return undefined;
}

/** The initial's group, or `undefined` when the spelling does not settle it. */
function initialOf(surface: string): Initial | undefined {
  const value = surface.toLocaleLowerCase("it-IT");
  // `i` before a vowel is a semivowel in `iato` (lo iato) and a vowel in
  // `ione`; the spelling is the same, so neither article is safe.
  if (new RegExp(`^i[${VOWEL}]`, "u").test(value)) return undefined;
  if (new RegExp(`^[${VOWEL}]`, "u").test(value)) return "vowel";
  // s + consonant, z, x, gn, ps, and pn by the norm the reference states.
  if (/^(?:s[bcdfghjklmnpqrstvwxz]|z|x|gn|ps|pn)/u.test(value)) return "lo";
  const ordinary = new RegExp(
    `^(?:[bcdfgklmnprstv][${VOWEL}]|[bcdfgptv][lr]|[cg]h[eèéiì]|qu)`,
    "u",
  );
  if (ordinary.test(value)) return "il";
  return undefined;
}

function display(
  kind: ArticleDisplay["kind"],
  article: string,
  surface: string,
  gender: ArticleGender,
  number: ArticleNumber,
): ArticleDisplay {
  return {
    kind,
    article,
    displayForm: article.endsWith("'") ? `${article}${surface}` : `${article} ${surface}`,
    gender,
    number,
    sourceType: "lexema-deterministic",
    rule: "it-articles/v2",
  };
}

/**
 * The articles for one spelling in one agreement.
 *
 * A singular gets its definite and its indefinite; a plural its definite and
 * its partitive, since Italian has no indefinite plural. The singular
 * partitive (`del pane`) is not given: it is used with mass nouns, and the
 * source never says whether a noun is one.
 */
export function articlesFor(surface: string, gender: ArticleGender, number: ArticleNumber): SurfaceArticles {
  const notAWord = spelledWord(surface);
  if (notAWord !== undefined) return { status: "withheld", cause: notAWord };

  const make = (kind: ArticleDisplay["kind"], article: string) => display(kind, article, surface, gender, number);

  const exception = EXCEPTIONS.get(surface.toLocaleLowerCase("it-IT"));
  if (exception !== undefined) {
    if (exception.gender !== gender || exception.number !== number) {
      return { status: "withheld", cause: "irregular-surface" };
    }
    return { status: "derived", articles: [make("definite", exception.definite), make("partitive", exception.partitive)] };
  }

  // The feminine plural is `le` and `delle` before every initial.
  if (gender === "feminine" && number === "plural") {
    return { status: "derived", articles: [make("definite", "le"), make("partitive", "delle")] };
  }

  const initial = initialOf(surface);
  if (initial === undefined) return { status: "withheld", cause: "initial-sound-not-settled" };

  if (gender === "feminine") {
    const vowel = initial === "vowel";
    return { status: "derived", articles: [make("definite", vowel ? "l'" : "la"), make("indefinite", vowel ? "un'" : "una")] };
  }
  if (number === "singular") {
    const definite = { vowel: "l'", lo: "lo", il: "il" }[initial];
    return { status: "derived", articles: [make("definite", definite), make("indefinite", initial === "lo" ? "uno" : "un")] };
  }
  const gli = initial !== "il";
  return { status: "derived", articles: [make("definite", gli ? "gli" : "i"), make("partitive", gli ? "degli" : "dei")] };
}

/** `articlesFor`, for callers that may hold no gender or no number. */
export function generateItalianArticles(surface: string, gender?: ArticleGender, number?: ArticleNumber): ArticleResult {
  if (!gender || !number) return { articles: [], withheldReason: "missing-or-ambiguous-gender-number" };
  const result = articlesFor(surface, gender, number);
  return result.status === "derived" ? { articles: result.articles } : { articles: [], withheldReason: result.cause };
}
