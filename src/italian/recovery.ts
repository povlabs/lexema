// The recovered layer: definitions a raw page states that its archive record
// does not carry (#28).
//
// The archive record is never edited. What comes out of here sits beside it,
// each definition with its own ref to the page revision and line it was read
// from, so the page can show the two apart. A definition the record already
// carries as a gloss is not recovered a second time.

import type { RawPage } from "../source/rawPage.js";
import { readHeadwordLine } from "./furniture.js";
import { verbTypesTagged, type VerbType } from "./verbType.js";
import {
  readItalianSections,
  verbTypeAt,
  type LeadIn,
  type PageDefinition,
  type PageSection,
  type SenseLineText,
  type UnrenderedLine,
} from "./wikitext.js";

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
  /** The verb-type parts its `tags` name: `intransitive` is `intransitivo` (src/italian/verbType.ts). */
  verbTypes: readonly VerbType[];
  /** The other archive records of its word and part-of-speech title. */
  siblings: Siblings;
}

/**
 * The verb types each other archive record of a word and part-of-speech title
 * names, one entry per record, in archive order. Empty when the record is the
 * only one. Wiktextract makes one record of each verb-type part of a split
 * section, so these are the records of the section's other parts.
 */
export type Siblings = readonly (readonly VerbType[])[];

/** A record no other archive record shares a word and part-of-speech title with. */
export const ONLY_RECORD: Siblings = [];

/** Every archive record's verb types, by its word and part-of-speech title: what names a record's siblings. */
export class SectionRecords {
  private readonly byTitle = new Map<string, { lineNo: number; verbTypes: readonly VerbType[] }[]>();

  /** Note the archive record at 1-based line `lineNo`. */
  add(lineNo: number, record: { word: string; pos_title: string; tags?: unknown }): void {
    const key = `${record.word}\u0000${record.pos_title}`;
    const held = this.byTitle.get(key);
    const entry = { lineNo, verbTypes: verbTypesTagged(record.tags) };
    if (held === undefined) this.byTitle.set(key, [entry]);
    else held.push(entry);
  }

  /** The siblings of the record at `lineNo`: every other record noted with its word and title. */
  siblingsOf(lineNo: number, record: { word: string; pos_title: string }): Siblings {
    const held = this.byTitle.get(`${record.word}\u0000${record.pos_title}`) ?? [];
    return held.filter((entry) => entry.lineNo !== lineNo).map((entry) => entry.verbTypes);
  }
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

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

/**
 * Every `senses[].glosses[]` string of a record's `senses`, as its archive line
 * holds them: a sense that is not an object, or glosses that are not strings,
 * give none.
 */
export function recordGlosses(senses: unknown): RecordGloss[] {
  if (!Array.isArray(senses)) return [];
  return senses.flatMap((sense: unknown, senseIndex) =>
    typeof sense === "object" && sense !== null
      ? strings((sense as { glosses?: unknown }).glosses).map((text) => ({ senseIndex, text }))
      : [],
  );
}

/**
 * Every string leaf of the record `recovery` reads, whatever else it holds,
 * with the verb types its `tags` name and the `siblings` it shares its word and
 * part-of-speech title with.
 */
export function recordText(
  record: {
    word: string;
    pos_title: string;
    tags?: unknown;
    senses: readonly { glosses?: unknown; examples?: unknown }[];
  },
  siblings: Siblings,
): RecordText {
  return {
    word: record.word,
    posTitle: record.pos_title,
    verbTypes: verbTypesTagged(record.tags),
    siblings,
    senseCount: record.senses.length,
    glosses: recordGlosses(record.senses),
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
      /**
       * Definitions the section states in a verb-type part another record of
       * it was extracted from (`inRecordPart`): that record's, not this one's.
       */
      otherParts: PageDefinition[];
    };

/** Lowercase, whitespace collapsed, for comparing page text to record text. */
const comparable = (text: string): string => text.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Whether `carried` holds `text`. The page and the extraction print
 * templates differently, so the test is the longest clause of the page text,
 * cut to 40 characters, found inside the carried string — the probe
 * `tools/definition_loss.py verify` uses. A clause under 12 characters proves
 * nothing and matches nothing. The lookup asks the same question of a record
 * that replaced the one a definition was recovered for (src/lookup/recovered.ts).
 */
export function carries(carried: string, text: string): boolean {
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
 * A line's text and a gloss, put in the one form both are compared in:
 * whitespace collapsed and one closing colon dropped. Nothing else is changed.
 * Wiktextract moves a line's usage labels (`{{Term|araldica|it}}`, `{{Fig}}`)
 * out of its gloss into `topics`, `tags` and `raw_tags`, and the renderer
 * drops the same templates, so neither side holds them.
 */
const asGloss = (text: string): string => text.replace(/\s+/g, " ").trim().replace(/\s*:$/, "");

/**
 * A record gloss as the renderer prints the `#` line it was read from. On a
 * line, `{{Pn|w=…}}` prints the headword, and the extraction prints it with
 * its `( approfondimento)` link: `# {{Pn|w=filetto (araldica)}} detto di:` is
 * the gloss `filetto ( approfondimento) detto di:` (#399). So a gloss whose
 * link leads a definition (`readHeadwordLine`) is read without the link. Any
 * other gloss is its own text.
 */
function asLinePrints(gloss: string, word: string): string {
  const line = readHeadwordLine(gloss, word);
  return line?.kind === "lead" ? `${word} ${line.prose}` : gloss;
}

/**
 * Whether a `#` line may read as `text`, in the form `asGloss` gives. A line
 * known whole must equal it. A line with gaps may, when its known parts sit in
 * `text` in order, the first at its start and the last at its end: a gap can
 * print anything, so only the known parts can tell the two apart.
 */
function mayRead(line: SenseLineText, text: string): boolean {
  if (line.known === "whole") return asGloss(line.text) === text;
  const [first, ...rest] = line.parts;
  const last = asGloss(rest.pop() ?? "");
  if (!text.startsWith(first)) return false;
  let at = first.length;
  for (const part of rest) {
    const found = text.indexOf(part, at);
    if (found === -1) return false;
    at = found + part.length;
  }
  return text.endsWith(last) && text.length - last.length >= at;
}

/**
 * Where a lead-in is kept. One recovered already is found by its page line.
 * One on a `#` line is a record sense only by text identity, checked on both
 * sides: exactly one sense has a gloss that, read as the line prints it
 * (`asLinePrints`), equals the line's text, and no other
 * `#` line of the section has that text. A gloss that quotes the line, a sense
 * in the line's place, or a text two lines or two senses share places nothing.
 * Anything else leaves the item at the top of the list, and `measure:recovery`
 * counts it.
 */
function placeUnder(
  leadIn: LeadIn,
  record: RecordText,
  section: PageSection,
  recovered: readonly RecoveredDefinition[],
): ListedUnder | null {
  if (leadIn.on === "definition") {
    const index = recovered.findIndex((definition) => definition.ref.line === leadIn.ref.line);
    return index === -1 ? null : { in: "recovered", index };
  }
  const text = asGloss(leadIn.text);
  const lines = section.senseLines.filter((line) => mayRead(line.text, text));
  if (lines.length !== 1) return null;
  const equal = new Set(
    record.glosses.filter((gloss) => asGloss(asLinePrints(gloss.text, record.word)) === text).map((gloss) => gloss.senseIndex),
  );
  if (equal.size !== 1) return null;
  const [senseIndex] = equal;
  return { in: "sense", senseIndex };
}

/**
 * Whether a line in verb-type part `part` of a record's section is the
 * record's (#775). Wiktextract makes one record of each part of a split
 * section, tagged with the part's type, so a line in a part belongs to the
 * records whose tags name that type. It belongs to every record of the
 * section, as before #775, when it sits in no part, when the record has no
 * sibling, or when no record of the section names the part's type: then no
 * record says which part it was read from.
 */
function inRecordPart(record: RecordText, part: VerbType | null): boolean {
  if (part === null || record.siblings.length === 0 || record.verbTypes.includes(part)) return true;
  return !record.siblings.some((verbTypes) => verbTypes.includes(part));
}

/**
 * The lines of `section` that are `record`'s, each judged by the part it sits
 * in, and the definitions that sit in a part that is another record's.
 */
function recordPart(section: PageSection, record: RecordText): { part: PageSection; otherParts: PageDefinition[] } {
  const ours = (line: { ref: { line: number } }): boolean => inRecordPart(record, verbTypeAt(section, line.ref.line));
  const part: PageSection = {
    ...section,
    senseLines: section.senseLines.filter(ours).map((line) => ({ ...line, below: line.below.filter(ours) })),
    unlisted: section.unlisted.filter(ours),
    unrendered: section.unrendered.filter(ours),
  };
  const kept = new Set([...part.senseLines.flatMap((line) => line.below), ...part.unlisted]);
  const definitions = [...section.senseLines.flatMap((line) => line.below), ...section.unlisted];
  return { part, otherParts: definitions.filter((definition) => !kept.has(definition)) };
}

/** Recover what `record` lost from the page it was extracted from. */
export function recoverDefinitions(record: RecordText, page: RawPage): RecordRecovery {
  if (page.title !== record.word) {
    throw new Error(`page ${JSON.stringify(page.title)} is not the page of ${JSON.stringify(record.word)}`);
  }
  const whole = sectionFor(readItalianSections(page), record.posTitle);
  if ("outcome" in whole) return whole;
  const { part: section, otherParts } = recordPart(whole, record);

  const recovered: RecoveredDefinition[] = [];
  const alreadyGlossed: PageDefinition[] = [];
  // A section's unlisted lines come after its `#` list, whatever their place on
  // the page, so a dictionary that gains them later (`load:recovered-definitions`)
  // lists them where a fresh seed does.
  for (const definition of [...section.senseLines.flatMap((line) => line.below), ...section.unlisted]) {
    if (record.glosses.some((gloss) => carries(gloss.text, definition.text))) alreadyGlossed.push(definition);
    else {
      const heldAs = record.examples.find((example) => carries(example.text, definition.text));
      const listedUnder = definition.leadIn === null ? null : placeUnder(definition.leadIn, record, section, recovered);
      recovered.push({ ...definition, heldAsExample: heldAs?.pointer ?? null, listedUnder });
    }
  }

  const keepsASense = section.senseLines.some((line) => line.kind === "sense");
  const loss: Loss = recovered.length === 0 ? "none" : keepsASense ? "partial" : "full";
  return { outcome: "matched", loss, recovered, alreadyGlossed, unrendered: section.unrendered, otherParts };
}
