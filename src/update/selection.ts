// feed-selection/v3 implements ADR 0025: safely matched newer definitions
// replace older ones, including corrections and removals. Matching and source
// ordering are checked by callers. New-word eligibility and the raw-gloss
// interpretation below are unchanged; formatting and non-definition changes
// remain skipped.
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
export const SELECTION_RULE = "feed-selection/v3" as const;

/** Why a change is taken. */
export type TakeReason = "new-word" | "fills-gloss" | "adds-sense" | "replaces-definitions" | "removes-definitions";

/** Why a change is skipped. */
export type SkipReason =
  | "not-italian"
  | "no-real-gloss"
  | "form-of-target-missing"
  | "form-of-target-not-italian"
  | "master-hidden"
  | "glosses-same"
  | "formatting-only"
  | "no-new-gloss";

export type Verdict = { take: true; reason: TakeReason } | { take: false; reason: SkipReason };

const take = (reason: TakeReason): Verdict => ({ take: true, reason });
const skip = (reason: SkipReason): Verdict => ({ take: false, reason });

type SourceSense = QualityRecord["senses"][number];

/** A sense's gloss strings as the source writes them. */
const sourceGlosses = (sense: SourceSense): string[] =>
  Array.isArray(sense.glosses) ? sense.glosses.filter((item): item is string => typeof item === "string") : [];

/** A sense's glosses with the placeholder taken out, and a gloss with nothing real left dropped. */
const realGlosses = (sense: SourceSense): string[] => sourceGlosses(sense).flatMap((text) => withoutPlaceholder(text) ?? []);

/** A record's senses as `feed-selection/v3` reads them. */
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
   * two glosses with the same key differ only in layout, not a semantic verdict.
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
  /** Whether `before` is hidden as another language. */
  beforeHidden: boolean;
  /** Whether #29's rule, run on the later release's dump, keeps `after` Italian. */
  italian: boolean;
}

const sameList = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((item, index) => item === b[index]);
const sorted = (items: readonly string[]): string[] => [...items].sort();

/** The verdict on a record whose senses changed. */
export function selectChanged({ before, after, beforeHidden, italian }: ChangedCandidate): Verdict {
  if (beforeHidden) return skip("master-hidden");
  if (!italian) return skip("not-italian");
  const was = ReadSenses.of(before);
  const now = ReadSenses.of(after);
  if (now.real.length < was.real.length) return take("removes-definitions");
  if (now.real.length === 0) return skip("no-real-gloss");
  if (was.real.length === 0) return take("fills-gloss");
  if (now.real.length > was.real.length) {
    const held = new Set(was.keys);
    if (!now.keys.some((key) => !held.has(key))) {
      const later = new Set(now.keys);
      return was.keys.every((key) => later.has(key)) ? skip("no-new-gloss") : take("replaces-definitions");
    }
    if (was.notReal > now.notReal) return take("fills-gloss");
    return take("adds-sense");
  }
  if (sameList(sorted(was.keys), sorted(now.keys))) return skip(sameList(was.shown, now.shown) ? "glosses-same" : "formatting-only");
  return take("replaces-definitions");
}
