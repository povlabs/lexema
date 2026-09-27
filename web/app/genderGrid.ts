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
//   lists `fini` tagged plural), the form's gender is not guessed: it is
//   unplaced, under "Gender not given".
// - The headword sits in every number its record states (`khmer` is tagged
//   singular and plural, so it fills both), and, as the citation form, in the
//   singolare column when its record states no usable number (`andare` the
//   noun, `bello` invariable).
// - A form with a degree other than positive is a comparison, not an agreement
//   cell: a superlative goes to the superlativo grid, anything else to
//   `unplaced`.
// - Whatever takes no cell is `unplaced`, verbatim, grouped by what it lacks.
//   Layout never drops a form.
//
// Each spelling's articles are `it-articles/v1` (src/italian/articles.ts),
// applied to it with the cell's gender and number, exactly as it stands; a cell
// with two spellings (`oli`, `olii`) gives each its own line. Where the rule refuses (a phrase, a spelling it does not handle) the
// cell has no article line.

import { isAdjectiveReading, isNounReading } from "@lexema/lookup/types.ts";
import type { GrammarClaim, Reading, SourceForm } from "@lexema/lookup/types.ts";
import { generateItalianArticles } from "@lexema/italian/articles.ts";
import { groupUnplaced, type Missing, type UnplacedGroup } from "./unplaced.ts";

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
  unplaced: UnplacedGroup[];
}

function statedValues(claims: readonly GrammarClaim[], dimension: string): string[] {
  const values: string[] = [];
  for (const claim of claims) {
    if (claim.status === "stated" && claim.dimension === dimension && !values.includes(claim.value)) {
      values.push(claim.value);
    }
  }
  return values;
}

const gendersOf = (claims: readonly GrammarClaim[]): Gender[] =>
  GENDERS.filter((gender) => statedValues(claims, "gender").includes(gender));

/** Every agreeing number the claims state, in NUMBERS order. */
const numbersOf = (claims: readonly GrammarClaim[]): GrammaticalNumber[] =>
  NUMBERS.filter((number) => statedValues(claims, "number").includes(number));

function numberOf(claims: readonly GrammarClaim[]): GrammaticalNumber | undefined {
  const numbers = NUMBERS.filter((number) => statedValues(claims, "number").includes(number));
  return numbers.length === 1 ? numbers[0] : undefined;
}

const degreesOf = (form: SourceForm): string[] =>
  statedValues(form.claims, "degree").filter((degree) => degree !== "positive");

/** Definite, then indefinite (singular) or partitive (plural): the grid's article line. */
function articleLine(surface: string, gender: Gender, number: GrammaticalNumber): string[] {
  const { articles } = generateItalianArticles(surface, gender, number);
  const second = number === "singular" ? "indefinite" : "partitive";
  return (["definite", second] as const).flatMap((kind) =>
    articles.filter((article) => article.kind === kind).map((article) => article.displayForm),
  );
}

class GridBuilder {
  private readonly cells = new Map<string, Spelling[]>();

  put(gender: Gender, number: GrammaticalNumber, entry: SourceForm | "headword", surface: string): void {
    const key = `${gender} ${number}`;
    const spellings = this.cells.get(key) ?? [];
    let spelling = spellings.find((existing) => existing.surface === surface);
    if (spelling === undefined) {
      spelling = { surface, headword: false, forms: [] };
      spellings.push(spelling);
    }
    if (entry === "headword") spelling.headword = true;
    else spelling.forms.push(entry);
    this.cells.set(key, spellings);
  }

  get size(): number {
    return this.cells.size;
  }

  build(): Grid | undefined {
    const rows = GENDERS.flatMap((gender): GridRow[] => {
      if (!NUMBERS.some((number) => this.cells.has(`${gender} ${number}`))) return [];
      const cell = (number: GrammaticalNumber): GridCell => {
        const spellings = this.cells.get(`${gender} ${number}`) ?? [];
        return {
          spellings: spellings.map((spelling) => ({ ...spelling, articles: articleLine(spelling.surface, gender, number) })),
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

export function agreementOf(reading: Reading): Agreement {
  const plain = new GridBuilder();
  const superlative = new GridBuilder();
  const unplaced: { form: SourceForm; missing: Missing }[] = [];
  const recordGenders = gendersOf(reading.grammar.record);

  const stated = numbersOf(reading.grammar.record);
  const headwordNumbers: GrammaticalNumber[] =
    !inflects(reading) ? []
    : reading.lemmaLinks.length === 0 ? (stated.length > 0 ? stated : ["singular"])
    // A form reading with a table of its own (`bella`) is placed in it too.
    : reading.forms.length > 0 ? stated
    : [];
  for (const number of headwordNumbers) {
    for (const gender of recordGenders) plain.put(gender, number, "headword", reading.word);
  }

  for (const form of reading.forms) {
    const degrees = degreesOf(form);
    const target = degrees.length === 0 ? plain : degrees.includes("superlative") ? superlative : undefined;
    const own = gendersOf(form.claims);
    const genders = own.length > 0 ? own : recordGenders.length === 1 ? recordGenders : [];
    const number = numberOf(form.claims);
    if (target === undefined || genders.length === 0 || number === undefined) {
      const missing: Missing =
        genders.length === 0 && number === undefined
          ? "gender and number not given"
          : number === undefined
            ? "number not given"
            : genders.length === 0
              ? "gender not given"
              : "comparison not in the grid";
      unplaced.push({ form, missing });
      continue;
    }
    for (const gender of genders) target.put(gender, number, form, form.surface);
  }

  return { grid: plain.build(), superlative: superlative.build(), unplaced: groupUnplaced(unplaced) };
}
