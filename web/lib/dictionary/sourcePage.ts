// Where a word can be checked by hand, for the page's Source link and the
// API's attribution alike (ADR 0009).

export { lexemePageUrl } from "@lexema/lookup/wikidataWords.ts";

const WIKTIONARY_PAGE = "https://it.wiktionary.org/wiki/";

/**
 * Every record came from the Italian Wiktionary page of its headword; the
 * source stores no URL, so it is built from the headword. The full credit is
 * on `/licence`. A Wikidata word (ADR 0033) is checked on its lexeme's page
 * instead, `lexemePageUrl`.
 */
export function sourcePageUrl(word: string): string {
  return WIKTIONARY_PAGE + encodeURIComponent(word.replace(/ /g, "_"));
}
