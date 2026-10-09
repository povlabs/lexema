// A declared lemma's page (#453): a word no record heads, shown with the forms
// its form-of records declare. It is laid out as any word's page is
// (design-system-manifest.md § "The result"): the headword, then each reading,
// headed by its part of speech alone since it has no definition, then *Forms*
// in the shape its data has, then *Source* and *Segnala un errore*.
//
// Nothing here says the word has no entry of its own (ADR 0016): no
// definitions block, no pronunciation, and no note. What it is built from is
// `declaredLemmaPage.ts`.

import { ConjugationView, GridView } from "./Forms";
import { Block } from "./Reading";
import { SourceLine } from "./Word";
import { JUMP_LINKS_FROM } from "@/lib/dictionary/wordPage.ts";
import { formsOf, READINGS_NAV, SECTION_LABEL } from "@/lib/dictionary/wordPageText.ts";
import type { DeclaredLemmaPage, DeclaredPageReading } from "@/lib/dictionary/declaredLemmaPage.ts";
import {
  JUMP_LINK,
  JUMP_LINKS,
  READING,
  READING_HEADING,
  READINGS,
  WORD_HEADING,
} from "@/components/shared/styles.ts";

/** Nothing on the page is searched but the lemma, which no cell holds. */
const NOTHING_SEARCHED: ReadonlySet<string> = new Set();

function DeclaredReadingView({ entry }: { entry: DeclaredPageReading }) {
  const { reading, table } = entry;
  const id = `declared-${reading.pos}`;
  return (
    <article className={READING} id={`reading-${id}`} aria-labelledby={`reading-heading-${id}`} data-declared={reading.pos}>
      <h2 className={READING_HEADING} id={`reading-heading-${id}`}>
        <span lang="it">{reading.posTitle}</span>
      </h2>
      <Block id={`forms-${id}`} label={SECTION_LABEL.forms}>
        {table.shape === "conjugation" ? (
          <ConjugationView conjugation={table.conjugation} searchedPointers={NOTHING_SEARCHED} word={reading.word} />
        ) : (
          <GridView grid={table.grid} label={formsOf(reading.word)} />
        )}
      </Block>
    </article>
  );
}

function JumpLinks({ page }: { page: DeclaredLemmaPage }) {
  if (page.readings.length < JUMP_LINKS_FROM) return null;
  return (
    <nav aria-label={READINGS_NAV} lang="it">
      <ul className={JUMP_LINKS}>
        {page.readings.map(({ reading }) => (
          <li key={reading.pos}>
            <a className={JUMP_LINK} href={`#reading-declared-${reading.pos}`}>
              <span lang="it">{reading.posTitle}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function DeclaredLemmaView({ page, siteKey }: { page: DeclaredLemmaPage; siteKey?: string }) {
  return (
    <>
      <h1 className={WORD_HEADING} lang="it">
        {page.headword}
      </h1>
      <JumpLinks page={page} />
      <div className={READINGS}>
        {page.readings.map((entry) => (
          <DeclaredReadingView key={entry.reading.pos} entry={entry} />
        ))}
      </div>
      {/* A report names the word; no record heads it, so there is no reading to choose. */}
      <SourceLine page={{ sourceWord: page.sourceWord, headword: page.headword, readings: [] }} siteKey={siteKey} />
    </>
  );
}
