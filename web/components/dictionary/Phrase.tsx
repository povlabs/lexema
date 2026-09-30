// The short page of a searched expression (#214, Huey's page-shape ruling of
// 2026-09-30; design-system-manifest.md § "The result"): the search as typed,
// then each record of the inflected word as a reading, `1 · Voce verbale`,
// whose definitions are its form entries with the lemma replaced by the
// expression, linked. Nothing else of either word shows: no forms, no
// pronunciation, no meanings. Then *Source*, as on every result.

import type { PhraseDefinition } from "@lexema/lookup/types.ts";
import type { PhrasePage } from "@/lib/dictionary/phrasePage.ts";
import { searchHref } from "./Forms";
import { Block } from "./Reading";
import { SourceLinks } from "./Word";
import {
  DEFINITION,
  DEFINITION_BODY,
  DEFINITION_NUMBER,
  DEFINITIONS,
  FORM_OF_LINE,
  GLOSS,
  GLOSS_LINK,
  READING,
  READING_DOT,
  READING_HEADING,
  READING_NUMBER,
  READINGS,
  WORD_HEADING,
} from "@/components/shared/styles.ts";

function PhraseLink({ word }: { word: string }) {
  return (
    <a className={GLOSS_LINK} href={searchHref(word)} lang="it">
      {word}
    </a>
  );
}

function Line({ definition }: { definition: PhraseDefinition }) {
  return (
    <p className={GLOSS} lang="it">
      {definition.before}
      <PhraseLink word={definition.phrase} />
      {definition.after}
    </p>
  );
}

export function PhraseView({ page, siteKey }: { page: PhrasePage; siteKey?: string }) {
  return (
    <>
      <h1 className={WORD_HEADING} lang="it">
        {page.headword}
      </h1>
      <div className={READINGS}>
        {page.readings.map(({ number, reading }) => (
          <article
            key={reading.recordId}
            className={READING}
            id={`reading-${reading.recordId}`}
            aria-labelledby={`reading-heading-${reading.recordId}`}
            data-record={reading.recordId}
            data-line={reading.ref.lineNo}
          >
            <h2 className={READING_HEADING} id={`reading-heading-${reading.recordId}`}>
              <span className={READING_NUMBER}>{number}</span>
              <span className={READING_DOT} aria-hidden="true">
                ·
              </span>
              <span lang="it">{reading.posTitle}</span>
            </h2>
            <Block id={`definitions-${reading.recordId}`} label="Definitions">
              <ol className={DEFINITIONS}>
                {reading.definitions.map((definition, i) => (
                  <li key={definition.ref.jsonPointer + definition.phrase} className={DEFINITION} data-definition={i + 1}>
                    <span className={DEFINITION_NUMBER} aria-hidden="true">
                      {i + 1}.
                    </span>
                    <div className={DEFINITION_BODY}>
                      <Line definition={definition} />
                    </div>
                  </li>
                ))}
              </ol>
            </Block>
          </article>
        ))}
        {page.unnamed.map((word) => (
          <p key={word} className={FORM_OF_LINE}>
            <PhraseLink word={word} />
          </p>
        ))}
      </div>
      <SourceLinks page={page} siteKey={siteKey} />
    </>
  );
}
