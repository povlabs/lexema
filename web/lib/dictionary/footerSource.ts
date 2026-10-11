// What the footer's one *Fonte* credits (ADR 0009, ADR 0032, #827): the
// Wiktionary page of a word, or, on a page of name entries alone, the Wikidata
// item of the first. One value, so a page cannot credit both or neither.

import { wikidataItemUrl } from "@lexema/lookup/names.ts";
import { sourcePageUrl } from "./sourcePage.ts";
import { nameSourceLinkName, sourceLinkName } from "./wordPageText.ts";

/** The Wiktionary page of `word`: every page with a Wiktionary reading. */
export interface WiktionarySource {
  kind: "wiktionary";
  word: string;
}

/** The Wikidata item of a page's first name entry, on a page of name entries alone; `word` is its label. */
export interface WikidataSource {
  kind: "wikidata";
  item: `Q${number}`;
  word: string;
}

export type FooterSource = WiktionarySource | WikidataSource;

export const wiktionarySource = (word: string): WiktionarySource => ({ kind: "wiktionary", word });

/** Where the footer's *Fonte* opens and the name a screen reader reads for it. */
export function footerSourceLink(source: FooterSource): { href: string; name: string } {
  switch (source.kind) {
    case "wiktionary":
      return { href: sourcePageUrl(source.word), name: sourceLinkName(source.word) };
    case "wikidata":
      return { href: wikidataItemUrl(source.item), name: nameSourceLinkName(source.word) };
  }
}
