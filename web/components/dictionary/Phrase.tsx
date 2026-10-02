import { entryKey } from "@lexema/lookup/types.ts";
// The short page of a searched expression (#214, Huey's page-shape rulings of
// 2026-09-30; design-system-manifest.md § "The result"): the search as typed,
// then each record of the inflected word as a reading, `1 · Voce verbale`,
// whose definitions are the expression's own meanings, as its entry shows
// them, then the word's form entries with the lemma replaced by the
// expression, linked. Closed, the first meaning and the form lines show, then
// `+ more`, the one expand control every reading has; open, the other
// meanings show under the first. An expression no form line names shows its
// meanings as a reading of its own record. Nothing else of either word shows:
// no forms, no pronunciation. Then one *Source*, to the expression's page.

import type { PhraseDefinition } from "@lexema/lookup/types.ts";
import type { PhraseLine, PhrasePage } from "@/lib/dictionary/phrasePage.ts";
import { searchHref } from "./Forms";
import { More, MoreBlock } from "./More";
import { Block, DefinitionContent, definitionKey, leadHoldsMore } from "./Reading";
import { SourceLine } from "./Word";
import {
  DEFINITION,
  DEFINITION_BODY,
  DEFINITION_EXTRA,
  DEFINITION_NUMBER,
  DEFINITION_NUMBER_CLOSED,
  DEFINITION_NUMBER_OPEN,
  DEFINITIONS,
  DEFINITIONS_GROUP,
  DEFINITIONS_MORE,
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

function FormLine({ definition }: { definition: PhraseDefinition }) {
  return (
    <p className={GLOSS} lang="it">
      {definition.before}
      <PhraseLink word={definition.phrase} />
      {definition.after}
    </p>
  );
}

const isFolded = (line: PhraseLine): boolean => line.kind === "meaning" && line.folded;

/** Whether `+ more` has anything to open: a folded meaning, or a shown one's second example. */
const holdsMore = (lines: readonly PhraseLine[]): boolean =>
  lines.some((line) => isFolded(line) || (line.kind === "meaning" && leadHoldsMore(line.item)));

/**
 * A line's number, counting the lines that show: closed, a form line follows
 * the first meaning (`2.`); open, the folded meanings count too (`4.`). A
 * folded line shows only open, so it has one number.
 */
function LineNumber({ lines, index }: { lines: readonly PhraseLine[]; index: number }) {
  const open = index + 1;
  const closed = lines.slice(0, open).filter((line) => !isFolded(line)).length;
  return (
    <span className={DEFINITION_NUMBER} aria-hidden="true">
      {closed === open || isFolded(lines[index]) ? (
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

const lineKey = (line: PhraseLine): string =>
  line.kind === "meaning"
    ? `meaning-${entryKey(line.reading)}-${definitionKey(line.item)}`
    : `form-${line.definition.ref.jsonPointer}-${line.definition.phrase}`;

export function PhraseView({ page, siteKey }: { page: PhrasePage; siteKey?: string }) {
  return (
    <>
      <h1 className={WORD_HEADING} lang="it">
        {page.headword}
      </h1>
      <div className={READINGS}>
        {page.readings.map(({ number, reading, lines }) => (
          <article
            key={entryKey(reading)}
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
            <Block id={`definitions-${entryKey(reading)}`} label="Definitions">
              <MoreBlock className={DEFINITIONS_GROUP}>
                <ol className={DEFINITIONS} id={`definition-list-${entryKey(reading)}`}>
                  {lines.map((line, i) => (
                    <li
                      key={lineKey(line)}
                      className={isFolded(line) ? DEFINITION_EXTRA : DEFINITION}
                      data-definition={i + 1}
                    >
                      <LineNumber lines={lines} index={i} />
                      <div className={DEFINITION_BODY}>
                        {line.kind === "meaning" ? (
                          <DefinitionContent item={line.item} reading={line.reading} lead={!line.folded} />
                        ) : (
                          <FormLine definition={line.definition} />
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
                {holdsMore(lines) && <More className={DEFINITIONS_MORE} controls={`definition-list-${entryKey(reading)}`} />}
              </MoreBlock>
            </Block>
          </article>
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
