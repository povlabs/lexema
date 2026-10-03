// A noun's, adjective's or inflecting phrase's forms, laid out as the page's
// gender-and-number grid: columns singolare and plurale, rows maschile and
// femminile, only the rows the source has. An adjective's superlatives are a
// second grid of the same shape.
//
// Placement rules, each deterministic and none reading a spelling:
//
// - A spelling goes in every gender its row states, and in the number it
//   states. A form that states a number but no gender takes the record's
//   gender when the record states exactly one: `bello` the noun is masculine
//   and lists `belli` tagged plural only. When the record states both (`fine`
//   lists `fini` tagged plural), the form's gender is not guessed, so it takes
//   no cell.
// - The headword sits in every number its record states (`khmer` is tagged
//   singular and plural, so it fills both), and, as the citation form, in the
//   singolare column when its record states no usable number (`andare` the
//   noun, `bello` invariable).
// - A form with a degree other than positive is a comparison, not an agreement
//   cell: a superlative goes to the superlativo grid, anything else takes no
//   cell.
// - Only nouns, adjectives and phrases get a grid. A proper name, a prefix or
//   any other part of speech gets none, and no generated articles.
// - A noun whose own record gives no plural — no plural headword, no plural
//   form, not invariable — takes the plural of a noun record that glosses
//   itself "plurale di <word>" (`it-plural-gloss/v1`, #145): `case` fills
//   casa's femminile plurale, and `casetta`, "diminutivo di casa", fills
//   nothing. It goes in the gender the gloss names (`femminile plurale di`),
//   else every gender that record's tags state, else the noun's own gender
//   when it states exactly one; otherwise it takes no cell. A curated
//   correction of the declaring record (#420) outranks all of these, and its
//   number can move the spelling to the singolare column: `ammaliatrice`
//   glosses itself "plurale di ammaliatore" and is its femminile singolare.
//   A correction of a noun's own gender places its headword by it:
//   `fissazione` is tagged masculine and sits in femminile. A record's own
//   plural always wins, so this never adds a second one. The gloss names a
//   word, not a record, so it fills a cell only when one noun record spells
//   that word: `temi` says "plurale di tema", `tema` is a masculine noun and a
//   feminine one, and neither takes `temi` from it (the masculine lists its
//   own).
// - A form that takes no cell is not shown: the page shows data, never a note
//   on what it could not place (Huey, 2026-09-27, on #142).
//
// Each spelling's articles are `it-articles/v3` (src/italian/articles.ts),
// applied to it with the cell's gender and number, exactly as it stands; a cell
// with two spellings (`oli`, `olii`) gives each its own line. The headword's
// spelling also passes the rule the record's own IPA (`hotel` /oˈtɛl/ is
// `l'hotel`); a form's spelling does not, since the IPA is the headword's. Where the rule refuses (a phrase, a spelling it does not handle) the
// cell has no article line.

import { asserts, isAdjectiveReading, isNounReading, namesOneRecordOf } from "@lexema/lookup/types.ts";
import type { InflectionOf, PluralDeclaration, Reading, RecordClaim, SourceForm } from "@lexema/lookup/types.ts";
import { generateItalianArticles, spokenOpening, type SpokenOpening } from "@lexema/italian/articles.ts";

export const GENDERS = ["masculine", "feminine"] as const;
export type Gender = (typeof GENDERS)[number];
export const NUMBERS = ["singular", "plural"] as const;
export type GrammaticalNumber = (typeof NUMBERS)[number];

export const GENDER_LABEL: Record<Gender, string> = { masculine: "maschile", feminine: "femminile" };
export const NUMBER_LABEL: Record<GrammaticalNumber, string> = { singular: "singolare", plural: "plurale" };

/**
 * One spelling in a cell, and every source entry that spells it there: the
 * headword, `forms[]` entries, or both. `studente` lists `studenti` twice, and
 * both land in maschile plurale; the cell shows the word once and keeps both.
 */
export interface Spelling {
  surface: string;
  headword: boolean;
  forms: SourceForm[];
  /**
   * The records that gloss themselves this word's plural and spell it: `case`
   * for casa. A curated correction can put one in a singular cell:
   * `ammaliatrice` for ammaliatore.
   */
  declaredBy: InflectionOf[];
}

export interface GridCell {
  /** Each spelling with its own `il bello · un bello` line; empty when the rule gives none. */
  spellings: (Spelling & { articles: string[] })[];
}

export interface GridRow {
  gender: Gender;
  /** In NUMBERS order. A cell with no spellings is a dash. */
  cells: [GridCell, GridCell];
}

export interface Grid {
  rows: GridRow[];
}

export interface Agreement {
  /** The plain grid, or none when nothing in the reading takes a cell. */
  grid: Grid | undefined;
  /** The superlativo grid, when the source lists superlatives with a gender and number. */
  superlative: Grid | undefined;
}

/** What the claims state for one dimension, a curated correction (#420) standing in for the source's own. */
function statedValues(claims: readonly RecordClaim[], dimension: string): string[] {
  const values: string[] = [];
  for (const claim of claims) {
    if (asserts(claim) && claim.dimension === dimension && !values.includes(claim.value)) {
      values.push(claim.value);
    }
  }
  return values;
}

export const gendersOf = (claims: readonly RecordClaim[]): Gender[] =>
  GENDERS.filter((gender) => statedValues(claims, "gender").includes(gender));

/** Every agreeing number the claims state, in NUMBERS order. */
export const numbersOf = (claims: readonly RecordClaim[]): GrammaticalNumber[] =>
  NUMBERS.filter((number) => statedValues(claims, "number").includes(number));

function numberOf(claims: readonly RecordClaim[]): GrammaticalNumber | undefined {
  const numbers = NUMBERS.filter((number) => statedValues(claims, "number").includes(number));
  return numbers.length === 1 ? numbers[0] : undefined;
}

const degreesOf = (form: SourceForm): string[] =>
  statedValues(form.claims, "degree").filter((degree) => degree !== "positive");

/** Definite, then indefinite (singular) or partitive (plural): the grid's article line. */
function articleLine(surface: string, gender: Gender, number: GrammaticalNumber, spoken: SpokenOpening | undefined): string[] {
  const { articles } = generateItalianArticles(surface, gender, number, spoken);
  const second = number === "singular" ? "indefinite" : "partitive";
  return (["definite", second] as const).flatMap((kind) =>
    articles.filter((article) => article.kind === kind).map((article) => article.displayForm),
  );
}

/** Where a spelling in a cell comes from. */
type Entry =
  | { kind: "headword" }
  | { kind: "form"; form: SourceForm }
  | { kind: "declared-plural"; record: InflectionOf };

const HEADWORD: Entry = { kind: "headword" };

class GridBuilder {
  private readonly cells = new Map<string, Spelling[]>();

  put(gender: Gender, number: GrammaticalNumber, entry: Entry, surface: string): void {
    const key = `${gender} ${number}`;
    const spellings = this.cells.get(key) ?? [];
    let spelling = spellings.find((existing) => existing.surface === surface);
    if (spelling === undefined) {
      spelling = { surface, headword: false, forms: [], declaredBy: [] };
      spellings.push(spelling);
    }
    if (entry.kind === "headword") spelling.headword = true;
    else if (entry.kind === "form") spelling.forms.push(entry.form);
    else spelling.declaredBy.push(entry.record);
    this.cells.set(key, spellings);
  }

  get size(): number {
    return this.cells.size;
  }

  /** `spoken` is what the record's IPA says about its headword's opening. */
  build(spoken?: SpokenOpening): Grid | undefined {
    const rows = GENDERS.flatMap((gender): GridRow[] => {
      if (!NUMBERS.some((number) => this.cells.has(`${gender} ${number}`))) return [];
      const cell = (number: GrammaticalNumber): GridCell => {
        const spellings = this.cells.get(`${gender} ${number}`) ?? [];
        return {
          spellings: spellings.map((spelling) => ({
            ...spelling,
            articles: articleLine(spelling.surface, gender, number, spelling.headword ? spoken : undefined),
          })),
        };
      };
      return [{ gender, cells: [cell("singular"), cell("plural")] }];
    });
    return rows.length > 0 ? { rows } : undefined;
  }
}

/** Whether a reading of this part of speech shows its headword in a grid of its own. */
function inflects(reading: Reading): boolean {
  const phrase = (reading.pos as string) === "phrase";
  return phrase || isNounReading(reading) || isAdjectiveReading(reading);
}

/**
 * Whether the record gives its own plural: it states the number plural or
 * invariable, or lists a plain form that states plural, placed or not
 * (`fine` lists `fini` with no gender, which still is its plural).
 */
function givesPlural(reading: Reading): boolean {
  const numbers = statedValues(reading.grammar.record, "number");
  if (numbers.includes("plural") || numbers.includes("invariable")) return true;
  return reading.forms.some((form) => degreesOf(form).length === 0 && numberOf(form.claims) === "plural");
}

/**
 * The cells a declared plural goes in. Its genders: a curated correction of
 * its record's gender, else the one its gloss names, else the ones its
 * record's tags state, else the noun's own when it states exactly one. Its
 * number: plural, as the gloss says, unless a correction of its record's
 * number says otherwise (`ammaliatrice` is ammaliatore's femminile singolare).
 */
function declaredCells(plural: PluralDeclaration, nounGenders: readonly Gender[]): { genders: readonly Gender[]; number: GrammaticalNumber } {
  const number = NUMBERS.find((value) => value === plural.correctedNumber?.value) ?? "plural";
  const corrected = gendersOf(plural.recordGenders.filter((claim) => claim.status === "corrected"));
  if (corrected.length > 0) return { genders: corrected, number };
  if (plural.glossGender !== undefined) return { genders: [plural.glossGender], number };
  const tagged = gendersOf(plural.recordGenders);
  if (tagged.length > 0) return { genders: tagged, number };
  return { genders: nounGenders.length === 1 ? nounGenders : [], number };
}

export function agreementOf(reading: Reading): Agreement {
  if (!inflects(reading)) return { grid: undefined, superlative: undefined };
  const plain = new GridBuilder();
  const superlative = new GridBuilder();
  const recordGenders = gendersOf(reading.grammar.record);

  const stated = numbersOf(reading.grammar.record);
  const headwordNumbers: GrammaticalNumber[] =
    reading.lemmaLinks.length === 0 ? (stated.length > 0 ? stated : ["singular"])
    // A form reading with a table of its own (`bella`) is placed in it too.
    : reading.forms.length > 0 ? stated
    : [];
  for (const number of headwordNumbers) {
    for (const gender of recordGenders) plain.put(gender, number, HEADWORD, reading.word);
  }

  for (const form of reading.forms) {
    const degrees = degreesOf(form);
    const target = degrees.length === 0 ? plain : degrees.includes("superlative") ? superlative : undefined;
    const own = gendersOf(form.claims);
    const genders = own.length > 0 ? own : recordGenders.length === 1 ? recordGenders : [];
    const number = numberOf(form.claims);
    if (target === undefined || genders.length === 0 || number === undefined) continue;
    for (const gender of genders) target.put(gender, number, { kind: "form", form }, form.surface);
  }

  if (isNounReading(reading) && !givesPlural(reading)) {
    for (const record of reading.inflections) {
      if (record.plural === undefined || record.pos !== "noun" || !namesOneRecordOf(record.pos, record)) continue;
      const { genders, number } = declaredCells(record.plural, recordGenders);
      for (const gender of genders) plain.put(gender, number, { kind: "declared-plural", record }, record.word);
    }
  }

  const spoken = spokenOpening(reading.wordFacts.pronunciations.map((sound) => sound.ipa));
  return { grid: plain.build(spoken), superlative: superlative.build() };
}

/** Two labels as Italian joins them: `maschile e femminile`. */
const both = (labels: readonly string[]): string =>
  labels.length < 2 ? labels.join("") : `${labels.slice(0, -1).join(", ")} e ${labels[labels.length - 1]}`;

/**
 * The record's own gender and number, in Italian, for the heading of a reading
 * that takes a grid: `maschile, singolare`; `maschile, singolare e plurale`
 * when it states both numbers (`khmer`). Only what the record states: one of
 * the two alone when it states only one, and nothing when it states neither or
 * the reading takes no grid (a verb, a Voce verbale, a proper name).
 */
export function headingGrammar(reading: Reading): string | undefined {
  if (!inflects(reading)) return undefined;
  const claims = reading.grammar.record;
  const numbers = [
    ...numbersOf(claims).map((number) => NUMBER_LABEL[number]),
    ...(statedValues(claims, "number").includes("invariable") ? ["invariabile"] : []),
  ];
  const parts = [headingGender(reading) ?? "", both(numbers)].filter((part) => part !== "");
  return parts.length === 0 ? undefined : parts.join(", ");
}

/**
 * The gender half of that heading, alone: `maschile`, `maschile e femminile`,
 * or nothing when the heading shows none. A shared link's card shows it
 * (web/lib/dictionary/card.ts), so the two never disagree.
 */
export function headingGender(reading: Reading): string | undefined {
  if (!inflects(reading)) return undefined;
  const genders = gendersOf(reading.grammar.record).map((gender) => GENDER_LABEL[gender]);
  return genders.length === 0 ? undefined : both(genders);
}
