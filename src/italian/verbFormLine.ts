// The line that says which form of a verb a searched form is, built by rule
// `it-verb-form-line/v1` from the cell its verb's table puts it in (#627).
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
// The cell is where `placeItalianVerbForm` (it-moods/v1) puts the form, with
// the row `personOfItalianVerbForm` reads, so the line and the cell a table
// marks are one placement. The tense and mood names are `TENSE_NAMES`, the
// names the table heads its columns and tabs with (ADR 0015). A form the rule
// cannot name gets no line, never a guess: an imperative, a non-finite form,
// and anything it-moods leaves unplaced or without a row.
//
// The line is Lexema's text, built by rule from source tags (ADR 0008: a
// grammatical paraphrase built by rule is `lexema-deterministic`). The page
// builds it when it renders (web/lib/dictionary/wordPage.ts); nothing stores it
// (ADR 0012), and the page shows no mark for it (ADR 0016).

import {
  personOfItalianVerbForm,
  placeItalianVerbForm,
  TENSE_NAMES,
  type VerbFormTags,
  type VerbNumber,
  type VerbPerson,
} from "./moods.js";

/** The rule's name and version. */
export const VERB_FORM_LINE_RULE = "it-verb-form-line/v1" as const;

const PERSON: Record<VerbPerson, string> = { first: "prima", second: "seconda", third: "terza" };
const NUMBER: Record<VerbNumber, string> = { singular: "singolare", plural: "plurale" };

/** `del passato`, `dell'imperfetto`: the elided article before a vowel. */
const ofThe = (tense: string): string => (/^[aeiou]/.test(tense) ? `dell'${tense}` : `del ${tense}`);

/**
 * The line for one form of `lemma`, or undefined when the form does not sit in
 * a finite tense with a person. `lemma` is written as given and ends the line.
 */
export function verbFormLine(lemma: string, form: VerbFormTags): string | undefined {
  if (lemma === "") return undefined;
  const slot = placeItalianVerbForm(form);
  if (slot.kind !== "tense") return undefined;
  const row = personOfItalianVerbForm(form);
  if (row === undefined) return undefined;
  const { mood, tense } = TENSE_NAMES[slot.box];
  return `${PERSON[row.person]} persona ${NUMBER[row.number]} ${ofThe(tense)} ${mood} di ${lemma}`;
}
