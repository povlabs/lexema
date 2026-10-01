// Importer policy for grammar_claim. The schema defines the four states and
// owns the closed vocabulary; deciding which source tag becomes which value,
// and which dimensions are *expected* where, is this file's job.
//
// The rule throughout: map what the source states structurally, and never infer
// from prose. `raw_tags` such as 'io' or 'lui/lei' plainly mean a person to an
// Italian reader, and they are still recorded as 'unclassified' here — reading
// them is exactly the mapping #4 exists to establish and test. Guessing now
// would put an unvalidated claim in the database wearing a 'stated' label.
//
// One exception, ruled by Huey on #317: the gloss grammar stamp rule
// (`it-gloss-stamp/v1`, `GlossStampLift` below). A noun or adjective with no
// gender tag whose gloss is a whole stamp line, like `casa ( approfondimento)
// f sing`, states its gender and number from that stamp. The stamp is the
// page's own grammar mark, flattened into a gloss by the extraction, not prose:
// the rule matches the whole gloss against one fixed shape and reads nothing else.

import { readGlossGrammarStamp, type GlossGrammarStamp } from "../italian/glossGrammarStamp.js";

/** A structural tag mapped to the schema's closed vocabulary. */
const STRUCTURAL_TAGS = new Map<string, { dimension: string; value: string }>(
  (
    [
      ["masculine", "gender"],
      ["feminine", "gender"],
      ["neuter", "gender"],

      ["singular", "number"],
      ["plural", "number"],
      ["invariable", "number"],

      ["first-person", "person"],
      ["second-person", "person"],
      ["third-person", "person"],

      ["present", "tense"],
      ["imperfect", "tense"],
      ["future", "tense"],
      ["past", "tense"],
      ["past-remote", "tense"],
      ["perfect", "tense"],
      ["pluperfect", "tense"],
      ["historic", "tense"],

      // The only moods this file states structurally. Indicative, subjunctive
      // and conditional never appear as tags — `parlerei` carries 'present'
      // and nothing else — which is why 'missing' rows exist below.
      ["imperative", "mood"],
      ["participle", "mood"],
      ["gerund", "mood"],
      ["infinitive", "mood"],

      ["positive", "degree"],
      ["comparative", "degree"],
      ["superlative", "degree"],
      ["absolute", "degree"],

      ["reflexive", "voice"],
      ["pronominal", "voice"],
      ["reciprocal", "voice"],

      ["transitive", "transitivity"],
      ["intransitive", "transitivity"],

      // Not an inflected form of the headword: the entry names the auxiliary
      // verb. `salire` /forms/0 is the string 'avere o essere'.
      ["auxiliary", "form-role"],
    ] as const
  ).map(([value, dimension]) => [value, { dimension, value }]),
);

export type MappedTag =
  | { status: "stated"; dimension: string; value: string; sourceText: string }
  | { status: "unclassified"; sourceText: string };

/**
 * Map one structural `tags[]` entry. Anything outside the closed vocabulary is
 * kept verbatim as 'unclassified' rather than coerced into a nearby value.
 */
export function mapStructuralTag(tag: string): MappedTag {
  const hit = STRUCTURAL_TAGS.get(tag);
  return hit
    ? { status: "stated", dimension: hit.dimension, value: hit.value, sourceText: tag }
    : { status: "unclassified", sourceText: tag };
}

/**
 * `raw_tags[]` are always unclassified. They are the source's free prose —
 * 'io', 'essi/esse', 'verbo di prima coniugazione', 'pl.: case' — and turning
 * them into grammar is #4's job, with tests, not this importer's.
 */
export function mapRawTag(rawTag: string): MappedTag {
  return { status: "unclassified", sourceText: rawTag };
}

/**
 * Dimensions expected on a record itself, given its part of speech. A dimension
 * expected here and absent from the tags becomes a 'missing' row, which is how
 * `varicella` (no tags, no gloss grammar stamp) reads differently from a word
 * the source simply never had an opinion about. A dimension a gloss grammar
 * stamp states (`casa`, via `GlossStampLift`) is `stated`, not missing.
 */
export function expectedRecordDimensions(pos: string): readonly string[] {
  // Nominals are the only pos where the source reliably states gender and
  // number, so they are the only ones where silence is worth recording.
  // Widening this list is cheap; widening it wrongly fills the table with
  // 'missing' rows nobody expected in the first place.
  return pos === "noun" || pos === "adj" || pos === "name"
    ? ["gender", "number"]
    : [];
}

/**
 * Dimensions expected on one `forms[]` entry of a record.
 *
 * Mood is expected on a verb form that is already inflected for person, number
 * or tense — if the source can say "third-person plural imperfect" it was in a
 * position to say "indicative", and it did not. That silence is the single most
 * consequential gap in this dataset, so it is recorded rather than left to look
 * like absence.
 */
export function expectedFormDimensions(
  pos: string,
  statedDimensions: ReadonlySet<string>,
): readonly string[] {
  if (pos !== "verb") return [];
  // An auxiliary row is not an inflected form, so it is owed no mood.
  if (statedDimensions.has("form-role")) return [];
  const inflected =
    statedDimensions.has("person") ||
    statedDimensions.has("number") ||
    statedDimensions.has("tense");
  return inflected && !statedDimensions.has("mood") ? ["mood"] : [];
}

/** A stated claim the stamp rule lifts off a gloss, pointing at that gloss. */
export interface StampClaim {
  readonly pointer: string;
  readonly dimension: "gender" | "number";
  readonly value: string;
  /** The stamp as the source wrote it (`f sing`), the same on both claims. */
  readonly sourceText: string;
}

/** What the stamp rule reads of a record: its headword, pos, record tags and every gloss by pointer. */
export interface StampableRecord {
  readonly word: string;
  readonly pos: string;
  readonly tags: readonly string[];
  readonly glosses: readonly { readonly pointer: string; readonly text: string }[];
}

/**
 * The gloss grammar stamp rule (`it-gloss-stamp/v1`, #317) applied to one
 * record: which glosses carry a stamp it lifts, the stated claims that gives,
 * and the gloss text stored once the stamp is taken off (ADR 0019).
 *
 * It lifts nothing unless every reading agrees: the record is a noun or an
 * adjective, it has no gender tag of its own, its stamps name one gender and
 * at most one number, and no number tag says otherwise. A record the rule
 * leaves alone keeps every gloss as written.
 */
export class GlossStampLift {
  static readonly NONE = new GlossStampLift(new Map());

  private constructor(private readonly stamps: ReadonlyMap<string, GlossGrammarStamp>) {}

  static of(record: StampableRecord): GlossStampLift {
    if (record.pos !== "noun" && record.pos !== "adj") return GlossStampLift.NONE;
    const tagged = record.tags.map(mapStructuralTag).flatMap((tag) => (tag.status === "stated" ? [tag] : []));
    if (tagged.some((tag) => tag.dimension === "gender")) return GlossStampLift.NONE;

    const stamps = new Map<string, GlossGrammarStamp>();
    for (const { pointer, text } of record.glosses) {
      const stamp = readGlossGrammarStamp(record.word, text);
      if (stamp !== undefined) stamps.set(pointer, stamp);
    }
    const genders = new Set([...stamps.values()].map((stamp) => stamp.gender));
    const numbers = new Set([...stamps.values()].flatMap((stamp) => stamp.number ?? []));
    const taggedNumbers = tagged.filter((tag) => tag.dimension === "number").map((tag) => tag.value);
    const agrees =
      genders.size === 1 &&
      numbers.size <= 1 &&
      [...numbers].every((number) => taggedNumbers.every((tag) => tag === number));
    return agrees ? new GlossStampLift(stamps) : GlossStampLift.NONE;
  }

  /** How many glosses the rule takes. */
  get glossCount(): number {
    return this.stamps.size;
  }

  /**
   * The text stored for the gloss at `pointer`: as written, or with its stamp
   * taken off; undefined when the stamp was the whole gloss, so the sense
   * keeps no gloss row for it.
   */
  storedGloss(pointer: string, text: string): string | undefined {
    const stamp = this.stamps.get(pointer);
    return stamp === undefined ? text : GlossStampLift.kept(stamp);
  }

  /** Every gloss the rule takes, with what `storedGloss` keeps of it. */
  trimmed(): { pointer: string; kept: string | undefined }[] {
    return [...this.stamps].map(([pointer, stamp]) => ({ pointer, kept: GlossStampLift.kept(stamp) }));
  }

  private static kept(stamp: GlossGrammarStamp): string | undefined {
    return stamp.rest === "" ? undefined : stamp.rest;
  }

  /** The stated claims, in gloss order: gender, then number when the stamp has one. */
  claims(): StampClaim[] {
    return [...this.stamps].flatMap(([pointer, stamp]): StampClaim[] => [
      { pointer, dimension: "gender", value: stamp.gender, sourceText: stamp.sourceText },
      ...(stamp.number === undefined
        ? []
        : [{ pointer, dimension: "number" as const, value: stamp.number, sourceText: stamp.sourceText }]),
    ]);
  }
}
