// A verb's forms, laid out as the page's conjugation shape draws them: one line
// of non-finite forms, then one table per mood with persons down and tenses
// across, the compound tenses apart from the simple ones.
//
// Where a form goes is `placeItalianVerbForm` (src/italian/moods.ts): the mood
// is read from the shape of the source's row, never from a spelling. This file
// only turns that answer into the page's grid, with Italian labels (ADR 0015),
// and says which cells the query hit. A form with no cell (`parlarsi
// (coniugazione)`, the link to the reflexive verb) is not shown.
//
// A compound spelling built on essere is shown with both genders, `sono
// andato/a`, `siamo andati/e`, where `it-essere-agreement/v1`
// (src/italian/essereAgreement.ts) says it agrees (#676). The form stays the
// source's spelling and links to its own search; only the text shown changes.
//
// A declared lemma's forms (#453) carry no tags: each is placed by the slot its
// gloss names (`it-verb-form-gloss/v1`, src/italian/verbFormGloss.ts), into the
// same grid.

import { essereAgreement, type AgreeingSpelling } from "@lexema/italian/essereAgreement.ts";
import { sourcePointerOf, sourceTagsOf, type DeclaredForm, type DeclaredVerbForm, type SearchedSpellings, type SourceForm } from "@lexema/lookup/types.ts";
import {
  personOfItalianVerbForm,
  placeItalianVerbForm,
  TENSE_BOXES,
  TENSE_NAMES,
  type FiniteMood,
  type TenseBox,
  type VerbNumber,
  type VerbPerson,
  type VerbSlot,
} from "@lexema/italian/moods.ts";
import type { VerbFormGloss } from "@lexema/italian/verbFormGloss.ts";

export const MOODS = ["Indicativo", "Congiuntivo", "Condizionale", "Imperativo"] as const;
export type Mood = (typeof MOODS)[number];

export const PERSONS = ["io", "tu", "lui, lei", "noi", "voi", "loro"] as const;
export type Person = (typeof PERSONS)[number];

/** The tab each finite mood's tenses sit under. */
const MOOD_TAB: Record<FiniteMood, Mood> = {
  indicativo: "Indicativo",
  congiuntivo: "Congiuntivo",
  condizionale: "Condizionale",
};

/**
 * Where a tense box of `it-moods/v1` sits on the page: its tab, and the
 * Italian name `TENSE_NAMES` gives it, the one a searched form's line writes
 * (`it-verb-form-line/v1`, #627).
 */
const tensePlace = (box: TenseBox): { mood: Mood; tense: string } => ({
  mood: MOOD_TAB[TENSE_NAMES[box].mood],
  tense: TENSE_NAMES[box].tense,
});

/** The tense order within each mood, simple then compound. */
const TENSE_ORDER: Record<Mood, readonly string[]> = {
  Indicativo: [
    "presente",
    "imperfetto",
    "passato remoto",
    "futuro semplice",
    "passato prossimo",
    "trapassato prossimo",
    "trapassato remoto",
    "futuro anteriore",
  ],
  Congiuntivo: ["presente", "imperfetto", "passato", "trapassato"],
  Condizionale: ["presente", "passato"],
  Imperativo: ["presente"],
};

/** The row label of each person and number. */
const ROW: Record<`${VerbPerson} ${VerbNumber}`, Person> = {
  "first singular": "io",
  "second singular": "tu",
  "third singular": "lui, lei",
  "first plural": "noi",
  "second plural": "voi",
  "third plural": "loro",
};

/** The number of each row. */
const NUMBER_OF: Record<Person, VerbNumber> = {
  io: "singular",
  tu: "singular",
  "lui, lei": "singular",
  noi: "plural",
  voi: "plural",
  loro: "plural",
};

/** A form a table can hold: a record's own `forms[]` entry, or a declared lemma's form record. */
export type TableForm = SourceForm | DeclaredForm;

/** Whether a table's form is a record's own `forms[]` entry, which alone has an index there. */
export const isSourceForm = (form: TableForm): form is SourceForm => "index" in form;

const NONE_AGREE: ReadonlyMap<string, AgreeingSpelling> = new Map();

/** The spellings of a compound cell on a row of `number` that `it-essere-agreement/v1` says agree, by spelling. */
function agreeingOf(forms: readonly TableForm[], number: VerbNumber): ReadonlyMap<string, AgreeingSpelling> {
  const agreeing = new Map<string, AgreeingSpelling>();
  for (const { surface } of forms) {
    const read = essereAgreement(surface, number);
    if (read.kind === "agrees") agreeing.set(surface, read.spelling);
  }
  return agreeing.size === 0 ? NONE_AGREE : agreeing;
}

/** One cell: every spelling the source files there, in source order. */
export interface Cell<F extends TableForm = SourceForm> {
  forms: F[];
  searched: boolean;
  /**
   * The cell's spellings that agree with the subject's gender, keyed by the
   * source's spelling: the table shows `sono andato` as `sono andato/a`
   * (`it-essere-agreement/v1`, #676). Only a compound tense has any.
   */
  agreeing: ReadonlyMap<string, AgreeingSpelling>;
}

export interface Tense<F extends TableForm = SourceForm> {
  name: string;
  /** One entry per person of the mood's rows; an empty cell has no forms. */
  cells: Cell<F>[];
  searched: boolean;
}

export interface MoodTable<F extends TableForm = SourceForm> {
  mood: Mood;
  /** The rows every table of this mood has, in grammar order. */
  persons: Person[];
  /** Whether each row holds a searched form, in the order of `persons`. */
  searchedPersons: boolean[];
  simple: Tense<F>[];
  compound: Tense<F>[];
  /** The compound tenses hold the searched form, so they open with the page. */
  compoundSearched: boolean;
}

export type NonFiniteLabel = "infinito" | "gerundio" | "participio presente" | "participio" | "ausiliare";

export interface NonFinite<F extends TableForm = SourceForm> {
  label: NonFiniteLabel;
  forms: F[];
}

export interface Conjugation<F extends TableForm = SourceForm> {
  nonFinite: NonFinite<F>[];
  moods: MoodTable<F>[];
  /** The tab the table opens on: the searched form's mood, else Indicativo. */
  openMood: Mood | undefined;
}

/** Where one form goes: a finite cell, or a slot of the non-finite line. */
type Place = { kind: "finite"; mood: Mood; tense: string; person: Person } | { kind: "non-finite"; label: NonFiniteLabel };

/** A form a table can hold, and where it goes. */
interface Placed<F> {
  form: F;
  place: Place;
}

export const slotOf = (form: SourceForm): VerbSlot => placeItalianVerbForm(sourceTagsOf(form));

/** The row a finite form sits in, as `personOfItalianVerbForm` reads it. */
function personOf(form: SourceForm): Person | undefined {
  const row = personOfItalianVerbForm(sourceTagsOf(form));
  return row === undefined ? undefined : ROW[`${row.person} ${row.number}`];
}

/** Where a record's own form goes, or undefined when no cell takes it. */
function placeOf(form: SourceForm): Place | undefined {
  const slot = slotOf(form);
  if (slot.kind === "auxiliary") return { kind: "non-finite", label: "ausiliare" };
  if (slot.kind === "non-finite") {
    return { kind: "non-finite", label: slot.role === "participio passato" ? "participio" : slot.role };
  }
  if (slot.kind !== "imperative" && slot.kind !== "tense") return undefined;
  const person = personOf(form);
  if (person === undefined) return undefined;
  if (slot.kind === "imperative") return { kind: "finite", mood: "Imperativo", tense: "presente", person };
  return { kind: "finite", ...tensePlace(slot.box), person };
}

/**
 * Where a declared lemma's form goes, by the slot its gloss names. The
 * non-finite line holds the forms a verb's own table lists there: the gerund,
 * the present participle, and the past participle as the masculine singular.
 * A participle the gloss gives another gender or number (`verbalizzati`,
 * "participio passato maschile plurale") is an agreement form no cell holds,
 * so it is not shown.
 */
function placeOfGloss(slot: VerbFormGloss): Place | undefined {
  switch (slot.kind) {
    case "finite":
      return { kind: "finite", ...tensePlace(slot.tense), person: ROW[`${slot.person} ${slot.number}`] };
    case "imperative":
      return { kind: "finite", mood: "Imperativo", tense: "presente", person: ROW[`${slot.person} ${slot.number}`] };
    case "gerund":
      return { kind: "non-finite", label: "gerundio" };
    case "present-participle":
      return slot.number === "plural" ? undefined : { kind: "non-finite", label: "participio presente" };
    case "past-participle":
      return slot.gender === "feminine" || slot.number === "plural" ? undefined : { kind: "non-finite", label: "participio" };
  }
}

const isCompound = (mood: Mood, tense: string): boolean =>
  TENSE_BOXES.some((box) => TENSE_NAMES[box].compound && tensePlace(box).mood === mood && TENSE_NAMES[box].tense === tense);

const NON_FINITE_ORDER: NonFiniteLabel[] = ["infinito", "gerundio", "participio presente", "participio", "ausiliare"];

/** The page's grid of the placed forms, with the cells `hit` says the query reached. */
function layOut<F extends TableForm>(placed: readonly Placed<F>[], hit: (form: F) => boolean): Conjugation<F> {
  const grid = new Map<Mood, Map<string, Map<Person, F[]>>>();
  const nonFinite = new Map<NonFiniteLabel, F[]>();

  for (const { form, place } of placed) {
    if (place.kind === "non-finite") {
      nonFinite.set(place.label, [...(nonFinite.get(place.label) ?? []), form]);
      continue;
    }
    const tenses = grid.get(place.mood) ?? new Map<string, Map<Person, F[]>>();
    const cells = tenses.get(place.tense) ?? new Map<Person, F[]>();
    cells.set(place.person, [...(cells.get(place.person) ?? []), form]);
    tenses.set(place.tense, cells);
    grid.set(place.mood, tenses);
  }

  const moods: MoodTable<F>[] = MOODS.flatMap((mood) => {
    const tenses = grid.get(mood);
    if (tenses === undefined) return [];
    const persons = PERSONS.filter((person) => [...tenses.values()].some((cells) => cells.has(person)));
    const tense = (name: string): Tense<F> => {
      const compound = isCompound(mood, name);
      const cells = persons.map((person) => {
        const spelled = tenses.get(name)?.get(person) ?? [];
        return { forms: spelled, searched: spelled.some(hit), agreeing: compound ? agreeingOf(spelled, NUMBER_OF[person]) : NONE_AGREE };
      });
      return { name, cells, searched: cells.some((cell) => cell.searched) };
    };
    const named = TENSE_ORDER[mood].filter((name) => tenses.has(name)).map(tense);
    const searchedPersons = persons.map((_, i) => named.some((t) => t.cells[i].searched));
    const compound = named.filter((t) => isCompound(mood, t.name));
    return [
      {
        mood,
        persons,
        searchedPersons,
        simple: named.filter((t) => !isCompound(mood, t.name)),
        compound,
        compoundSearched: compound.some((t) => t.searched),
      },
    ];
  });

  const searchedMood = moods.find((table) => [...table.simple, ...table.compound].some((t) => t.searched));
  return {
    nonFinite: NON_FINITE_ORDER.flatMap((label) => {
      const spelled = nonFinite.get(label);
      return spelled === undefined ? [] : [{ label, forms: spelled }];
    }),
    moods,
    openMood: searchedMood?.mood ?? moods[0]?.mood,
  };
}

const placedBy = <F>(forms: readonly F[], place: (form: F) => Place | undefined): Placed<F>[] =>
  forms.flatMap((form) => {
    const where = place(form);
    return where === undefined ? [] : [{ form, place: where }];
  });

export function conjugationOf(forms: readonly SourceForm[], searched: SearchedSpellings): Conjugation {
  return layOut(placedBy(forms, placeOf), (form) => searched.formPointers.has(sourcePointerOf(form.ref) ?? ""));
}

/**
 * A declared lemma's conjugation: each form where its gloss places it. The
 * query is the lemma itself, which no cell holds, so no cell is marked.
 */
export function declaredConjugationOf(forms: readonly DeclaredVerbForm[]): Conjugation<DeclaredVerbForm> {
  return layOut(placedBy(forms, (form) => placeOfGloss(form.slot)), () => false);
}

/** Whether a conjugation places any form at all. */
export const placesAny = (conjugation: Conjugation<TableForm>): boolean =>
  conjugation.moods.length > 0 || conjugation.nonFinite.length > 0;
