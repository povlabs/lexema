// Importer policy for grammar_claim. The schema defines the four states and
// owns the closed vocabulary; deciding which source tag becomes which value,
// and which dimensions are *expected* where, is this file's job.
//
// The rule throughout: map what the source states structurally, and never infer
// from prose. `raw_tags` such as 'io' or 'lui/lei' plainly mean a person to an
// Italian reader, and they are still recorded as 'unclassified' here — reading
// them is exactly the mapping #4 exists to establish and test. Guessing now
// would put an unvalidated claim in the database wearing a 'stated' label.

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
 * `casa` (no gender tag at all) reads differently from a word the source simply
 * never had an opinion about.
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
