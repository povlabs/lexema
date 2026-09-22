// How one reading renders. The whole job here is to show what the source says
// and to be visibly silent where it says nothing — but said once, where a
// reader meets it, rather than once per section.
//
// Three rules run through every section below, and all three come from
// design-system-manifest.md § "The result card": the interface is English and
// the source's own Italian is never translated, so every Italian string carries
// `lang="it"` inside a document that is `lang="en"`; every candidate the lookup
// returned is rendered, never ranked down to one; and facts are laid out rather
// than listed — a header bar for the headline facts, boxed groups side by side
// for the agreement sets, a section with nothing in it omitted and named once
// in the card's own silence line.

import type { ReactNode } from "react";
import {
  isAdjectiveReading,
  isNounReading,
  isVerbReading,
  searchedSpellings,
} from "@lexema/lookup/types.ts";
import {
  AMBIGUOUS,
  BOX,
  BOX_CELL,
  BOX_HEADING,
  BOX_ROW,
  BOX_NOTE,
  BOX_ROW_LABEL,
  BOX_TABLE,
  CARD,
  CLAIM_LABEL,
  CLAIM_STATED,
  CLAIM_VALUE,
  CLAIM_WITHOUT_VALUE,
  CONJUGATION_GROUP,
  CONJUGATION_TENSE,
  DEFINITION,
  DEFINITIONS,
  DISPUTED,
  DISPUTED_LINE,
  DISPUTED_LIST,
  EMPTY,
  FORM_ITEM,
  FORM_LIST,
  FORM_SOURCE,
  GLOSS,
  GRAMMAR,
  HEADLINE,
  HEADLINE_FACT,
  HEADLINE_LABEL,
  HEADLINE_VALUE,
  HEADWORD,
  LABELS,
  LINK,
  LINKS,
  LINKS_LIST,
  MENTION,
  MOOD_GROUP,
  MOOD_HEADING,
  MUTED,
  SEARCHED,
  SOURCE_LINE,
  SECTION_COUNT,
  MORE_DETAILS,
  MORE_SUMMARY,
  ENTRY_NOTE,
} from "./styles.ts";
import type {
  ArticleWithholding,
  GrammarClaim,
  NounReading,
  Reading,
  ReadingArticles,
  Review,
  SearchedSpellings,
  Sense,
  SourceForm,
} from "@lexema/lookup/types.ts";

/**
 * Where one reading can be checked by hand.
 *
 * The release is a Wiktextract dump of the Italian Wiktionary, so every record
 * came from a page there under its own headword. The source stores no URL, so
 * this one is built from the headword. The link is labelled *Source* and
 * nothing more — [ADR 0009](../../.decisions/0009-two-licences-and-a-source-link.md)
 * keeps the credit itself off this page and on `/attribution`, which the site
 * footer reaches. Its accessible name still names the word and the part of
 * speech, because "Source" repeated once per reading tells a screen reader
 * nothing about which reading it belongs to. The archive line number and JSON
 * pointers stay next to it: they are what pin the reading to an exact byte of
 * the release, and the link is what a reader can actually click.
 */
const WIKTIONARY_PAGE = "https://it.wiktionary.org/wiki/";

function sourcePageUrl(word: string): string {
  return WIKTIONARY_PAGE + encodeURIComponent(word.replace(/ /g, "_"));
}

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

const posLabel = (pos: string): string => POS_LABEL[pos] ?? pos;

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

/** True when the source was asked for this dimension here and said nothing. */
function isMissing(claims: readonly GrammarClaim[], dimension: string): boolean {
  return claims.some((claim) => claim.status === "missing" && claim.dimension === dimension);
}

/**
 * One word as the source wrote it, with nothing to split on.
 *
 * `grandissimo\n massimo` is a single `forms[]` entry the source wrote as two
 * lines, and `più grande` is one it wrote as two words. Neither is two forms, and
 * this page is not the place that decides it is: the test is the whole of what
 * "a single word" means here, and anything failing it is shown verbatim.
 */
function isOneWord(surface: string): boolean {
  return !/\s/u.test(surface);
}

/** An Italian word, in a page whose language is English. */
function It({ children }: { children: string }) {
  return <span lang="it">{children}</span>;
}

/**
 * One spelling of the entry itself: its headword, or one `forms[]` entry of it.
 *
 * Every box renders one of these rather than a bare string, so the page says
 * which source row each spelling came from — `data-headword` for the headword,
 * `data-form="3"` for the record's fourth `forms[]` entry. That is what turns
 * "every form is on this card exactly once" into something a test counts
 * instead of a spelling it pattern-matches, and a spelling that is neither —
 * an article Lexema derived, a word another record points with — carries no
 * mark and is not one of the entry's own forms.
 */
type Spelling =
  | { kind: "headword"; surface: string }
  | { kind: "form"; index: number; surface: string; from: string | null; pointer: string };

const headwordOf = (reading: Reading): Spelling => ({ kind: "headword", surface: reading.word });

const spellingOf = (form: SourceForm): Spelling => ({
  kind: "form",
  index: form.index,
  surface: form.surface,
  from: form.formSource,
  pointer: form.ref.jsonPointer,
});

/**
 * The spellings this card's query actually hit, as `searchedSpellings`
 * (`src/lookup/types.ts`) read them off the reading's own evidence.
 *
 * It travels to every box instead of the query string, because a box marks a
 * form by pointer and the headword by the evidence's own kind, never by
 * comparing spellings (#49).
 */
type Searched = SearchedSpellings;

/**
 * The page the source says this form was taken from, where it names one.
 *
 * It travels with the spelling rather than with the box, because it is a fact
 * about the form and the box that places the form is now the only place it
 * renders — `parlerei` is read off a conjugation appendix, and dropping that
 * would lose the one thing saying where it came from.
 */
function SpellingSource({ spelling }: { spelling: Spelling }) {
  if (spelling.kind === "headword" || spelling.from === null) return null;
  return (
    <span className={FORM_SOURCE}>
      {" "}
      from <It>{spelling.from}</It>
    </span>
  );
}

/** A key that tells one rendered spelling from another inside one box. */
const spellingKey = (spelling: Spelling): string =>
  spelling.kind === "headword" ? "headword" : `form-${spelling.index}`;

/** An Italian spelling of this entry, marked with the source row it came from. */
function Spelled({ spelling }: { spelling: Spelling }) {
  if (spelling.kind === "headword") {
    return (
      <span lang="it" data-headword="">
        {spelling.surface}
      </span>
    );
  }
  return (
    <span lang="it" data-form={spelling.index}>
      {spelling.surface}
    </span>
  );
}

/**
 * The `forms[]` entries a set of rendered spellings placed, by index.
 *
 * A box hands back what it put on the page, and the card subtracts it from the
 * record's forms — so the unplaced box below holds exactly what no box placed,
 * and no form is rendered by two boxes at once.
 */
function placedForms(spellings: readonly Spelling[]): number[] {
  return spellings.flatMap((spelling) => (spelling.kind === "form" ? [spelling.index] : []));
}

/** A claim the box that placed a form already states by filing it where it did. */
function filedUnder(...pairs: readonly (readonly [string, string | undefined])[]) {
  return (claim: GrammarClaim): boolean =>
    claim.status === "stated" &&
    pairs.some(([dimension, value]) => dimension === claim.dimension && value === claim.value);
}

/**
 * What the box that placed a form has not already said about it.
 *
 * A placed form's spelling renders in one box and nowhere else, so the claims
 * that box states itself — the row or cell it filed the form under — are not
 * repeated beside the spelling, and everything else the source said about that
 * form still is. Dropping the rest would trade one duplication for a missing
 * source fact.
 */
function claimsBeyond(
  claims: readonly GrammarClaim[],
  said: (claim: GrammarClaim) => boolean,
): GrammarClaim[] {
  return claims.filter((claim) => !said(claim));
}

// The headline bar --------------------------------------------------------
//
// "Under the headword: part of speech, then the few facts the source states for
// it, on one line, labelled in small text with the value in large"
// (design-system-manifest.md § "The result card"). A fact the source did not
// state is not a row here: the card's silence line says that once, near the
// top, instead of saying it beside every dimension it could have filled.

/**
 * One headline fact: a small English label, and the value under it.
 *
 * The value is a node rather than a string because a verb's headline facts are
 * source spellings (#48) — each marked `lang="it"` and with the `forms[]` entry
 * it came from, so the bar is one of the places the counting test looks. A noun's
 * and an adjective's are plain stated values, and a string is still one of these.
 */
interface HeadlineFact {
  label: string;
  value: ReactNode;
}

function HeadlineBar({ facts }: { facts: HeadlineFact[] }) {
  return (
    <dl className={HEADLINE}>
      {facts.map((fact) => (
        <div key={fact.label} className={HEADLINE_FACT}>
          <dt className={HEADLINE_LABEL}>{fact.label}</dt>
          <dd className={HEADLINE_VALUE}>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The dimensions the header bar carries, and the silence line accounts for. */
const HEADLINE_DIMENSIONS = ["gender", "number"] as const;

/**
 * The headline facts for a record, from the dimensions the source stated.
 *
 * Every stated value counts, not the first: `grande` is tagged masculine *and*
 * feminine, and a bar showing one of them would be reading past the source.
 */
function statedFacts(claims: readonly GrammarClaim[]): HeadlineFact[] {
  const facts: HeadlineFact[] = [];
  for (const dimension of HEADLINE_DIMENSIONS) {
    const values = statedValues(claims, dimension);
    if (values.length > 0) facts.push({ label: dimension, value: values.join(", ") });
  }
  return facts;
}

// Saying the silence once -------------------------------------------------
//
// "A section with nothing to show is omitted. One line near the top of the card
// names what the source does not state for this entry" — the rule this whole
// file used to break five times on one `casa` card (#60).

/**
 * Everything one card has nothing to show for, in two kinds.
 *
 * `source` is what the source itself does not say, and `withheld` is what
 * Lexema will not derive from what it does say. Keeping them apart is what
 * stops the page blaming the source for a line Lexema drew itself.
 */
interface Silence {
  source: string[];
  withheld: string[];
}

const NO_SILENCE: Silence = { source: [], withheld: [] };

/** `a`, `a and b`, `a, b and c` — an English list inside one sentence. */
function listPhrase(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** The same list under a negation, where *and* would read as the wrong claim. */
function orPhrase(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} or ${parts[parts.length - 1]}`;
}

/**
 * The one line that names this card's silence, or nothing at all.
 *
 * One paragraph, near the top, above the senses: a reader meets what this entry
 * does not have once, and every section it would have filled is simply not
 * there.
 */
function silenceSentences(silence: Silence): string {
  const sentences: string[] = [];
  if (silence.source.length > 0) {
    sentences.push(`The source ${listPhrase(silence.source)} for this entry.`);
  }
  for (const clause of silence.withheld) sentences.push(`Lexema ${clause}.`);
  return sentences.join(" ");
}

function CardSilence({ silence }: { silence: Silence }) {
  const said = silenceSentences(silence);
  if (said === "") return null;
  return <p className={EMPTY}>{said}</p>;
}

/**
 * The dimensions of `HEADLINE_DIMENSIONS` this record does not state, as one
 * clause — or nothing, when it states them all.
 */
function unstatedClause(claims: readonly GrammarClaim[]): string[] {
  const unstated = HEADLINE_DIMENSIONS.filter(
    (dimension) => stated(claims, dimension) === undefined,
  );
  if (unstated.length === 0) return [];
  if (unstated.length === HEADLINE_DIMENSIONS.length) {
    return [`states neither a ${unstated[0]} nor a ${unstated[1]}`];
  }
  return [`states no ${unstated[0]}`];
}

// Boxed groups ------------------------------------------------------------
//
// "Each agreement set is one box with a heading; boxes sit in a row that wraps
// on narrow screens. Rows inside a box are `label value`, the label small and
// grey, the value in the reading language."

/**
 * One boxed group: its own heading, and label-and-value rows under it.
 *
 * The heading is the card's own third level by default. A verb's tense boxes
 * sit inside a mood group that carries an `<h3>` of its own, so they take the
 * fourth — the outline a reader tabs through says mood, then tense, rather
 * than two headings at one level with no relation between them.
 */
function Box({
  id,
  heading,
  level = 3,
  children,
}: {
  id: string;
  heading: string;
  level?: 3 | 4;
  children: ReactNode;
}) {
  const Heading = level === 3 ? "h3" : "h4";
  return (
    <section className={BOX} aria-labelledby={id}>
      <Heading className={BOX_HEADING} id={id}>
        {heading}
      </Heading>
      {children}
    </section>
  );
}

/** The one row a card's boxes sit in, side by side, wrapping when narrow. */
function BoxRow({ children }: { children: ReactNode }) {
  return <div className={BOX_ROW}>{children}</div>;
}

/** The rows of one box: each a small English label and a value beside it. */
function BoxRows({ children }: { children: ReactNode }) {
  return (
    <table className={BOX_TABLE}>
      <tbody>{children}</tbody>
    </table>
  );
}

function BoxLine({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <tr>
      <th className={BOX_ROW_LABEL} scope="row">
        {label}
      </th>
      <td className={BOX_CELL}>{children}</td>
    </tr>
  );
}

/**
 * Whether this spelling is the one the query hit, in whichever shape it sits.
 *
 * A form is one pointer against a set of pointers, both read from the same
 * source row: the form's own `ref.jsonPointer` and the `embedded-form`
 * evidence the lookup recorded. A headword has no pointer into `forms[]`, so
 * it is the `headword` evidence itself. Nothing here compares surfaces, so a
 * spelling the index never matched is never outlined (#49), and a record whose
 * headword is the query — `grande` in its own masculine-singular cell — keeps
 * the mark the manifest asks for wherever a box places it.
 */
function isSearchedSpelling(spelling: Spelling, searched: Searched): boolean {
  return spelling.kind === "headword"
    ? searched.headword
    : searched.formPointers.has(spelling.pointer);
}

/**
 * One source spelling inside a box, outlined where it sits when it is the form
 * that was searched for.
 *
 * "A query that is itself a form is marked inside the paradigm it belongs to,
 * by a border, not by colour alone" — so the border is drawn by `.searched` and
 * the same fact is said in words beside it, for a reader who sees neither.
 */
function BoxSurface({ spelling, searched }: { spelling: Spelling; searched: Searched }) {
  if (!isSearchedSpelling(spelling, searched)) return <Spelled spelling={spelling} />;
  return (
    <span className={SEARCHED}>
      <Spelled spelling={spelling} />
      <span className={MUTED}> · your search</span>
    </span>
  );
}

function Grammar({ claims, label }: { claims: GrammarClaim[]; label: string }) {
  if (claims.length === 0) return null;

  return (
    <dl className={GRAMMAR} aria-label={label}>
      {claims.map((claim, i) => {
        if (claim.status === "stated") {
          return (
            <div key={i} className={CLAIM_STATED}>
              <dt className={CLAIM_LABEL}>{claim.dimension}</dt>
              <dd className={CLAIM_VALUE}>{claim.value}</dd>
            </div>
          );
        }
        // The source was asked and said nothing. Different from never asking.
        if (claim.status === "missing") {
          return (
            <div key={i} className={CLAIM_WITHOUT_VALUE}>
              <dt className={CLAIM_LABEL}>{claim.dimension}</dt>
              <dd className={CLAIM_VALUE}>not stated in the source</dd>
            </div>
          );
        }
        // Text we will not guess at. Shown verbatim so a reader can judge it.
        return (
          <div key={i} className={CLAIM_WITHOUT_VALUE}>
            <dt className={CLAIM_LABEL}>unclassified</dt>
            <dd className={CLAIM_VALUE}>
              <q lang="it">{claim.sourceText}</q>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/**
 * A claim review, shown as a warning attached to the claim it is about.
 *
 * A disputed claim is never quietly dropped and never quietly corrected: the
 * source keeps saying what it said, and the page says that the evidence
 * disagrees. This is the state the `studente` verb claim is in.
 */
function Disputes({ reviews }: { reviews: Review[] }) {
  const disputed = reviews.filter((review) => review.status === "disputed");
  if (disputed.length === 0) return null;
  return (
    <div className={DISPUTED} role="note">
      <p className={DISPUTED_LINE}>
        <strong>Disputed by later research.</strong> This entry is shown as the source wrote it;
        the evidence below disagrees with it.
      </p>
      <ul className={DISPUTED_LIST}>
        {disputed.map((review, i) => (
          <li key={i}>
            {review.note}{" "}
            <a className={LINK} href={review.evidenceUrl} rel="noreferrer">
              evidence
            </a>{" "}
            · reviewed {review.reviewedAt} by {review.reviewedBy} · claim{" "}
            <code>{review.ref.jsonPointer}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Said next to a surface the source did not write as one word.
 *
 * The note is the marking, and it is the only thing this page does about such a
 * string: `docs/LEXEMA_SPEC.md` "Italian adjective enrichment" says to preserve
 * a compound or incomplete source string rather than split or complete it.
 */
function Unsplit() {
  return <span className={AMBIGUOUS}> · source text, not split into separate forms</span>;
}

/** One `forms[]` entry: the Italian spelling, and what the source said about it. */
function FormEntry({
  form,
  searched,
  markUnsplit,
}: {
  form: SourceForm;
  searched: Searched;
  markUnsplit: boolean;
}) {
  return (
    <li className={FORM_ITEM}>
      <BoxSurface spelling={spellingOf(form)} searched={searched} />
      {markUnsplit && !isOneWord(form.surface) && <Unsplit />}
      <Grammar claims={form.claims} label={`grammar for ${form.surface}`} />
      <SpellingSource spelling={spellingOf(form)} />
    </li>
  );
}

/**
 * The forms of this record no table placed, in source order.
 *
 * "Forms the source leaves unplaced go in one last box named for what is
 * missing, never scattered", and "a fact is never rendered twice on one card"
 * (design-system-manifest.md § "The result card"). So this box holds what the
 * singular-and-plural table, the gender-and-number paradigm, the degrees and
 * the conjugations did not take, and nothing else — a form one of those placed
 * is on the card already, and listing it here again is the duplication this
 * box used to carry by design.
 *
 * It is named for what it holds: the whole table when no box placed anything,
 * the rest when one did. An entry whose forms are all placed renders no box at
 * all, and neither does one that lists no forms — the card's silence line says
 * that once, which is the whole of #60.
 *
 * A listed form is not a claim that this record is the base word —
 * `studentessa` lists `studenti` — so the heading says whose table it is.
 */
function UnplacedForms({
  reading,
  forms,
  searched,
  markUnsplit = false,
}: {
  reading: Reading;
  forms: readonly SourceForm[];
  searched: Searched;
  markUnsplit?: boolean;
}) {
  if (forms.length === 0) return null;
  const heading =
    forms.length === reading.forms.length
      ? "Forms listed by this entry"
      : "Other forms listed by this entry";
  return (
    <Box id={`forms-${reading.recordId}`} heading={heading}>
      <ul className={FORM_LIST}>
        {forms.map((form) => (
          <FormEntry key={form.index} form={form} searched={searched} markUnsplit={markUnsplit} />
        ))}
      </ul>
    </Box>
  );
}

/** The record's forms that no box on this card placed, in source order. */
function unplacedForms(reading: Reading, placed: ReadonlySet<number>): SourceForm[] {
  return reading.forms.filter((form) => !placed.has(form.index));
}

// A noun is read for three things the generic card answers badly: what it
// agrees with, how it goes singular and plural, and which article stands in
// front of it. The first is in the header bar; the other two are boxes, and a
// box with nothing in it is not rendered — an empty table would read as "no
// plural", which is a claim the source did not make, and a sentence in its
// place is the wall of apologies #60 is about.

/** One spelling the source files under a number, with the gender it gave it. */
interface NumberedSurface {
  spelling: Spelling;
  gender: string | undefined;
  /** What the row has not already said about this spelling. */
  rest: GrammarClaim[];
}

/** One row of the singular-and-plural box: a number, and what is filed under it. */
interface NumberRow {
  number: string;
  surfaces: NumberedSurface[];
}

/**
 * The record's spellings, grouped by the number the source stated for each.
 *
 * The headword goes under the record's own number, and every forms row under
 * its own — which is the only grouping the source supports. A row the source
 * gave no number is not guessed into one; it stays in the forms box, where it
 * is listed without a claim about it.
 */
function numberedSurfaces(reading: Reading, number: "singular" | "plural"): NumberedSurface[] {
  const surfaces: NumberedSurface[] = [];
  const filed = (claims: readonly GrammarClaim[], spelling: Spelling): NumberedSurface => {
    const gender = stated(claims, "gender");
    return {
      spelling,
      gender,
      // A form's other claims render here, because this row is the only place
      // that form now sits. The headword's do not: the card renders the
      // record's own claims once, above the boxes.
      rest:
        spelling.kind === "headword"
          ? []
          : claimsBeyond(claims, filedUnder(["number", number], ["gender", gender])),
    };
  };
  if (stated(reading.grammar.record, "number") === number) {
    surfaces.push(filed(reading.grammar.record, headwordOf(reading)));
  }
  for (const form of reading.forms) {
    if (stated(form.claims, "number") !== number) continue;
    surfaces.push(filed(form.claims, spellingOf(form)));
  }
  return surfaces;
}

/** One row's value: every spelling filed under that number, verbatim. */
function NumberCell({ surfaces, searched }: { surfaces: NumberedSurface[]; searched: Searched }) {
  return (
    <>
      {surfaces.map((entry, i) => (
        <span key={spellingKey(entry.spelling)}>
          {i > 0 && ", "}
          {/* Exactly as the source spelled it: `studente/studentessa` is one
              string the source wrote, not two words to split apart. */}
          <BoxSurface spelling={entry.spelling} searched={searched} />
          {entry.gender !== undefined && <span className={MUTED}> {entry.gender}</span>}
          <Grammar claims={entry.rest} label={`grammar for ${entry.spelling.surface}`} />
          <SpellingSource spelling={entry.spelling} />
        </span>
      ))}
    </>
  );
}

const NOUN_NUMBERS = ["singular", "plural"] as const;

/** Every number this record files a spelling under, with what it filed there. */
function nounNumberRows(reading: Reading): NumberRow[] {
  return NOUN_NUMBERS.map((number) => ({
    number: number as string,
    surfaces: numberedSurfaces(reading, number),
  })).filter((row) => row.surfaces.length > 0);
}

/**
 * The singular-and-plural box: one row per number the source actually filed a
 * spelling under, and no box at all when it filed none.
 *
 * The rows are built by the card, which subtracts what they placed from the
 * forms left over — so the box and the unplaced box cannot disagree about
 * which forms this table is showing.
 */
function NounNumbers({
  rows,
  recordId,
  searched,
}: {
  rows: NumberRow[];
  recordId: number;
  searched: Searched;
}) {
  if (rows.length === 0) return null;
  return (
    <Box id={`numbers-${recordId}`} heading="Singular and plural">
      <BoxRows>
        {rows.map((row) => (
          <BoxLine key={row.number} label={row.number}>
            <NumberCell surfaces={row.surfaces} searched={searched} />
          </BoxLine>
        ))}
      </BoxRows>
    </Box>
  );
}

/**
 * Why Lexema derives no article — for the card's silence line, and only when
 * the header bar has not already said it.
 *
 * Three of the six reasons are "the source states no gender or no number",
 * which the silence line's own first clause states: repeating it here would be
 * the duplication #60 is about.
 */
function articleWithheldClause(withholding: ArticleWithholding): string[] {
  switch (withholding.reason) {
    case "no-gender-or-number-stated":
    case "gender-not-stated":
    case "number-not-stated":
      return [];
    case "gender-is-not-masculine-or-feminine":
      return [
        `derives no article: the source gives the gender as ${withholding.statedGender}, which is neither masculine nor feminine`,
      ];
    case "number-is-not-singular-or-plural":
      return [
        `derives no article: the source gives the number as ${withholding.statedNumber}, which is neither singular nor plural`,
      ];
    case "surface-not-handled":
      return [
        "derives no article: rule it-articles/v1 derives one for a single word, and this entry's headword is not one",
      ];
  }
}

/**
 * The articles box, and where the articles came from.
 *
 * These are the one thing on this page the source did not say: `it-articles/v1`
 * derives them from the gender and number the source *did* state, so the box
 * says that under its rows rather than in a column repeated once per row. A
 * withheld set renders no box: the card's silence line carries the reason.
 */
function NounArticles({ articles, recordId }: { articles: ReadingArticles; recordId: number }) {
  if (articles.status !== "derived") return null;
  return (
    <Box id={`articles-${recordId}`} heading="Articles">
      <BoxRows>
        {articles.articles.map((article) => (
          <BoxLine key={article.kind} label={article.kind}>
            <It>{article.article}</It>{" "}
            <span className={MUTED}>
              <It>{article.displayForm}</It>
            </span>
          </BoxLine>
        ))}
      </BoxRows>
      <p className={BOX_NOTE}>
        Not from the source: Lexema derives these from the {articles.articles[0].gender}{" "}
        {articles.articles[0].number} the source states, by rule <code>it-articles/v1</code>.
      </p>
    </Box>
  );
}

// An adjective is read as a paradigm: masculine and feminine, singular and
// plural, in one glance. This source supports that for some adjectives and not
// for others, and that difference is what this card is for — a box when four
// source-backed words fill it, and one clause in the card's silence line when
// it does not. Nothing below splits, trims or completes a source string, per
// docs/LEXEMA_SPEC.md "Italian adjective enrichment".

const ADJECTIVE_GENDERS = ["masculine", "feminine"] as const;
const ADJECTIVE_NUMBERS = ["singular", "plural"] as const;

type AdjectiveGender = (typeof ADJECTIVE_GENDERS)[number];
type AdjectiveNumber = (typeof ADJECTIVE_NUMBERS)[number];

/** One cell of the paradigm, named by the two dimensions that locate it. */
interface Cell {
  gender: AdjectiveGender;
  number: AdjectiveNumber;
}

const CELLS: readonly Cell[] = ADJECTIVE_GENDERS.flatMap((gender) =>
  ADJECTIVE_NUMBERS.map((number) => ({ gender, number })),
);

const cellKey = (cell: Cell): string => `${cell.gender}/${cell.number}`;
const cellName = (cell: Cell): string => `${cell.gender} ${cell.number}`;

/**
 * Every cell the source filed one spelling under.
 *
 * A spelling lands in a cell only when the source stated both dimensions for
 * it, and it lands in every cell those statements cover: `fine` is tagged
 * masculine, feminine and singular, so the source really does file it under two
 * cells. A spelling the source gave one dimension or neither lands nowhere —
 * guessing the other half is the completion the spec forbids.
 *
 * A degree the source states keeps a spelling out of the table altogether,
 * unless that degree is `positive`. `grande` lists `grandissimo` tagged
 * absolute, superlative, masculine and singular: it is a masculine singular of
 * something, and calling it the masculine singular of `grande` would be reading
 * past the tag the source put there. It belongs in the degrees below.
 */
function placements(claims: readonly GrammarClaim[]): Cell[] {
  const degrees = statedValues(claims, "degree");
  if (degrees.some((degree) => degree !== "positive")) return [];

  const genders = statedValues(claims, "gender");
  const numbers = statedValues(claims, "number");
  return CELLS.filter((cell) => genders.includes(cell.gender) && numbers.includes(cell.number));
}

/**
 * The spellings this entry files under each cell: its own headword from the
 * record's tags, and each `forms[]` entry from its own.
 */
function paradigmCandidates(reading: Reading): Map<string, ParadigmCandidate[]> {
  const byCell = new Map<string, ParadigmCandidate[]>(CELLS.map((cell) => [cellKey(cell), []]));

  const file = (claims: readonly GrammarClaim[], spelling: Spelling): void => {
    const candidate: ParadigmCandidate = {
      spelling,
      // The table is what files a spelling by gender and number, and it takes
      // only positive degrees, so those three are what it says itself. The
      // headword carries nothing here: the card renders the record's own
      // claims once, above the boxes.
      rest:
        spelling.kind === "headword"
          ? []
          : claimsBeyond(
              claims,
              (claim) =>
                claim.status === "stated" &&
                (claim.dimension === "gender" ||
                  claim.dimension === "number" ||
                  (claim.dimension === "degree" && claim.value === "positive")),
            ),
    };
    for (const cell of placements(claims)) {
      const candidates = byCell.get(cellKey(cell));
      if (
        candidates !== undefined &&
        !candidates.some((other) => other.spelling.surface === spelling.surface)
      ) {
        candidates.push(candidate);
      }
    }
  };

  file(reading.grammar.record, headwordOf(reading));
  for (const form of reading.forms) file(form.claims, spellingOf(form));
  return byCell;
}

/** One spelling a cell could take, and what the table would not say about it. */
interface ParadigmCandidate {
  spelling: Spelling;
  rest: GrammarClaim[];
}

/** Why a cell could not be filled by one source-backed word. */
type ParadigmWithholding =
  | { reason: "cell-empty"; cell: Cell }
  | { reason: "cell-ambiguous"; cell: Cell; count: number }
  | { reason: "cell-not-one-word"; cell: Cell };

/** Exactly four words, or the first cell that stopped the table. */
type AdjectiveParadigm =
  | {
      status: "complete";
      masculineSingular: ParadigmCandidate;
      masculinePlural: ParadigmCandidate;
      feminineSingular: ParadigmCandidate;
      femininePlural: ParadigmCandidate;
    }
  | { status: "withheld"; withholding: ParadigmWithholding };

type CellFill =
  | { filled: true; candidate: ParadigmCandidate }
  | { filled: false; withholding: ParadigmWithholding };

/** One cell: filled by a single source-backed word, or the reason it is not. */
function fillCell(byCell: Map<string, ParadigmCandidate[]>, cell: Cell): CellFill {
  const candidates = byCell.get(cellKey(cell)) ?? [];
  if (candidates.length === 0) return { filled: false, withholding: { reason: "cell-empty", cell } };
  if (candidates.length > 1) {
    return {
      filled: false,
      withholding: { reason: "cell-ambiguous", cell, count: candidates.length },
    };
  }
  const candidate = candidates[0];
  if (!isOneWord(candidate.spelling.surface)) {
    return { filled: false, withholding: { reason: "cell-not-one-word", cell } };
  }
  return { filled: true, candidate };
}

/**
 * The four-cell paradigm, or the first reason there is not one.
 *
 * `complete` carries four strings rather than a lookup that might miss one, so
 * a half-filled table is not a value this function can return. The cells are
 * read in a fixed order, so the reason a reader is given is always the same
 * one.
 */
function adjectiveParadigm(reading: Reading): AdjectiveParadigm {
  const byCell = paradigmCandidates(reading);

  const masculineSingular = fillCell(byCell, { gender: "masculine", number: "singular" });
  if (!masculineSingular.filled) {
    return { status: "withheld", withholding: masculineSingular.withholding };
  }
  const masculinePlural = fillCell(byCell, { gender: "masculine", number: "plural" });
  if (!masculinePlural.filled) {
    return { status: "withheld", withholding: masculinePlural.withholding };
  }
  const feminineSingular = fillCell(byCell, { gender: "feminine", number: "singular" });
  if (!feminineSingular.filled) {
    return { status: "withheld", withholding: feminineSingular.withholding };
  }
  const femininePlural = fillCell(byCell, { gender: "feminine", number: "plural" });
  if (!femininePlural.filled) {
    return { status: "withheld", withholding: femininePlural.withholding };
  }

  return {
    status: "complete",
    masculineSingular: masculineSingular.candidate,
    masculinePlural: masculinePlural.candidate,
    feminineSingular: feminineSingular.candidate,
    femininePlural: femininePlural.candidate,
  };
}

/**
 * The four cells in reading order, each with the spelling that fills it.
 *
 * One spelling can fill two cells: `grande` is tagged masculine *and*
 * feminine, so the source really does file it under both singulars. That is
 * one fact shown at the two coordinates the source gave it — what a grid is
 * for — and not the same fact rendered in two places, which is what the box
 * below is about.
 */
function paradigmCells(
  paradigm: AdjectiveParadigm & { status: "complete" },
): [string, ParadigmCandidate][] {
  return [
    ["masculine singular", paradigm.masculineSingular],
    ["masculine plural", paradigm.masculinePlural],
    ["feminine singular", paradigm.feminineSingular],
    ["feminine plural", paradigm.femininePlural],
  ];
}

/**
 * Why there is no paradigm box, as one clause of the card's silence line.
 *
 * No Italian spelling appears in it: these run inside English prose, and every
 * Italian string on this page sits in its own `lang="it"`. The spellings are in
 * the forms box, where they are marked as Italian and shown in full.
 */
function paradigmWithheldClause(withholding: ParadigmWithholding): string {
  const cell = cellName(withholding.cell);
  switch (withholding.reason) {
    case "cell-empty":
      return `shows no gender-and-number table: this entry files nothing under ${cell}, neither its own headword nor any form it lists`;
    case "cell-ambiguous":
      return `shows no gender-and-number table: this entry files ${withholding.count} different spellings under ${cell}, and the source does not say which one belongs in the cell`;
    case "cell-not-one-word":
      return `shows no gender-and-number table: the only ${cell} this entry files is source text rather than a single word, and this page does not split one`;
  }
}

/** The four cells as label-and-value rows, when the source fills all four. */
function AdjectiveParadigmBox({
  paradigm,
  recordId,
  searched,
}: {
  paradigm: AdjectiveParadigm;
  recordId: number;
  searched: Searched;
}) {
  if (paradigm.status === "withheld") return null;

  return (
    <Box id={`paradigm-${recordId}`} heading="Gender and number">
      <BoxRows>
        {paradigmCells(paradigm).map(([label, cell]) => (
          <BoxLine key={label} label={label}>
            <BoxSurface spelling={cell.spelling} searched={searched} />
            <Grammar claims={cell.rest} label={`grammar for ${cell.spelling.surface}`} />
            <SpellingSource spelling={cell.spelling} />
          </BoxLine>
        ))}
      </BoxRows>
    </Box>
  );
}

/** The two degrees this box shows, in the order it shows them. */
const ADJECTIVE_DEGREES = ["comparative", "superlative"] as const;

/**
 * Comparative and superlative, from the source's own tags and nothing else.
 *
 * A row exists because a `forms[]` entry carries a stated `degree` claim for
 * it. `grandissimo` looks like a superlative to anyone who reads Italian, and
 * that is exactly the inference this page does not make: with no tag there is
 * no row, whatever the spelling suggests. `grande`'s own comparatives are the
 * other half of that — the release states their degree only in the prose of a
 * `raw_tag`, so they get no row either, and an entry with no tagged degree at
 * all gets no box.
 *
 * Every stated degree counts, not the first one: the release tags
 * `grandissimo` `absolute` *and* `superlative`, and reading one claim per form
 * would have dropped the whole row.
 */
function degreeRows(reading: Reading): { degree: string; forms: SourceForm[] }[] {
  return ADJECTIVE_DEGREES.map((degree) => ({
    degree: degree as string,
    forms: reading.forms.filter((form) => statedValues(form.claims, "degree").includes(degree)),
  })).filter((row) => row.forms.length > 0);
}

function AdjectiveDegrees({
  rows,
  recordId,
  searched,
}: {
  rows: { degree: string; forms: SourceForm[] }[];
  recordId: number;
  searched: Searched;
}) {
  if (rows.length === 0) return null;

  return (
    <Box id={`degrees-${recordId}`} heading="Comparative and superlative">
      <BoxRows>
        {rows.map((row) => (
          <BoxLine key={row.degree} label={row.degree}>
            {row.forms.map((form, i) => (
              <span key={form.index}>
                {i > 0 && ", "}
                {/* Verbatim, newlines and all: one `forms[]` entry the source
                    wrote, never two forms to pull apart. */}
                <BoxSurface spelling={spellingOf(form)} searched={searched} />
                {!isOneWord(form.surface) && <Unsplit />}
                {/* The row says which degree; the gender and number the source
                    also tagged are said here, where the form sits, because
                    this is now the only place it sits. */}
                <Grammar
                  claims={claimsBeyond(form.claims, filedUnder(["degree", row.degree]))}
                  label={`grammar for ${form.surface}`}
                />
                <SpellingSource spelling={spellingOf(form)} />
              </span>
            ))}
          </BoxLine>
        ))}
      </BoxRows>
    </Box>
  );
}

/**
 * The record's forms grouped the way a conjugation table groups them.
 *
 * Grouping is by the tense the source stated, and by nothing else: no mood in
 * this release is stated structurally, so a group says so rather than filling
 * the gap in. An entry naming the auxiliary verb is not an inflected form and
 * is kept out of the tenses.
 *
 * A verb no longer arrives here — `VerbCard` lays its paradigm out as boxed
 * tables under the mood the source states (#48). What is left for this is a
 * part of speech with no card of its own that still tags a form with a tense.
 */
function tenseGroups(reading: Reading): Map<string, SourceForm[]> {
  const byTense = new Map<string, SourceForm[]>();
  for (const form of reading.forms) {
    const tense = stated(form.claims, "tense");
    if (tense === undefined || stated(form.claims, "form-role") === "auxiliary") continue;
    const group = byTense.get(tense);
    if (group) group.push(form);
    else byTense.set(tense, [form]);
  }
  return byTense;
}

/**
 * What the conjugation box shows: the tenses, and the auxiliary the entry
 * names beside them.
 *
 * Built once by the card, which subtracts what it placed from the forms left
 * over. The auxiliary is placed only when there is a box to place it in, so an
 * entry naming one and tagging no tense keeps it in the unplaced box.
 */
interface ConjugationTable {
  byTense: Map<string, SourceForm[]>;
  auxiliaries: SourceForm[];
}

function conjugationTable(reading: Reading): ConjugationTable {
  return {
    byTense: tenseGroups(reading),
    auxiliaries: reading.forms.filter((form) => stated(form.claims, "form-role") === "auxiliary"),
  };
}

/** The `forms[]` entries the conjugation box puts on the page, by index. */
function placedByConjugations(table: ConjugationTable): number[] {
  if (table.byTense.size === 0) return [];
  return [...[...table.byTense.values()].flat(), ...table.auxiliaries].map((form) => form.index);
}

function Conjugations({ table, recordId }: { table: ConjugationTable; recordId: number }) {
  const { byTense, auxiliaries } = table;
  if (byTense.size === 0) return null;

  return (
    <Box id={`conjugations-${recordId}`} heading="Grouped conjugations">
      {[...byTense].map(([tense, forms]) => (
        <div key={tense} className={CONJUGATION_GROUP}>
          <h4 className={CONJUGATION_TENSE}>{tense}</h4>
          <ul className={FORM_LIST}>
            {forms.map((form) => {
              const person = [stated(form.claims, "person"), stated(form.claims, "number")]
                .filter((part) => part !== undefined)
                .join(", ");
              return (
                <li key={form.index} className={FORM_ITEM}>
                  <Spelled spelling={spellingOf(form)} />{" "}
                  {person !== "" && <span className={MUTED}>{person}</span>}
                  {isMissing(form.claims, "mood") && (
                    <span className={AMBIGUOUS}> · mood not stated in the source</span>
                  )}
                  {/* This group is where the form now sits, so whatever the
                      group has not already said about it is said here. */}
                  <Grammar
                    claims={claimsBeyond(
                      form.claims,
                      (claim) =>
                        filedUnder(
                          ["tense", tense],
                          ["person", stated(form.claims, "person")],
                          ["number", stated(form.claims, "number")],
                        )(claim) ||
                        (claim.status === "missing" && claim.dimension === "mood"),
                    )}
                    label={`grammar for ${form.surface}`}
                  />
                  <SpellingSource spelling={spellingOf(form)} />
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {auxiliaries.length > 0 && (
        <p className={BOX_NOTE}>
          Auxiliary named by the source:{" "}
          {auxiliaries.map((form, i) => (
            <span key={form.index}>
              {i > 0 ? ", " : ""}
              <Spelled spelling={spellingOf(form)} />
              <Grammar
                claims={claimsBeyond(form.claims, filedUnder(["form-role", "auxiliary"]))}
                label={`grammar for ${form.surface}`}
              />
            </span>
          ))}
          . Not an inflected form of this word.
        </p>
      )}
    </Box>
  );
}

/** Every record a word could mean, listed rather than chosen between. */
function Candidates({ candidates }: { candidates: { recordId: number; word: string; pos: string }[] }) {
  return (
    <>
      {candidates.map((candidate, i) => (
        <span key={candidate.recordId}>
          {i > 0 && ", "}
          <It>{candidate.word}</It> ({posLabel(candidate.pos)})
        </span>
      ))}
    </>
  );
}

/**
 * Claims about the record that the header bar has not already shown.
 *
 * Gender and number are in the bar, so repeating them under it would say the
 * same thing twice; everything else the source stated about the record — an
 * unclassified tag such as `form-of` — still has to be visible.
 */
function otherRecordClaims(claims: GrammarClaim[]): GrammarClaim[] {
  return claims.filter((claim) => {
    if (claim.status === "unclassified") return true;
    if (claim.status === "missing") return false;
    return !HEADLINE_DIMENSIONS.some((dimension) => dimension === claim.dimension);
  });
}

/**
 * The grammar claims on one sense that its labels have not already shown.
 *
 * `sense.labels` and `grammar.bySense` are two readings of one source array:
 * `casa`'s `pl.: case` is `/senses/0/raw_tags/0` on both sides, and the card
 * used to render it twice. The label line is the one that keeps the source's
 * own words, so a claim read from a pointer a label already carries is not
 * shown again — matched on the pointer, so a claim from anywhere else still is.
 */
function otherSenseClaims(sense: Sense, claims: GrammarClaim[]): GrammarClaim[] {
  const shown = new Set(sense.labels.map((label) => label.ref.jsonPointer));
  return claims.filter((claim) => !shown.has(claim.ref.jsonPointer));
}

/** "2 of its senses", said the way the row around it reads. */
function senseCountClause(count: number): string {
  return `, in ${count} of its senses`;
}

/**
 * Everything a card shows whatever the word is.
 *
 * The parts around the middle are the same for every part of speech — who the
 * entry is about, the header bar under the headword, the one line naming what
 * this entry does not have, what later research disputes, what it means, what
 * points at it and where it can be checked — so they live here once. A card
 * supplies three things: the headline facts its part of speech has, the
 * silences only it can name, and the boxes that make it its own.
 *
 * The shell owns two of the silences itself, because they are facts about any
 * record: a record carrying no sense, and one listing no forms. A card adds its
 * own to them, and the whole set is said in one line near the top.
 */
function Definition({ sense, reading }: { sense: Sense; reading: Reading }) {
  return (
    <li className={DEFINITION}>
      {sense.glosses.length === 0 ? (
        <span className={EMPTY}>The source carries no definition for this sense.</span>
      ) : sense.glosses.map((gloss, i) => (
        <p key={i} lang="it" className={GLOSS}>{gloss.text}</p>
      ))}
      {sense.labels.length > 0 && (
        <p className={LABELS}>
          {sense.labels.map((label, i) => (
            <span key={i}>{i > 0 && " "}<It>{label.label}</It></span>
          ))}
        </p>
      )}
      <Grammar
        claims={otherSenseClaims(sense, reading.grammar.bySense.get(sense.index) ?? [])}
        label={`grammar for sense ${sense.index + 1}`}
      />
    </li>
  );
}

/** The first visible definition slice. The native disclosure keeps the rest in the document. */
const DEFINITION_SLICE = 1;

/** Two source glosses for casa are page furniture, not definitions (#28, #61). */
function isEntryFurniture(sense: Sense, word: string): boolean {
  return sense.glosses.length > 0 && sense.glosses.every(({ text }) =>
    text === `${word} ( citazioni)` || text.startsWith(`${word} ( approfondimento)`),
  );
}

function ReadingShell({
  reading,
  query,
  facts = [],
  silence = NO_SILENCE,
  children,
  context,
}: {
  reading: Reading;
  query: string;
  facts?: HeadlineFact[];
  silence?: Silence;
  children: ReactNode;
  context?: ReactNode;
}) {
  const pos = posLabel(reading.pos);
  const definitions = reading.senses.filter((sense) => !isEntryFurniture(sense, reading.word));
  const furniture = reading.senses.filter((sense) => isEntryFurniture(sense, reading.word));
  const whole: Silence = {
    source: [
      ...silence.source,
      ...(reading.senses.length === 0 ? ["carries no sense"] : []),
      ...(reading.forms.length === 0 && !context ? ["lists no forms"] : []),
    ],
    withheld: silence.withheld,
  };

  return (
    <article className={CARD} aria-label={`${reading.word}, ${pos}`}>
      <header>
        <h2 className={HEADWORD}>
          <Spelled spelling={headwordOf(reading)} />
        </h2>
        <HeadlineBar facts={[...(context ? [] : [{ label: "part of speech", value: pos }]), ...facts]} />
        {/* The single most important honesty signal on this page. A record that
            merely lists the query in a table is not a claim about the query, and
            saying so prevents the reader inferring a lemma nobody stated. */}
        {!reading.isAboutQuery && (
          <p className={MENTION}>
            Does not define <q lang="it">{query}</q> — it lists the form in its own table.
          </p>
        )}
      </header>

      <Disputes reviews={reading.reviews} />

      <CardSilence silence={whole} />

      {/* Senses stay apart, with their own labels: the source wrote several
          meanings and merging them into one list would invent a single one. */}
      {furniture.length > 0 && (
        <aside className={ENTRY_NOTE}>
          <p>The source has entry notes but gives no definition for this reading.</p>
          {furniture.map((sense) => (
            <div key={sense.index}>
              {sense.glosses.map((gloss, i) => <p key={i} lang="it">{gloss.text}</p>)}
              {sense.labels.length > 0 && (
                <p className={LABELS}>
                  {sense.labels.map((label, i) => <span key={i}>{i > 0 && " "}<It>{label.label}</It></span>)}
                </p>
              )}
              <Grammar
                claims={otherSenseClaims(sense, reading.grammar.bySense.get(sense.index) ?? [])}
                label={`grammar for sense ${sense.index + 1}`}
              />
            </div>
          ))}
        </aside>
      )}
      {definitions.length > 0 && (
        <section aria-label="Definitions">
          <h3>Definitions</h3>
          {definitions.length > DEFINITION_SLICE && (
            <p className={SECTION_COUNT}>{definitions.length} · showing {DEFINITION_SLICE}</p>
          )}
          <ol className={DEFINITIONS}>
            {definitions.slice(0, DEFINITION_SLICE).map((sense) => <Definition key={sense.index} sense={sense} reading={reading} />)}
          </ol>
          {definitions.length > DEFINITION_SLICE && (
            <details className={MORE_DETAILS}>
              <summary className={MORE_SUMMARY}>Show all {definitions.length} definitions</summary>
              <ol className={DEFINITIONS} start={DEFINITION_SLICE + 1}>
                {definitions.slice(DEFINITION_SLICE).map((sense) => <Definition key={sense.index} sense={sense} reading={reading} />)}
              </ol>
            </details>
          )}
        </section>
      )}

      {children}
      {context}

      {reading.lemmaLinks.length > 0 && (
        <section className={LINKS} aria-labelledby={`form-of-${reading.recordId}`}>
          <h3 className={HEADLINE_LABEL} id={`form-of-${reading.recordId}`}>
            Go to the lemma
          </h3>
          <div className="mt-2 flex flex-col gap-2">
            {reading.lemmaLinks.map((link, i) => (
              <div key={i} className="min-w-0 rounded-[4px] border border-border-strong p-4">
                {link.kind === "dangling" ? <><It>{link.targetWord}</It> — named by the source, but no entry for it here</> : <>
                  <a className={LINK} href={`/?q=${encodeURIComponent(link.targetWord)}`} lang="it">{link.targetWord}</a>
                  {link.candidates.length > 1 && <p className={MUTED}>
                    {link.candidates.length} entries share this spelling: <Candidates candidates={link.candidates} />.
                    The source does not say which.</p>}
                  <p className={MUTED}>Meanings, examples, etymology, synonyms and the full conjugation live on the lemma page.</p>
                  <a className={LINK} href={`/?q=${encodeURIComponent(link.targetWord)}`}>Open entry →</a>
                </>}
              </div>
            ))}
          </div>
        </section>
      )}

      {reading.inflections.length > 0 && (
        <section className={LINKS} aria-labelledby={`inflections-${reading.recordId}`}>
          <h3 className={BOX_HEADING} id={`inflections-${reading.recordId}`}>
            Forms pointing here
          </h3>
          <ul className={LINKS_LIST}>
            {reading.inflections.map((inflection) => (
              <li key={inflection.recordId}>
                <a
                  className={LINK}
                  href={`/?q=${encodeURIComponent(inflection.word)}`}
                  lang="it"
                >
                  {inflection.word}
                </a>{" "}
                <span className={MUTED}>({posLabel(inflection.pos)})</span> — declares itself a form
                of <It>{inflection.targetWord}</It>
                {/* One row per record, not per edge: `casetta` says this on two
                    of its senses, and that is one record saying it twice. A
                    record that says it once says nothing about how often. */}
                {inflection.refs.length > 1 && senseCountClause(inflection.refs.length)}
                {/* The reverse direction is ambiguous in exactly the way the
                    forward one is: the edge names a word, and this reading is
                    only one of the records spelling it. */}
                {inflection.targetCandidates.length > 1 && (
                  <span className={AMBIGUOUS}>
                    {" "}
                    — {inflection.targetCandidates.length} entries share that spelling:{" "}
                    <Candidates candidates={inflection.targetCandidates} />. The source does not say
                    which of them this form belongs to.
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className={SOURCE_LINE}>
        <a
          className={LINK}
          href={sourcePageUrl(reading.word)}
          rel="noreferrer"
          aria-label={`Wiktionary page for ${reading.word}, the source of this ${pos} entry`}
        >
          Source
        </a>{" "}
        · release line {reading.ref.lineNo}
        {reading.evidence.map((e, i) => (
          <span key={i}>
            {" "}
            <code>{e.ref.jsonPointer}</code>
          </span>
        ))}
      </footer>
    </article>
  );
}

/**
 * A noun: what it agrees with in the header bar, then boxes for how it goes
 * singular and plural and for the articles `it-articles/v1` derives from the
 * first of those (#53).
 */
function NounCard({ reading, query }: { reading: NounReading; query: string }) {
  const searched = searchedSpellings(reading);
  const rows = nounNumberRows(reading);
  const placed = new Set(placedForms(rows.flatMap((row) => row.surfaces.map((s) => s.spelling))));
  const unplaced = unplacedForms(reading, placed);
  const boxed = rows.length > 0 || reading.articles.status === "derived" || unplaced.length > 0;

  return (
    <ReadingShell
      reading={reading}
      query={query}
      facts={statedFacts(reading.grammar.record)}
      silence={{
        source: unstatedClause(reading.grammar.record),
        withheld:
          reading.articles.status === "withheld"
            ? articleWithheldClause(reading.articles.withholding)
            : [],
      }}
    >
      <Grammar
        claims={otherRecordClaims(reading.grammar.record)}
        label={`other grammar for ${reading.word}`}
      />
      {boxed && (
        <BoxRow>
          <NounNumbers rows={rows} recordId={reading.recordId} searched={searched} />
          <NounArticles articles={reading.articles} recordId={reading.recordId} />
          <UnplacedForms reading={reading} forms={unplaced} searched={searched} />
        </BoxRow>
      )}
    </ReadingShell>
  );
}

/**
 * An adjective: the paradigm box first when the source fills it, then the
 * degrees the source tagged, then every form it listed (#52).
 *
 * Articles belong to a noun and conjugations to a verb, so neither box is here.
 * The unplaced box is last and holds what neither the paradigm nor the degrees
 * took — `grande`'s comparatives, which the source states only in prose.
 */
function AdjectiveCard({ reading, query }: { reading: Reading; query: string }) {
  const searched = searchedSpellings(reading);
  const paradigm = adjectiveParadigm(reading);
  const degrees = degreeRows(reading);
  const placed = new Set([
    ...(paradigm.status === "complete"
      ? placedForms(paradigmCells(paradigm).map(([, cell]) => cell.spelling))
      : []),
    ...degrees.flatMap((row) => row.forms.map((form) => form.index)),
  ]);
  const unplaced = unplacedForms(reading, placed);
  const boxed = paradigm.status === "complete" || degrees.length > 0 || unplaced.length > 0;

  return (
    <ReadingShell
      reading={reading}
      query={query}
      facts={statedFacts(reading.grammar.record)}
      silence={{
        source: [
          ...unstatedClause(reading.grammar.record),
          ...(degrees.length === 0 ? ["tags no comparative or superlative"] : []),
        ],
        withheld:
          paradigm.status === "withheld" ? [paradigmWithheldClause(paradigm.withholding)] : [],
      }}
    >
      <Grammar
        claims={otherRecordClaims(reading.grammar.record)}
        label={`other grammar for ${reading.word}`}
      />
      {boxed && (
        <BoxRow>
          <AdjectiveParadigmBox paradigm={paradigm} recordId={reading.recordId} searched={searched} />
          <AdjectiveDegrees rows={degrees} recordId={reading.recordId} searched={searched} />
          <UnplacedForms reading={reading} forms={unplaced} searched={searched} markUnsplit />
        </BoxRow>
      )}
    </ReadingShell>
  );
}

// A verb reads as a conjugation table rather than a tag list (#48): a header
// bar carrying the non-finite facts the source states, then the finite forms as
// boxed tables, grouped by the mood the source states and boxed by its tense.
//
// Nothing below reads a mood, a person or a tense off a spelling. The release
// states four moods structurally — `imperative`, `participle`, `gerund` and
// `infinitive` (src/import/grammarPolicy.ts) — and states `infinitive` on no
// entry at all, while `indicative`, `subjunctive` and `conditional` never
// appear as tags. So for almost every verb the whole indicative lands in the
// group named for the source's own silence, and that group is the main path
// here rather than an edge case: 5,638 of the release's 462,020 verb records
// carry a structural mood on any form at all. Reading `io` as a first person is
// #4's job, with tests; here it is a label, verbatim.

/** The moods this source can state, in the order `grammarPolicy.ts` lists them. */
const VERB_MOODS = ["imperative", "participle", "gerund", "infinitive"] as const;

/** The moods whose forms are not conjugated: the header bar's own facts. */
const NON_FINITE_MOODS = ["infinitive", "gerund", "participle"] as const;

/** The tenses this source can state, in the order `grammarPolicy.ts` lists them. */
const VERB_TENSES = [
  "present",
  "imperfect",
  "future",
  "past",
  "past-remote",
  "perfect",
  "pluperfect",
  "historic",
] as const;

/** What a group of entries is filed under, or `null` where the source says nothing. */
type GroupKey = string | null;

/**
 * Where one key sits in the source's own vocabulary.
 *
 * "Groups are ordered by the source's own vocabulary — moods, then tenses, in
 * the order the tag vocabulary lists them; forms the source leaves unplaced go
 * in one last box named for what is missing" (design-system-manifest.md § "The
 * result card"). A value outside the vocabulary sorts after every value inside
 * it, and the source's silence sorts last of all.
 */
function vocabularyOrder(vocabulary: readonly string[], key: GroupKey): number {
  if (key === null) return vocabulary.length + 1;
  const at = vocabulary.indexOf(key);
  return at === -1 ? vocabulary.length : at;
}

/**
 * Entries grouped by what the source states for one dimension, in that
 * dimension's vocabulary order, with the entries stating nothing for it last.
 *
 * The sort is stable over groups collected in source order, so two values the
 * vocabulary does not list keep the order the record gave them.
 */
function groupByStated(
  forms: readonly SourceForm[],
  dimension: string,
  vocabulary: readonly string[],
): { key: GroupKey; forms: SourceForm[] }[] {
  const groups = new Map<GroupKey, SourceForm[]>();
  for (const form of forms) {
    const key = stated(form.claims, dimension) ?? null;
    const group = groups.get(key);
    if (group) group.push(form);
    else groups.set(key, [form]);
  }
  return [...groups]
    .map(([key, grouped]) => ({ key, forms: grouped }))
    .sort((a, b) => vocabularyOrder(vocabulary, a.key) - vocabularyOrder(vocabulary, b.key));
}

/** An entry naming the auxiliary verb, which is not an inflected form at all. */
const isAuxiliary = (form: SourceForm): boolean =>
  stated(form.claims, "form-role") === "auxiliary";

/** An entry the header bar carries rather than a conjugation table. */
function isNonFinite(form: SourceForm): boolean {
  const mood = stated(form.claims, "mood");
  return isAuxiliary(form) || NON_FINITE_MOODS.some((candidate) => candidate === mood);
}

/** One non-finite fact: an English label, and the entries the source filed under it. */
interface NonFiniteFact {
  label: string;
  forms: SourceForm[];
  /** What the label already states about each entry under it. */
  filed: (claim: GrammarClaim) => boolean;
}

/**
 * The header bar's facts, each from a stated claim and nothing else.
 *
 * A participle is labelled by the tense the source gives it, so the bar reads
 * *present participle* and *past participle* — and *participle* alone where the
 * source states no tense for one. The labels are English, which is the whole of
 * what Lexema writes here; every value is the source's own spelling.
 *
 * The word *infinitive* appears only because an entry states that mood. No
 * entry in the release does, and the headword of a `Verbo` record is not a
 * claim that the source made one.
 */
function nonFiniteFacts(reading: Reading): NonFiniteFact[] {
  const facts: NonFiniteFact[] = [];
  const inflected = reading.forms.filter((form) => !isAuxiliary(form));

  for (const mood of NON_FINITE_MOODS) {
    const under = inflected.filter((form) => stated(form.claims, "mood") === mood);
    if (under.length === 0) continue;
    if (mood !== "participle") {
      facts.push({ label: mood, forms: under, filed: filedUnder(["mood", mood]) });
      continue;
    }
    for (const group of groupByStated(under, "tense", VERB_TENSES)) {
      facts.push({
        label: group.key === null ? "participle" : `${group.key} participle`,
        forms: group.forms,
        filed: filedUnder(["mood", mood], ["tense", group.key ?? undefined]),
      });
    }
  }

  const auxiliaries = reading.forms.filter(isAuxiliary);
  if (auxiliaries.length > 0) {
    facts.push({
      label: "auxiliary",
      forms: auxiliaries,
      filed: filedUnder(["form-role", "auxiliary"]),
    });
  }
  return facts;
}

/**
 * The non-finite facts a verb entry is owed and does not state, as one clause
 * of the card's silence line.
 *
 * *infinitive* is not one of them: no entry in the release states an infinitive
 * mood, so naming it missing would put the word on every verb card in the
 * release for a dimension the source never fills — and the card says the word
 * only where a claim states it.
 */
const EXPECTED_NON_FINITE = [
  "gerund",
  "present participle",
  "past participle",
  "auxiliary",
] as const;

function nonFiniteClause(facts: readonly NonFiniteFact[]): string[] {
  const shown = new Set(facts.map((fact) => fact.label));
  const missing = EXPECTED_NON_FINITE.filter((label) => !shown.has(label));
  return missing.length === 0 ? [] : [`states no ${orPhrase([...missing])}`];
}

/** One row of a tense box: a label, and every entry the source filed under it. */
interface VerbRow {
  /** The label's text, which keys the row: two entries under one label are one row. */
  label: string;
  /** Whether that text is the source's own Italian rather than a stated value. */
  italian: boolean;
  /** The person and number every entry here states, where they all state one. */
  person: string;
  forms: SourceForm[];
}

/**
 * The person and number the source states for one entry, as one phrase.
 *
 * Two stated claims read together, never a reading of the row's label: the
 * label may say `io` and this may say nothing at all, and those are two
 * different facts about the same entry.
 */
function personPhrase(form: SourceForm): string {
  return [stated(form.claims, "person"), stated(form.claims, "number")]
    .filter((part) => part !== undefined)
    .join(", ");
}

/**
 * A row's label: the source's own unclassified text where it gave one, else the
 * person and number it stated, else nothing.
 *
 * `io`, `tu`, `lui/lei`, `che io` are `raw_tags` the importer records verbatim
 * as unclassified (src/import/grammarPolicy.ts), and they stay that way here —
 * the label is that text, never a person claim read out of it.
 */
function rowLabelOf(form: SourceForm): { label: string; italian: boolean } {
  for (const claim of form.claims) {
    if (claim.status === "unclassified") return { label: claim.sourceText, italian: true };
  }
  return { label: personPhrase(form), italian: false };
}

/**
 * The rows of one box, in source order, each holding every entry filed under it.
 *
 * `andare` files `vado` and `vo` under one `io` in the present, and a row that
 * kept the first would drop a form the source listed. The person and number
 * ride the label only while every entry in the row states the same pair; where
 * they differ, the row cannot say it and each entry says it for itself.
 */
function verbRows(forms: readonly SourceForm[]): VerbRow[] {
  const rows: VerbRow[] = [];
  const byLabel = new Map<string, VerbRow>();
  for (const form of forms) {
    const { label, italian } = rowLabelOf(form);
    const existing = byLabel.get(label);
    if (existing === undefined) {
      const row: VerbRow = { label, italian, person: personPhrase(form), forms: [form] };
      byLabel.set(label, row);
      rows.push(row);
      continue;
    }
    existing.forms.push(form);
    if (existing.person !== personPhrase(form)) existing.person = "";
  }
  return rows;
}

/**
 * What the box and the row a form sits in already state about it.
 *
 * Everything else the source said about that entry renders beside it, because
 * this is now the only place the entry sits. The row's own `missing` mood claim
 * is one of those things the group states: its heading is that silence.
 */
function filedInTable(
  mood: GroupKey,
  tense: GroupKey,
  row: VerbRow,
): (claim: GrammarClaim) => boolean {
  return (claim) => {
    if (claim.status === "missing") return mood === null && claim.dimension === "mood";
    if (claim.status === "unclassified") return row.italian && claim.sourceText === row.label;
    if (claim.dimension === "mood") return claim.value === mood;
    if (claim.dimension === "tense") return claim.value === tense;
    return row.person !== "" && (claim.dimension === "person" || claim.dimension === "number");
  };
}

/** Every spelling one row holds, with what the row has not already said. */
function VerbForms({
  forms,
  filed,
  searched,
  markUnsplit = false,
  tableSource = false,
}: {
  forms: readonly SourceForm[];
  filed: (claim: GrammarClaim) => boolean;
  searched: Searched;
  markUnsplit?: boolean;
  tableSource?: boolean;
}) {
  return (
    <>
      {forms.map((form, i) => (
        <span key={form.index}>
          {i > 0 && ", "}
          <BoxSurface spelling={spellingOf(form)} searched={searched} />
          {markUnsplit && !isOneWord(form.surface) && <Unsplit />}
          {!tableSource && <Grammar
            claims={claimsBeyond(form.claims, filed)}
            label={`grammar for ${form.surface}`}
          />}
        </span>
      ))}
    </>
  );
}

/** A row's label cell: the source's own text, and the person it also stated. */
function VerbRowLabel({ row }: { row: VerbRow }) {
  return row.italian ? <It>{row.label}</It> : <>{row.label}</>;
}

/** Named tables are supported by the source's tense tags, not by inferred mood.
 * For a repeated tense signature, the first complete person/number cycle is
 * the named table; later cycles remain together in the one unplaceable box.
 * Alternate spellings in a row (vado / vo) stay in that row.
 */
const NAMED_TENSES: { label: string; tags: string[] }[] = [
  { label: "presente", tags: ["present"] },
  { label: "imperfetto", tags: ["imperfect"] },
  { label: "passato remoto", tags: ["past-remote"] },
  { label: "futuro semplice", tags: ["future"] },
  { label: "passato prossimo", tags: ["past", "perfect"] },
  { label: "trapassato prossimo", tags: ["past", "perfect", "pluperfect"] },
  { label: "trapassato remoto", tags: ["historic", "past-remote"] },
  { label: "futuro anteriore", tags: ["future", "perfect"] },
];

function tenseSignature(form: SourceForm): string {
  return statedValues(form.claims, "tense").sort().join("+");
}

function namedCycle(forms: SourceForm[]): SourceForm[] {
  const cycle: SourceForm[] = [];
  const seen = new Set<string>();
  for (const form of forms) {
    const person = personPhrase(form);
    if (!person || (seen.size === 6 && !seen.has(person))) break;
    if (seen.has(person) && seen.size > 1) break;
    seen.add(person);
    cycle.push(form);
    if (seen.size === 6) break;
  }
  // Preserve additional spellings of the last person only if they precede a
  // second cycle; the source's own ordering is the tie-breaker.
  if (seen.size !== 6) return [];
  for (const form of forms.slice(cycle.length)) {
    if (personPhrase(form) !== personPhrase(cycle[cycle.length - 1])) break;
    cycle.push(form);
  }
  return cycle;
}

function VerbParadigm({ reading, searched, includeNonFinite = false }: { reading: Reading; searched: Searched; includeNonFinite?: boolean }) {
  const finite = reading.forms.filter((form) => !isNonFinite(form));
  const used = new Set<number>();
  const boxes = NAMED_TENSES.map(({ label, tags }) => {
    const same = finite.filter((form) =>
      !stated(form.claims, "mood") && tenseSignature(form) === [...tags].sort().join("+"));
    const forms = namedCycle(same);
    forms.forEach((form) => used.add(form.index));
    return { label, forms };
  }).filter((box) => box.forms.length > 0);
  const imperative = finite.filter((form) => stated(form.claims, "mood") === "imperative");
  imperative.forEach((form) => used.add(form.index));
  const remainder = finite.filter((form) => !used.has(form.index));
  const sources = [...new Set(finite.map((form) => form.formSource).filter((source) => source))];

  function table(forms: SourceForm[], label: string, key: string) {
    const id = `tense-${reading.recordId}-${key}`;
    const containsSearch = forms.some((form) => searched.formPointers.has(form.ref.jsonPointer));
    return <section key={key} className={BOX} aria-labelledby={id}>
      <input type="checkbox" id={`${id}-toggle`} className="peer sr-only lg:hidden"
        defaultChecked={containsSearch} aria-labelledby={id} />
      <h3 className={`${BOX_HEADING} flex items-center justify-between gap-2 peer-focus-visible:outline-2 peer-focus-visible:outline-accent`} id={id}>
        <label htmlFor={`${id}-toggle`}
          className="cursor-pointer lg:cursor-default">{label}</label>
        <span className="font-sans text-xs not-italic text-text-muted lg:hidden">{forms.length} ↓</span>
      </h3>
      <div className="hidden peer-checked:block lg:block">
        <BoxRows>{verbRows(forms).map((row) =>
          <BoxLine key={row.label} label={<VerbRowLabel row={row} />}>
            <span className="font-mono"><VerbForms forms={row.forms}
              filed={filedInTable(label === "imperativo" ? "imperative" : null, null, row)}
              searched={searched} tableSource /></span>
          </BoxLine>)}</BoxRows>
      </div>
    </section>;
  }

  return <section aria-label="Conjugation">
    <h3 className={MOOD_HEADING}>Conjugation · {reading.forms.length} forms listed by the source</h3>
    <p className={SECTION_COUNT}>Grouped by stated tense; mood not given for the named tense boxes.</p>
    {sources.length > 0 && <p className={`${SECTION_COUNT} break-all`}>Forms from {sources.map((source, i) =>
      <span key={source}>{i > 0 && ", "}<It>{source!}</It></span>)}</p>}
    <BoxRow>
      {boxes.map(({ label, forms }) => table(forms, label, label))}
      {imperative.length > 0 && table(imperative, "imperativo", "imperative")}
      {includeNonFinite && nonFiniteFacts(reading).length > 0 && <Box id={`tense-${reading.recordId}-nonfinite`} heading="Non-finite forms">
        <BoxRows>{nonFiniteFacts(reading).map((fact) =>
          <BoxLine key={fact.label} label={fact.label}>
            <span className="font-mono"><VerbForms forms={fact.forms} filed={fact.filed}
              searched={searched} tableSource /></span>
          </BoxLine>)}</BoxRows>
      </Box>}
      {remainder.length > 0 && <div className="lg:col-span-3">
        <section className={BOX} aria-labelledby={`tense-${reading.recordId}-unplaced`}>
          <input type="checkbox" id={`tense-${reading.recordId}-unplaced-toggle`}
            className="peer sr-only lg:hidden" aria-labelledby={`tense-${reading.recordId}-unplaced`} />
          <h3 className={`${BOX_HEADING} flex items-center justify-between gap-2 peer-focus-visible:outline-2 peer-focus-visible:outline-accent`}
            id={`tense-${reading.recordId}-unplaced`}>
            <label htmlFor={`tense-${reading.recordId}-unplaced-toggle`}
              className="cursor-pointer lg:cursor-default">
              Mood not stated — forms not placeable in a named tense
            </label>
            <span className="font-sans text-xs not-italic text-text-muted lg:hidden">{remainder.length} ↓</span>
          </h3>
          <div className="hidden peer-checked:block lg:block">
            <p className={SECTION_COUNT}>The source gives a tense, but does not say which mood these forms belong to.</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Map.groupBy(remainder, tenseSignature)].map(([signature, forms]) =>
                <div key={signature}><h4 className={BOX_HEADING}>
                  {signature ? signature.split("+").join(", ") : "Tense not stated"} · {forms.length}</h4>
                  <BoxRows>{verbRows(forms).map((row) =>
                    <BoxLine key={row.label} label={<VerbRowLabel row={row} />}>
                      <span className="font-mono"><VerbForms forms={row.forms}
                        filed={filedInTable(null, null, row)} searched={searched} tableSource /></span>
                    </BoxLine>)}</BoxRows></div>)}
            </div>
          </div>
        </section>
      </div>}
    </BoxRow>
  </section>;
}

/** Render the form's own reading; a linked lemma contributes only paradigm context. */
function VerbCard({ reading, query, context }: { reading: Reading; query: string; context?: Reading }) {
  const searched = searchedSpellings(reading);
  const facts = nonFiniteFacts(reading);
  const matched = context?.forms.find((form) => context.evidence.some((evidence) =>
    evidence.origin === "embedded-form" && evidence.ref.jsonPointer === form.ref.jsonPointer));
  const formFacts: HeadlineFact[] = matched && context ? [
    { label: "lemma", value: <It>{context.word}</It> },
    ...["person", "number", "tense"].flatMap((dimension) => {
      const values = statedValues(matched.claims, dimension);
      if (values.length === 0) return [];
      const value = dimension === "person"
        ? values.map((person) => person.replace(/-person$/, "")).join(", ")
        : dimension === "tense" && values.join("+") === "imperfect"
          ? "imperfetto"
          : values.join(", ");
      return [{ label: dimension, value }];
    }),
  ] : [];
  const placed = new Set(reading.forms.map((form) => form.index));
  const unplaced = unplacedForms(reading, placed);
  return (
    <ReadingShell
      reading={reading}
      query={query}
      facts={[...formFacts, ...facts.map((fact) => ({
        label: fact.label,
        // `se intr. essere` is one auxiliary entry the source wrote as three
        // words, so it carries the marking that says this page does not split
        // a source string into separate forms.
        value: <VerbForms forms={fact.forms} filed={fact.filed} searched={searched} markUnsplit />,
      }))]}
      silence={{ source: reading.lemmaLinks.length > 0 ? [] : nonFiniteClause(facts), withheld: [] }}
      context={context && <VerbParadigm reading={context} searched={searchedSpellings(context)} includeNonFinite />}
    >
      <Grammar
        claims={otherRecordClaims(reading.grammar.record).filter((claim) =>
          !(context && claim.status === "unclassified" && claim.sourceText === "form-of"))}
        label={`other grammar for ${reading.word}`}
      />
      {reading.forms.some((form) => !isNonFinite(form)) && <VerbParadigm reading={reading} searched={searched} />}
      {unplaced.length > 0 && (
        <BoxRow>
          <UnplacedForms reading={reading} forms={unplaced} searched={searched} markUnsplit />
        </BoxRow>
      )}
    </ReadingShell>
  );
}

/**
 * Every other part of speech, in the shape the shell now gives every card.
 *
 * It carries no articles box: an article is a noun fact, and `it-articles/v1`
 * derives one for a noun only, so a verb card promising one and then explaining
 * its absence is exactly the wall of apologies #60 removes.
 */
function GenericCard({ reading, query }: { reading: Reading; query: string }) {
  const searched = searchedSpellings(reading);
  const table = conjugationTable(reading);
  const grouped = table.byTense.size > 0;
  const placed = new Set(placedByConjugations(table));
  const unplaced = unplacedForms(reading, placed);
  const boxed = grouped || unplaced.length > 0;

  return (
    <ReadingShell
      reading={reading}
      query={query}
      facts={statedFacts(reading.grammar.record)}
      silence={{
        // A record listing no forms already says so through the shell; only an
        // entry that lists forms and tags none of them with a tense adds this.
        source: reading.forms.length > 0 && !grouped ? ["tags no form with a tense"] : [],
        withheld: [],
      }}
    >
      <Grammar
        claims={otherRecordClaims(reading.grammar.record)}
        label={`other grammar for ${reading.word}`}
      />
      {boxed && (
        <BoxRow>
          <Conjugations table={table} recordId={reading.recordId} />
          <UnplacedForms reading={reading} forms={unplaced} searched={searched} />
        </BoxRow>
      )}
    </ReadingShell>
  );
}

/**
 * The card for one reading, chosen by its part of speech.
 *
 * This is the only place that choice is made. A part of speech with no card of
 * its own renders the generic one, unchanged — which is what made each card so
 * far an addition here rather than a rewrite of it.
 */
export function ReadingCard({ reading, query, context }: { reading: Reading; query: string; context?: Reading }) {
  if (isNounReading(reading)) return <NounCard reading={reading} query={query} />;
  if (isAdjectiveReading(reading)) return <AdjectiveCard reading={reading} query={query} />;
  if (isVerbReading(reading)) return <VerbCard reading={reading} query={query} context={context} />;
  return <GenericCard reading={reading} query={query} />;
}
