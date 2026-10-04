import type { RawPage, RawPageRef } from "../source/rawPage.js";
import { readPageFacts, type PageFact } from "./pageFacts.js";
import { statedPartOfSpeech, type PosTitle, type StatedPartOfSpeech } from "./partOfSpeech.js";
import { readRuledVerbSections, readStatedSections, type PageDefinition, type StatedLayout } from "./wikitext.js";

/** ADR 0024's three verb layouts. An entry it recovers keeps this id. */
export const PAGE_ENTRY_RULE = "italian-page-entry/v1";
/** ADR 0028's measured layouts, for any part of speech the layout states. */
export const PAGE_ENTRY_RULE_V2 = "italian-page-entry/v2";

export type PageEntryRule = typeof PAGE_ENTRY_RULE | typeof PAGE_ENTRY_RULE_V2;

interface EntryFacts {
  page: RawPage;
  /** The line that states the part of speech, and that line verbatim. */
  posRef: RawPageRef;
  posWikitext: string;
  definitions: PageDefinition[];
  /** Every other field the word page shows that the page gives (ADR 0026), by `PAGE_FACT_RULE`. */
  facts: PageFact[];
}

/** The entry's facts, read off its page once its section and definitions are known. */
const withFacts = <E extends Omit<EntryFacts, "facts"> & { posTitle: PosTitle }>(entry: E): E & { facts: PageFact[] } => ({
  ...entry,
  facts: readPageFacts(entry),
});

/** A page-only entry: rule v1 recovers verbs only, rule v2 any part of speech its layout states. */
export type RecoveredEntry =
  | (EntryFacts & { rule: typeof PAGE_ENTRY_RULE; pos: "verb"; posTitle: "Verbo" })
  | (EntryFacts & { rule: typeof PAGE_ENTRY_RULE_V2 } & StatedPartOfSpeech);

export type PageEntryRecovery =
  | { outcome: "present-in-archive" | "no-ruled-layout" | "no-definition" | "ambiguous-layout" }
  /** One entry per part-of-speech section, in page order. */
  | { outcome: "recovered"; entries: [RecoveredEntry, ...RecoveredEntry[]] };

/**
 * The page-only entries a page gives. Rule v1 is read first, so every page it
 * recovers keeps its v1 entry; rule v2 reads the rest.
 */
export function recoverPageEntry(page: RawPage, italianWords: ReadonlySet<string>): PageEntryRecovery {
  const v1 = recoverUnderRuleV1(page, italianWords);
  if (v1.outcome === "recovered" || v1.outcome === "present-in-archive") return v1;
  return recoverUnderRuleV2(page);
}

/** Rule v1 alone, as the 2026-10-02 and 2026-10-03 measurements report it. */
export function recoverUnderRuleV1(page: RawPage, italianWords: ReadonlySet<string>): PageEntryRecovery {
  if (italianWords.has(page.title)) return { outcome: "present-in-archive" };
  const sections = readRuledVerbSections(page);
  if (sections.length === 0) return { outcome: "no-ruled-layout" };
  if (sections.length !== 1) return { outcome: "ambiguous-layout" };
  const section = sections[0];
  if (section.definitions.length === 0) return { outcome: "no-definition" };
  return {
    outcome: "recovered",
    entries: [withFacts({ rule: PAGE_ENTRY_RULE, page, pos: "verb", posTitle: "Verbo", posRef: section.ref, posWikitext: section.wikitext, definitions: section.definitions })],
  };
}

/**
 * The single-section layouts ADR 0028 admits, named as the report's groups:
 * `<how the page marks Italian>-heading/<what opens the section>`. The report
 * calls the added templates' group `standard-heading/unknown-template`, since
 * its table did not know them.
 */
const ADMITTED_LAYOUTS: ReadonlySet<string> = new Set([
  "none-heading/template",
  "bare-heading/template",
  "standard-heading/spaced-template",
  "bare-heading/bare-template",
  "standard-heading/verb-label",
  "malformed-heading/template",
  "standard-heading/added-template",
]);

/**
 * Whether ADR 0028 admits the layout: not a copy of English Wiktionary, every
 * Italian definition in a section that states a part of speech, and one
 * admitted single-section layout or several sections.
 */
function isAdmitted(layout: StatedLayout): boolean {
  if (layout.englishCopy || layout.unplaced > 0 || layout.sections.length === 0) return false;
  if (layout.sections.some((section) => section.posTitle === null)) return false;
  return layout.sections.length > 1 || ADMITTED_LAYOUTS.has(`${layout.language}-heading/${layout.sections[0].signal}`);
}

function recoverUnderRuleV2(page: RawPage): PageEntryRecovery {
  const layout = readStatedSections(page);
  if (!isAdmitted(layout)) return { outcome: "no-ruled-layout" };
  const entries = layout.sections.flatMap((section): RecoveredEntry[] =>
    section.posTitle === null || section.definitions.length === 0 ? [] : [withFacts({
      rule: PAGE_ENTRY_RULE_V2, page, ...statedPartOfSpeech(section.posTitle),
      posRef: section.ref, posWikitext: section.wikitext, definitions: section.definitions,
    })]);
  const [first, ...rest] = entries;
  return first === undefined ? { outcome: "no-definition" } : { outcome: "recovered", entries: [first, ...rest] };
}
