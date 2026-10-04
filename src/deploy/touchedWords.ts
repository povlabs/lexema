// The words one planned change writes (#447): each word whose lookup reads
// differently once the change ran. A Preview's dictionary slice
// (src/deploy/previewSlice.ts) holds only these words, so each command's plan
// names them from the rows it already plans, and nothing is read again.
//
// Two commands have no bounded word set. `normalize:source-text` rewrites
// source text wherever a rule matches, across the whole dictionary, and
// `update:upgrade` changes the schema and no word's rows; a slice is built
// from schema.sql, so it already has the upgrade.

import type { CorrectionPlan } from "../import/correctRecords.js";
import type { HidePlan } from "../import/hideRecords.js";
import type { PageEntryPlan } from "../import/loadPageEntries.js";
import type { ApplyPlan } from "../update/apply.js";
import type { DeclaredCommand } from "../update/declaration.js";

/**
 * The words a change writes, sorted and each once; or `unbounded`, for a
 * change whose words are every word a rule matches anywhere. An empty word
 * list is a change that writes no word's rows.
 */
export type TouchedWords =
  | { readonly kind: "words"; readonly words: readonly string[] }
  | { readonly kind: "unbounded"; readonly command: DeclaredCommand };

/** `words` as a touched set: sorted, each once. */
export const touchedWords = (words: Iterable<string>): TouchedWords => ({ kind: "words", words: [...new Set(words)].sort() });

/** No word: a change that writes no word's rows. */
export const NO_WORDS: TouchedWords = touchedWords([]);

/** The touched set of a command that has no bounded word set. */
export const unbounded = (command: DeclaredCommand): TouchedWords => ({ kind: "unbounded", command });

/** Whether `command` names its words in its plan; `normalize:source-text` cannot. */
export const hasBoundedWords = (command: DeclaredCommand): boolean => command !== "normalize:source-text";

/** Both sets at once: unbounded when either is. */
export function unionOf(one: TouchedWords, other: TouchedWords): TouchedWords {
  if (one.kind === "unbounded") return one;
  if (other.kind === "unbounded") return other;
  return touchedWords([...one.words, ...other.words]);
}

/** `update:auto`: the word of each change it applies, the record it retires being one of the same word. */
export const wordsOfApply = (plan: ApplyPlan | null): TouchedWords => touchedWords(plan?.changes.map(({ change }) => change.word) ?? []);

/** `hide:records`: the word of each record it hides. */
export const wordsOfHide = (plan: HidePlan): TouchedWords => touchedWords(plan.hides.map(({ found }) => found.word));

/** `correct:records`: the word of each record and page-only entry it writes a correction for. */
export const wordsOfCorrections = (plan: CorrectionPlan): TouchedWords =>
  touchedWords([
    ...plan.entries.flatMap((entry) => (entry.state === "write" ? [entry.correction.record.word] : [])),
    ...plan.definitions.flatMap((definition) => (definition.state === "write" ? [definition.correction.entry.title] : [])),
  ]);

/** `load:page-entries`: the title of each page-only entry it writes, and of each definition correction it writes beside one. */
export const wordsOfPageEntries = (plan: PageEntryPlan): TouchedWords =>
  touchedWords([
    ...plan.entries.flatMap((planned) => (planned.state === "write" ? [planned.entry.page.title] : [])),
    ...plan.corrections.map(({ title }) => title),
  ]);
