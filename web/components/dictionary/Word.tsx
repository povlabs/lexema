// One word's page: the headword with its pronunciation, jump links when there
// are three readings or more, or two readings about two different words
// (design-system-manifest.md § 2; a verb form block, `1 Voce verbale · salire`,
// counts as one reading), the readings in source order, then the facts
// about the word once, its expressions last among them, then *Source* (design-system-manifest.md § "The result").
//
// Which records are readings and which lemma tables they carry is
// `wordPage.ts`; this file only lays the answer out.

import { factRefKey, type EntryIdentity, type WordFacts } from "@lexema/lookup/types.ts";
import { ExternalIcon } from "@/components/shared/icons";
import { Expressions } from "./Expressions";
import { NEW_TAB } from "@/components/shared/ExternalLink";
import { OneLine } from "./OneLine";
import { GridFormBlockView, ReadingView, VerbFormBlockView } from "./Reading";
import { ReportDialog } from "./ReportDialog";
import { reportReadings, type ReportReading } from "@/lib/dictionary/report.ts";
import { sourcePageUrl } from "@/lib/dictionary/sourcePage.ts";
import { WordList } from "./WordList";
import { PRONUNCIATION_LABEL, READINGS_NAV, SECTION_LABEL, SOURCE_LABEL, sourceLinkName } from "@/lib/dictionary/wordPageText.ts";
import {
  entryTitle,
  expressionRows,
  numberedEntries,
  readingAnchor,
  showsJumpLinks,
  shownRecords,
  type ExpressionSection,
  type WordLists,
  type WordPage,
} from "@/lib/dictionary/wordPage.ts";
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

export { WORD_LIST_SLICE } from "./WordList";

/** The IPA under the headword; the source's own qualifier tells several apart. */
function Pronunciation({ facts }: { facts: WordFacts }) {
  const { pronunciations } = facts;
  if (pronunciations.length === 0) return null;
  return (
    <p className={PRONUNCIATION} aria-label={PRONUNCIATION_LABEL} lang="it">
      {pronunciations.map((sound, i) => (
        <span key={factRefKey(sound.ref)}>
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
  const entries = numberedEntries(page.readings);
  if (entries === undefined || !showsJumpLinks(page)) return null;
  return (
    <nav aria-label={READINGS_NAV} lang="it">
      <ul className={JUMP_LINKS}>
        {entries.map((entry) => (
          <li key={readingAnchor(entry)}>
            <a className={JUMP_LINK} href={`#${readingAnchor(entry)}`}>
              <span className={JUMP_NUMBER}>{entry.number}</span>
              <span lang="it">{entryTitle(entry)}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}


function WordFactsView({
  facts,
  lists,
  expressions,
}: {
  facts: WordFacts;
  lists: WordLists;
  expressions: ExpressionSection | undefined;
}) {
  const any =
    facts.etymologies.length + lists.synonyms.length + lists.antonyms.length + lists.derived.length > 0 || expressions !== undefined;
  if (!any) return null;
  return (
    <div className={WORD_FACTS}>
      {facts.etymologies.length > 0 && (
        <section className={WORD_BLOCK} aria-labelledby="etymology">
          <h2 className={BLOCK_LABEL} id="etymology" lang="it">
            {SECTION_LABEL.etymology}
          </h2>
          {facts.etymologies.map((etymology) => (
            <OneLine key={factRefKey(etymology.ref)} text={etymology.text} lang="it" />
          ))}
        </section>
      )}
      <WordList id="synonyms" label={SECTION_LABEL.synonyms} items={lists.synonyms} />
      <WordList id="antonyms" label={SECTION_LABEL.antonyms} items={lists.antonyms} />
      <WordList id="derived" label={SECTION_LABEL.derived} items={lists.derived} />
      {expressions !== undefined && <Expressions id="expressions-0" expressions={expressionRows(expressions)} />}
    </div>
  );
}

/** What the footer needs of a result: the page its content is credited to, and the readings a report can name. */
export interface FooterFacts {
  /** The word whose Wiktionary page the one *Source* link opens. */
  sourceWord: string;
  /** The word a report is about. */
  headword: string;
  /** Each reading a report can name, with its number on the page. */
  readings: readonly { number: ReportReading["number"]; reading: EntryIdentity & { posTitle: string } }[];
}

/** One *Source*, to the Wiktionary page of the page's word, then *Segnala un errore* (ADR 0009, amended on #281). */
export function SourceLine({ page, siteKey }: { page: FooterFacts; siteKey: string | undefined }) {
  return (
    <footer className={SOURCE_LINE} lang="it">
      <a
        className={SOURCE_LINK}
        href={sourcePageUrl(page.sourceWord)}
        {...NEW_TAB}
        aria-label={sourceLinkName(page.sourceWord)}
      >
        {SOURCE_LABEL}
        <ExternalIcon className={ICON} />
      </a>
      <span aria-hidden="true">·</span>
      <ReportDialog
        word={page.headword}
        subject={{ kind: "mistake", readings: reportReadings(page.readings) }}
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
        {page.readings.map((entry) =>
          entry.kind === "verb-form" ? (
            <VerbFormBlockView key={readingAnchor(entry)} block={entry} />
          ) : entry.kind === "grid-form" ? (
            <GridFormBlockView key={readingAnchor(entry)} block={entry} />
          ) : (
            <ReadingView key={readingAnchor(entry)} entry={entry} />
          ),
        )}
      </div>
      <WordFactsView facts={page.wordFacts} lists={page.wordLists} expressions={page.expressions} />
      <SourceLine page={{ ...page, readings: shownRecords(page.readings) }} siteKey={siteKey} />
    </>
  );
}
