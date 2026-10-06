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
  type LemmaDefinitionList,
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
  FORM_LINE,
  FORM_LINES,
  FORM_OF_LINE,
  GLOSS,
  GLOSS_LINK,
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

/** A record's lemma links: what a definition of its links where its text writes them. */
type LinksOf = Pick<Reading, "lemmaLinks">;

/**
 * The words the `form_of` edges of a definition name, to link where its text
 * writes them: `terza persona plurale dell'imperfetto indicativo di andare`.
 */
function lemmaWordsOf(reading: LinksOf, place: DefinitionPlace): string[] {
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

/** A definition's text, in the gloss style or, as a form line, in `gloss`'s. */
function DefinitionText({ item, reading, gloss = GLOSS }: { item: DefinitionItem; reading: LinksOf; gloss?: string }) {
  if (item.from === "page") {
    const { definition } = item;
    return (
      <>
        <p className={gloss} lang="it">
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
      {sense.glosses.map(({ text }, i) => (
        <p key={i} className={gloss} lang="it">
          {i === 0 && labels.length > 0 && <span className={SENSE_LABEL}>({labels.join(", ")}) </span>}
          <LinkedGloss text={text} lemmas={lemmas} />
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
export function DefinitionContent({ item, reading, lead }: { item: DefinitionItem; reading: LinksOf; lead: boolean }) {
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

/**
 * A *Definitions* block. Closed, the first definition and its own first
 * example, or none: an example stays under its own definition. Then `+ more`,
 * when anything else is there. Open, every definition with every example in
 * order, then those of senses not shown as definitions, then `less`
 * (design-system-manifest.md § "Layout", one expand control). Everything is in
 * the document whether it is open or not. `owner` names the ids; `links` are
 * the record's own, which its glosses link where they write the word.
 */
function DefinitionList({
  owner,
  items,
  looseExamples,
  links,
}: {
  owner: string;
  items: readonly [DefinitionItem, ...DefinitionItem[]];
  looseExamples: readonly string[];
  links: LinksOf;
}) {
  const [first, ...rest] = items;
  const more = rest.length > 0 || leadHoldsMore(first) || looseExamples.length > 0;
  const list = `definition-list-${owner}`;
  return (
    <Block id={`definitions-${owner}`} label="Definitions">
      <MoreBlock kind="definitions">
        <ol className={DEFINITIONS} id={list}>
          {items.map((item, i) => (
            <li key={definitionKey(item)} className={i === 0 ? DEFINITION : DEFINITION_EXTRA} data-definition={i + 1}>
              <span className={DEFINITION_NUMBER} aria-hidden="true">
                {i + 1}.
              </span>
              <div className={DEFINITION_BODY}>
                <DefinitionContent item={item} reading={links} lead={i === 0} />
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

/** A reading's own definitions; with none, the source's examples still show. */
function Definitions({ reading }: { reading: Reading }) {
  const { items, looseExamples } = definitionsOf(reading);
  const [first, ...rest] = items;
  if (first === undefined) {
    if (looseExamples.length === 0) return null;
    return (
      <Block id={`examples-${entryKey(reading)}`} label="Examples">
        {looseExamples.map((text, i) => (
          <Example key={i} text={text} />
        ))}
      </Block>
    );
  }
  return <DefinitionList owner={entryKey(reading)} items={[first, ...rest]} looseExamples={looseExamples} links={reading} />;
}

/**
 * A form's lemma's *Definitions* (#686): the lemma record's own, listed as its
 * own page lists them, under the form's lines. A lemma with none shows none.
 */
function LemmaDefinitions({ owner, list }: { owner: string; list: LemmaDefinitionList | undefined }) {
  if (list === undefined) return null;
  return (
    <div data-definitions-of={list.lemma.word}>
      <DefinitionList owner={owner} items={list.items} looseExamples={list.looseExamples} links={list} />
    </div>
  );
}

/**
 * A form's lines, right under its heading with no label (#686, frames 17 and
 * 37): unnumbered and always shown, each ending with its lemma linked. A form
 * record's examples, rare, show with its lines.
 */
function FormLines({ children }: { children: ReactNode }) {
  return <div className={FORM_LINES}>{children}</div>;
}

/** One of a form record's definitions as a form line, then its examples. */
function SourceFormLineText({ item, reading }: { item: DefinitionItem; reading: LinksOf }) {
  return (
    <>
      <DefinitionText item={item} reading={reading} gloss={FORM_LINE} />
      {item.examples.map((text, j) => (
        <Example key={j} text={text} />
      ))}
    </>
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
    <p className={FORM_LINE} lang="it">
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
 * One verb the searched form belongs to, as frames 17 and 37 draw it (#636,
 * #686): `1 · Voce verbale · salire`, its form-of lines right under it, the
 * source's and those built by rule (#627) read alike, all shown; then
 * *Definitions*, the verb's own, with the one expand control; then *Forms of
 * salire*, opened where the searched cell is. Nothing marks a line as Lexema's
 * (ADR 0016). The verb's table is the block's only *Forms*: a form record's own
 * `forms[]` never shows here (#666).
 */
export function VerbFormBlockView({ block }: { block: VerbFormBlock }) {
  const anchor = readingAnchor(block);
  const firsts = block.sources.filter((source) => source.first).map((source) => source.reading);
  const looseExamples = firsts.flatMap((reading) => definitionsOf(reading).looseExamples);
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
      <FormLines>
        {block.lines.map((line) =>
          line.kind === "rule" ? (
            <VerbFormLineText key={formLineKey(line)} line={line} />
          ) : (
            <SourceFormLineText key={formLineKey(line)} item={line.item} reading={line.reading} />
          ),
        )}
        {looseExamples.map((text, i) => (
          <Example key={`loose-${i}`} text={text} />
        ))}
      </FormLines>
      {block.sources.map((source) => (
        <LemmaLines key={entryKey(source.reading)} reading={source.reading} only={source.lemmaWords} />
      ))}
      <LemmaDefinitions owner={anchor} list={block.definitions} />
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

/** A noun or adjective form's own definitions as its form lines (`femminile singolare di bello`), with any examples its senses hold. */
function ReadingFormLines({ reading }: { reading: Reading }) {
  const { items, looseExamples } = definitionsOf(reading);
  if (items.length === 0 && looseExamples.length === 0) return null;
  return (
    <FormLines>
      {items.map((item) => (
        <SourceFormLineText key={definitionKey(item)} item={item} reading={reading} />
      ))}
      {looseExamples.map((text, i) => (
        <Example key={`loose-${i}`} text={text} />
      ))}
    </FormLines>
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
      {entry.formOf === undefined ? (
        <>
          <Definitions reading={reading} />
          <LemmaLines reading={reading} />
          <OwnForms reading={reading} />
        </>
      ) : (
        <>
          <ReadingFormLines reading={reading} />
          <LemmaLines reading={reading} />
          <LemmaDefinitions owner={entryKey(reading)} list={entry.formOf.definitions} />
        </>
      )}
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
