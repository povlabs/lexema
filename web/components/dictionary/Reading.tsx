// How one reading renders: a heading `1 · Sostantivo` (only `Sostantivo` for a
// reading with no definition), then *Definitions*, then
// *Forms* — no box around it, a thin rule before the next
// (design-system-manifest.md § "The result"). A verb form block reads the same
// way, headed `1 · Voce verbale · salire` (#636).
//
// The part of speech is the record's own `pos_title`, verbatim (ADR 0015).
// Nothing on the reading says where a fact came from (ADR 0016): a definition
// recovered from the raw page reads like any other, and so does a mood or an
// article worked out by rule. Every Italian string carries `lang="it"`.

import type { ReactNode } from "react";
import { entryKey, everyRecovered, factRefKey, isVerbReading, searchedSpellings } from "@lexema/lookup/types.ts";
import type { FactRef, RecoveredDefinition, Reading } from "@lexema/lookup/types.ts";
import { conjugationOf, placesAny } from "@/lib/dictionary/conjugation.ts";
import { definitionsOf, readAt, senseLabels, type DefinitionItem, type DefinitionPlace } from "@/lib/dictionary/definitions.ts";
import { agreementOf, headingGrammar } from "@/lib/dictionary/genderGrid.ts";
import { ConjugationView, GridView, SuperlativeGrid, searchHref } from "./Forms";
import {
  readingAnchor,
  readingHeadingId,
  searchedIn,
  type ConjugationTable,
  type FormLine,
  type LemmaMeaning,
  type LemmaTable,
  type PageReading,
  type VerbFormBlock,
  type VerbFormLine,
} from "@/lib/dictionary/wordPage.ts";
import { More, MoreBlock } from "./More";
import { OneLine } from "./OneLine";
import { WordList } from "./WordList";
import {
  BLOCK,
  BLOCK_LABEL,
  BLOCK_LABEL_WORD,
  DEFINITION,
  DEFINITION_BODY,
  DEFINITION_EXTRA,
  DEFINITION_NUMBER,
  DEFINITIONS,
  EXAMPLE,
  EXAMPLE_EXTRA,
  EXAMPLE_LOOSE,
  FORM_OF_LINE,
  GLOSS,
  GLOSS_LINK,
  LEMMA_MEANING,
  LEMMA_MEANING_EXTRA,
  READING,
  READING_DOT,
  READING_GRAMMAR,
  READING_GRAMMAR_GROUP,
  READING_HEADING,
  READING_NUMBER,
  SENSE_LABEL,
  SUB_ITEMS,
} from "@/components/shared/styles.ts";

/** A block: a small grey label over its content. */
export function Block({ id, label, children }: { id: string; label: ReactNode; children: ReactNode }) {
  return (
    <section className={BLOCK} aria-labelledby={id}>
      <h3 className={BLOCK_LABEL} id={id}>
        {label}
      </h3>
      {children}
    </section>
  );
}


/** Whether a definition's nested items carry an example, at any depth. */
const nestedExamples = (items: readonly RecoveredDefinition[]): boolean =>
  items.some((item) => item.examples.length > 0 || nestedExamples(item.items));

const nestedItemsOf = (item: DefinitionItem): readonly RecoveredDefinition[] =>
  item.from === "record" ? item.sense.recoveredItems : item.definition.items;

/**
 * The words the `form_of` edges of a definition name, to link where its text
 * writes them: `terza persona plurale dell'imperfetto indicativo di andare`.
 */
function lemmaWordsOf(reading: Reading, place: DefinitionPlace): string[] {
  return reading.lemmaLinks
    .filter((link) => link.kind === "candidates" && readAt(link.ref, place))
    .map((link) => link.targetWord);
}

const isLetter = (char: string | undefined): boolean => char !== undefined && /\p{L}/u.test(char);

/** Where a gloss writes a lemma as a whole word, last occurrence first; -1 when it does not. */
function findLemma(text: string, lemma: string): number {
  let at = text.lastIndexOf(lemma);
  while (at !== -1 && (isLetter(text[at - 1]) || isLetter(text[at + lemma.length]))) {
    at = at === 0 ? -1 : text.lastIndexOf(lemma, at - 1);
  }
  return at;
}

/**
 * Every lemma a gloss writes as a whole word, where it writes it last, in text
 * order and never overlapping. The one place a gloss is matched against its
 * lemmas, so what `LinkedGloss` links and what `LemmaLines` counts as linked
 * cannot disagree.
 */
function lemmaMatches(text: string, lemmas: readonly string[]): { at: number; lemma: string }[] {
  const found = [...new Set(lemmas)]
    .map((lemma) => ({ at: findLemma(text, lemma), lemma }))
    .filter((match) => match.at !== -1)
    .sort((a, b) => a.at - b.at || b.lemma.length - a.lemma.length);
  const kept: { at: number; lemma: string }[] = [];
  for (const match of found) {
    const last = kept[kept.length - 1];
    if (last === undefined || match.at >= last.at + last.lemma.length) kept.push(match);
  }
  return kept;
}

/** A gloss with each lemma it names linked to its search. */
function LinkedGloss({ text, lemmas }: { text: string; lemmas: readonly string[] }) {
  const parts: ReactNode[] = [];
  let from = 0;
  for (const { at, lemma } of lemmaMatches(text, lemmas)) {
    parts.push(text.slice(from, at));
    parts.push(
      <a key={at} className={GLOSS_LINK} href={searchHref(lemma)}>
        {lemma}
      </a>,
    );
    from = at + lemma.length;
  }
  parts.push(text.slice(from));
  return <>{parts}</>;
}

/** A definition's nested items; their examples show once the definitions are open. */
function SubItems({ items }: { items: readonly RecoveredDefinition[] }) {
  if (items.length === 0) return null;
  return (
    <ul className={SUB_ITEMS}>
      {items.map((item) => (
        <li key={item.ref.line}>
          <p className={GLOSS} lang="it">
            {item.labels.length > 0 && <span className={SENSE_LABEL}>({item.labels.join(", ")}) </span>}
            {item.text}
          </p>
          {item.examples.map((example) => (
            <p key={example.ref.line} className={EXAMPLE_EXTRA}>
              <span lang="it">{example.text}</span>
            </p>
          ))}
          <SubItems items={item.items} />
        </li>
      ))}
    </ul>
  );
}

function DefinitionText({ item, reading }: { item: DefinitionItem; reading: Reading }) {
  if (item.from === "page") {
    const { definition } = item;
    return (
      <>
        <p className={GLOSS} lang="it">
          {definition.labels.length > 0 && <span className={SENSE_LABEL}>({definition.labels.join(", ")}) </span>}
          <LinkedGloss text={definition.text} lemmas={lemmaWordsOf(reading, { line: definition.ref.line })} />
        </p>
        <SubItems items={definition.items} />
      </>
    );
  }
  const { sense } = item;
  const labels = senseLabels(sense.labels.map((label) => label.label));
  const lemmas = lemmaWordsOf(reading, { sense: sense.index });
  return (
    <>
      {sense.glosses.map((gloss, i) => (
        <p key={i} className={GLOSS} lang="it">
          {i === 0 && labels.length > 0 && <span className={SENSE_LABEL}>({labels.join(", ")}) </span>}
          <LinkedGloss text={gloss.text} lemmas={lemmas} />
        </p>
      ))}
      <SubItems items={sense.recoveredItems} />
    </>
  );
}

export const definitionKey = (item: DefinitionItem): string =>
  item.from === "record" ? `sense-${item.sense.index}` : `page-${item.definition.ref.line}`;

function Example({ text, className = EXAMPLE }: { text: string; className?: string }) {
  return (
    <p className={className}>
      <span lang="it">{text}</span>
    </p>
  );
}

/**
 * One definition: its labels, its text with each lemma linked, then its
 * examples. On the `lead`, the definition that shows closed, only its first
 * example shows until `+ more`; the others' examples fold with them. A
 * searched expression's page folds its meanings the same way (Phrase.tsx).
 */
export function DefinitionContent({ item, reading, lead }: { item: DefinitionItem; reading: Reading; lead: boolean }) {
  return (
    <>
      <DefinitionText item={item} reading={reading} />
      {item.examples.map((text, j) => (
        <Example key={j} text={text} className={lead && j > 0 ? EXAMPLE_EXTRA : EXAMPLE} />
      ))}
    </>
  );
}

/** Whether the lead definition holds anything back for `+ more`: a second example, or a nested item's. */
export const leadHoldsMore = (item: DefinitionItem): boolean =>
  item.examples.length > 1 || nestedExamples(nestedItemsOf(item));

/** Whether a form's lemma has a meaning past its first, which waits for `+ more`. */
const meaningHoldsMore = (meaning: LemmaMeaning | undefined): boolean => meaning !== undefined && meaning.definitions.length > 1;

/** One of the lemma's definitions as a meaning line: its labels, then its text as the source wrote it, nothing linked. */
function MeaningLine({ item, className }: { item: DefinitionItem; className: string }) {
  const [labels, texts] =
    item.from === "record"
      ? [senseLabels(item.sense.labels.map((label) => label.label)), item.sense.glosses.map((gloss) => gloss.text)]
      : [item.definition.labels, [item.definition.text]];
  return (
    <>
      {texts.map((text, i) => (
        <p key={i} className={className} lang="it">
          {i === 0 && labels.length > 0 && <span className={SENSE_LABEL}>({labels.join(", ")}) </span>}
          {text}
        </p>
      ))}
    </>
  );
}

/**
 * What a form's lemma means, under the form's first line (#686, frames 17 and
 * 37): the lemma's first definition, then the rest, which wait for the one
 * `+ more` the form's lines already have. No heading and no label.
 */
function LemmaMeaningLines({ meaning }: { meaning: LemmaMeaning | undefined }) {
  if (meaning === undefined) return null;
  return (
    <div data-meaning-of={meaning.lemma.word}>
      {meaning.definitions.map((item, i) => (
        <MeaningLine key={definitionKey(item)} item={item} className={i === 0 ? LEMMA_MEANING : LEMMA_MEANING_EXTRA} />
      ))}
    </div>
  );
}

/**
 * Closed, the first definition and its own first example, or none: an example
 * stays under its own definition. Then `+ more`, when anything else is there.
 * Open, every definition with every example in order, then those of senses
 * not shown as definitions, then `less` (design-system-manifest.md § "Layout",
 * one expand control). Everything is in the document whether it is open or not.
 */
function Definitions({ reading, meaning }: { reading: Reading; meaning: LemmaMeaning | undefined }) {
  const { items, looseExamples } = definitionsOf(reading);
  if (items.length === 0) {
    // Nothing to define, but the source's examples are still shown.
    if (looseExamples.length === 0) return null;
    return (
      <Block id={`examples-${entryKey(reading)}`} label="Examples">
        {looseExamples.map((text, i) => (
          <Example key={i} text={text} />
        ))}
      </Block>
    );
  }
  const [first, ...rest] = items;
  const more = rest.length > 0 || leadHoldsMore(first) || looseExamples.length > 0 || meaningHoldsMore(meaning);
  const list = `definition-list-${entryKey(reading)}`;
  return (
    <Block id={`definitions-${entryKey(reading)}`} label="Definitions">
      <MoreBlock kind="definitions">
        <ol className={DEFINITIONS} id={list}>
          {items.map((item, i) => (
            <li key={definitionKey(item)} className={i === 0 ? DEFINITION : DEFINITION_EXTRA} data-definition={i + 1}>
              <span className={DEFINITION_NUMBER} aria-hidden="true">
                {i + 1}.
              </span>
              <div className={DEFINITION_BODY}>
                <DefinitionContent item={item} reading={reading} lead={i === 0} />
                {i === 0 && <LemmaMeaningLines meaning={meaning} />}
              </div>
            </li>
          ))}
        </ol>
        {looseExamples.map((text, i) => (
          <Example key={`loose-${i}`} text={text} className={EXAMPLE_LOOSE} />
        ))}
        {more && <More place="definitions" controls={list} />}
      </MoreBlock>
    </Block>
  );
}

/**
 * A lemma the release has whose word the definition does not write, linked on
 * a line of its own, so the source's `form_of` edge stays reachable. A lemma
 * the release has no entry for is not mentioned (Huey, 2026-09-27, on #142).
 * In a verb form block, `only` names the words that block may show.
 */
function LemmaLines({ reading, only }: { reading: Reading; only?: readonly string[] }) {
  const writes = (text: string, place: DefinitionPlace, word: string) =>
    lemmaMatches(text, lemmaWordsOf(reading, place)).some((match) => match.lemma === word);
  const linkedInGloss = (word: string, ref: FactRef) =>
    reading.senses.some(
      (sense) => readAt(ref, { sense: sense.index }) && sense.glosses.some((gloss) => writes(gloss.text, { sense: sense.index }, word)),
    ) ||
    everyRecovered(reading).some(
      (definition) => readAt(ref, { line: definition.ref.line }) && writes(definition.text, { line: definition.ref.line }, word),
    );
  const unlinked = new Set<string>();
  for (const link of reading.lemmaLinks) {
    if (link.kind !== "candidates" || (only !== undefined && !only.includes(link.targetWord))) continue;
    if (!linkedInGloss(link.targetWord, link.ref)) unlinked.add(link.targetWord);
  }
  return (
    <>
      {[...unlinked].map((word) => (
        <p key={word} className={FORM_OF_LINE}>
          Form of{" "}
          <a className={GLOSS_LINK} href={searchHref(word)} lang="it">
            {word}
          </a>
          .
        </p>
      ))}
    </>
  );
}

/** The reading's own forms, in the shape they have. */
function OwnForms({ reading }: { reading: Reading }) {
  const id = `forms-${entryKey(reading)}`;
  if (isVerbReading(reading)) {
    const searched = searchedSpellings(reading);
    const conjugation = conjugationOf(reading.forms, searched);
    // Forms that fill no cell would draw only a row of dashes (#674).
    if (!placesAny(conjugation)) return null;
    return (
      <Block id={id} label="Forms">
        <ConjugationView
          conjugation={conjugation}
          searchedPointers={searched.formPointers}
          word={reading.word}
        />
      </Block>
    );
  }
  const { grid, superlative } = agreementOf(reading);
  if (grid === undefined && superlative === undefined) return null;
  return (
    <Block id={id} label="Forms">
      {grid !== undefined && <GridView grid={grid} label={`Forms of ${reading.word}`} />}
      {superlative !== undefined && <SuperlativeGrid grid={superlative} />}
    </Block>
  );
}

function LemmaConjugation({ table }: { table: ConjugationTable }) {
  const searched = searchedIn(table);
  return <ConjugationView conjugation={conjugationOf(table.listing.forms, searched)} searchedPointers={searched.formPointers} word={table.lemma.word} />;
}

/**
 * *Forms of andare*, the lemma's whole conjugation opened where the searched
 * form sits, or with nothing marked when it does not list it (#666); or *Forms
 * of bello*, the lemma's grid with nothing marked (#626).
 */
function LemmaForms({ owner, tables }: { owner: string; tables: readonly LemmaTable[] }) {
  return (
    <>
      {tables.map((table) => {
        const { lemma } = table;
        return (
          <Block
            key={entryKey(lemma)}
            id={`lemma-forms-${owner}-${entryKey(lemma)}`}
            label={
              <>
                Forms of
                <span className={BLOCK_LABEL_WORD} lang="it">
                  {lemma.word}
                </span>
              </>
            }
          >
            {table.kind === "conjugation" ? (
              <LemmaConjugation table={table} />
            ) : (
              <>
                {table.agreement.grid !== undefined && <GridView grid={table.agreement.grid} label={`Forms of ${lemma.word}`} />}
                {table.agreement.superlative !== undefined && <SuperlativeGrid grid={table.agreement.superlative} />}
              </>
            )}
          </Block>
        );
      })}
    </>
  );
}

/** A rule-built line, its verb linked as a source gloss links its lemma. */
function VerbFormLineText({ line }: { line: VerbFormLine }) {
  return (
    <p className={GLOSS} lang="it">
      {line.text.slice(0, line.text.length - line.lemma.length)}
      <a className={GLOSS_LINK} href={searchHref(line.lemma)}>
        {line.lemma}
      </a>
    </p>
  );
}

const formLineKey = (line: FormLine): string =>
  line.kind === "rule" ? `rule-${line.text}` : `${entryKey(line.reading)}-${definitionKey(line.item)}`;

/**
 * One verb the searched form belongs to, as frame 37 draws it (#636):
 * `1 · Voce verbale · salire`, then *Definitions*, its form-of lines, the
 * source's and those built by rule (#627) read alike, with the one expand
 * control every *Definitions* block has; then *Forms of salire*, opened where
 * the searched cell is. Nothing marks a line as Lexema's (ADR 0016). The verb's
 * table is the block's only *Forms*: a form record's own `forms[]` never shows
 * here (#666).
 */
export function VerbFormBlockView({ block }: { block: VerbFormBlock }) {
  const anchor = readingAnchor(block);
  const list = `definition-list-${anchor}`;
  const [lead] = block.lines;
  const firsts = block.sources.filter((source) => source.first).map((source) => source.reading);
  const looseExamples = firsts.flatMap((reading) => definitionsOf(reading).looseExamples);
  const more =
    block.lines.length > 1 || (lead.kind === "source" && leadHoldsMore(lead.item)) || looseExamples.length > 0 || meaningHoldsMore(block.meaning);
  return (
    <article className={READING} id={anchor} aria-labelledby={readingHeadingId(block)} data-verb-form={block.verb}>
      <h2 className={READING_HEADING} id={readingHeadingId(block)}>
        <span className={READING_NUMBER}>{block.number}</span>
        <span className={READING_DOT} aria-hidden="true">
          ·
        </span>
        <span lang="it">{block.posTitle}</span>
        {/* The dot travels with the verb, so a wrapped heading never ends on it. */}
        <span className={READING_GRAMMAR_GROUP}>
          <span className={READING_DOT} aria-hidden="true">
            ·
          </span>
          <span lang="it">{block.verb}</span>
        </span>
      </h2>
      <Block id={`definitions-${anchor}`} label="Definitions">
        <MoreBlock kind="definitions">
          <ol className={DEFINITIONS} id={list}>
            {block.lines.map((line, i) => (
              <li key={formLineKey(line)} className={i === 0 ? DEFINITION : DEFINITION_EXTRA} data-definition={i + 1}>
                <span className={DEFINITION_NUMBER} aria-hidden="true">
                  {i + 1}.
                </span>
                <div className={DEFINITION_BODY}>
                  {line.kind === "rule" ? (
                    <VerbFormLineText line={line} />
                  ) : (
                    <DefinitionContent item={line.item} reading={line.reading} lead={i === 0} />
                  )}
                  {i === 0 && <LemmaMeaningLines meaning={block.meaning} />}
                </div>
              </li>
            ))}
          </ol>
          {looseExamples.map((text, i) => (
            <Example key={`loose-${i}`} text={text} className={EXAMPLE_LOOSE} />
          ))}
          {more && <More place="definitions" controls={list} />}
        </MoreBlock>
      </Block>
      {block.sources.map((source) => (
        <LemmaLines key={entryKey(source.reading)} reading={source.reading} only={source.lemmaWords} />
      ))}
      <LemmaForms owner={anchor} tables={block.tables} />
      {block.etymologies.length > 0 && (
        <Block id={`etymology-${anchor}`} label="Etymology">
          {block.etymologies.map((etymology) => (
            <OneLine key={factRefKey(etymology.ref)} text={etymology.text} lang="it" />
          ))}
        </Block>
      )}
      <WordList id={`synonyms-${anchor}`} label="Synonyms" items={block.synonyms} level="h3" />
    </article>
  );
}

export function ReadingView({ entry }: { entry: PageReading }) {
  const { reading, number } = entry;
  const grammar = headingGrammar(reading);
  return (
    <article
      className={READING}
      id={`reading-${entryKey(reading)}`}
      aria-labelledby={`reading-heading-${entryKey(reading)}`}
      data-record={reading.recordId}
      data-line={reading.ref.lineNo}
    >
      <h2 className={READING_HEADING} id={`reading-heading-${entryKey(reading)}`}>
        {number !== undefined && (
          <>
            <span className={READING_NUMBER}>{number}</span>
            <span className={READING_DOT} aria-hidden="true">
              ·
            </span>
          </>
        )}
        <span lang="it">{reading.posTitle}</span>
        {grammar !== undefined && (
          // The dot travels with the grammar, so a wrapped heading never ends on it.
          <span className={READING_GRAMMAR_GROUP}>
            <span className={READING_DOT} aria-hidden="true">
              ·
            </span>
            <span className={READING_GRAMMAR} lang="it">
              {grammar}
            </span>
          </span>
        )}
      </h2>
      <Definitions reading={reading} meaning={entry.meaning} />
      <LemmaLines reading={reading} />
      {entry.ownForms && <OwnForms reading={reading} />}
      <LemmaForms owner={entryKey(reading)} tables={entry.lemmaTables} />
      {entry.etymologies.length > 0 && (
        <Block id={`etymology-${entryKey(reading)}`} label="Etymology">
          {entry.etymologies.map((etymology) => (
            <OneLine key={factRefKey(etymology.ref)} text={etymology.text} lang="it" />
          ))}
        </Block>
      )}
      <WordList id={`synonyms-${entryKey(reading)}`} label="Synonyms" items={entry.synonyms} level="h3" />
    </article>
  );
}
