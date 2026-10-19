// Where a word can be checked by hand, for the page's Source link and the
// API's attribution alike (ADR 0009).

export { lexemePageUrl } from "@lexema/lookup/wikidataWords.ts";
export { citedRevisionUrl } from "@lexema/lookup/handKept.ts";

const WIKTIONARY_PAGE = "https://it.wiktionary.org/wiki/";

/**
 * Every record came from the Italian Wiktionary page of its headword; the
 * source stores no URL, so it is built from the headword. The full credit is
 * on `/licence`. A Wikidata word (ADR 0033) is checked on its lexeme's page
 * instead, `lexemePageUrl`, and a hand-kept reading (ADR 0031) on the
 * en.wiktionary revision it cites, `citedRevisionUrl` (#856).
 */
export function sourcePageUrl(word: string): string {
  return WIKTIONARY_PAGE + encodeURIComponent(word.replace(/ /g, "_"));
}

/**
 * Where a cardinal rule `it-cardinal/v1` built (ADR 0034) is credited: the
 * Licenza page, since no source states it and Lexema made it (Huey's ruling
 * of 2026-10-18 on #804). The page's *Fonte* opens it on the site it is on.
 */
export const LICENCE_PAGE_PATH = "/licence";
