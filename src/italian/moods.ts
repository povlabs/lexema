// Where one verb form sits in an Italian conjugation table, by rule
// `it-moods/v1`.
//
// The source states a mood structurally for four moods only — imperative,
// participle, gerund, infinitive (src/import/grammarPolicy.ts) — and never for
// the indicative, the subjunctive or the conditional. What it does write is a
// pronoun beside each finite form, as a `raw_tag`, and that pronoun is the
// evidence this rule reads:
//
// - A form tagged with a person is filed under the tense its tags name, and
//   the box is named for that tense and nothing more: `presente`, `imperfetto`.
//   No mood is claimed for it.
// - A form tagged with a tense and no person, whose one pronoun begins `che` —
//   `che io`, `che lui/che lei` — is congiuntivo. *Che* before the pronoun is
//   how Italian grammar, and this source, writes the subjunctive.
// - A form tagged with `present` or `past` and no person, whose one pronoun is
//   bare — `io`, `tu` — is condizionale: the only other tense-only finite set
//   the source lists.
//
// Anything else is unplaced, and a caller puts it in one box that says so.
// Nothing here reads a spelling: `andrei` is condizionale because of its tags
// and its pronoun, never because it ends in *-rei*. Verified over every verb in
// fixtures/dev-seed.jsonl by test/moods.test.ts.

export const IT_MOODS_RULE = "it-moods/v1";

/** The boxes a conjugation shows, in the order a reader meets them. */
export const TENSE_BOXES = [
  "presente",
  "imperfetto",
  "passato remoto",
  "futuro semplice",
  "congiuntivo presente",
  "congiuntivo imperfetto",
  "condizionale presente",
  "passato prossimo",
  "trapassato prossimo",
  "trapassato remoto",
  "futuro anteriore",
  "condizionale passato",
  "congiuntivo passato",
  "congiuntivo trapassato",
] as const;

export type TenseBox = (typeof TENSE_BOXES)[number];

/** The non-finite rows, in the order the table shows them. */
export const NON_FINITE_ROLES = [
  "infinito",
  "gerundio",
  "participio presente",
  "participio passato",
  "participio",
] as const;

export type NonFiniteRole = (typeof NON_FINITE_ROLES)[number];

/** Where one form goes. `unplaced` is a real answer, not a failure. */
export type VerbSlot =
  | { kind: "tense"; box: TenseBox; derivedMood: boolean }
  | { kind: "imperative" }
  | { kind: "non-finite"; role: NonFiniteRole }
  | { kind: "auxiliary" }
  | { kind: "unplaced" };

/** One form as the source tagged it: structural `tags` and verbatim `raw_tags`. */
export interface VerbFormTags {
  tags: readonly string[];
  rawTags: readonly string[];
}

const PERSONS = new Set(["first-person", "second-person", "third-person"]);
const NUMBERS = new Set(["singular", "plural"]);
const TENSES = new Set([
  "present",
  "imperfect",
  "future",
  "past",
  "past-remote",
  "perfect",
  "pluperfect",
  "historic",
]);

/** The six pronouns the source writes on a finite row, in its own spelling. */
const BARE_PRONOUNS = new Set(["io", "tu", "lui/lei", "noi", "voi", "essi/esse"]);

/** A tense signature — the sorted tense tags — to the box it names. */
const PERSON_TENSES: Record<string, TenseBox> = {
  present: "presente",
  imperfect: "imperfetto",
  "past-remote": "passato remoto",
  future: "futuro semplice",
  "past+perfect": "passato prossimo",
  "past+perfect+pluperfect": "trapassato prossimo",
  "historic+past-remote": "trapassato remoto",
  "future+perfect": "futuro anteriore",
};

const CONGIUNTIVO: Record<string, TenseBox> = {
  present: "congiuntivo presente",
  imperfect: "congiuntivo imperfetto",
  past: "congiuntivo passato",
  "past+perfect": "congiuntivo trapassato",
};

const CONDIZIONALE: Record<string, TenseBox> = {
  present: "condizionale presente",
  past: "condizionale passato",
};

const UNPLACED: VerbSlot = { kind: "unplaced" };

export function placeItalianVerbForm({ tags, rawTags }: VerbFormTags): VerbSlot {
  const tagged = new Set(tags);
  if (tagged.has("auxiliary")) return tags.length === 1 ? { kind: "auxiliary" } : UNPLACED;

  const tenses = tags.filter((tag) => TENSES.has(tag)).sort();
  const rest = tags.filter((tag) => !TENSES.has(tag) && !PERSONS.has(tag) && !NUMBERS.has(tag));

  if (rest.length === 1 && rest[0] === "imperative") return { kind: "imperative" };
  if (rest.length === 1 && rest[0] === "gerund") return { kind: "non-finite", role: "gerundio" };
  if (rest.length === 1 && rest[0] === "infinitive") return { kind: "non-finite", role: "infinito" };
  if (rest.length === 1 && rest[0] === "participle") {
    const signature = tenses.join("+");
    if (signature === "present") return { kind: "non-finite", role: "participio presente" };
    if (signature === "past") return { kind: "non-finite", role: "participio passato" };
    return signature === "" ? { kind: "non-finite", role: "participio" } : UNPLACED;
  }
  if (rest.length > 0 || tenses.length === 0) return UNPLACED;

  const signature = tenses.join("+");
  const pronoun = rawTags.length === 1 ? rawTags[0] : undefined;
  const subjunctive = pronoun !== undefined && pronoun.startsWith("che ");

  if (tags.some((tag) => PERSONS.has(tag))) {
    // A person-tagged row carrying a *che* pronoun contradicts itself as far as
    // this rule can tell, so it is not filed under either reading.
    const box = PERSON_TENSES[signature];
    return box === undefined || subjunctive ? UNPLACED : { kind: "tense", box, derivedMood: false };
  }

  if (pronoun === undefined) return UNPLACED;
  const box = subjunctive
    ? CONGIUNTIVO[signature]
    : BARE_PRONOUNS.has(pronoun)
      ? CONDIZIONALE[signature]
      : undefined;
  return box === undefined ? UNPLACED : { kind: "tense", box, derivedMood: true };
}
