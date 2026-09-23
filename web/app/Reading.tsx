// How one reading renders: a numbered card with a title row, a header bar of
// the facts the source states, then sections — definitions, examples, forms or
// the conjugation — and, for a form, a panel pointing to its lemma.
//
// Three rules run through every part of it, from design-system-manifest.md §
// "The result card": the interface is English and the source's Italian is never
// translated, so every Italian string carries `lang="it"` inside a document that
// is `lang="en"`; every record the lookup returned is a card, and every lemma a
// card points to is its lemma panel (`wordPage.ts`); and facts are laid out rather than
// listed — a header bar for the headline facts, boxes three across for the
// paradigms, and a section with nothing in it simply absent.

import type { ReactNode } from "react";
import {
  isAdjectiveReading,
  isNounReading,
  isVerbReading,
  searchedSpellings,
} from "@lexema/lookup/types.ts";
import type {
  ArticleDisplay,
  ArticleWithholding,
  GrammarClaim,
  Reading,
  Review,
  SearchedSpellings,
  Sense,
  SourceForm,
} from "@lexema/lookup/types.ts";
import type { LemmaTarget } from "@lexema/lookup/types.ts";
import {
  IT_MOODS_RULE,
  NON_FINITE_ROLES,
  TENSE_BOXES,
  placeItalianVerbForm,
  type NonFiniteRole,
  type VerbSlot,
} from "@lexema/italian/moods.ts";
import { Folds } from "./Folds";
import { ChevronIcon } from "./icons";
import type { Card } from "./wordPage.ts";
import {
  BOX,
  BOX_CELL,
  BOX_HEADING,
  BOX_LINE,
  BOX_NOTE,
  BOX_ROW,
  BOX_ROW_LABEL,
  BOX_ROWS,
  CARD,
  CARD_BODY,
  CARD_NUMBER,
  CARD_TITLE,
  CHEVRON,
  DEFINITION,
  DEFINITION_NUMBER,
  DEFINITIONS,
  DISPUTED,
  DISPUTED_LIST,
  DISPUTED_MARK,
  ENTRY_NOTE,
  EXAMPLE,
  EXAMPLES,
  FOLD,
  FOLD_BOX_SEARCHED,
  FOLD_CHEVRON,
  FOLD_COUNT,
  FOLD_HEADING,
  FOLD_NAME,
  FOLD_ROW,
  FOLD_SUMMARY,
  FOLD_TENSE_HEADING,
  FOLD_TENSE_NAME,
  FORM_OF,
  GLOSS,
  HEADLINE,
  HEADLINE_FACT,
  HEADLINE_FORM,
  HEADLINE_LABEL,
  HEADLINE_VALUE,
  HEADWORD,
  LEMMA_ARROW,
  LEMMA_BODY,
  LEMMA_LINE,
  LEMMA_OPEN,
  LEMMA_PANEL,
  LEMMA_WORD,
  MENTION,
  MORE,
  MORE_BUTTON,
  MORE_BUTTON_WIDE,
  MORE_CLOSED,
  MORE_OPEN,
  MORE_PHONE_ONLY,
  POS_PILL,
  SEARCHED,
  SEARCHED_CELL,
  SEARCHED_LABEL,
  SEARCHED_NOTE,
  SECTION,
  SECTION_COUNT,
  SECTION_HEADER,
  SECTION_NAME,
  SECTION_NOTE,
  SECTION_RULE,
  SENSE_LABEL,
  SILENCE,
  TENSE_HEADING,
} from "./styles.ts";

// Small shared pieces -------------------------------------------------------

/** Nicer than `pos_title`, which is Italian and inconsistent. */
const POS_LABEL: Record<string, string> = {
  noun: "noun",
  verb: "verb",
  adj: "adjective",
  adv: "adverb",
  name: "name",
  phrase: "phrase",
  prep: "preposition",
  conj: "conjunction",
  pron: "pronoun",
  intj: "interjection",
  num: "numeral",
  abbrev: "abbreviation",
};

export const posLabel = (pos: string): string => POS_LABEL[pos] ?? pos;

/**
 * The part of speech a card's pill and index chip carry: `noun form` when the
 * record says it is a form of another word, which is what the source's own
 * `form_of` edge states.
 */
export function readingKind(reading: Reading): string {
  return reading.lemmaLinks.length > 0 ? `${posLabel(reading.pos)} form` : posLabel(reading.pos);
}

/** The words a form reading names as its lemma, once each. */
export function lemmaWords(reading: Reading): string[] {
  return [...new Set(reading.lemmaLinks.map((link) => link.targetWord))];
}

/** The value the source stated for one dimension, if it stated one. */
function stated(claims: readonly GrammarClaim[], dimension: string): string | undefined {
  for (const claim of claims) {
    if (claim.status === "stated" && claim.dimension === dimension) return claim.value;
  }
  return undefined;
}

/** Every distinct value the source stated for one dimension, in source order. */
function statedValues(claims: readonly GrammarClaim[], dimension: string): string[] {
  const values: string[] = [];
  for (const claim of claims) {
    if (claim.status !== "stated" || claim.dimension !== dimension) continue;
    if (!values.includes(claim.value)) values.push(claim.value);
  }
  return values;
}

/**
 * `form-of` is how the source marks a record as a form of another word. The
 * card says that once, in its title (`of sala`) and its lemma panel, so the tag
 * itself is not printed again anywhere on the card.
 */
const isFormOfTag = (text: string): boolean => text === "form-of";

/** An Italian word, in a page whose language is English. */
function It({ children }: { children: string }) {
  return <span lang="it">{children}</span>;
}

/** `a`, `a and b`, `a, b and c` — an English list inside one sentence. */
function listPhrase(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** The same list under a negation, where *and* would read as the wrong claim. */
function orPhrase(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} or ${parts[parts.length - 1]}`;
}

// Spellings -----------------------------------------------------------------
//
// Every Italian spelling of the entry renders through `Spelled`, which says
// which source row it came from — `data-headword` for the headword,
// `data-form="3"` for the record's fourth `forms[]` entry. That turns "every
// form is on this card" into something a test counts rather than a spelling it
// pattern-matches.

type Spelling =
  | { kind: "headword"; surface: string }
  | { kind: "form"; index: number; surface: string; pointer: string };

const headwordOf = (entry: { word: string }): Spelling => ({ kind: "headword", surface: entry.word });

const spellingOf = (form: SourceForm): Spelling => ({
  kind: "form",
  index: form.index,
  surface: form.surface,
  pointer: form.ref.jsonPointer,
});

const spellingKey = (spelling: Spelling): string =>
  spelling.kind === "headword" ? "headword" : `form-${spelling.index}`;

function Spelled({ spelling }: { spelling: Spelling }) {
  return spelling.kind === "headword" ? (
    <span lang="it" data-headword="">
      {spelling.surface}
    </span>
  ) : (
    <span lang="it" data-form={spelling.index}>
      {spelling.surface}
    </span>
  );
}

/** Several spellings in one cell, as the source filed them: `va' / vai`. */
function Spellings({ spellings }: { spellings: readonly Spelling[] }) {
  return (
    <>
      {spellings.map((spelling, i) => (
        <span key={spellingKey(spelling)}>
          {i > 0 && " / "}
          <Spelled spelling={spelling} />
        </span>
      ))}
    </>
  );
}

/**
 * Whether the query hit this spelling, read off the lookup's own evidence: a
 * form by its pointer, the headword by a headword hit. Nothing compares
 * spellings, so a form the index never matched is never outlined (#49).
 */
function isSearched(spelling: Spelling, searched: SearchedSpellings): boolean {
  return spelling.kind === "headword" ? searched.headword : searched.formPointers.has(spelling.pointer);
}

// Sections and disclosure ---------------------------------------------------

/** A section's header: its name, a count, and a hairline to the right edge. */
function Section({
  id,
  name,
  count,
  note,
  children,
}: {
  id: string;
  name: string;
  count?: string;
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={SECTION} aria-labelledby={id}>
      <div className={SECTION_HEADER}>
        <h3 className={SECTION_NAME} id={id}>
          {name}
        </h3>
        {count !== undefined && <span className={SECTION_COUNT}>{count}</span>}
        <span className={SECTION_RULE} aria-hidden="true" />
      </div>
      {note !== undefined && <p className={SECTION_NOTE}>{note}</p>}
      {children}
    </section>
  );
}

/** `5 · showing 1` when a set is sliced, else the total alone. */
export function sliceCount(total: number, slice: number): string {
  return total > slice ? `${total} · showing ${slice}` : `${total}`;
}

/**
 * The rest of a set, behind a bordered button that opens it in place.
 *
 * A native `<details>`: the whole set is in the document whether or not it is
 * open, so nothing is dropped for a reader without JavaScript, a search engine
 * or a screen reader.
 */
export function ShowAll({
  total,
  noun,
  wide = false,
  phoneOnly = false,
  children,
}: {
  total: number;
  noun: string;
  wide?: boolean;
  /** Only a phone's shorter slice leaves anything behind it. */
  phoneOnly?: boolean;
  children: ReactNode;
}) {
  return (
    <details className={phoneOnly ? MORE_PHONE_ONLY : MORE}>
      <summary className={wide ? MORE_BUTTON_WIDE : MORE_BUTTON}>
        <span className={MORE_CLOSED}>
          Show all {total} {noun}
        </span>
        <span className={MORE_OPEN}>Show fewer {noun}</span>
        <ChevronIcon className={CHEVRON} />
      </summary>
      {children}
    </details>
  );
}

// The header bar ------------------------------------------------------------

/**
 * One headline fact: a small English label over its value. A value that is a
 * word form renders in mono, like every form on the page.
 */
interface HeadlineFact {
  label: string;
  value: ReactNode;
  form?: boolean;
}

function HeadlineBar({ facts }: { facts: readonly HeadlineFact[] }) {
  if (facts.length === 0) return null;
  return (
    <dl className={HEADLINE}>
      {facts.map((fact) => (
        <div key={fact.label} className={HEADLINE_FACT}>
          <dt className={HEADLINE_LABEL}>{fact.label}</dt>
          <dd className={fact.form ? HEADLINE_FORM : HEADLINE_VALUE}>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * What the source states about the record itself beyond the bar's own facts —
 * `transitivity`, or a label such as `inv.` it wrote as free text — as more
 * facts on the same bar, so nothing it said is left off the card and nothing
 * sits as a loose pill under it.
 */
function otherRecordFacts(claims: readonly GrammarClaim[], shown: readonly string[]): HeadlineFact[] {
  const facts: HeadlineFact[] = [];
  const labels: string[] = [];
  for (const claim of claims) {
    if (claim.status === "missing") continue;
    if (claim.status === "unclassified") {
      if (!isFormOfTag(claim.sourceText)) labels.push(claim.sourceText);
      continue;
    }
    if (shown.includes(claim.dimension)) continue;
    const existing = facts.find((fact) => fact.label === claim.dimension);
    if (existing === undefined) facts.push({ label: claim.dimension, value: claim.value });
    else existing.value = `${existing.value}, ${claim.value}`;
  }
  if (labels.length > 0) {
    facts.push({ label: "label", value: <It>{labels.join(", ")}</It> });
  }
  return facts;
}

// Boxes -----------------------------------------------------------------------
//
// A box is a group of forms: a heading and its label-value rows. It is data —
// `FormGroup` — until `FormGroups` lays a set of them out, because how a group
// is drawn depends on the set it is in: three to a row on a wide screen, and on
// a phone, in a set of more than `GROUPS_SHOWN_OPEN`, one tappable row each.

/**
 * One row of a group: the spellings the source filed under a label, or — the
 * articles — a spelling Lexema derived, which is never the searched form.
 */
type GroupLine =
  | { key: string; label: ReactNode; spellings: readonly Spelling[] }
  | { key: string; label: string; derived: string };

interface FormGroup {
  id: string;
  heading: string;
  /** A tense's name is Italian and drawn as the conjugation frames draw it. */
  tense: boolean;
  lines: readonly GroupLine[];
  note?: ReactNode;
}

/** How many forms a group holds: what its tappable row says on a phone. */
const formsIn = (group: FormGroup): number =>
  group.lines.reduce((count, line) => count + ("spellings" in line ? line.spellings.length : 1), 0);

/** Whether the query hit a form of this group, so the group opens on its own. */
const holdsSearched = (group: FormGroup, searched: SearchedSpellings): boolean =>
  group.lines.some((line) => "spellings" in line && line.spellings.some((spelling) => isSearched(spelling, searched)));

/**
 * How many groups a set may hold and still render open on a phone. A noun or
 * adjective card makes at most four — gender and number, articles, degrees and
 * the other forms — so only a verb's conjugation, with up to seventeen, folds.
 */
export const GROUPS_SHOWN_OPEN = 4;

/** A group's rows, the searched one outlined where it sits. */
function GroupRows({ group, searched }: { group: FormGroup; searched: SearchedSpellings }) {
  return (
    <dl className={BOX_ROWS}>
      {group.lines.map((line) =>
        "spellings" in line ? (
          <SpellingLine key={line.key} label={line.label} spellings={line.spellings} searched={searched} />
        ) : (
          <BoxLine key={line.key} label={line.label}>
            <It>{line.derived}</It>
          </BoxLine>
        ),
      )}
    </dl>
  );
}

function Box({ group, searched }: { group: FormGroup; searched: SearchedSpellings }) {
  return (
    <section className={BOX} aria-labelledby={group.id}>
      <h4 className={group.tense ? TENSE_HEADING : BOX_HEADING} id={group.id} lang={group.tense ? "it" : undefined}>
        {group.heading}
      </h4>
      <GroupRows group={group} searched={searched} />
      {group.note !== undefined && <p className={BOX_NOTE}>{group.note}</p>}
    </section>
  );
}

/**
 * A group that folds on a phone: a native `<details>`, so it opens and closes
 * with no script, and the one holding the searched form is open in the HTML the
 * server sends. On a wide screen it is drawn as the box above, open or not.
 */
function FoldingBox({ group, searched }: { group: FormGroup; searched: SearchedSpellings }) {
  const open = holdsSearched(group, searched);
  const lang = group.tense ? "it" : undefined;
  return (
    <section className={open ? FOLD_BOX_SEARCHED : BOX} aria-labelledby={group.id}>
      <h4 className={group.tense ? FOLD_TENSE_HEADING : FOLD_HEADING} id={group.id} lang={lang}>
        {group.heading}
      </h4>
      <details className={FOLD} open={open} data-fold="">
        <summary className={FOLD_SUMMARY}>
          <span className={group.tense ? FOLD_TENSE_NAME : FOLD_NAME} lang={lang}>
            {group.heading}
          </span>
          <span className={FOLD_COUNT}>
            {formsIn(group)}
            <span className="sr-only"> forms</span>
          </span>
          <ChevronIcon className={FOLD_CHEVRON} />
        </summary>
        <GroupRows group={group} searched={searched} />
        {group.note !== undefined && <p className={BOX_NOTE}>{group.note}</p>}
      </details>
    </section>
  );
}

/** A set of groups: boxes in a row, or on a phone, past the threshold, folds. */
function FormGroups({ groups, searched }: { groups: readonly FormGroup[]; searched: SearchedSpellings }) {
  if (groups.length <= GROUPS_SHOWN_OPEN) {
    return (
      <div className={BOX_ROW}>
        {groups.map((group) => (
          <Box key={group.id} group={group} searched={searched} />
        ))}
      </div>
    );
  }
  return (
    <Folds groups={groups.length}>
      <div className={FOLD_ROW}>
        {groups.map((group) => (
          <FoldingBox key={group.id} group={group} searched={searched} />
        ))}
      </div>
    </Folds>
  );
}

/**
 * One row: a small grey label and its value. The row the query hit is
 * outlined where it sits, by a border and in words, never by colour alone.
 */
function BoxLine({
  label,
  searched = false,
  children,
}: {
  label: ReactNode;
  searched?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={searched ? SEARCHED : BOX_LINE} data-searched={searched ? "" : undefined}>
      <dt className={searched ? SEARCHED_LABEL : BOX_ROW_LABEL}>{label}</dt>
      <dd className={searched ? SEARCHED_CELL : BOX_CELL}>{children}</dd>
      {searched && <span className={SEARCHED_NOTE}>your search</span>}
    </div>
  );
}

/** A row of spellings, outlined when one of them is the searched form. */
function SpellingLine({
  label,
  spellings,
  searched,
}: {
  label: ReactNode;
  spellings: readonly Spelling[];
  searched: SearchedSpellings;
}) {
  return (
    <BoxLine label={label} searched={spellings.some((spelling) => isSearched(spelling, searched))}>
      <Spellings spellings={spellings} />
    </BoxLine>
  );
}

// Definitions and examples ---------------------------------------------------

/**
 * A claim review, shown with the claim it is about. A disputed claim is never
 * quietly dropped and never quietly corrected: the source keeps saying what it
 * said, and the page says the evidence disagrees. `studente`'s verb reading is
 * in this state.
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
            </a>{" "}
            · reviewed {review.reviewedAt} by {review.reviewedBy} · claim <code>{review.ref.jsonPointer}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The first visible slice of each sliced section, named once. */
export const DEFINITION_SLICE = 1;
export const EXAMPLE_SLICE = 1;

/** Two source glosses for casa are page furniture, not definitions (#28, #61). */
function isEntryFurniture(sense: Sense, word: string): boolean {
  return (
    sense.glosses.length > 0 &&
    sense.glosses.every(
      ({ text }) => text === `${word} ( citazioni)` || text.startsWith(`${word} ( approfondimento)`),
    )
  );
}

/**
 * The labels the source put on a sense — `figuratively`, `scuola` — ahead of
 * its gloss in parentheses, the way a dictionary prints them. `form-of` is not
 * one of them: the card's title already says the reading is a form.
 */
function senseLabels(sense: Sense): string[] {
  return sense.labels.map((label) => label.label).filter((label) => !isFormOfTag(label));
}

function Definition({ sense, number }: { sense: Sense; number: number }) {
  const labels = senseLabels(sense);
  return (
    <li className={DEFINITION}>
      <span className={DEFINITION_NUMBER} aria-hidden="true">
        {number}.
      </span>
      <div>
        {sense.glosses.length === 0 ? (
          <p className={SILENCE}>The source carries no definition for this sense.</p>
        ) : (
          sense.glosses.map((gloss, i) => (
            <p key={i} className={GLOSS} lang="it">
              {i === 0 && labels.length > 0 && <span className={SENSE_LABEL}>({labels.join(", ")}) </span>}
              {gloss.text}
            </p>
          ))
        )}
      </div>
    </li>
  );
}

function Definitions({ reading }: { reading: Reading }) {
  const definitions = reading.senses.filter((sense) => !isEntryFurniture(sense, reading.word));
  if (definitions.length === 0) return null;
  const first = definitions.slice(0, DEFINITION_SLICE);
  const rest = definitions.slice(DEFINITION_SLICE);
  return (
    <Section
      id={`definitions-${reading.recordId}`}
      name="Definitions"
      count={sliceCount(definitions.length, DEFINITION_SLICE)}
    >
      <ol className={DEFINITIONS}>
        {first.map((sense, i) => (
          <Definition key={sense.index} sense={sense} number={i + 1} />
        ))}
      </ol>
      {rest.length > 0 && (
        <ShowAll total={definitions.length} noun="definitions">
          <ol className={`${DEFINITIONS} mt-3`} start={DEFINITION_SLICE + 1}>
            {rest.map((sense, i) => (
              <Definition key={sense.index} sense={sense} number={DEFINITION_SLICE + i + 1} />
            ))}
          </ol>
        </ShowAll>
      )}
    </Section>
  );
}

/**
 * The notes `casa`'s record carries in place of a definition: shown as notes,
 * with no definition invented around them.
 */
function EntryNotes({ reading }: { reading: Reading }) {
  const furniture = reading.senses.filter((sense) => isEntryFurniture(sense, reading.word));
  if (furniture.length === 0) return null;
  return (
    <Section id={`notes-${reading.recordId}`} name="Source notes" count={`${furniture.length}`}>
      <aside className={ENTRY_NOTE}>
        <p className="m-0 font-sans text-[0.85rem]">
          The source has entry notes but gives no definition for this reading.
        </p>
        {furniture.map((sense) =>
          sense.glosses.map((gloss, i) => (
            <p key={`${sense.index}-${i}`} className="m-0" lang="it">
              {gloss.text}
            </p>
          )),
        )}
      </aside>
    </Section>
  );
}

/** Every example on the reading's senses, verbatim, first slice shown. */
function Examples({ reading }: { reading: Reading }) {
  const examples = reading.senses.flatMap((sense) => sense.examples);
  if (examples.length === 0) return null;
  const item = (example: (typeof examples)[number]) => (
    <li key={example.ref.jsonPointer} className={EXAMPLE} lang="it">
      {example.text}
    </li>
  );
  return (
    <Section id={`examples-${reading.recordId}`} name="Examples" count={sliceCount(examples.length, EXAMPLE_SLICE)}>
      <ul className={EXAMPLES}>{examples.slice(0, EXAMPLE_SLICE).map(item)}</ul>
      {examples.length > EXAMPLE_SLICE && (
        <ShowAll total={examples.length} noun="examples">
          <ul className={`${EXAMPLES} mt-3`}>{examples.slice(EXAMPLE_SLICE).map(item)}</ul>
        </ShowAll>
      )}
    </Section>
  );
}

// Agreement: nouns and adjectives --------------------------------------------
//
// A noun or adjective is read for how it goes singular and plural, masculine
// and feminine. Each spelling the source filed under a gender or a number is a
// cell; the headword fills the cell its record states. Nothing is filed where
// the source did not file it: `sale` lists `sali` tagged plural and nothing
// else, so `sali` sits under `pl`, not under `m pl`.

type Gender = "masculine" | "feminine";
type GrammaticalNumber = "singular" | "plural";

interface AgreementCell {
  gender: Gender | undefined;
  number: GrammaticalNumber | undefined;
  spellings: Spelling[];
}

const GENDERS: readonly Gender[] = ["masculine", "feminine"];
const NUMBERS: readonly GrammaticalNumber[] = ["singular", "plural"];

const genderOf = (claims: readonly GrammarClaim[]): Gender | undefined => {
  const values = statedValues(claims, "gender");
  return values.length === 1 ? GENDERS.find((gender) => gender === values[0]) : undefined;
};
const numberOf = (claims: readonly GrammarClaim[]): GrammaticalNumber | undefined => {
  const values = statedValues(claims, "number");
  return values.length === 1 ? NUMBERS.find((number) => number === values[0]) : undefined;
};

/** `m sg`, `f pl`, `pl` — the row labels studente's frame draws. */
const cellLabel = (cell: Pick<AgreementCell, "gender" | "number">): string =>
  [cell.gender?.[0], cell.number === undefined ? undefined : cell.number === "singular" ? "sg" : "pl"]
    .filter((part) => part !== undefined)
    .join(" ");

/** A form carrying a degree other than positive belongs to the degree box. */
const hasDegree = (form: SourceForm): boolean =>
  statedValues(form.claims, "degree").some((degree) => degree !== "positive");

/** Every agreement cell this reading fills, in m sg, m pl, f sg, f pl order. */
function agreementCells(reading: Reading): AgreementCell[] {
  const cells: AgreementCell[] = [];
  const file = (claims: readonly GrammarClaim[], spelling: Spelling) => {
    const gender = genderOf(claims);
    const number = numberOf(claims);
    if (gender === undefined && number === undefined) return;
    const cell = cells.find((other) => other.gender === gender && other.number === number);
    if (cell === undefined) cells.push({ gender, number, spellings: [spelling] });
    else cell.spellings.push(spelling);
  };
  file(reading.grammar.record, headwordOf(reading));
  for (const form of reading.forms) if (!hasDegree(form)) file(form.claims, spellingOf(form));
  const rank = (cell: AgreementCell) =>
    (cell.gender === undefined ? 2 : GENDERS.indexOf(cell.gender)) * 3 +
    (cell.number === undefined ? 2 : NUMBERS.indexOf(cell.number));
  return cells.sort((a, b) => rank(a) - rank(b));
}

/** A noun or adjective card's agreement facts, and the forms they put on the bar. */
interface AgreementFacts {
  facts: HeadlineFact[];
  /** The `forms[]` entries the bar shows as its plural or feminine. */
  placed: Set<number>;
}

/**
 * The header bar's agreement facts: the record's own gender and number, then
 * the plural and the feminine the source files for it, as spellings.
 */
function agreementFacts(reading: Reading, cells: readonly AgreementCell[]): AgreementFacts {
  const facts: HeadlineFact[] = [];
  const placed = new Set<number>();
  const gender = statedValues(reading.grammar.record, "gender");
  const number = statedValues(reading.grammar.record, "number");
  if (gender.length > 0) facts.push({ label: "gender", value: gender.join(", ") });
  if (number.length > 0) facts.push({ label: "number", value: number.join(", ") });

  const recordGender = genderOf(reading.grammar.record);
  const spellingsWhere = (keep: (cell: AgreementCell) => boolean): Spelling[] => {
    const seen = new Set<string>();
    const spellings: Spelling[] = [];
    for (const spelling of cells.filter(keep).flatMap((cell) => cell.spellings)) {
      if (spelling.kind !== "form") continue;
      placed.add(spelling.index);
      if (seen.has(spelling.surface)) continue;
      seen.add(spelling.surface);
      spellings.push(spelling);
    }
    return spellings;
  };
  if (numberOf(reading.grammar.record) === "singular") {
    const plural = spellingsWhere(
      (cell) => cell.number === "plural" && (cell.gender === undefined || cell.gender === recordGender),
    );
    if (plural.length > 0) facts.push({ label: "plural", value: <Spellings spellings={plural} />, form: true });
  }
  if (recordGender === "masculine") {
    const feminine = spellingsWhere((cell) => cell.gender === "feminine" && cell.number === "singular");
    if (feminine.length > 0) facts.push({ label: "feminine", value: <Spellings spellings={feminine} />, form: true });
  }
  return { facts, placed };
}

/** Whether the source files spellings under more than one gender. */
const spansGenders = (cells: readonly AgreementCell[]): boolean =>
  new Set(cells.flatMap((cell) => (cell.gender === undefined ? [] : [cell.gender]))).size > 1;

/**
 * The gender-and-number box, drawn when the source files spellings under more
 * than one gender — `studente` and `studentessa`, `bello` and `bella`. A word
 * with one gender has its plural in the header bar already, and a box saying
 * the same thing again is the duplication the manifest rules out.
 */
function agreementGroup(id: string, cells: readonly AgreementCell[]): FormGroup {
  return {
    id,
    heading: "Gender and number",
    tense: false,
    lines: cells.map((cell) => ({ key: cellLabel(cell), label: cellLabel(cell), spellings: cell.spellings })),
  };
}

/**
 * Comparative and superlative forms, one row per form. When every form states
 * the same degree — `bella`'s four are all `absolute superlative` — the box is
 * named for it and each row says only gender and number; otherwise each row
 * names its own degree.
 */
function degreeGroup(id: string, forms: readonly SourceForm[]): FormGroup {
  const degreeOf = (form: SourceForm) => statedValues(form.claims, "degree").join(" ");
  const shared = new Set(forms.map(degreeOf)).size === 1 ? degreeOf(forms[0]) : undefined;
  const heading = shared === undefined ? "Comparative and superlative" : shared[0].toUpperCase() + shared.slice(1);
  return {
    id,
    heading,
    tense: false,
    lines: forms.map((form) => {
      const cell = cellLabel({ gender: genderOf(form.claims), number: numberOf(form.claims) });
      const label = shared === undefined ? [degreeOf(form), cell].filter((part) => part !== "").join(" · ") : cell;
      return { key: `form-${form.index}`, label: label || "form", spellings: [spellingOf(form)] };
    }),
  };
}

/** A short label for a form no box placed: its stated grammar, else its source text. */
function unplacedLabel(form: SourceForm): string {
  const cell = cellLabel({ gender: genderOf(form.claims), number: numberOf(form.claims) });
  if (cell !== "") return cell;
  const text = form.claims.flatMap((claim) =>
    claim.status === "stated" ? [claim.value] : claim.status === "unclassified" ? [claim.sourceText] : [],
  );
  return text.length > 0 ? text.join(", ") : "form";
}

/**
 * The forms of this record no box or bar placed, in source order, in one last
 * box named for what it holds — "never scattered" (design-system-manifest.md §
 * "The result card").
 */
function otherGroup(id: string, forms: readonly SourceForm[]): FormGroup {
  return {
    id,
    heading: "Other forms listed by this entry",
    tense: false,
    lines: forms.map((form) => ({ key: `form-${form.index}`, label: unplacedLabel(form), spellings: [spellingOf(form)] })),
  };
}

/** The articles `it-articles/v1` derives, in the order the frames list them. */
const ARTICLE_ORDER: readonly [ArticleDisplay["kind"], GrammaticalNumber][] = [
  ["definite", "singular"],
  ["definite", "plural"],
  ["indefinite", "singular"],
  ["indefinite", "plural"],
  ["partitive", "singular"],
  ["partitive", "plural"],
];

/**
 * The articles box: `definite sg  il sale`, the article and its noun once.
 *
 * These are the one thing on this card the source did not say, so the box
 * says so under its rows, by the rule's name.
 */
function articlesGroup(id: string, articles: readonly ArticleDisplay[]): FormGroup {
  const rows = ARTICLE_ORDER.flatMap(([kind, number]) =>
    articles.filter((article) => article.kind === kind && article.number === number),
  );
  return {
    id,
    heading: "Articles",
    tense: false,
    lines: rows.map((article) => ({
      key: `${article.kind}-${article.number}`,
      label: `${article.kind} ${article.number === "singular" ? "sg" : "pl"}`,
      derived: article.displayForm,
    })),
    note: (
      <>
        Not from the source: Lexema derives these by rule <code>it-articles/v1</code> from the gender and number the
        source states.
      </>
    ),
  };
}

/**
 * Why Lexema derives no article, when the card's silence line has not already
 * said it: three of the six reasons are "the source states no gender or no
 * number", which that line states on its own.
 */
function articleWithheldSentence(withholding: ArticleWithholding): string | undefined {
  switch (withholding.reason) {
    case "no-gender-or-number-stated":
    case "gender-not-stated":
    case "number-not-stated":
      return undefined;
    case "gender-is-not-masculine-or-feminine":
      return `Lexema derives no article: the source gives the gender as ${withholding.statedGender}, which is neither masculine nor feminine.`;
    case "number-is-not-singular-or-plural":
      return `Lexema derives no article: the source gives the number as ${withholding.statedNumber}, which is neither singular nor plural.`;
    case "surface-not-handled":
      return "Lexema derives no article: rule it-articles/v1 derives one for a single word, and this entry's headword is not one.";
  }
}

/** The gender and number a noun or adjective record does not state, as one sentence. */
function agreementSilence(reading: Reading): string | undefined {
  if (reading.lemmaLinks.length > 0) return undefined;
  const unstated = ["gender", "number"].filter((dimension) => stated(reading.grammar.record, dimension) === undefined);
  if (unstated.length === 2) return "The source states neither a gender nor a number for this entry.";
  if (unstated.length === 1) return `The source states no ${unstated[0]} for this entry.`;
  return undefined;
}

// Verbs -----------------------------------------------------------------------
//
// A verb reads as a conjugation: its non-finite facts in the header bar, then
// the finite forms in tense boxes three across. Which box a form goes in is
// `it-moods/v1` (src/italian/moods.ts): the tenses the source tags, and for the
// congiuntivo and condizionale the pronoun it writes beside the form. Nothing
// here reads a spelling.

/** A form's own tags and raw tags, recovered from its claims by pointer. */
function sourceTagsOf(form: SourceForm): { tags: string[]; rawTags: string[] } {
  const tags: string[] = [];
  const rawTags: string[] = [];
  for (const claim of form.claims) {
    if (claim.status === "missing") continue;
    if (/\/raw_tags\/\d+$/.test(claim.ref.jsonPointer)) rawTags.push(claim.sourceText);
    else if (/\/tags\/\d+$/.test(claim.ref.jsonPointer)) tags.push(claim.sourceText);
  }
  return { tags, rawTags };
}

const slotOf = (form: SourceForm): VerbSlot => placeItalianVerbForm(sourceTagsOf(form));

/**
 * A row's label: the pronoun the source wrote beside the form — `io`,
 * `che lui/che lei` — verbatim, else the person and number it stated.
 */
function rowLabel(form: SourceForm): string {
  const { rawTags } = sourceTagsOf(form);
  if (rawTags.length > 0) return rawTags.join(", ");
  return [stated(form.claims, "person")?.replace(/-person$/, ""), stated(form.claims, "number")]
    .filter((part) => part !== undefined)
    .join(" ");
}

/** Forms grouped into rows by label, in source order: `vado / vo` is one `io` row. */
function rowsOf(forms: readonly SourceForm[]): { label: string; forms: SourceForm[] }[] {
  const rows: { label: string; forms: SourceForm[] }[] = [];
  for (const form of forms) {
    const label = rowLabel(form);
    const row = rows.find((existing) => existing.label === label);
    if (row) row.forms.push(form);
    else rows.push({ label, forms: [form] });
  }
  return rows;
}

/**
 * A verb's table, whoever's it is: a verb reading's own, or — on a page whose
 * one card is a verb form — the lemma's, from the listing the lookup carried on
 * the reading's lemma link. `searched` is the rows the query hit.
 */
interface VerbTable {
  recordId: number;
  word: string;
  forms: readonly SourceForm[];
  searched: SearchedSpellings;
}

/** What the non-finite rows and the auxiliary are read from: a headword and its forms. */
type Tabulated = Pick<VerbTable, "word" | "forms">;

const tableOf = (reading: Reading): VerbTable => ({
  recordId: reading.recordId,
  word: reading.word,
  forms: reading.forms,
  searched: searchedSpellings(reading),
});

/** The lemma's table, when its own `forms[]` list the searched surface. */
const lemmaTableOf = (lemma: LemmaTarget): VerbTable | undefined =>
  lemma.listing === undefined
    ? undefined
    : { recordId: lemma.recordId, word: lemma.word, forms: lemma.listing.forms, searched: searchedSpellings(lemma.listing) };

/** The non-finite rows of the table, in their order, with the headword as infinito. */
function nonFiniteRows(table: Tabulated): { role: NonFiniteRole; spellings: Spelling[] }[] {
  const byRole = new Map<NonFiniteRole, Spelling[]>();
  for (const form of table.forms) {
    const slot = slotOf(form);
    if (slot.kind !== "non-finite") continue;
    byRole.set(slot.role, [...(byRole.get(slot.role) ?? []), spellingOf(form)]);
  }
  if (!byRole.has("infinito")) byRole.set("infinito", [headwordOf(table)]);
  return NON_FINITE_ROLES.flatMap((role) => {
    const spellings = byRole.get(role);
    return spellings === undefined ? [] : [{ role, spellings }];
  });
}

/** Every form the source writes as the auxiliary, and the verb-class text on it. */
function auxiliaries(table: Tabulated): SourceForm[] {
  return table.forms.filter((form) => slotOf(form).kind === "auxiliary");
}

/**
 * The conjugation class, as the source writes it: `verbo di prima coniugazione
 * (irregolare)`. It is the raw tag the source puts on the auxiliary and the
 * non-finite rows, verbatim and never translated.
 */
function conjugationClass(reading: Reading): string[] {
  const texts = reading.forms
    .filter((form) => {
      const slot = slotOf(form);
      return slot.kind === "auxiliary" || slot.kind === "non-finite";
    })
    .flatMap((form) => sourceTagsOf(form).rawTags);
  return [...new Set(texts)];
}

/** The header bar of a verb lemma: its non-finite facts, each a source spelling. */
function verbFacts(reading: Reading): HeadlineFact[] {
  const rows = nonFiniteRows(reading);
  const spellingsFor = (role: NonFiniteRole) => rows.find((row) => row.role === role)?.spellings ?? [];
  const facts: HeadlineFact[] = [
    { label: "infinitive", value: <Spelled spelling={headwordOf(reading)} />, form: true },
  ];
  const gerund = spellingsFor("gerundio");
  if (gerund.length > 0) facts.push({ label: "gerund", value: <Spellings spellings={gerund} />, form: true });
  const participle = spellingsFor("participio passato");
  if (participle.length > 0) facts.push({ label: "participle", value: <Spellings spellings={participle} />, form: true });
  const auxiliary = auxiliaries(reading).map(spellingOf);
  if (auxiliary.length > 0) facts.push({ label: "auxiliary", value: <Spellings spellings={auxiliary} />, form: true });
  const verbClass = conjugationClass(reading);
  if (verbClass.length > 0) facts.push({ label: "conjugation", value: <It>{verbClass.join("; ")}</It> });
  return facts;
}

/** What a verb lemma card does not state of its non-finite facts, once. */
function verbSilence(reading: Reading): string | undefined {
  if (reading.forms.length === 0) return undefined;
  const rows = nonFiniteRows(reading);
  const missing = [
    ...(rows.some((row) => row.role === "gerundio") ? [] : ["gerund"]),
    ...(rows.some((row) => row.role === "participio passato") ? [] : ["past participle"]),
    ...(auxiliaries(reading).length > 0 ? [] : ["auxiliary"]),
  ];
  return missing.length === 0 ? undefined : `The source states no ${orPhrase(missing)} for this entry.`;
}

/**
 * The whole conjugation: sixteen boxes for a verb the source tabulates in
 * full — fourteen tenses, the imperative, the non-finite forms — and one box
 * for whatever `it-moods/v1` could not place, never guessed into another.
 */
function Conjugation({ table }: { table: VerbTable }) {
  // The table outlines the form the query hit. A lemma's own headword is the
  // page's title already, so its infinito row is not outlined as well.
  const searched: SearchedSpellings = { ...table.searched, headword: false };
  const byBox = new Map<string, SourceForm[]>();
  const imperative: SourceForm[] = [];
  const unplaced: SourceForm[] = [];
  let derived = false;
  for (const form of table.forms) {
    const slot = slotOf(form);
    if (slot.kind === "tense") {
      byBox.set(slot.box, [...(byBox.get(slot.box) ?? []), form]);
      derived ||= slot.derivedMood;
    } else if (slot.kind === "imperative") imperative.push(form);
    else if (slot.kind === "unplaced") unplaced.push(form);
  }
  if (byBox.size === 0 && imperative.length === 0) return null;

  const id = (key: string) => `conjugation-${table.recordId}-${key.replace(/\s+/g, "-")}`;
  const tenseGroup = (name: string, forms: readonly SourceForm[]): FormGroup => ({
    id: id(name),
    heading: name,
    tense: true,
    lines: rowsOf(forms).map((row) => ({ key: row.label, label: <It>{row.label}</It>, spellings: row.forms.map(spellingOf) })),
  });
  const auxiliary = auxiliaries(table);
  const groups: FormGroup[] = [
    ...TENSE_BOXES.flatMap((name) => {
      const forms = byBox.get(name);
      return forms === undefined ? [] : [tenseGroup(name, forms)];
    }),
    ...(imperative.length > 0 ? [tenseGroup("imperativo", imperative)] : []),
    {
      id: id("modi indefiniti"),
      heading: "modi indefiniti",
      tense: true,
      lines: [
        ...nonFiniteRows(table).map((row) => ({ key: row.role, label: <It>{row.role}</It>, spellings: row.spellings })),
        ...(auxiliary.length > 0
          ? [{ key: "ausiliare", label: <It>ausiliare</It>, spellings: auxiliary.map(spellingOf) }]
          : []),
      ],
    },
    ...(unplaced.length > 0
      ? [
          {
            id: id("unplaced"),
            heading: `Not placed in a tense by ${IT_MOODS_RULE}`,
            tense: false,
            lines: rowsOf(unplaced).map((row) => ({
              key: row.label,
              label: <It>{row.label === "" ? unplacedLabel(row.forms[0]) : row.label}</It>,
              spellings: row.forms.map(spellingOf),
            })),
          },
        ]
      : []),
  ];

  return (
    <Section
      id={`conjugation-${table.recordId}`}
      name="Conjugation"
      count={`${table.forms.length} forms`}
      note={
        derived ? (
          <>
            Lexema places forms in the congiuntivo and condizionale boxes by rule <code>{IT_MOODS_RULE}</code>. A
            form the source tags with a tense and no person is congiuntivo when its pronoun begins <It>che</It>,
            and condizionale when its tense is present or past and its pronoun is bare, as in <It>io</It>. The
            source tags no mood on these forms.
          </>
        ) : undefined
      }
    >
      <FormGroups groups={groups} searched={searched} />
    </Section>
  );
}

// The lemma panel ---------------------------------------------------------------

/**
 * Where a form reading points: its lemma, one line on what lives on its own
 * page, and a link to that page. This is the whole of the reading's
 * `lemmaLinks`, one panel per link. A lemma the query also matched through its
 * table — `sala` and `salire` for `sale` — is not a record of the result: it is
 * this link, and its table's row is what the header bar and, on a page of one
 * verb form, the conjugation read. When the source leaves open which of
 * several same-spelled records it means, the panel names them all.
 */
function LemmaPanels({ reading }: { reading: Reading }) {
  if (reading.lemmaLinks.length === 0) return null;
  return (
    <Section id={`lemma-${reading.recordId}`} name="Lemma">
      <div className="flex flex-col gap-3">
        {reading.lemmaLinks.map((link, i) => (
          <div
            key={i}
            className={LEMMA_PANEL}
            data-lemma-panel=""
            data-lemma-records={
              link.kind === "candidates" ? link.candidates.map((candidate) => candidate.recordId).join(" ") : undefined
            }
          >
            <span className={LEMMA_ARROW} aria-hidden="true">
              ↳
            </span>
            <div className={LEMMA_BODY}>
              <p className={LEMMA_WORD} lang="it">
                {link.targetWord}
              </p>
              {link.kind === "dangling" ? (
                <p className={LEMMA_LINE}>The source names this word, but this release has no entry for it.</p>
              ) : (
                <>
                  <p className={LEMMA_LINE}>
                    Its meanings, synonyms and etymology live on its own page. Nothing is repeated here.
                  </p>
                  {link.candidates.length > 1 && (
                    <p className={LEMMA_LINE}>
                      {link.candidates.length} entries share this spelling:{" "}
                      {link.candidates.map((candidate, j) => (
                        <span key={candidate.recordId}>
                          {j > 0 && ", "}
                          <It>{candidate.word}</It> ({posLabel(candidate.pos)})
                        </span>
                      ))}
                      . The source does not say which.
                    </p>
                  )}
                </>
              )}
            </div>
            {link.kind === "candidates" && (
              <a className={LEMMA_OPEN} href={`/?q=${encodeURIComponent(link.targetWord)}`}>
                Open entry →
              </a>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

/**
 * A form reading's header bar: its lemma, then where the lemma's own table
 * places it — person, number and the box `it-moods/v1` files it in — or, for a
 * noun or adjective form, the gender and number its own record states.
 */
function formFacts(card: Card): HeadlineFact[] {
  const { reading, lemmaRow } = card;
  const lemma: HeadlineFact = {
    label: "lemma",
    value: <It>{lemmaWords(reading).join(", ")}</It>,
    form: true,
  };
  if (!isVerbReading(reading)) {
    return [lemma, ...agreementFacts(reading, []).facts];
  }
  if (lemmaRow === undefined) return [lemma];
  const { form } = lemmaRow;
  const facts: HeadlineFact[] = [lemma];
  const person = statedValues(form.claims, "person").map((value) => value.replace(/-person$/, ""));
  if (person.length > 0) facts.push({ label: "person", value: person.join(", ") });
  const number = statedValues(form.claims, "number");
  if (number.length > 0) facts.push({ label: "number", value: number.join(", ") });
  const slot = slotOf(form);
  if (slot.kind === "tense") facts.push({ label: "tense", value: <It>{slot.box}</It>, form: true });
  else if (slot.kind === "imperative") facts.push({ label: "mood", value: <It>imperativo</It>, form: true });
  else if (slot.kind === "non-finite") facts.push({ label: "form", value: <It>{slot.role}</It>, form: true });
  return facts;
}

// The card ----------------------------------------------------------------------

/** The forms section: its boxes in one wrapping row, or nothing when it has none. */
function FormsSection({ reading, groups }: { reading: Reading; groups: readonly FormGroup[] }) {
  if (groups.length === 0) return null;
  const listsForms = reading.forms.length > 0;
  return (
    <Section
      id={`forms-${reading.recordId}`}
      name={listsForms ? "Forms" : "Articles"}
      count={listsForms ? `${reading.forms.length}` : undefined}
    >
      <FormGroups groups={groups} searched={searchedSpellings(reading)} />
    </Section>
  );
}

/**
 * The boxes of a noun or adjective card. A form the bar or a box places is
 * placed once; whatever neither placed goes in the last box, verbatim.
 */
function NominalForms({ reading, placedOnBar }: { reading: Reading; placedOnBar: ReadonlySet<number> }) {
  const cells = agreementCells(reading);
  const boxed = spansGenders(cells);
  const degrees = reading.forms.filter(hasDegree);
  const placed = boxed
    ? new Set(cells.flatMap((cell) => cell.spellings.flatMap((spelling) => (spelling.kind === "form" ? [spelling.index] : []))))
    : placedOnBar;
  const other = reading.forms.filter((form) => !placed.has(form.index) && !hasDegree(form));

  const groups: FormGroup[] = [];
  if (boxed) groups.push(agreementGroup(`agreement-${reading.recordId}`, cells));
  // A form reading's articles are its lemma's business: frame 01 draws the
  // plural of `sala` with its definition and its lemma panel, and nothing else.
  if (isNounReading(reading) && reading.lemmaLinks.length === 0 && reading.articles.status === "derived") {
    groups.push(articlesGroup(`articles-${reading.recordId}`, reading.articles.articles));
  }
  if (degrees.length > 0) groups.push(degreeGroup(`degrees-${reading.recordId}`, degrees));
  if (other.length > 0) groups.push(otherGroup(`other-${reading.recordId}`, other));
  return <FormsSection reading={reading} groups={groups} />;
}

/** Every other part of speech: whatever forms it lists, in the one last box. */
function GenericForms({ reading }: { reading: Reading }) {
  if (reading.forms.length === 0) return null;
  return <FormsSection reading={reading} groups={[otherGroup(`other-${reading.recordId}`, reading.forms)]} />;
}

/**
 * One reading's card.
 *
 * The title row names it — the number the reading index uses, the headword,
 * the kind of reading and, for a form, the word it is a form of. The header bar
 * carries its headline facts, the silence line what it does not state, and the
 * sections what the source wrote. A form reading ends in its lemma panel.
 */
export function ReadingCard({ card, query, numbered }: { card: Card; query: string; numbered: boolean }) {
  const { reading } = card;
  const isForm = reading.lemmaLinks.length > 0;
  const kind = readingKind(reading);
  const nominal = isNounReading(reading) || isAdjectiveReading(reading);
  const verb = isVerbReading(reading);
  const inlineTable = card.inlineParadigm === undefined ? undefined : lemmaTableOf(card.inlineParadigm);

  const agreement = agreementFacts(reading, nominal && !isForm ? agreementCells(reading) : []);
  const facts: HeadlineFact[] = [
    ...(isForm ? formFacts(card) : verb ? verbFacts(reading) : agreement.facts),
    ...otherRecordFacts(reading.grammar.record, ["gender", "number"]),
  ];

  const silence = [
    nominal && !isForm ? agreementSilence(reading) : undefined,
    isNounReading(reading) && !isForm && reading.articles.status === "withheld"
      ? articleWithheldSentence(reading.articles.withholding)
      : undefined,
    verb && !isForm ? verbSilence(reading) : undefined,
    reading.senses.length === 0 ? "The source carries no sense for this entry." : undefined,
  ].filter((sentence): sentence is string => sentence !== undefined);

  return (
    <article
      className={CARD}
      id={`reading-${reading.recordId}`}
      aria-label={`${reading.word}, ${kind}`}
      data-record={reading.recordId}
      data-line={reading.ref.lineNo}
    >
      <header className={CARD_TITLE}>
        {numbered && (
          <span className={CARD_NUMBER} aria-label={`Reading ${card.number}`}>
            {card.number}
          </span>
        )}
        <h2 className={HEADWORD}>
          <Spelled spelling={headwordOf(reading)} />
        </h2>
        <span className={POS_PILL}>{kind}</span>
        {isForm && (
          <span className={FORM_OF}>
            of <It>{listPhrase(lemmaWords(reading))}</It>
          </span>
        )}
      </header>
      <HeadlineBar facts={facts} />
      <div className={CARD_BODY}>
        {/* A record that merely lists the query in its table is not a claim
            about the query, and saying so stops a reader inferring a lemma
            nobody stated. Said plainly, in the muted text of every note. */}
        {!reading.isAboutQuery && (
          <p className={MENTION}>
            This entry does not define <q lang="it">{query}</q>; it lists the form in its own table.
          </p>
        )}
        {silence.length > 0 && <p className={SILENCE}>{silence.join(" ")}</p>}
        <Disputes reviews={reading.reviews} />
        <EntryNotes reading={reading} />
        <Definitions reading={reading} />
        <Examples reading={reading} />
        {nominal && <NominalForms reading={reading} placedOnBar={agreement.placed} />}
        {verb && reading.forms.length > 0 && <Conjugation table={tableOf(reading)} />}
        {inlineTable !== undefined && <Conjugation table={inlineTable} />}
        {!nominal && !verb && <GenericForms reading={card.reading} />}
        <LemmaPanels reading={reading} />
      </div>
    </article>
  );
}
