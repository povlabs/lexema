// A search that found nothing (board 24): `No entry for "<query>"`, then what
// src/lookup/nearby.ts offers instead, in the order it tried them.
//
// A · words that begin with what was typed;
// B · the same letters with an accent, as "Did you mean città?";
// C · a spelling one edit away, as "Did you mean mangiare?";
// P · a query of several words corrected so that it reads as an expression,
//     kept as typed: "Did you mean vado via?" for `vadoo via` (#214), which
//     opens `vado via`'s short page; then any other correction;
// D · nothing close, and a line on how to search instead.
//
// The corrected queries also join the list after B or C.
//
// Every word offered is a link to its own search. The page says nothing about
// how the offers were found.

import type { Nearby } from "@lexema/lookup/nearby.ts";
import type { PhraseOffer } from "@lexema/lookup/phrase.ts";
import { searchHref } from "./Forms";
import { WordList } from "./WordList";
import type { RelatedItem } from "@/lib/dictionary/relatedList.ts";
import { NOT_FOUND_HEADING, NOT_FOUND_LEAD, NOT_FOUND_LINK, NOT_FOUND_TEXT } from "@/components/shared/styles.ts";

const words = (list: readonly string[]): RelatedItem[] => list.map((word) => ({ kind: "word", word }));
const phrases = (offers: readonly PhraseOffer[]): string[] => offers.map((offer) => offer.phrase);

function DidYouMean({ word }: { word: string }) {
  return (
    <p className={NOT_FOUND_LEAD}>
      Did you mean{" "}
      <a className={NOT_FOUND_LINK} href={searchHref(word)} lang="it">
        {word}
      </a>
      ?
    </p>
  );
}

export function NotFound({ query, nearby }: { query: string; nearby: Nearby }) {
  return (
    <>
      <h1 className={NOT_FOUND_HEADING}>
        No entry for “<span lang="it">{query}</span>”
      </h1>
      {nearby.kind === "prefix" && (
        <>
          <p className={NOT_FOUND_TEXT}>
            Lexema has no word spelled this way. Words that begin with “<span lang="it">{query}</span>”:
          </p>
          <WordList id="nearby" label="Suggestions" items={words(nearby.words)} />
        </>
      )}
      {(nearby.kind === "accent" || nearby.kind === "typo") && (
        <>
          <DidYouMean word={nearby.best} />
          <WordList
            id="nearby"
            label={nearby.kind === "accent" ? `Other words that begin with “${query}”` : "Other close spellings"}
            items={words([...nearby.others, ...phrases(nearby.phrases)])}
          />
        </>
      )}
      {nearby.kind === "phrase" && (
        <>
          <DidYouMean word={nearby.best.phrase} />
          <WordList id="nearby" label="Other expressions" items={words(phrases(nearby.others))} />
        </>
      )}
      {nearby.kind === "none" && (
        <p className={NOT_FOUND_TEXT}>
          Lexema has no word spelled this way. Check the spelling, or search for the word’s base form: the
          infinitive of a verb, the singular of a noun.
        </p>
      )}
    </>
  );
}
