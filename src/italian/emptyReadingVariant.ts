// Rule `it-empty-reading-variant/v1`: an empty reading leads to the variant
// its page names (Huey's ruling of 2026-10-18 on #803, C; ADR 0031's
// amendment of that day).
//
// `uno`'s article record has one sense and no gloss: its it.wiktionary page
// (revision 4012236) heads `{{-art-|it}}` and gives only a usage note. The
// page's `{{-var-}}` section reads `* {{Glossa|aggettivo numerale}}
// {{Glossa|articolo}} [[un]]`, and `un` has an article record with five
// definitions. Huey ruled that such a reading links to that variant, for the
// whole shape:
//
// > C: a rule for uno-shaped readings: an empty reading whose page's
// > {{-var-}} names a variant with the same part of speech links to that
// > variant (uno article → un).
//
// A reading has the shape when all of these hold, read off the archive and
// the dump the archive was built from:
//
// - **It is Italian and defines nothing.** No sense has a gloss a page shows
//   (`shownGloss`: Wikizionario's `definizione mancante` placeholder and a
//   gloss that only repeats the headword show nothing), no sense declares a
//   `form_of` edge, and the recovered layer reads no definition for it off
//   its page (ADR 0024, ADR 0029).
// - **Its page's Italian `{{-var-}}` section links a variant.** A word the
//   section links, `[[un]]`, other than the reading's own word. A label
//   template, `{{Term|antico|it}}`, links nothing, nor does a link into
//   another namespace, `[[w:…]]`; an item written without a link names no
//   page, so it names no variant either.
// - **The variant has a reading of the same part of speech that defines
//   something.** An Italian record of the variant with the reading's own
//   section title (`Articolo`), with a gloss a page shows. A form record
//   (`Sostantivo, forma flessa`) has another title, so it is no such reading.
//
// The lookup gives each such reading a lemma link to each variant, at the
// `{{-var-}}` line that names it (src/lookup/variantLinks.ts), so the page
// reads it as a form of that word, as it reads a record whose gloss says
// "variante di". Nothing is stored: the measurement
// (src/import/measureEmptyReadingVariants.ts) pins each reading by its
// archive line and digest, with the page revision and lines it read, in
// src/italian/emptyReadingVariantEvidence.ts, and a lookup reads that list.

import { shownGloss } from "./headwordEcho.js";
import { LANGUAGE_HEADING } from "./wikitext.js";
import type { RawPage } from "../source/rawPage.js";

/** Every version of the rule, oldest first. A change to what it links is a new version and a new ruling. */
export const EMPTY_READING_VARIANT_RULES = ["it-empty-reading-variant/v1"] as const;

export type EmptyReadingVariantRule = (typeof EMPTY_READING_VARIANT_RULES)[number];

/** The version the list is made with. */
export const EMPTY_READING_VARIANT_RULE = "it-empty-reading-variant/v1" satisfies EmptyReadingVariantRule;

/** One line of the page's Italian `{{-var-}}` section: its 1-based place and its wikitext, verbatim. */
export interface VariantLine {
  line: number;
  wikitext: string;
}

/** A variant the rule links an empty reading to: its word, the `{{-var-}}` line that links it, and its record that defines something. */
export interface NamedVariant {
  word: string;
  line: VariantLine;
  /** The variant's first Italian record of the reading's section title with a gloss a page shows, by archive line and digest. */
  record: { lineNo: number; lineSha256: string };
}

/** An empty reading the rule links, pinned by its archive line, with the page revision its variants were read from. */
export interface EmptyReadingVariant {
  record: { lineNo: number; lineSha256: string; word: string; pos: string; posTitle: string };
  /** The dump's revision of the record's page. */
  revisionId: number;
  /** At least one, in the order the page links them. */
  variants: readonly [NamedVariant, ...NamedVariant[]];
}

/** What the measurement pins: the release whose archive it read, and every reading the rule links. */
export interface EmptyReadingVariantEvidence {
  releaseId: string;
  readings: readonly EmptyReadingVariant[];
}

/** `{{-var-}}`, the heading of the variants section, with or without a language. */
const VARIANT_HEADING = /^\{\{-var-(?:\|[^}]*)?\}\}\s*$/;
/** Any other section heading of a page: `{{-sin-}}`, `{{-sost-|it}}`, or a `==` heading. */
const OTHER_HEADING = /^(?:\{\{-[^}]*-(?:\|[^}]*)?\}\}\s*$|=)/;
/** A wiki link: `[[un]]`, `[[sopraporta|…]]`, `[[uno#Italiano]]`. */
const LINK = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g;

/** The words a line links, in order and each once: `[[sopraporta]], [[soprapporta]]`. A link into another namespace, `[[w:Leone XIII|…]]`, names no word. */
export function linkedWords(wikitext: string): string[] {
  const words = [...wikitext.matchAll(LINK)].map((match) => match[1].trim()).filter((word) => word !== "" && !word.includes(":"));
  return [...new Set(words)];
}

/** The lines of the page's Italian `{{-var-}}` sections that link a word, in page order. */
export function variantLines(page: Pick<RawPage, "wikitext">): VariantLine[] {
  const lines: VariantLine[] = [];
  let italian = false;
  let inVariants = false;
  page.wikitext.split("\n").forEach((wikitext, i) => {
    const language = LANGUAGE_HEADING.exec(wikitext);
    if (language !== null) {
      italian = language[1] === "it";
      inVariants = false;
      return;
    }
    if (!italian) return;
    if (VARIANT_HEADING.test(wikitext)) {
      inVariants = true;
      return;
    }
    if (OTHER_HEADING.test(wikitext)) {
      inVariants = false;
      return;
    }
    if (inVariants && linkedWords(wikitext).length > 0) lines.push({ line: i + 1, wikitext });
  });
  return lines;
}

/** A sense as the archive line states it. */
interface LineSense {
  glosses?: unknown;
  form_of?: unknown;
}

/** Whether a record's senses give a page nothing to show: no gloss `shownGloss` keeps, and no `form_of` edge. */
export function sensesDefineNothing(word: string, senses: readonly LineSense[]): boolean {
  return senses.every((sense) => {
    const glosses = Array.isArray(sense.glosses) ? sense.glosses : [];
    const edges = Array.isArray(sense.form_of) ? sense.form_of : [];
    return edges.length === 0 && glosses.every((gloss) => typeof gloss !== "string" || shownGloss(gloss, word) === undefined);
  });
}

/** An Italian record of a variant, as the rule reads it. */
export interface VariantRecord {
  lineNo: number;
  lineSha256: string;
  word: string;
  posTitle: string;
  definesSomething: boolean;
}

/**
 * The variants an empty reading of section title `posTitle`, on the page
 * whose `{{-var-}}` lines are `lines`, links to: each word a line links,
 * other than `word`, whose records (`recordsOf`) include one of that title
 * that defines something. Each once, at the first line that links it.
 */
export function variantsOf(
  word: string,
  posTitle: string,
  lines: readonly VariantLine[],
  recordsOf: (word: string) => readonly VariantRecord[],
): NamedVariant[] {
  const named = new Map<string, NamedVariant>();
  for (const line of lines) {
    for (const variant of linkedWords(line.wikitext)) {
      if (variant === word || named.has(variant)) continue;
      const record = recordsOf(variant).find((one) => one.posTitle === posTitle && one.definesSomething);
      if (record !== undefined) named.set(variant, { word: variant, line, record: { lineNo: record.lineNo, lineSha256: record.lineSha256 } });
    }
  }
  return [...named.values()];
}
