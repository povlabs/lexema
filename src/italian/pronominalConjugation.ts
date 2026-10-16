// A pronominal verb's conjugation, built from its base verb's table by rule
// `it-pronominal-conjugation/v1` (#837).
//
// Most pronominal verbs (`trasferirsi`, `alzarsi`, `andarsene`) have a record
// with no forms: the source gives their meanings, and the table only under the
// base verb (`trasferire`), whose first form is the link `trasferirsi
// (coniugazione)`. Italian builds the pronominal table from the base one by a
// fixed rule, and this file is that rule. It reads one base cell at a time, as
// the source tagged it, and writes the pronominal spelling of the same cell:
//
//   simple tense     trasferisco          mi trasferisco      (pronoun before the verb)
//   compound tense   ho alzato            mi sono alzato      (essere, the participle agreeing in number)
//                    abbiamo alzato       ci siamo alzati
//   gerund           alzando              alzandosi           (pronoun attached)
//   participles      alzante, alzato      alzantesi, alzatosi
//   imperative       alza, alziamo        alzati, alziamoci   (tu, noi, voi: attached)
//                    alzi, alzino         si alzi, si alzino  (lui, loro: before the verb)
//                    non alzare           non alzarti
//   auxiliary        avere                essere
//
// A verb in `-rsene` takes `me ne, te ne, se ne, ce ne, ve ne, se ne` before
// the verb and `-tene, -cene, -vene, -sene` attached: `me ne vado`, `me ne
// sono andato`, `andiamocene`. A short `tu` imperative (`va'`, `fa'`, `da'`)
// doubles the pronoun's consonant, `vattene`, `fatti`, `datti`; where its
// cell holds one, the cell's other spellings (`va`, `vai`) are the indicative
// or a plain spelling of it, and take no pronoun.
//
// What the rule does not build, it leaves out, and a caller shows no cell for
// it: a spelling of a shape it does not read (a compound that is not one
// auxiliary and one participle, a participle not in `-o` or `-i`), an
// unplaced form, the infinitive link `alzarsi (coniugazione)`. The participle
// stays masculine, as the source writes it; the feminine is
// `it-essere-agreement/v2`'s, which the table applies to every compound cell
// alike (#676).
//
// Every spelling is Lexema's, built when the page is built and never stored
// (ADR 0012); the page shows no mark for it (ADR 0016), and the cell it was
// built from travels with it. Which base verb a pronominal verb takes is
// `pronominalVerb`'s answer below; whether a page draws the table is the
// page's call (web/lib/dictionary/wordPage.ts).

import { personOfItalianVerbForm, placeItalianVerbForm, type FinitePerson, type TenseBox, type VerbFormTags } from "./moods.js";

/** The rule's name and version. */
export const PRONOMINAL_CONJUGATION_RULE = "it-pronominal-conjugation/v1" as const;

/** How a pronominal verb ends: `-rsi` (`alzarsi`) or `-rsene` (`andarsene`). */
export type PronominalEnding = "si" | "sene";

/**
 * A pronominal verb: its word, how it ends, its stem (the word without `si` or
 * `sene`, `alzar`, `andar`), and the base verbs its table may come from, in
 * the order they are tried.
 */
export interface PronominalVerb {
  readonly word: string;
  readonly ending: PronominalEnding;
  readonly stem: string;
  /** `alzare`; `trarre` after `trare` for `trarsi`; `porre` for `porsi`; `ridurre` for `ridursi`. */
  readonly bases: readonly [string, ...string[]];
}

/** One word of lower-case letters ending in `-rsi` or `-rsene`, with at least one letter before the `r`. */
const PRONOMINAL = /^(\p{Ll}+r)(si|sene)$/u;

/**
 * The pronominal verb `word` is, or undefined when it is not one. The base is
 * the stem with its infinitive ending back: `-arsi` → `-are`, `-ersi` →
 * `-ere`, `-irsi` → `-ire`, `-orsi` → `-orre`, `-ursi` → `-urre`, and `-arsi`
 * may also be `-arre` (`distrarsi`, `distrarre`); `-rsene` the same.
 */
export function pronominalVerb(word: string): PronominalVerb | undefined {
  const match = PRONOMINAL.exec(word);
  if (match === null) return undefined;
  const [, stem, ending] = match;
  const vowel = stem.at(-2);
  const bases: [string, ...string[]] =
    vowel === "o" || vowel === "u" ? [`${stem}re`] : vowel === "a" ? [`${stem}e`, `${stem}re`] : [`${stem}e`];
  return { word, ending: ending as PronominalEnding, stem, bases };
}

/** One base cell as the source gives it: its spelling, and its tags as `it-moods/v1` reads them. */
export interface BaseCell extends VerbFormTags {
  spelling: string;
}

type Row = `${FinitePerson["person"]} ${FinitePerson["number"]}`;

/** The pronoun before a finite form, by row: `mi alzo`, `me ne vado`. */
const BEFORE: Readonly<Record<PronominalEnding, Readonly<Record<Row, string>>>> = {
  si: {
    "first singular": "mi",
    "second singular": "ti",
    "third singular": "si",
    "first plural": "ci",
    "second plural": "vi",
    "third plural": "si",
  },
  sene: {
    "first singular": "me ne",
    "second singular": "te ne",
    "third singular": "se ne",
    "first plural": "ce ne",
    "second plural": "ve ne",
    "third plural": "se ne",
  },
};

/** The pronoun attached to an imperative, by the rows that attach it: `alzati`, `alziamoci`, `andatevene`. */
const ATTACHED: Readonly<Record<PronominalEnding, Readonly<Partial<Record<Row, string>>>>> = {
  si: { "second singular": "ti", "first plural": "ci", "second plural": "vi" },
  sene: { "second singular": "tene", "first plural": "cene", "second plural": "vene" },
};

/** The pronoun attached to a gerund or participle: `alzandosi`, `andandosene`. */
const NON_FINITE: Readonly<Record<PronominalEnding, string>> = { si: "si", sene: "sene" };

/**
 * The form of essere a compound tense is built on, by tense and row: essere's
 * simple tense the compound one is made of (`passato prossimo` on `presente`).
 * test/pronominalConjugation.test.ts asserts each against essere's own record
 * in fixtures/dev-seed.jsonl.
 */
export const ESSERE_OF: Readonly<Partial<Record<TenseBox, readonly [string, string, string, string, string, string]>>> = {
  "passato prossimo": ["sono", "sei", "è", "siamo", "siete", "sono"],
  "trapassato prossimo": ["ero", "eri", "era", "eravamo", "eravate", "erano"],
  "trapassato remoto": ["fui", "fosti", "fu", "fummo", "foste", "furono"],
  "futuro anteriore": ["sarò", "sarai", "sarà", "saremo", "sarete", "saranno"],
  "condizionale passato": ["sarei", "saresti", "sarebbe", "saremmo", "sareste", "sarebbero"],
  "congiuntivo passato": ["sia", "sia", "sia", "siamo", "siate", "siano"],
  "congiuntivo trapassato": ["fossi", "fossi", "fosse", "fossimo", "foste", "fossero"],
};

const ROWS: readonly Row[] = ["first singular", "second singular", "third singular", "first plural", "second plural", "third plural"];

/** What joins the spellings of one source cell: `siedo, seggo`, `ho assorbito, assorto`. */
const SPELLINGS = ", ";

/** A word of letters, the only shape a participle or a verb form here may have. */
const WORD = /^\p{L}+$/u;

/** A short `tu` imperative: `va'`, `fa'`, `di’`, or one ending in a stressed vowel, `dà`. */
const SHORT = /^(\p{L}+)(?:['’]|([àèéìòù]))$/u;

const UNSTRESSED: Readonly<Record<string, string>> = { à: "a", è: "e", é: "e", ì: "i", ò: "o", ù: "u" };

const rowOf = (cell: BaseCell): Row | undefined => {
  const row = personOfItalianVerbForm(cell);
  return row === undefined ? undefined : `${row.person} ${row.number}`;
};

/** Each spelling of a cell, built by `build`, or undefined when any one of them cannot be. */
function eachSpelling(spelling: string, build: (one: string, index: number) => string | undefined): string | undefined {
  const built: string[] = [];
  for (const [index, one] of spelling.split(SPELLINGS).entries()) {
    const out = build(one, index);
    if (out === undefined) return undefined;
    built.push(out);
  }
  return built.join(SPELLINGS);
}

/** A participle agreeing with a row of `number`, still masculine: `alzato` on a plural row is `alzati`. */
function agreeing(participle: string, plural: boolean): string | undefined {
  if (!WORD.test(participle) || !/[oi]$/u.test(participle)) return undefined;
  return `${participle.slice(0, -1)}${plural ? "i" : "o"}`;
}

/** A compound cell on essere: `ho alzato` → `mi sono alzato`; a later bare participle agrees too (`assorto`). */
function compound(verb: PronominalVerb, box: TenseBox, row: Row, spelling: string): string | undefined {
  const essere = ESSERE_OF[box]?.[ROWS.indexOf(row)];
  if (essere === undefined) return undefined;
  const plural = row.endsWith("plural");
  return eachSpelling(spelling, (one, index) => {
    const words = one.split(" ");
    if (index === 0) {
      if (words.length !== 2) return undefined;
      const participle = agreeing(words[1], plural);
      return participle === undefined ? undefined : `${BEFORE[verb.ending][row]} ${essere} ${participle}`;
    }
    return words.length === 1 ? agreeing(one, plural) : undefined;
  });
}

/** A form with the pronoun attached: `alza` + `ti`; a short one doubles it, `va'` + `tene` → `vattene`. */
function attached(form: string, pronoun: string): string | undefined {
  const short = SHORT.exec(form);
  if (short !== null) return `${short[1]}${short[2] === undefined ? "" : UNSTRESSED[short[2]]}${pronoun[0]}${pronoun}`;
  return WORD.test(form) ? `${form}${pronoun}` : undefined;
}

/**
 * The `tu` imperative cell, whose spellings the source files one per form:
 * `alza`, `non alzare`. The negative takes the pronoun on the infinitive,
 * `non alzarti`, `non andartene`. Where the cell holds a short spelling, only
 * the short ones take it (`va'` → `vattene`, and `va`, `vai` none).
 */
function tuImperative(verb: PronominalVerb, spelling: string, cell: readonly string[]): string | undefined {
  const pronoun = ATTACHED[verb.ending]["second singular"] as string;
  if (spelling.startsWith("non ")) return `non ${verb.stem}${pronoun}`;
  const hasShort = cell.some((one) => SHORT.test(one));
  const taking = spelling.split(SPELLINGS).filter((one) => !hasShort || SHORT.test(one));
  return taking.length === 0 ? undefined : eachSpelling(taking.join(SPELLINGS), (one) => attached(one, pronoun));
}

/**
 * The pronominal spelling of each base cell, in the order given; undefined
 * where the rule builds none. `cells` are the base verb's forms, in source
 * order: the `tu` imperative reads its row's other spellings.
 */
export function pronominalSpellings(verb: PronominalVerb, cells: readonly BaseCell[]): (string | undefined)[] {
  const tuCell = cells.filter((cell) => placeItalianVerbForm(cell).kind === "imperative" && rowOf(cell) === "second singular");
  const tuSpellings = tuCell.flatMap((cell) => cell.spelling.split(SPELLINGS));
  return cells.map((cell) => {
    const slot = placeItalianVerbForm(cell);
    switch (slot.kind) {
      case "auxiliary":
        return "essere";
      case "non-finite":
        if (slot.role === "infinito" || slot.role === "participio") return undefined;
        return eachSpelling(cell.spelling, (one) => (WORD.test(one) ? `${one}${NON_FINITE[verb.ending]}` : undefined));
      case "tense": {
        const row = rowOf(cell);
        if (row === undefined) return undefined;
        if (ESSERE_OF[slot.box] !== undefined) return compound(verb, slot.box, row, cell.spelling);
        return eachSpelling(cell.spelling, (one) => (WORD.test(one) ? `${BEFORE[verb.ending][row]} ${one}` : undefined));
      }
      case "imperative": {
        const row = rowOf(cell);
        if (row === undefined) return undefined;
        if (row === "second singular") return tuImperative(verb, cell.spelling, tuSpellings);
        const pronoun = ATTACHED[verb.ending][row];
        if (pronoun !== undefined) return eachSpelling(cell.spelling, (one) => attached(one, pronoun));
        return eachSpelling(cell.spelling, (one) => (WORD.test(one) ? `${BEFORE[verb.ending][row]} ${one}` : undefined));
      }
      case "unplaced":
        return undefined;
    }
  });
}
