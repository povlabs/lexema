// The base verb table Lexema builds or keeps for a pronominal verb whose base
// verb has no record with a table (#838, #844).
//
// A pronominal verb's table is built on its base verb's cells
// (`it-pronominal-conjugation/v1`). When no base verb record has a table,
// those cells come, in this order, from the regular class the source settles
// (`it-regular-conjugation/v1`), else from the verb's hand-kept table. The word
// page draws that table in the same order (`pronominalBaseCells` in
// web/lib/dictionary/wordPage.ts), and rule `it-pronominal-pair/v2` reads the
// same cells here to find `si pente` (#834).

import { CONJUGATION_TEMPLATE_CALLS } from "./conjugationTemplateCalls.js";
import { handKeptCells, handKeptTableOf, type HandKeptCell, type HandKeptTable } from "./handKeptTables.js";
import type { PronominalVerb } from "./pronominalConjugation.js";
import { regularCells, regularClassOf, type RegularCell, type SettledClass } from "./regularConjugation.js";

/** A base table Lexema builds or keeps: its base verb, its cells, and what gave them. */
export type BuiltBase =
  | { kind: "regular"; base: string; settled: SettledClass; cells: readonly RegularCell[] }
  | { kind: "hand-kept"; base: string; table: HandKeptTable; cells: readonly HandKeptCell[] };

/**
 * The base table of `verb` when no base verb record has one: the regular
 * cells of the class the source settles, read off the verb's `glosses` and the
 * pinned `{{It-conj}}` calls, else the cells of its hand-kept table. None when
 * the source settles no class and the list keeps no table.
 */
export function builtBaseOf(verb: PronominalVerb, glosses: readonly string[]): BuiltBase | undefined {
  const settled = regularClassOf(verb, glosses, CONJUGATION_TEMPLATE_CALLS);
  if (settled.kind === "settled") return { kind: "regular", base: settled.base, settled, cells: regularCells(settled) };
  const table = handKeptTableOf(verb.word);
  return table === undefined ? undefined : { kind: "hand-kept", base: table.base, table, cells: handKeptCells(table) };
}
