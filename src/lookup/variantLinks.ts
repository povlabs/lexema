// The variants rule `it-empty-reading-variant/v2` links an empty reading to
// (src/italian/emptyReadingVariant.ts, #803), as a lookup reads them: the
// pinned list names each reading by its archive line's digest, and a record
// the lookup reads with that digest gets a lemma link to each variant, at the
// `{{-var-}}` line of its page that names it. `uno`'s article record leads to
// `un`, whose article defines it, as a record whose gloss says "variante di"
// leads to its word. The link is read, never stored: no row is written, and a
// record a later release replaces has another digest and no link. A batch
// lookup reads the same list (src/lookup/batch.ts), so the two answer alike.

import { EMPTY_READING_VARIANT_EVIDENCE } from "../italian/emptyReadingVariantEvidence.js";
import type { EmptyReadingVariant } from "../italian/emptyReadingVariant.js";
import { RAW_PAGE_WIKI } from "../source/rawPage.js";
import type { RecoveredRef } from "./types.js";

/** The list by each reading's archive line digest: the bytes it was measured on, whatever release or line holds them. */
const BY_DIGEST: ReadonlyMap<string, EmptyReadingVariant> = new Map(EMPTY_READING_VARIANT_EVIDENCE.readings.map((reading) => [reading.record.lineSha256, reading]));

/** One variant an empty reading leads to: its word, and the page line that names it. */
export interface VariantLink {
  word: string;
  ref: RecoveredRef;
}

/** The variants the record whose archive line has digest `lineSha256` leads to, in page order; none for every other record. */
export function variantLinksOf(lineSha256: string): VariantLink[] {
  const reading = BY_DIGEST.get(lineSha256);
  if (reading === undefined) return [];
  return reading.variants.map((variant) => ({
    word: variant.word,
    ref: { wiki: RAW_PAGE_WIKI, title: reading.record.word, revisionId: reading.revisionId, line: variant.line.line },
  }));
}
