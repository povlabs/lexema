// A Wiktionary page revision as evidence (#483): the lines of it a rule reads,
// kept verbatim with the revision they came from, and the readings of those
// lines. Nothing here fetches; `src/import/measurePluralGloss.ts` does, and
// keeps only what `enExcerpt` and `itExcerpt` return, so a rule reads the same
// lines whether the page was fetched today or pinned last month.
//
// Two wikis, two shapes. en.wiktionary.org opens a language with `==Italian==`
// and a part of speech with `===Noun===` (or deeper), puts the head template on
// the next line, and states a form in a definition template:
// `# {{plural of|it|costruttrice}}`. it.wiktionary.org opens Italian with
// `== {{-it-}} ==` and a part of speech with `{{-sost-|it}}`, and lists a
// noun's four forms in `{{Tabs|ms|mp|fs|fp}}`.

import { LANGUAGE_HEADING } from "./wikitext.js";

/** One page revision a rule reads: its wiki, title, revision id, and the lines kept. */
export interface PinnedPage {
  wiki: "en.wiktionary.org" | "it.wiktionary.org";
  title: string;
  revisionId: number;
  /** The excerpt, each line verbatim; empty when the page has no Italian section. */
  lines: readonly string[];
}

/** A page the wiki does not have, as the fetch found it. */
export interface AbsentPage {
  wiki: PinnedPage["wiki"];
  title: string;
  absent: true;
}

export type FetchedPage = PinnedPage | AbsentPage;

export const isPinned = (page: FetchedPage | undefined): page is PinnedPage => page !== undefined && !("absent" in page);

// --- en.wiktionary.org ------------------------------------------------------

/** `==Italian==`: the language heading; any other level-2 heading ends it. */
const EN_ITALIAN = /^==\s*Italian\s*==\s*$/;
const EN_LEVEL_TWO = /^==[^=].*[^=]==\s*$/;
/** `===Noun===`, `====Participle====`: any heading inside the language. */
const EN_HEADING = /^(={3,})\s*([^=]+?)\s*\1\s*$/;
/** The head template a part of speech opens with. Pronunciation lines (`{{it-pr|…}}`) are not heads. */
const EN_HEAD = /^\{\{(?:head\|it\||it-(?:noun|adj|pp|plural noun)\b)/;
/** A definition line: `#`, but not a quotation (`#*`) or usage line (`#:`). */
const EN_DEFINITION = /^#(?![*:#])/;

/**
 * The lines of an en.wiktionary page a rule reads: inside `==Italian==`, every
 * heading, head template and definition line, in page order. Empty when the
 * page has no Italian section.
 */
export function enExcerpt(wikitext: string): string[] {
  const lines = wikitext.split("\n");
  const start = lines.findIndex((line) => EN_ITALIAN.test(line));
  if (start < 0) return [];
  const kept: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (EN_LEVEL_TWO.test(line)) break;
    if (EN_HEADING.test(line) || EN_HEAD.test(line) || EN_DEFINITION.test(line)) kept.push(line);
  }
  return kept;
}

/** One template call: `{{adj form of|it|curvo||f|p}}` is `adj form of` with `["it", "curvo", "", "f", "p"]`. */
export interface Template {
  name: string;
  positional: readonly string[];
  named: Readonly<Record<string, string>>;
  /** The call as written. */
  text: string;
}

/** Split `body` on `|` outside nested `{{…}}` and `[[…]]`. */
function splitParams(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < body.length; i++) {
    const pair = body.slice(i, i + 2);
    if (pair === "{{" || pair === "[[") {
      depth++;
      current += pair;
      i++;
    } else if ((pair === "}}" || pair === "]]") && depth > 0) {
      depth--;
      current += pair;
      i++;
    } else if (body[i] === "|" && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += body[i];
    }
  }
  parts.push(current);
  return parts;
}

/** The outermost template calls on `line`, in order. An unclosed call ends the reading. */
export function templatesOn(line: string): Template[] {
  const found: Template[] = [];
  let i = line.indexOf("{{");
  while (i >= 0) {
    let depth = 0;
    let end = -1;
    for (let j = i; j < line.length - 1; j++) {
      const pair = line.slice(j, j + 2);
      if (pair === "{{") {
        depth++;
        j++;
      } else if (pair === "}}") {
        depth--;
        j++;
        if (depth === 0) {
          end = j + 1;
          break;
        }
      }
    }
    if (end < 0) break;
    const text = line.slice(i, end);
    const [name, ...params] = splitParams(text.slice(2, -2));
    const positional: string[] = [];
    const named: Record<string, string> = {};
    for (const param of params) {
      const eq = param.indexOf("=");
      // A named parameter's key is a plain name; `=` inside a link or a nested call is part of a value.
      if (eq > 0 && /^[\w ]+$/.test(param.slice(0, eq))) named[param.slice(0, eq).trim()] = param.slice(eq + 1).trim();
      else positional.push(param.trim());
    }
    found.push({ name: name.trim(), positional, named, text });
    i = line.indexOf("{{", end);
  }
  return found;
}

/** One part of speech of the Italian section: its heading, its head line if any, and its definition lines. */
export interface EnBlock {
  /** `Noun`, `Adjective`, `Participle`. */
  heading: string;
  /** The heading line as written: `===Noun===`. */
  headingLine: string;
  head: string | undefined;
  definitions: readonly string[];
}

/** The excerpt's parts of speech, in page order. A heading with no head and no definition (`===Etymology===`) is still a block, and matches no part of speech. */
export function enBlocks(excerpt: readonly string[]): EnBlock[] {
  const blocks: { heading: string; headingLine: string; head: string | undefined; definitions: string[] }[] = [];
  for (const line of excerpt) {
    const heading = EN_HEADING.exec(line);
    if (heading !== null) {
      blocks.push({ heading: heading[2], headingLine: line, head: undefined, definitions: [] });
      continue;
    }
    const block = blocks.at(-1);
    if (block === undefined) continue;
    if (EN_HEAD.test(line)) block.head ??= line;
    else block.definitions.push(line);
  }
  return blocks;
}

export type Gender = "masculine" | "feminine";

/**
 * The gender a gender spec states: `m`, `m-p` and `m-s` are masculine, `f`,
 * `f-p` and `f-s` feminine. `mf`, `mfbysense`, `m//f` and anything else state
 * no one gender.
 */
export function genderOfSpec(spec: string): Gender | undefined {
  const base = spec.split("-")[0];
  if (base === "m") return "masculine";
  if (base === "f") return "feminine";
  return undefined;
}

/** The genders the head line of a block states: `{{head|it|noun form|g=m|g2=f}}` states two. */
export function headGenders(head: string | undefined): Set<Gender> {
  const genders = new Set<Gender>();
  if (head === undefined) return genders;
  const [template] = templatesOn(head);
  if (template === undefined) return genders;
  const specs = template.name === "head"
    ? Object.entries(template.named).filter(([key]) => /^g\d*$/.test(key)).map(([, value]) => value)
    : template.positional.slice(0, 1);
  for (const spec of specs) {
    const gender = genderOfSpec(spec);
    if (gender !== undefined) genders.add(gender);
  }
  return genders;
}

/** Whether the head line names the form singular: `g=f-s`. */
export function headSaysSingular(head: string | undefined): boolean {
  if (head === undefined) return false;
  const [template] = templatesOn(head);
  return template !== undefined && Object.entries(template.named).some(([key, value]) => /^g\d*$/.test(key) && /-s$/.test(value));
}

// --- it.wiktionary.org ------------------------------------------------------

/** `{{-sost-|it}}`, `{{-sost form-|it}}`: a part-of-speech heading. */
const IT_POS = /^\{\{-([a-z][a-z \-]*?)-\|it\}\}/;

/**
 * The lines of an it.wiktionary page a rule reads: inside `== {{-it-}} ==`,
 * every part-of-speech heading and every line with a `{{Tabs|…}}` call, in
 * page order. Empty when the page has no Italian section.
 */
export function itExcerpt(wikitext: string): string[] {
  const kept: string[] = [];
  let inItalian = false;
  for (const line of wikitext.split("\n")) {
    const language = LANGUAGE_HEADING.exec(line);
    if (language !== null) {
      inItalian = language[1] === "it";
      continue;
    }
    if (inItalian && (IT_POS.test(line) || line.includes("{{Tabs|"))) kept.push(line);
  }
  return kept;
}

/** Where a word sits in a noun's `{{Tabs|ms|mp|fs|fp}}`: which number, under which heading line. */
export interface TabsPlace {
  number: "singular" | "plural";
  gender: Gender;
  /** The heading's part of speech: `sost` for `{{-sost-|it}}`, `sost form`, `agg`. */
  pos: string;
  /** The heading line and the Tabs line, as written. */
  shows: string;
}

const TABS_SLOTS = [
  { number: "singular", gender: "masculine" },
  { number: "plural", gender: "masculine" },
  { number: "singular", gender: "feminine" },
  { number: "plural", gender: "feminine" },
] as const;

/**
 * Every place `word` takes in a `{{Tabs|…}}` under a part-of-speech heading
 * (`{{-sost-|it}}`, `{{-agg-|it}}`…). A slot may list alternatives,
 * `malvagie/malvage`; each counts.
 */
export function tabsPlaces(excerpt: readonly string[], word: string): TabsPlace[] {
  const places: TabsPlace[] = [];
  let heading: { line: string; pos: string } | undefined;
  for (const line of excerpt) {
    const pos = IT_POS.exec(line);
    if (pos !== null) heading = { line, pos: pos[1] };
    if (heading === undefined) continue;
    const at = heading;
    const shows = at.line === line ? line : `${at.line.trim()} ${line.trim()}`;
    for (const tabs of templatesOn(line).filter((template) => template.name === "Tabs")) {
      tabs.positional.slice(0, 4).forEach((slot, i) => {
        if (slot.split("/").map((form) => form.trim()).includes(word)) places.push({ ...TABS_SLOTS[i], pos: at.pos, shows });
      });
    }
  }
  return places;
}
