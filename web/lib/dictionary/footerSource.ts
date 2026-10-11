// What the footer's one *Fonte* credits (ADR 0009, ADR 0032, ADR 0033, #827):
// the Wiktionary page of a word, or, on a page of Wikidata entries alone, the
// Wikidata page of the first: a name entry's item, or a Wikidata word's
// lexeme. One value, so a page cannot credit both or neither.

import { wikidataItemUrl } from "@lexema/lookup/names.ts";
import { lexemePageUrl, sourcePageUrl } from "./sourcePage.ts";
import { nameSourceLinkName, sourceLinkName } from "./wordPageText.ts";

/** The Wiktionary page of `word`: every page with a Wiktionary reading. */
export interface WiktionarySource {
  kind: "wiktionary";
  word: string;
}

/** The Wikidata item of a page's first name entry, on a page of Wikidata entries alone; `word` is its label. */
export interface WikidataSource {
  kind: "wikidata";
  item: `Q${number}`;
  word: string;
}

/** The Wikidata lexeme of a page's first Wikidata word, on a page of Wikidata entries alone; `word` is its lemma. */
export interface LexemeSource {
  kind: "lexeme";
  lexeme: `L${number}`;
  word: string;
}

export type FooterSource = WiktionarySource | WikidataSource | LexemeSource;

export const wiktionarySource = (word: string): WiktionarySource => ({ kind: "wiktionary", word });

/** Where the footer's *Fonte* opens and the name a screen reader reads for it. */
export function footerSourceLink(source: FooterSource): { href: string; name: string } {
  switch (source.kind) {
    case "wiktionary":
      return { href: sourcePageUrl(source.word), name: sourceLinkName(source.word) };
    case "wikidata":
      return { href: wikidataItemUrl(source.item), name: nameSourceLinkName(source.word) };
    case "lexeme":
      return { href: lexemePageUrl(source.lexeme), name: nameSourceLinkName(source.word) };
  }
}
