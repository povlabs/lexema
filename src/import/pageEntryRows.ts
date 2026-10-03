// The rows one page-only entry (ADR 0024) is stored as, in `COLUMNS` order:
// one `recovered_entry` row and its `entry_definition`, `entry_label` and
// `entry_example` rows. The seed (seedSql.ts) and the one-off load into a
// dictionary seeded before them (loadPageEntries.ts) both write these, so a
// fresh seed and a loaded dictionary hold the same rows for one entry.

import { PAGE_ENTRY_RULE, type RecoveredEntry } from "../italian/pageEntry.js";
import type { PageEntryDefinitions } from "../italian/curatedCorrections.js";
import { normalizeItalianExact } from "../italian/normalize.js";

export interface PageEntryRows {
  readonly recovered_entry: readonly unknown[];
  readonly entry_definition: readonly (readonly unknown[])[];
  readonly entry_label: readonly (readonly unknown[])[];
  readonly entry_example: readonly (readonly unknown[])[];
}

/** The rows of `entry`, stored as `entryId` of `releaseId`, read from the `raw_page` row `pageId`. */
export function pageEntryRows(entryId: number, releaseId: string, pageId: number, entry: RecoveredEntry): PageEntryRows {
  const { title } = entry.page;
  const definitions: unknown[][] = [];
  const labels: unknown[][] = [];
  const examples: unknown[][] = [];
  entry.definitions.forEach((definition, index) => {
    const parent = definition.leadIn === null ? -1 : entry.definitions.findIndex((candidate) => candidate.ref.line === definition.leadIn?.ref.line);
    definitions.push([entryId, index, definition.route, definition.route === "sub-term" ? definition.term : null, definition.ref.line, definition.wikitext, definition.text, parent >= 0 && parent < index ? parent : null]);
    definition.labels.forEach((label, labelIndex) => labels.push([entryId, index, labelIndex, label]));
    definition.examples.forEach((example, exampleIndex) => examples.push([entryId, index, exampleIndex, example.ref.line, example.wikitext, example.text]));
  });
  return {
    recovered_entry: [entryId, releaseId, pageId, title, normalizeItalianExact(title), entry.pos, entry.posTitle, PAGE_ENTRY_RULE, entry.posRef.line, entry.posWikitext],
    entry_definition: definitions,
    entry_label: labels,
    entry_example: examples,
  };
}

/** What a definition correction is checked against: the entry's revision and its definitions' lines and texts. */
export const entryDefinitionsOf = (entry: RecoveredEntry): PageEntryDefinitions => ({
  revisionId: entry.page.revisionId,
  definitions: entry.definitions.map((definition) => ({ line: definition.ref.line, wikitext: definition.wikitext, text: definition.text })),
});
