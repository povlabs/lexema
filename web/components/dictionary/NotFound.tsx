// A search that found nothing (board 24): `Nessuna voce per "<query>"`, then what
// src/lookup/nearby.ts offers instead, in the order it tried them.
//
// A · words that begin with what was typed;
// B · the same letters with an accent, as "Forse cercavi città?";
// C · a spelling one edit away, as "Forse cercavi mangiare?";
// P · a query of several words corrected so that it reads as an expression,
//     kept as typed: "Forse cercavi vado via?" for `vadoo via` (#214), which
//     opens `vado via`'s short page; then any other correction;
// D · nothing close, and a line on how to search instead.
//
// The corrected queries also join the list after B or C.
//
// Every word offered is a link to its own search. The page says nothing about
// how the offers were found.
//
// Below the offers, in the word page's footer row, one `Segnala una parola mancante`
// opens the word page's report box on the query (#441).

import type { Nearby } from "@lexema/lookup/nearby.ts";
import type { PhraseOffer } from "@lexema/lookup/phrase.ts";
import { searchHref } from "./Forms";
import { ReportDialog } from "./ReportDialog";
import { WordList } from "./WordList";
import type { RelatedItem } from "@/lib/dictionary/relatedList.ts";
import { NOT_FOUND_HEADING, NOT_FOUND_LEAD, NOT_FOUND_LINK, NOT_FOUND_TEXT, SOURCE_LINE } from "@/components/shared/styles.ts";
import { DID_YOU_MEAN, NOT_FOUND } from "@/lib/dictionary/wordPageText.ts";

const words = (list: readonly string[]): RelatedItem[] => list.map((word) => ({ kind: "word", word }));
const phrases = (offers: readonly PhraseOffer[]): string[] => offers.map((offer) => offer.phrase);

function DidYouMean({ word }: { word: string }) {
  return (
    <p className={NOT_FOUND_LEAD} lang="it">
      {DID_YOU_MEAN}{" "}
      <a className={NOT_FOUND_LINK} href={searchHref(word)} lang="it">
        {word}
      </a>
      ?
    </p>
  );
}

export function NotFound({ query, nearby, siteKey }: { query: string; nearby: Nearby; siteKey?: string }) {
  return (
    <>
      <h1 className={NOT_FOUND_HEADING} lang="it">
        {NOT_FOUND.heading} “{query}”
      </h1>
      {nearby.kind === "prefix" && (
        <>
          <p className={NOT_FOUND_TEXT} lang="it">
            {NOT_FOUND.prefixLead} “{query}”:
          </p>
          <WordList id="nearby" label={NOT_FOUND.suggestions} items={words(nearby.words)} />
        </>
      )}
      {(nearby.kind === "accent" || nearby.kind === "typo") && (
        <>
          <DidYouMean word={nearby.best} />
          <WordList
            id="nearby"
            label={nearby.kind === "accent" ? NOT_FOUND.accentOthers(query) : NOT_FOUND.typoOthers}
            items={words([...nearby.others, ...phrases(nearby.phrases)])}
          />
        </>
      )}
      {nearby.kind === "phrase" && (
        <>
          <DidYouMean word={nearby.best.phrase} />
          <WordList id="nearby" label={NOT_FOUND.phraseOthers} items={words(phrases(nearby.others))} />
        </>
      )}
      {nearby.kind === "none" && (
        <p className={NOT_FOUND_TEXT} lang="it">
          {NOT_FOUND.nothingClose}
        </p>
      )}
      <footer className={SOURCE_LINE} lang="it">
        <ReportDialog word={query} subject={{ kind: "missing" }} siteKey={siteKey} />
      </footer>
    </>
  );
}
