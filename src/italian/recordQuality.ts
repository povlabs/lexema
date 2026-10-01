// How one archive record reads to someone looking a word up, measured rather
// than assumed (#17).
//
// A non-empty `glosses` array is not a definition: `casa` has two glosses and
// neither says what a house is. This file names what each sense actually holds,
// the way the word page reads it, and the other checks the quality measurement
// (src/import/measureQuality.ts) runs against the whole release. It reads the
// source and never edits it; nothing here becomes a claim on a page.

import { storedGlosses } from "../import/importRelease.js";
import { isFurnitureSense, splitSenses, type SenseShape, type SenseSplit } from "./furniture.js";
import { readGloss, type GlossReading } from "./headwordEcho.js";
import { placeItalianVerbForm, type VerbSlot } from "./moods.js";

/** The parts of an archive record the measurement reads. Leaves stay `unknown`, as the archive parser leaves them. */
export interface QualityRecord {
  word: string;
  pos: string;
  /** Read by the gloss grammar stamp rule, which decides what a stamped gloss is stored as (#317). */
  tags?: unknown;
  forms: readonly { form?: unknown; tags?: unknown; raw_tags?: unknown }[];
  senses: readonly { glosses?: unknown; examples?: unknown; form_of: readonly { word?: unknown }[] }[];
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

/**
 * What one sense holds, read the way the word page reads it (`PageSenses`),
 * strongest first: a record's kind is the first of these any of its senses has.
 *
 * - `meaning` — the page shows at least one gloss that is not the headword line.
 * - `form-of` — the page shows a gloss, the sense is not furniture, and it
 *   names the word it inflects (`plurale di casa`).
 * - `furniture` — every gloss shown is the headword line the page hides
 *   (`casa ( approfondimento) f sing`), with nothing after the stamp. A
 *   headword line that goes on to state something (`palo ( approfondimento)
 *   pezza onorevole…`) is a definition, which the seed stores without the
 *   lead (#325), so it counts as `meaning` or `form-of`.
 * - `headword-echo` — the page shows no gloss, and one stored gloss is the
 *   headword and nothing more: `presina`, which is what the seed stores for
 *   `presina f` (#317, #395).
 * - `placeholder` — the page shows no gloss, and every stored gloss is
 *   Wikizionario's "definizione mancante" sentence and nothing else (#255).
 * - `no-gloss` — the dictionary stores no gloss text: the source gives none,
 *   or gives only a gender and number stamp, which the seed stores as grammar
 *   claims and not as a gloss (`m sing`, #317).
 */
export const SENSE_KINDS = ["meaning", "form-of", "furniture", "headword-echo", "placeholder", "no-gloss"] as const;
export type SenseKind = (typeof SENSE_KINDS)[number];

/**
 * A record's senses as the word page reads them. The page never sees the
 * archive's gloss: it reads the text the seed stored (`storedGlosses`, which
 * applies the gloss grammar stamp rule and ADR 0019's source text
 * normalizations) through the filter a lookup applies (`readGloss`), and
 * numbers senses by `splitSenses`. This reads a record through those same
 * three, so what it counts is what the page shows.
 */
export class PageSenses {
  private constructor(
    private readonly word: string,
    /** Each sense: what a lookup makes of each stored gloss with text in it, and whether the sense names the word it inflects. */
    private readonly senses: readonly { readonly readings: readonly GlossReading[]; readonly formOf: boolean }[],
  ) {}

  static of(record: QualityRecord): PageSenses {
    const stored = storedGlosses(record);
    return new PageSenses(
      record.word,
      record.senses.map((sense, index) => ({
        readings: stored[index].filter((text) => text.trim() !== "").map((text) => readGloss(text, record.word)),
        formOf: sense.form_of.length > 0,
      })),
    );
  }

  /** The glosses the page holds for the sense at `index`, in order. */
  glosses(index: number): string[] {
    return this.senses[index].readings.flatMap((reading) => ("shown" in reading ? [reading.shown] : []));
  }

  /** The sense at `index` in the shape the page's rule (`splitSenses`) reads. */
  private shape(index: number, opensRecoveredList: boolean): SenseShape {
    return { glosses: this.glosses(index), opensRecoveredList };
  }

  /** What each sense holds, in source order. */
  get kinds(): SenseKind[] {
    return this.senses.map(({ readings, formOf }, index) => {
      const shape = this.shape(index, false);
      if (shape.glosses.length > 0) {
        // The furniture question comes before the form-of one because the
        // page's rule never reads `form_of`: a headword line with a `form_of`
        // pointer is hidden all the same.
        if (isFurnitureSense(shape, this.word)) return "furniture";
        return formOf ? "form-of" : "meaning";
      }
      // The page shows no sense without a gloss, a form-of one included. The
      // sense is named for why its glosses are hidden, the strongest reason
      // first. A reason is a sense kind of the same name, so a filter added
      // to `readGloss` does not compile here until it is a kind too.
      const hidden: readonly SenseKind[] = readings.flatMap((reading) => ("hidden" in reading ? [reading.hidden] : []));
      return SENSE_KINDS.find((kind) => hidden.includes(kind)) ?? "no-gloss";
    });
  }

  /**
   * The senses, by index, split by the page's own rule (`splitSenses`, which
   * web/lib/dictionary/definitions.ts calls too). `opensRecoveredList` names
   * the senses a recovered list hangs under.
   */
  split(recovered: number, opensRecoveredList: ReadonlySet<number> = new Set()): SenseSplit<number> {
    return splitSenses(this.senses.map((_, index) => index), this.word, recovered, (index) =>
      this.shape(index, opensRecoveredList.has(index)),
    );
  }

  /** How many definitions the word page numbers: the numbered senses plus the recovered definitions. */
  definitionsShown(recovered: number, opensRecoveredList: ReadonlySet<number> = new Set()): number {
    return this.split(recovered, opensRecoveredList).numbered.length + recovered;
  }
}

/**
 * Whether any sense carries a gloss string with text in it, as the archive
 * writes it — the test this file exists to look past.
 */
export function hasGlossText(record: QualityRecord): boolean {
  return record.senses.some((sense) => strings(sense.glosses).some((text) => text.trim() !== ""));
}

/**
 * How two `forms[]` entries spelled the same relate.
 *
 * - `identical` — same tags and raw tags: the one cell listed twice.
 * - `subsumed` — one entry's tags are a strict subset of the other's, so the
 *   less specific one adds nothing: `studente` lists `studenti` as
 *   `masculine plural` and again as `plural`.
 * - `distinct` — different cells that happen to share a spelling, as a verb's
 *   `studi` is three persons of the congiuntivo. This is the language, not a
 *   defect.
 */
export type DuplicateRelation = "identical" | "subsumed" | "distinct";

export interface DuplicateForm {
  surface: string;
  /** Indexes into `forms`, in source order. */
  indexes: number[];
  relation: DuplicateRelation;
}

const tagKey = (form: QualityRecord["forms"][number]): string[] => [
  ...strings(form.tags).map((tag) => `t:${tag}`),
  ...strings(form.raw_tags).map((tag) => `r:${tag}`),
];

/** Every surface a record's `forms[]` lists more than once, and how its entries relate. */
export function duplicateForms(forms: QualityRecord["forms"]): DuplicateForm[] {
  const bySurface = new Map<string, number[]>();
  forms.forEach((form, index) => {
    if (typeof form.form !== "string") return;
    bySurface.set(form.form, [...(bySurface.get(form.form) ?? []), index]);
  });
  return [...bySurface]
    .filter(([, indexes]) => indexes.length > 1)
    .map(([surface, indexes]) => ({ surface, indexes, relation: relationOf(indexes.map((index) => tagKey(forms[index]))) }));
}

function relationOf(keys: string[][]): DuplicateRelation {
  const sets = keys.map((key) => new Set(key));
  const same = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((tag) => b.has(tag));
  if (sets.every((set) => same(set, sets[0]))) return "identical";
  const within = (a: Set<string>, b: Set<string>) => a.size < b.size && [...a].every((tag) => b.has(tag));
  // Every entry is either the most specific one or contained in it.
  const widest = sets.reduce((a, b) => (b.size > a.size ? b : a));
  return sets.every((set) => set === widest || same(set, widest) || within(set, widest)) ? "subsumed" : "distinct";
}

/** A mood as Italian grammar names it, the way a form-of gloss writes it. */
export type ItalianMood = "indicativo" | "congiuntivo" | "condizionale" | "imperativo" | "participio" | "gerundio" | "infinito";

const MOODS: readonly ItalianMood[] = ["indicativo", "congiuntivo", "condizionale", "imperativo", "participio", "gerundio", "infinito"];

/**
 * The one mood a form-of gloss names in its prose — `prima persona singolare
 * del condizionale presente di parlare` names `condizionale`. Undefined when
 * it names none, or more than one. This reads prose to measure, never to
 * claim: the importer still records no mood from it (src/import/grammarPolicy.ts).
 */
export function glossMood(gloss: string): ItalianMood | undefined {
  const lower = gloss.toLocaleLowerCase("it-IT");
  const named = MOODS.filter((mood) => new RegExp(`(?<!\\p{L})${mood}(?!\\p{L})`, "u").test(lower));
  return named.length === 1 ? named[0] : undefined;
}

/** The mood a conjugation slot sits under by `it-moods/v1`, or undefined when the rule places it nowhere. */
export function moodOfSlot(slot: VerbSlot): ItalianMood | undefined {
  switch (slot.kind) {
    case "tense":
      if (slot.box.startsWith("congiuntivo")) return "congiuntivo";
      if (slot.box.startsWith("condizionale")) return "condizionale";
      // A person-tagged row: the rule files it by tense and claims no mood,
      // and the indicative is the only mood such a row can be.
      return "indicativo";
    case "imperative":
      return "imperativo";
    case "non-finite":
      return slot.role.startsWith("participio") ? "participio" : slot.role === "gerundio" ? "gerundio" : "infinito";
    case "auxiliary":
    case "unplaced":
      return undefined;
  }
}

/**
 * How a form-of record's gloss mood stands against its target's own
 * conjugation table.
 *
 * - `corroborated` — the table lists the surface in a slot of that mood.
 * - `elsewhere` — the table lists the surface, places it, and never under that
 *   mood. A candidate dispute, not a proven one: a feminine plural participle
 *   is no cell of the table, and its spelling is often a finite form's
 *   (`create`, *voi create*).
 * - `unplaced` — the table lists the surface but `it-moods/v1` places none of its entries.
 * - `unlisted` — the table does not list the surface at all (`studente`, which
 *   calls itself the present participle of `studiare`, whose table gives `studiante`).
 * - `no-table` — no record of the target word carries a conjugation table.
 */
export type MoodAgreement = "corroborated" | "elsewhere" | "unplaced" | "unlisted" | "no-table";

export function moodAgreement(
  surface: string,
  mood: ItalianMood,
  tables: readonly QualityRecord["forms"][],
): MoodAgreement {
  if (tables.length === 0) return "no-table";
  const listed = tables.flatMap((forms) => forms.filter((form) => form.form === surface));
  if (listed.length === 0) return "unlisted";
  const moods = listed.flatMap(
    (form) => moodOfSlot(placeItalianVerbForm({ tags: strings(form.tags), rawTags: strings(form.raw_tags) })) ?? [],
  );
  if (moods.length === 0) return "unplaced";
  return moods.includes(mood) ? "corroborated" : "elsewhere";
}

/**
 * Where a form-of pointer lands, by how many records carry its word: `bella`
 * the noun points at `bello`, which is three records, two of them nouns.
 */
export type TargetResolution = "resolved" | "ambiguous" | "dangling";

export function targetResolution(recordsWithWord: number): TargetResolution {
  return recordsWithWord === 0 ? "dangling" : recordsWithWord === 1 ? "resolved" : "ambiguous";
}

/** The two record-level dimensions a raw tag can name in prose. */
export type RawTextDimension = "gender" | "number";

const GENDER_WORDS = new Set(["m", "f", "mf", "fm", "maschile", "femminile", "masculine", "feminine", "neutro", "neuter"]);
const NUMBER_WORDS = new Set([
  "sing", "sg", "singolare", "singular", "pl", "plur", "plurale", "plurali",
  "inv", "invar", "invariabile", "indeclinabile",
]);
/** A gender stamp run into a number stamp: `msing`, `fpl`, `finv`, `ms`. */
const RUN_TOGETHER = /^(?:m|f|mf)(?:s|sing|pl|inv)$/u;

/**
 * Which of gender and number one `raw_tags` entry names, read as the stamps
 * and words Wikizionario writes them in: `f.sing.` names both, `solo maschile`
 * names gender, `pl.: case` names number, `diritto` and `forestierismo` name
 * neither. A misspelt stamp (`simg`, `fsin`) and a bare `s` name nothing, so a
 * count built on this is a floor. This reads prose to measure, never to claim:
 * the importer still records every raw tag as unclassified
 * (src/import/grammarPolicy.ts).
 */
export function rawTextNames(text: string): Set<RawTextDimension> {
  const named = new Set<RawTextDimension>();
  for (const token of text.toLocaleLowerCase("it-IT").split(/[^\p{L}]+/u)) {
    if (GENDER_WORDS.has(token) || RUN_TOGETHER.test(token)) named.add("gender");
    if (NUMBER_WORDS.has(token) || RUN_TOGETHER.test(token)) named.add("number");
  }
  return named;
}

/** Whether a word carries an accented letter: `città`, `perché`. */
export function hasAccent(word: string): boolean {
  return /\p{M}/u.test(word.normalize("NFD"));
}

/** Whether a record is a form-of record: a sense names the word it inflects. */
export function isFormOf(record: QualityRecord): boolean {
  return record.senses.some((sense) => sense.form_of.length > 0);
}

/**
 * A thin record: not a form-of record, at most one gloss string in all, no
 * usage example and no forms table. `asciugatoio` (`asciugatoio m`) is one.
 */
export function isThin(record: QualityRecord): boolean {
  if (isFormOf(record)) return false;
  const glosses = record.senses.reduce((total, sense) => total + strings(sense.glosses).length, 0);
  const examples = record.senses.some((sense) => Array.isArray(sense.examples) && sense.examples.length > 0);
  return glosses <= 1 && !examples && record.forms.length === 0;
}
