// The recovered layer: definitions a raw page states that its archive record
// does not carry (#28).
//
// The archive record is never edited. What comes out of here sits beside it,
// each definition with its own ref to the page revision and line it was read
// from, so the page can show the two apart. A definition the record already
// carries as a gloss is not recovered a second time.

import type { RawPage } from "../source/rawPage.js";
import { readItalianSections, type PageDefinition, type PageSection, type UnrenderedLine } from "./wikitext.js";

/** The parts of an archive record recovery compares against. */
export interface RecordText {
  word: string;
  posTitle: string;
  /** Every `senses[].glosses[]` string, in source order. */
  glosses: readonly string[];
  /** Every `senses[].examples[].text` string, in source order. */
  exampleTexts: readonly string[];
}

/** Every string leaf of the record `recovery` reads, whatever else it holds. */
export function recordText(record: {
  word: string;
  pos_title: string;
  senses: readonly { glosses?: unknown; examples?: unknown }[];
}): RecordText {
  const strings = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  return {
    word: record.word,
    posTitle: record.pos_title,
    glosses: record.senses.flatMap((sense) => strings(sense.glosses)),
    exampleTexts: record.senses.flatMap((sense) =>
      Array.isArray(sense.examples)
        ? sense.examples.flatMap((example: unknown) =>
            typeof example === "object" && example !== null && typeof (example as { text?: unknown }).text === "string"
              ? [(example as { text: string }).text]
              : [],
          )
        : [],
    ),
  };
}

/** A definition recovered for one record, and how the record stood toward it. */
export type RecoveredDefinition = PageDefinition & {
  /**
   * True when the record carries this text, but as an example rather than a
   * definition — `lap steel guitar` files its definition under
   * `examples[].text`. The record is left as it is; the text is recovered as
   * what it is.
   */
  heldAsExample: boolean;
};

/**
 * How much of a record's section the extraction lost.
 *
 * `full` — the section states no sense of its own on a `#` line, so every
 * definition the page gives sits below one: the record carries only furniture.
 * `partial` — the record keeps at least one sense and misses at least one
 * definition below it.
 */
export type Loss = "none" | "partial" | "full";

/** What recovery made of one record. Every case but `matched` recovers nothing. */
export type RecordRecovery =
  | { outcome: "no-italian-section" }
  | { outcome: "no-matching-section" }
  | { outcome: "ambiguous-section"; sections: number }
  | {
      outcome: "matched";
      loss: Loss;
      recovered: RecoveredDefinition[];
      /** Definitions below `#` the record already carries as a gloss. */
      alreadyGlossed: PageDefinition[];
      /** Lines the structure marks as definitions that could not be rendered. */
      unrendered: UnrenderedLine[];
    };

/** Lowercase, whitespace collapsed, for comparing page text to record text. */
const comparable = (text: string): string => text.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Whether `text` is among `carried`. The page and the extraction print
 * templates differently, so the test is the longest clause of the page text,
 * cut to 40 characters, found inside a carried string — the probe
 * `tools/definition_loss.py verify` uses. A clause under 12 characters proves
 * nothing and matches nothing.
 */
function carries(carried: readonly string[], text: string): boolean {
  const clauses = comparable(text).split(/[,;:]/).map((clause) => clause.trim());
  const probe = clauses.reduce((longest, clause) => (clause.length > longest.length ? clause : longest), "").slice(0, 40);
  if (probe.length < 12) return carried.some((item) => comparable(item) === comparable(text));
  return carried.some((item) => comparable(item).includes(probe));
}

/**
 * The page section a record was extracted from: the one Italian section whose
 * part-of-speech heading the extraction titles as the record's `pos_title`.
 */
function sectionFor(sections: readonly PageSection[], posTitle: string): RecordRecovery | PageSection {
  if (sections.length === 0) return { outcome: "no-italian-section" };
  const matching = sections.filter((section) => section.posTitle === posTitle);
  if (matching.length === 0) return { outcome: "no-matching-section" };
  if (matching.length > 1) return { outcome: "ambiguous-section", sections: matching.length };
  return matching[0];
}

/** Recover what `record` lost from the page it was extracted from. */
export function recoverDefinitions(record: RecordText, page: RawPage): RecordRecovery {
  if (page.title !== record.word) {
    throw new Error(`page ${JSON.stringify(page.title)} is not the page of ${JSON.stringify(record.word)}`);
  }
  const section = sectionFor(readItalianSections(page), record.posTitle);
  if ("outcome" in section) return section;

  const recovered: RecoveredDefinition[] = [];
  const alreadyGlossed: PageDefinition[] = [];
  for (const definition of section.senseLines.flatMap((line) => line.below)) {
    if (carries(record.glosses, definition.text)) alreadyGlossed.push(definition);
    else recovered.push({ ...definition, heldAsExample: carries(record.exampleTexts, definition.text) });
  }

  const keepsASense = section.senseLines.some((line) => line.kind === "sense");
  const loss: Loss = recovered.length === 0 ? "none" : keepsASense ? "partial" : "full";
  return { outcome: "matched", loss, recovered, alreadyGlossed, unrendered: section.unrendered };
}
