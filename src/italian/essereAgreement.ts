// Whether a compound spelling of a verb's table agrees with its subject's
// gender, by rule `it-essere-agreement/v1` (#676).
//
// A compound tense built on essere agrees its participle with the subject: a
// woman says `sono andata` or `mi sono accorta`, women say `siamo andate` or
// `ci siamo accorte`. The source lists only the masculine (`sono andato`,
// `mi sono accorto`). This rule reads one cell spelling and the number of the
// row it sits in:
//
//   sono andato               singular  agrees, feminine `sono andata`
//   ci siamo accorti          plural    agrees, feminine `ci siamo accorte`
//   mi sono arreso, arresosi  singular  agrees, feminine `mi sono arresa, arresosi`
//   ho mangiato               singular  does not agree: avere never agrees with the subject
//   mi arrendo                singular  does not agree: a simple tense
//   siamo andato              plural    does not agree: the ending is not the row's number
//
// The switch is the spelling, never the record's `ausiliare` line: essere's own
// record has none, and a verb with both auxiliaries lists both spellings in one
// cell (vivere: `ho vissuto`, `sono vissuto`), where only the essere one
// agrees.
//
// The rule reads only a cell's first spelling, the text before the first `, `.
// A few cells hold more than one (`mi sono arreso, arresosi`, `sono assorbito,
// assorto`); the first is always the compound, and the later ones have no
// essere form to anchor them, so they stay exactly as the source gives them.
// The first spelling agrees when it is exactly two words, a finite form of
// essere then a participle, or exactly three, a clitic then a finite form of
// essere then a participle, and the participle ends in `-o` on a singular row
// or `-i` on a plural one. The clitic is not checked against the row's person:
// the number comes from the row and the ending.
//
// The feminine is Lexema's text, built by rule (ADR 0008) when the page is
// built, and never stored (ADR 0012). Huey's ruling, 2026-10-06:
// https://github.com/povlabs/lexema/issues/676#issuecomment-6013478337

import type { VerbNumber } from "./moods.js";

/** The rule's name and version. */
export const ESSERE_AGREEMENT_RULE = "it-essere-agreement/v1" as const;

/**
 * Every one-word finite form of essere: the indicative, subjunctive and
 * conditional cells of essere's own table. Not the imperative (`sii`) and no
 * non-finite form (`essendo`, `essente`, `stato`): no compound tense is built
 * on them. test/essereAgreement.test.ts asserts this set against essere's
 * record in fixtures/dev-seed.jsonl.
 */
export const ESSERE_FINITE_FORMS: ReadonlySet<string> = new Set([
  // presente, imperfetto, passato remoto, futuro semplice
  "sono", "sei", "è", "siamo", "siete",
  "ero", "eri", "era", "eravamo", "eravate", "erano",
  "fui", "fosti", "fu", "fummo", "foste", "furono",
  "sarò", "sarai", "sarà", "saremo", "sarete", "saranno",
  // congiuntivo presente and imperfetto
  "sia", "siate", "siano",
  "fossi", "fosse", "fossimo", "fossero",
  // condizionale presente
  "sarei", "saresti", "sarebbe", "saremmo", "sareste", "sarebbero",
]);

/** The reflexive clitics a compound spelling may open with: `mi sono accorto`. */
export const ESSERE_CLITICS: ReadonlySet<string> = new Set(["mi", "ti", "si", "ci", "vi"]);

/** What joins the spellings of one cell: `mi sono arreso, arresosi`. */
const LATER_SPELLINGS = ", ";

/** The participle's ending for each gender, on a row of each number. */
const ENDING: Readonly<Record<VerbNumber, { masculine: string; feminine: string }>> = {
  singular: { masculine: "o", feminine: "a" },
  plural: { masculine: "i", feminine: "e" },
};

/** A participle: letters only, at least one before the ending. */
const PARTICIPLE = /^\p{L}{2,}$/u;

declare const agreeingBrand: unique symbol;

/**
 * A cell spelling that agrees with its subject on a row of `number`. It carries
 * a brand only this module can write, so no other module can build the feminine
 * of a spelling the rule did not read as agreeing.
 */
export interface AgreeingSpelling {
  readonly [agreeingBrand]: typeof ESSERE_AGREEMENT_RULE;
  readonly rule: typeof ESSERE_AGREEMENT_RULE;
  readonly number: VerbNumber;
  /** The spelling as the source gives it: `mi sono arreso, arresosi`. */
  readonly masculine: string;
  /** Its first spelling, the one that agrees: `mi sono arreso`. */
  readonly first: string;
  /** The spelling with its first spelling feminine: `mi sono arresa, arresosi`. */
  readonly feminine: string;
}

export type EssereAgreement = { kind: "agrees"; spelling: AgreeingSpelling } | { kind: "does-not-agree" };

const DOES_NOT_AGREE: EssereAgreement = { kind: "does-not-agree" };

/** A cell spelling's first spelling: the text before the first `, `. */
const firstSpellingOf = (spelling: string): string => spelling.split(LATER_SPELLINGS, 1)[0];

/**
 * A first spelling cut where its participle starts, when it has the rule's
 * shape: `[essere] participle` or `[clitic] [essere] participle`.
 */
function compound(first: string): { head: string; participle: string } | undefined {
  const words = first.split(" ");
  const participle = words.at(-1) ?? "";
  const [auxiliary, clitic] = words.length === 2 ? [words[0], undefined] : words.length === 3 ? [words[1], words[0]] : [undefined, undefined];
  if (auxiliary === undefined || !ESSERE_FINITE_FORMS.has(auxiliary)) return undefined;
  if (clitic !== undefined && !ESSERE_CLITICS.has(clitic)) return undefined;
  if (!PARTICIPLE.test(participle)) return undefined;
  return { head: words.slice(0, -1).join(" "), participle };
}

/** Whether `spelling`, on a row of `number`, agrees with its subject's gender. */
export function essereAgreement(spelling: string, number: VerbNumber): EssereAgreement {
  const first = firstSpellingOf(spelling);
  const parts = compound(first);
  const { masculine, feminine } = ENDING[number];
  if (parts === undefined || !parts.participle.endsWith(masculine)) return DOES_NOT_AGREE;
  const later = spelling.slice(first.length);
  const agreeing = {
    rule: ESSERE_AGREEMENT_RULE,
    number,
    masculine: spelling,
    first,
    feminine: `${parts.head} ${parts.participle.slice(0, -masculine.length)}${feminine}${later}`,
  };
  // The one place the brand is written: the spelling has just been read as agreeing.
  return { kind: "agrees", spelling: agreeing as AgreeingSpelling };
}

/** The spelling a table shows for both genders: `sono andato/a`, `mi sono arreso/a, arresosi`. */
export const bothGenders = (spelling: AgreeingSpelling): string =>
  `${spelling.first}/${ENDING[spelling.number].feminine}${spelling.masculine.slice(spelling.first.length)}`;

/**
 * How a typed query reads under the rule, when it has the rule's shape: the
 * agreeing first spelling it names, and whether it was typed as that spelling
 * (`mi sono arreso`) or as its feminine (`mi sono arresa`, `siamo andate`).
 * Undefined when it cannot name one: not two words or three with a clitic, no
 * essere form, a last word ending in none of `-o`, `-i`, `-a`, `-e`, or a
 * spelling the rule does not read as agreeing (`ho mangiata`).
 */
export type AgreeingQuery = { spelled: "masculine" | "feminine"; spelling: AgreeingSpelling };

export function agreeingQuery(typed: string): AgreeingQuery | undefined {
  // A query of several spellings is not a first spelling.
  if (typed.includes(LATER_SPELLINGS)) return undefined;
  const parts = compound(typed);
  if (parts === undefined) return undefined;
  for (const number of ["singular", "plural"] as const) {
    const { masculine, feminine } = ENDING[number];
    if (parts.participle.endsWith(masculine)) return asQuery("masculine", essereAgreement(typed, number));
    if (parts.participle.endsWith(feminine)) {
      const stem = parts.participle.slice(0, -feminine.length);
      return asQuery("feminine", essereAgreement(`${parts.head} ${stem}${masculine}`, number));
    }
  }
  return undefined;
}

const asQuery = (spelled: AgreeingQuery["spelled"], read: EssereAgreement): AgreeingQuery | undefined =>
  read.kind === "agrees" ? { spelled, spelling: read.spelling } : undefined;
