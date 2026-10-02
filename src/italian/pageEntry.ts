import type { RawPage, RawPageRef } from "../source/rawPage.js";
import { readRuledVerbSections, type PageDefinition } from "./wikitext.js";

export const PAGE_ENTRY_RULE = "italian-page-entry/v1";

export interface RecoveredEntry {
  page: RawPage;
  pos: "verb";
  posTitle: "Verbo";
  posRef: RawPageRef;
  posWikitext: string;
  definitions: PageDefinition[];
}

export type PageEntryRecovery =
  | { outcome: "present-in-archive" | "no-ruled-layout" | "no-definition" | "ambiguous-layout" }
  | { outcome: "recovered"; entry: RecoveredEntry };

export function recoverPageEntry(page: RawPage, italianWords: ReadonlySet<string>): PageEntryRecovery {
  if (italianWords.has(page.title)) return { outcome: "present-in-archive" };
  const sections = readRuledVerbSections(page);
  if (sections.length === 0) return { outcome: "no-ruled-layout" };
  if (sections.length !== 1) return { outcome: "ambiguous-layout" };
  const section = sections[0];
  if (section.definitions.length === 0) return { outcome: "no-definition" };
  return {
    outcome: "recovered",
    entry: { page, pos: "verb", posTitle: "Verbo", posRef: section.ref, posWikitext: section.wikitext, definitions: section.definitions },
  };
}
