// A verb's forms, laid out as the page's conjugation shape draws them: one line
// of non-finite forms, then one table per mood with persons down and tenses
// across, the compound tenses apart from the simple ones.
//
// Where a form goes is `placeItalianVerbForm` (src/italian/moods.ts): the mood
// is read from the shape of the source's row, never from a spelling. This file
// only turns that answer into the page's grid, with Italian labels (ADR 0015),
// and says which cells the query hit. Nothing is dropped: a form with no cell
// is in `unplaced`, verbatim.

import type { SearchedSpellings, SourceForm } from "@lexema/lookup/types.ts";
import { placeItalianVerbForm, type TenseBox, type VerbSlot } from "@lexema/italian/moods.ts";

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

/** One cell: every spelling the source files there, in source order. */
export interface Cell {
  forms: SourceForm[];
  searched: boolean;
}

export interface Tense {
  name: string;
  /** One entry per person of the mood's rows; an empty cell has no forms. */
  cells: Cell[];
  searched: boolean;
}

export interface MoodTable {
  mood: Mood;
  /** The rows every table of this mood has, in grammar order. */
  persons: Person[];
  /** Whether each row holds a searched form, in the order of `persons`. */
  searchedPersons: boolean[];
  simple: Tense[];
  compound: Tense[];
  /** The compound tenses hold the searched form, so they open with the page. */
  compoundSearched: boolean;
}

export interface NonFinite {
  label: "infinito" | "gerundio" | "participio presente" | "participio" | "ausiliare";
  forms: SourceForm[];
}

export interface Conjugation {
  nonFinite: NonFinite[];
  moods: MoodTable[];
  /** The tab the table opens on: the searched form's mood, else Indicativo. */
  openMood: Mood | undefined;
  /** Forms no cell and no non-finite slot takes, verbatim and in source order. */
  unplaced: SourceForm[];
}

/** A form's own tags and raw tags, recovered from its claims by pointer. */
export function sourceTagsOf(form: SourceForm): { tags: string[]; rawTags: string[] } {
  const tags: string[] = [];
  const rawTags: string[] = [];
  for (const claim of form.claims) {
    if (claim.status === "missing") continue;
    if (/\/raw_tags\/\d+$/.test(claim.ref.jsonPointer)) rawTags.push(claim.sourceText);
    else if (/\/tags\/\d+$/.test(claim.ref.jsonPointer)) tags.push(claim.sourceText);
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

/** Where a finite form goes, or undefined when it has no cell. */
function placeOf(form: SourceForm): { mood: Mood; tense: string; person: Person } | undefined {
  const slot = slotOf(form);
  const person = personOf(form);
  if (person === undefined) return undefined;
  if (slot.kind === "imperative") return { mood: "Imperativo", tense: "presente", person };
  if (slot.kind !== "tense") return undefined;
  const { mood, tense } = TENSE_PLACE[slot.box];
  return { mood, tense, person };
}

const isCompound = (mood: Mood, tense: string): boolean =>
  Object.values(TENSE_PLACE).some((place) => place.mood === mood && place.tense === tense && place.compound);

export function conjugationOf(forms: readonly SourceForm[], searched: SearchedSpellings): Conjugation {
  const hit = (form: SourceForm) => searched.formPointers.has(form.ref.jsonPointer);
  const grid = new Map<Mood, Map<string, Map<Person, SourceForm[]>>>();
  const nonFinite = new Map<NonFinite["label"], SourceForm[]>();
  const unplaced: SourceForm[] = [];
  const addNonFinite = (label: NonFinite["label"], form: SourceForm) =>
    nonFinite.set(label, [...(nonFinite.get(label) ?? []), form]);

  for (const form of forms) {
    const slot = slotOf(form);
    if (slot.kind === "auxiliary") {
      addNonFinite("ausiliare", form);
      continue;
    }
    if (slot.kind === "non-finite") {
      addNonFinite(slot.role === "participio passato" ? "participio" : slot.role, form);
      continue;
    }
    const place = placeOf(form);
    if (place === undefined) {
      unplaced.push(form);
      continue;
    }
    const tenses = grid.get(place.mood) ?? new Map<string, Map<Person, SourceForm[]>>();
    const cells = tenses.get(place.tense) ?? new Map<Person, SourceForm[]>();
    cells.set(place.person, [...(cells.get(place.person) ?? []), form]);
    tenses.set(place.tense, cells);
    grid.set(place.mood, tenses);
  }

  const moods: MoodTable[] = MOODS.flatMap((mood) => {
    const tenses = grid.get(mood);
    if (tenses === undefined) return [];
    const persons = PERSONS.filter((person) => [...tenses.values()].some((cells) => cells.has(person)));
    const tense = (name: string): Tense => {
      const cells = persons.map((person) => {
        const spelled = tenses.get(name)?.get(person) ?? [];
        return { forms: spelled, searched: spelled.some(hit) };
      });
      return { name, cells, searched: cells.some((cell) => cell.searched) };
    };
    const named = TENSE_ORDER[mood].filter((name) => tenses.has(name)).map(tense);
    const all = [...named];
    const searchedPersons = persons.map((_, i) => all.some((t) => t.cells[i].searched));
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
  const LINE_ORDER: NonFinite["label"][] = ["infinito", "gerundio", "participio presente", "participio", "ausiliare"];
  return {
    nonFinite: LINE_ORDER.flatMap((label) => {
      const spelled = nonFinite.get(label);
      return spelled === undefined ? [] : [{ label, forms: spelled }];
    }),
    moods,
    openMood: searchedMood?.mood ?? moods[0]?.mood,
    unplaced,
  };
}
