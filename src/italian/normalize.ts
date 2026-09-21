export const IT_NORMALIZER_VERSION = "it-normalize/v1" as const;

/**
 * The apostrophes a query and a source spelling are allowed to differ by:
 * U+0027 straight, U+2019 right single quote, U+2018 left single quote and
 * U+02BC modifier letter apostrophe. All four occur as apostrophes in the
 * archive's headwords; every other character stays as typed, U+00B4 acute
 * accent included. Widening this set changes the stored keys, so it is a
 * normalizer version change, not an edit.
 */
const apostrophes = /['\u2019\u2018\u02bc]/gu;

export function normalizeItalianExact(value: string): string {
  return value.trim().normalize("NFC").replace(apostrophes, "'").toLocaleLowerCase("it-IT");
}

export function containsExactItalianSurface(sentence: string, surface: string): boolean {
  const normalizedSentence = normalizeItalianExact(sentence);
  const normalizedSurface = normalizeItalianExact(surface);
  if (!normalizedSurface) return false;

  const escaped = normalizedSurface.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{M}])${escaped}(?=$|[^\\p{L}\\p{M}])`, "u").test(normalizedSentence);
}
