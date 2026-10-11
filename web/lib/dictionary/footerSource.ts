// What the footer's one *Fonte* credits (ADR 0009, ADR 0032, #827): the
// Wiktionary page of a word, the Wikidata item of the one name entry a page
// shows, or nothing. One value, so a page cannot credit both or forget which.

import { wikidataItemUrl } from "@lexema/lookup/names.ts";
import { sourcePageUrl } from "./sourcePage.ts";
import { nameSourceLinkName, sourceLinkName } from "./wordPageText.ts";

/** The Wiktionary page of `word`: every page but one of name entries alone. */
export interface WiktionarySource {
  kind: "wiktionary";
  word: string;
}

/** The Wikidata item of the page's one shown reading, a name entry; `word` is its label. */
export interface WikidataSource {
  kind: "wikidata";
  item: `Q${number}`;
  word: string;
}

/** No footer *Fonte*: a page of several name entries, each crediting its own item. */
export interface NoSource {
  kind: "none";
}

export type FooterSource = WiktionarySource | WikidataSource | NoSource;

export const wiktionarySource = (word: string): WiktionarySource => ({ kind: "wiktionary", word });

export const NO_SOURCE: NoSource = { kind: "none" };

/** Where the footer's *Fonte* opens and the name a screen reader reads for it; none when the footer credits nothing. */
export function footerSourceLink(source: FooterSource): { href: string; name: string } | undefined {
  switch (source.kind) {
    case "wiktionary":
      return { href: sourcePageUrl(source.word), name: sourceLinkName(source.word) };
    case "wikidata":
      return { href: wikidataItemUrl(source.item), name: nameSourceLinkName(source.word) };
    case "none":
      return undefined;
  }
}

/** Whether the footer already credits a name entry's item, so the entry shows no *Fonte* of its own. */
export const creditsItem = (source: FooterSource, item: `Q${number}`): boolean => source.kind === "wikidata" && source.item === item;
