// An English meaning for one Italian sense (ADR 0035, #933): source English
// first, then a model's pick from the page's unplaced English, then a model's
// own English only when no candidate fits.
//
// This module is the pure part. It decides, for one sense, whether the record
// already carries English for it (`source`, no request), or whether a model is
// asked (`ask`), and it reads the model's reply into a `picked` or a `written`
// meaning, refusing a pick that names no candidate. Nothing here reads a
// database or calls a model; src/englishMeaning/meaningPages.ts reads the
// senses and src/englishMeaning/meaningBatchCli.ts sends the requests.

import { createHash } from "node:crypto";
import type { TranslationPage } from "../lookup/translationPlacement.js";
import type { Translation } from "../lookup/types.js";

/** Held by this module alone, so only it can make a picked or a written meaning. */
const MADE_HERE: unique symbol = Symbol("made here");

/** The language every meaning is in, as the source codes it. */
export const ENGLISH = "en";

/**
 * The text of one definition, and the key a meaning is stored under: the
 * SHA-256 of that text's UTF-8 bytes. A definition a newer source rewrites
 * (ADR 0025) has another key, so a meaning made for the old text is never
 * found for the new one.
 */
export class DefinitionText {
  private constructor(
    readonly text: string,
    /** Lower-case hex, 64 characters. */
    readonly sha256: string,
  ) {}

  static of(text: string): DefinitionText {
    if (text.trim() === "") throw new Error("a definition with no text has no meaning to key");
    return new DefinitionText(text, createHash("sha256").update(text, "utf8").digest("hex"));
  }

  /** A numbered sense's definition: its glosses, in source order, joined as the page lists them. */
  static ofGlosses(glosses: readonly string[]): DefinitionText {
    return DefinitionText.of(glosses.join("; "));
  }
}

/** Where a stored meaning is found: the headword it explains, and its definition's hash. */
export interface MeaningKey {
  readonly headword: string;
  readonly definitionSha256: string;
}

export const keyText = (key: MeaningKey): string => `${key.headword}\u0000${key.definitionSha256}`;

/** One definition of one record of a page, as the job reads it. */
export interface MeaningSense {
  readonly headword: string;
  readonly recordId: number;
  /** The source's part of speech: `verb`. */
  readonly pos: string;
  /** Its place in the record's definitions, as placement counts them: numbered senses first, then recovered ones. */
  readonly definitionIndex: number;
  readonly definition: DefinitionText;
  /** The record's other definitions, in order, so a reply can tell this sense from them. */
  readonly otherDefinitions: readonly string[];
}

export const keyOf = (sense: MeaningSense): MeaningKey => ({ headword: sense.headword, definitionSha256: sense.definition.sha256 });

/** One English candidate of a page: an unplaced translation's word, with the source's label for it. */
export interface Candidate {
  readonly word: string;
  /** The source's `sense` labels of the translations that give this word, verbatim; empty when none gives one. */
  readonly labels: readonly string[];
}

/**
 * The English a page's table lists that no record takes (`TranslationPage.unplaced`),
 * one per distinct word, in table order. A pick is one of these words, byte for byte.
 */
export class Candidates {
  private constructor(readonly list: readonly Candidate[]) {}

  static ofPage(page: TranslationPage): Candidates {
    const byWord = new Map<string, string[]>();
    for (const translation of page.unplaced()) {
      if (translation.langCode !== ENGLISH) continue;
      const labels = byWord.get(translation.word) ?? [];
      if (translation.sense !== null && !labels.includes(translation.sense)) labels.push(translation.sense);
      byWord.set(translation.word, labels);
    }
    return new Candidates([...byWord].map(([word, labels]) => ({ word, labels })));
  }

  static of(list: readonly Candidate[]): Candidates {
    return new Candidates(list);
  }

  /** The pick that names `word`, or undefined when no candidate is that word exactly. */
  pick(word: string): PickedMeaning | undefined {
    return this.list.some((candidate) => candidate.word === word) ? new PickedMeaning(MADE_HERE, word) : undefined;
  }
}

/** English the record's own translations give the sense: placed on it by translation placement. */
export class SourceMeaning {
  readonly origin = "source";
  constructor(readonly translations: readonly Translation[]) {
    if (translations.length === 0) throw new Error("a source meaning has at least one translation");
  }
}

/** One of the page's unplaced English words, chosen by a model. Only `Candidates.pick` makes one. */
export class PickedMeaning {
  readonly origin = "picked";
  constructor(
    _made: typeof MADE_HERE,
    readonly english: string,
  ) {}
}

/** English a model wrote because no candidate fit. Never one of the candidates: that reply is a pick. */
export class WrittenMeaning {
  readonly origin = "written";
  constructor(
    _made: typeof MADE_HERE,
    readonly english: string,
  ) {}
}

/** What a model made for a sense. */
export type GeneratedMeaning = PickedMeaning | WrittenMeaning;

/** A sense's English: the source's, or a model's. */
export type EnglishMeaning = SourceMeaning | GeneratedMeaning;

/** What a sense needs: nothing, since its record has English for it, or a request with these candidates. */
export type SenseNeed = { kind: "source"; meaning: SourceMeaning } | { kind: "ask"; candidates: Candidates };

/**
 * Whether the record already has English for the sense. A translation placed
 * on the record counts for the sense when its placement names that definition,
 * or names none: rules 1 and 3 of placement put it on the record as a whole,
 * so it is the record's English for each of its senses (ADR 0035, rule 1).
 */
export function needOf(page: TranslationPage, sense: MeaningSense): SenseNeed {
  const placed = page.placedOn(sense.recordId);
  if (placed === undefined) throw new Error(`record ${sense.recordId} is not on the page of ${page.headword}`);
  const english = placed
    .filter(({ translation }) => translation.langCode === ENGLISH)
    .filter(({ placement }) => placement.definitionIndex === null || placement.definitionIndex === sense.definitionIndex)
    .map(({ translation }) => translation);
  return english.length > 0 ? { kind: "source", meaning: new SourceMeaning(english) } : { kind: "ask", candidates: Candidates.ofPage(page) };
}

/** A reply read: the meaning it gives, or why it gives none. A refused reply is stored as nothing. */
export type ReadReply = { kind: "meaning"; meaning: GeneratedMeaning } | { kind: "refused"; reason: string };

/** The longest English a meaning may be, in characters: a short gloss, not an explanation. */
export const MAX_ENGLISH = 120;

/**
 * Read a model's reply, the JSON object `{"origin": "picked" | "written", "english": "…"}`.
 * A pick must be one of the candidates byte for byte, or the reply is refused.
 * A written meaning that is a candidate byte for byte is a pick, since its text
 * is the source's. Anything else malformed is refused.
 */
export function readReply(reply: string, candidates: Candidates): ReadReply {
  let parsed: unknown;
  try {
    parsed = JSON.parse(reply);
  } catch {
    return { kind: "refused", reason: "the reply is not JSON" };
  }
  if (typeof parsed !== "object" || parsed === null) return { kind: "refused", reason: "the reply is not an object" };
  const { origin, english } = parsed as { origin?: unknown; english?: unknown };
  if (typeof english !== "string" || english.trim() === "") return { kind: "refused", reason: "the reply gives no English" };
  if (english !== english.trim() || english.length > MAX_ENGLISH || /[\n\r]/.test(english)) {
    return { kind: "refused", reason: "the English is not one short line" };
  }
  const picked = candidates.pick(english);
  if (origin === "picked") {
    return picked === undefined ? { kind: "refused", reason: `"${english}" is not one of the page's candidates` } : { kind: "meaning", meaning: picked };
  }
  if (origin === "written") return { kind: "meaning", meaning: picked ?? new WrittenMeaning(MADE_HERE, english) };
  return { kind: "refused", reason: "the reply names no origin" };
}
