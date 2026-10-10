// Reading the query out of the URL.
//
// A query string can repeat a name — `?q=sale&q=casa` is a legal URL anyone can
// type or a crawler can build — and the router hands a repeated name back as an
// array. Typing it as a plain string made `.trim()` throw on that URL and the
// page answered with a server error instead of a search.

import { NOT_FOUND } from "./wordPageText.ts";

/** What the router can hand back for one search parameter. */
export type QueryParam = string | string[] | undefined;

/**
 * The one query this page searches for.
 *
 * A repeated parameter is answered with its first value rather than refused:
 * the page can only search for one surface, and the first is the one the URL
 * reads as. Nothing is joined, because `sale casa` is not a word anyone asked
 * for.
 */
export function firstQuery(value: QueryParam): string {
  if (value === undefined) return "";
  return Array.isArray(value) ? (value[0] ?? "") : value;
}

/**
 * What the site calls itself, how that is said, and what it is: the home page
 * shows all three (SearchPage.tsx), the tab's title the first and the last, and
 * a shared link's home card all three again (web/worker/dictionary/card/draw.tsx).
 */
export const SITE_NAME = "Lexema";
export const SITE_PRONUNCIATION = "/lekˈsɛːma/";
export const SITE_TAGLINE = "un dizionario semplice";

/** What the title knows about the answer: the headword found, or that nothing was. */
export type TitleOutcome = { found: string } | "not-found" | undefined;

/** A word's first letter in capitals, as Italian writes it; `Roma` stays `Roma`. */
const capitalised = (word: string): string => {
  const [first = "", ...rest] = [...word];
  return first.toLocaleUpperCase("it-IT") + rest.join("");
};

/**
 * The browser tab's title. Before a query, what Lexema is; on a result, the
 * headword with its first letter in capitals (`Casa — Lexema`), though the page
 * shows it as the source spells it; when nothing was found, `Nessuna voce per
 * “<query>” — Lexema`, as typed, in the words of the page's own heading.
 */
export function pageTitle(query: string, outcome?: TitleOutcome): string {
  const q = query.trim();
  if (q === "") return `${SITE_NAME} — ${SITE_TAGLINE}`;
  if (outcome === "not-found") return `${NOT_FOUND.heading} “${q}” — ${SITE_NAME}`;
  return `${capitalised(outcome?.found ?? q)} — ${SITE_NAME}`;
}
