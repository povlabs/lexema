// What a declared lemma's page is made of (#453): the word, then one reading
// per part of speech, each its part of speech and its forms table, built from
// the records that declare themselves its forms. Nothing else: no definition,
// no pronunciation, and no note that anything is missing (ADR 0016; Huey,
// 2026-10-03, on #453).
//
// A reading whose forms take no cell is left out, and a lemma with no reading
// left has no page: the search shows "No entry" as it would have.

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
}

export interface DeclaredLemmaPage {
  /** The lemma as the edges spell it. */
  headword: string;
  readings: [DeclaredPageReading, ...DeclaredPageReading[]];
  /** The word whose Wiktionary page the one *Source* link opens: the spelling in the title (ADR 0009, amended on #281). */
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

/** The page, or undefined when no reading places a form in any cell. */
export function declaredLemmaPage(result: DeclaredLemmaResult): DeclaredLemmaPage | undefined {
  const [first, ...rest] = result.readings.flatMap((reading) => {
    const table = tableOf(reading);
    return table === undefined ? [] : [{ reading, table }];
  });
  if (first === undefined) return undefined;
  const headword = first.reading.word;
  return { headword, readings: [first, ...rest], sourceWord: headword };
}
