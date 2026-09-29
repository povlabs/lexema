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
 * shows it as the source spells it; when nothing was found, `No entry for
 * "<query>" — Lexema`, as typed.
 */
export function pageTitle(query: string, outcome?: TitleOutcome): string {
  const q = query.trim();
  if (q === "") return "Lexema — a simple dictionary";
  if (outcome === "not-found") return `No entry for "${q}" — Lexema`;
  return `${capitalised(outcome?.found ?? q)} — Lexema`;
}
