// The rows one page-only entry (ADR 0024, ADR 0028) is stored as, in `COLUMNS` order:
// one `recovered_entry` row and its `entry_definition`, `entry_label` and
// `entry_example` rows, and an `entry_fact` row for each other field its page
// gives (ADR 0026). The seed (seedSql.ts) and the one-off load into a
// dictionary seeded before them (loadPageEntries.ts) both write these, so a
// fresh seed and a loaded dictionary hold the same rows for one entry.

import type { RecoveredEntry } from "../italian/pageEntry.js";
import { PAGE_FACT_RULE, type PageFact } from "../italian/pageFacts.js";
import type { PageEntryDefinitions } from "../italian/curatedCorrections.js";
import { normalizeItalianExact } from "../italian/normalize.js";

export interface PageEntryRows {
  readonly recovered_entry: readonly unknown[];
  readonly entry_definition: readonly (readonly unknown[])[];
  readonly entry_label: readonly (readonly unknown[])[];
  readonly entry_example: readonly (readonly unknown[])[];
  readonly entry_fact: readonly (readonly unknown[])[];
}

/** What an `entry_fact` row holds of a fact, after its entry, place and rule: `kind,page_line,wikitext,value,source_text,meaning,tags,definition_index`. */
function factValues(fact: PageFact): unknown[] {
  const row = (value: string, more: { sourceText?: string; meaning?: string | null; tags?: readonly string[]; definition?: number } = {}) => [
    fact.kind, fact.ref.line, fact.wikitext, value, more.sourceText ?? null, more.meaning ?? null, JSON.stringify(more.tags ?? []), more.definition ?? null,
  ];
  switch (fact.kind) {
    case "gender":
    case "number":
      return row(fact.value, { sourceText: fact.sourceText });
    case "form":
      return row(fact.surface, { tags: fact.tags });
    case "form-of":
      return row(fact.word, { definition: fact.definition });
    case "pronunciation":
      return row(fact.ipa);
    case "etymology":
      return row(fact.text);
    case "synonym":
    case "antonym":
    case "derived":
      return row(fact.word, { tags: fact.rawTags });
    case "expression":
      return row(fact.phrase, { meaning: fact.meaning });
  }
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
    recovered_entry: [entryId, releaseId, pageId, title, normalizeItalianExact(title), entry.pos, entry.posTitle, entry.rule, entry.posRef.line, entry.posWikitext],
    entry_definition: definitions,
    entry_label: labels,
    entry_example: examples,
    entry_fact: entry.facts.map((fact, index) => [entryId, index, PAGE_FACT_RULE, ...factValues(fact)]),
  };
}

/** What a definition correction is checked against: the entry's revision and its definitions' lines and texts. */
export const entryDefinitionsOf = (entry: RecoveredEntry): PageEntryDefinitions => ({
  revisionId: entry.page.revisionId,
  definitions: entry.definitions.map((definition) => ({ line: definition.ref.line, wikitext: definition.wikitext, text: definition.text })),
});
