// Which changes of a later release a simple dictionary takes (#377). Huey's
// rule of 2026-10-01: take what clearly helps a reader and skip the rest.
//
// - A new word is taken when the page says it is Italian, it has at least one
//   real gloss, and it is not a form-of record pointing at a word the
//   dictionary has no Italian headword for.
// - A record whose senses changed is taken only for a real fix: a missing,
//   placeholder or headword-line gloss is filled, or the later record adds
//   real senses while retaining every old real-gloss key and adding a new one.
//   A rewording, punctuation or a layout change is skipped.
// - Everything else is skipped: records whose senses are the same, lost words
//   (never removed), ambiguous groups (no pairing is guessed), and any record
//   an earlier apply already wrote.
//
// "Real gloss" is this rule's own reading of the source's glosses: a sense
// whose glosses, once the "definizione mancante" placeholder (#255) is taken
// out, are neither empty nor only the headword line (furniture). It is fixed
// with the rule's version, and it is not all the word page hides: the page
// reads the stored text, and drops a gloss that only repeats the headword
// (`PageSenses` in src/italian/recordQuality.ts; #422).
// Nothing here reads a database or a file; the caller hands in what the page,
// the dump and the master say.

import { isFurnitureSense } from "../italian/furniture.js";
import { normalizeItalianExact } from "../italian/normalize.js";
import { withoutPlaceholder } from "../italian/placeholder.js";
import type { QualityRecord } from "../italian/recordQuality.js";

/** The rule's name and version, written into every selection it makes. */
export const SELECTION_RULE = "feed-selection/v2" as const;

/** Why a change is taken. */
export type TakeReason =
  /** A new Italian word with a real gloss. */
  | "new-word"
  /** Our record shows no real gloss, or a placeholder or headword-line sense became a real one. */
  | "fills-gloss"
  /** More real senses, retaining every old real-gloss key and adding a new one. */
  | "adds-sense";

/** Why a change is skipped. */
export type SkipReason =
  /** The page puts the record under another language (#29's rule, section-language/v1). */
  | "not-italian"
  /** No sense of the later record has a real gloss. */
  | "no-real-gloss"
  /** A form-of record whose target no record of the dictionary or of this selection heads. */
  | "form-of-target-missing"
  /** A form-of record whose target only a record hidden as another language heads. */
  | "form-of-target-not-italian"
  /** The record it would replace came from an earlier apply, which is never touched. */
  | "earlier-applied"
  /** The record it would replace is hidden as another language. */
  | "master-hidden"
  /** The real glosses read the same; only examples, tags or links in the senses differ. */
  | "glosses-same"
  /** The real glosses differ only in case, punctuation or spacing. */
  | "formatting-only"
  /** As many real senses or fewer, with other wording. */
  | "rewording"
  /** The later record has fewer real senses: nothing is ever removed. */
  | "fewer-senses"
  /** More real senses, every one a gloss we already have. */
  | "no-new-gloss"
  /** An adds-sense replacement with at least one old real-gloss key absent. */
  | "loses-gloss";

export type Verdict = { take: true; reason: TakeReason } | { take: false; reason: SkipReason };

const take = (reason: TakeReason): Verdict => ({ take: true, reason });
const skip = (reason: SkipReason): Verdict => ({ take: false, reason });

type SourceSense = QualityRecord["senses"][number];

/** A sense's gloss strings as the source writes them. */
const sourceGlosses = (sense: SourceSense): string[] =>
  Array.isArray(sense.glosses) ? sense.glosses.filter((item): item is string => typeof item === "string") : [];

/** A sense's glosses with the placeholder taken out, and a gloss with nothing real left dropped. */
const realGlosses = (sense: SourceSense): string[] => sourceGlosses(sense).flatMap((text) => withoutPlaceholder(text) ?? []);

/** A record's senses as `feed-selection/v2` reads them. */
export class ReadSenses {
  private constructor(
    /** Senses with a real gloss (a meaning or a form-of), in order. */
    readonly real: readonly SourceSense[],
    /** Senses with gloss text that is not real: the placeholder, or the headword line alone. */
    readonly notReal: number,
    /** The real senses' glosses, the placeholder taken out. */
    readonly shown: readonly string[],
  ) {}

  static of(record: QualityRecord): ReadSenses {
    const isReal = (sense: SourceSense): boolean => {
      const glosses = realGlosses(sense);
      return glosses.length > 0 && !isFurnitureSense({ glosses, opensRecoveredList: false }, record.word);
    };
    const real = record.senses.filter(isReal);
    const notReal = record.senses.filter((sense) => sourceGlosses(sense).some((text) => text.trim() !== "") && !isReal(sense)).length;
    return new ReadSenses(real, notReal, real.map((sense) => realGlosses(sense).join("\n")));
  }

  /**
   * The real senses' glosses with case, punctuation and spacing taken out:
   * two senses with the same key say the same in another layout.
   */
  get keys(): string[] {
    return this.shown.map((text) => normalizeItalianExact(text).replace(/[^\p{L}\p{N}]+/gu, " ").trim());
  }

  /** The words the real form-of senses point at. */
  get formOfTargets(): string[] {
    return this.real.flatMap((sense) => sense.form_of.flatMap((pointer) => (typeof pointer.word === "string" ? [pointer.word] : [])));
  }
}

/** Where a form-of target word lands in the dictionary after the selection. */
export type TargetStatus = "italian" | "not-italian" | "missing";

/** A new record of the later release. */
export interface NewCandidate {
  record: QualityRecord;
  /** Whether #29's rule, run on the later release's dump, keeps it Italian. */
  italian: boolean;
}

/** The verdict on a new word. `targetOf` says where a form-of target word lands. */
export function selectNew({ record, italian }: NewCandidate, targetOf: (word: string) => TargetStatus): Verdict {
  if (!italian) return skip("not-italian");
  const senses = ReadSenses.of(record);
  if (senses.real.length === 0) return skip("no-real-gloss");
  const targets = senses.formOfTargets.map(targetOf);
  if (targets.includes("missing")) return skip("form-of-target-missing");
  if (targets.includes("not-italian")) return skip("form-of-target-not-italian");
  return take("new-word");
}

/** A record of the master and the later record of its word and part of speech, whose senses differ. */
export interface ChangedCandidate {
  before: QualityRecord;
  after: QualityRecord;
  /** Whether `before` is a record of the master's own release, not one an earlier apply wrote. */
  beforeFromMaster: boolean;
  /** Whether `before` is hidden as another language. */
  beforeHidden: boolean;
  /** Whether #29's rule, run on the later release's dump, keeps `after` Italian. */
  italian: boolean;
}

const sameList = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((item, index) => item === b[index]);
const sorted = (items: readonly string[]): string[] => [...items].sort();

/** The verdict on a record whose senses changed. */
export function selectChanged({ before, after, beforeFromMaster, beforeHidden, italian }: ChangedCandidate): Verdict {
  if (!beforeFromMaster) return skip("earlier-applied");
  if (beforeHidden) return skip("master-hidden");
  if (!italian) return skip("not-italian");
  const was = ReadSenses.of(before);
  const now = ReadSenses.of(after);
  if (now.real.length === 0) return skip("no-real-gloss");
  if (was.real.length === 0) return take("fills-gloss");
  if (now.real.length > was.real.length) {
    const held = new Set(was.keys);
    if (!now.keys.some((key) => !held.has(key))) return skip("no-new-gloss");
    if (was.notReal > now.notReal) return take("fills-gloss");
    const later = new Set(now.keys);
    if (!was.keys.every((key) => later.has(key))) return skip("loses-gloss");
    return take("adds-sense");
  }
  if (now.real.length < was.real.length) return skip("fewer-senses");
  if (sameList(sorted(was.keys), sorted(now.keys))) return skip(sameList(was.shown, now.shown) ? "glosses-same" : "formatting-only");
  return skip("rewording");
}
