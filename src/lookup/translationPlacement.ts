// Which record of a source page each translation belongs to (#928).
//
// Wikizionario keeps one translation table per page, and the extraction copies
// it onto every record of that page, so the noun *andare* lists the verb's
// "go", "depart" and "leave". The source stays as it is (ADR 0001): this is a
// read-time derivation over the stored lines, never an edit of them. A
// translation lands on a record only on evidence, by four rules in order:
//
// 1. A leading part-of-speech marker in its `sense` label — `(verbo) partire`,
//    or `aggettivo, …` — places it on the records of that part of speech, and
//    on no other.
// 2. Otherwise, a label equal to a gloss of one of the record's definitions
//    places it on that record, naming the definition.
// 3. Otherwise, on a page whose records are all one part of speech, it stays
//    on each of them, naming no definition.
// 4. Otherwise it is on no record: it is unplaced, and listed as such, never
//    guessed onto one.
//
// "The page" is the Italian records that share the headword's exact spelling,
// as Wikizionario keeps one page per spelling. Only the records whose own line
// lists translations take part: a record the table was not copied onto (a
// phrase with none) makes no claim on it.

import type { Translation } from "./types.js";

/** The parts of speech a label may name at its start, as the label writes them, and as the source codes them. */
const MARKED_POS: Readonly<Record<string, string>> = {
  verbo: "verb",
  sostantivo: "noun",
  aggettivo: "adj",
  avverbio: "adv",
};

const MARKER_WORDS = Object.keys(MARKED_POS).join("|");
/** `(verbo) partire`, `(aggettivo)`. */
const PARENTHESISED = new RegExp(`^\\((${MARKER_WORDS})\\)(.*)$`, "isu");
/** `aggettivo`, or `sostantivo, aeronautica, veicolo …`. */
const BARE = new RegExp(`^(${MARKER_WORDS})(?:,(.*))?$`, "isu");

/**
 * The form a label and a gloss are compared in: Unicode NFC, runs of white
 * space made one space, trimmed, lower-cased, and any `.`, `;`, `:` or `,` at
 * the end taken off. Two texts match when their forms are equal; nothing
 * closer than that counts as a match, so no score is involved.
 */
export function matchForm(text: string): string {
  return text.normalize("NFC").replace(/\s+/gu, " ").trim().toLowerCase().replace(/[\s.;:,]+$/u, "");
}

/** A translation's `sense` label, read: the part of speech it starts by naming, if any, and the text that names the meaning. */
export interface SenseLabel {
  /** The source's code for the part of speech the label names first: `verb`. Absent when it names none. */
  pos?: string;
  /** The rest of the label, in match form; null when nothing is left. */
  meaning: string | null;
}

/** Read a `sense` label: `(verbo) partire` names `verb` and the meaning `partire`. */
export function readSenseLabel(sense: string | null): SenseLabel {
  if (sense === null) return { meaning: null };
  const trimmed = sense.trim();
  const marked = PARENTHESISED.exec(trimmed) ?? BARE.exec(trimmed);
  const meaning = (text: string | undefined): string | null => {
    const form = text === undefined ? "" : matchForm(text);
    return form === "" ? null : form;
  };
  if (marked === null) return { meaning: meaning(trimmed) };
  return { pos: MARKED_POS[marked[1].toLowerCase()], meaning: meaning(marked[2]) };
}

/**
 * Why a translation is on a record. A definition is named only by evidence: a
 * label that matched it. Rule 3 has none to name.
 */
export type Placement =
  | { rule: "pos-marker"; definitionIndex: number | null }
  | { rule: "definition"; definitionIndex: number }
  | { rule: "only-part-of-speech"; definitionIndex: null };

/** One translation on one record, and why it is there. */
export interface PlacedTranslation {
  translation: Translation;
  placement: Placement;
}

/** What placement reads of one record of a page. */
export interface PageRecord {
  recordId: number;
  /** The source's part of speech: `verb`. */
  pos: string;
  /** The record's own `translations[]`, in source order. */
  translations: readonly Translation[];
  /**
   * The glosses of each definition the record's own senses give, in the order
   * of the record's `definitions`: entry `i` is definition `i`. A definition
   * read from elsewhere, which follows them, has no gloss here.
   */
  definitionGlosses: readonly (readonly string[])[];
}

/** How one translation of a page's table was placed, for measuring the rules. */
export type Outcome = Placement["rule"] | "unplaced";

/** The rule that wins when one translation lands on several records by different rules. */
const STRENGTH: Readonly<Record<Outcome, number>> = { "pos-marker": 3, definition: 2, "only-part-of-speech": 1, unplaced: 0 };

/** A translation of a table, the same whichever record's copy it is read from. */
const identity = (t: Translation): string => JSON.stringify([t.ref.jsonPointer, t.langCode, t.langName, t.word, t.sense]);

/** The index of the first definition with a gloss in `meaning`'s match form. */
function definitionMatching(meaning: string, record: PageRecord): number | undefined {
  const at = record.definitionGlosses.findIndex((glosses) => glosses.some((gloss) => matchForm(gloss) === meaning));
  return at === -1 ? undefined : at;
}

/** One source page's records and the translations each of them is owed. */
export class TranslationPage {
  private readonly placed: ReadonlyMap<number, PlacedTranslation[]>;

  private constructor(
    /** The headword the page is named by: `andare`. */
    readonly headword: string,
    private readonly records: readonly PageRecord[],
  ) {
    const carriers = records.filter((record) => record.translations.length > 0);
    const onePos = new Set(carriers.map((record) => record.pos)).size === 1;
    this.placed = new Map(
      records.map((record) => [
        record.recordId,
        record.translations.flatMap((translation) => {
          const placement = placementOn(record, translation, onePos);
          return placement === undefined ? [] : [{ translation, placement }];
        }),
      ]),
    );
  }

  /** The page `headword` names, of these records, in page order. */
  static of(headword: string, records: readonly PageRecord[]): TranslationPage {
    return new TranslationPage(headword, records);
  }

  /** The translations placed on the record, in source order; undefined for a record not on this page. */
  placedOn(recordId: number): PlacedTranslation[] | undefined {
    return this.placed.get(recordId);
  }

  /** Each distinct translation of the page's table, in table order, and how it was placed. */
  outcomes(): { translation: Translation; outcome: Outcome }[] {
    const byIdentity = new Map<string, { translation: Translation; outcome: Outcome }>();
    for (const record of this.records) {
      const placedHere = new Map((this.placed.get(record.recordId) ?? []).map((item) => [identity(item.translation), item.placement.rule] as const));
      for (const translation of record.translations) {
        const key = identity(translation);
        const outcome: Outcome = placedHere.get(key) ?? "unplaced";
        const seen = byIdentity.get(key);
        if (seen === undefined) byIdentity.set(key, { translation, outcome });
        else if (STRENGTH[outcome] > STRENGTH[seen.outcome]) seen.outcome = outcome;
      }
    }
    return [...byIdentity.values()];
  }

  /** The translations of the page's table that no record takes, in table order, each once. */
  unplaced(): Translation[] {
    return this.outcomes().flatMap(({ translation, outcome }) => (outcome === "unplaced" ? [translation] : []));
  }
}

/** Where rules 1 to 3 put `translation` on `record`, or undefined when they leave it off. */
function placementOn(record: PageRecord, translation: Translation, onePos: boolean): Placement | undefined {
  const label = readSenseLabel(translation.sense);
  if (label.pos !== undefined) {
    if (label.pos !== record.pos) return undefined;
    return { rule: "pos-marker", definitionIndex: label.meaning === null ? null : (definitionMatching(label.meaning, record) ?? null) };
  }
  const matched = label.meaning === null ? undefined : definitionMatching(label.meaning, record);
  if (matched !== undefined) return { rule: "definition", definitionIndex: matched };
  return onePos ? { rule: "only-part-of-speech", definitionIndex: null } : undefined;
}
