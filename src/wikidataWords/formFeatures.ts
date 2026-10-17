// The fixed table that gives a Wikidata word's forms their place in the page's
// tables (ADR 0033, #833): each grammatical feature an Italian lexeme's form
// states, as a Wikidata item, mapped onto the tags a Wiktionary record's
// `forms[]` entry writes for the same grammar. The gender grid
// (web/lib/dictionary/genderGrid.ts) and the conjugation
// (web/lib/dictionary/conjugation.ts, by `it-moods/v1` in
// src/italian/moods.ts) then place a Wikidata form exactly as they place a
// record's own.
//
// A record writes a finite form in one of three row shapes, and a mood's
// feature names which: the indicative tags the person and number beside a bare
// pronoun (`io`), the conditional and the imperative write only the bare
// pronoun, and the subjunctive only a pronoun after *che* (`che io`). So a
// person and a number are features of their own here, and the mood decides how
// a form writes them. A form with any feature the table does not map (a
// diminutive, an abbreviation, a cut-short form) has no tags: it is not one a
// table shows, so it is left off, never guessed. Each feature's Italian label
// is Wikidata's own, read on 2026-10-17 off
// https://www.wikidata.org/w/api.php?action=wbgetentities.

/** How a mood's record rows write a finite form's person and number. */
type RowShape =
  /** Person and number tags, and the bare pronoun beside them: the indicative. */
  | "tagged"
  /** The bare pronoun alone: the conditional, the imperative. */
  | "pronoun"
  /** The pronoun after *che* alone: the subjunctive. */
  | "che"
  /** No person: a non-finite form. */
  | "none";

/** What one feature states, as a record's form would. */
type FeatureTags =
  | { kind: "gender"; tag: "masculine" | "feminine" }
  | { kind: "number"; tag: "singular" | "plural" }
  | { kind: "person"; tag: "first-person" | "second-person" | "third-person" }
  | { kind: "verb"; tags: readonly string[]; row: RowShape };

/** Every grammatical feature Lexema reads, and the tags it states. */
export const TAGS_BY_FEATURE = {
  Q499327: { kind: "gender", tag: "masculine" }, // maschile
  Q1775415: { kind: "gender", tag: "feminine" }, // femminile
  Q110786: { kind: "number", tag: "singular" }, // singolare
  Q146786: { kind: "number", tag: "plural" }, // plurale
  Q21714344: { kind: "person", tag: "first-person" }, // prima persona
  Q51929049: { kind: "person", tag: "second-person" }, // seconda persona
  Q51929074: { kind: "person", tag: "third-person" }, // terza persona
  Q56682909: { kind: "verb", tags: ["present"], row: "tagged" }, // presente indicativo
  Q12547192: { kind: "verb", tags: ["imperfect"], row: "tagged" }, // imperfetto dell'indicativo
  Q442485: { kind: "verb", tags: ["past-remote"], row: "tagged" }, // passato remoto
  Q1475560: { kind: "verb", tags: ["future"], row: "tagged" }, // futuro semplice
  Q3686414: { kind: "verb", tags: ["present"], row: "pronoun" }, // condizionale presente
  Q3502553: { kind: "verb", tags: ["present"], row: "che" }, // congiuntivo presente
  Q3502541: { kind: "verb", tags: ["imperfect"], row: "che" }, // congiuntivo imperfetto
  Q52434162: { kind: "verb", tags: ["imperative"], row: "pronoun" }, // presente imperativo
  Q52434245: { kind: "verb", tags: ["infinitive"], row: "none" }, // infinito presente
  Q52434511: { kind: "verb", tags: ["gerund"], row: "none" }, // presente gerundio
  Q10345583: { kind: "verb", tags: ["present", "participle"], row: "none" }, // participio presente
  Q12717679: { kind: "verb", tags: ["past", "participle"], row: "none" }, // participio passato
} as const satisfies Record<`Q${number}`, FeatureTags>;

/** A feature the table maps. */
export type MappedFeature = keyof typeof TAGS_BY_FEATURE;

export const isMappedFeature = (feature: string): feature is MappedFeature => Object.hasOwn(TAGS_BY_FEATURE, feature);

/** The pronoun a record writes on each finite row, bare and after *che*, by person and number. */
const PRONOUNS: Readonly<Record<string, { bare: string; che: string }>> = {
  "first-person singular": { bare: "io", che: "che io" },
  "second-person singular": { bare: "tu", che: "che tu" },
  "third-person singular": { bare: "lui/lei", che: "che lui/che lei" },
  "first-person plural": { bare: "noi", che: "che noi" },
  "second-person plural": { bare: "voi", che: "che voi" },
  "third-person plural": { bare: "essi/esse", che: "che essi/che esse" },
};

/** A form's grammar as a record's `forms[]` entry writes it: its structural `tags` and its `raw_tags`. */
export interface FormTags {
  tags: string[];
  rawTags: string[];
}

/**
 * The tags a record would write for a form of these features, or undefined
 * when any feature is one the table does not map, or two state a mood: such a
 * form is not one the page's tables show. `pento` (presente indicativo, prima
 * persona, singolare) writes `singular`, `first-person`, `present` and `io`;
 * `penta` (congiuntivo presente, prima persona, singolare) writes `present`
 * and `che io`; `targhette` (plurale) writes `plural`.
 */
export function formTagsOf(features: readonly string[]): FormTags | undefined {
  if (!features.every(isMappedFeature)) return undefined;
  const stated: FeatureTags[] = features.map((feature) => TAGS_BY_FEATURE[feature]);
  const of = <K extends FeatureTags["kind"]>(kind: K) => stated.filter((one): one is Extract<FeatureTags, { kind: K }> => one.kind === kind);
  const verbs = of("verb");
  if (verbs.length > 1) return undefined;
  const genders = of("gender").map((one) => one.tag);
  const numbers = of("number").map((one) => one.tag);
  const persons = of("person").map((one) => one.tag);
  const verb = verbs[0];
  if (verb === undefined || verb.row === "none") return { tags: [...genders, ...numbers, ...persons, ...(verb?.tags ?? [])], rawTags: [] };
  const pronoun = persons.length === 1 && numbers.length === 1 ? PRONOUNS[`${persons[0]} ${numbers[0]}`] : undefined;
  if (verb.row === "tagged") return { tags: [...genders, ...numbers, ...persons, ...verb.tags], rawTags: pronoun === undefined ? [] : [pronoun.bare] };
  return { tags: [...genders, ...verb.tags], rawTags: pronoun === undefined ? [] : [verb.row === "che" ? pronoun.che : pronoun.bare] };
}

/**
 * The gender tags a record would write for a lexeme's own grammatical genders
 * (P5185, #849), in its order: `targhetta` states femminile (Q1775415) and
 * writes `feminine`. An item the table does not map as a gender is left out,
 * never guessed.
 */
export function genderTagsOf(genders: readonly string[]): ("masculine" | "feminine")[] {
  return genders.flatMap((gender) => {
    if (!isMappedFeature(gender)) return [];
    const stated: FeatureTags = TAGS_BY_FEATURE[gender];
    return stated.kind === "gender" ? [stated.tag] : [];
  });
}
