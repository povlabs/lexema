// A common Italian word the lookup answers with nothing (#807), and which of
// three groups its fix belongs to: our bug, in Wikidata's words, or in
// neither. The pure part of `pnpm run measure:missing-words`
// (src/lookup/measureMissingWords.ts), which gathers the evidence.

/**
 * Why a missing word is our bug, most specific first. Each names what the
 * fix would have to change:
 *
 * - `headword-not-served`: an archive record has the word as its headword.
 * - `listed-form-not-served`: an archive record lists it in `forms[]`.
 * - `declared-lemma-only`: the word page answers it as a declared lemma
 *   (#453), the API lookup does not.
 * - `accent-variant`: a word we have, spelled with another accent, none, or
 *   an apostrophe for it (`perche`, `citta'`); the page offers the word
 *   (`findNearby`), the API lookup does not.
 * - `pronominal-verb-pair`: `si` + a verb form we have.
 * - the rest: Morph-it! names a lemma we have, and the form is of this kind:
 *   elided before a vowel (`quell'`), cut short (`aver`, `cuor`), a verb with
 *   clitic pronouns (`raccontarvi`, `dirtelo`), and so on.
 */
export const BUG_CLASSES = [
  "headword-not-served",
  "listed-form-not-served",
  "declared-lemma-only",
  "accent-variant",
  "pronominal-verb-pair",
  "elided-form",
  "truncated-form",
  "clitic-form",
  "demonstrative-form",
  "verb-form",
  "noun-inflection",
  "adjective-inflection",
  "pronoun-form",
  "determiner-form",
  "other-form",
] as const;

export type BugClass = (typeof BUG_CLASSES)[number];

/** One Morph-it! analysis of a form: its lemma and its tag (`VER:inf+pres+vi`). */
export interface MorphAnalysis {
  lemma: string;
  tag: string;
}

/** A Morph-it! tag ends in clitic pronouns after the verb (`VER:inf+pres+vi`, `VER:inf+pres+telo`, `VER:impr+pres+2+s+tene`). */
const CLITIC = /\+(?:glie|gli|me|te|se|ce|ve|mi|ti|si|ci|vi|lo|la|li|le|ne)+$/;

/** The kind of form `word` is, by its Morph-it! analysis, as a bug class. */
export function bugClassOf(word: string, { lemma, tag }: MorphAnalysis): BugClass {
  if (word.endsWith("'")) return "elided-form";
  if (/[lmnr]$/.test(word) && lemma.length > word.length && lemma.startsWith(word)) return "truncated-form";
  return bugClassOfTag(tag);
}

/** The kind of form a Morph-it! tag says a word is, as a bug class. */
export function bugClassOfTag(tag: string): BugClass {
  const [category] = tag.split(":");
  if (/^(VER|AUX|MOD|ASP|CAU)$/.test(category)) return CLITIC.test(tag) ? "clitic-form" : "verb-form";
  if (/^(DET|PRO)-DEMO\b/.test(category)) return "demonstrative-form";
  if (category.startsWith("NOUN")) return "noun-inflection";
  if (category === "ADJ") return "adjective-inflection";
  if (category.startsWith("PRO-")) return "pronoun-form";
  if (/^(DET|ART|ARTPRE)\b/.test(category)) return "determiner-form";
  return "other-form";
}

/** A Wikidata lexeme in Italian (Q652) that has the word as its lemma or one of its forms. */
export interface WikidataLexeme {
  /** `L1247138`. */
  id: string;
  lemma: string;
  /** How many senses the lexeme has. */
  senses: number;
  /** Whether one of them carries an Italian gloss. */
  italianGloss: boolean;
}

/** What the measurement found out about one missing word. */
export interface MissingWordEvidence {
  word: string;
  /** Archive records have the word as their headword. */
  archiveHeadword: boolean;
  /** Archive records list the word in `forms[]`. */
  archiveForm: boolean;
  /** The word page's declared-lemma search answers it. */
  declaredLemma: boolean;
  /** The word we have that the page offers as the same word with its accent set right. */
  accentVariant: string | undefined;
  /**
   * For `si` + a verb form the lookup finds: that form, and the pronominal
   * verb (`trasferirsi`) when the lookup finds that too.
   */
  pronominal: { part: string; verb: string | undefined } | undefined;
  /** Morph-it! analyses whose lemma is not the word and which the lookup finds. */
  foundLemmas: readonly MorphAnalysis[];
  /** Italian Wikidata lexemes that have the word. */
  lexemes: readonly WikidataLexeme[];
}

/**
 * A missing word's group. Our bug comes first: its fix is ours whatever
 * Wikidata holds. Wikidata's words carry at least one lexeme, so a Wikidata
 * word with no lexeme id is not a state this type can hold.
 */
export type MissingWordGroup =
  | { group: "our-bug"; bugClass: BugClass; lemma: string | undefined }
  | { group: "wikidata"; lexemes: [WikidataLexeme, ...WikidataLexeme[]] }
  | { group: "neither" };

const rank = (bugClass: BugClass) => BUG_CLASSES.indexOf(bugClass);

export function groupOf(evidence: MissingWordEvidence): MissingWordGroup {
  if (evidence.archiveHeadword) return { group: "our-bug", bugClass: "headword-not-served", lemma: undefined };
  if (evidence.archiveForm) return { group: "our-bug", bugClass: "listed-form-not-served", lemma: undefined };
  if (evidence.declaredLemma) return { group: "our-bug", bugClass: "declared-lemma-only", lemma: undefined };
  // `farci` is offered `farcì`, but Morph-it! reads it as `fare` + `ci`: the
  // accent offer explains a word only when no lemma of ours says otherwise.
  const { accentVariant, foundLemmas } = evidence;
  if (accentVariant !== undefined && (foundLemmas.length === 0 || foundLemmas.some((analysis) => analysis.lemma === accentVariant))) {
    return { group: "our-bug", bugClass: "accent-variant", lemma: accentVariant };
  }
  if (evidence.pronominal !== undefined) {
    return { group: "our-bug", bugClass: "pronominal-verb-pair", lemma: evidence.pronominal.verb ?? evidence.pronominal.part };
  }
  const [best] = evidence.foundLemmas
    .map((analysis) => ({ lemma: analysis.lemma, bugClass: bugClassOf(evidence.word, analysis) }))
    .sort((a, b) => rank(a.bugClass) - rank(b.bugClass));
  if (best !== undefined) return { group: "our-bug", ...best };
  const [first, ...rest] = evidence.lexemes;
  if (first !== undefined) return { group: "wikidata", lexemes: [first, ...rest] };
  return { group: "neither" };
}
