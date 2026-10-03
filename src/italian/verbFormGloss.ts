// The gloss a verb form-of record writes about its verb, read into the slot of
// a conjugation it names, by rule `it-verb-form-gloss/v1` (#453).
//
// About 9,000 Italian lemmas have no record of their own, only the bot-made
// records of their forms. Those records carry no structural slot tags: the
// person, number, mood and tense are only in the gloss text.
//
//   verbalizzo     "prima persona singolare dell'indicativo presente di verbalizzare"
//   verbalizzando  "gerundio di verbalizzare"
//   verbalizzato   "participio passato di verbalizzare"
//
// This file reads that closed set of shapes and nothing else. On it-0c432803 it
// refuses 93 of the verb edges to such lemmas and reads the rest
// (reports/2026-10-03-declared-lemmas.md).
// It is a reader of a few fixed phrases, never a parser of prose. A gloss in
// any other shape, or one that names a different word, reads as nothing, and a
// caller shows no form for it. Where a slot goes on the page is the page's call
// (web/lib/dictionary/conjugation.ts).

import type { TenseBox } from "./moods.js";

/** The rule's name and version. */
export const VERB_FORM_GLOSS_RULE = "it-verb-form-gloss/v1" as const;

export type GlossPerson = "first" | "second" | "third";
export type GlossNumber = "singular" | "plural";
export type GlossGender = "masculine" | "feminine";

/** The finite tenses a gloss of this shape names: the simple tenses of three moods. */
export type GlossTense = Extract<
  TenseBox,
  | "presente"
  | "imperfetto"
  | "passato remoto"
  | "futuro semplice"
  | "congiuntivo presente"
  | "congiuntivo imperfetto"
  | "condizionale presente"
>;

/** The slot a gloss names. Each case holds only what its shape can say. */
export type VerbFormGloss =
  | { kind: "finite"; tense: GlossTense; person: GlossPerson; number: GlossNumber }
  | { kind: "imperative"; person: GlossPerson; number: GlossNumber }
  | { kind: "gerund" }
  | { kind: "present-participle"; number: GlossNumber | undefined }
  | { kind: "past-participle"; gender: GlossGender | undefined; number: GlossNumber | undefined };

const PERSON: Record<string, GlossPerson> = { prima: "first", seconda: "second", terza: "third" };
const NUMBER: Record<string, GlossNumber> = { singolare: "singular", plurale: "plural" };
const GENDER: Record<string, GlossGender> = { maschile: "masculine", femminile: "feminine" };

/** `dell'indicativo …`, `del congiuntivo …`: each mood phrase, and the tense each of its tenses is. */
const FINITE: Record<string, GlossTense> = {
  "dell'indicativo presente": "presente",
  "dell'indicativo imperfetto": "imperfetto",
  "dell'indicativo passato remoto": "passato remoto",
  "dell'indicativo futuro": "futuro semplice",
  "dell'indicativo futuro semplice": "futuro semplice",
  "del congiuntivo presente": "congiuntivo presente",
  "del congiuntivo imperfetto": "congiuntivo imperfetto",
  "del condizionale presente": "condizionale presente",
};

const IMPERATIVE = new Set(["dell'imperativo", "dell'imperativo presente"]);

const PERSON_SHAPE = /^(prima|seconda|terza) persona (singolare|plurale) (.+)$/;
const GERUND_SHAPE = /^gerundio(?: presente)?$/;
const PRESENT_PARTICIPLE_SHAPE = /^participio presente(?: (singolare|plurale))?$/;
const PAST_PARTICIPLE_SHAPE = /^participio passato(?: (maschile|femminile))?(?: (singolare|plurale))?$/;

/** The typographic apostrophe reads as the plain one: `dell’indicativo`. */
const plainApostrophes = (text: string): string => text.replace(/[’ʼ]/g, "'");

/** The slot a gloss's opening names, before its ` di <verb>`, or undefined. */
function slotOf(opening: string): VerbFormGloss | undefined {
  const person = PERSON_SHAPE.exec(opening);
  if (person !== null) {
    const [, which, number, mood] = person;
    const tense = FINITE[mood];
    if (tense !== undefined) return { kind: "finite", tense, person: PERSON[which], number: NUMBER[number] };
    if (IMPERATIVE.has(mood)) return { kind: "imperative", person: PERSON[which], number: NUMBER[number] };
    return undefined;
  }
  if (GERUND_SHAPE.test(opening)) return { kind: "gerund" };
  const present = PRESENT_PARTICIPLE_SHAPE.exec(opening);
  if (present !== null) return { kind: "present-participle", number: present[1] === undefined ? undefined : NUMBER[present[1]] };
  const past = PAST_PARTICIPLE_SHAPE.exec(opening);
  if (past !== null) {
    return {
      kind: "past-participle",
      gender: past[1] === undefined ? undefined : GENDER[past[1]],
      number: past[2] === undefined ? undefined : NUMBER[past[2]],
    };
  }
  return undefined;
}

/**
 * Whether what follows ` di ` names `verb`: the verb alone, with one full stop
 * after it or none, or one of a pair written `aggrappare, aggrapparsi`, the
 * shape the source gives a participle shared by a verb and its reflexive.
 */
function namesVerb(rest: string, verb: string): boolean {
  const named = rest.endsWith(".") ? rest.slice(0, -1) : rest;
  if (named === verb) return true;
  const pair = named.split(", ");
  return pair.length === 2 && pair.includes(verb);
}

/**
 * The slot `gloss` says its form fills in the conjugation of `verb`, or
 * undefined when the gloss is not one of the rule's shapes or names another
 * word. The gloss is read as the source wrote it, case included: `Gerundio di
 * …` is not a shape the source writes, and so not one this reads.
 */
export function readVerbFormGloss(gloss: string, verb: string): VerbFormGloss | undefined {
  if (verb === "") return undefined;
  const text = plainApostrophes(gloss);
  // The opening never holds ` di `, so the first one ends it; the verb may
  // hold one (`andare di corpo`).
  const at = text.indexOf(" di ");
  if (at === -1 || !namesVerb(text.slice(at + 4), plainApostrophes(verb))) return undefined;
  return slotOf(text.slice(0, at));
}
