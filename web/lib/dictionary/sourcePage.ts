// Where a word can be checked by hand, for the page's Source link and the
// API's attribution alike (ADR 0009).

const WIKTIONARY_PAGE = "https://it.wiktionary.org/wiki/";

/**
 * Every record came from the Italian Wiktionary page of its headword; the
 * source stores no URL, so it is built from the headword. The full credit is
 * on `/attribution`.
 */
export function sourcePageUrl(word: string): string {
  return WIKTIONARY_PAGE + encodeURIComponent(word.replace(/ /g, "_"));
}
