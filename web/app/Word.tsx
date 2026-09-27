// One word's page: the headword with its pronunciation, jump links when there
// are three readings or more, the readings in source order, then the facts
// about the word once, then *Source* (design-system-manifest.md § "The result").
//
// Which records are readings and which lemma tables they carry is
// `wordPage.ts`; this file only lays the answer out.

import type { WordFacts } from "@lexema/lookup/types.ts";
import { ExternalIcon } from "./icons";
import { ReadingView } from "./Reading";
import { WordList } from "./WordList";
import type { WordPage } from "./wordPage.ts";
import {
  BLOCK_LABEL,
  ETYMOLOGY,
  ICON,
  JUMP_LINK,
  JUMP_LINKS,
  JUMP_NUMBER,
  PRONUNCIATION,
  PRONUNCIATION_NOTE,
  READINGS,
  SOURCE_LINE,
  SOURCE_LINK,
  WORD_FACTS,
  WORD_HEADING,
} from "./styles.ts";

/** Jump links appear from this many readings up. */
export const JUMP_LINKS_FROM = 3;

export { WORD_LIST_SLICE } from "./WordList";

/**
 * Where a word can be checked by hand. Every record came from the Italian
 * Wiktionary page of its headword; the source stores no URL, so it is built
 * from the headword (ADR 0009). The full credit is on `/attribution`.
 */
const WIKTIONARY_PAGE = "https://it.wiktionary.org/wiki/";

export function sourcePageUrl(word: string): string {
  return WIKTIONARY_PAGE + encodeURIComponent(word.replace(/ /g, "_"));
}

/** The IPA under the headword; the source's own qualifier tells several apart. */
function Pronunciation({ facts }: { facts: WordFacts }) {
  const { pronunciations } = facts;
  if (pronunciations.length === 0) return null;
  return (
    <p className={PRONUNCIATION} aria-label="Pronunciation">
      {pronunciations.map((sound, i) => (
        <span key={sound.ref.jsonPointer}>
          {i > 0 && " · "}
          {sound.ipa}
          {pronunciations.length > 1 && sound.note !== null && (
            <span className={PRONUNCIATION_NOTE} lang="it">
              {sound.note}
            </span>
          )}
        </span>
      ))}
    </p>
  );
}

function JumpLinks({ page }: { page: WordPage }) {
  if (page.readings.length < JUMP_LINKS_FROM) return null;
  return (
    <nav aria-label="Readings">
      <ul className={JUMP_LINKS}>
        {page.readings.map(({ number, reading }) => (
          <li key={reading.recordId}>
            <a className={JUMP_LINK} href={`#reading-${reading.recordId}`}>
              <span className={JUMP_NUMBER}>{number}</span>
              <span lang="it">{reading.posTitle}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}


function WordFactsView({ facts }: { facts: WordFacts }) {
  const any = facts.etymologies.length + facts.synonyms.length + facts.antonyms.length + facts.derived.length > 0;
  if (!any) return null;
  return (
    <div className={WORD_FACTS}>
      {facts.etymologies.length > 0 && (
        <section aria-labelledby="etymology">
          <h2 className={BLOCK_LABEL} id="etymology">
            Etymology
          </h2>
          {facts.etymologies.map((etymology) => (
            <p key={etymology.ref.jsonPointer} className={ETYMOLOGY} lang="it">
              {etymology.text}
            </p>
          ))}
        </section>
      )}
      <WordList id="synonyms" label="Synonyms" words={facts.synonyms} />
      <WordList id="antonyms" label="Antonyms" words={facts.antonyms} />
      <WordList id="derived" label="Derived words" words={facts.derived} />
    </div>
  );
}

/** *Source* to each Wiktionary page the readings come from; normally exactly one. */
function SourceLinks({ words }: { words: readonly string[] }) {
  return (
    <footer className={SOURCE_LINE}>
      {words.map((word, i) => (
        <span key={word} className="inline-flex items-center gap-3">
          {i > 0 && <span aria-hidden="true">·</span>}
          <a
            className={SOURCE_LINK}
            href={sourcePageUrl(word)}
            rel="noreferrer"
            aria-label={`Wiktionary page for ${word}, the source of this page`}
          >
            Source
            {words.length > 1 && <span lang="it">{word}</span>}
            <ExternalIcon className={ICON} />
          </a>
        </span>
      ))}
    </footer>
  );
}

export function WordView({ page, query }: { page: WordPage; query: string }) {
  return (
    <>
      <h1 className={WORD_HEADING} lang="it">
        {page.headword}
      </h1>
      <Pronunciation facts={page.wordFacts} />
      <JumpLinks page={page} />
      <div className={READINGS}>
        {page.readings.map((entry) => (
          <ReadingView key={entry.reading.recordId} entry={entry} query={query} />
        ))}
      </div>
      <WordFactsView facts={page.wordFacts} />
      <SourceLinks words={page.sourceWords} />
    </>
  );
}
