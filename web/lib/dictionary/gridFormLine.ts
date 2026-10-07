// The line that says which form of a noun or adjective a searched word is,
// built by rule `it-grid-form-line/v1` from the cell of the word's gender and
// number grid that spells it (Huey's rule 4 of 2026-10-06 on #695: "Forms with
// no record of their own (gravida, citta) … use the same form-line layout";
// built by #700).
//
// A form such as `gravida` has no record that says what it is: the source lists
// it only in its lemma's `forms[]`. A form record says it in a gloss,
// "femminile singolare di bello". This writes the same kind of line for any
// cell of the plain grid, in one fixed shape and in the names the grid heads
// its rows and columns with (GENDER_LABEL, NUMBER_LABEL; ADR 0015):
//
//   {maschile|femminile} {singolare|plurale} di {lemma}
//
//   gravida   "femminile singolare di gravido"
//   citta     "femminile singolare di citto"
//
// A superlative cell gets no line: it is a comparison, not an agreement cell,
// and its record says what it is.
//
// The line is Lexema's text, built by rule from the grid (ADR 0008: a
// grammatical paraphrase built by rule is `lexema-deterministic`). The page
// builds it when it renders (web/lib/dictionary/wordPage.ts); nothing stores it
// (ADR 0012), and the page shows no mark for it (ADR 0016).

import { GENDER_LABEL, NUMBER_LABEL, type GridPlace } from "./genderGrid.ts";

/** The rule's name and version. */
export const GRID_FORM_LINE_RULE = "it-grid-form-line/v1" as const;

/** The line for the form in `place` of `lemma`'s grid. `lemma` is written as given and ends the line. */
export const gridFormLine = (lemma: string, place: GridPlace): string =>
  `${GENDER_LABEL[place.gender]} ${NUMBER_LABEL[place.number]} di ${lemma}`;
