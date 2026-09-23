// One word's page: the headword and what the source says about it as a word,
// the reading index, one card per reading, and — after the last card — the
// sections the source repeats on every record of the headword, said once.
//
// Which records are cards and which are lemma panels is `wordPage.ts`; this
// file only lays the answer out, in the order frames 01–06 draw it.

import type { ReactNode } from "react";
import type { Reading, RelatedWord, WordFacts } from "@lexema/lookup/types.ts";
import { ChevronIcon, ExternalIcon } from "./icons";
import { ReadingCard, ShowAll, readingKind, lemmaWords, sliceCount } from "./Reading";
import type { WordPage } from "./wordPage.ts";
import {
  CARDS,
  CHIP,
  CHIP_WIDE_SLICE,
  CHIPS,
  ETYMOLOGIES,
  ETYMOLOGY,
  ETYMOLOGY_LABEL,
  ETYMOLOGY_SINGLE,
  ICON,
  INDEX_CHEVRON,
  INDEX_GLOSS,
  INDEX_ITEM,
  INDEX_KIND,
  INDEX_LINK,
  INDEX_LIST,
  INDEX_NUMBER,
  LABEL,
  PHONE_ONLY,
  READING_INDEX,
  RELATED,
  SECTION,
  SECTION_COUNT,
  SECTION_HEADER,
  SECTION_NAME,
  SECTION_RULE,
  SOURCE_LINE,
  SOURCE_LINK,
  WIDE_ONLY,
  WORD_HEADING,
  WORD_SECTION,
  WORD_STRIP,
  WORD_STRIP_FACT,
  WORD_STRIP_NOTE,
  WORD_STRIP_VALUE,
} from "./styles.ts";

/**
 * How many related words a list shows before its "Show all" button: fewer on a
 * phone, where a screen of chips is half as wide (frame 09).
 */
export const RELATED_SLICE = { phone: 12, wide: 24 } as const;

/**
 * Where a word can be checked by hand. The release is a Wiktextract dump of
 * the Italian Wiktionary, so every record came from the page of its headword;
 * the source stores no URL, so it is built from the headword. One link per
 * headword on the page, labelled *Source* (ADR 0009) — the full credit is on
 * `/attribution`, which the footer reaches.
 */
const WIKTIONARY_PAGE = "https://it.wiktionary.org/wiki/";

export function sourcePageUrl(word: string): string {
  return WIKTIONARY_PAGE + encodeURIComponent(word.replace(/ /g, "_"));
}

/** Pronunciation over the IPA, syllables over the hyphenation, a divider between. */
function WordStrip({ facts }: { facts: WordFacts }) {
  if (facts.pronunciations.length === 0 && facts.hyphenations.length === 0) return null;
  return (
    <dl className={WORD_STRIP} aria-label="Pronunciation and syllables">
      {facts.pronunciations.length > 0 && (
        <div className={WORD_STRIP_FACT}>
          <dt className={LABEL}>Pronunciation</dt>
          {facts.pronunciations.map((sound) => (
            <dd key={sound.ref.jsonPointer} className={WORD_STRIP_VALUE}>
              {sound.ipa}
              {/* `casa` gives two, and the source's own qualifier is what
                  tells them apart. */}
              {facts.pronunciations.length > 1 && sound.note !== null && (
                <span className={WORD_STRIP_NOTE} lang="it">
                  {sound.note}
                </span>
              )}
            </dd>
          ))}
        </div>
      )}
      {facts.hyphenations.length > 0 && (
        <div className={WORD_STRIP_FACT}>
          <dt className={LABEL}>Syllables</dt>
          {facts.hyphenations.map((hyphenation) => (
            <dd key={hyphenation.ref.jsonPointer} className={WORD_STRIP_VALUE} lang="it">
              {hyphenation.parts.join("·")}
            </dd>
          ))}
        </div>
      )}
    </dl>
  );
}

/**
 * One compact chip per card: its number, its kind, its first gloss verbatim. On
 * a phone, a full-width row with a chevron (frame 07).
 */
function ReadingIndex({ page }: { page: WordPage }) {
  return (
    <nav className={READING_INDEX} aria-label="Readings">
      <ol className={INDEX_LIST}>
        {page.cards.map(({ number, reading }) => {
          const gloss = firstGloss(reading);
          return (
            <li key={reading.recordId} className={INDEX_ITEM}>
              <a className={INDEX_LINK} href={`#reading-${reading.recordId}`}>
                <span className={INDEX_NUMBER}>{number}</span>
                <span className={INDEX_KIND}>{readingKind(reading)}</span>
                {gloss !== undefined && (
                  <span className={INDEX_GLOSS} lang="it">
                    {gloss}
                  </span>
                )}
                <ChevronIcon className={INDEX_CHEVRON} />
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function firstGloss(reading: Reading): string | undefined {
  for (const sense of reading.senses) for (const gloss of sense.glosses) return gloss.text;
  return lemmaWords(reading).length > 0 ? `of ${lemmaWords(reading).join(", ")}` : undefined;
}

function WordSectionBlock({
  id,
  name,
  count,
  children,
}: {
  id: string;
  name: string;
  count: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={SECTION} aria-labelledby={id}>
      <div className={SECTION_HEADER}>
        <h2 className={SECTION_NAME} id={id}>
          {name}
        </h2>
        <span className={SECTION_COUNT}>{count}</span>
        <span className={SECTION_RULE} aria-hidden="true" />
      </div>
      {children}
    </section>
  );
}

/**
 * The etymologies, each in its own box. When there are several and the source
 * does not say which reading each belongs to — `sale` has two — each says so in
 * words. Lexema never assigns one to a reading itself.
 */
function Etymologies({ facts }: { facts: WordFacts }) {
  const { etymologies } = facts;
  if (etymologies.length === 0) return null;
  const several = etymologies.length > 1;
  return (
    <WordSectionBlock id="etymology" name="Etymology" count={`${etymologies.length}`}>
      <div className={several ? ETYMOLOGIES : ETYMOLOGY_SINGLE}>
        {etymologies.map((etymology, i) => (
          <p key={etymology.ref.jsonPointer} className={ETYMOLOGY}>
            {several && <span className={ETYMOLOGY_LABEL}>Etymology {i + 1} — reading not given</span>}
            <span lang="it">{etymology.text}</span>
          </p>
        ))}
      </div>
    </WordSectionBlock>
  );
}

/** `86 · showing 12` on a phone and `86 · showing 24` on a wide screen. */
function RelatedCount({ total }: { total: number }) {
  const phone = sliceCount(total, RELATED_SLICE.phone);
  const wide = sliceCount(total, RELATED_SLICE.wide);
  if (phone === wide) return phone;
  return (
    <>
      <span className={PHONE_ONLY}>{phone}</span>
      <span className={WIDE_ONLY}>{wide}</span>
    </>
  );
}

/**
 * A wrapping grid of chips, each a search for that word; the rest behind a
 * button. Every chip is in the document at every width: the ones past the
 * phone's slice wait for the button there, and the ones past the wide slice
 * are inside it.
 */
function RelatedWords({ id, name, noun, words }: { id: string; name: string; noun: string; words: RelatedWord[] }) {
  if (words.length === 0) return null;
  const chip = (word: RelatedWord, className?: string) => (
    <li key={word.word} className={className}>
      <a className={CHIP} href={`/?q=${encodeURIComponent(word.word)}`} lang="it">
        {word.word}
      </a>
    </li>
  );
  const first = words.slice(0, RELATED_SLICE.wide);
  const rest = words.slice(RELATED_SLICE.wide);
  return (
    <WordSectionBlock id={id} name={name} count={<RelatedCount total={words.length} />}>
      <div className={RELATED}>
        <ul className={CHIPS}>
          {first.map((word, i) => chip(word, i < RELATED_SLICE.phone ? undefined : CHIP_WIDE_SLICE))}
        </ul>
        {words.length > RELATED_SLICE.phone && (
          <ShowAll total={words.length} noun={noun} wide phoneOnly={rest.length === 0}>
            {rest.length > 0 && <ul className={`${CHIPS} mt-4`}>{rest.map((word) => chip(word))}</ul>}
          </ShowAll>
        )}
      </div>
    </WordSectionBlock>
  );
}

function WordSection({ facts }: { facts: WordFacts }) {
  const any =
    facts.etymologies.length + facts.synonyms.length + facts.antonyms.length + facts.derived.length > 0;
  if (!any) return null;
  return (
    <div className={WORD_SECTION}>
      <Etymologies facts={facts} />
      <RelatedWords id="synonyms" name="Synonyms" noun="synonyms" words={facts.synonyms} />
      <RelatedWords id="antonyms" name="Antonyms" noun="antonyms" words={facts.antonyms} />
      <RelatedWords id="derived" name="Derived words" noun="derived words" words={facts.derived} />
    </div>
  );
}

/** One *Source* link per headword the cards belong to; normally exactly one. */
function SourceLinks({ words }: { words: readonly string[] }) {
  return (
    <footer className={SOURCE_LINE}>
      {words.map((word, i) => (
        <a
          key={word}
          className={SOURCE_LINK}
          href={sourcePageUrl(word)}
          rel="noreferrer"
          aria-label={`Wiktionary page for ${word}, the source of this page`}
        >
          Source{i > 0 && <span lang="it"> · {word}</span>}
          <ExternalIcon className={ICON} />
        </a>
      ))}
    </footer>
  );
}

export function WordView({ page, query }: { page: WordPage; query: string }) {
  const numbered = page.cards.length > 1;
  return (
    <>
      <h1 className={WORD_HEADING} lang="it">
        {page.headword}
      </h1>
      <WordStrip facts={page.wordFacts} />
      {numbered && <ReadingIndex page={page} />}
      <div className={CARDS}>
        {page.cards.map((card) => (
          <ReadingCard key={card.reading.recordId} card={card} query={query} numbered={numbered} />
        ))}
      </div>
      <WordSection facts={page.wordFacts} />
      <SourceLinks words={page.sourceWords} />
    </>
  );
}
