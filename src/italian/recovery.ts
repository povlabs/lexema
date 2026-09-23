// The recovered layer: definitions a raw page states that its archive record
// does not carry (#28).
//
// The archive record is never edited. What comes out of here sits beside it,
// each definition with its own ref to the page revision and line it was read
// from, so the page can show the two apart. A definition the record already
// carries as a gloss is not recovered a second time.

import type { RawPage } from "../source/rawPage.js";
import { readItalianSections, type LeadIn, type PageDefinition, type PageSection, type UnrenderedLine } from "./wikitext.js";

/** The parts of an archive record recovery compares against. */
export interface RecordText {
  word: string;
  posTitle: string;
  /** How many senses the record has, glossed or not. */
  senseCount: number;
  /** Every `senses[].glosses[]` string, in source order, with its sense. */
  glosses: readonly RecordGloss[];
  /** Every `senses[].examples[].text` string, in source order, with its pointer. */
  examples: readonly RecordExample[];
}

/** One `senses[].glosses[]` string and the index of the sense that holds it. */
export interface RecordGloss {
  senseIndex: number;
  text: string;
}

/** One `senses[].examples[].text` string and where in the record it sits. */
export interface RecordExample {
  /** `/senses/0/examples/0/text`. */
  pointer: string;
  text: string;
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
    senseCount: record.senses.length,
    glosses: record.senses.flatMap((sense, senseIndex) => strings(sense.glosses).map((text) => ({ senseIndex, text }))),
    examples: record.senses.flatMap((sense, i) =>
      Array.isArray(sense.examples)
        ? sense.examples.flatMap((example: unknown, j) =>
            typeof example === "object" && example !== null && typeof (example as { text?: unknown }).text === "string"
              ? [{ pointer: `/senses/${i}/examples/${j}/text`, text: (example as { text: string }).text }]
              : [],
          )
        : [],
    ),
  };
}

/**
 * The definition a recovered item is listed under: the one whose closing colon
 * opens its list on the page, found where the record keeps it.
 */
export type ListedUnder =
  /** A sense the record carries, by its index in `senses`. */
  | { in: "sense"; senseIndex: number }
  /** A definition recovered before it for the same record, by its place in `recovered`. */
  | { in: "recovered"; index: number };

/** A definition recovered for one record, and how the record stood toward it. */
export type RecoveredDefinition = PageDefinition & {
  /**
   * Where its lead-in is, when it has one and the record or the recovered
   * layer holds it. Null for a definition at the top of the section's list.
   */
  listedUnder: ListedUnder | null;
  /**
   * The pointer of the record's example that carries this text, when the
   * record files it as an example rather than a definition — `lap steel
   * guitar` files its definition at `/senses/0/examples/0/text`. The record is
   * left as it is; the text is recovered as what it is, and a page shows it
   * once, as a definition. Null when no example carries it.
   */
  heldAsExample: string | null;
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
 * Whether `carried` holds `text`. The page and the extraction print
 * templates differently, so the test is the longest clause of the page text,
 * cut to 40 characters, found inside the carried string — the probe
 * `tools/definition_loss.py verify` uses. A clause under 12 characters proves
 * nothing and matches nothing.
 */
function carries(carried: string, text: string): boolean {
  const clauses = comparable(text).split(/[,;:]/).map((clause) => clause.trim());
  const probe = clauses.reduce((longest, clause) => (clause.length > longest.length ? clause : longest), "").slice(0, 40);
  if (probe.length < 12) return comparable(carried) === comparable(text);
  return comparable(carried).includes(probe);
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

/**
 * Where a lead-in is kept, only when the record proves it. One recovered
 * already is found by its page line. Otherwise it is a sense whose gloss
 * carries the lead-in's text: the sense in the `#` line's own place, when the
 * record has one sense for each of the section's `#` lines and that sense
 * carries it; else the one sense that carries it. Place alone proves nothing —
 * the extraction can drop one sense and add another — and neither does a
 * clause two senses share. A lead-in not proved leaves the item at the top of
 * the list, and `measure:recovery` counts it.
 */
function placeUnder(
  leadIn: LeadIn,
  record: RecordText,
  section: PageSection,
  recovered: readonly RecoveredDefinition[],
): ListedUnder | null {
  const index = recovered.findIndex((definition) => definition.ref.line === leadIn.ref.line);
  if (index !== -1) return { in: "recovered", index };
  const carrying = new Set(record.glosses.filter((gloss) => carries(gloss.text, leadIn.text)).map((gloss) => gloss.senseIndex));
  const inPlace =
    leadIn.on === "sense-line" && section.senseLines.length === record.senseCount && carrying.has(leadIn.senseLine);
  if (inPlace) return { in: "sense", senseIndex: leadIn.senseLine };
  if (carrying.size !== 1) return null;
  const [senseIndex] = carrying;
  return { in: "sense", senseIndex };
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
    if (record.glosses.some((gloss) => carries(gloss.text, definition.text))) alreadyGlossed.push(definition);
    else {
      const heldAs = record.examples.find((example) => carries(example.text, definition.text));
      const listedUnder = definition.leadIn === null ? null : placeUnder(definition.leadIn, record, section, recovered);
      recovered.push({ ...definition, heldAsExample: heldAs?.pointer ?? null, listedUnder });
    }
  }

  const keepsASense = section.senseLines.some((line) => line.kind === "sense");
  const loss: Loss = recovered.length === 0 ? "none" : keepsASense ? "partial" : "full";
  return { outcome: "matched", loss, recovered, alreadyGlossed, unrendered: section.unrendered };
}
