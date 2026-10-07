// The line that says which form of a verb a searched form is, built by rule
// `it-verb-form-line/v2` from the cell its verb's table puts it in (#627, #695).
//
// A compound form such as `sono andato` has no record of its own: the source
// lists it only in its verb's `forms[]`. A simple form has a record, whose
// gloss says what it is: "terza persona plurale dell'imperfetto indicativo di
// andare". This writes the same kind of line for any finite cell, in one fixed
// shape and in the Italian names the table shows:
//
//   {prima|seconda|terza} persona {singolare|plurale} {del |dell'}{tense} {mood} di {lemma}
//
//   sono andato   "prima persona singolare del passato prossimo indicativo di andare"
//   sarei andato  "prima persona singolare del passato condizionale di andare"
//   andavano      "terza persona plurale dell'imperfetto indicativo di andare"
//
// A cell of the non-finite line is named as the table names it (v2, #695):
//
//   {gerundio|participio presente|participio} di {lemma}
//
//   stato         "participio di essere"
//
// A searched feminine compound form (`sono andata`, #676) reaches the cell of
// its masculine through `it-essere-agreement/v1` (src/italian/essereAgreement.ts),
// and its line names the gender after the number. A masculine line names none:
//
//   sono andata   "prima persona singolare femminile del passato prossimo indicativo di andare"
//
// The cell is where `placeItalianVerbForm` (it-moods/v1) puts the form, with
// the row `personOfItalianVerbForm` reads, so the line and the cell a table
// marks are one placement. The tense, mood and non-finite names are
// `TENSE_NAMES` and `NON_FINITE_NAMES`, the names the table heads its columns,
// tabs and non-finite line with (ADR 0015). A form the rule cannot name gets no
// line, never a guess: an imperative, the infinitive, and anything it-moods
// leaves unplaced or without a row.
//
// v1 (#627) named finite cells only. Huey's ruling of 2026-10-06 on #695 ("one
// block per base word") gives `stato` a block for essere, whose only cell it
// fills is the participio, so v2 names the non-finite cells too.
//
// The line is Lexema's text, built by rule from source tags (ADR 0008: a
// grammatical paraphrase built by rule is `lexema-deterministic`). The page
// builds it when it renders (web/lib/dictionary/wordPage.ts); nothing stores it
// (ADR 0012), and the page shows no mark for it (ADR 0016).

import {
  NON_FINITE_NAMES,
  personOfItalianVerbForm,
  placeItalianVerbForm,
  TENSE_NAMES,
  type VerbFormTags,
  type VerbNumber,
  type VerbPerson,
} from "./moods.js";

/** The rule's name and version. */
export const VERB_FORM_LINE_RULE = "it-verb-form-line/v2" as const;

const PERSON: Record<VerbPerson, string> = { first: "prima", second: "seconda", third: "terza" };
const NUMBER: Record<VerbNumber, string> = { singular: "singolare", plural: "plurale" };

/**
 * The gender the query spelled the form in: as the cell spells it, or its
 * feminine, read by `it-essere-agreement/v1`. Only the feminine is named.
 */
export type SpelledGender = "as-listed" | "feminine";

const GENDER: Record<SpelledGender, string> = { "as-listed": "", feminine: " femminile" };

/** `del passato`, `dell'imperfetto`: the elided article before a vowel. */
const ofThe = (tense: string): string => (/^[aeiou]/.test(tense) ? `dell'${tense}` : `del ${tense}`);

/**
 * The line for one form of `lemma`, or undefined when the form sits in no
 * finite tense with a person and in no named non-finite cell. `lemma` is
 * written as given and ends the line. `gender` is how the query spelled the
 * form; the non-finite line spells only the masculine, so a feminine has none.
 */
export function verbFormLine(lemma: string, form: VerbFormTags, gender: SpelledGender = "as-listed"): string | undefined {
  if (lemma === "") return undefined;
  const slot = placeItalianVerbForm(form);
  if (slot.kind === "non-finite") {
    // The infinitive is the verb itself, which a search of it finds as its own reading.
    if (slot.role === "infinito" || gender === "feminine") return undefined;
    return `${NON_FINITE_NAMES[slot.role]} di ${lemma}`;
  }
  if (slot.kind !== "tense") return undefined;
  const row = personOfItalianVerbForm(form);
  if (row === undefined) return undefined;
  const { mood, tense } = TENSE_NAMES[slot.box];
  return `${PERSON[row.person]} persona ${NUMBER[row.number]}${GENDER[gender]} ${ofThe(tense)} ${mood} di ${lemma}`;
}
