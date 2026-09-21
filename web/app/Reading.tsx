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
import { isAdjectiveReading, isNounReading } from "@lexema/lookup/types.ts";
import { normalizeItalianExact } from "@lexema/italian/normalize.ts";
import type {
  ArticleWithholding,
  GrammarClaim,
  NounReading,
  Reading,
  ReadingArticles,
  Review,
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

// The headline bar --------------------------------------------------------
//
// "Under the headword: part of speech, then the few facts the source states for
// it, on one line, labelled in small text with the value in large"
// (design-system-manifest.md § "The result card"). A fact the source did not
// state is not a row here: the card's silence line says that once, near the
// top, instead of saying it beside every dimension it could have filled.

/** One headline fact: a small English label, and the value under it. */
interface HeadlineFact {
  label: string;
  value: string;
}

function HeadlineBar({ facts }: { facts: HeadlineFact[] }) {
  return (
    <dl className="headline">
      {facts.map((fact) => (
        <div key={fact.label}>
          <dt>{fact.label}</dt>
          <dd>{fact.value}</dd>
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
  return <p className="empty">{said}</p>;
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

/** One boxed group: its own heading, and label-and-value rows under it. */
function Box({ id, heading, children }: { id: string; heading: string; children: ReactNode }) {
  return (
    <section className="box" aria-labelledby={id}>
      <h3 id={id}>{heading}</h3>
      {children}
    </section>
  );
}

/** The one row a card's boxes sit in, side by side, wrapping when narrow. */
function BoxRow({ children }: { children: ReactNode }) {
  return <div className="box-row">{children}</div>;
}

/** The rows of one box: each a small English label and a value beside it. */
function BoxRows({ children }: { children: ReactNode }) {
  return (
    <table className="numbers">
      <tbody>{children}</tbody>
    </table>
  );
}

function BoxLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{children}</td>
    </tr>
  );
}

/**
 * Whether this spelling is the word that was searched for.
 *
 * Compared through the release's own normalizer, which is what matched the
 * query to this record in the first place — anything looser would outline a
 * spelling the index never hit.
 */
function isSearchedForm(surface: string, query: string): boolean {
  return normalizeItalianExact(surface) === normalizeItalianExact(query);
}

/**
 * One source spelling inside a box, outlined where it sits when it is the form
 * that was searched for.
 *
 * "A query that is itself a form is marked inside the paradigm it belongs to,
 * by a border, not by colour alone" — so the border is drawn by `.searched` and
 * the same fact is said in words beside it, for a reader who sees neither.
 */
function BoxSurface({ surface, query }: { surface: string; query: string }) {
  if (!isSearchedForm(surface, query)) return <It>{surface}</It>;
  return (
    <span className="searched">
      <It>{surface}</It>
      <span className="muted"> · the form you searched</span>
    </span>
  );
}

function Grammar({ claims, label }: { claims: GrammarClaim[]; label: string }) {
  if (claims.length === 0) return null;

  return (
    <dl className="grammar" aria-label={label}>
      {claims.map((claim, i) => {
        if (claim.status === "stated") {
          return (
            <div key={i} className="claim claim-stated">
              <dt>{claim.dimension}</dt>
              <dd>{claim.value}</dd>
            </div>
          );
        }
        // The source was asked and said nothing. Different from never asking.
        if (claim.status === "missing") {
          return (
            <div key={i} className="claim claim-missing">
              <dt>{claim.dimension}</dt>
              <dd>not stated in the source</dd>
            </div>
          );
        }
        // Text we will not guess at. Shown verbatim so a reader can judge it.
        return (
          <div key={i} className="claim claim-unclassified">
            <dt>unclassified</dt>
            <dd>
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
    <div className="disputed" role="note">
      <p>
        <strong>Disputed by later research.</strong> This entry is shown as the source wrote it;
        the evidence below disagrees with it.
      </p>
      <ul>
        {disputed.map((review, i) => (
          <li key={i}>
            {review.note}{" "}
            <a href={review.evidenceUrl} rel="noreferrer">
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
  return <span className="ambiguous"> · source text, not split into separate forms</span>;
}

/** One `forms[]` entry: the Italian spelling, and what the source said about it. */
function FormEntry({
  form,
  query,
  markUnsplit,
}: {
  form: SourceForm;
  query: string;
  markUnsplit: boolean;
}) {
  return (
    <li>
      <BoxSurface surface={form.surface} query={query} />
      {markUnsplit && !isOneWord(form.surface) && <Unsplit />}
      <Grammar claims={form.claims} label={`grammar for ${form.surface}`} />
      {form.formSource !== null && (
        <span className="form-source">
          from <It>{form.formSource}</It>
        </span>
      )}
    </li>
  );
}

/**
 * Every form this record lists, in source order — the box that catches what no
 * other box placed, and holds the rest a second time so nothing is dropped.
 *
 * A listed form is not a claim that this record is the base word —
 * `studentessa` lists `studenti` — so the section says whose table it is. An
 * entry that lists none renders nothing at all: the card's silence line says
 * so once, which is the whole of #60.
 */
function Forms({
  reading,
  query,
  markUnsplit = false,
}: {
  reading: Reading;
  query: string;
  markUnsplit?: boolean;
}) {
  if (reading.forms.length === 0) return null;
  return (
    <Box id={`forms-${reading.recordId}`} heading="Forms listed by this entry">
      <ul className="forms">
        {reading.forms.map((form) => (
          <FormEntry key={form.index} form={form} query={query} markUnsplit={markUnsplit} />
        ))}
      </ul>
    </Box>
  );
}

// A noun is read for three things the generic card answers badly: what it
// agrees with, how it goes singular and plural, and which article stands in
// front of it. The first is in the header bar; the other two are boxes, and a
// box with nothing in it is not rendered — an empty table would read as "no
// plural", which is a claim the source did not make, and a sentence in its
// place is the wall of apologies #60 is about.

/** One spelling the source files under a number, with the gender it gave it. */
interface NumberedSurface {
  key: string;
  surface: string;
  gender: string | undefined;
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
  if (stated(reading.grammar.record, "number") === number) {
    surfaces.push({
      key: "headword",
      surface: reading.word,
      gender: stated(reading.grammar.record, "gender"),
    });
  }
  for (const form of reading.forms) {
    if (stated(form.claims, "number") !== number) continue;
    surfaces.push({
      key: `form-${form.index}`,
      surface: form.surface,
      gender: stated(form.claims, "gender"),
    });
  }
  return surfaces;
}

/** One row's value: every spelling filed under that number, verbatim. */
function NumberCell({ surfaces, query }: { surfaces: NumberedSurface[]; query: string }) {
  return (
    <>
      {surfaces.map((entry, i) => (
        <span key={entry.key}>
          {i > 0 && ", "}
          {/* Exactly as the source spelled it: `studente/studentessa` is one
              string the source wrote, not two words to split apart. */}
          <BoxSurface surface={entry.surface} query={query} />
          {entry.gender !== undefined && <span className="muted"> {entry.gender}</span>}
        </span>
      ))}
    </>
  );
}

const NOUN_NUMBERS = ["singular", "plural"] as const;

/** Whether this record files any spelling under a number the source stated. */
function hasNumberedSurfaces(reading: Reading): boolean {
  return NOUN_NUMBERS.some((number) => numberedSurfaces(reading, number).length > 0);
}

/**
 * The singular-and-plural box: one row per number the source actually filed a
 * spelling under, and no box at all when it filed none.
 */
function NounNumbers({ reading, query }: { reading: NounReading; query: string }) {
  if (!hasNumberedSurfaces(reading)) return null;
  return (
    <Box id={`numbers-${reading.recordId}`} heading="Singular and plural">
      <BoxRows>
        {NOUN_NUMBERS.map((number) => {
          const surfaces = numberedSurfaces(reading, number);
          if (surfaces.length === 0) return null;
          return (
            <BoxLine key={number} label={number}>
              <NumberCell surfaces={surfaces} query={query} />
            </BoxLine>
          );
        })}
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
            <span className="muted">
              <It>{article.displayForm}</It>
            </span>
          </BoxLine>
        ))}
      </BoxRows>
      <p className="muted">
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
function paradigmCandidates(reading: Reading): Map<string, string[]> {
  const byCell = new Map<string, string[]>(CELLS.map((cell) => [cellKey(cell), []]));

  const file = (claims: readonly GrammarClaim[], surface: string): void => {
    for (const cell of placements(claims)) {
      const surfaces = byCell.get(cellKey(cell));
      if (surfaces !== undefined && !surfaces.includes(surface)) surfaces.push(surface);
    }
  };

  file(reading.grammar.record, reading.word);
  for (const form of reading.forms) file(form.claims, form.surface);
  return byCell;
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
      masculineSingular: string;
      masculinePlural: string;
      feminineSingular: string;
      femininePlural: string;
    }
  | { status: "withheld"; withholding: ParadigmWithholding };

type CellFill =
  | { filled: true; surface: string }
  | { filled: false; withholding: ParadigmWithholding };

/** One cell: filled by a single source-backed word, or the reason it is not. */
function fillCell(byCell: Map<string, string[]>, cell: Cell): CellFill {
  const surfaces = byCell.get(cellKey(cell)) ?? [];
  if (surfaces.length === 0) return { filled: false, withholding: { reason: "cell-empty", cell } };
  if (surfaces.length > 1) {
    return {
      filled: false,
      withholding: { reason: "cell-ambiguous", cell, count: surfaces.length },
    };
  }
  const surface = surfaces[0];
  if (!isOneWord(surface)) return { filled: false, withholding: { reason: "cell-not-one-word", cell } };
  return { filled: true, surface };
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
    masculineSingular: masculineSingular.surface,
    masculinePlural: masculinePlural.surface,
    feminineSingular: feminineSingular.surface,
    femininePlural: femininePlural.surface,
  };
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
function AdjectiveParadigmBox({ reading, query }: { reading: Reading; query: string }) {
  const paradigm = adjectiveParadigm(reading);
  if (paradigm.status === "withheld") return null;

  const rows: [string, string][] = [
    ["masculine singular", paradigm.masculineSingular],
    ["masculine plural", paradigm.masculinePlural],
    ["feminine singular", paradigm.feminineSingular],
    ["feminine plural", paradigm.femininePlural],
  ];

  return (
    <Box id={`paradigm-${reading.recordId}`} heading="Gender and number">
      <BoxRows>
        {rows.map(([label, surface]) => (
          <BoxLine key={label} label={label}>
            <BoxSurface surface={surface} query={query} />
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

function AdjectiveDegrees({ reading, query }: { reading: Reading; query: string }) {
  const rows = degreeRows(reading);
  if (rows.length === 0) return null;

  return (
    <Box id={`degrees-${reading.recordId}`} heading="Comparative and superlative">
      <BoxRows>
        {rows.map((row) => (
          <BoxLine key={row.degree} label={row.degree}>
            {row.forms.map((form, i) => (
              <span key={form.index}>
                {i > 0 && ", "}
                {/* Verbatim, newlines and all: one `forms[]` entry the source
                    wrote, never two forms to pull apart. */}
                <BoxSurface surface={form.surface} query={query} />
                {!isOneWord(form.surface) && <Unsplit />}
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
 * is kept out of the tenses. Laying these out as boxes per tense is #48's, not
 * this one's; what #60 changed here is only that an entry with no tense at all
 * renders no box.
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

function Conjugations({ reading }: { reading: Reading }) {
  const auxiliaries = reading.forms.filter((form) => stated(form.claims, "form-role") === "auxiliary");
  const byTense = tenseGroups(reading);
  if (byTense.size === 0) return null;

  return (
    <Box id={`conjugations-${reading.recordId}`} heading="Grouped conjugations">
      {[...byTense].map(([tense, forms]) => (
        <div key={tense} className="conjugation-group">
          <h4>{tense}</h4>
          <ul className="forms">
            {forms.map((form) => {
              const person = [stated(form.claims, "person"), stated(form.claims, "number")]
                .filter((part) => part !== undefined)
                .join(", ");
              return (
                <li key={form.index}>
                  <It>{form.surface}</It>{" "}
                  {person !== "" && <span className="muted">{person}</span>}
                  {isMissing(form.claims, "mood") && (
                    <span className="ambiguous"> · mood not stated in the source</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {auxiliaries.length > 0 && (
        <p className="muted">
          Auxiliary named by the source:{" "}
          {auxiliaries.map((form, i) => (
            <span key={form.index}>
              {i > 0 ? ", " : ""}
              <It>{form.surface}</It>
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
function ReadingShell({
  reading,
  query,
  facts = [],
  silence = NO_SILENCE,
  children,
}: {
  reading: Reading;
  query: string;
  facts?: HeadlineFact[];
  silence?: Silence;
  children: ReactNode;
}) {
  const pos = posLabel(reading.pos);
  const whole: Silence = {
    source: [
      ...silence.source,
      ...(reading.senses.length === 0 ? ["carries no sense"] : []),
      ...(reading.forms.length === 0 ? ["lists no forms"] : []),
    ],
    withheld: silence.withheld,
  };

  return (
    <article className="reading" aria-label={`${reading.word}, ${pos}`}>
      <header>
        <h2>
          <It>{reading.word}</It>
        </h2>
        <HeadlineBar facts={[{ label: "part of speech", value: pos }, ...facts]} />
        {/* The single most important honesty signal on this page. A record that
            merely lists the query in a table is not a claim about the query, and
            saying so prevents the reader inferring a lemma nobody stated. */}
        {!reading.isAboutQuery && (
          <p className="mention">
            Does not define <q lang="it">{query}</q> — it lists the form in its own table.
          </p>
        )}
      </header>

      <Disputes reviews={reading.reviews} />

      <CardSilence silence={whole} />

      {/* Senses stay apart, with their own labels: the source wrote several
          meanings and merging them into one list would invent a single one. */}
      {reading.senses.length > 0 && (
        <ol className="definitions">
          {reading.senses.map((sense) => (
            <li key={sense.index}>
              {sense.glosses.length === 0 ? (
                <span className="empty">
                  The source carries no definition for this sense.
                </span>
              ) : (
                sense.glosses.map((gloss, i) => (
                  <p key={i} lang="it" className="gloss">
                    {gloss.text}
                  </p>
                ))
              )}
              {sense.labels.length > 0 && (
                <p className="labels">
                  {sense.labels.map((label, i) => (
                    <span key={i} className="label">
                      {i > 0 && " "}
                      <It>{label.label}</It>
                    </span>
                  ))}
                </p>
              )}
              <Grammar
                claims={otherSenseClaims(sense, reading.grammar.bySense.get(sense.index) ?? [])}
                label={`grammar for sense ${sense.index + 1}`}
              />
            </li>
          ))}
        </ol>
      )}

      {children}

      {reading.lemmaLinks.length > 0 && (
        <section className="links" aria-labelledby={`form-of-${reading.recordId}`}>
          <h3 id={`form-of-${reading.recordId}`}>Form of</h3>
          <ul>
            {reading.lemmaLinks.map((link, i) => (
              <li key={i}>
                {link.kind === "dangling" ? (
                  <>
                    <It>{link.targetWord}</It>{" "}
                    <span className="empty">— named by the source, but no entry for it here</span>
                  </>
                ) : (
                  <>
                    <It>{link.targetWord}</It>
                    {/* More than one candidate means the source named a word,
                        not an entry. Showing all of them is the honest move;
                        picking one would invent a fact. */}
                    {link.candidates.length > 1 && (
                      <span className="ambiguous">
                        {" "}
                        — {link.candidates.length} entries share this spelling:{" "}
                        <Candidates candidates={link.candidates} />. The source does not say which.
                      </span>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {reading.inflections.length > 0 && (
        <section className="links" aria-labelledby={`inflections-${reading.recordId}`}>
          <h3 id={`inflections-${reading.recordId}`}>Forms pointing here</h3>
          <ul>
            {reading.inflections.map((inflection) => (
              <li key={inflection.recordId}>
                <a href={`/?q=${encodeURIComponent(inflection.word)}`} lang="it">
                  {inflection.word}
                </a>{" "}
                <span className="muted">({posLabel(inflection.pos)})</span> — declares itself a form
                of <It>{inflection.targetWord}</It>
                {/* One row per record, not per edge: `casetta` says this on two
                    of its senses, and that is one record saying it twice. A
                    record that says it once says nothing about how often. */}
                {inflection.refs.length > 1 && senseCountClause(inflection.refs.length)}
                {/* The reverse direction is ambiguous in exactly the way the
                    forward one is: the edge names a word, and this reading is
                    only one of the records spelling it. */}
                {inflection.targetCandidates.length > 1 && (
                  <span className="ambiguous">
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

      <footer className="source">
        <a
          href={sourcePageUrl(reading.word)}
          rel="noreferrer"
          aria-label={`Wiktionary page for ${reading.word}, the source of this ${pos} entry`}
        >
          Source
        </a>{" "}
        · release line {reading.ref.lineNo}
        {reading.evidence.map((e, i) => (
          <span key={i} className="pointer">
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
  const boxed =
    hasNumberedSurfaces(reading) || reading.articles.status === "derived" || reading.forms.length > 0;

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
          <NounNumbers reading={reading} query={query} />
          <NounArticles articles={reading.articles} recordId={reading.recordId} />
          <Forms reading={reading} query={query} />
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
 * The forms box stays, marked, because it is the one box carrying every entry
 * the lookup returned — including the ones no paradigm cell took.
 */
function AdjectiveCard({ reading, query }: { reading: Reading; query: string }) {
  const paradigm = adjectiveParadigm(reading);
  const boxed =
    paradigm.status === "complete" || degreeRows(reading).length > 0 || reading.forms.length > 0;

  return (
    <ReadingShell
      reading={reading}
      query={query}
      facts={statedFacts(reading.grammar.record)}
      silence={{
        source: [
          ...unstatedClause(reading.grammar.record),
          ...(degreeRows(reading).length === 0
            ? ["tags no comparative or superlative"]
            : []),
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
          <AdjectiveParadigmBox reading={reading} query={query} />
          <AdjectiveDegrees reading={reading} query={query} />
          <Forms reading={reading} query={query} markUnsplit />
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
  const grouped = tenseGroups(reading).size > 0;
  const boxed = grouped || reading.forms.length > 0;

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
          <Conjugations reading={reading} />
          <Forms reading={reading} query={query} />
        </BoxRow>
      )}
    </ReadingShell>
  );
}

/**
 * The card for one reading, chosen by its part of speech.
 *
 * This is the only place that choice is made. A part of speech with no card of
 * its own renders the generic one, unchanged — which is what makes adding the
 * next card (a verb's, #48) an addition here rather than a rewrite of it.
 */
export function ReadingCard({ reading, query }: { reading: Reading; query: string }) {
  if (isNounReading(reading)) return <NounCard reading={reading} query={query} />;
  if (isAdjectiveReading(reading)) return <AdjectiveCard reading={reading} query={query} />;
  return <GenericCard reading={reading} query={query} />;
}
