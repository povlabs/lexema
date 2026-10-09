// feed-selection/v6 implements ADR 0025: safely matched newer definitions
// replace older ones, including corrections and removals. Matching and source
// ordering are checked by callers. Formatting and non-definition changes
// remain skipped, except changed translations (v6, below). A removal whose
// later record puts a blank where ours has a real definition is an
// extraction loss, not an edit, so ours keeps serving whole (#442).
//
// v5 changes what counts as a real gloss (#422). A sense is real when the word
// page shows a definition for it: the page reads the text the seed stores and
// hides a gloss that only repeats the headword (`PageSenses` in
// src/italian/recordQuality.ts). Up to v4 the rule read the source text, so a
// headword echo (`presina f`, stored `presina`) or a gender/number stamp alone
// (`m sing`, stored as grammar and no gloss) read as real. Under v5 neither
// does: a new word with nothing else is `no-real-gloss`, and a real definition
// of ours lost to one is `hidden-replaces-definition`, which keeps ours (Huey's
// ruling on #422 widens the one on #442).
//
// v6 adds one take reason, `replaces-translations` (#781). A changed record
// whose senses are the same and whose translations differ is taken, so the
// API serves the later translations. Hidden master records and the language
// rule skip it as they skip any changed record. A senses-same record whose
// differing fields do not include translations stays skipped, and so does a
// record whose senses changed and that the rule above skips (Huey's ruling on
// #781).
//
// Nothing here reads a database or a file; the caller hands in what the page,
// the dump and the master say.

import { normalizeItalianExact } from "../italian/normalize.js";
import { withoutPlaceholder } from "../italian/placeholder.js";
import { PageSenses, type QualityRecord, type SenseKind } from "../italian/recordQuality.js";

/** The rule's name and version, written into every selection it makes. */
export const SELECTION_RULE = "feed-selection/v6" as const;

/** Why a change is taken. */
export type TakeReason = "new-word" | "fills-gloss" | "adds-sense" | "replaces-definitions" | "removes-definitions" | "replaces-translations";

/** Why a change is skipped. */
export type SkipReason =
  | "not-italian"
  | "no-real-gloss"
  | "blank-replaces-definition"
  | "hidden-replaces-definition"
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

/** The page kinds of a sense the page shows a definition for. */
const SHOWN: ReadonlySet<SenseKind> = new Set(["meaning", "form-of"]);

/**
 * What a later record lost real definitions of ours to: `blank`, empty or
 * placeholder senses (#442); `hidden`, senses with text the page hides, a
 * headword echo or a gender/number stamp alone (#422).
 */
export type DefinitionLoss = "blank" | "hidden";

/** A record's senses as `feed-selection/v5` and later read them. */
export class ReadSenses {
  private constructor(
    /** Senses the word page shows a definition for (a meaning or a form-of), in order. */
    readonly real: readonly SourceSense[],
    /** Senses with gloss text that is not real: the placeholder, the headword line alone, a headword echo or a stamp. */
    readonly notReal: number,
    /**
     * Blank senses: no gloss text once the placeholder is taken out, so glosses
     * absent, null, empty or blank, or only the placeholder. The source's
     * `no-gloss` tag marks such a sense and only such a sense: no Italian sense
     * carrying it in it-0c432803 or it-78385b62 has gloss text.
     */
    readonly blank: number,
    /**
     * Hidden senses: gloss text the page shows nothing for, because it only
     * repeats the headword (`presina f`, `latinismo`) or is only a gender and
     * number stamp (`m sing`), which the seed stores as grammar and not as a
     * gloss (#317, #395).
     */
    readonly hidden: number,
    /** Every sense, of any kind. */
    readonly total: number,
    /** The real senses' source glosses, the placeholder taken out. */
    readonly shown: readonly string[],
  ) {}

  static of(record: QualityRecord): ReadSenses {
    const kinds = PageSenses.of(record).kinds;
    const read = record.senses.map((sense, index) => {
      const glosses = realGlosses(sense);
      return {
        sense,
        glosses,
        real: SHOWN.has(kinds[index]),
        text: sourceGlosses(sense).some((text) => text.trim() !== ""),
        blank: glosses.length === 0,
        hidden: kinds[index] === "headword-echo" || (kinds[index] === "no-gloss" && glosses.length > 0),
      };
    });
    const real = read.filter((entry) => entry.real);
    return new ReadSenses(
      real.map((entry) => entry.sense),
      read.filter((entry) => entry.text && !entry.real).length,
      read.filter((entry) => entry.blank).length,
      read.filter((entry) => entry.hidden).length,
      read.length,
      real.map((entry) => entry.glosses.join("\n")),
    );
  }

  /**
   * What this later reading lost real definitions of `earlier` to, or
   * undefined when it lost none that way: fewer real senses, with either more
   * senses of that kind than `earlier` or nothing else left (no sense at all
   * included). Huey's ruling on #442: when the later version is empty or only
   * says "definizione mancante", the old one stays. His ruling on #422: a later
   * sense the page hides counts the same way. A blank loss is named first, so
   * what v4 skipped keeps its reason.
   */
  lossTo(earlier: ReadSenses): DefinitionLoss | undefined {
    if (this.real.length >= earlier.real.length) return undefined;
    if (this.blank > earlier.blank || this.blank === this.total) return "blank";
    const empty = (senses: ReadSenses): number => senses.blank + senses.hidden;
    if (empty(this) > empty(earlier) || empty(this) === this.total) return "hidden";
    return undefined;
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
  const loss = now.lossTo(was);
  if (loss !== undefined) return skip(loss === "blank" ? "blank-replaces-definition" : "hidden-replaces-definition");
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

/** A record of the master and the later record of its word and part of speech, whose senses are the same and whose translations differ. */
export interface TranslationsCandidate {
  /** Whether the master record is hidden as another language. */
  beforeHidden: boolean;
  /** Whether #29's rule, run on the later release's dump, keeps the later record Italian. */
  italian: boolean;
}

/** The verdict on a record whose translations changed and whose senses did not (#781). */
export function selectTranslations({ beforeHidden, italian }: TranslationsCandidate): Verdict {
  if (beforeHidden) return skip("master-hidden");
  if (!italian) return skip("not-italian");
  return take("replaces-translations");
}
