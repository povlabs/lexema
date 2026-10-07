// Where a raw page states Italian definition text, in any layout, for the
// #699 measurement. This is a measurement's detector, not a parsing rule: no
// seed, load or lookup reads it, and nothing it finds is stored. It exists so
// the report can say which empty word pages have text on Wikizionario and in
// what layout, before any rule for a layout is asked for.
//
// It reads the lines of the page's Italian part-of-speech sections, plus the
// prose between the Italian marker and the first heading. A line counts when,
// with templates, links, pictures, bold runs (the headword, a sub-term), the
// headword itself and grammar words gone, it still shows a word (`isText`).
// Italics count only where a definition is known to be written in them (a `#`
// line, the headword line's stamp); anywhere else an italic line is a usage
// example. A `#` line holding `{{Nodef}}` says the page has no definition
// there, so it and the lines below it count only as a bold sub-term that goes
// on to define itself, as `readItalianSections` reads them.

import type { RawPage } from "../../src/source/rawPage.js";
import { POS_TITLE_BY_TEMPLATE } from "../../src/italian/wikitext.js";

/** How a line holding definition text is laid out on the page. */
export type TextLayout =
  /** `#` line with words outside italics: the shape the extraction reads as a sense. */
  | "hash-line"
  /** `#` line whose words are all inside italics. */
  | "hash-line-italic"
  /** `#*`, `#:`, `##*`… with no `#` line above it to hang from, or below one the recovered layer does not read. */
  | "hash-sub-line"
  /** `*` bullet line in the part-of-speech section. */
  | "bullet-line"
  /** `:` indented line. */
  | "indented-line"
  /** `;` definition-term line, which the syllables section also uses; read only in a part-of-speech section. */
  | "semicolon-line"
  /** The headword line (`{{Pn}}`, `'''word'''`), with the definition inside its italic grammar stamp. */
  | "headword-line-italic"
  /** The headword line, with the definition in plain text after the headword. */
  | "headword-line-plain"
  /** A plain line in the part-of-speech section, under no list marker. */
  | "prose-line"
  /** A plain line after the Italian marker and before the first part-of-speech heading. */
  | "above-heading-prose";

export interface TextLine {
  /** 1-based line in the revision. */
  line: number;
  /** The line exactly as the page has it. */
  wikitext: string;
  layout: TextLayout;
  /** The 1-based line of the part-of-speech heading it sits under; null above every heading. */
  opener: number | null;
  /** The words the detector found, for reading the report. */
  words: string;
}

/** An Italian part-of-speech section the walk opened: its heading line, verbatim, and its last non-empty line. */
export interface PosSection {
  opener: number;
  wikitext: string;
  last: number;
  /** Whether the section writes `{{Nodef}}`, the page's own mark that it gives no definition. */
  nodef: boolean;
}

/** What the walk saw: the lines with definition text, and the sections it read them in. */
export interface PageText {
  lines: TextLine[];
  sections: PosSection[];
}

/**
 * The grammar a headword line or a stamp writes, never a meaning: gender,
 * number, the words that join them, and the abbreviations Wikizionario uses
 * for them.
 */
const GRAMMAR = new Set([
  "m", "f", "n", "s", "c", "mf", "sing", "pl", "inv", "invar", "invariabile", "e", "o", "ed", "solo", "sempre",
  "singolare", "plurale", "maschile", "femminile", "comune", "agg", "sost", "avv", "tr", "intr", "rifl", "v", "loc", "spec",
]);

const NOISE = /<!--[\s\S]*?-->|<ref[^>]*\/>|<ref[^>]*>[\s\S]*?<\/ref>|<[^>]+>/g;
/** `[[File:…]]` and friends, whose captions can nest links; removed innermost first. */
const FILE = /\[\[\s*(?:File|Image|Immagine|Categoria|Category)\s*:[^[\]]*(?:\[\[[^[\]]*\]\][^[\]]*)*\]\]/gi;
const NO_DEFINITION = /\{\{\s*nodef\s*[|}]/i;

/** The text a reader sees, split into plain and italic; bold runs, which hold the headword or a sub-term, are dropped. */
function visible(body: string, title: string): { plain: string; italic: string } {
  let text = body.replace(NOISE, " ");
  for (let previous = ""; previous !== text; ) {
    previous = text;
    text = text.replace(FILE, " ");
  }
  for (let previous = ""; previous !== text; ) {
    previous = text;
    text = text.replace(/\{\{([^{}]*)\}\}/g, (_, inner: string) => (/^\s*pn\s*(\||$)/i.test(inner) ? title : " "));
  }
  text = text.replace(/\[\[(?:[^[\]|]*\|)?([^[\]]*)\]\]/g, "$1");
  let italic = false;
  let bold = false;
  const plain: string[] = [];
  const italics: string[] = [];
  for (const piece of text.split(/('{5}|'{3}|'{2})/)) {
    if (piece === "'''''") {
      italic = !italic;
      bold = !bold;
    } else if (piece === "'''") bold = !bold;
    else if (piece === "''") italic = !italic;
    else if (!bold) (italic ? italics : plain).push(piece);
  }
  return { plain: plain.join(" "), italic: italics.join(" ") };
}

/** The words of `text` once the headword and grammar are gone. */
function meaningWords(text: string, title: string): string[] {
  const escaped = title.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text
    .toLowerCase()
    .replace(new RegExp(`(^|[^\\p{L}])${escaped}(?![\\p{L}])`, "gu"), "$1 ")
    .split(/[\s,;:()[\]"«»/]+/)
    .map((word) => word.replace(/^[.'’-]+|[.'’-]+$/g, ""))
    .filter((word) => /\p{L}/u.test(word) && !GRAMMAR.has(word.replace(/\.$/, "")));
}

const letters = (word: string): number => [...word].filter((c) => /\p{L}/u.test(c)).length;

/**
 * Whether the words are text: one word of three letters or more with a vowel
 * (`# ladro`, `# dal vivo`; not `hhhhhhhh`). A headword line is held to more,
 * two words and one of five letters or more, since its stamp is grammar and a
 * typo of it (`''g ding''`, `''ms ing''`) is not a meaning.
 */
const isText = (words: readonly string[], onHeadwordLine = false): boolean =>
  onHeadwordLine
    ? words.length >= 2 && words.some((word) => letters(word) >= 5)
    : words.some((word) => letters(word) >= 3 && /[aeiouàèéìíòóùú]/iu.test(word));

const isHeadwordLine = (body: string, title: string): boolean =>
  /\{\{\s*pn\s*[|}]/i.test(body) || body.trimStart().startsWith(`'''${title}'''`) || body.trimStart().startsWith(`'''[[${title}]]'''`);

/** A line that opens with a bold sub-term marked off by `:`, `,` or a bracket, then plain words: `'''a casaccio''': senza metodo`. */
const opensSubTerm = (body: string, title: string): boolean => {
  const match = /^\s*(?:\{\{[^{}]*\}\}\s*)*'''[^']+'''\s*([:,(])/.exec(body);
  return match !== null && isText(meaningWords(visible(body, title).plain, title));
};

interface Read {
  layout: TextLayout;
  words: string;
}

/** One line's layout, when it holds definition text. `underNodef` is true below a `#` line that says the page has none. */
function layoutOf(raw: string, title: string, underNodef: boolean): Read | undefined {
  const line = raw.trim();
  // A table's markup (`{|`, `|-`, `|}`, `!`) holds no definition.
  if (line === "" || /^(?:\{\||\||!)/.test(line)) return undefined;
  const hash = /^(#+)([*:]*)\s*(.*)$/.exec(line);
  if (hash !== null) {
    const body = hash[3];
    if (hash[2] === "") {
      if (NO_DEFINITION.test(body)) return undefined;
      const { plain, italic } = visible(body, title);
      if (isText(meaningWords(plain, title))) return { layout: "hash-line", words: plain };
      return isText(meaningWords(italic, title)) ? { layout: "hash-line-italic", words: italic } : undefined;
    }
    if (underNodef && !opensSubTerm(body, title)) return undefined;
    const { plain } = visible(body, title);
    return isText(meaningWords(plain, title)) ? { layout: "hash-sub-line", words: plain } : undefined;
  }
  const marker = /^([*:;]+)\s*(.*)$/.exec(line);
  if (marker !== null) {
    const { plain } = visible(marker[2], title);
    if (!isText(meaningWords(plain, title))) return undefined;
    const layout = marker[1].startsWith("*") ? "bullet-line" : marker[1].startsWith(";") ? "semicolon-line" : "indented-line";
    return { layout, words: plain };
  }
  const { plain, italic } = visible(line, title);
  if (isHeadwordLine(line, title)) {
    if (isText(meaningWords(plain, title), true)) return { layout: "headword-line-plain", words: plain };
    return isText(meaningWords(italic, title), true) ? { layout: "headword-line-italic", words: italic } : undefined;
  }
  return isText(meaningWords(plain, title)) ? { layout: "prose-line", words: plain } : undefined;
}

const collapse = (text: string): string => text.replace(/\s+/g, " ").trim();

/** Section headings that never open a part of speech: `{{-sill-}}`, `{{-trad-}}`… (as `readStatedSections` lists them). */
const SECTION_TEMPLATES = new Set([
  "sill", "pron", "etim", "trad", "ref", "sin", "ant", "rel", "der", "var", "alter", "prov", "quote",
  "uso", "noconf", "decl", "coni", "iperon", "ipon", "example", "hyph", "cod",
]);
/** The two part-of-speech templates ADR 0028 adds, read only as `{{-x-|it}}`. */
const ADDED_POS = new Set(["loc veb", "pron"]);
const ITALIAN_POS_TITLES = new Set(Object.values(POS_TITLE_BY_TEMPLATE).map((title) => title.toLowerCase()));
const spacedOnce = (name: string): string => name.trim().replace(/\s+/g, " ");
const isPosTemplate = (name: string): boolean => Object.hasOwn(POS_TITLE_BY_TEMPLATE, spacedOnce(name));
const isLanguageCode = (name: string): boolean =>
  /^[a-z]{2,3}(?:-[a-z]{2,3})?$/.test(name) && !SECTION_TEMPLATES.has(name) && !isPosTemplate(name);

/** Where a line sits: above every heading of an Italian section, in a part-of-speech section, or elsewhere. */
type Place =
  | { kind: "above" }
  | { kind: "pos"; opener: number; italian: boolean }
  /** `section` names a `{{-name-}}` heading; `boxed` once a translation box has opened under it. */
  | { kind: "other"; section?: string; boxed?: boolean };

/**
 * Whether a `#` line under another section is the part of speech's definition
 * the page put below a stray heading: under `{{-sill-}}`, whose own lines are
 * `;`, or under `{{-trad-}}` before its translation box opens (`longanimità`,
 * `trasgressivo`, `demotivare`). In every other section a `#` list is that
 * section's own (an etymology, related words), and under a box it translates.
 */
const strayDefinitionPlace = (place: { section?: string; boxed?: boolean }): boolean =>
  place.section === "sill" || (place.section === "trad" && place.boxed !== true);

/** The page's lines with every `<!-- … -->` blanked, line for line, as a reader sees them. */
const visibleLines = (wikitext: string): string[] =>
  wikitext.replace(/<!--[\s\S]*?(?:-->|$)/g, (comment) => comment.replace(/[^\n]/g, "")).split("\n");

/**
 * Every line of the page's Italian part-of-speech sections that states
 * definition text, and the Italian prose above the first heading, in page
 * order. The walk is looser than `italianSectionLines` on purpose, so text a
 * production reader misses is still seen: a part-of-speech template opens a
 * section even with words after it on its line (`{{-agg-|it}} Arcaico`), and a
 * written sub-heading that names no part of speech (`====Pronuncia====`) does
 * not close one.
 */
export function definitionTextLines(page: RawPage): PageText {
  const found: TextLine[] = [];
  const sections: PosSection[] = [];
  const raws = page.wikitext.split("\n");
  /** The language the latest marker opened; undefined before any marker, "" after a heading that ends it. */
  let language: string | undefined;
  let place: Place = { kind: "other" };
  let underNodef = false;
  /** The latest part-of-speech heading of the language, which a `#` line under a stray heading belongs to. */
  let lastOpener: number | null = null;
  const openPos = (opener: number, italian: boolean): void => {
    place = { kind: "pos", opener, italian };
    lastOpener = opener;
    if (italian) sections.push({ opener, wikitext: raws[opener - 1], last: opener, nodef: false });
  };
  visibleLines(page.wikitext).forEach((visibleLine, index) => {
    const line = visibleLine.trim();
    const marker = /\{\{-([a-z][a-z-]*)-\}\}/.exec(line);
    if (marker !== null && isLanguageCode(marker[1]) && (line === marker[0] || line.includes("="))) {
      language = marker[1];
      place = language === "it" ? { kind: "above" } : { kind: "other" };
      lastOpener = null;
      return;
    }
    if (/^==[^=].*[^=]==$/.test(line)) {
      language = language === undefined ? undefined : "";
      place = { kind: "other" };
      return;
    }
    const template = /^\{\{-([a-z][a-z \-]*?)-(?:\|\s*([a-z-]+)\s*)?\}\}/.exec(line);
    if (template !== null) {
      const name = spacedOnce(template[1]);
      const stated = template[2];
      const opensPos = stated === undefined ? isPosTemplate(name) : stated === "it" && (!SECTION_TEMPLATES.has(name) || ADDED_POS.has(name));
      if (opensPos) openPos(index + 1, stated === "it" || language === "it");
      else place = { kind: "other", section: name };
      return;
    }
    const written = /^(={3,6})\s*(.*?)\s*\1$/.exec(line)?.[2] ?? /^'''''([^']+)'''''$/.exec(line)?.[1];
    const verbLabel = place.kind !== "pos" && /^\{\{(?:Transitivo|Intransitivo|Riflessivo)\|it\}\}/.test(line);
    if (written !== undefined) {
      if (ITALIAN_POS_TITLES.has(written.toLowerCase().replace(/\s+(?:transitivo|intransitivo|riflessivo)$/, ""))) openPos(index + 1, language === "it");
      return;
    }
    if (verbLabel) openPos(index + 1, true);
    const italian = language === "it" || (language === undefined && place.kind === "pos" && place.italian);
    if (!italian) return;
    if (place.kind === "above") {
      if (line === "" || /^[#*:;{|!<[_]/.test(line) || isHeadwordLine(line, page.title)) return;
      const { plain } = visible(line, page.title);
      if (isText(meaningWords(plain, page.title))) {
        found.push({ line: index + 1, wikitext: raws[index], layout: "above-heading-prose", opener: null, words: collapse(plain) });
      }
      return;
    }
    if (place.kind === "other") {
      if (/^(?:\{\{\s*trad1|:\*)/i.test(line)) place = { ...place, boxed: true };
      const read = /^#+(?![#*:])/.test(line) && strayDefinitionPlace(place) ? layoutOf(visibleLine, page.title, false) : undefined;
      if (read !== undefined) found.push({ line: index + 1, wikitext: raws[index], layout: read.layout, opener: lastOpener, words: collapse(read.words) });
      return;
    }
    const section = sections.at(-1);
    if (line !== "" && section?.opener === place.opener) {
      section.last = index + 1;
      if (NO_DEFINITION.test(line)) section.nodef = true;
    }
    if (/^#+(?![#*:])/.test(line)) underNodef = NO_DEFINITION.test(line);
    else if (!line.startsWith("#")) underNodef = false;
    // The words after a verb label on its own line (`{{Intransitivo|it}} occorrere…`) are read as prose.
    const read = layoutOf(verbLabel ? line.replace(/^\{\{[^{}]*\}\}/, "") : visibleLine, page.title, underNodef);
    if (read !== undefined) {
      found.push({ line: index + 1, wikitext: raws[index], layout: read.layout, opener: place.opener, words: collapse(read.words) });
    }
  });
  return { lines: found, sections };
}
