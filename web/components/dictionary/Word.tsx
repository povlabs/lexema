// One word's page: the headword with its pronunciation, jump links when there
// are three readings or more, the readings in source order, then the facts
// about the word once, then *Source* (design-system-manifest.md § "The result").
//
// Which records are readings and which lemma tables they carry is
// `wordPage.ts`; this file only lays the answer out.

import type { WordFacts } from "@lexema/lookup/types.ts";
import { ExternalIcon } from "@/components/shared/icons";
import { NEW_TAB } from "@/components/shared/ExternalLink";
import { OneLine } from "./OneLine";
import { ReadingView } from "./Reading";
import { ReportDialog, type ReportReading } from "./ReportDialog";
import { sourcePageUrl } from "@/lib/dictionary/sourcePage.ts";
import { WordList } from "./WordList";
import type { WordLists, WordPage } from "@/lib/dictionary/wordPage.ts";
import {
  BLOCK_LABEL,
  WORD_BLOCK,
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
} from "@/components/shared/styles.ts";

/** Jump links appear from this many readings up. */
export const JUMP_LINKS_FROM = 3;

export { WORD_LIST_SLICE } from "./WordList";

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
              {number !== undefined && <span className={JUMP_NUMBER}>{number}</span>}
              <span lang="it">{reading.posTitle}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}


function WordFactsView({ facts, lists }: { facts: WordFacts; lists: WordLists }) {
  const any = facts.etymologies.length + lists.synonyms.length + lists.antonyms.length + lists.derived.length > 0;
  if (!any) return null;
  return (
    <div className={WORD_FACTS}>
      {facts.etymologies.length > 0 && (
        <section className={WORD_BLOCK} aria-labelledby="etymology">
          <h2 className={BLOCK_LABEL} id="etymology">
            Etymology
          </h2>
          {facts.etymologies.map((etymology) => (
            <OneLine key={etymology.ref.jsonPointer} text={etymology.text} lang="it" />
          ))}
        </section>
      )}
      <WordList id="synonyms" label="Synonyms" items={lists.synonyms} />
      <WordList id="antonyms" label="Antonyms" items={lists.antonyms} />
      <WordList id="derived" label="Derived words" items={lists.derived} />
    </div>
  );
}

/** What the footer needs of a result: the page its content is credited to, and the readings a report can name. */
export interface FooterFacts {
  /** The word whose Wiktionary page the one *Source* link opens. */
  sourceWord: string;
  /** The word a report is about. */
  headword: string;
  /** Each reading a report can name, with its number on the page; a word page leaves a reading with no definition unnumbered. */
  readings: readonly { number: ReportReading["number"]; reading: { recordId: number; posTitle: string } }[];
}

/** One *Source*, to the Wiktionary page of the page's word, then *Report a mistake* (ADR 0009, amended on #281). */
export function SourceLine({ page, siteKey }: { page: FooterFacts; siteKey: string | undefined }) {
  return (
    <footer className={SOURCE_LINE}>
      <a
        className={SOURCE_LINK}
        href={sourcePageUrl(page.sourceWord)}
        {...NEW_TAB}
        aria-label={`Wiktionary page for ${page.sourceWord}, the source of this page (opens in a new tab)`}
      >
        Source
        <ExternalIcon className={ICON} />
      </a>
      <span aria-hidden="true">·</span>
      <ReportDialog
        word={page.headword}
        readings={page.readings.map(({ number, reading }) => ({ number, recordId: reading.recordId, posTitle: reading.posTitle }))}
        siteKey={siteKey}
      />
    </footer>
  );
}

export function WordView({ page, siteKey }: { page: WordPage; siteKey?: string }) {
  return (
    <>
      <h1 className={WORD_HEADING} lang="it">
        {page.headword}
      </h1>
      <Pronunciation facts={page.wordFacts} />
      <JumpLinks page={page} />
      <div className={READINGS}>
        {page.readings.map((entry) => (
          <ReadingView key={entry.reading.recordId} entry={entry} />
        ))}
      </div>
      <WordFactsView facts={page.wordFacts} lists={page.wordLists} />
      <SourceLine page={page} siteKey={siteKey} />
    </>
  );
}
