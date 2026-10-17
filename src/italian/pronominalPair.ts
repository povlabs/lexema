// The pronominal verb a reflexive pronoun + verb pair is said with, by rule
// `it-pronominal-pair/v2` (#810, #834).
//
// Italian says a pronominal verb's finite forms with the reflexive pronoun
// before the verb: `trasferirsi` is said `mi trasferisco`, `ti trasferisci`,
// `si trasferisce`, `ci trasferiamo`, `vi trasferite`, `si trasferiscono`.
// The source lists such forms under the plain verb's table (`trasferisco` is
// a cell of trasferire's), and the pronominal verb's own record lists none.
// This rule reads a query of a reflexive pronoun and one word, the verb forms
// that word spells, and names the pronominal infinitive each verb gives:
//
//   mi trasferisco    trasferisco    trasferire  trasferirsi
//   si pone           pone           porre       porsi
//
// The pronoun agrees with the subject, so it takes only the forms of its own
// person and number: `mi` the first singular, `ti` the second singular, `ci`
// the first plural, `vi` the second plural, `si` the third, singular or
// plural (the impersonal `si` takes the third person too). `mi piace`, `ti
// amo` and `mi dai` are no pair: the pronoun and the verb's person differ.
// Only a simple tense's form is read: the indicative's, the subjunctive's and
// the conditional's. An imperative takes its pronoun after it (`alzati`), and
// a compound tense is more than one word.
//
// A verb form is read wherever the lookup knows it:
//
//   cell              a cell of a verb record's table, as the source tags it
//   corrected-cell    a cell's curated spelling (#743), with that cell's tags
//   form-of           a verb record that is a form of another verb, by the slot
//                     its gloss names (`it-verb-form-gloss/v1`)
//   conjugated        a regular form of a verb whose record lists no forms, as
//                     rule `it-word-shape/v1`'s `conjugated` shape reads it
//   regular-table     a cell of the regular table `it-regular-conjugation/v1`
//                     builds for the pronominal verb's page (#838)
//   hand-kept-table   a cell of the pronominal verb's hand-kept table (#844)
//
// The last three are checked against the dictionary before they count: a
// `conjugated` form only where the verb's record lists no forms, a built
// table's only where the page builds that table (`builtBaseOf`). The pair
// answers only where the dictionary has the pronominal infinitive as a verb's
// headword that is not itself a form of another word: the rule names a
// spelling, and the dictionary says whether that word exists.
//
// `ci` and `vi` are also locative pronouns (`ci andiamo`, "we go there"), and
// the person does not tell the two apart. The rule still answers only a
// pronominal verb the dictionary has, so `ci andiamo` answers only if
// `andarsi` is a headword.
//
// The rule runs only on a query nothing else answers, so it never changes a
// word the dictionary has. Nothing derived is stored: the rule reads the
// query at lookup time.

import { builtBaseOf } from "./builtBase.js";
import { HAND_KEPT_TABLES, handKeptCells } from "./handKeptTables.js";
import { personOfItalianVerbForm, placeItalianVerbForm, TENSE_NAMES, type FinitePerson, type VerbFormTags } from "./moods.js";
import { pronominalVerb } from "./pronominalConjugation.js";
import { classParadigm, infinitiveOf, namesOnlyAnotherWord, paradigmCells, type ConjugationClass, type Paradigm } from "./regularConjugation.js";
import { readVerbFormGloss } from "./verbFormGloss.js";
import { shapeAdmits } from "./wordShape.js";

/** The rule's name and version. */
export const PRONOMINAL_PAIR_RULE = "it-pronominal-pair/v2" as const;

/** A reflexive pronoun, the first word of a pair. */
export type ReflexivePronoun = "mi" | "ti" | "ci" | "vi" | "si";

/** The rows of a conjugation each pronoun is said with. */
const ROWS: Readonly<Record<ReflexivePronoun, readonly FinitePerson[]>> = {
  mi: [{ person: "first", number: "singular" }],
  ti: [{ person: "second", number: "singular" }],
  ci: [{ person: "first", number: "plural" }],
  vi: [{ person: "second", number: "plural" }],
  si: [
    { person: "third", number: "singular" },
    { person: "third", number: "plural" },
  ],
};

const isReflexive = (word: string): word is ReflexivePronoun => Object.hasOwn(ROWS, word);

/** Whether `pronoun` is said with a form of `row`: `mi` with the first singular. */
export const takesRow = (pronoun: ReflexivePronoun, row: FinitePerson): boolean =>
  ROWS[pronoun].some(({ person, number }) => person === row.person && number === row.number);

/** Letters only, the shape of one word. */
const WORD = /^\p{L}+$/u;

/** What joins the spellings one cell holds: `siedo, seggo`. */
const SPELLINGS = ", ";

/** A query the rule reads as a pair: a reflexive pronoun and one word, the verb form, as an index key. */
export interface PairQuery {
  readonly rule: typeof PRONOMINAL_PAIR_RULE;
  readonly pronoun: ReflexivePronoun;
  /** The verb form as the query spells it: `trasferisco`. */
  readonly form: string;
}

/** The pair `key` spells, or undefined when it is not a reflexive pronoun and one word. */
export function pairQueryOf(key: string): PairQuery | undefined {
  const words = key.split(" ");
  if (words.length !== 2) return undefined;
  const [pronoun, form] = words;
  if (!isReflexive(pronoun) || !WORD.test(form)) return undefined;
  return { rule: PRONOMINAL_PAIR_RULE, pronoun, form };
}

/** Where the rule read a verb form (see the table above). */
export type FormSource = "cell" | "corrected-cell" | "form-of" | "conjugated" | "regular-table" | "hand-kept-table";

/** A verb form the dictionary knows: the verb it is a form of, the row it fills, and where it was read. */
export interface KnownForm {
  readonly verb: string;
  readonly row: FinitePerson;
  readonly from: FormSource;
}

/**
 * The row a table cell fills, when it is a simple tense's: the indicative's,
 * the subjunctive's or the conditional's, as `it-moods/v1` places it.
 * Undefined for an imperative, a non-finite form, a compound tense, and a
 * cell it does not place.
 */
export function rowOfCell(cell: VerbFormTags): FinitePerson | undefined {
  const slot = placeItalianVerbForm(cell);
  if (slot.kind !== "tense" || TENSE_NAMES[slot.box].compound) return undefined;
  return personOfItalianVerbForm(cell);
}

/**
 * The row a form-of record's gloss says it fills in `verb`'s conjugation, when
 * it names a simple tense's: "prima persona singolare dell'indicativo presente
 * di accertare". Undefined for any other gloss.
 */
export function rowOfFormGloss(gloss: string, verb: string): FinitePerson | undefined {
  const slot = readVerbFormGloss(gloss, verb);
  return slot?.kind === "finite" ? { person: slot.person, number: slot.number } : undefined;
}

/**
 * The pronominal infinitive of an infinitive: its final `-e` turned to `si`
 * (`trasferire` → `trasferirsi`), or an infinitive in `-rre` its `-re`
 * (`porre` → `porsi`, `condurre` → `condursi`). A word that is already a
 * pronominal infinitive gives itself. Undefined for a word that is no
 * infinitive.
 */
export function pronominalInfinitiveOf(word: string): string | undefined {
  if (!WORD.test(word)) return undefined;
  if (/rsi$/u.test(word)) return word;
  if (/rre$/u.test(word)) return `${word.slice(0, -2)}si`;
  if (/[aeiou]re$/u.test(word)) return `${word.slice(0, -1)}si`;
  return undefined;
}

/**
 * The second conjugation's simple endings, as rule `it-word-shape/v1`'s
 * `conjugated` shape reads them: `it-regular-conjugation/v1` builds no table
 * of this class, and the shape still reads `annette` as a form of
 * `annettere`.
 */
const SECOND: Paradigm = {
  infinitive: "ere",
  gerund: "endo",
  presentParticiple: "ente",
  pastParticiple: "uto",
  present: ["o", "i", "e", "iamo", "ete", "ono"],
  imperfect: ["evo", "evi", "eva", "evamo", "evate", "evano"],
  pastRemote: ["ei, etti", "esti", "é, ette", "emmo", "este", "erono, ettero"],
  future: ["erò", "erai", "erà", "eremo", "erete", "eranno"],
  conditional: ["erei", "eresti", "erebbe", "eremmo", "ereste", "erebbero"],
  subjunctive: ["a", "a", "a", "iamo", "iate", "ano"],
  subjunctiveImperfect: ["essi", "essi", "esse", "essimo", "este", "essero"],
  imperative: ["i", "a", "iamo", "ete", "ano"],
};

/** A class a form is read in: one `it-regular-conjugation/v1` builds, or the second conjugation. */
type ReadClass = ConjugationClass | "ere";

const CLASSES: readonly ConjugationClass[] = ["are", "care", "gare", "ciare", "giare", "iare", "ire", "ire-b"];

/** One ending of a simple tense, and the row it fills. */
interface PersonalEnding {
  ending: string;
  row: FinitePerson;
}

/** Each simple tense's spellings of a table, with the row each fills. */
const personalEndings = (paradigm: Paradigm): PersonalEnding[] =>
  paradigmCells(paradigm).flatMap((cell) => {
    const row = rowOfCell(cell);
    return row === undefined ? [] : cell.spelling.split(SPELLINGS).map((ending) => ({ ending, row }));
  });

/** Every class's endings, read off the tables they write on an empty stem. */
const ENDINGS: readonly (readonly [ReadClass, readonly PersonalEnding[]])[] = [
  ...CLASSES.map((one) => [one, personalEndings(classParadigm(one, ""))] as const),
  ["ere", personalEndings(SECOND)] as const,
];

/** A stem keeps a vowel and two letters at least, as the `conjugated` shape's does. */
const STEM = /[aeiouàèéìòù]/u;

/** A regular reading of the pair's form: the class, the infinitive it is a form of, and the row it fills. */
interface RegularReading {
  readClass: ReadClass;
  infinitive: string;
  row: FinitePerson;
}

/** Each regular reading of `query`'s form in a row its pronoun takes. */
function regularReadings(query: PairQuery): RegularReading[] {
  return ENDINGS.flatMap(([readClass, endings]) =>
    endings.flatMap(({ ending, row }): RegularReading[] => {
      if (!takesRow(query.pronoun, row) || !query.form.endsWith(ending)) return [];
      const stem = query.form.slice(0, query.form.length - ending.length);
      if (stem.length < 2 || !STEM.test(stem)) return [];
      const infinitive = readClass === "ere" ? `${stem}ere` : infinitiveOf(readClass, stem);
      return infinitive === undefined ? [] : [{ readClass, infinitive, row }];
    }),
  );
}

/** The pronominal verbs whose hand-kept table spells a form, by spelling; built once. */
let handKeptBySpelling: ReadonlyMap<string, readonly string[]> | undefined;

function handKeptVerbsOf(form: string): readonly string[] {
  if (handKeptBySpelling === undefined) {
    const index = new Map<string, string[]>();
    for (const table of HAND_KEPT_TABLES.values()) {
      for (const cell of handKeptCells(table)) {
        if (rowOfCell(cell) === undefined) continue;
        for (const spelling of cell.spelling.split(SPELLINGS)) {
          const verbs = index.get(spelling) ?? [];
          if (!verbs.includes(table.verb)) index.set(spelling, [...verbs, table.verb]);
        }
      }
    }
    handKeptBySpelling = index;
  }
  return handKeptBySpelling.get(form) ?? [];
}

/**
 * A reading of the pair's form the dictionary has to confirm: a regular form
 * of `verb`, which counts where its record lists no forms, or a cell of the
 * table the page builds for the pronominal verb `key`.
 */
export type PairCandidate =
  | { readonly kind: "conjugated"; readonly verb: string; readonly row: FinitePerson }
  | { readonly kind: "built"; readonly key: string };

/** The readings of `query` to confirm, each once: the regular ones, then the built tables'. */
export function pairCandidates(query: PairQuery): PairCandidate[] {
  const regular = regularReadings(query);
  const built = [
    ...regular.flatMap(({ readClass, infinitive }) => {
      const key = readClass === "ere" ? undefined : pronominalInfinitiveOf(infinitive);
      return key === undefined ? [] : [key];
    }),
    ...handKeptVerbsOf(query.form),
  ];
  return [
    ...regular.map(({ infinitive, row }): PairCandidate => ({ kind: "conjugated", verb: infinitive, row })),
    ...[...new Set(built)].map((key): PairCandidate => ({ kind: "built", key })),
  ];
}

/** The keys whose verb records confirm `candidates`: each verb, each pronominal verb, and its base verbs. */
export function candidateKeysOf(candidates: readonly PairCandidate[]): string[] {
  return [
    ...new Set(
      candidates.flatMap((candidate) =>
        candidate.kind === "conjugated" ? [candidate.verb] : [candidate.key, ...(pronominalVerb(candidate.key)?.bases ?? [])],
      ),
    ),
  ];
}

/** What the rule reads of a verb record a key heads: whether it lists forms, and its glosses. */
export interface VerbHead {
  readonly listsForms: boolean;
  readonly glosses: readonly string[];
}

/**
 * The forms of `candidates` the dictionary confirms, with `headsOf` giving
 * the verb records a key heads, in source order. A `conjugated` reading counts
 * where the verb has a record that lists no forms, as the `conjugated` shape
 * admits it. A built table counts where the page
 * builds it: no record of the pronominal verb or of a base verb lists forms
 * (the page would build on those, and their cells are read as cells), and the
 * table `builtBaseOf` gives for the first record's glosses spells the form in
 * a row the pronoun takes.
 */
export function confirmedForms(query: PairQuery, candidates: readonly PairCandidate[], headsOf: (key: string) => readonly VerbHead[]): KnownForm[] {
  return candidates.flatMap((candidate): KnownForm[] => {
    if (candidate.kind === "conjugated") {
      const admits = headsOf(candidate.verb).some((head) => shapeAdmits("conjugated", { pos: "verb", plural: false, pastParticiple: false, listsForms: head.listsForms }));
      return admits ? [{ verb: candidate.verb, row: candidate.row, from: "conjugated" }] : [];
    }
    const verb = pronominalVerb(candidate.key);
    if (verb === undefined) return [];
    const heads = headsOf(verb.word);
    if ([verb.word, ...verb.bases].some((key) => headsOf(key).some((head) => head.listsForms))) return [];
    const built = builtBaseOf(verb, heads[0]?.glosses ?? []);
    if (built === undefined) return [];
    const from: FormSource = built.kind === "regular" ? "regular-table" : "hand-kept-table";
    return built.cells.flatMap((cell): KnownForm[] => {
      const row = rowOfCell(cell);
      return row !== undefined && cell.spelling.split(SPELLINGS).includes(query.form) ? [{ verb: built.base, row, from }] : [];
    });
  });
}

/**
 * A pair read as a pronominal verb: the pronoun and verb form typed, the verb
 * whose form it is, where that form was read, and the pronominal infinitive,
 * the key the dictionary is asked for.
 */
export interface PronominalPair {
  readonly rule: typeof PRONOMINAL_PAIR_RULE;
  readonly pronoun: ReflexivePronoun;
  /** The verb form as the query spells it: `trasferisco`. */
  readonly form: string;
  /** The verb whose form it is: `trasferire`. */
  readonly verb: string;
  /** Where the form was read: the first of `forms` that names this key. */
  readonly from: FormSource;
  /** The pronominal infinitive's index key: `trasferirsi`. */
  readonly key: string;
}

/**
 * The pronominal infinitives `query` may be: one for each verb with a form in
 * `forms` of a row the pronoun takes, each once, in the forms' order.
 */
export function pronominalPairs(query: PairQuery, forms: readonly KnownForm[]): PronominalPair[] {
  const pairs = new Map<string, PronominalPair>();
  for (const { verb, row, from } of forms) {
    if (!takesRow(query.pronoun, row)) continue;
    const key = pronominalInfinitiveOf(verb);
    if (key !== undefined && !pairs.has(key)) pairs.set(key, { rule: PRONOMINAL_PAIR_RULE, pronoun: query.pronoun, form: query.form, verb, from, key });
  }
  return [...pairs.values()];
}

/**
 * What the rule reads of a row the pronominal infinitive's key reaches: its
 * part of speech, whether the key is that row's headword, and the record's
 * glosses (none for a page-only entry or a hand-kept reading).
 */
export interface PronominalHead {
  pos: string;
  headword: boolean;
  glosses: readonly string[];
}

/**
 * Whether a row the pronominal infinitive reaches is that verb: a verb's
 * headword, never a table cell, and not a record whose every gloss says it is
 * a form of another word (`sporsi`, a form of `sporgere`).
 */
export const isPronominalVerb = ({ pos, headword, glosses }: PronominalHead): boolean => pos === "verb" && headword && !namesOnlyAnotherWord(glosses);
