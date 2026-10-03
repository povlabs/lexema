// What a declared lemma's page is made of (#453): the word, then one reading
// per part of speech, each its part of speech and its forms table, built from
// the records that declare themselves its forms. Nothing else: no definition,
// no pronunciation, and no note that anything is missing (ADR 0016; Huey,
// 2026-10-03, on #453).
//
// A reading whose forms take no cell is left out, and a lemma with no reading
// left has no page: the search shows "No entry" as it would have.
//
// The one *Source* link opens the Wiktionary page of the first form the first
// reading's table shows that a source record declares, in the order the table
// renders, since that is where the shown data comes from (Huey, 2026-10-03, on
// #459). The lemma's own spelling, which a grid puts in its singolare cell, is
// no record's, and almost never has a page.

import type { DeclaredLemmaReading, DeclaredLemmaResult, DeclaredVerbForm } from "@lexema/lookup/types.ts";
import { declaredConjugationOf, placesAny, type Conjugation } from "./conjugation.ts";
import { declaredGridOf, type Grid } from "./genderGrid.ts";

/** A reading's table: a conjugation for a verb, a gender and number grid for a noun or adjective. */
export type DeclaredTable =
  | { shape: "conjugation"; conjugation: Conjugation<DeclaredVerbForm> }
  | { shape: "grid"; grid: Grid };

export interface DeclaredPageReading {
  reading: DeclaredLemmaReading;
  table: DeclaredTable;
  /** The first spelling in `table` that a source record declares, in the order the table renders. */
  firstForm: string;
}

export interface DeclaredLemmaPage {
  /** The lemma as the edges spell it. */
  headword: string;
  readings: [DeclaredPageReading, ...DeclaredPageReading[]];
  /** The word whose Wiktionary page the one *Source* link opens: the first reading's first form (#459). */
  sourceWord: string;
}

function tableOf(reading: DeclaredLemmaReading): DeclaredTable | undefined {
  if (reading.pos === "verb") {
    const conjugation = declaredConjugationOf(reading.forms);
    return placesAny(conjugation) ? { shape: "conjugation", conjugation } : undefined;
  }
  const grid = declaredGridOf(reading.word, reading.forms);
  return grid === undefined ? undefined : { shape: "grid", grid };
}

/**
 * The first spelling a record declares, in render order. A conjugation: the
 * non-finite line, then each mood, its simple tenses then its compound ones,
 * each tense's persons top to bottom; every form in it is a record's. A grid:
 * rows top to bottom, singolare then plurale, skipping the lemma's own
 * spelling, which no record declares.
 */
function firstFormOf(table: DeclaredTable): string | undefined {
  if (table.shape === "conjugation") {
    const { nonFinite, moods } = table.conjugation;
    const forms = [
      ...nonFinite.flatMap((item) => item.forms),
      ...moods.flatMap((mood) =>
        [...mood.simple, ...mood.compound].flatMap((tense) => tense.cells.flatMap((cell) => cell.forms)),
      ),
    ];
    return forms[0]?.surface;
  }
  return table.grid.rows
    .flatMap((row) => row.cells.flatMap((cell) => cell.spellings))
    .find((spelling) => spelling.declaredForms.length > 0)?.surface;
}

/** The page, or undefined when no reading places a form in any cell. */
export function declaredLemmaPage(result: DeclaredLemmaResult): DeclaredLemmaPage | undefined {
  const [first, ...rest] = result.readings.flatMap((reading): DeclaredPageReading[] => {
    const table = tableOf(reading);
    const firstForm = table === undefined ? undefined : firstFormOf(table);
    return table === undefined || firstForm === undefined ? [] : [{ reading, table, firstForm }];
  });
  if (first === undefined) return undefined;
  return { headword: first.reading.word, readings: [first, ...rest], sourceWord: first.firstForm };
}
