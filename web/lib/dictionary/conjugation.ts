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
// A declared lemma's forms (#453) carry no tags: each is placed by the slot its
// gloss names (`it-verb-form-gloss/v1`, src/italian/verbFormGloss.ts), into the
// same grid.

import { sourcePointerOf, type DeclaredForm, type DeclaredVerbForm, type SearchedSpellings, type SourceForm } from "@lexema/lookup/types.ts";
import { placeItalianVerbForm, type TenseBox, type VerbSlot } from "@lexema/italian/moods.ts";
import type { GlossNumber, GlossPerson, VerbFormGloss } from "@lexema/italian/verbFormGloss.ts";

export const MOODS = ["Indicativo", "Congiuntivo", "Condizionale", "Imperativo"] as const;
export type Mood = (typeof MOODS)[number];

export const PERSONS = ["io", "tu", "lui, lei", "noi", "voi", "loro"] as const;
export type Person = (typeof PERSONS)[number];

/** Where each tense box of `it-moods/v1` sits on the page, and its Italian name there. */
const TENSE_PLACE: Record<TenseBox, { mood: Mood; tense: string; compound: boolean }> = {
  presente: { mood: "Indicativo", tense: "presente", compound: false },
  imperfetto: { mood: "Indicativo", tense: "imperfetto", compound: false },
  "passato remoto": { mood: "Indicativo", tense: "passato remoto", compound: false },
  "futuro semplice": { mood: "Indicativo", tense: "futuro semplice", compound: false },
  "passato prossimo": { mood: "Indicativo", tense: "passato prossimo", compound: true },
  "trapassato prossimo": { mood: "Indicativo", tense: "trapassato prossimo", compound: true },
  "trapassato remoto": { mood: "Indicativo", tense: "trapassato remoto", compound: true },
  "futuro anteriore": { mood: "Indicativo", tense: "futuro anteriore", compound: true },
  "congiuntivo presente": { mood: "Congiuntivo", tense: "presente", compound: false },
  "congiuntivo imperfetto": { mood: "Congiuntivo", tense: "imperfetto", compound: false },
  "congiuntivo passato": { mood: "Congiuntivo", tense: "passato", compound: true },
  "congiuntivo trapassato": { mood: "Congiuntivo", tense: "trapassato", compound: true },
  "condizionale presente": { mood: "Condizionale", tense: "presente", compound: false },
  "condizionale passato": { mood: "Condizionale", tense: "passato", compound: true },
};

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

/** The pronoun the source writes beside a finite form, to the person it names. */
const PRONOUN_PERSON: Record<string, Person> = {
  io: "io",
  tu: "tu",
  "lui/lei": "lui, lei",
  noi: "noi",
  voi: "voi",
  "essi/esse": "loro",
  "che io": "io",
  "che tu": "tu",
  "che lui/che lei": "lui, lei",
  "che noi": "noi",
  "che voi": "voi",
  "che essi/che esse": "loro",
};

const TAGGED_PERSON: Record<string, Person> = {
  "first-person singular": "io",
  "second-person singular": "tu",
  "third-person singular": "lui, lei",
  "first-person plural": "noi",
  "second-person plural": "voi",
  "third-person plural": "loro",
};

/** A form a table can hold: a record's own `forms[]` entry, or a declared lemma's form record. */
export type TableForm = SourceForm | DeclaredForm;

/** Whether a table's form is a record's own `forms[]` entry, which alone has an index there. */
export const isSourceForm = (form: TableForm): form is SourceForm => "index" in form;

/** One cell: every spelling the source files there, in source order. */
export interface Cell<F extends TableForm = SourceForm> {
  forms: F[];
  searched: boolean;
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

/** A form's own tags and raw tags, recovered from its claims by pointer. */
export function sourceTagsOf(form: SourceForm): { tags: string[]; rawTags: string[] } {
  const tags: string[] = [];
  const rawTags: string[] = [];
  for (const claim of form.claims) {
    if (claim.status === "missing") continue;
    // A form a raw page writes out states its tags and nothing else (src/italian/pageFacts.ts).
    const pointer = sourcePointerOf(claim.ref);
    if (pointer === undefined || /\/tags\/\d+$/.test(pointer)) tags.push(claim.sourceText);
    else if (/\/raw_tags\/\d+$/.test(pointer)) rawTags.push(claim.sourceText);
  }
  return { tags, rawTags };
}

export const slotOf = (form: SourceForm): VerbSlot => placeItalianVerbForm(sourceTagsOf(form));

/** The person a finite form is, by its person and number tags, else its one pronoun. */
function personOf(form: SourceForm): Person | undefined {
  const { tags, rawTags } = sourceTagsOf(form);
  const person = tags.find((tag) => tag.endsWith("-person"));
  const number = tags.find((tag) => tag === "singular" || tag === "plural");
  if (person !== undefined && number !== undefined) return TAGGED_PERSON[`${person} ${number}`];
  return rawTags.length === 1 ? PRONOUN_PERSON[rawTags[0]] : undefined;
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
  const { mood, tense } = TENSE_PLACE[slot.box];
  return { kind: "finite", mood, tense, person };
}

const GLOSS_PERSON: Record<`${GlossPerson} ${GlossNumber}`, Person> = {
  "first singular": "io",
  "second singular": "tu",
  "third singular": "lui, lei",
  "first plural": "noi",
  "second plural": "voi",
  "third plural": "loro",
};

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
    case "finite": {
      const { mood, tense } = TENSE_PLACE[slot.tense];
      return { kind: "finite", mood, tense, person: GLOSS_PERSON[`${slot.person} ${slot.number}`] };
    }
    case "imperative":
      return { kind: "finite", mood: "Imperativo", tense: "presente", person: GLOSS_PERSON[`${slot.person} ${slot.number}`] };
    case "gerund":
      return { kind: "non-finite", label: "gerundio" };
    case "present-participle":
      return slot.number === "plural" ? undefined : { kind: "non-finite", label: "participio presente" };
    case "past-participle":
      return slot.gender === "feminine" || slot.number === "plural" ? undefined : { kind: "non-finite", label: "participio" };
  }
}

const isCompound = (mood: Mood, tense: string): boolean =>
  Object.values(TENSE_PLACE).some((place) => place.mood === mood && place.tense === tense && place.compound);

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
      const cells = persons.map((person) => {
        const spelled = tenses.get(name)?.get(person) ?? [];
        return { forms: spelled, searched: spelled.some(hit) };
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
