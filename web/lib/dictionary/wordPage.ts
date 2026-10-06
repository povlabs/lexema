// What one word's page is made of, decided before anything renders.
//
// A lookup returns every record the query matches. Some are *about* the
// searched word (`isAboutQuery`); some merely list it in their own table. Each
// is a reading on the page except two kinds of form, each found only through
// declared `form_of` edges and matched by identity:
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
// A record that lists the query and declares no such form is still a reading.
//
// A searched verb form shows one block per verb it is a form of (#636; Huey's
// ruling of 2026-10-06, frame 37): `1 · Voce verbale · salire`, then that
// verb's form-of lines under *Definitions*, then *Forms of salire*, its
// conjugation opened where the searched cell is, when that table lists the
// query (matched by pointer). A block's lines come from two places:
//
// - A form record about the query: each of its definitions goes to the verb its
//   `form_of` edge names. `salivate`'s record gives salivare's block its two
//   lines, and `saliva`'s, naming salivare and salire, gives one line to each.
//   A record with a definition whose edges name no verb keeps its reading.
// - A verb's own table, when no record about the query names that verb: one
//   line per cell the query hit, built by rule `it-verb-form-line/v1`
//   (src/italian/verbFormLine.ts) in the table's own Italian names: "prima
//   persona singolare del passato prossimo indicativo di andare" (#627). The
//   verb's record then has no reading of its own: its table is the block's.
//   Rule-built blocks lead the page, as their lines did under #627.
//
// A rule-built line is built here, when the page is built; the lookup, the API
// and the seed never hold it (ADR 0012), and the page shows no mark for it (ADR
// 0016), though its type keeps it apart from a source line (`VerbFormLine`). A
// verb with no line, such as one whose only hit cell is a participle, gives no
// block and keeps its reading. A verb whose table does not list the query
// (`andati`: andare's lists only `andato`) has a block with no table.
//
// A form reading carries its lemma's table when that table lists the query, the
// way the lemma's own page draws it: `andavano` shows *Forms of andare*, the
// conjugation, and `bella` the adjective shows *Forms of bello*, the gender and
// number grid, in place of its own (#626). The lookup does not return the lemma
// as a record of its own, so nothing is counted twice: the readings are the
// lookup's records, and the tables are their lemmas'. A verb's table comes with
// the lookup; a grid needs the lemma's whole record, which the search reads for
// the words `gridLemmaWords` names (web/lib/dictionary/searchAttempt.ts).

import { normalizeItalianExact } from "@lexema/italian/normalize.ts";
import { VERB_FORM_LINE_RULE, verbFormLine } from "@lexema/italian/verbFormLine.ts";
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
  sourcePointerOf,
  type SourceRef,
} from "@lexema/lookup/types.ts";
import { sourceTagsOf } from "./conjugation.ts";
import { definitionsOf, hasDefinitions, placeOf, readAt, type DefinitionItem } from "./definitions.ts";
import { agreementOf, type Agreement, type Spelling } from "./genderGrid.ts";
import { labelParts, readingsNamed, splitLabel } from "./readingLabels.ts";
import { relatedItems, type RelatedItem } from "./relatedList.ts";
import type {
  EntryIdentity,
  Expression,
  LemmaCandidate,
  LemmaListing,
  Pronunciation,
  Hyphenation,
  Reading,
  RelatedWord,
  WordFacts,
  WordText,
} from "@lexema/lookup/types.ts";

/**
 * A lemma whose table lists the searched form, as its own page draws that
 * table. It renders under the form's reading as *Forms of andare* or *Forms of
 * bello* (design-system-manifest.md § "The result").
 *
 * - A verb's whole conjugation, opened where the form sits: `andare` for
 *   `andavano`.
 * - A noun's or adjective's gender and number grid, superlatives included,
 *   with nothing marked: `bello` for `bella`, `casa` for `case` (#626).
 */
export type LemmaTable =
  | { kind: "conjugation"; lemma: LemmaCandidate; listing: LemmaListing }
  | { kind: "grid"; lemma: Reading; agreement: Agreement };

/** A verb's conjugation, the one kind of table a verb form block shows. */
export type ConjugationTable = Extract<LemmaTable, { kind: "conjugation" }>;

/** A reading of a source record. */
export interface PageReading {
  kind: "source";
  /**
   * 1-based among the readings that have a definition, and the same number the
   * jump links and the report dialog show. A reading with no definition has
   * none: its heading is its part of speech alone.
   */
  number: number | undefined;
  reading: Reading;
  /**
   * The lemmas whose tables list the query, one per distinct table. Two
   * records with the same table (`chiusi` names `chiudere` twice) show it once;
   * tables that differ each show.
   */
  lemmaTables: LemmaTable[];
  /**
   * Whether the reading shows its own table. A noun or adjective form that
   * shows its lemma's grid does not also show its own (#626); a verb form
   * keeps both, as before.
   */
  ownForms: boolean;
  /** The etymologies the source ties to this reading, their bracket label dropped. */
  etymologies: WordText[];
  /** The synonym groups the source labels with this reading's part of speech. */
  synonyms: RelatedItem[];
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
  /** Whether this is the record's first block, the one that shows its own table and its loose examples. */
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
 * verbale · salire`, the verb's form-of lines, then *Forms of salire*.
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
  /** The verb's conjugation, one per distinct table. */
  tables: ConjugationTable[];
  /** The etymologies the source ties to the block's form records, their bracket label dropped. */
  etymologies: WordText[];
  /** The synonym groups the source labels with the block's form records. */
  synonyms: RelatedItem[];
}

/** One reading on a word's page: a source record's, or a verb form block. */
export type PageEntry = PageReading | VerbFormBlock;

/** What follows a block's number in its heading and its jump link: `Voce verbale · salire`. */
export const blockTitle = (block: VerbFormBlock): string => `${block.posTitle} · ${block.verb}`;

/** What names an entry in its ids: its record, or a block's verb. */
const entryName = (entry: PageEntry): string =>
  entry.kind === "verb-form" ? `voce-verbale-${entry.verb.replace(/\s+/g, "_")}` : entryKey(entry.reading);

/** The anchor of a page entry, which the jump links point to: one per entry, a block's named by its verb. */
export const readingAnchor = (entry: PageEntry): string => `reading-${entryName(entry)}`;

/** The id of a page entry's heading, which names the entry for assistive technology. */
export const readingHeadingId = (entry: PageEntry): string => `reading-heading-${entryName(entry)}`;

/** A source record a page shows, under the number of the entry that shows it. */
export interface ShownRecord {
  number: number | undefined;
  /** The record, named as its entry is headed: its part of speech, or the block's title. */
  reading: EntryIdentity & { posTitle: string };
}

/**
 * Every source record the page shows, in page order and each once: a
 * reading's record, and a block's form records and verb records under the
 * block's number and title. These are the records a report can name.
 */
export function shownRecords(entries: readonly PageEntry[]): ShownRecord[] {
  const seen = new Set<string>();
  const shown: ShownRecord[] = [];
  const add = (number: number | undefined, reading: Reading, posTitle: string) => {
    if (seen.has(entryKey(reading))) return;
    seen.add(entryKey(reading));
    shown.push({ number, reading: { ...reading, posTitle } });
  };
  for (const entry of entries) {
    if (entry.kind === "source") add(entry.number, entry.reading, entry.reading.posTitle);
    else for (const reading of [...entry.sources.map((source) => source.reading), ...entry.verbs]) add(entry.number, reading, blockTitle(entry));
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
 * per lemma it is a form of, *Expressions with andare*. A section with no row
 * is not a value this holds, so a page with none shows none (ADR 0016).
 */
export type ExpressionSection =
  | { kind: "own"; expressions: [Expression, ...Expression[]] }
  | { kind: "lemma"; lemma: string; expressions: [Expression, ...Expression[]] };

/** A list longer than this gets the *Find an expression* box once it is open (Huey, 2026-10-01, on #213). */
export const EXPRESSION_FILTER_ABOVE = 30;

/** Whether a section lists enough rows to be filtered. */
export const takesFilter = (section: ExpressionSection): boolean => section.expressions.length > EXPRESSION_FILTER_ABOVE;

/** Whether a row answers what was typed in *Find an expression*: its phrase or its meaning holds it. */
export function matchesExpression(expression: Expression, typed: string): boolean {
  const wanted = normalizeItalianExact(typed);
  if (wanted === "") return true;
  return [expression.phrase, ...expression.meanings].some((text) => normalizeItalianExact(text).includes(wanted));
}

export interface WordPage {
  /** The headword as the source spells it, or the query when no record is about it. */
  headword: string;
  readings: [PageEntry, ...PageEntry[]];
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
function tableKey(listing: LemmaListing): string {
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
 * The verb lemmas whose own tables list the query, for a verb reading that is
 * a form of them, by the word each `form_of` edge names: every candidate of
 * every link, once per distinct table.
 */
function conjugationTablesByVerb(reading: Reading): Map<string, ConjugationTable[]> {
  const byVerb = new Map<string, Map<string, ConjugationTable>>();
  if (!isVerbReading(reading)) return new Map();
  for (const link of reading.lemmaLinks) {
    if (link.kind !== "candidates") continue;
    for (const lemma of link.candidates) {
      if (lemma.pos !== "verb" || lemma.listing === undefined) continue;
      const table: ConjugationTable = { kind: "conjugation", lemma, listing: lemma.listing };
      const tables = byVerb.get(link.targetWord) ?? new Map<string, ConjugationTable>();
      if (!tables.has(conjugationKey(table))) tables.set(conjugationKey(table), table);
      byVerb.set(link.targetWord, tables);
    }
  }
  return new Map([...byVerb].map(([verb, tables]) => [verb, [...tables.values()]]));
}

/** {@link conjugationTablesByVerb}, every verb's tables together, once per distinct table. */
function conjugationTablesOf(reading: Reading): LemmaTable[] {
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
 * are those that list the query, and there may be none (`andati`: andare's
 * table lists only `andato`). A definition goes to the first verb an edge on
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

/** The lemma records a noun or adjective form names, of its own part of speech when it names one. */
const gridLemmasOf = (reading: Reading) => lemmasOfPartOfSpeech(reading.pos, reading.lemmaLinks);

/**
 * The words whose records a page needs read to draw its lemma grids: every
 * lemma a noun or adjective form about the query names (`bello` for `bella`).
 * Empty for any other page, so a search reads nothing more for it.
 */
export function gridLemmaWords(readings: readonly Reading[]): string[] {
  return [...new Set(readings.filter(takesLemmaGrid).flatMap((reading) => gridLemmasOf(reading).map((lemma) => lemma.word)))];
}

const spellingsOf = ({ grid, superlative }: Agreement): Spelling[] =>
  [grid, superlative].flatMap((one) => one?.rows.flatMap((row) => row.cells.flatMap((cell) => cell.spellings)) ?? []);

/** What a lemma's grids show: each row's gender and each cell's spellings, in order. */
const gridKey = ({ grid, superlative }: Agreement): string =>
  JSON.stringify(
    [grid, superlative].map((one) => one?.rows.map((row) => [row.gender, row.cells.map((cell) => cell.spellings.map((spelling) => spelling.surface))])),
  );

/**
 * The lemma grids that list the query, for a noun or adjective form about it:
 * each lemma record it names, drawn from `lemmas` as that record's own reading
 * draws it, once per distinct grid.
 *
 * A grid lists the query when one of its cells holds a `forms[]` entry the
 * query hit (`bello` lists `bella`), or the form's own record declared as the
 * lemma's plural (`casa` takes `case` from `case`, #145). Both are matched by
 * pointer and record, never by spelling.
 */
function gridTablesOf(reading: Reading, lemmas: readonly Reading[]): LemmaTable[] {
  if (!takesLemmaGrid(reading)) return [];
  const tables = new Map<string, LemmaTable>();
  for (const candidate of gridLemmasOf(reading)) {
    const lemma = lemmas.find((one) => entryKey(one) === entryKey(candidate));
    // A record that is itself a form is no lemma to draw: `costruttrice`, the
    // "femminile di costruttore" that `costruttrici` names, has no table of its
    // own, so `costruttrici` keeps its own.
    if (lemma === undefined || lemma.lemmaLinks.length > 0) continue;
    const agreement = agreementOf(lemma);
    const hit = candidate.listing === undefined ? new Set<string>() : searchedSpellings(candidate.listing).formPointers;
    const lists = spellingsOf(agreement).some(
      (spelling) =>
        spelling.forms.some((form) => hit.has(sourcePointerOf(form.ref) ?? "")) ||
        (reading.recordId !== undefined && spelling.declaredBy.some((record) => record.recordId === reading.recordId)),
    );
    if (!lists) continue;
    const key = `${lemma.word}\u0000${gridKey(agreement)}`;
    if (!tables.has(key)) tables.set(key, { kind: "grid", lemma, agreement });
  }
  return [...tables.values()];
}

/**
 * The page for `query`. `lemmas` are the records of the words
 * `gridLemmaWords(readings)` names, as the lookup reads them; a lemma grid is
 * drawn only from one of them.
 */
export function wordPage(query: string, readings: readonly [Reading, ...Reading[]], lemmas: readonly Reading[]): WordPage {
  const forms = formsOfQueryReadings(readings);
  const siblings = otherFormsOfQueryLemmas(readings);
  const ordered = pageOrder(readings.filter((reading) => !forms.has(reading) && !siblings.has(reading)));
  const about = ordered.filter((reading) => reading.isAboutQuery);
  const merged = mergeWordFacts(about);
  const placed = placeWordFacts(about, merged);

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
    const lines = ruleLinesOf(verb, about);
    if (lines.length === 0) continue;
    const block = blockOf(verb.word);
    for (const line of lines) if (!block.ruleLines.has(line.text)) block.ruleLines.set(line.text, line);
    block.verbs.push(verb);
    const table = ownConjugation(verb);
    if (table !== undefined) addTables(block, [table]);
  }
  const inBlocks = new Set([...blocks.values()].flatMap((block) => block.verbs));
  for (const reading of ordered) {
    if (inBlocks.has(reading)) continue;
    const verbs = formOfVerbs(reading);
    if (verbs === undefined) {
      slots.push({ kind: "reading", reading });
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

  // Readings with a definition number 1, 2, 3 among themselves, so the page
  // never shows a gap (Huey, 2026-09-30, on #250); a block always has one.
  let numbered = 0;
  const entries = slots.flatMap((slot): PageEntry[] => {
    if (slot.kind === "block") {
      const { block } = slot;
      const lines = nonEmpty<FormLine>([...block.sourceLines, ...block.ruleLines.values()]);
      if (lines === undefined) return [];
      return [
        {
          kind: "verb-form",
          number: ++numbered,
          posTitle: VOCE_VERBALE,
          verb: block.verb,
          lines,
          sources: block.sources,
          verbs: block.verbs,
          tables: [...block.tables.values()],
          etymologies: block.etymologies,
          synonyms: relatedItems(block.synonyms),
        },
      ];
    }
    const { reading } = slot;
    const grids = gridTablesOf(reading, lemmas);
    return [
      {
        kind: "source",
        number: hasDefinitions(reading) ? ++numbered : undefined,
        reading,
        lemmaTables: [...conjugationTablesOf(reading), ...grids],
        ownForms: grids.length === 0,
        etymologies: placed.etymologies.get(reading) ?? [],
        synonyms: relatedItems(placed.synonyms.get(reading) ?? []),
      },
    ];
  });
  const [first, ...rest] = entries;
  if (first === undefined) throw new Error("a found result renders at least one reading");

  const headword = about[0]?.word ?? query;
  return {
    headword,
    readings: [first, ...rest],
    wordFacts: placed.rest,
    wordLists: {
      synonyms: relatedItems(placed.rest.synonyms),
      antonyms: relatedItems(placed.rest.antonyms),
      derived: relatedItems(placed.rest.derived),
    },
    expressionSections: expressionSections(headword, about),
    sourceWord: headword,
  };
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
 */
function ruleLinesOf(verb: Reading, about: readonly Reading[]): VerbFormLine[] {
  if (!isVerbReading(verb) || verb.isAboutQuery || formOfReadingAbout(verb, about)) return [];
  const hit = searchedSpellings(verb).formPointers;
  const lines = new Map<string, VerbFormLine>();
  for (const form of verb.forms) {
    if (!isSourceRef(form.ref) || !hit.has(form.ref.jsonPointer)) continue;
    const text = verbFormLine(verb.word, sourceTagsOf(form));
    if (text === undefined || lines.has(text)) continue;
    lines.set(text, { kind: "rule", text, lemma: verb.word, sourceType: "lexema-deterministic", rule: VERB_FORM_LINE_RULE, ref: form.ref });
  }
  return [...lines.values()];
}

/** A verb reading's own conjugation, drawn as a lemma's: opened where the query hit it. */
function ownConjugation(verb: Reading): ConjugationTable | undefined {
  const evidence = nonEmpty(verb.evidence.filter((occurrence) => occurrence.origin === "embedded-form"));
  return evidence === undefined ? undefined : { kind: "conjugation", lemma: verb, listing: { forms: verb.forms, evidence } };
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

/** One place on the page: a reading of its own, or a verb's block. */
type Slot = { kind: "reading"; reading: Reading } | { kind: "block"; block: BlockDraft };

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
 * they are a form of, in page order, every record of that word merged
 * (`andavano`: *Expressions with andare*; `stato`: its own, then *with stare*).
 */
function expressionSections(headword: string, about: readonly Reading[]): ExpressionSection[] {
  const sections: ExpressionSection[] = [];
  const own = nonEmpty(mergeExpressions(about.map((reading) => reading.wordFacts.expressions)));
  if (own !== undefined) sections.push({ kind: "own", expressions: own });

  const byLemma = new Map<string, Expression[][]>();
  for (const reading of about.filter(isFormOfReading)) {
    for (const link of reading.lemmaLinks) {
      if (link.kind !== "candidates") continue;
      for (const lemma of link.candidates) {
        if (lemma.word === headword) continue;
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
