// Which language a part-of-speech block under a page's Italian heading is in (#29).
//
// Wiktextract gives a record the language of the `== {{-xx-}} ==` heading it sits
// under, and nothing else: `lang_code` is the name of that heading's first
// template, and the part-of-speech template's own language argument is never read
// (wiktextract `extractor/it/page.py`, `parse_page`). So when a page puts another
// language's entry under its Italian heading, the archive tags that entry `it`.
// The pages do it in two ways this module reads:
//
//   language line   the other language's heading is written as a bare template
//                   line, `{{-nl-}}`, not as `== {{-nl-}} ==`, so it opens no
//                   section and everything below it stays Italian (`curie`).
//   late heading    a part-of-speech heading naming another language,
//                   `{{-sost-|en}}`, placed after the Italian entry's own
//                   translation box (`dolmen`).
//
// A heading naming another language is not enough on its own. Pages use the
// argument to mark where an Italian loanword comes from (`sushi` is
// `{{-sost-|int}}`), and sometimes mistype it (`bellicose`, an Italian plural, is
// `{{-agg form-|en}}`). Only below the translation box, where an Italian entry has
// already ended, does it reliably open a foreign one. A heading with no language
// at all, `{{-sost-}}`, says nothing either way: it heads Italian entries too.
//
// The rule reads page structure only. Which codes are languages comes from the
// dump itself (`LanguageHeadings`), not from a list written here.

import { readFile } from "node:fs/promises";
import type { RawPage, RawPageRef } from "../source/rawPage.js";
import { LANGUAGE_HEADING, POS_TITLE_BY_TEMPLATE } from "./wikitext.js";

/**
 * The language codes a set of pages uses as `== {{-xx-}} ==` headings. A bare
 * `{{-xx-}}` line is a language line only when `xx` is one of them; `{{-pron-}}`
 * and the other section templates never head a language section, so they are not.
 */
export class LanguageHeadings {
  private constructor(private readonly codes: ReadonlySet<string>) {}

  /** The codes `headingCodes` read off a set of pages, or that `list()` wrote. */
  static fromList(codes: Iterable<string>): LanguageHeadings {
    return new LanguageHeadings(new Set(codes));
  }

  has(code: string): boolean {
    return this.codes.has(code);
  }

  /** Every code, sorted, for storing beside a measurement. */
  list(): string[] {
    return [...this.codes].sort();
  }
}

/**
 * The codes stored as `languageHeadings` in a JSON file, which
 * `fixtures/section-language/regressions.json` is: the dump's, kept there so a
 * seed reads them without walking the whole dump.
 */
export async function readLanguageHeadings(path: string): Promise<LanguageHeadings> {
  const { languageHeadings } = JSON.parse(await readFile(path, "utf8")) as { languageHeadings?: unknown };
  if (!Array.isArray(languageHeadings) || languageHeadings.length === 0 || !languageHeadings.every((code) => typeof code === "string")) {
    throw new Error(`${path}: languageHeadings is not a list of language codes`);
  }
  return LanguageHeadings.fromList(languageHeadings);
}

/** The codes of every `== {{-xx-}} ==` heading on one page. */
export function headingCodes(page: RawPage): string[] {
  const codes: string[] = [];
  for (const line of page.wikitext.split("\n")) {
    const heading = LANGUAGE_HEADING.exec(line.trim());
    if (heading !== null) codes.push(heading[1]);
  }
  return codes;
}

/** Any level-2 heading, `== {{-en-}} ==` or `==Finnish==`. It ends the Italian section. */
const LEVEL_2 = /^==(?!=).*[^=]==$/;
/** `{{-sost-}}`, `{{-sost-|en}}`, `{{-sost-|it}} [[File:…]]`: a part-of-speech heading opens a line. */
const POS_HEADING = /^\{\{-([a-z][a-z -]*?)-(?:\|([^{}]*))?\}\}/;
/** `{{-nl-}}` alone on its line. */
const BARE_HEADING = /^\{\{-([A-Za-z-]+)-\}\}$/;
/** The translation box that closes an Italian entry. */
const TRANSLATIONS = /^\{\{-trad-\}\}/;

/** One part-of-speech block of a page's Italian section, and what the page says about its language. */
export interface PosBlock {
  /** The heading's line. */
  ref: RawPageRef;
  /** `sost` for `{{-sost-|it}}`. */
  posTemplate: string;
  /** The `pos_title` the archive gives a record from this block; undefined for a template it does not map. */
  posTitle: string | undefined;
  /** The language code the heading names, `en` for `{{-sost-|en}}`; null when it names no language. */
  headingLanguage: string | null;
  /** The last bare language line above the block in the same Italian section. */
  languageLine: { code: string; line: number } | null;
  /** The line of a `{{-trad-}}` translation box above the block in the same Italian section. */
  translationsLine: number | null;
}

/** The verdict of the rule on one block. */
export type BlockLanguage =
  | { language: "it" }
  | { language: "other"; code: string; because: "language-line" | "late-heading"; line: number };

/**
 * The rule. A block is in another language when a bare language line stands
 * above it, or when its heading names another language and it comes after the
 * Italian entry's translation box. Everything else is Italian, including the
 * blocks the rule cannot see: a foreign entry whose heading says `it` or nothing
 * (`arteria`'s Latin entry is `{{-sost-|it}}`), and one alone on its page.
 */
export function blockLanguage(block: PosBlock): BlockLanguage {
  if (block.languageLine !== null) {
    return { language: "other", code: block.languageLine.code, because: "language-line", line: block.languageLine.line };
  }
  if (block.headingLanguage !== null && block.headingLanguage !== "it" && block.translationsLine !== null) {
    return { language: "other", code: block.headingLanguage, because: "late-heading", line: block.ref.line };
  }
  return { language: "it" };
}

/** The first positional argument of `{{-sost-|en|…}}`, when it is a language the dump heads a section with. */
function headingLanguage(args: string | undefined, languages: LanguageHeadings): string | null {
  const first = (args ?? "").split("|")[0].trim();
  if (first === "" || first.includes("=")) return null;
  return languages.has(first) ? first : null;
}

/**
 * Every part-of-speech block under the page's Italian heading, in page order.
 * That is the order Wiktextract writes their records in, so the archive's
 * Italian records for the title line up with these blocks one to one
 * (`alignRecords`).
 */
export function readItalianPosBlocks(page: RawPage, languages: LanguageHeadings): PosBlock[] {
  const blocks: PosBlock[] = [];
  let inItalian = false;
  let languageLine: PosBlock["languageLine"] = null;
  let translationsLine: number | null = null;
  page.wikitext.split("\n").forEach((raw, index) => {
    const line = raw.trim();
    const language = LANGUAGE_HEADING.exec(line);
    if (language !== null || LEVEL_2.test(line)) {
      inItalian = language !== null && language[1].toLowerCase() === "it";
      languageLine = null;
      translationsLine = null;
      return;
    }
    if (!inItalian) return;
    const pos = POS_HEADING.exec(line);
    if (pos !== null && Object.hasOwn(POS_TITLE_BY_TEMPLATE, pos[1])) {
      blocks.push({
        ref: { wiki: page.wiki, title: page.title, revisionId: page.revisionId, line: index + 1 },
        posTemplate: pos[1],
        posTitle: POS_TITLE_BY_TEMPLATE[pos[1]],
        headingLanguage: headingLanguage(pos[2], languages),
        languageLine,
        translationsLine,
      });
      return;
    }
    if (TRANSLATIONS.test(line)) translationsLine = index + 1;
    const bare = BARE_HEADING.exec(line);
    if (bare !== null && bare[1] !== "it" && languages.has(bare[1])) languageLine = { code: bare[1], line: index + 1 };
  });
  return blocks;
}

/**
 * The block each of a title's Italian records came from, given the records'
 * `pos_title`s in archive order. Null when the blocks and the records do not
 * line up one to one with the same parts of speech; such a title is counted,
 * never guessed at.
 */
export function alignRecords(blocks: readonly PosBlock[], posTitles: readonly string[]): readonly PosBlock[] | null {
  if (blocks.length !== posTitles.length) return null;
  return blocks.every((block, index) => block.posTitle === posTitles[index]) ? blocks : null;
}

/**
 * The rule's name and version, stored on every record it hides (#382). A
 * change to what `blockLanguage` or `readItalianPosBlocks` decides is a new
 * version, so a stored verdict always names the rule that made it.
 */
export const SECTION_LANGUAGE_RULE = "section-language/v1" as const;

/** One Italian record of a title, where the archive has it. */
export interface TitleRecord {
  /** 1-based line in the archive. */
  lineNo: number;
  posTitle: string;
}

/** A record the rule finds in another language, and the page line that says so. */
export interface ForeignRecord {
  lineNo: number;
  /** The language the page names: `nl`, `en`. */
  code: string;
  because: "language-line" | "late-heading";
  /** The language line, or the heading that names the language. */
  ref: RawPageRef;
}

/**
 * The records of one title the rule finds in another language. `records` are
 * every Italian record of the title, in archive order. A title whose records
 * do not line up with its page's blocks yields none: no block can be told
 * apart as one record's (`alignRecords`).
 */
export function foreignRecordsOf(page: RawPage, languages: LanguageHeadings, records: readonly TitleRecord[]): ForeignRecord[] {
  const blocks = alignRecords(readItalianPosBlocks(page, languages), records.map((record) => record.posTitle));
  if (blocks === null) return [];
  return blocks.flatMap((block, index): ForeignRecord[] => {
    const verdict = blockLanguage(block);
    if (verdict.language === "it") return [];
    return [{ lineNo: records[index].lineNo, code: verdict.code, because: verdict.because, ref: { ...block.ref, line: verdict.line } }];
  });
}
