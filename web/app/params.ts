// Reading the query out of the URL.
//
// A query string can repeat a name — `?q=sale&q=casa` is a legal URL anyone can
// type or a crawler can build — and the router hands a repeated name back as an
// array. Typing it as a plain string made `.trim()` throw on that URL and the
// page answered with a server error instead of a search.

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

/** The browser tab's title: the word on a result, and what Lexema is before a query. */
export function pageTitle(query: string): string {
  const q = query.trim();
  return q === "" ? "Lexema — a simple dictionary" : `${q} — Lexema`;
}
