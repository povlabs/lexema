// How one archive record reads to someone looking a word up, measured rather
// than assumed (#17).
//
// A non-empty `glosses` array is not a definition: `casa` has two glosses and
// neither says what a house is. This file names what each sense actually holds,
// the way the word page reads it, and the other checks the quality measurement
// (src/import/measureQuality.ts) runs against the whole release. It reads the
// source and never edits it; nothing here becomes a claim on a page.

import { isFurnitureSense, splitSenses, type SenseShape, type SenseSplit } from "./furniture.js";
import { placeItalianVerbForm, type VerbSlot } from "./moods.js";
import { withoutPlaceholder } from "./placeholder.js";

/** The parts of an archive record the measurement reads. Leaves stay `unknown`, as the archive parser leaves them. */
export interface QualityRecord {
  word: string;
  pos: string;
  forms: readonly { form?: unknown; tags?: unknown; raw_tags?: unknown }[];
  senses: readonly { glosses?: unknown; examples?: unknown; form_of: readonly { word?: unknown }[] }[];
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

/**
 * What one sense holds, read the way the word page reads it.
 *
 * - `meaning` — at least one gloss that is real text and not the headword line.
 * - `form-of` — the sense has a gloss, is not furniture, and names the word it
 *   inflects (`plurale di casa`).
 * - `furniture` — every gloss is the headword line the page hides
 *   (`casa ( approfondimento) f sing`), with nothing after the stamp.
 * - `furniture-with-prose` — every gloss starts as that headword line, and at
 *   least one goes on to state something: `palo ( approfondimento) pezza
 *   onorevole…`. The page rule hides it all the same.
 * - `placeholder` — every gloss is Wikizionario's "definizione mancante"
 *   sentence and nothing else (#255).
 * - `no-gloss` — no gloss text at all.
 */
export type SenseKind = "meaning" | "form-of" | "furniture" | "furniture-with-prose" | "placeholder" | "no-gloss";

/** Gender and number stamps a headword line carries after `( approfondimento)`. */
const STAMP = /^(?:m|f|n|s|e|sing|pl|inv|invar|pron|loc)\.?$/u;

/** Whether a gloss the page rule calls furniture goes on to say something past the headword and stamps. */
function furnitureStatesSomething(text: string, word: string): boolean {
  const marker = `${word} ( approfondimento)`;
  if (!text.startsWith(marker)) return false;
  return text
    .slice(marker.length)
    .split(/[\s,;:()]+/u)
    .filter((token) => token !== "")
    .some((token) => !STAMP.test(token));
}

/** A sense's glosses as the page holds them: the placeholder taken out, and a gloss with nothing real left dropped. */
export function pageGlosses(sense: QualityRecord["senses"][number]): string[] {
  return strings(sense.glosses).flatMap((text) => withoutPlaceholder(text) ?? []);
}

/** A sense in the shape the page's rule (`splitSenses`) reads. */
function pageShape(sense: QualityRecord["senses"][number], opensRecoveredList: boolean): SenseShape {
  return { glosses: pageGlosses(sense), opensRecoveredList };
}

/**
 * What one sense holds. The furniture question comes before the form-of one
 * because the page's rule never reads `form_of`: `balzana`'s heraldic sense is
 * a headword line with a stray `form_of` pointer, and the page hides it.
 */
export function senseKind(sense: QualityRecord["senses"][number], word: string): SenseKind {
  // The page shows no sense without a gloss, a form-of one included.
  if (!strings(sense.glosses).some((text) => text.trim() !== "")) return "no-gloss";
  const shape = pageShape(sense, false);
  if (shape.glosses.length === 0) return "placeholder";
  if (isFurnitureSense(shape, word)) {
    return shape.glosses.some((text) => furnitureStatesSomething(text, word)) ? "furniture-with-prose" : "furniture";
  }
  return sense.form_of.length > 0 ? "form-of" : "meaning";
}

/** Whether any sense carries a gloss string with text in it — the test this file exists to look past. */
export function hasGlossText(record: QualityRecord): boolean {
  return record.senses.some((sense) => strings(sense.glosses).some((text) => text.trim() !== ""));
}

/**
 * A record's senses, by index, split by the page's own rule
 * (`splitSenses`, which web/lib/dictionary/definitions.ts calls too).
 * `opensRecoveredList` names the senses a recovered list hangs under.
 */
export function splitRecordSenses(
  record: QualityRecord,
  recovered: number,
  opensRecoveredList: ReadonlySet<number> = new Set(),
): SenseSplit<number> {
  return splitSenses(record.senses.map((_, index) => index), record.word, recovered, (index) =>
    pageShape(record.senses[index], opensRecoveredList.has(index)),
  );
}

/** How many definitions the word page numbers for a record: its numbered senses plus the recovered definitions. */
export function definitionsShown(
  record: QualityRecord,
  recovered: number,
  opensRecoveredList: ReadonlySet<number> = new Set(),
): number {
  return splitRecordSenses(record, recovered, opensRecoveredList).numbered.length + recovered;
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
