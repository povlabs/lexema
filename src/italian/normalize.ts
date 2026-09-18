export const IT_NORMALIZER_VERSION = "it-normalize/v1" as const;

const apostrophes = /['’‘ʼ]/gu;

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
