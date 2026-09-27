// How one reading renders: a heading `1 · Sostantivo`, then *Definitions*, then
// *Forms* — no box around it, a thin rule before the next
// (design-system-manifest.md § "The result").
//
// The part of speech is the record's own `pos_title`, verbatim (ADR 0015).
// Nothing on the reading says where a fact came from (ADR 0016): a definition
// recovered from the raw page reads like any other, and so does a mood or an
// article worked out by rule. Every Italian string carries `lang="it"`.

import type { ReactNode } from "react";
import { everyRecovered, isVerbReading, searchedSpellings } from "@lexema/lookup/types.ts";
import type { RecoveredDefinition, Reading, Review, Sense } from "@lexema/lookup/types.ts";
import { conjugationOf } from "./conjugation.ts";
import { agreementOf } from "./genderGrid.ts";
import { ConjugationView, GridView, OtherForms, SuperlativeGrid, searchHref } from "./Forms";
import type { PageReading } from "./wordPage.ts";
import { WordList } from "./WordList";
import {
  BLOCK,
  BLOCK_LABEL,
  BLOCK_LABEL_WORD,
  DEFINITION,
  DEFINITION_BODY,
  DEFINITION_NUMBER,
  DEFINITIONS,
  DEFINITIONS_GROUP,
  DISPUTED,
  DISPUTED_LIST,
  DISPUTED_MARK,
  EXAMPLE,
  EXAMPLE_EXTRA,
  EXAMPLE_FROM,
  ETYMOLOGY,
  GLOSS,
  GLOSS_LINK,
  GLOSS_SILENT,
  MENTION,
  MORE,
  MORE_CLOSED,
  MORE_LIST,
  MORE_OPEN,
  MORE_SUMMARY,
  READING,
  READING_DOT,
  READING_HEADING,
  READING_NUMBER,
  SENSE_LABEL,
  SUB_ITEMS,
} from "./styles.ts";

/** How many definitions show before `N more definitions`. */
export const DEFINITION_SLICE = 1;

/** A block: a small grey label over its content. */
function Block({ id, label, children }: { id: string; label: ReactNode; children: ReactNode }) {
  return (
    <section className={BLOCK} aria-labelledby={id}>
      <h3 className={BLOCK_LABEL} id={id}>
        {label}
      </h3>
      {children}
    </section>
  );
}


/**
 * Two source glosses for `casa` are page furniture, not definitions (#28, #61).
 * A sense that opens a list of recovered items is a definition whatever its
 * gloss starts with.
 */
function isEntryFurniture(sense: Sense, word: string): boolean {
  return (
    sense.glosses.length > 0 &&
    sense.recoveredItems.length === 0 &&
    sense.glosses.every(({ text }) => text === `${word} ( citazioni)` || text.startsWith(`${word} ( approfondimento)`))
  );
}

/** One numbered definition: a sense of the record, or one read back from the raw page. */
type DefinitionItem =
  | { from: "record"; sense: Sense; examples: string[] }
  | { from: "page"; definition: RecoveredDefinition; examples: string[] };

/**
 * The reading's definitions in order, each with its examples, and the examples
 * of the furniture senses left out, which stay reachable behind the reading's
 * control. An example the record holds that is really a recovered definition
 * is shown once, as that definition.
 */
function definitionsOf(reading: Reading): { items: DefinitionItem[]; furnitureExamples: string[] } {
  const heldAsDefinition = new Set(
    everyRecovered(reading).flatMap((definition) => definition.heldAsExample?.jsonPointer ?? []),
  );
  // Furniture is left out only when the reading has real definitions to show
  // instead; a reading with nothing else shows it verbatim rather than nothing.
  const furniture = (sense: Sense) => isEntryFurniture(sense, reading.word);
  const hasOwn = reading.recovered.length > 0 || reading.senses.some((sense) => !furniture(sense));
  const examplesOf = (sense: Sense): string[] =>
    sense.examples.filter((example) => !heldAsDefinition.has(example.ref.jsonPointer)).map((example) => example.text);
  const items: DefinitionItem[] = [
    ...reading.senses
      .filter((sense) => !hasOwn || !furniture(sense))
      .map(
        (sense): DefinitionItem => ({
          from: "record",
          sense,
          examples: examplesOf(sense),
        }),
      ),
    ...reading.recovered.map(
      (definition): DefinitionItem => ({
        from: "page",
        definition,
        examples: definition.examples.map((example) => example.text),
      }),
    ),
  ];
  const furnitureExamples = hasOwn ? reading.senses.filter(furniture).flatMap(examplesOf) : [];
  return { items, furnitureExamples };
}

/** How many examples a definition's nested items carry, at any depth. */
const nestedExamples = (items: readonly RecoveredDefinition[]): number =>
  items.reduce((count, item) => count + item.examples.length + nestedExamples(item.items), 0);

const nestedItemsOf = (item: DefinitionItem): readonly RecoveredDefinition[] =>
  item.from === "record" ? item.sense.recoveredItems : item.definition.items;

/**
 * The words a sense's `form_of` edges name, to link where its gloss writes
 * them: `terza persona plurale dell'imperfetto indicativo di andare`.
 */
function lemmaWordsOf(reading: Reading, sense: Sense): string[] {
  return reading.lemmaLinks
    .filter((link) => link.kind === "candidates" && link.ref.jsonPointer.startsWith(`/senses/${sense.index}/`))
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

/** The labels the source put on a sense — `figurato`, `scuola` — before its gloss. */
function senseLabels(labels: readonly string[]): string[] {
  return labels.filter((label) => label !== "form-of");
}

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
          {definition.text}
        </p>
        <SubItems items={definition.items} />
      </>
    );
  }
  const { sense } = item;
  if (sense.glosses.length === 0) {
    return <p className={GLOSS_SILENT}>The source gives no definition for this sense.</p>;
  }
  const labels = senseLabels(sense.labels.map((label) => label.label));
  const lemmas = lemmaWordsOf(reading, sense);
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

const definitionKey = (item: DefinitionItem): string =>
  item.from === "record" ? `sense-${item.sense.index}` : `page-${item.definition.ref.line}`;

function Example({ text, from }: { text: string; from?: number }) {
  return (
    <p className={EXAMPLE}>
      <span lang="it">{text}</span>
      {from !== undefined && <span className={EXAMPLE_FROM}>from definition {from}</span>}
    </p>
  );
}

function DefinitionLine({
  item,
  number,
  reading,
  children,
}: {
  item: DefinitionItem;
  number: number;
  reading: Reading;
  children: ReactNode;
}) {
  return (
    <li className={DEFINITION} data-definition={number}>
      <span className={DEFINITION_NUMBER} aria-hidden="true">
        {number}.
      </span>
      <div className={DEFINITION_BODY}>
        <DefinitionText item={item} reading={reading} />
        {children}
      </div>
    </li>
  );
}

const plural = (count: number, noun: string): string => `${count} more ${noun}${count === 1 ? "" : "s"}`;

/**
 * The first definition with one example, then one control that shows the
 * rest: the other definitions, and every example not yet shown, including
 * those of nested items and of furniture senses left out. The example
 * under the first definition is its own; when it has none, the reading's first
 * example, marked with the definition it belongs to and not shown again there.
 * Everything is in the document whether the control is open or not.
 */
function Definitions({ reading }: { reading: Reading }) {
  const { items, furnitureExamples } = definitionsOf(reading);
  if (items.length === 0) return null;
  const [first] = items;
  const borrowed = first.examples.length === 0 ? items.findIndex((item) => item.examples.length > 0) : -1;
  const firstExtra = first.examples.slice(1);
  const rest = items.slice(DEFINITION_SLICE);
  // Examples the closed control hides outside the other definitions: the first
  // definition's others, those of its nested items, and the furniture's.
  const hiddenExamples = firstExtra.length + nestedExamples(nestedItemsOf(first)) + furnitureExamples.length;
  const label = [
    ...(rest.length > 0 ? [plural(rest.length, "definition")] : []),
    ...(hiddenExamples > 0 ? [plural(hiddenExamples, "example")] : []),
  ].join(" · ");
  return (
    <Block id={`definitions-${reading.recordId}`} label="Definitions">
      <div className={DEFINITIONS_GROUP}>
        <ol className={DEFINITIONS}>
          <DefinitionLine item={first} number={1} reading={reading}>
            {borrowed > 0 ? (
              <Example text={items[borrowed].examples[0]} from={borrowed + 1} />
            ) : (
              first.examples.length > 0 && <Example text={first.examples[0]} />
            )}
            {firstExtra.map((text, i) => (
              <p key={i} className={EXAMPLE_EXTRA}>
                <span lang="it">{text}</span>
              </p>
            ))}
          </DefinitionLine>
        </ol>
        {label !== "" && (
          <details className={MORE}>
            <summary className={MORE_SUMMARY}>
              <span className={MORE_CLOSED}>{label}</span>
              <span className={MORE_OPEN}>fewer</span>
            </summary>
            {rest.length > 0 && (
              <ol className={`${DEFINITIONS} ${MORE_LIST}`} start={DEFINITION_SLICE + 1}>
                {rest.map((item, i) => {
                  const index = DEFINITION_SLICE + i;
                  const examples = index === borrowed ? item.examples.slice(1) : item.examples;
                  return (
                    <DefinitionLine key={definitionKey(item)} item={item} number={index + 1} reading={reading}>
                      {examples.map((text, j) => (
                        <Example key={j} text={text} />
                      ))}
                    </DefinitionLine>
                  );
                })}
              </ol>
            )}
            {furnitureExamples.map((text, i) => (
              <Example key={`furniture-${i}`} text={text} />
            ))}
          </details>
        )}
      </div>
    </Block>
  );
}

/**
 * A lemma the release has whose word the definition does not write, linked on
 * a line of its own, so the source's `form_of` edge stays reachable. A lemma
 * the release has no entry for is not mentioned (Huey, 2026-09-27, on #142).
 */
function LemmaLines({ reading }: { reading: Reading }) {
  const linkedInGloss = (word: string, pointer: string) =>
    reading.senses.some(
      (sense) =>
        pointer.startsWith(`/senses/${sense.index}/`) &&
        sense.glosses.some((gloss) =>
          lemmaMatches(gloss.text, lemmaWordsOf(reading, sense)).some((match) => match.lemma === word),
        ),
    );
  const unlinked = new Set<string>();
  for (const link of reading.lemmaLinks) {
    if (link.kind === "candidates" && !linkedInGloss(link.targetWord, link.ref.jsonPointer)) unlinked.add(link.targetWord);
  }
  return (
    <>
      {[...unlinked].map((word) => (
        <p key={word} className={MENTION}>
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

/**
 * A claim later research disputes. The source keeps saying what it said, and
 * the page says the evidence disagrees. `studente`'s verb reading is in this state.
 */
function Disputes({ reviews }: { reviews: readonly Review[] }) {
  const disputed = reviews.filter((review) => review.status === "disputed");
  if (disputed.length === 0) return null;
  return (
    <div className={DISPUTED} role="note">
      <p className="m-0">
        <strong className={DISPUTED_MARK}>Disputed by later research.</strong> This entry is shown as the source
        wrote it; the evidence below disagrees with it.
      </p>
      <ul className={DISPUTED_LIST}>
        {disputed.map((review, i) => (
          <li key={i}>
            {review.note}{" "}
            <a className="text-accent underline" href={review.evidenceUrl} rel="noreferrer">
              evidence
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}


/** The reading's own forms, in the shape they have. */
function OwnForms({ reading }: { reading: Reading }) {
  const id = `forms-${reading.recordId}`;
  if (isVerbReading(reading)) {
    if (reading.forms.length === 0) return null;
    const searched = searchedSpellings(reading);
    return (
      <Block id={id} label="Forms">
        <ConjugationView
          conjugation={conjugationOf(reading.forms, searched)}
          searchedPointers={searched.formPointers}
          word={reading.word}
        />
      </Block>
    );
  }
  const { grid, superlative, unplaced } = agreementOf(reading);
  if (grid === undefined && superlative === undefined && unplaced.length === 0) return null;
  return (
    <Block id={id} label="Forms">
      {grid !== undefined && <GridView grid={grid} label={`Forms of ${reading.word}`} />}
      {superlative !== undefined && <SuperlativeGrid grid={superlative} />}
      <OtherForms groups={unplaced} links={false} />
    </Block>
  );
}

/** *Forms of andare*: the lemma's whole table, opened where the searched form sits. */
function LemmaForms({ entry }: { entry: PageReading }) {
  return (
    <>
      {entry.lemmaTables.map(({ lemma, listing }) => {
        const searched = searchedSpellings(listing);
        return (
          <Block
            key={lemma.recordId}
            id={`lemma-forms-${entry.reading.recordId}-${lemma.recordId}`}
            label={
              <>
                Forms of
                <span className={BLOCK_LABEL_WORD} lang="it">
                  {lemma.word}
                </span>
              </>
            }
          >
            <ConjugationView
              conjugation={conjugationOf(listing.forms, searched)}
              searchedPointers={searched.formPointers}
              word={lemma.word}
            />
          </Block>
        );
      })}
    </>
  );
}

export function ReadingView({ entry, query }: { entry: PageReading; query: string }) {
  const { reading, number } = entry;
  return (
    <article
      className={READING}
      id={`reading-${reading.recordId}`}
      aria-labelledby={`reading-heading-${reading.recordId}`}
      data-record={reading.recordId}
      data-line={reading.ref.lineNo}
    >
      <h2 className={READING_HEADING} id={`reading-heading-${reading.recordId}`}>
        <span className={READING_NUMBER}>{number}</span>
        <span className={READING_DOT} aria-hidden="true">
          ·
        </span>
        <span lang="it">{reading.posTitle}</span>
      </h2>
      {/* A record that merely lists the query in its table is not a claim
          about the query, and saying so stops a reader inferring a lemma
          nobody stated. */}
      {!reading.isAboutQuery && (
        <p className={MENTION}>
          <span lang="it">{reading.word}</span> lists <q lang="it">{query}</q> among its forms.
        </p>
      )}
      <Disputes reviews={reading.reviews} />
      <Definitions reading={reading} />
      <LemmaLines reading={reading} />
      <OwnForms reading={reading} />
      <LemmaForms entry={entry} />
      {entry.etymologies.length > 0 && (
        <Block id={`etymology-${reading.recordId}`} label="Etymology">
          {entry.etymologies.map((etymology) => (
            <p key={etymology.ref.jsonPointer} className={ETYMOLOGY} lang="it">
              {etymology.text}
            </p>
          ))}
        </Block>
      )}
      <WordList id={`synonyms-${reading.recordId}`} label="Synonyms" words={entry.synonyms} level="h3" />
    </article>
  );
}
