// A gloss that only repeats its own headword (#395).
//
// Rule it-gloss-stamp/v1 (#317) takes the gender stamp off `presina f` and
// stores `presina`, so presina's one sense reads just the word looked up. A
// meaning that is the headword says nothing, so a lookup reads it as no gloss,
// the way it reads the "definizione mancante" placeholder (placeholder.ts).
// This is a read-time filter only: the stored rows and `source_record_json`
// keep the text as imported, so it is not a source text normalization
// (ADR 0019).

import { normalizeItalianExact } from "./normalize.js";
import { withoutPlaceholder } from "./placeholder.js";

/** Letters and digits; whatever else opens or closes a text is punctuation around it. */
const AROUND = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

/**
 * `text` as the comparison reads it: the exact search normalization (case,
 * Unicode composition, the four apostrophes), accents taken off the way the
 * accent index folds a key (`foldKey` in src/lookup/nearby.ts), and the
 * punctuation around it dropped (`"presina".` reads `presina`).
 */
function echoKey(text: string): string {
  return normalizeItalianExact(text).normalize("NFD").replace(/\p{M}/gu, "").normalize("NFC").replace(AROUND, "");
}

/**
 * Whether `gloss`, a gloss of `word`'s record, is the headword and nothing
 * more. Matched whole: a gloss that merely contains the headword (`presina
 * elettrica`, `piccola presa`) is a meaning and stays.
 */
export function isHeadwordEcho(gloss: string, word: string): boolean {
  const key = echoKey(word);
  return key !== "" && echoKey(gloss) === key;
}

/**
 * A stored gloss of `word`'s record as a lookup shows it, or undefined when
 * it shows nothing: the placeholder taken out (#255), and a gloss that is only
 * the headword dropped (#395).
 */
export function shownGloss(text: string, word: string): string | undefined {
  const real = withoutPlaceholder(text);
  return real === undefined || isHeadwordEcho(real, word) ? undefined : real;
}
