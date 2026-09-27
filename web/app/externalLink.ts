// A link that leaves Lexema — a Source page on Wiktionary, a review's
// evidence — opens in a new tab, so the result stays where the reader left it.
// `noopener` keeps the new page from reaching back into this one; `noreferrer`
// sends it no referrer. Links inside Lexema (`/?q=…`) stay in the same tab.

export const NEW_TAB = { target: "_blank", rel: "noopener noreferrer" } as const;
