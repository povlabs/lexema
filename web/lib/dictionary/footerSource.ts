// What the footer's one *Fonte* credits (ADR 0009, ADR 0032, ADR 0033, #827):
// the Wiktionary page of a word; on a page a hand-kept reading heads, the
// en.wiktionary revision it cites (ADR 0031, #856); or, on a page of Wikidata
// entries alone, the Wikidata page of the first: a name entry's item, or a
// Wikidata word's lexeme; or, on a page of a rule-built cardinal alone, Lexema's
// Licenza page (ADR 0034, #804). One value, so a page cannot credit two or none.

import { wikidataItemUrl } from "@lexema/lookup/names.ts";
import type { CitedRevision } from "@lexema/lookup/types.ts";
import { citedRevisionUrl, lexemePageUrl, LICENCE_PAGE_PATH, sourcePageUrl } from "./sourcePage.ts";
import { citedRevisionLinkName, licenceSourceLinkName, nameSourceLinkName, sourceLinkName } from "./wordPageText.ts";

/** The Wiktionary page of `word`: every page with a Wiktionary reading. */
export interface WiktionarySource {
  kind: "wiktionary";
  word: string;
}

/**
 * The en.wiktionary revision a hand-kept reading cites, on a page that reading
 * heads: it.wiktionary has no page it was read from (`eguaglianza`, `Sig.`;
 * Huey's ruling of 2026-10-17 on #856). `word` is the reading's.
 */
export interface CitedRevisionSource {
  kind: "cited-revision";
  cites: CitedRevision;
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

/**
 * Lexema's Licenza page, on a page whose one reading is a cardinal rule
 * `it-cardinal/v1` built (`duemilauno`): no source states it, so no source
 * page holds it (ADR 0034; Huey's ruling of 2026-10-18 on #804). `word` is
 * the reading's.
 */
export interface LicenceSource {
  kind: "licence";
  word: string;
}

export type FooterSource = WiktionarySource | CitedRevisionSource | WikidataSource | LexemeSource | LicenceSource;

export const wiktionarySource = (word: string): WiktionarySource => ({ kind: "wiktionary", word });

/** Where the footer's *Fonte* opens and the name a screen reader reads for it. */
export function footerSourceLink(source: FooterSource): { href: string; name: string } {
  switch (source.kind) {
    case "wiktionary":
      return { href: sourcePageUrl(source.word), name: sourceLinkName(source.word) };
    case "cited-revision":
      return { href: citedRevisionUrl(source.cites), name: citedRevisionLinkName(source.word) };
    case "wikidata":
      return { href: wikidataItemUrl(source.item), name: nameSourceLinkName(source.word) };
    case "lexeme":
      return { href: lexemePageUrl(source.lexeme), name: nameSourceLinkName(source.word) };
    case "licence":
      return { href: LICENCE_PAGE_PATH, name: licenceSourceLinkName(source.word) };
  }
}
