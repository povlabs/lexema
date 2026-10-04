// The fields a page-only entry carries beside its definitions (ADR 0026, #439):
// every field the word page shows, each read from the entry's own raw page.
//
// ADR 0026 grants gender and number, the word a definition is a form of, the
// forms the page writes out, the pronunciation, the etymology, synonyms,
// antonyms, derived words and expressions. Each is read by a fixed rule over
// the page's layout and markup, never over what its words mean, and each fact
// keeps the revision, the 1-based line and that line's wikitext verbatim.
// Nothing is filled in: a field the page does not write is not a fact, and a
// line whose templates the renderer cannot print gives nothing rather than a
// guess at what they print. Hyphenation (`{{-sill-}}`) is not read: the word
// page does not show it.
//
// The part-of-speech section the entry was read from gives the grammar, the
// forms and the form-of targets: they belong to that section. The word
// sections Wikizionario writes once after the sections (`{{-pron-}}`,
// `{{-etim-}}`, `{{-sin-}}`, `{{-ant-}}`, `{{-der-}}`, `{{-prov-}}`) give the
// rest, and every entry of the page carries them, as every archive record of
// a headword repeats its word-level fields.

import type { RawPage, RawPageRef } from "../source/rawPage.js";
import { expressionPhrase } from "./expressions.js";
import type { PosTitle } from "./partOfSpeech.js";
import { italianSectionLines, renderInline, type PageDefinition, type SectionLine, type TemplatePrinter, type WordSectionName } from "./wikitext.js";

/** The rule's name and version, stored with every fact it reads. */
export const PAGE_FACT_RULE = "italian-page-facts/v1" as const;

/** Where a fact was read: the revision and line, and that line verbatim. */
export interface FactLine {
  ref: RawPageRef;
  wikitext: string;
}

export type FactGender = "masculine" | "feminine";
export type FactNumber = "singular" | "plural" | "invariable";

/** The tags a written-out form states: `{{Linkp}}` a plural, `{{Tabs}}` a gender and a number. */
export type FormTags = readonly ["plural"] | readonly [FactGender, "singular" | "plural"];

/** The grammar dimension each form tag states, named as the archive's grammar claims name it. */
export const FORM_TAG_DIMENSION: Readonly<Record<FormTags[number], "gender" | "number">> = {
  masculine: "gender",
  feminine: "gender",
  singular: "number",
  plural: "number",
};

/** Whether a stored tag is one a written-out form can state. */
export const isFormTag = (tag: string): tag is FormTags[number] => Object.hasOwn(FORM_TAG_DIMENSION, tag);

/** The three word lists, named as a page-only entry stores them. */
export const RELATED_KINDS = ["synonym", "antonym", "derived"] as const;
export type RelatedKind = (typeof RELATED_KINDS)[number];

/** One fact a page-only entry carries, and the line it was read from. */
export type PageFact = FactLine &
  (
    /** The headword line's stamp states a gender: `''f sing''` states feminine, written `f`. */
    | { kind: "gender"; value: FactGender; sourceText: string }
    /** The stamp states a number: `sing`, `pl` or `inv`. */
    | { kind: "number"; value: FactNumber; sourceText: string }
    /** A form the page writes out, with the tags its template states. */
    | { kind: "form"; surface: string; tags: FormTags }
    /** The word definition `definition` of the entry is a form of: `plurale di [[cane]]` names `cane`. */
    | { kind: "form-of"; definition: number; word: string }
    | { kind: "pronunciation"; ipa: string }
    | { kind: "etymology"; text: string }
    /** One word of a list, with the labels its line opens with: `''(di libri, film)''`, `{{Glossa|letterario}}`. */
    | { kind: RelatedKind; word: string; rawTags: string[] }
    /** One `{{-prov-}}` item: its phrase under the item rules of expressions.ts, and its meaning. */
    | { kind: "expression"; phrase: string; meaning: string | null }
  );

/** What the rule reads an entry by: its page, the line that opened its section, its title and its definitions. */
export interface FactsOf {
  page: RawPage;
  posRef: RawPageRef;
  posTitle: PosTitle;
  definitions: readonly PageDefinition[];
}

/** Every fact the entry's own page gives, its section's first, then the word sections', in page order. */
export function readPageFacts(entry: FactsOf): PageFact[] {
  const lines = italianSectionLines(entry.page);
  const own = lines.filter((line) => line.section.kind === "pos" && line.section.opener === entry.posRef.line);
  const at = (line: SectionLine): FactLine => ({ ref: { ...entry.posRef, line: line.line }, wikitext: line.wikitext });
  const headword = entry.page.title;
  const inWord = (name: WordSectionName) => lines.filter((line) => line.section.kind === "word" && line.section.name === name);
  return [
    ...headwordLineFacts(own, at),
    ...tableForms(own, at),
    ...formOfTargets(entry),
    ...inWord("pron").flatMap((line) => pronunciations(line.visible).map((ipa): PageFact => ({ kind: "pronunciation", ipa, ...at(line) }))),
    ...inWord("etim").flatMap((line) => etymology(line.visible, headword).map((text): PageFact => ({ kind: "etymology", text, ...at(line) }))),
    ...(["sin", "ant", "der"] as const).flatMap((name) =>
      inWord(name).flatMap((line) =>
        listItem(line.visible).flatMap((body) => {
          const { words, rawTags } = relatedWords(body, headword);
          return words.map((word): PageFact => ({ kind: RELATED_BY_SECTION[name], word, rawTags, ...at(line) }));
        }),
      ),
    ),
    ...inWord("prov").flatMap((line) =>
      listItem(line.visible).flatMap((body) => expression(body, headword).map((item): PageFact => ({ kind: "expression", ...item, ...at(line) }))),
    ),
  ];
}

const RELATED_BY_SECTION = { sin: "synonym", ant: "antonym", der: "derived" } as const satisfies Record<string, RelatedKind>;

// --- The entry's own section --------------------------------------------------

/** `{{Pn}}`, `{{Pn|w}}`, `{{Pn|w=…}}`, or a bold headword: what opens a headword line. */
const HEADWORD_OPENER = /^(?:#\s*)?(?:\{\{\s*Pn\s*(?:\|[^{}]*)?\}\}|'''[^']+''')/i;

/**
 * The stamp Wikizionario writes after a headword: a gender letter, or both
 * joined by `e`, then optionally `sing`, `pl` or `inv`, and nothing else. A
 * line that writes anything else there (`masc. sing.`, `m pl. -i`) states no
 * grammar this rule reads.
 */
const STAMP = /^(?<first>[mf])(?: e (?<second>[mf]))?(?: (?<number>sing|pl|inv))?$/;
const STAMP_GENDER = { m: "masculine", f: "feminine" } as const;
const STAMP_NUMBER = { sing: "singular", pl: "plural", inv: "invariable" } as const;

/** The section's headword line: the first line, up to its first `#` line, that opens with the headword. */
function headwordLine(own: readonly SectionLine[]): SectionLine | undefined {
  for (const line of own) {
    const text = line.visible.trim();
    if (HEADWORD_OPENER.test(text)) return line;
    if (text.startsWith("#")) return undefined;
  }
  return undefined;
}

/** The gender, number and plural forms the headword line writes. */
function headwordLineFacts(own: readonly SectionLine[], at: (line: SectionLine) => FactLine): PageFact[] {
  const line = headwordLine(own);
  if (line === undefined) return [];
  const afterHead = line.visible.trim().replace(HEADWORD_OPENER, "");
  const stamp = afterHead.split(/\{\{|\(/)[0].replace(/'{2,}/g, "").replace(/\s+/g, " ").replace(/[\s;,.]+$/, "").trim();
  const facts: PageFact[] = [];
  const groups = STAMP.exec(stamp)?.groups as { first: "m" | "f"; second?: "m" | "f"; number?: "sing" | "pl" | "inv" } | undefined;
  if (groups !== undefined) {
    for (const letter of new Set([groups.first, ...(groups.second === undefined ? [] : [groups.second])])) {
      facts.push({ kind: "gender", value: STAMP_GENDER[letter], sourceText: letter, ...at(line) });
    }
    if (groups.number !== undefined) facts.push({ kind: "number", value: STAMP_NUMBER[groups.number], sourceText: groups.number, ...at(line) });
  }
  // Module:Link-FormeFlesse (raw source read 2026-10-04): `{{Linkp|…}}` prints
  // `(pl.: [[a]], [[b]])`, one link per argument, or `(invariabile)` when the
  // first is `inv` or `invariabile`.
  const linkp = templateArgs(line.visible, "linkp");
  if (linkp !== undefined && !["inv", "invariabile"].includes(linkp.positional[0] ?? "")) {
    for (const surface of linkp.positional) facts.push({ kind: "form", surface, tags: ["plural"], ...at(line) });
  }
  return facts;
}

/**
 * The forms `{{Tabs|…}}` writes out in the section. Module:Tabs (raw source
 * read 2026-10-04) prints a table of masculine and feminine, singular and
 * plural, from arguments 1 to 4 or `m`, `mp`, `f`, `fp`, with `m2`, `mp2`,
 * `f2`, `fp2` beside them; with any of the four missing it prints an error,
 * so it gives no form.
 */
function tableForms(own: readonly SectionLine[], at: (line: SectionLine) => FactLine): PageFact[] {
  for (const line of own) {
    const tabs = templateArgs(line.visible, "tabs");
    if (tabs === undefined) continue;
    const { positional, named } = tabs;
    const cells = [
      { names: ["m", "m2"], index: 0, tags: ["masculine", "singular"] },
      { names: ["mp", "mp2"], index: 1, tags: ["masculine", "plural"] },
      { names: ["f", "f2"], index: 2, tags: ["feminine", "singular"] },
      { names: ["fp", "fp2"], index: 3, tags: ["feminine", "plural"] },
    ] as const;
    const base = cells.map((cell) => named.get(cell.names[0]) ?? positional[cell.index]);
    if (base.some((surface) => surface === undefined || surface === "")) return [];
    return cells.flatMap((cell, i) =>
      [base[i] as string, named.get(cell.names[1]) ?? ""]
        .filter((surface) => surface !== "")
        .map((surface): PageFact => ({ kind: "form", surface, tags: cell.tags, ...at(line) })),
    );
  }
  return [];
}

/** The first `{{name|…}}` on a line, with its arguments trimmed, as MediaWiki's module arguments are. */
function templateArgs(text: string, name: string): { positional: string[]; named: Map<string, string> } | undefined {
  for (const match of text.matchAll(/\{\{([^{}]*)\}\}/g)) {
    const [head, ...args] = match[1].split("|").map((part) => part.trim());
    if (head.toLowerCase() !== name) continue;
    const positional: string[] = [];
    const named = new Map<string, string>();
    for (const arg of args) {
      const equals = arg.indexOf("=");
      if (equals < 0) positional.push(arg);
      else named.set(arg.slice(0, equals).trim(), arg.slice(equals + 1).trim());
    }
    return { positional: positional.filter((arg) => arg !== ""), named };
  }
  return undefined;
}

/** A section title that names an inflected form: `Sostantivo, forma flessa`, `Voce verbale`. */
const namesAForm = (posTitle: PosTitle): boolean => posTitle === "Voce verbale" || posTitle.endsWith(", forma flessa");

/** A link that ends its line: its target, without a `#section`, and what the line writes before it. */
const CLOSING_LINK = /^(.*)\[\[([^[\]|#]*)(?:#[^[\]|]*)?(?:\|[^[\]]*)?\]\][\s.;]*$/;
/** The words that name the form's lemma right before it: `plurale di`, `del verbo`. */
const NAMES_LEMMA = /(?:^|\s)(?:di|del verbo)$/;

/**
 * In a section of inflected forms, the word each definition is a form of: the
 * link its line ends with when `di` or `del verbo` comes right before it,
 * `#plurale di [[avventuriero]]`, the target as the page writes it and without
 * its `#section`. Any other line names no word this rule reads: `radiose`'s
 * `che mandano fuori una forte [[luce]]` defines, it does not point.
 */
function formOfTargets(entry: FactsOf): PageFact[] {
  if (!namesAForm(entry.posTitle)) return [];
  return entry.definitions.flatMap((definition, index): PageFact[] => {
    const visible = definition.wikitext.replace(/<!--[\s\S]*?-->/g, " ");
    const closing = CLOSING_LINK.exec(visible);
    if (closing === null) return [];
    const before = closing[1].replace(/'{2,}/g, "").replace(/\s+/g, " ").trim();
    const target = closing[2].trim();
    if (!NAMES_LEMMA.test(before) || target === "" || target.includes(":") || target === entry.page.title) return [];
    return [{ kind: "form-of", definition: index, word: target, ref: definition.ref, wikitext: definition.wikitext }];
  });
}

// --- The word sections ----------------------------------------------------------

/**
 * Every transcription a pronunciation line's `{{IPA|…}}` prints. Template:IPA
 * (raw source read 2026-10-04) prints each of its first six arguments, so each
 * is one pronunciation. A line with no template, such as a bare `/…/`, gives none.
 */
function pronunciations(visible: string): string[] {
  const ipa = templateArgs(visible, "ipa");
  return ipa === undefined ? [] : ipa.positional.slice(0, 6);
}

/**
 * What an etymology line's templates print beyond the renderer's own, read off
 * each template's raw source on 2026-10-04: `{{Etim-link|x}}` and `{{Vd|x}}`
 * print `vedi x`, the first with its second argument as the label when given,
 * and `{{el}}` prints `greco`.
 */
const ETYMOLOGY_PRINTING: Readonly<Record<string, TemplatePrinter>> = {
  "etim-link": ([target, label]) => (target === undefined || target === "" ? undefined : `vedi [[${target}|${label === undefined || label === "" ? target : label}]]`),
  vd: ([target, label]) => (target === undefined || target === "" ? undefined : `vedi [[${target}|${label === undefined || label === "" ? target : label}]]`),
  el: () => "greco",
};

/** One etymology line as a reader sees it, or nothing when it says nothing or holds a template no rule prints (`{{Noetim}}`). */
function etymology(visible: string, headword: string): string[] {
  const body = visible.trim().replace(/^[*#:;]+\s*/, "");
  if (body === "") return [];
  const rendered = renderInline(body, headword, ETYMOLOGY_PRINTING);
  return rendered.rendered && /\p{L}/u.test(rendered.text) ? [rendered.text] : [];
}

/** A `*` list line's body, or nothing for any other line. */
const listItem = (visible: string): string[] => {
  const item = /^\*+\s*(.*)$/.exec(visible.trim());
  return item === null || item[1].trim() === "" ? [] : [item[1].trim()];
};

/** A bracketed label a list line opens with, italic or bold or neither: `''(di tempo)''`, `'''(aggettivo)'''`. */
const LEADING_BRACKET = /^('{0,5})\s*\(([^()]*)\)\s*\1\s*[.:]?\s*/;
/** A template a list line opens with. */
const LEADING_TEMPLATE = /^\{\{[^{}]*\}\}\s*/;

/**
 * The labels a list line opens with, and the rest of it. A label is a bracket
 * or a template that prints nothing but a label (`{{Term|raro|it}}`, `{{Fig}}`).
 */
function leadingLabels(body: string, headword: string): { rawTags: string[]; rest: string } {
  const rawTags: string[] = [];
  let rest = body;
  for (;;) {
    const bracket = LEADING_BRACKET.exec(rest);
    if (bracket !== null) {
      const label = renderInline(bracket[2], headword);
      if (!label.rendered) break;
      if (label.text !== "") rawTags.push(label.text);
      rest = rest.slice(bracket[0].length);
      continue;
    }
    const template = LEADING_TEMPLATE.exec(rest);
    if (template === null) break;
    const label = renderInline(template[0], headword);
    if (!label.rendered || label.text !== "" || label.labels.length === 0) break;
    rawTags.push(...label.labels);
    rest = rest.slice(template[0].length);
  }
  return { rawTags, rest };
}

/** Split on commas and semicolons outside links and templates. */
function topLevelSegments(text: string): string[] {
  const segments: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const pair = text.slice(i, i + 2);
    if (pair === "[[" || pair === "{{") {
      depth += 1;
      i += 1;
    } else if ((pair === "]]" || pair === "}}") && depth > 0) {
      depth -= 1;
      i += 1;
    } else if (depth === 0 && (text[i] === "," || text[i] === ";")) {
      segments.push(text.slice(start, i));
      start = i + 1;
    }
  }
  segments.push(text.slice(start));
  return segments.map((segment) => segment.trim()).filter((segment) => segment !== "");
}

const WIKILINK = /\[\[([^[\]|]*)(?:\|([^[\]]*))?\]\]/g;
const hasLetter = (text: string): boolean => /\p{L}/u.test(text);
/** Whether every bracket a text opens it also closes, in order. A piece of a broken label (`nello spazio)alto`) does not. */
function bracketsBalance(text: string): boolean {
  let open = 0;
  for (const char of text) {
    if (char === "(") open += 1;
    else if (char === ")" && --open < 0) return false;
  }
  return open === 0;
}

/** A word as a list shows it: without the punctuation that joined it to the next. */
const tidyWord = (text: string): string => text.replace(/^[\s.:;,]+|[\s.:;,]+$/g, "");

/**
 * The words of one synonym, antonym or derived-word line, and the labels it
 * opens with. A segment between commas that is only links is one word per
 * link (`[[mostrare]] [[offrire]]`, where the page dropped a comma); one that
 * writes words outside its links is one word as written (`dar notizia`,
 * `[[nutrì]] fiducia`). A segment that links into another namespace
 * (`[[Speciale:PuntanoQui/-osi|elenco automatico]]`) is not a word.
 */
function relatedWords(body: string, headword: string): { words: string[]; rawTags: string[] } {
  const { rawTags, rest } = leadingLabels(body, headword);
  const words: string[] = [];
  for (const segment of topLevelSegments(rest)) {
    const links = [...segment.matchAll(WIKILINK)];
    if (links.some((link) => link[1].includes(":"))) continue;
    const outside = segment.replace(WIKILINK, " ");
    const pieces = links.length > 0 && !hasLetter(outside) ? links.map((link) => link[0]) : [segment];
    for (const piece of pieces) {
      const rendered = renderInline(piece, headword);
      if (!rendered.rendered) continue;
      const word = tidyWord(rendered.text);
      if (hasLetter(word) && bracketsBalance(word)) words.push(word);
    }
  }
  return { words, rawTags };
}

/**
 * One `{{-prov-}}` item: the italic phrase up to the colon after it, then its
 * meaning (`''{{Pn}} per filo e per segno'': raccontare minuziosamente…`); or
 * an item that is all italic, a phrase with no meaning. Anything else, and any
 * item a template no rule prints sits in, gives none.
 */
function expression(body: string, headword: string): { phrase: string; meaning: string | null }[] {
  const colon = /'{2,}\s*:/.exec(body);
  const phraseText = colon === null ? body : body.slice(0, colon.index + colon[0].length - 1);
  const rendered = renderInline(phraseText, headword);
  if (!rendered.rendered) return [];
  if (colon === null && !rendered.runs.every((run) => run.italic || !hasLetter(run.text))) return [];
  const phrase = expressionPhrase(rendered.text);
  if (phrase === undefined) return [];
  if (colon === null) return [{ phrase, meaning: null }];
  const meaning = renderInline(body.slice(colon.index + colon[0].length), headword);
  if (!meaning.rendered) return [];
  return [{ phrase, meaning: hasLetter(meaning.text) ? meaning.text : null }];
}
