// Which auxiliary a cell spelling of a verb's table is built on, by rule
// `it-compound-auxiliary/v1` (#683).
//
// A verb that takes both avere and essere lists both spellings in one cell
// (vivere: `ho vissuto`, `sono vissuto`; assorbire: `ho assorbito, assorto`,
// `sono assorbito, assorto`). The table shows each auxiliary's spellings on a
// line of their own, so the reader sees where the avere forms end. This rule
// reads one spelling:
//
//   ho vissuto               avere
//   sono vissuto             essere
//   mi sono accorto          essere: a reflexive clitic, then essere
//   sono assorbito, assorto  essere: only the first spelling, before `, `, is read
//   vivo                     none: a simple tense
//
// The spelling's first word is the auxiliary, or its second when the first is
// a reflexive clitic (`ESSERE_CLITICS`). The switch is the spelling, never the
// record's `ausiliare` line, for the reason `it-essere-agreement/v1` gives.
// Nothing is stored: the table groups the source's spellings as it is built.
// Huey's ruling, 2026-10-06: https://github.com/povlabs/lexema/issues/683

import { ESSERE_CLITICS, ESSERE_FINITE_FORMS } from "./essereAgreement.js";

/** The rule's name and version. */
export const COMPOUND_AUXILIARY_RULE = "it-compound-auxiliary/v1" as const;

export type Auxiliary = "avere" | "essere";

/**
 * Every one-word finite form of avere: the indicative, subjunctive and
 * conditional cells of avere's own table, as `ESSERE_FINITE_FORMS` holds
 * essere's. test/compoundAuxiliary.test.ts asserts this set against avere's
 * record in fixtures/dev-seed.jsonl.
 */
export const AVERE_FINITE_FORMS: ReadonlySet<string> = new Set([
  // presente, imperfetto, passato remoto, futuro semplice
  "ho", "hai", "ha", "abbiamo", "avete", "hanno",
  "avevo", "avevi", "aveva", "avevamo", "avevate", "avevano",
  "ebbi", "avesti", "ebbe", "avemmo", "aveste", "ebbero",
  "avrò", "avrai", "avrà", "avremo", "avrete", "avranno",
  // congiuntivo presente and imperfetto
  "abbia", "abbiate", "abbiano",
  "avessi", "avesse", "avessimo", "avessero",
  // condizionale presente
  "avrei", "avresti", "avrebbe", "avremmo", "avreste", "avrebbero",
]);

/** The auxiliary a spelling is built on, or undefined when it is not a compound form. */
export function compoundAuxiliary(spelling: string): Auxiliary | undefined {
  const words = spelling.split(", ", 1)[0].split(" ");
  const head = words.length > 2 && ESSERE_CLITICS.has(words[0]) ? words.slice(1) : words;
  if (head.length !== 2) return undefined;
  if (ESSERE_FINITE_FORMS.has(head[0])) return "essere";
  if (AVERE_FINITE_FORMS.has(head[0])) return "avere";
  return undefined;
}

/**
 * The spellings of one cell, in source order, grouped by the auxiliary each is
 * built on: one group per auxiliary, in the order the source first uses it.
 * Spellings built on no auxiliary share one group, so a simple-tense cell is
 * one group.
 */
export function groupByAuxiliary<T>(items: readonly T[], spellingOf: (item: T) => string): T[][] {
  const groups = new Map<Auxiliary | undefined, T[]>();
  for (const item of items) {
    const auxiliary = compoundAuxiliary(spellingOf(item));
    const group = groups.get(auxiliary);
    if (group === undefined) groups.set(auxiliary, [item]);
    else group.push(item);
  }
  return [...groups.values()];
}
