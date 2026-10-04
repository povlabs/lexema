// Read-only, whole-dump measurement for epic #471 (#474): every main-namespace
// page with Italian `#` definitions and no Italian archive record, grouped by
// how the page is laid out. The layout detectors live here only; they change
// no production rule. `src/italian/pageEntry.ts` is called only to say which
// pages rule v1 alone, and the production rule the seed runs (v1, then v2),
// recover, so the detector's count and the rule's count can be compared.
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { isMain } from "../commandLine.js";
import { recoverPageEntry, recoverUnderRuleV1, PAGE_ENTRY_RULE, PAGE_ENTRY_RULE_V2 } from "../italian/pageEntry.js";
import { POS_TITLE_BY_TEMPLATE } from "../italian/wikitext.js";
import { PUBLISHED_ARCHIVE_SHA256 } from "../source/archiveFacts.js";
import type { RawPage } from "../source/rawPage.js";
import { ARCHIVE_DUMP, VerifiedDump } from "../source/wiktionaryDump.js";
import { parseArchive } from "./importRelease.js";
import type { UnrecordedPageTitles } from "./pageOnlyCandidates.js";

/** How the page marks its Italian section. */
export type LanguageHeading =
  | "standard" // `== {{-it-}} ==`, the heading the production readers know
  | "malformed" // `{{-it-}}` inside a heading line those readers reject: `= {{-it-}} =`, `[[]]== {{-it-}} ==`
  | "bare" // `{{-it-}}` alone on a line, with no `=`
  | "none"; // no Italian marker; a `{{-sost-|it}}`-style heading states the language

/** What opens the part-of-speech section a definition sits in. */
export type PosSignal =
  | "template" // `{{-sost-|it}}`
  | "spaced-template" // `{{-sost  form-|it}}`, ` {{-sost-|it}}`: a known template written with stray spaces
  | "bare-template" // `{{-sost-}}`
  | "verb-label" // `{{Transitivo|it}}`, `{{Intransitivo|it}}`, `{{Riflessivo|it}}` with no heading open
  | "italian-heading" // `=== Verbo transitivo ===`, `'''''Verbo'''''`: a written Italian part-of-speech title
  | "english-heading" // `===Verb===`, as pages copied from English Wiktionary write it
  | "unknown-template"; // `{{-loc veb-|it}}`: a template the part-of-speech table does not know

/** One section holding Italian definitions, and the part of speech it states, if any. */
export interface PosSection {
  signal: PosSignal;
  /** The extraction's title for the stated part of speech: `Verbo`, `Sostantivo`. */
  pos: string | null;
  definitions: number;
}

export type LayoutGroup =
  | "english-wiktionary-copy"
  | "no-part-of-speech"
  | "several-parts-of-speech"
  | `${LanguageHeading}-heading/${PosSignal}`;

export interface PageLayout {
  heading: LanguageHeading;
  sections: PosSection[];
  /** Italian definitions above any part-of-speech signal. */
  unplaced: number;
  /** The page carries `{{Trasfen}}`: copied from English Wiktionary. */
  englishCopy: boolean;
  group: LayoutGroup;
  /** The parts of speech the fixed detector reads, or none when any definition is unread. */
  readAs: string[];
}

/** Section templates that are not a language: `{{-sill-}}`, `{{-trad-}}`… */
const SECTION_TEMPLATES = new Set([
  "sill", "pron", "etim", "trad", "ref", "sin", "ant", "rel", "der", "var", "alter", "prov", "quote",
  "uso", "noconf", "decl", "coni", "iperon", "ipon", "example", "hyph", "cod",
]);
const isPosTemplate = (name: string): boolean => POS_TITLE_BY_TEMPLATE[normal(name)] !== undefined;
/** `loc  verb` and `agg  form` are written with doubled spaces; the table spells them single. */
const normal = (name: string): string => name.trim().replace(/\s+/g, " ");
/** A language code as a `{{-xx-}}` marker spells it. */
const isLanguage = (name: string): boolean =>
  /^[a-z]{2,3}(?:-[a-z]{2,3})?$/.test(name) && !SECTION_TEMPLATES.has(name) && !isPosTemplate(name);

const VERB_LABEL = /^\{\{(?:Transitivo|Intransitivo|Riflessivo)\|it\}\}$/;
const ITALIAN_POS_TITLES = new Map(Object.values(POS_TITLE_BY_TEMPLATE).map((title) => [title.toLowerCase(), title]));
const ENGLISH_POS_HEADING = /^(?:verb|noun|adjective|adverb|adverbial phrase|preposition|conjunction|conjunction phrase|interjection|pronoun|phrase|proper noun)$/i;
const REDIRECT = /^#\s*(?:rinvia|redirect)\b/i;
const SENSE_LINE = /^(#+)(?![#*:])\s*(.*)$/;

/**
 * Whether a `#` line states something in plain text beyond the headword: not
 * only templates (`{{Nodef|it}}`), italics (a gender stamp, `''m''`) and the
 * bold headword (`'''carciofino''' ''m'';`).
 */
function statesMeaning(body: string, title: string): boolean {
  let text = body.replace(/<!--[\s\S]*?-->|<ref[^>]*\/>|<ref[^>]*>[\s\S]*?<\/ref>|<[^>]+>/g, " ");
  for (let previous = ""; previous !== text; ) {
    previous = text;
    text = text.replace(/\{\{[^{}]*\}\}/g, " ");
  }
  text = text
    .replace(/\[\[(?:[^[\]|]*\|)?([^[\]]*)\]\]/g, "$1")
    .replace(/'{5}[^']*'{5}/g, " ")
    .replace(/'{3}([^']*)'{3}/g, "$1")
    .replace(/'{2}[^']*'{2}/g, " ")
    .replace(/'{2,}/g, "");
  return /\p{L}/u.test(text.split(title).join(" "));
}

/** A heading line written with `=`, its text without the `=` and spaces. */
const headingText = (line: string): string | undefined => {
  const match = /^(={1,6})\s*(.*?)\s*\1$/.exec(line);
  return match === null ? undefined : match[2];
};

type Opener = { signal: PosSignal; pos: string | null; italian: boolean | undefined };

/** What a line opens, if it opens a part-of-speech section. `italian` is the language it states, if any. */
function posOpener(raw: string, sectionOpen: boolean): Opener | undefined {
  const line = raw.trim();
  const qualified = /^\{\{-([a-z][a-z \-]*?)-\|(\s*)([a-z-]+)(\s*)\}\}$/.exec(line);
  if (qualified !== null) {
    const pos = POS_TITLE_BY_TEMPLATE[normal(qualified[1])];
    const spaced = /^\s/.test(raw) || qualified[1] !== normal(qualified[1]) || qualified[2] !== "" || qualified[4] !== "";
    const signal = pos === undefined ? "unknown-template" : spaced ? "spaced-template" : "template";
    return { signal, pos: pos ?? null, italian: qualified[3] === "it" };
  }
  const bare = /^\{\{-([a-z][a-z ]*?)-\}\}$/.exec(line);
  if (bare !== null && isPosTemplate(bare[1])) {
    return { signal: "bare-template", pos: POS_TITLE_BY_TEMPLATE[normal(bare[1])], italian: undefined };
  }
  if (VERB_LABEL.test(line) && !sectionOpen) return { signal: "verb-label", pos: "Verbo", italian: true };
  const written = headingText(line) ?? /^'''''([^']+)'''''$/.exec(line)?.[1];
  if (written === undefined || written.includes("{{")) return undefined;
  const lead = written.toLowerCase().replace(/\s+(?:transitivo|intransitivo|riflessivo)$/, "");
  const italianTitle = ITALIAN_POS_TITLES.get(lead);
  if (italianTitle !== undefined) return { signal: "italian-heading", pos: italianTitle, italian: undefined };
  if (ENGLISH_POS_HEADING.test(written)) return { signal: "english-heading", pos: null, italian: undefined };
  return undefined;
}

/**
 * The page's layout: its Italian marker, its part-of-speech sections that hold
 * Italian definitions, and the group it counts in. `undefined` when the page
 * has no Italian `#` line that states a meaning.
 */
export function readPageLayout(page: RawPage): PageLayout | undefined {
  /** The language the latest marker opened; `undefined` before any marker. */
  let language: string | undefined;
  let heading: LanguageHeading = "none";
  let section: (PosSection & { italian: boolean | undefined }) | undefined;
  const sections: (PosSection & { italian: boolean | undefined })[] = [];
  let unplaced = 0;
  for (const raw of page.wikitext.split("\n")) {
    const line = raw.trim();
    // A language marker: `{{-xx-}}` alone, or inside a heading line of any shape.
    const marker = /\{\{-([a-z][a-z-]*)-\}\}/.exec(line);
    if (marker !== null && isLanguage(marker[1]) && (line === marker[0] || line.includes("="))) {
      language = marker[1];
      if (language === "it" && heading === "none") {
        heading = line === marker[0] ? "bare" : /^==\s*\{\{-it-\}\}\s*==$/.test(line) ? "standard" : "malformed";
      }
      section = undefined;
      continue;
    }
    if (/^==[^=].*[^=]==$/.test(line)) {
      // A level-two heading with no language marker (`== Altri progetti ==`) ends every section.
      language = language === undefined ? undefined : "";
      section = undefined;
      continue;
    }
    const opener = posOpener(raw, section !== undefined);
    if (opener !== undefined) {
      section = { signal: opener.signal, pos: opener.pos, definitions: 0, italian: opener.italian };
      sections.push(section);
      continue;
    }
    if (/^\{\{-/.test(line) || /^=/.test(line)) {
      section = undefined;
      continue;
    }
    const sense = SENSE_LINE.exec(line);
    if (sense === null || REDIRECT.test(line) || !statesMeaning(sense[2], page.title)) continue;
    // Italian when one signal says so and none says another language.
    const scope = language === undefined ? undefined : language === "it";
    if (section === undefined) {
      if (scope === true) unplaced += 1;
      continue;
    }
    const italian = scope === false || section.italian === false ? false : scope === true || section.italian === true;
    if (italian) section.definitions += 1;
  }
  const held = sections.filter((item) => item.definitions > 0).map(({ signal, pos, definitions }) => ({ signal, pos, definitions }));
  if (held.length === 0 && unplaced === 0) return undefined;
  const englishCopy = /\{\{\s*Trasfen\s*[|}]/i.test(page.wikitext);
  const group: LayoutGroup = englishCopy ? "english-wiktionary-copy"
    : held.length === 0 ? "no-part-of-speech"
      : held.length > 1 ? "several-parts-of-speech"
        : `${heading}-heading/${held[0].signal}`;
  const read = unplaced === 0 && held.every((item) => item.pos !== null);
  return { heading, sections: held, unplaced, englishCopy, group, readAs: read ? held.flatMap((item) => (item.pos === null ? [] : [item.pos])) : [] };
}

/** The part of the measurement the record-less title list is read from. */
export interface UnrecordedMeasurement {
  release: string;
  titles: readonly { title: string }[];
  recoveredByProductionRule: { notCounted: { titles: readonly { title: string }[] } };
}

/**
 * The record-less titles a fixture seed offers as page-only candidates (#499):
 * every page the detector counts, and every page the production rule recovers
 * that the detector does not, each once, sorted.
 */
export function unrecordedPageTitlesOf(measurement: UnrecordedMeasurement, measuredBy: string): UnrecordedPageTitles {
  const titles = new Set([...measurement.titles, ...measurement.recoveredByProductionRule.notCounted.titles].map((item) => item.title));
  return { release: measurement.release, measuredBy, titles: [...titles].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)) };
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { archive: { type: "string" }, dump: { type: "string" }, out: { type: "string" }, titles: { type: "string" } },
  });
  if (values.archive === undefined || values.dump === undefined || values.out === undefined) {
    throw new Error(
      "usage: pnpm exec tsx src/import/measureUnrecordedPages.ts --archive <jsonl.gz> --dump <xml.bz2> --out <json> [--titles <json>]",
    );
  }
  const words = new Set<string>();
  const archive = await parseArchive({ input: values.archive, onRejection: () => {}, onRecord: ({ record }) => { words.add(record.word); } });
  if (archive.archiveSha256 !== PUBLISHED_ARCHIVE_SHA256 || archive.status !== "complete") {
    throw new Error("measurement requires the verified, complete it-0c432803 archive");
  }
  const dump = await VerifiedDump.open(values.dump, ARCHIVE_DUMP);
  /** What the production rule does with a page: its outcome, and the entries it writes. */
  type Production = { outcome: string; entries: number };
  const productionOf = (page: RawPage): Production => {
    const result = recoverPageEntry(page, words);
    return { outcome: result.outcome, entries: result.outcome === "recovered" ? result.entries.length : 0 };
  };
  const titles: {
    title: string; revisionId: number; timestamp: string; group: LayoutGroup; heading: LanguageHeading;
    sections: PosSection[]; unplaced: number; readAs: string[]; ruleV1: string; production: Production;
  }[] = [];
  /** Pages the production rule recovers that the detector does not count. */
  const outside: { title: string; revisionId: number; entries: number }[] = [];
  let mainPages = 0;
  try {
    for await (const page of dump.pages()) {
      mainPages += 1;
      if (words.has(page.title)) continue;
      const layout = readPageLayout(page);
      const production = productionOf(page);
      if (layout === undefined) {
        if (production.outcome === "recovered") outside.push({ title: page.title, revisionId: page.revisionId, entries: production.entries });
        continue;
      }
      titles.push({
        title: page.title, revisionId: page.revisionId, timestamp: page.timestamp, group: layout.group,
        heading: layout.heading, sections: layout.sections, unplaced: layout.unplaced, readAs: layout.readAs,
        ruleV1: recoverUnderRuleV1(page, words).outcome, production,
      });
    }
  } finally { await dump.close(); }
  const byTitle = <T extends { title: string }>(a: T, b: T): number => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0);
  titles.sort(byTitle);
  outside.sort(byTitle);
  const groups: Record<string, { pages: number; readWithPos: number; recoveredPages: number; recoveredEntries: number }> = {};
  for (const item of titles) {
    const group = (groups[item.group] ??= { pages: 0, readWithPos: 0, recoveredPages: 0, recoveredEntries: 0 });
    group.pages += 1;
    if (item.readAs.length > 0) group.readWithPos += 1;
    if (item.production.outcome === "recovered") group.recoveredPages += 1;
    group.recoveredEntries += item.production.entries;
  }
  const recovered = titles.filter((item) => item.production.outcome === "recovered");
  const ordered = Object.fromEntries(Object.entries(groups).sort(([a, x], [b, y]) => y.pages - x.pages || (a < b ? -1 : 1)));
  const output = {
    release: `it-${archive.archiveSha256.slice(0, 8)}`, archiveSha256: archive.archiveSha256,
    dump: "itwiktionary-20260701", dumpSha1: ARCHIVE_DUMP.sha1, mainNamespacePages: mainPages,
    unrecordedWithItalianDefinitions: titles.length,
    readWithPos: titles.filter((item) => item.readAs.length > 0).length,
    severalPartsOfSpeech: titles.filter((item) => item.sections.length > 1).length,
    noPartOfSpeechSignal: titles.filter((item) => item.sections.length === 0).length,
    recoveredByRuleV1: { rule: PAGE_ENTRY_RULE, pages: titles.filter((item) => item.ruleV1 === "recovered").length },
    recoveredByProductionRule: {
      rules: [PAGE_ENTRY_RULE, PAGE_ENTRY_RULE_V2],
      pages: recovered.length + outside.length,
      entries: recovered.reduce((sum, item) => sum + item.production.entries, 0) + outside.reduce((sum, item) => sum + item.entries, 0),
      counted: { pages: recovered.length, entries: recovered.reduce((sum, item) => sum + item.production.entries, 0) },
      notCounted: { pages: outside.length, entries: outside.reduce((sum, item) => sum + item.entries, 0), titles: outside },
    },
    groups: ordered, titles,
  };
  await writeFile(values.out, JSON.stringify(output, null, 2) + "\n");
  // The list a fixture seed reads (fixtures/unrecorded-page-titles.json),
  // written again from each release's measurement.
  if (values.titles !== undefined) {
    await writeFile(values.titles, JSON.stringify(unrecordedPageTitlesOf(output, values.out), null, 2) + "\n");
  }
  const { titles: _titles, ...summary } = output;
  process.stdout.write(JSON.stringify({ ...summary, output: values.out }) + "\n");
}

if (isMain(import.meta.url)) await main();
