import { containsExactItalianSurface, normalizeItalianExact } from "./normalize.js";

const personLabels = "io|tu|lui|lei|noi|voi|loro|egli|ella|essi|esse";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isQualifyingUsageExample(sentence: string, searchedSurface: string): boolean {
  if (!sentence.trim() || !containsExactItalianSurface(sentence, searchedSurface)) return false;
  const query = escapeRegex(normalizeItalianExact(searchedSurface));
  const conjugationLabel = new RegExp(`^\\s*(?:${personLabels})(?:\\s*/\\s*(?:essi|esse))?\\s+${query}\\s*[.!?]?\\s*$`, "iu");
  return !conjugationLabel.test(normalizeItalianExact(sentence));
}
