// A word page's shape, and the rule of design-system-manifest.md § "How a word
// page renders" it stands on (#707). The `shapes` step of
// tools/measureWordPageShapes.ts.
//
// A shape is what a page is made of, as the rules tell pages apart: which
// kinds of reading it lists (a reading of the word's own record by part of
// speech, a form block of a verb, of a noun or adjective, of a grid, an
// expression page, empty readings), how many readings (one, two, three or
// more, where the jump-link rule turns), whether two readings are about one
// word or two, and whether the jump links show. Each part is mapped to the
// manifest rows that rule it in `COMPONENTS`. A shape is ruled when every part
// of it is; otherwise it takes its worst part's mark: `rules disagree`, `no
// rule`, or `page breaks the rule`.

import { normalizeItalianExact } from "../../src/italian/normalize.js";
import type { EntryFacts, PageFacts } from "./facts.ts";

/** A row of the manifest, by its section and its bold rule. */
export type Row = `§ ${number} ${string}`;

/** What rules one part of a shape. */
export type Ruling =
  | { kind: "ruled"; rows: [Row, ...Row[]] }
  /** A rule covers the part, and the page does not do what it says: a bug against the law, not a gap in it. */
  | { kind: "page breaks the rule"; rows: [Row, ...Row[]] }
  /** No row settles the part; `rows` are the ones that come nearest. */
  | { kind: "no rule"; rows: [Row, ...Row[]] }
  | { kind: "rules disagree"; rows: [Row, Row] };

const S1_ONLY_ABOUT = "§ 1 Only records about the searched word.";
const S1_EMPTY_PAGE = "§ 1 A page where every reading is empty (P2) keeps the part of speech under the word.";
const S2_LINKS = "§ 2 Jump links for three or more readings, or for two readings about two different words.";
const S3_OWN = "§ 3 A heading, then Definitions, then Forms.";
const S4_ONE_BLOCK = "§ 4 One block per base word.";
const S4_VERB_BLOCK = "§ 4 A verb form block.";
const S4_NOUN_BLOCK = "§ 4 A noun or adjective form block.";
const S4_NO_RECORD = "§ 4 A form no record describes (P3).";
const S6_EXPRESSION = "§ 6 A searched expression gets a short page.";

const ruled = (...rows: [Row, ...Row[]]): Ruling => ({ kind: "ruled", rows });

/** A part of speech as the page rules tell them apart: the *Forms* shape it takes, and everything else. */
export type Family = "noun" | "adjective" | "verb" | "other";

export function familyOf(pos: string): Family {
  if (pos.startsWith("Sostantivo")) return "noun";
  if (pos.startsWith("Aggettivo")) return "adjective";
  if (pos === "Verbo" || pos === "Voce verbale") return "verb";
  return "other";
}

/**
 * Every part a shape is built of, and the rule it stands on. A part missing
 * from this table is a part no one mapped, and `census` refuses it rather
 * than guess.
 */
export const COMPONENTS: Record<string, Ruling> = {
  "own noun": ruled(S3_OWN),
  "own adjective": ruled(S3_OWN),
  "own verb": ruled(S3_OWN),
  "own other": ruled(S3_OWN),
  /**
   * A record the source heads as a form's that is no form-of reading: no
   * `form_of` edge names its base word, so it reads as its own word's
   * (`aerei`'s `Sostantivo, forma flessa`, "plurale di aereo"). § 3 heads it,
   * and § 2 counts it as about its own headword; #715 asks whether that is
   * right.
   */
  "own noun form record": ruled(S3_OWN, S2_LINKS),
  "own adjective form record": ruled(S3_OWN, S2_LINKS),
  "own verb form record": ruled(S3_OWN, S2_LINKS),
  "own other form record": ruled(S3_OWN, S2_LINKS),
  "form-of noun": ruled(S4_NOUN_BLOCK, S4_ONE_BLOCK),
  "form-of adjective": ruled(S4_NOUN_BLOCK, S4_ONE_BLOCK),
  "form-of verb": ruled(S4_ONE_BLOCK),
  "form-of other": ruled(S4_ONE_BLOCK),
  /** A form whose lines name two base words: "When a form's lines name several base words". */
  "form-of 2+ base words": ruled(S4_NOUN_BLOCK),
  "verb-form": ruled(S4_VERB_BLOCK),
  "grid-form": ruled(S4_NO_RECORD),
  bare: ruled(S1_EMPTY_PAGE),
  "lone-bare": ruled(S1_EMPTY_PAGE),
  "1 reading": ruled(S2_LINKS),
  "2 readings, 1 word": ruled(S2_LINKS),
  "2 readings, 2+ words": ruled(S2_LINKS),
  "3+ readings": ruled(S2_LINKS),
  /** A record of another word, on a page none of whose own records shows anything: `Daria` shows Dario's. */
  "another word's record": ruled(S1_EMPTY_PAGE),
  /** A record of another word beside a record of the word's own that shows something: § 1 shows only records about the word. */
  "another word's record beside the word's own": { kind: "page breaks the rule", rows: [S1_ONLY_ABOUT] },
  /**
   * A record whose headword the search folds to the query's, but spelt
   * otherwise: `Abaco` on `abaco`, `aglio` on `Aglio`, `all’improvviso` on
   * `all'improvviso`. § 1 takes a record whose own headword is the word
   * searched, and says nothing of capitals or apostrophes; § 2 counts it as
   * another word.
   */
  "a spelling variant's record": { kind: "no rule", rows: [S1_ONLY_ABOUT, S2_LINKS] },
  /**
   * Two noun or adjective blocks about one base word (`calabra`'s adjective
   * and noun, `altri`'s adjective and pronoun), where rule 1 draws one block
   * "whatever their part of speech".
   */
  "two blocks about one word": { kind: "page breaks the rule", rows: [S4_ONE_BLOCK] },
  /**
   * A verb's block and a noun's or adjective's block about one base word
   * (`presiedute`, `accentuata`, `badanti`). Rule 1 draws one block, and § 4
   * draws a verb's form as a verb block (`Voce verbale · <verb>`, its
   * conjugation) and a noun's or adjective's under its own heading with a
   * grid: no row says which the one block is.
   */
  "a verb block and a noun or adjective block about one word": { kind: "rules disagree", rows: [S4_VERB_BLOCK, S4_NOUN_BLOCK] },
  "expression page": ruled(S6_EXPRESSION),
  "expression form": ruled(S6_EXPRESSION),
  "expression own": ruled(S6_EXPRESSION),
  "expression page, 1 reading": ruled(S6_EXPRESSION),
  "expression page, 2 readings": ruled(S6_EXPRESSION),
  /** § 6 draws only the heading and the readings; § 2 gives any page of three readings or more its jump links. */
  "expression page, 3+ readings": { kind: "rules disagree", rows: [S2_LINKS, S6_EXPRESSION] },
  /** An expression page with no reading, only the headwords no line names: § 6 always has a reading. */
  "expression page, 0 readings": { kind: "no rule", rows: [S6_EXPRESSION] },
  "unnamed headwords": ruled(S6_EXPRESSION),
};

/** A heading the source gives a form's record: `Sostantivo, forma flessa`, `Voce verbale`. */
const isFormTitle = (pos: string): boolean => pos.endsWith(", forma flessa") || pos === "Voce verbale";

/** The parts one reading of a word page brings to its shape. */
function entryParts(entry: EntryFacts, query: string, ownShows: boolean): string[] {
  const parts: string[] = [];
  switch (entry.kind) {
    case "own":
      parts.push(`own ${familyOf(entry.pos)}${isFormTitle(entry.pos) ? " form record" : ""}`);
      break;
    case "form-of":
      parts.push(`form-of ${familyOf(entry.pos)}`, ...(entry.bases.length > 0 ? ["form-of 2+ base words"] : []));
      break;
    default:
      parts.push(entry.kind);
  }
  if ((entry.kind === "own" || entry.kind === "bare" || entry.kind === "lone-bare") && entry.word !== query) {
    if (normalizeItalianExact(entry.word) === normalizeItalianExact(query)) parts.push("a spelling variant's record");
    else parts.push(ownShows ? "another word's record beside the word's own" : "another word's record");
  }
  return parts;
}

const isBlock = (entry: EntryFacts): boolean => entry.kind === "form-of" || entry.kind === "verb-form" || entry.kind === "grid-form";

/** A block of a verb's form: a verb block, or a form record the source heads as a verb's. */
const isVerbBlock = (entry: EntryFacts): boolean => entry.kind === "verb-form" || (entry.kind === "form-of" && familyOf(entry.pos) === "verb");

/** The parts a page's blocks bring when two or more of them are about one base word. */
function twoBlockParts(entries: readonly EntryFacts[]): string[] {
  const byWord = new Map<string, EntryFacts[]>();
  for (const entry of entries.filter(isBlock)) byWord.set(entry.about, [...(byWord.get(entry.about) ?? []), entry]);
  return [...byWord.values()]
    .filter((blocks) => blocks.length >= 2)
    .map((blocks) => {
      const verbs = blocks.filter(isVerbBlock).length;
      return verbs > 0 && verbs < blocks.length ? "a verb block and a noun or adjective block about one word" : "two blocks about one word";
    });
}

const countPart = (readings: number, words: number): string =>
  readings >= 3 ? "3+ readings" : readings === 2 ? `2 readings, ${words >= 2 ? "2+ words" : "1 word"}` : "1 reading";

const phraseCount = (readings: number): string =>
  `expression page, ${readings >= 3 ? "3+ readings" : readings === 1 ? "1 reading" : `${readings} readings`}`;

/** One page's shape: its key, and the parts the key is built of. */
export interface PageShape {
  key: string;
  parts: string[];
}

export function shapeOf(page: PageFacts): PageShape {
  switch (page.page) {
    case "none":
      return { key: `no page (${page.outcome})`, parts: [] };
    case "phrase": {
      const kinds = [...new Set(page.entries.map((entry) => `expression ${entry.kind}`))].sort();
      const parts = ["expression page", ...kinds, phraseCount(page.entries.length), ...(page.unnamed > 0 ? ["unnamed headwords"] : [])];
      return { key: [...parts, "no links"].join(" · "), parts };
    }
    case "word": {
      // Whether a record of the searched word itself shows something: then a record of another word is no fallback (§ 1).
      const ownShows = page.entries.some((entry) => entry.kind === "own" && entry.word === page.word);
      const kinds = new Set(page.entries.flatMap((entry) => entryParts(entry, page.word, ownShows)));
      for (const part of twoBlockParts(page.entries)) kinds.add(part);
      const count = countPart(page.entries.length, new Set(page.entries.map((entry) => entry.about)).size);
      const parts = [...[...kinds].sort(), count];
      return { key: [...parts, page.links ? "links" : "no links"].join(" · "), parts };
    }
  }
}

const RULING_ORDER: Ruling["kind"][] = ["rules disagree", "no rule", "page breaks the rule", "ruled"];

/** A shape's ruling: the rows of every part when each part is ruled; else the parts that are not, the worst first. */
export function rulingOf(parts: readonly string[]): Ruling & { parts: string[] } {
  const rulings = parts.map((part) => {
    const ruling = COMPONENTS[part];
    if (ruling === undefined) throw new Error(`no one mapped the part "${part}" to a rule`);
    return { part, ruling };
  });
  for (const kind of RULING_ORDER.slice(0, 3)) {
    const found = rulings.filter(({ ruling }) => ruling.kind === kind);
    const [first] = found;
    if (first !== undefined) return { ...first.ruling, parts: found.map(({ part }) => part) };
  }
  const [first, ...rest] = [...new Set(rulings.flatMap(({ ruling }) => ruling.rows))];
  // A search that finds nothing has no parts: § 1 is what leaves it nothing to draw.
  return { kind: "ruled", rows: [first ?? S1_ONLY_ABOUT, ...rest], parts: [] };
}

/** Up to three example words of a shape: plain lowercase words where it has three, spread across the alphabet. */
function examplesOf(words: readonly string[]): string[] {
  const plain = words.filter((word) => /^[a-zàèéìíòóù]+$/.test(word));
  const pool = plain.length >= 3 ? plain : words;
  if (pool.length <= 3) return [...pool];
  return [pool[0], pool[Math.floor(pool.length / 2)], pool[pool.length - 1]];
}

export interface ShapeRow {
  shape: string;
  pages: number;
  examples: string[];
  ruling: Ruling & { parts: string[] };
}

/** Group every search's page by shape, largest first; `searched` counts them all, a search that finds nothing included. */
export async function census(pages: AsyncIterable<PageFacts>) {
  const groups = new Map<string, { parts: string[]; words: string[] }>();
  const otherParts: Record<string, number> = {};
  let searched = 0;
  for await (const page of pages) {
    searched += 1;
    const { key, parts } = shapeOf(page);
    if (page.page === "word") {
      for (const entry of page.entries) if (familyOf(entry.pos) === "other") otherParts[entry.pos] = (otherParts[entry.pos] ?? 0) + 1;
    }
    const group = groups.get(key) ?? { parts, words: [] };
    group.words.push(page.word);
    groups.set(key, group);
  }
  const shapes: ShapeRow[] = [...groups]
    .sort((a, b) => b[1].words.length - a[1].words.length || a[0].localeCompare(b[0]))
    .map(([shape, { parts, words }]) => ({ shape, pages: words.length, examples: examplesOf(words), ruling: rulingOf(parts) }));
  const byRuling = Object.fromEntries(RULING_ORDER.map((kind) => [kind, { shapes: 0, pages: 0 }])) as Record<
    Ruling["kind"],
    { shapes: number; pages: number }
  >;
  for (const row of shapes) {
    byRuling[row.ruling.kind].shapes += 1;
    byRuling[row.ruling.kind].pages += row.pages;
  }
  const other = Object.entries(otherParts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return { searched, byRuling, otherPartsOfSpeech: Object.fromEntries(other), shapes };
}
