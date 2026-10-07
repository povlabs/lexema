// How one reading renders: a heading `1 · Sostantivo`, then the parts the page
// model gave it (wordPage.ts), *Definitions* then *Forms* among them — no box
// around it, a thin rule before the next (design-system-manifest.md § "The
// result"). Which parts a reading has, and whether it shows at all, is decided
// there, not here (#694). A verb form block reads the same way, headed
// `1 · Voce verbale · salire` (#636).
//
// The part of speech is the record's own `pos_title`, verbatim (ADR 0015).
// Nothing on the reading says where a fact came from (ADR 0016): a definition
// recovered from the raw page reads like any other, and so does a mood or an
// article worked out by rule. Every Italian string carries `lang="it"`.

import { Fragment, type ReactNode } from "react";
import { entryKey, factRefKey } from "@lexema/lookup/types.ts";
import type { RecoveredDefinition, Reading } from "@lexema/lookup/types.ts";
import { conjugationOf } from "@/lib/dictionary/conjugation.ts";
import { definitionsOf, senseLabels, type DefinitionItem } from "@/lib/dictionary/definitions.ts";
import { headingGrammar, placesGrammar } from "@/lib/dictionary/genderGrid.ts";
import { lemmaMatches, lemmaWordsOf, unlinkedLemmas, type LinksOf } from "@/lib/dictionary/lemmaLines.ts";
import { ConjugationView, GridView, SuperlativeGrid, searchHref } from "./Forms";
import {
  readingAnchor,
  readingHeadingId,
  searchedIn,
  type BareReading,
  type LoneBareReading,
  type ConjugationTable,
  type FormLine,
  type FormOfPart,
  type GridFormBlock,
  type GridFormLine,
  type LemmaDefinitionList,
  type LemmaPart,
  type LemmaTable,
  type OwnForms,
  type OwnText,
  type PageReading,
  type RecordLines,
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
function Definitions({ reading, text }: { reading: Reading; text: OwnText }) {
  if (text.kind === "examples") {
    return (
      <Block id={`examples-${entryKey(reading)}`} label="Examples">
        {text.looseExamples.map((example, i) => (
          <Example key={i} text={example} />
        ))}
      </Block>
    );
  }
  return <DefinitionList owner={entryKey(reading)} items={text.items} looseExamples={text.looseExamples} links={reading} />;
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
export function FormLines({ children }: { children: ReactNode }) {
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
 * Lemmas a record's `form_of` edges name that its definitions do not write,
 * each linked on a line of its own, so the edge stays reachable
 * (`unlinkedLemmas`).
 */
function LemmaLineList({ words }: { words: readonly string[] }) {
  return (
    <>
      {words.map((word) => (
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

/** A reading's own *Forms*, in the shape they have. */
function OwnFormsView({ owner, forms }: { owner: Reading; forms: OwnForms }) {
  return (
    <Block id={`forms-${entryKey(owner)}`} label="Forms">
      {forms.kind === "conjugation" ? (
        <ConjugationView conjugation={forms.conjugation} searchedPointers={forms.searchedPointers} word={owner.word} />
      ) : (
        <>
          {forms.agreement.grid !== undefined && <GridView grid={forms.agreement.grid} label={`Forms of ${owner.word}`} />}
          {forms.agreement.superlative !== undefined && <SuperlativeGrid grid={forms.agreement.superlative} />}
        </>
      )}
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

/** A rule-built line, the word it names linked as a source gloss links its lemma. */
function RuleFormLineText({ line }: { line: VerbFormLine | GridFormLine }) {
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
            <RuleFormLineText key={formLineKey(line)} line={line} />
          ) : (
            <SourceFormLineText key={formLineKey(line)} item={line.item} reading={line.reading} />
          ),
        )}
        {looseExamples.map((text, i) => (
          <Example key={`loose-${i}`} text={text} />
        ))}
      </FormLines>
      {block.sources.map((source) => (
        <LemmaLineList key={entryKey(source.reading)} words={unlinkedLemmas(source.reading, source.lemmaWords)} />
      ))}
      <LemmaDefinitions owner={anchor} list={block.definitions} />
      <LemmaForms owner={anchor} tables={block.tables} />
    </article>
  );
}

/**
 * A noun or adjective form no record of its own describes (#700, rule 4 of
 * #695): read as a form record's block, `1 · Aggettivo, forma flessa ·
 * femminile, singolare`, its lines built by rule from the cells of its base
 * word's grid, then the base word's *Definitions* and *Forms of gravido*.
 * Nothing marks a line as Lexema's (ADR 0016).
 */
export function GridFormBlockView({ block }: { block: GridFormBlock }) {
  const anchor = readingAnchor(block);
  return (
    <article className={READING} id={anchor} aria-labelledby={readingHeadingId(block)} data-grid-form={block.records[0].word}>
      <h2 className={READING_HEADING} id={readingHeadingId(block)}>
        <span className={READING_NUMBER}>{block.number}</span>
        <span className={READING_DOT} aria-hidden="true">
          ·
        </span>
        <span lang="it">{block.posTitle}</span>
        {/* The dot travels with the grammar, so a wrapped heading never ends on it. */}
        <span className={READING_GRAMMAR_GROUP}>
          <span className={READING_DOT} aria-hidden="true">
            ·
          </span>
          <span className={READING_GRAMMAR} lang="it">
            {placesGrammar(block.places)}
          </span>
        </span>
      </h2>
      <FormLines>
        {block.lines.map((line) => (
          <RuleFormLineText key={line.text} line={line} />
        ))}
      </FormLines>
      <LemmaDefinitions owner={anchor} list={block.definitions} />
      <LemmaForms owner={anchor} tables={block.tables} />
    </article>
  );
}

/**
 * A form block's records' own definitions as its form lines (`femminile
 * singolare di bello`, then `femminile di bello`), each record's in turn with
 * any examples its senses hold, each line linking as its own record does.
 */
function ReadingFormLines({ records }: { records: readonly RecordLines[] }) {
  return (
    <FormLines>
      {records.map(({ reading, text }) => (
        <Fragment key={entryKey(reading)}>
          {(text.kind === "definitions" ? text.items : []).map((item) => (
            <SourceFormLineText key={definitionKey(item)} item={item} reading={reading} />
          ))}
          {text.looseExamples.map((example, i) => (
            <Example key={`loose-${i}`} text={example} />
          ))}
        </Fragment>
      ))}
    </FormLines>
  );
}

/** One part of a source reading, as the page model decided it (wordPage.ts). */
function ReadingPartView({ reading, part }: { reading: Reading; part: LemmaPart | FormOfPart }) {
  const owner = entryKey(reading);
  switch (part.kind) {
    case "definitions":
      return <Definitions reading={reading} text={part.text} />;
    case "form-lines":
      return <ReadingFormLines records={part.records} />;
    case "lemma-lines":
      return <LemmaLineList words={part.words} />;
    case "own-forms":
      return <OwnFormsView owner={reading} forms={part.forms} />;
    case "lemma-definitions":
      return <LemmaDefinitions owner={owner} list={part.list} />;
    case "lemma-forms":
      return <LemmaForms owner={owner} tables={part.tables} />;
    case "etymology":
      return (
        <Block id={`etymology-${owner}`} label="Etymology">
          {part.etymologies.map((etymology) => (
            <OneLine key={factRefKey(etymology.ref)} text={etymology.text} lang="it" />
          ))}
        </Block>
      );
    case "synonyms":
      return <WordList id={`synonyms-${owner}`} label="Synonyms" items={part.items} level="h3" />;
  }
}

/**
 * A source reading: its heading, then each part the page model gave it, in
 * order. A form-of reading draws its own definitions as form lines under its
 * heading, never as numbered *Definitions*, with or without its lemma's table
 * (#690), and has no *Forms* of its own (#694); any other reading lists its
 * own numbered. A bare reading, only on a page where no reading has anything
 * to show, is its heading alone, and a lone one is its part of speech with no
 * number (#696).
 */
export function ReadingView({ entry }: { entry: PageReading | BareReading | LoneBareReading }) {
  const { reading } = entry;
  const grammar = headingGrammar(reading);
  const parts: readonly (LemmaPart | FormOfPart)[] = entry.kind === "source" ? entry.parts : [];
  return (
    <article
      className={READING}
      id={`reading-${entryKey(reading)}`}
      aria-labelledby={`reading-heading-${entryKey(reading)}`}
      data-record={reading.recordId}
      data-line={reading.ref.lineNo}
    >
      <h2 className={READING_HEADING} id={`reading-heading-${entryKey(reading)}`}>
        {entry.kind !== "lone-bare" && (
          <>
            <span className={READING_NUMBER}>{entry.number}</span>
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
      {parts.map((part) => (
        <ReadingPartView key={part.kind} reading={reading} part={part} />
      ))}
    </article>
  );
}
