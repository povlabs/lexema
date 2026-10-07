// What one word's page is made of, decided before anything renders.
//
// A lookup returns every record the query matches. Some are *about* the
// searched word (`isAboutQuery`); some merely list it in their own table. Only
// the records about the searched word are readings (rule 2 of Huey's ruling of
// 2026-10-06, #695: "Sibling forms and superlatives of other words never
// show"): `grande` does not show `grandissimo`, and `costruttrici` none of
// costruttore's or costruttori's records. A record about another word shows
// only as the verb of a block, below.
//
// A page none of whose records about the word has anything to show keeps the
// records that list it as readings, as every page did before #695, until #696
// and #700 rule on that case (`gravida`, `citta`). There, two kinds of form
// still never show, each found only through declared `form_of` edges and
// matched by identity:
//
// - A form of the query's own readings: a record that only lists the query and
//   declares itself a form of a reading about it, or of a record already left
//   out this way (`formsOfQueryReadings`). `bello` does not repeat `bella`,
//   `belli` and `bellissimo` as readings, since its own reading already shows
//   their table (Huey, 2026-10-05, on #622).
// - Another form of the query's own lemma: a record that only lists the query
//   and declares itself a form of a lemma a reading about the query is a form
//   of, or of a record already left out this way (`otherFormsOfQueryLemmas`).
//   `bella` does not show `belli`, `belle` and `bellissimo` as readings, since
//   they are forms of `bello`, as `bella` is (Huey, 2026-10-05, on #626: "bella
//   is the same as bello").
//
// A table shows once on a page, and one base record's *Definitions* once
// (`Drawn`; rule 1, "never two blocks or two tables for the same word"):
// `essere`'s two verb records draw one conjugation. A noun or adjective
// form's records of one base word are one block (`FormOfReading`):
// `costruttrici`'s, `bella`'s and `grandi`'s adjective and noun records.
//
// A searched verb form shows one block per verb it is a form of (#636; Huey's
// ruling of 2026-10-06, frame 37): `1 · Voce verbale · salire`, that verb's
// form-of lines right under it, then *Definitions*, the verb's own (#686), then
// *Forms of salire*, its conjugation opened where the searched cell is (matched
// by pointer). A block's lines come from two places:
//
// - A form record about the query: each of its definitions goes to the verb its
//   `form_of` edge names. `salivate`'s record gives salivare's block its two
//   lines, and `saliva`'s, naming salivare and salire, gives one line to each.
//   A record with a definition whose edges name no verb keeps its reading.
// - A verb's own table, when no record about the query names that verb: one
//   line per cell the query hit, built by rule `it-verb-form-line/v2`
//   (src/italian/verbFormLine.ts) in the table's own Italian names: "prima
//   persona singolare del passato prossimo indicativo di andare" (#627), or
//   "participio di essere" for `stato`, whose only cell in essere's table is
//   its participio (#695). The verb's record then has no reading of its own:
//   its table is the block's.
//   A feminine compound form the lookup read by `it-essere-agreement/v1`
//   (`sono andata`, route `feminine`, #676) hits its masculine's cell, and its
//   line names the gender: "prima persona singolare femminile del ...".
//   Rule-built blocks lead the page, as their lines did under #627.
//
// A rule-built line is built here, when the page is built; the lookup, the API
// and the seed never hold it (ADR 0012), and the page shows no mark for it (ADR
// 0016), though its type keeps it apart from a source line (`VerbFormLine`). A
// verb with no line, such as one whose only hit cell is an imperative, gives no
// block. A verb whose table does not list the query
// (`andati`: andare's lists only `andato`) still shows that table, opened as
// the verb's own page opens it, with nothing marked (Huey's direction of
// 2026-10-06, #666). A block shows no *Forms* of its form record's own: its
// only tables are its verb's.
//
// A form reading carries its lemma's table the way the lemma's own page draws
// it: `andavano` shows *Forms of andare*, the
// conjugation, and `bella` the adjective shows *Forms of bello*, the gender and
// number grid, in place of its own (#626). The lookup does not return the lemma
// as a record of its own, so nothing is counted twice: the readings are the
// lookup's records, and the tables are their lemmas'. A verb's table comes with
// the lookup; a grid needs the lemma's whole record, which the search reads for
// the words `gridLemmaWords` names (web/lib/dictionary/searchAttempt.ts). A
// noun or adjective form's lemma that is itself a form leads on to its own
// lemma, the base word (`bellissima` → `bellissimo` → `bello`, #695), whose
// table shows even when it does not list the form (`lavoratrici`).
//
// A form's lines sit right under its heading, and its *Definitions* are those
// of the lemma whose table it shows first (`LemmaDefinitionList`, #686): that
// record's own, as its own page lists them. A verb that is a reading on the
// page and a grid's base record bring theirs; a verb a form record names gets
// them from the search (`withVerbDefinitions`).

import { normalizeItalianExact } from "@lexema/italian/normalize.ts";
import { VERB_FORM_LINE_RULE, verbFormLine, type SpelledGender } from "@lexema/italian/verbFormLine.ts";
import { mergeExpressions } from "@lexema/lookup/expressions.ts";
import {
  entryKey,
  factRefKey,
  formsOfQueryReadings,
  isAdjectiveReading,
  isFormOfReading,
  isNounReading,
  isSourceRef,
  isVerbReading,
  lemmasOfPartOfSpeech,
  otherFormsOfQueryLemmas,
  searchedSpellings,
  sourceTagsOf,
  type FoundRoute,
  type SearchedSpellings,
  type SourceRef,
} from "@lexema/lookup/types.ts";
import { definitionTextKey, definitionsOf, placeOf, readAt, type DefinitionItem } from "./definitions.ts";
import { conjugationOf, placesAny, type Conjugation } from "./conjugation.ts";
import { agreementOf, type Agreement, type Spelling } from "./genderGrid.ts";
import { unlinkedLemmas } from "./lemmaLines.ts";
import { labelParts, readingsNamed, splitLabel } from "./readingLabels.ts";
import { relatedItems, type RelatedItem } from "./relatedList.ts";
import type {
  EntryIdentity,
  Expression,
  LemmaCandidate,
  LemmaDefinitions,
  LemmaLink,
  LemmaListing,
  Pronunciation,
  Hyphenation,
  Reading,
  RelatedWord,
  SourceForm,
  UnlistedTable,
  WordFacts,
  WordText,
} from "@lexema/lookup/types.ts";

/**
 * A lemma's table, as its own page draws it, under a form's reading as *Forms
 * of andare* or *Forms of bello* (design-system-manifest.md § "The result").
 *
 * - A verb's whole conjugation, opened where the form sits when its table
 *   lists it (`andare` for `andavano`), and otherwise as the verb's own page
 *   opens it, with nothing marked (`andare` for `andati`, #666).
 * - A noun's or adjective's gender and number grid, superlatives included,
 *   with nothing marked: `bello` for `bella`, `casa` for `case` (#626).
 */
export type LemmaTable =
  | {
      kind: "conjugation";
      lemma: LemmaCandidate;
      listing: LemmaListing | UnlistedTable;
      /**
       * The verb record's own definitions, when they were read: what the
       * block's *Definitions* list (#686). The links its glosses carry come
       * with them when the verb is a reading; a verb read only as a link
       * target has none.
       */
      definitions: (LemmaDefinitions & Pick<Reading, "lemmaLinks">) | undefined;
    }
  | { kind: "grid"; lemma: Reading; agreement: Agreement };

/** A verb's conjugation, the one kind of table a verb form block shows. */
export type ConjugationTable = Extract<LemmaTable, { kind: "conjugation" }>;

/** A noun's or adjective's gender and number grid, the table a noun or adjective form shows in place of its own. */
export type GridTable = Extract<LemmaTable, { kind: "grid" }>;

/** The cells a conjugation marks: those its listing says the query hit, and none in a table that does not list it. */
export const searchedIn = ({ listing }: ConjugationTable): SearchedSpellings =>
  "evidence" in listing ? searchedSpellings(listing) : { headword: false, formPointers: new Set() };

/**
 * A form's lemma's definitions, the *Definitions* of the form's block (#686;
 * Huey's rulings of 2026-10-06, frames 17 and 37): those of the lemma record
 * whose table the form shows first, listed as that record's own page lists
 * them, source text unchanged. It names the record it was read from, and each
 * definition carries its own pointer, so a definition with no source is not a
 * value this holds. A lemma with no definition has no list, and its form
 * shows no *Definitions*.
 */
export interface LemmaDefinitionList {
  /** The lemma record the definitions are its own. */
  lemma: EntryIdentity & { word: string };
  items: [DefinitionItem, ...DefinitionItem[]];
  /** The examples of the lemma's senses not shown as definitions, kept behind `+ more` as its own page keeps them. */
  looseExamples: string[];
  /** The lemma record's own links, which its glosses link where they write the word; none when it was read only as a link target. */
  lemmaLinks: Reading["lemmaLinks"];
}

/** A lemma record's definitions as its own page lists them, or none when it has no definition or was not read. */
function definitionListOf(
  lemma: EntryIdentity & { word: string },
  definitions: (LemmaDefinitions & Pick<Reading, "lemmaLinks">) | undefined,
): LemmaDefinitionList | undefined {
  if (definitions === undefined) return undefined;
  const { items, looseExamples } = definitionsOf({ word: lemma.word, senses: definitions.senses, recovered: definitions.recovered });
  const listed = nonEmpty(items);
  return listed === undefined ? undefined : { lemma, items: listed, looseExamples, lemmaLinks: definitions.lemmaLinks };
}

/** The definitions of the lemma whose table shows first, or none when its record has no definition or was not read. */
function lemmaDefinitionsOf(tables: readonly LemmaTable[]): LemmaDefinitionList | undefined {
  const [table] = tables;
  return table === undefined ? undefined : definitionListOf(table.lemma, table.kind === "grid" ? table.lemma : table.definitions);
}

type NonEmpty<T> = [T, ...T[]];

/**
 * A record's own definitions, and the examples of its senses not shown as one:
 * at least one of the two. A reading with neither has no text of its own.
 */
export type OwnText =
  | { kind: "definitions"; items: NonEmpty<DefinitionItem>; looseExamples: string[] }
  | { kind: "examples"; looseExamples: NonEmpty<string> };

/** The record's own text, or none when it has no definition and no example. */
function ownTextOf(reading: Reading): OwnText | undefined {
  const { items, looseExamples } = definitionsOf(reading);
  const listed = nonEmpty(items);
  if (listed !== undefined) return { kind: "definitions", items: listed, looseExamples };
  const examples = nonEmpty(looseExamples);
  return examples === undefined ? undefined : { kind: "examples", looseExamples: examples };
}

/**
 * A reading's own *Forms*: a verb's conjugation, when its forms fill a cell
 * (forms that fill none would draw only a row of dashes, #674), or a noun's or
 * adjective's gender and number grid, superlatives included.
 */
export type OwnForms =
  | { kind: "conjugation"; conjugation: Conjugation; searchedPointers: ReadonlySet<string> }
  | { kind: "grid"; agreement: Agreement };

function ownFormsOf(reading: Reading): OwnForms | undefined {
  if (isVerbReading(reading)) {
    const searched = searchedSpellings(reading);
    const conjugation = conjugationOf(reading.forms, searched);
    return placesAny(conjugation) ? { kind: "conjugation", conjugation, searchedPointers: searched.formPointers } : undefined;
  }
  const agreement = agreementOf(reading);
  return agreement.grid === undefined && agreement.superlative === undefined ? undefined : { kind: "grid", agreement };
}

/** What any source reading may show after its own text, in this order on the page. */
type SharedPart =
  /** Lemmas its `form_of` edges name that no definition writes, each on a `Form of` line (unlinkedLemmas). */
  | { kind: "lemma-lines"; words: NonEmpty<string> }
  /**
   * Its lemmas' tables: a verb's conjugations, one per distinct table (`chiusi`
   * names `chiudere` twice and shows it once), then, for a noun or adjective
   * form, the grids of the lemmas that list it, in place of its own (#626).
   */
  | { kind: "lemma-forms"; tables: NonEmpty<LemmaTable> }
  /** The etymologies the source ties to this reading, their bracket label dropped. */
  | { kind: "etymology"; etymologies: NonEmpty<WordText> }
  /** The synonym groups the source labels with this reading's part of speech. */
  | { kind: "synonyms"; items: NonEmpty<RelatedItem> };

/** What a reading that is not a form shows: its numbered *Definitions*, or *Examples*, and its own *Forms*. */
export type LemmaPart = { kind: "definitions"; text: OwnText } | { kind: "own-forms"; forms: OwnForms } | SharedPart;

/** One form record's lines in a block: its own definitions, and the examples of its senses not shown as one. */
export interface RecordLines {
  reading: Reading;
  text: OwnText;
}

/**
 * What a form-of reading shows. Its own definitions are its form lines, under
 * its heading with no label or number (#686, #690): every record of the block's
 * in turn, a line another record already gave shown once. When a lemma's grid
 * lists it (`bella` the adjective, of bello), that lemma's *Definitions* follow
 * (#686), then the grid as *Forms of bello*. It never shows a *Forms* table of
 * its own, with or without a lemma's (Huey, 2026-10-06, #694), so there is no
 * part for one.
 */
export type FormOfPart =
  | { kind: "form-lines"; records: NonEmpty<RecordLines> }
  | { kind: "lemma-definitions"; list: LemmaDefinitionList }
  | SharedPart;

/** A source reading with something to show: what it shows, in page order. */
interface ShownReading<Role extends string, Part> {
  kind: "source";
  /** `form-of` exactly when the reading is the query's own form-of record (`isFormOfReading`). */
  role: Role;
  /**
   * 1-based in page order across every entry shown, and the same number the
   * jump links and the report dialog show (Huey, 2026-10-06, #687). A reading
   * with nothing to show is not an entry, so the numbers never skip (#694).
   */
  number: number;
  reading: Reading;
  parts: NonEmpty<Part>;
}

/**
 * A reading of a source record that has something to show (#694): a lemma
 * reading, or a form-of reading, which has no part for a *Forms* table of its own.
 */
export type PageReading = ShownReading<"lemma", LemmaPart> | FormOfReading;

/**
 * A noun or adjective form's block: one per base word (rule 1 of Huey's ruling
 * of 2026-10-06, #695: "Never two blocks or two tables for the same word").
 * `reading` heads it; `also` are the query's other form records of the same
 * base word, whose lines it shows under that heading (`bella`'s noun record,
 * "femminile di bello", in the block its adjective record heads). A form of a
 * verb or a form with no base word read is a block of its own, with no `also`.
 */
export interface FormOfReading extends ShownReading<"form-of", FormOfPart> {
  also: Reading[];
}

/**
 * A reading with nothing to show, on a page where no reading has anything to
 * show: its heading alone, as every reading drew before #694. Such a page keeps
 * today's rendering until it is ruled on; a page with any reading that shows
 * something has none of these.
 */
export interface BareReading {
  kind: "bare";
  number: number;
  reading: Reading;
}

/** The part of speech a verb form block is headed with: the source's own for a verb form (frame 37). */
export const VOCE_VERBALE = "Voce verbale";

/**
 * One line saying which cell of a verb's table the query is, built by rule:
 * "prima persona singolare del passato prossimo indicativo di andare".
 * Lexema's text, not the source's, which its type says and the page does not
 * (ADR 0008, ADR 0016).
 */
export interface VerbFormLine {
  kind: "rule";
  /** The whole line, ending with `lemma`. */
  text: string;
  /** The verb the line names, linked to its search. */
  lemma: string;
  sourceType: "lexema-deterministic";
  rule: typeof VERB_FORM_LINE_RULE;
  /** The verb's `forms[]` entry the line was built from: the pointer the query's evidence carries. */
  ref: SourceRef;
}

/** How a lookup reached a word page's readings: every route but a phrase's, which has a page of its own. */
export type WordRoute = Exclude<FoundRoute, { kind: "phrase" }>;

/** The route of a query found as typed. */
export const SURFACE_ROUTE: WordRoute = { kind: "surface" };

/** A definition of a form record about the query, in the block of the verb its `form_of` edge names. */
export interface SourceFormLine {
  kind: "source";
  reading: Reading;
  item: DefinitionItem;
}

/** One form-of line of a verb form block: the source's, or built by rule. */
export type FormLine = SourceFormLine | VerbFormLine;

/**
 * A form record about the query whose definitions a block holds. A record
 * whose definitions name two verbs has a part in each verb's block; what
 * belongs to the record rather than to one definition shows in its first.
 */
export interface BlockRecord {
  reading: Reading;
  /** Whether this is the record's first block, the one that shows its loose examples. */
  first: boolean;
  /**
   * The words this record's `form_of` edges name that its `Form of` lines may
   * show here: this block's verb and, in its first block, every word no block
   * of its own is for.
   */
  lemmaWords: string[];
}

/**
 * One verb the query is a form of, as frame 37 draws it (#636): `1 · Voce
 * verbale · salire`, the verb's form-of lines, its *Definitions*, then *Forms
 * of salire*.
 */
export interface VerbFormBlock {
  kind: "verb-form";
  number: number;
  posTitle: typeof VOCE_VERBALE;
  /** The verb, as the form's `form_of` edge or the verb's own record writes it. */
  verb: string;
  /** The form records' lines first, then the rule-built ones; each once. */
  lines: [FormLine, ...FormLine[]];
  /** The form records about the query whose definitions are lines here. */
  sources: BlockRecord[];
  /** The verb records the rule-built lines were read from, which have no reading of their own. */
  verbs: Reading[];
  /** The verb's conjugation, one per distinct table; the block's only *Forms*. */
  tables: ConjugationTable[];
  /** The verb's own definitions, of the record whose table the block shows first: the block's *Definitions* (#686). */
  definitions: LemmaDefinitionList | undefined;
  /** The etymologies the source ties to the block's form records, their bracket label dropped. */
  etymologies: WordText[];
  /** The synonym groups the source labels with the block's form records. */
  synonyms: RelatedItem[];
}

/** One reading on a word's page: a source record's, or a verb form block. */
export type PageEntry = PageReading | VerbFormBlock;

/** One reading a word's page lists: an entry, or, on a page where no reading has anything to show, a bare reading. */
export type ShownEntry = PageEntry | BareReading;

/**
 * A word's readings: the entries that have something to show, or, when none
 * has, the bare readings. A page never mixes the two, so an empty reading
 * never sits beside one that shows something (#694).
 */
export type WordReadings = NonEmpty<PageEntry> | NonEmpty<BareReading>;

/** What follows a block's number in its heading and its jump link: `Voce verbale · salire`. */
export const blockTitle = (block: VerbFormBlock): string => `${block.posTitle} · ${block.verb}`;

/** Jump links appear from this many readings up, on any page. */
export const JUMP_LINKS_FROM = 3;

/**
 * Whether a word page lists its readings under the headword: from three
 * readings up, or when it is a form of two or more verbs, `salivate` of salire
 * and salivare (frame 37, Huey's ruling of 2026-10-06, #654). Blocks are one
 * per verb, so two verb form blocks are two different verbs.
 */
export function showsJumpLinks(page: WordPage): boolean {
  const verbs = page.readings.filter((entry: ShownEntry) => entry.kind === "verb-form").length;
  return page.readings.length >= JUMP_LINKS_FROM || verbs >= 2;
}

/** What names an entry in its ids: its record, or a block's verb. */
const entryName = (entry: ShownEntry): string =>
  entry.kind === "verb-form" ? `voce-verbale-${entry.verb.replace(/\s+/g, "_")}` : entryKey(entry.reading);

/** The anchor of a page entry, which the jump links point to: one per entry, a block's named by its verb. */
export const readingAnchor = (entry: ShownEntry): string => `reading-${entryName(entry)}`;

/** The id of a page entry's heading, which names the entry for assistive technology. */
export const readingHeadingId = (entry: ShownEntry): string => `reading-heading-${entryName(entry)}`;

/** A source record a page shows, under the number of the entry that shows it. */
export interface ShownRecord {
  number: number;
  /** The record, named as its entry is headed: its part of speech, or the block's title. */
  reading: EntryIdentity & { posTitle: string };
}

/**
 * Every source record the page shows, in page order and each once: a
 * reading's record, a noun or adjective form block's records under its number
 * and each its own part of speech, and a verb form block's form records and
 * verb records under the block's number and title. These are the records a
 * report can name.
 */
export function shownRecords(entries: readonly ShownEntry[]): ShownRecord[] {
  const seen = new Set<string>();
  const shown: ShownRecord[] = [];
  const add = (number: number, reading: Reading, posTitle: string) => {
    if (seen.has(entryKey(reading))) return;
    seen.add(entryKey(reading));
    shown.push({ number, reading: { ...reading, posTitle } });
  };
  for (const entry of entries) {
    if (entry.kind === "verb-form") {
      for (const reading of [...entry.sources.map((source) => source.reading), ...entry.verbs]) add(entry.number, reading, blockTitle(entry));
      continue;
    }
    add(entry.number, entry.reading, entry.reading.posTitle);
    if (entry.kind === "source" && entry.role === "form-of") for (const reading of entry.also) add(entry.number, reading, reading.posTitle);
  }
  return shown;
}

/** The word lists no reading took, as they show: words, and the notes among them. */
export interface WordLists {
  synonyms: RelatedItem[];
  antonyms: RelatedItem[];
  derived: RelatedItem[];
}

/**
 * One *Expressions* section (#213): the entry's own, or, on a form's page, one
 * per lemma it is a form of that the page shows no block for, *Expressions
 * with* that lemma (#668). A section with no row
 * is not a value this holds, so a page with none shows none (ADR 0016).
 */
export type ExpressionSection =
  | { kind: "own"; expressions: [Expression, ...Expression[]] }
  | { kind: "lemma"; lemma: string; expressions: [Expression, ...Expression[]] };

/** A list longer than this gets the *Find an expression* box once it is open (Huey, 2026-10-01, on #213). */
export const EXPRESSION_FILTER_ABOVE = 30;

/** The section's label: `Expressions`, or `Expressions with <lemma>` for a lemma's. */
export const expressionsLabel = (section: ExpressionSection): string =>
  section.kind === "own" ? "Expressions" : `Expressions with ${section.lemma}`;

/**
 * What a row of the section shows, and what *Find an expression* searches:
 * the expression without the refs it was read from, which the page does not
 * show. Only this crosses into the client component, so the refs stay out of
 * the page's inline payload (#647).
 */
export type ExpressionRow = Pick<Expression, "phrase" | "meanings" | "hasEntry">;

/** The section's rows, in order. */
export const expressionRows = (section: ExpressionSection): [ExpressionRow, ...ExpressionRow[]] => {
  const [first, ...rest] = section.expressions.map(({ phrase, meanings, hasEntry }) => ({ phrase, meanings, hasEntry }));
  return [first, ...rest];
};

/** Whether a section lists enough rows to be filtered. */
export const takesFilter = (rows: readonly ExpressionRow[]): boolean => rows.length > EXPRESSION_FILTER_ABOVE;

/** Whether a row answers what was typed in *Find an expression*: its phrase or its meaning holds it. */
export function matchesExpression(expression: Pick<Expression, "phrase" | "meanings">, typed: string): boolean {
  const wanted = normalizeItalianExact(typed);
  if (wanted === "") return true;
  return [expression.phrase, ...expression.meanings].some((text) => normalizeItalianExact(text).includes(wanted));
}

export interface WordPage {
  /** The headword as the source spells it, or the query when no record is about it. */
  headword: string;
  readings: WordReadings;
  /** The facts about the word no reading took: shown once, after the readings. */
  wordFacts: WordFacts;
  /** `wordFacts`' synonyms, antonyms and derived words, as the page lists them. */
  wordLists: WordLists;
  /** The entry's own expressions, then its lemmas', each once; the last of the word's facts. */
  expressionSections: ExpressionSection[];
  /**
   * The word whose Wiktionary page the one *Source* link opens: the spelling
   * the page is about, its title. That page holds every entry for the
   * spelling, so one link covers every reading (ADR 0009, amended on #281).
   */
  sourceWord: string;
}

/**
 * Direct readings stay in the source's order: a word with a base reading
 * leads with it, as in the design's sale and studente frames. When only a
 * form-of record matches the queried headword, it leads.
 */
export function pageOrder(readings: readonly Reading[]): Reading[] {
  if (readings.some((reading) => reading.isAboutQuery && !isFormOfReading(reading))) {
    return [...readings];
  }
  return [
    ...readings.filter((reading) => isFormOfReading(reading)),
    ...readings.filter((reading) => !isFormOfReading(reading)),
  ];
}

/** What a table shows: each form's spelling and the grammar the source states for it, in order. */
function tableKey(listing: { readonly forms: readonly SourceForm[] }): string {
  return JSON.stringify(
    listing.forms.map((form) => [
      form.surface,
      form.claims.map((claim) => (claim.status === "missing" ? "" : claim.sourceText)),
    ]),
  );
}

/** What tells two conjugations apart: the lemma's word and what its table shows. */
const conjugationKey = (table: ConjugationTable): string => `${table.lemma.word}\u0000${tableKey(table.listing)}`;

/**
 * The verb lemmas' tables, for a verb reading that is a form of them, by the
 * word each `form_of` edge names: every candidate of every link whose table
 * the lookup returned, listing the query or not (#666), once per distinct
 * table.
 */
function conjugationTablesByVerb(reading: Reading): Map<string, ConjugationTable[]> {
  const byVerb = new Map<string, Map<string, ConjugationTable>>();
  if (!isVerbReading(reading)) return new Map();
  for (const link of reading.lemmaLinks) {
    if (link.kind !== "candidates") continue;
    for (const lemma of link.candidates) {
      const listing = lemma.listing ?? lemma.unlisted;
      if (lemma.pos !== "verb" || listing === undefined) continue;
      const definitions = lemma.definitions === undefined ? undefined : { ...lemma.definitions, lemmaLinks: [] };
      const table: ConjugationTable = { kind: "conjugation", lemma, listing, definitions };
      const tables = byVerb.get(link.targetWord) ?? new Map<string, ConjugationTable>();
      if (!tables.has(conjugationKey(table))) tables.set(conjugationKey(table), table);
      byVerb.set(link.targetWord, tables);
    }
  }
  return new Map([...byVerb].map(([verb, tables]) => [verb, [...tables.values()]]));
}

/** {@link conjugationTablesByVerb}, every verb's tables together, once per distinct table. */
function conjugationTablesOf(reading: Reading): ConjugationTable[] {
  const tables = new Map<string, ConjugationTable>();
  for (const table of [...conjugationTablesByVerb(reading).values()].flat()) {
    if (!tables.has(conjugationKey(table))) tables.set(conjugationKey(table), table);
  }
  return [...tables.values()];
}

/** One verb a form record about the query is a form of: its tables, and the record's definitions that name it. */
interface FormOfVerb {
  verb: string;
  tables: ConjugationTable[];
  items: [DefinitionItem, ...DefinitionItem[]];
}

/**
 * The verbs a form record about the query is a form of, each with the
 * definitions its `form_of` edges put there, in the order the edges name them;
 * undefined for any other reading, which keeps a reading of its own.
 *
 * A verb is a word an edge names that resolves to a verb record; its tables
 * are its records' conjugations, whether or not they list the query (`andati`:
 * andare's table lists only `andato`, #666), and a verb record with no forms
 * has none. A definition goes to the first verb an edge on
 * it names, and one with no edge at all to the record's first verb, as the
 * source leaves `macchina`'s second line without one. A record with a
 * definition whose edges name no verb is not split: it keeps its reading
 * (`andarsene`'s "andare sovrappensiero" names `sovrappensiero`). A verb no
 * definition went to gives its tables to the record's first block, so no
 * table is left out.
 */
function formOfVerbs(reading: Reading): FormOfVerb[] | undefined {
  if (!isVerbReading(reading) || !isFormOfReading(reading)) return undefined;
  const tables = conjugationTablesByVerb(reading);
  const itemsOf = new Map<string, DefinitionItem[]>();
  for (const link of reading.lemmaLinks) {
    if (link.kind === "candidates" && link.candidates.some((candidate) => candidate.pos === "verb")) itemsOf.set(link.targetWord, []);
  }
  const [first] = itemsOf.keys();
  const { items } = definitionsOf(reading);
  if (first === undefined || items.length === 0) return undefined;
  for (const item of items) {
    const place = placeOf(item);
    const edges = reading.lemmaLinks.filter((link) => readAt(link.ref, place));
    const verb = edges.length === 0 ? first : edges.find((link) => itemsOf.has(link.targetWord))?.targetWord;
    if (verb === undefined) return undefined;
    itemsOf.get(verb)?.push(item);
  }
  const verbs: FormOfVerb[] = [];
  const unlined: ConjugationTable[] = [];
  for (const [verb, verbItems] of itemsOf) {
    const lined = nonEmpty(verbItems);
    if (lined === undefined) unlined.push(...(tables.get(verb) ?? []));
    else verbs.push({ verb, tables: tables.get(verb) ?? [], items: lined });
  }
  const [lead] = verbs;
  if (lead !== undefined) lead.tables = [...lead.tables, ...unlined];
  return verbs;
}

/** Whether a reading is a noun or adjective form about the query: one whose lemma's grid it shows. */
const takesLemmaGrid = (reading: Reading): boolean =>
  isFormOfReading(reading) && (isNounReading(reading) || isAdjectiveReading(reading));

/** The keys of the query's own records: a link that names only these is the record naming itself, never a base word (`parti`'s `Parti`). */
const ownKeysOf = (readings: readonly Reading[]): ReadonlySet<string> =>
  new Set(readings.filter((reading) => reading.isAboutQuery).map(entryKey));

/** Whether a link names some record other than the query's own. */
const namesAnother = (link: LemmaLink, own: ReadonlySet<string>): link is Extract<LemmaLink, { kind: "candidates" }> =>
  link.kind === "candidates" && link.candidates.some((candidate) => !own.has(entryKey(candidate)));

/** The words a record's links name that another lookup must read, of its own part of speech when it names one. */
const namedWords = (record: Reading, own: ReadonlySet<string>): string[] =>
  lemmasOfPartOfSpeech(record.pos, record.lemmaLinks.filter((link) => namesAnother(link, own)))
    .filter((candidate) => !own.has(entryKey(candidate)))
    .map((candidate) => candidate.word);

/**
 * The words whose records a page needs read to draw its noun and adjective
 * forms' base words: every word a noun or adjective form about the query names
 * (`bello` for `bella`), and, when a record read so far is itself such a form,
 * the word it names (`bellissimo`, then `bello`, for `bellissima`; #695). The
 * search reads them until this names no word it has not read. Empty for any
 * other page, so a search reads nothing more for it.
 */
export function gridLemmaWords(readings: readonly Reading[], read: readonly Reading[] = []): string[] {
  const own = ownKeysOf(readings);
  const forms = [...readings.filter(takesLemmaGrid), ...read.filter((record) => takesGrid(record) && record.lemmaLinks.length > 0)];
  return [...new Set(forms.flatMap((record) => namedWords(record, own)))];
}

/** Whether a record is a noun or an adjective, the parts of speech that take a grid. */
const takesGrid = (record: Reading): boolean => isNounReading(record) || isAdjectiveReading(record);

const spellingsOf = ({ grid, superlative }: Agreement): Spelling[] =>
  [grid, superlative].flatMap((one) => one?.rows.flatMap((row) => row.cells.flatMap((cell) => cell.spellings)) ?? []);

/** What a lemma's grids show: each row's gender and each cell's spellings, in order. */
const gridKey = ({ grid, superlative }: Agreement): string =>
  JSON.stringify(
    [grid, superlative].map((one) => one?.rows.map((row) => [row.gender, row.cells.map((cell) => cell.spellings.map((spelling) => spelling.surface))])),
  );

/** How many links a base word may sit behind: `bellissima`, of `bellissimo`, of `bello`, is two. */
const BASE_DEPTH = 4;

/**
 * The record a link leads to that is not itself a form: the first candidate of
 * the form's part of speech read into `lemmas`, followed on through a record
 * that is itself a form to the word it names (`costruttrice`, "femminile di
 * costruttore", leads to `costruttore`; #695). None when no such record was
 * read, or the chain ends in a link that resolves to nothing.
 */
function baseRecordOf(pos: string, links: readonly LemmaLink[], lemmas: readonly Reading[], own: ReadonlySet<string>, depth = 0): Reading | undefined {
  if (depth > BASE_DEPTH) return undefined;
  for (const candidate of lemmasOfPartOfSpeech(pos, links)) {
    if (own.has(entryKey(candidate))) continue;
    const record = lemmas.find((one) => entryKey(one) === entryKey(candidate));
    if (record === undefined) continue;
    if (record.lemmaLinks.length === 0) return record;
    const base = baseRecordOf(record.pos, record.lemmaLinks, lemmas, own, depth + 1);
    if (base !== undefined) return base;
  }
  return undefined;
}

/**
 * The base words a noun or adjective form about the query shows, each as the
 * record whose *Definitions* and table its block draws (rule 1 of Huey's
 * ruling of 2026-10-06, #695: "form lines, then that word's Definitions, then
 * its table"), in the order its links name them, each record once.
 *
 * A base word is a word the form's `form_of` edges name, followed through a
 * word that is itself a form to the word it is a form of (`bellissima` shows
 * `bello`). The form shows every base word whose table lists it: a candidate's
 * table spells the query (`bello` lists `bellissima` through `bellissimo`), or
 * the base record's grid holds the form's own record as its declared plural
 * (`casa` takes `case`, #145), both matched by pointer and record. When none
 * does, it shows its first base word's anyway, with nothing marked
 * (`lavoratrici`: lavoratore's noun table lists only `lavoratori`), as a verb
 * form shows its verb's (#666). So `parti`, whose record names `parte` and, on
 * a line about `parto`, `neonato`, shows parte's, which lists it, and not
 * neonato's, which does not.
 */
function formBasesOf(reading: Reading, lemmas: readonly Reading[], own: ReadonlySet<string>): Reading[] {
  if (!takesLemmaGrid(reading)) return [];
  const bases = reading.lemmaLinks.flatMap((link) => {
    if (!namesAnother(link, own)) return [];
    const base = baseRecordOf(reading.pos, [link], lemmas, own);
    if (base === undefined) return [];
    const declared = spellingsOf(agreementOf(base)).some((spelling) =>
      spelling.declaredBy.some((record) => reading.recordId !== undefined && record.recordId === reading.recordId),
    );
    return [{ base, lists: declared || link.candidates.some((candidate) => candidate.listing !== undefined) }];
  });
  const listing = bases.filter((one) => one.lists);
  const shown = listing.length > 0 ? listing : bases.slice(0, 1);
  const byKey = new Map(shown.map(({ base }) => [entryKey(base), base]));
  return [...byKey.values()];
}

/** A base record's grid, as its own reading draws it, or none when it has no form to place. */
function gridOf(lemma: Reading): GridTable | undefined {
  const agreement = agreementOf(lemma);
  return agreement.grid === undefined && agreement.superlative === undefined ? undefined : { kind: "grid", lemma, agreement };
}

/**
 * What the page has drawn so far, in page order. One table shows once on a
 * page, and one base record's *Definitions* once: Huey's rule 1 of 2026-10-06
 * (#695), "never two blocks or two tables for the same word". `essere`'s two
 * verb records share one conjugation, and a base word's grid shows once,
 * whichever of its records it is read from; each draws under the first that
 * shows it.
 */
class Drawn {
  private readonly keys = new Set<string>();

  /** True the first time the page asks to draw `key`, and false after. */
  first(key: string): boolean {
    if (this.keys.has(key)) return false;
    this.keys.add(key);
    return true;
  }
}

/** What tells two tables apart: their shape, their lemma's word and what they show. */
function drawnKey(table: LemmaTable | { kind: "own"; reading: Reading; forms: OwnForms }): string {
  if (table.kind === "conjugation") return `conjugation\u0000${conjugationKey(table)}`;
  // A base word's grid shows once, whichever of its records it is read from:
  // `bella`'s noun record shows no second *Forms of bello* (rule 1, #695).
  if (table.kind === "grid") return `lemma-grid\u0000${table.lemma.word}`;
  const { reading, forms } = table;
  return forms.kind === "grid"
    ? `grid\u0000${reading.word}\u0000${gridKey(forms.agreement)}`
    : `conjugation\u0000${reading.word}\u0000${tableKey(reading)}`;
}

/**
 * The page for `query`. `lemmas` are the records of the words
 * `gridLemmaWords(readings)` names, as the lookup reads them; a lemma grid is
 * drawn only from one of them. `route` is how the lookup reached the readings:
 * a feminine compound form (`sono andata`, #676) names the gender in its
 * verbs' lines.
 */
export function wordPage(query: string, readings: readonly [Reading, ...Reading[]], lemmas: readonly Reading[], route: WordRoute): WordPage {
  const gender: SpelledGender = route.kind === "feminine" ? "feminine" : "as-listed";
  const forms = formsOfQueryReadings(readings);
  const siblings = otherFormsOfQueryLemmas(readings);
  const ordered = pageOrder(readings.filter((reading) => !forms.has(reading) && !siblings.has(reading)));
  const about = ordered.filter((reading) => reading.isAboutQuery);
  const merged = mergeWordFacts(about);
  const placed = placeWordFacts(about, merged);
  const page: PageParts = { ordered, about, own: ownKeysOf(readings), lemmas, placed, gender };

  // Only records about the searched word are readings (rule 2 of Huey's ruling
  // of 2026-10-06, #695): a record that only lists the query in its table is
  // another word's, and shows only as a verb's block. A page none of whose
  // records about the word has anything to show keeps those records as
  // readings, as before, until #696 and #700 rule on it (`gravida`, `citta`).
  const aboutOnly = pageDrafts(page, "about");
  const drafts = aboutOnly.some((draft) => draft.kind !== "bare") ? aboutOnly : pageDrafts(page, "every");
  // What a verb shown only as a block brings with it stays on the verb's own
  // page (#668): its Expressions, and on a form page the form record's own
  // `vedi <verb>` Etymology.
  const blockVerbs = new Set(drafts.flatMap((draft) => (draft.kind === "verb-form" ? [draft.verb] : [])));
  const shownEtymologies = (etymologies: WordText[]): WordText[] =>
    isFormPage(about) ? etymologies.filter((etymology) => !pointsToBlockVerb(etymology, blockVerbs)) : etymologies;

  // A reading with nothing to show is left out, and the rest number 1, 2, 3 in
  // page order, so the numbers never skip (Huey, 2026-10-06, #694, keeping
  // #687's numbering for every reading that shows something). A page where no
  // reading shows anything keeps them all as bare headings, as before.
  const entries = drafts.flatMap((draft): Unnumbered<PageEntry>[] =>
    draft.kind === "bare" ? [] : [draft.kind === "verb-form" ? { ...draft, etymologies: shownEtymologies(draft.etymologies) } : draft],
  );
  const bare = drafts.flatMap((draft) => (draft.kind === "bare" ? [draft] : []));
  const shown = numbered(entries) ?? numbered(bare);
  if (shown === undefined) throw new Error("a found result renders at least one reading");

  const headword = about[0]?.word ?? query;
  return {
    headword,
    readings: shown,
    wordFacts: { ...placed.rest, etymologies: shownEtymologies(placed.rest.etymologies) },
    wordLists: {
      synonyms: relatedItems(placed.rest.synonyms),
      antonyms: relatedItems(placed.rest.antonyms),
      derived: relatedItems(placed.rest.derived),
    },
    expressionSections: expressionSections(headword, about, blockVerbs),
    sourceWord: headword,
  };
}

/** What a page's entries are drawn from. */
interface PageParts {
  /** The records that may be readings, in page order. */
  ordered: readonly Reading[];
  /** Those of them about the query. */
  about: readonly Reading[];
  /** The keys of every record about the query, which no link names as a base word. */
  own: ReadonlySet<string>;
  /** The base word records the search read (`gridLemmaWords`). */
  lemmas: readonly Reading[];
  placed: PlacedFacts;
  gender: SpelledGender;
}

/**
 * The page's entries before they are numbered, in page order: the records
 * `which` names as readings, every verb's block, and, for a reading with
 * nothing to show, its bare heading.
 */
function pageDrafts({ ordered, about, own, lemmas, placed, gender }: PageParts, which: "about" | "every"): Unnumbered<PageEntry | BareReading>[] {
  // Each verb the query is a form of gets one block, in the place its first
  // line puts it: the rule-built ones lead, as their lines did under #627, and
  // a form record's take its place in the source's order.
  const slots: Slot[] = [];
  const blocks = new Map<string, BlockDraft>();
  const blockOf = (verb: string): BlockDraft => {
    let block = blocks.get(verb);
    if (block === undefined) {
      block = { verb, sourceLines: [], ruleLines: new Map(), sources: [], verbs: [], tables: new Map(), etymologies: [], synonyms: [] };
      blocks.set(verb, block);
      slots.push({ kind: "block", block });
    }
    return block;
  };
  for (const verb of ordered) {
    const lines = ruleLinesOf(verb, about, gender);
    if (lines.length === 0) continue;
    const block = blockOf(verb.word);
    for (const line of lines) if (!block.ruleLines.has(line.text)) block.ruleLines.set(line.text, line);
    block.verbs.push(verb);
    const table = ownConjugation(verb);
    if (table !== undefined) addTables(block, [table]);
  }
  const inBlocks = new Set([...blocks.values()].flatMap((block) => block.verbs));
  // A noun or adjective form joins the block of its first base word, in the
  // place of the first form of that word (rule 1, #695): `bella`'s noun record
  // joins its adjective record's block for bello, and `costruttrici`'s noun
  // record its adjective record's block for costruttore.
  const formBlocks = new Map<string, ReadingSlot>();
  for (const reading of ordered) {
    if (inBlocks.has(reading) || (which === "about" && !reading.isAboutQuery)) continue;
    const verbs = formOfVerbs(reading);
    if (verbs === undefined) {
      const [base] = formBasesOf(reading, lemmas, own);
      const block = base === undefined ? undefined : formBlocks.get(base.word);
      if (block !== undefined) {
        block.readings.push(reading);
        continue;
      }
      const slot: ReadingSlot = { kind: "reading", readings: [reading] };
      if (base !== undefined) formBlocks.set(base.word, slot);
      slots.push(slot);
      continue;
    }
    const blockVerbs = new Set(verbs.map((one) => one.verb));
    const elsewhere = reading.lemmaLinks.map((link) => link.targetWord).filter((word) => !blockVerbs.has(word));
    verbs.forEach(({ verb, tables, items }, i) => {
      const block = blockOf(verb);
      block.sourceLines.push(...items.map((item): SourceFormLine => ({ kind: "source", reading, item })));
      block.sources.push({ reading, first: i === 0, lemmaWords: [...new Set(i === 0 ? [verb, ...elsewhere] : [verb])] });
      addTables(block, tables);
      if (i === 0) {
        block.etymologies.push(...(placed.etymologies.get(reading) ?? []));
        block.synonyms.push(...(placed.synonyms.get(reading) ?? []));
      }
    });
  }

  const drawn = new Drawn();
  return slots.flatMap((slot): Unnumbered<PageEntry | BareReading>[] => {
    if (slot.kind === "reading") {
      const shown = shownReading(slot.readings, lemmas, own, placed, drawn);
      return shown !== undefined ? [shown] : slot.readings.map((reading) => ({ kind: "bare", reading }));
    }
    const { block } = slot;
    const lines = nonEmpty<FormLine>([...block.sourceLines, ...block.ruleLines.values()]);
    if (lines === undefined) return [];
    const tables = [...block.tables.values()];
    return [
      {
        kind: "verb-form",
        posTitle: VOCE_VERBALE,
        verb: block.verb,
        lines,
        sources: block.sources,
        verbs: block.verbs,
        tables: tables.filter((table) => drawn.first(drawnKey(table))),
        definitions: lemmaDefinitionsOf(tables),
        etymologies: block.etymologies,
        synonyms: relatedItems(block.synonyms),
      },
    ];
  });
}

/**
 * Whether a page is a form page: no reading about the query is a noun or
 * adjective that is not itself a form. `andati`, whose only other reading is
 * `Aggettivo, forma flessa`, is one; `andata`, with `andata` the noun, is not,
 * and keeps the word's own Etymology, Synonyms and Antonyms (Huey's ruling 3
 * of 2026-10-06, #668).
 */
const isFormPage = (about: readonly Reading[]): boolean =>
  !about.some((reading) => (isNounReading(reading) || isAdjectiveReading(reading)) && !isFormOfReading(reading));

/**
 * Whether an etymology is only the source's pointer to a verb the page shows
 * as a block: `vedi andare` on `andati`, `vedi salivare` on `salivate`. It
 * says nothing the block does not, and a form page does not show it (Huey's
 * ruling 2 of 2026-10-06, #668). Any other text, `da andare` included, is
 * not one.
 */
function pointsToBlockVerb(etymology: WordText, blockVerbs: ReadonlySet<string>): boolean {
  const verb = /^vedi\s+(\S+?)\.?$/u.exec(etymology.text.trim())?.[1];
  return verb !== undefined && blockVerbs.has(verb);
}

/** Whether a reading about the query declares itself a form of `verb`, so its own record says what the query is. */
const formOfReadingAbout = (verb: Reading, about: readonly Reading[]): boolean =>
  about.some((reading) =>
    reading.lemmaLinks.some(
      (link) => link.kind === "candidates" && link.candidates.some((candidate) => entryKey(candidate) === entryKey(verb)),
    ),
  );

/**
 * The lines saying which form of `verb` the query is (#627), when `verb` is a
 * verb reading on the page that is not about the query and whose own
 * `forms[]` entries the query hit: one line per hit cell `it-verb-form-line/v1`
 * names, matched by pointer, identical lines once. None when no cell is named,
 * or when a reading about the query already declares itself a form of `verb`.
 * `gender` is how the query spelled the cells: a feminine names it in each line.
 */
function ruleLinesOf(verb: Reading, about: readonly Reading[], gender: SpelledGender): VerbFormLine[] {
  if (!isVerbReading(verb) || verb.isAboutQuery || formOfReadingAbout(verb, about)) return [];
  const hit = searchedSpellings(verb).formPointers;
  const lines = new Map<string, VerbFormLine>();
  for (const form of verb.forms) {
    if (!isSourceRef(form.ref) || !hit.has(form.ref.jsonPointer)) continue;
    const text = verbFormLine(verb.word, sourceTagsOf(form), gender);
    if (text === undefined || lines.has(text)) continue;
    lines.set(text, { kind: "rule", text, lemma: verb.word, sourceType: "lexema-deterministic", rule: VERB_FORM_LINE_RULE, ref: form.ref });
  }
  return [...lines.values()];
}

/** A verb reading's own conjugation, drawn as a lemma's: opened where the query hit it. */
function ownConjugation(verb: Reading): ConjugationTable | undefined {
  const evidence = nonEmpty(verb.evidence.filter((occurrence) => occurrence.origin === "embedded-form"));
  return evidence === undefined
    ? undefined
    : { kind: "conjugation", lemma: verb, listing: { forms: verb.forms, evidence }, definitions: { senses: verb.senses, recovered: verb.recovered, lemmaLinks: verb.lemmaLinks } };
}

/** A page entry before it has its number. */
type Unnumbered<T> = T extends unknown ? Omit<T, "number"> : never;

/** The entries numbered 1, 2, 3 in the order given; none when there are none. */
const numbered = <T>(drafts: readonly T[]): NonEmpty<T & { number: number }> | undefined =>
  nonEmpty(drafts.map((draft, i) => ({ ...draft, number: i + 1 })));

/** The etymologies and synonym groups `placeWordFacts` moved into readings. */
type PlacedFacts = Pick<ReturnType<typeof placeWordFacts>, "etymologies" | "synonyms">;

/**
 * A source reading as the page shows it, or none when it has nothing to show
 * (Huey, 2026-10-06, #694): no definition or example of its own, no `Form of`
 * line, no table of its own or of a lemma, and no etymology or synonym the
 * source ties to it. A form-of reading never takes its own table: only its
 * lines, and its lemma's *Definitions* and table when a lemma's grid lists it.
 *
 * `records` are the slot's: one for any reading but a noun or adjective form,
 * whose block holds every form record of its base word (rule 1, #695). The
 * first heads it; each record's lines show in turn, and the block draws the
 * *Definitions* of the first record's first base word, as a verb form block
 * draws its first table's, and one table per base word.
 */
function shownReading(
  records: NonEmpty<Reading>,
  lemmas: readonly Reading[],
  own: ReadonlySet<string>,
  placed: PlacedFacts,
  drawn: Drawn,
): Unnumbered<PageReading> | undefined {
  const [reading, ...also] = records;
  const text = ownTextOf(reading);
  const lemmaLines = nonEmpty([...new Set(records.flatMap((record) => unlinkedLemmas(record)))]);
  const etymologies = nonEmpty(records.flatMap((record) => placed.etymologies.get(record) ?? []));
  const synonyms = nonEmpty(relatedItems(records.flatMap((record) => placed.synonyms.get(record) ?? [])));
  const lines: SharedPart[] = lemmaLines === undefined ? [] : [{ kind: "lemma-lines", words: lemmaLines }];
  const after = (tables: LemmaTable[]): SharedPart[] => {
    const parts: SharedPart[] = [];
    const listed = nonEmpty(tables.filter((table) => drawn.first(drawnKey(table))));
    if (listed !== undefined) parts.push({ kind: "lemma-forms", tables: listed });
    if (etymologies !== undefined) parts.push({ kind: "etymology", etymologies });
    if (synonyms !== undefined) parts.push({ kind: "synonyms", items: synonyms });
    return parts;
  };
  const conjugations = conjugationTablesOf(reading);

  if (!isFormOfReading(reading)) {
    const forms = ownFormsOf(reading);
    const parts: LemmaPart[] = [];
    if (text !== undefined) parts.push({ kind: "definitions", text });
    parts.push(...lines);
    if (forms !== undefined && drawn.first(drawnKey({ kind: "own", reading, forms }))) parts.push({ kind: "own-forms", forms });
    parts.push(...after(conjugations));
    const shown = nonEmpty(parts);
    return shown === undefined ? undefined : { kind: "source", role: "lemma", reading, parts: shown };
  }
  // A noun or adjective form: its records' lines, then its first base word's
  // Definitions, then one table per base word (#695), each shown once a page.
  const [lead] = formBasesOf(reading, lemmas, own);
  const definitions =
    lead !== undefined && drawn.first(`definitions\u0000${entryKey(lead)}`) ? definitionListOf(lead, lead) : undefined;
  const bases = new Map<string, Reading>();
  for (const base of records.flatMap((record) => formBasesOf(record, lemmas, own))) if (!bases.has(base.word)) bases.set(base.word, base);
  const grids = [...bases.values()].flatMap((base) => gridOf(base) ?? []);
  const formLines = nonEmpty(recordLinesOf(records));
  const parts: FormOfPart[] = [];
  if (formLines !== undefined) parts.push({ kind: "form-lines", records: formLines });
  parts.push(...lines);
  if (definitions !== undefined) parts.push({ kind: "lemma-definitions", list: definitions });
  parts.push(...after([...records.flatMap(conjugationTablesOf), ...grids]));
  const shown = nonEmpty(parts);
  return shown === undefined ? undefined : { kind: "source", role: "form-of", reading, also, parts: shown };
}

/**
 * Each record's form lines, in record order, a line an earlier record already
 * gave shown once with both records' examples under it (`costruttrici`'s
 * adjective and noun records both read "plurale di costruttrice"). A record
 * left with no line and no example has none.
 */
function recordLinesOf(records: readonly Reading[]): RecordLines[] {
  const shown = new Map<string, DefinitionItem>();
  const lines: RecordLines[] = [];
  for (const reading of records) {
    const text = ownTextOf(reading);
    if (text === undefined) continue;
    if (text.kind === "examples") {
      lines.push({ reading, text });
      continue;
    }
    const items: DefinitionItem[] = [];
    for (const item of text.items) {
      const earlier = shown.get(definitionTextKey(item));
      if (earlier === undefined) {
        const copy = { ...item, examples: [...item.examples] };
        shown.set(definitionTextKey(item), copy);
        items.push(copy);
      } else {
        earlier.examples.push(...item.examples.filter((example) => !earlier.examples.includes(example)));
      }
    }
    const listed = nonEmpty(items);
    const loose = nonEmpty(text.looseExamples);
    if (listed !== undefined) lines.push({ reading, text: { kind: "definitions", items: listed, looseExamples: text.looseExamples } });
    else if (loose !== undefined) lines.push({ reading, text: { kind: "examples", looseExamples: loose } });
  }
  return lines;
}

/** A verb form block as it is gathered, before it is numbered. */
interface BlockDraft {
  verb: string;
  sourceLines: SourceFormLine[];
  /** By text, so an identical line shows once. */
  ruleLines: Map<string, VerbFormLine>;
  sources: BlockRecord[];
  verbs: Reading[];
  /** By {@link conjugationKey}, so an identical table shows once. */
  tables: Map<string, ConjugationTable>;
  etymologies: WordText[];
  synonyms: RelatedWord[];
}

/**
 * A source reading's place on the page. A noun or adjective form's holds every
 * form record about the query of its base word, the first heading the block;
 * any other reading's holds its one record.
 */
interface ReadingSlot {
  kind: "reading";
  readings: NonEmpty<Reading>;
}

/** One place on the page: a source reading, or a verb's block. */
type Slot = ReadingSlot | { kind: "block"; block: BlockDraft };

const addTables = (block: BlockDraft, tables: readonly ConjugationTable[]): void => {
  for (const table of tables) if (!block.tables.has(conjugationKey(table))) block.tables.set(conjugationKey(table), table);
};

const nonEmpty = <T>(items: T[]): [T, ...T[]] | undefined => {
  const [first, ...rest] = items;
  return first === undefined ? undefined : [first, ...rest];
};

/**
 * The entry's own list, every reading about the word merged, since the source
 * repeats one list on each of them; then one list per word the readings say
 * they are a form of, in page order, every record of that word merged.
 *
 * A verb the page shows as a block brings no list: its expressions are the
 * verb's, not the word's, on every page (Huey's ruling 1 of 2026-10-06, #668).
 * `andavano` shows none, `stato` and `andate` only their own.
 */
function expressionSections(headword: string, about: readonly Reading[], blockVerbs: ReadonlySet<string>): ExpressionSection[] {
  const sections: ExpressionSection[] = [];
  const own = nonEmpty(mergeExpressions(about.map((reading) => reading.wordFacts.expressions)));
  if (own !== undefined) sections.push({ kind: "own", expressions: own });

  const byLemma = new Map<string, Expression[][]>();
  for (const reading of about.filter(isFormOfReading)) {
    for (const link of reading.lemmaLinks) {
      if (link.kind !== "candidates") continue;
      for (const lemma of link.candidates) {
        if (lemma.word === headword || blockVerbs.has(lemma.word)) continue;
        byLemma.set(lemma.word, [...(byLemma.get(lemma.word) ?? []), lemma.expressions]);
      }
    }
  }
  for (const [lemma, lists] of byLemma) {
    const expressions = nonEmpty(mergeExpressions(lists));
    if (expressions !== undefined) sections.push({ kind: "lemma", lemma, expressions });
  }
  return sections;
}

/**
 * The headword-level fields, once for the word.
 *
 * The source usually repeats them on every record of a headword, but not
 * always: 133 of the 16,792 headwords with several records in release
 * `it-0c432803` differ (docs/WEB.md). A union rather than the first record's
 * copy is what keeps a record that differs from being dropped without a word.
 */
function mergeWordFacts(readings: readonly Reading[]): WordFacts {
  const distinct = <T>(items: T[], key: (item: T) => string): T[] => {
    const seen = new Map<string, T>();
    for (const item of items) if (!seen.has(key(item))) seen.set(key(item), item);
    return [...seen.values()];
  };
  const related = (pick: (facts: WordFacts) => RelatedWord[]): RelatedWord[] => {
    const byWord = new Map<string, RelatedWord>();
    for (const word of readings.flatMap((reading) => pick(reading.wordFacts))) {
      const existing = byWord.get(word.word);
      if (existing) existing.refs.push(...word.refs);
      else byWord.set(word.word, { word: word.word, refs: [...word.refs] });
    }
    return [...byWord.values()];
  };
  const all = <T>(pick: (facts: WordFacts) => T[]): T[] => readings.flatMap((reading) => pick(reading.wordFacts));

  return {
    pronunciations: distinct<Pronunciation>(all((facts) => facts.pronunciations), (p) => `${p.ipa}\u0000${p.note}`),
    hyphenations: distinct<Hyphenation>(all((facts) => facts.hyphenations), (h) => h.parts.join("\u0000")),
    etymologies: distinct<WordText>(all((facts) => facts.etymologies), (e) => e.text),
    synonyms: related((facts) => facts.synonyms),
    synonymList: all((facts) => facts.synonymList),
    antonyms: related((facts) => facts.antonyms),
    derived: related((facts) => facts.derived),
    expressions: mergeExpressions(readings.map((reading) => reading.wordFacts.expressions)),
  };
}

/**
 * The one reading a label names, or undefined. A label that names two
 * (`medico`'s `(aggettivo e sostantivo)`) would copy one text into both, so
 * it stays once after the readings instead (Huey: identical things show once).
 */
const onlyReading = (named: readonly Reading[]): Reading | undefined => (named.length === 1 ? named[0] : undefined);

/**
 * Etymologies and synonym groups the source ties to one part of speech, moved
 * into the readings of that part of speech (design-system-manifest.md §
 * "Layout"). Only a word with two readings or more has anything to move.
 *
 * - An etymology moves when its bracket label names one reading on the page
 *   (`sale`: `(sostantivo plurale) vedi sala`), even when it is the word's only
 *   one (`strutto`: `(voce verbale) vedi struggere`). It shows there without
 *   the label, which the reading's heading already says.
 * - A synonym moves when a part-of-speech label earlier in its record's list
 *   opens the group it is in and names one reading (`vivere`: `sostantivo` on
 *   `esistenza`, `verbo` on `esistere`).
 *
 * Whatever is not moved stays in `rest`, verbatim, once for the word.
 */
function placeWordFacts(
  about: readonly Reading[],
  merged: WordFacts,
): { etymologies: Map<Reading, WordText[]>; synonyms: Map<Reading, RelatedWord[]>; rest: WordFacts } {
  const etymologies = new Map<Reading, WordText[]>();
  const synonyms = new Map<Reading, RelatedWord[]>();
  if (about.length < 2) return { etymologies, synonyms, rest: merged };

  const keptEtymologies: WordText[] = [];
  for (const etymology of merged.etymologies) {
    const { label, rest } = splitLabel(etymology.text);
    const reading = label !== undefined ? onlyReading(readingsNamed(label, about)) : undefined;
    if (reading === undefined) keptEtymologies.push(etymology);
    // A text that was only its label says nothing the reading's heading does not.
    else if (rest !== "") etymologies.set(reading, [...(etymologies.get(reading) ?? []), { text: rest, ref: etymology.ref }]);
  }

  const placedRefs = new Set<string>();
  for (const record of about) {
    let group: Reading | undefined;
    for (const entry of record.wordFacts.synonymList) {
      const label = entry.rawTags.find((tag) => labelParts(tag).length > 0);
      if (label !== undefined) group = onlyReading(readingsNamed(label, about));
      if (group === undefined) continue;
      placedRefs.add(factRefKey(entry.ref));
      const words = synonyms.get(group) ?? [];
      const existing = words.find((word) => word.word === entry.word);
      if (existing === undefined) words.push({ word: entry.word, refs: [entry.ref] });
      else if (!existing.refs.some((ref) => factRefKey(ref) === factRefKey(entry.ref))) existing.refs.push(entry.ref);
      synonyms.set(group, words);
    }
  }
  const keptSynonyms = merged.synonyms.filter((word) => word.refs.some((ref) => !placedRefs.has(factRefKey(ref))));

  return { etymologies, synonyms, rest: { ...merged, etymologies: keptEtymologies, synonyms: keptSynonyms } };
}
