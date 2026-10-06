// Where a gloss writes the lemmas its `form_of` edges name, and which lemmas a
// record names that none of its glosses writes. The page links the first where
// the gloss writes them (`LinkedGloss`) and puts the second on a `Form of`
// line of their own (`LemmaLines`), both in Reading.tsx; the page model reads
// the second to know whether a reading has anything to show (wordPage.ts).
// One matcher serves all three, so what is linked and what is counted as
// linked cannot disagree.

import { everyRecovered, type FactRef, type Reading } from "@lexema/lookup/types.ts";
import { readAt, type DefinitionPlace } from "./definitions.ts";

/** A record's lemma links: what a definition of its links where its text writes them. */
export type LinksOf = Pick<Reading, "lemmaLinks">;

/**
 * The words the `form_of` edges of a definition name, to link where its text
 * writes them: `terza persona plurale dell'imperfetto indicativo di andare`.
 */
export function lemmaWordsOf(reading: LinksOf, place: DefinitionPlace): string[] {
  return reading.lemmaLinks
    .filter((link) => link.kind === "candidates" && readAt(link.ref, place))
    .map((link) => link.targetWord);
}

const isLetter = (char: string | undefined): boolean => char !== undefined && /\p{L}/u.test(char);

/** Where a gloss writes a lemma as a whole word, last occurrence first; -1 when it does not. */
function findLemma(text: string, lemma: string): number {
  let at = text.lastIndexOf(lemma);
  while (at !== -1 && (isLetter(text[at - 1]) || isLetter(text[at + lemma.length]))) {
    at = at === 0 ? -1 : text.lastIndexOf(lemma, at - 1);
  }
  return at;
}

/** Every lemma a gloss writes as a whole word, where it writes it last, in text order and never overlapping. */
export function lemmaMatches(text: string, lemmas: readonly string[]): { at: number; lemma: string }[] {
  const found = [...new Set(lemmas)]
    .map((lemma) => ({ at: findLemma(text, lemma), lemma }))
    .filter((match) => match.at !== -1)
    .sort((a, b) => a.at - b.at || b.lemma.length - a.lemma.length);
  const kept: { at: number; lemma: string }[] = [];
  for (const match of found) {
    const last = kept[kept.length - 1];
    if (last === undefined || match.at >= last.at + last.lemma.length) kept.push(match);
  }
  return kept;
}

/**
 * The lemmas the release has that a record's `form_of` edges name and the
 * definition carrying the edge does not write, each once: what its `Form of`
 * lines link, so the edge stays reachable. A lemma the release has no entry
 * for is not one (Huey, 2026-09-27, on #142). `only`, in a verb form block,
 * names the words that block may show.
 */
export function unlinkedLemmas(reading: Reading, only?: readonly string[]): string[] {
  const writes = (text: string, place: DefinitionPlace, word: string) =>
    lemmaMatches(text, lemmaWordsOf(reading, place)).some((match) => match.lemma === word);
  const linkedInGloss = (word: string, ref: FactRef) =>
    reading.senses.some(
      (sense) => readAt(ref, { sense: sense.index }) && sense.glosses.some((gloss) => writes(gloss.text, { sense: sense.index }, word)),
    ) ||
    everyRecovered(reading).some(
      (definition) => readAt(ref, { line: definition.ref.line }) && writes(definition.text, { line: definition.ref.line }, word),
    );
  const unlinked = new Set<string>();
  for (const link of reading.lemmaLinks) {
    if (link.kind !== "candidates" || (only !== undefined && !only.includes(link.targetWord))) continue;
    if (!linkedInGloss(link.targetWord, link.ref)) unlinked.add(link.targetWord);
  }
  return [...unlinked];
}
