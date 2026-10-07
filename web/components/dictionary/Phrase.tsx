// The short page of a searched expression (#214, Huey's page-shape rulings of
// 2026-09-30; design-system-manifest.md § "How a word page renders" § 6): the
// search as typed, then each record of the inflected word as a reading,
// `1 · Voce verbale`. Right under its heading, the word's form entries with
// the lemma replaced by the expression, linked, unnumbered, as a word page's
// form lines read (rule 4 of #695, P11, built by #700). Then *Definitions*,
// the expression's own meanings, as its entry shows them. Closed, each
// expression's first meaning shows, then `+ more`, the one expand control
// every reading has; open, the other meanings show under the first. An
// expression no form line names shows its meanings as a reading of its own
// record. Nothing else of either word shows: no forms, no pronunciation. Then
// one *Source*, to the expression's page.

import { entryKey, type PhraseDefinition } from "@lexema/lookup/types.ts";
import type { PhraseEntry, PhraseMeaning, PhrasePage } from "@/lib/dictionary/phrasePage.ts";
import { searchHref } from "./Forms";
import { More, MoreBlock } from "./More";
import { Block, DefinitionContent, definitionKey, FormLines, leadHoldsMore } from "./Reading";
import { SourceLine } from "./Word";
import {
  DEFINITION,
  DEFINITION_BODY,
  DEFINITION_EXTRA,
  DEFINITION_NUMBER,
  DEFINITION_NUMBER_CLOSED,
  DEFINITION_NUMBER_OPEN,
  DEFINITIONS,
  FORM_LINE,
  FORM_OF_LINE,
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

/** A form line: the word's form entry, the expression in place of its lemma and linked. */
function FormLine({ definition }: { definition: PhraseDefinition }) {
  return (
    <p className={FORM_LINE} lang="it">
      {definition.before}
      <PhraseLink word={definition.phrase} />
      {definition.after}
    </p>
  );
}

/** Whether `+ more` has anything to open: a folded meaning, or a shown one's second example. */
const holdsMore = (meanings: readonly PhraseMeaning[]): boolean =>
  meanings.some((meaning) => meaning.folded || leadHoldsMore(meaning.item));

/**
 * A meaning's number, counting the meanings that show: closed, a second
 * expression's first meaning follows the first's (`2.`); open, the folded
 * meanings count too (`4.`). A folded meaning shows only open, so it has one
 * number.
 */
function MeaningNumber({ meanings, index }: { meanings: readonly PhraseMeaning[]; index: number }) {
  const open = index + 1;
  const closed = meanings.slice(0, open).filter((meaning) => !meaning.folded).length;
  return (
    <span className={DEFINITION_NUMBER} aria-hidden="true">
      {closed === open || meanings[index].folded ? (
        `${open}.`
      ) : (
        <>
          <span className={DEFINITION_NUMBER_CLOSED}>{closed}.</span>
          <span className={DEFINITION_NUMBER_OPEN}>{open}.</span>
        </>
      )}
    </span>
  );
}

const meaningKey = (meaning: PhraseMeaning): string => `meaning-${entryKey(meaning.reading)}-${definitionKey(meaning.item)}`;

/** The expressions' meanings, numbered, under *Definitions*: the one expand control opens the folded ones. */
function Meanings({ owner, meanings }: { owner: string; meanings: readonly PhraseMeaning[] }) {
  if (meanings.length === 0) return null;
  const list = `definition-list-${owner}`;
  return (
    <Block id={`definitions-${owner}`} label="Definitions">
      <MoreBlock kind="definitions">
        <ol className={DEFINITIONS} id={list}>
          {meanings.map((meaning, i) => (
            <li key={meaningKey(meaning)} className={meaning.folded ? DEFINITION_EXTRA : DEFINITION} data-definition={i + 1}>
              <MeaningNumber meanings={meanings} index={i} />
              <div className={DEFINITION_BODY}>
                <DefinitionContent item={meaning.item} reading={meaning.reading} lead={!meaning.folded} />
              </div>
            </li>
          ))}
        </ol>
        {holdsMore(meanings) && <More place="definitions" controls={list} />}
      </MoreBlock>
    </Block>
  );
}

function PhraseReading({ entry: { number, reading, text } }: { entry: PhraseEntry }) {
  return (
    <article
      className={READING}
      id={`reading-${entryKey(reading)}`}
      aria-labelledby={`reading-heading-${entryKey(reading)}`}
      data-record={reading.recordId}
      data-line={reading.ref.lineNo}
    >
      <h2 className={READING_HEADING} id={`reading-heading-${entryKey(reading)}`}>
        <span className={READING_NUMBER}>{number}</span>
        <span className={READING_DOT} aria-hidden="true">
          ·
        </span>
        <span lang="it">{reading.posTitle}</span>
      </h2>
      {text.kind === "form" && (
        <FormLines>
          {text.forms.map((definition) => (
            <FormLine key={`${definition.ref.jsonPointer}-${definition.phrase}`} definition={definition} />
          ))}
        </FormLines>
      )}
      <Meanings owner={entryKey(reading)} meanings={text.meanings} />
    </article>
  );
}

export function PhraseView({ page, siteKey }: { page: PhrasePage; siteKey?: string }) {
  return (
    <>
      <h1 className={WORD_HEADING} lang="it">
        {page.headword}
      </h1>
      <div className={READINGS}>
        {page.readings.map((entry) => (
          <PhraseReading key={entryKey(entry.reading)} entry={entry} />
        ))}
        {page.unnamed.map((word) => (
          <p key={word} className={FORM_OF_LINE}>
            <PhraseLink word={word} />
          </p>
        ))}
      </div>
      <SourceLine page={page} siteKey={siteKey} />
    </>
  );
}
