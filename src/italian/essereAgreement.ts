// Whether a compound spelling of a verb's table agrees with its subject's
// gender, by rule `it-essere-agreement/v1` (#676).
//
// A compound tense built on essere agrees its participle with the subject: a
// woman says `sono andata`, women say `siamo andate`. The source lists only the
// masculine (`sono andato`, `siamo andati`). This rule reads one spelling and
// the number of the row it sits in:
//
//   sono andato    singular  agrees, feminine `sono andata`
//   siamo andati   plural    agrees, feminine `siamo andate`
//   ho mangiato    singular  does not agree: avere never agrees with the subject
//   siamo andato   plural    does not agree: the ending is not the row's number
//
// The switch is the spelling, never the record's `ausiliare` line: essere's own
// record has none, and a verb with both auxiliaries lists both spellings in one
// cell (vivere: `ho vissuto`, `sono vissuto`), where only the essere one
// agrees. A spelling agrees when it is exactly two words, the first a finite
// form of essere (the closed set below) and the second a participle ending in
// `-o` on a singular row or `-i` on a plural one. Anything else stays as the
// source gives it: a reflexive spelling (`mi sono arreso, arresosi`), two
// participles (`sono assorbito, assorto`), an avere spelling.
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

/** The participle's ending for each gender, on a row of each number. */
const ENDING: Readonly<Record<VerbNumber, { masculine: string; feminine: string }>> = {
  singular: { masculine: "o", feminine: "a" },
  plural: { masculine: "i", feminine: "e" },
};

/** A participle: letters only, at least one before the ending. */
const PARTICIPLE = /^\p{L}{2,}$/u;

/**
 * A compound spelling that agrees with its subject on a row of `number`. Only
 * this module builds one, so there is no feminine of a spelling the rule did
 * not read as agreeing.
 */
export interface AgreeingSpelling {
  readonly rule: typeof ESSERE_AGREEMENT_RULE;
  readonly number: VerbNumber;
  /** The spelling as the source gives it: `sono andato`. */
  readonly masculine: string;
  /** The same spelling with the feminine ending: `sono andata`. */
  readonly feminine: string;
}

export type EssereAgreement = { kind: "agrees"; spelling: AgreeingSpelling } | { kind: "does-not-agree" };

const DOES_NOT_AGREE: EssereAgreement = { kind: "does-not-agree" };

/** Whether `spelling`, on a row of `number`, agrees with its subject's gender. */
export function essereAgreement(spelling: string, number: VerbNumber): EssereAgreement {
  const words = spelling.split(" ");
  if (words.length !== 2) return DOES_NOT_AGREE;
  const [auxiliary, participle] = words;
  const { masculine, feminine } = ENDING[number];
  if (!ESSERE_FINITE_FORMS.has(auxiliary) || !PARTICIPLE.test(participle) || !participle.endsWith(masculine)) return DOES_NOT_AGREE;
  const stem = participle.slice(0, -masculine.length);
  return { kind: "agrees", spelling: { rule: ESSERE_AGREEMENT_RULE, number, masculine: spelling, feminine: `${auxiliary} ${stem}${feminine}` } };
}

/** The spelling a table shows for both genders: `sono andato/a`, `siamo andati/e`. */
export const bothGenders = (spelling: AgreeingSpelling): string => `${spelling.masculine}/${ENDING[spelling.number].feminine}`;

/**
 * A typed spelling read as the feminine of an agreeing one: `sono andata` of
 * `sono andato` on a singular row, `siamo andate` of `siamo andati` on a
 * plural one. Undefined when it cannot be one: not two words, a second word
 * ending in neither `-a` nor `-e`, or a masculine the rule does not read as
 * agreeing (`ho mangiata`).
 */
export function feminineOf(typed: string): AgreeingSpelling | undefined {
  const words = typed.split(" ");
  if (words.length !== 2) return undefined;
  const [auxiliary, participle] = words;
  const number = (["singular", "plural"] as const).find((one) => participle.endsWith(ENDING[one].feminine));
  if (number === undefined) return undefined;
  const stem = participle.slice(0, -ENDING[number].feminine.length);
  const read = essereAgreement(`${auxiliary} ${stem}${ENDING[number].masculine}`, number);
  return read.kind === "agrees" ? read.spelling : undefined;
}
