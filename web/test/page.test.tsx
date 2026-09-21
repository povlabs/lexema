// The search page, rendered.
//
// Issue #14 asks for the page to be checked against the twelve sampled queries
// in reports/2026-09-18-dataset-spot-check.md plus a basic accessibility pass.
// Doing that by hand against a running Worker proves one machine on one day, so
// it is done here instead: an archive shaped like those twelve rows is imported
// into a temporary database exactly as test/lookup.test.ts imports its fixture,
// the real `lookup` answers each query, and the real components render the
// answer to HTML. No dictionary archive, no D1, no browser — so it runs in CI.
//
// What it cannot cover is the wiring in app/page.tsx: reaching D1 needs
// `cloudflare:workers`, which exists only inside workerd. The query parsing and
// every rendered state are here; the binding is exercised by running the page.

import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { renderToStaticMarkup } from "react-dom/server";
import { importRelease } from "../../src/import/importRelease.js";
import { writeKnownDisputes } from "../../src/import/knownDisputes.js";
import { fromNodeSqlite } from "../../src/lookup/database.js";
import { lookup, readRelease } from "../../src/lookup/lookup.js";
import type { Reading } from "../../src/lookup/types.js";
import type { Attempt } from "../app/attempt.ts";
import { Attribution } from "../app/Attribution";
import { FirstLoad, Outcome, Pending, SearchPage } from "../app/SearchPage";
import { SiteFooter } from "../app/SiteFooter";
import { firstQuery } from "../app/params";
// The class strings the components carry, imported rather than copied. #67
// moved the page onto Tailwind utilities, so a rendered class is no longer a
// name this file can spell for itself: it reads the same constant the markup
// renders, and a restyle that changes one changes both together.
import {
  AMBIGUOUS,
  BOX,
  BOX_CELL,
  BOX_HEADING,
  BOX_NOTE,
  BOX_ROW,
  BOX_ROW_LABEL,
  CARD,
  CLAIM_LABEL,
  CLAIM_VALUE,
  CODE_IDENTITY,
  CONJUGATION_TENSE,
  COUNT,
  DEFINITIONS,
  EMPTY,
  ERROR,
  FIELD_LABEL,
  FIELD_VALUE,
  FORM_ITEM,
  GLOSS,
  HEADLINE,
  HEADLINE_FACT,
  HEADLINE_LABEL,
  HEADLINE_VALUE,
  HEADWORD,
  LABELS,
  LINK,
  MENTION,
  MUTED,
  OPEN_MARK,
  PENDING,
  RELEASE_FOOTER,
  RELEASE_LINE,
  SEARCH_BUTTON,
  SEARCH_INPUT,
  SEARCH_LABEL,
  SEARCH_FORM,
  SEARCHED,
  SHELL_CENTRED,
  SHELL_TOP,
  SITE_FOOTER,
  SITE_NAME,
} from "../app/styles.ts";
import { FIXTURE_LINES } from "./fixture.js";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const RELEASE = "it-page-test";

interface Fixture {
  dir: string;
  db: DatabaseSync;
}

async function fixture(): Promise<Fixture> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-page-"));
  const archive = join(dir, "fixture.jsonl.gz");
  const database = join(dir, "fixture.sqlite");
  await writeFile(archive, gzipSync(Buffer.from(`${FIXTURE_LINES.join("\n")}\n`, "utf8")));
  await importRelease({
    input: archive,
    database,
    schema: join(REPO, "src/db/schema.sql"),
    releaseId: RELEASE,
    archiveR2Key: `releases/${RELEASE}.jsonl.gz`,
    sourceUrl: "https://example.invalid/it-extract.jsonl.gz",
    license: "CC-BY-SA-4.0",
    onRejection: (rejection) => {
      throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
    },
  });
  const db = new DatabaseSync(database);
  // The same review rows `pnpm run seed:dev` writes, from the same module, so
  // the page under test meets the dispute the development seed shows.
  assert.equal(writeKnownDisputes(db, RELEASE), 1);
  return { dir, db };
}

async function withFixture(run: (f: Fixture) => Promise<void>): Promise<void> {
  const f = await fixture();
  try {
    await run(f);
  } finally {
    f.db.close();
    await rm(f.dir, { recursive: true, force: true });
  }
}

/** The whole page, as the Worker would send it for `?q=<query>`. */
async function render(db: DatabaseSync, query: string): Promise<string> {
  const attempt: Attempt = await lookup({ db: fromNodeSqlite(db), releaseId: RELEASE, query });
  return renderToStaticMarkup(
    <SearchPage raw={query}>
      <Outcome raw={query} attempt={attempt} />
    </SearchPage>,
  );
}

const cards = (html: string): number => html.split(`<article class="${CARD}"`).length - 1;
const mentions = (html: string): number => html.split(`class="${MENTION}"`).length - 1;

/** How many times a literal string occurs. Counting, never pattern-matching. */
const occurrencesOf = (html: string, needle: string): number => html.split(needle).length - 1;

/**
 * How many `<tag>` elements the markup opens, whatever attributes they carry.
 *
 * A landmark or a heading is one because of its element, not because of the
 * class string it happens to wear, so the counts that claim an exact total are
 * taken here rather than off a production class: a stray `<main>` or `<h1>` a
 * restyle forgot to class would otherwise go uncounted.
 */
const elementsOf = (html: string, tag: string): number =>
  patternsOf(html, new RegExp(`<${tag}(?=[\\s/>])`));

/** How many times a pattern occurs, counted over the whole markup. */
const patternsOf = (html: string, pattern: RegExp): number =>
  html.match(new RegExp(pattern, "g"))?.length ?? 0;

/**
 * The words of some markup, with the tags taken out.
 *
 * What a serializer, a screen reader or a reader with styles off is left with
 * — so an assertion over this is an assertion about the text, never about the
 * layout that happens to space it out.
 */
const textOf = (html: string): string => html.replace(/<[^>]*>/g, "");

/** A literal, as a pattern: an assertion over a class string stays exact. */
const esc = (literal: string): string => literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const exact = (literal: string): RegExp => new RegExp(esc(literal));

/** One headline fact of the header bar, as the bar renders it. */
const fact = (label: string, value: string): string =>
  `<dt class="${HEADLINE_LABEL}">${label}</dt><dd class="${HEADLINE_VALUE}">${value}</dd>`;

/** One grammar claim, as a pill beside the spelling it is about. */
const claim = (label: string, value: string): string =>
  `<dt class="${CLAIM_LABEL}">${label}</dt><dd class="${CLAIM_VALUE}">${value}</dd>`;

/** A box row: its small label, and the cell beside it. */
const rowLabel = (label: string): string => `<th class="${BOX_ROW_LABEL}" scope="row">${label}</th>`;
const cell = (inner: string): string => `<td class="${BOX_CELL}">${inner}</td>`;

/** A box's own heading, which also labels the box. */
const boxHeading = (id: string, heading: string): RegExp =>
  new RegExp(`<h3 class="${esc(BOX_HEADING)}" id="${id}">${esc(heading)}</h3>`);

/** The card's silence line, the one place a card says what it has not got. */
const silence = (said: string): string => `<p class="${EMPTY}">${said}</p>`;

/** One form of a box's list, as `UnplacedForms` and the conjugations render it. */
const formItem = `<li class="${FORM_ITEM}">`;

/** One row of the attribution page's release identity. */
const field = (label: string, value: string): string =>
  `<dt class="${FIELD_LABEL}">${label}</dt><dd class="${FIELD_VALUE}">${value}</dd>`;

/**
 * Every rendered spelling of the entry's own forms, as the `forms[]` index it
 * came from — in the order the card renders them, repeats included.
 *
 * `Reading.tsx` marks each one with `data-form="<index>"`, so this counts what
 * the page actually rendered instead of searching for a spelling: two forms
 * that share a spelling are two marks, and a spelling that is a gloss, a
 * derived article or another record's word is not a mark at all.
 */
const formMarks = (html: string): number[] =>
  [...html.matchAll(/data-form="(\d+)"/g)].map((match) => Number(match[1]));

/** How many times the card renders the record's own headword. */
const headwordMarks = (html: string): number => occurrencesOf(html, 'data-headword=""');

/** Every box of one card, each from its open tag to its close. */
function boxesOf(html: string): string[] {
  const found: string[] = [];
  let at = html.indexOf(`<section class="${BOX}"`);
  while (at !== -1) {
    const end = html.indexOf("</section>", at);
    assert.notEqual(end, -1, "a box is not closed");
    found.push(html.slice(at, end));
    at = html.indexOf(`<section class="${BOX}"`, end);
  }
  return found;
}

/** The card with every box cut out of it: everything no box renders. */
function withoutBoxes(html: string): string {
  let rest = html;
  for (const box of boxesOf(html)) rest = rest.replace(box, "");
  return rest;
}

/**
 * One card against the reading it was rendered from: every form the lookup
 * returned is on it, exactly one box holds each, and no form renders outside a
 * box at all.
 *
 * "A fact is never rendered twice on one card" and "a form that fits no box is
 * in the unplaced box" (design-system-manifest.md § "The result card"). One box
 * per form is what those two rules mean together: a form a paradigm placed is
 * not repeated in the unplaced box, and a form no paradigm placed is in it. A
 * form filling two cells of one paradigm is not a second rendering — it is one
 * fact at the two coordinates the source filed it under, which is what a grid
 * is for — so that shows as two marks inside a single box, and the per-word
 * counts below say where it happens.
 *
 * Returns the marks, for the caller to count.
 */
function assertPlacedOnce(html: string, reading: Reading, where: string): number[] {
  const marks = formMarks(html);
  for (const form of reading.forms) {
    const holders = boxesOf(html).filter((box) => box.includes(`data-form="${form.index}"`));
    assert.equal(
      holders.length,
      1,
      `${where}: form ${form.index} (${form.surface}) is rendered by exactly one box`,
    );
  }
  assert.deepEqual(
    [...new Set(marks)].sort((a, b) => a - b),
    reading.forms.map((form) => form.index),
    `${where}: the card renders every form of the reading, and nothing else`,
  );
  assert.equal(
    formMarks(withoutBoxes(html)).length,
    0,
    `${where}: no form is rendered outside a box`,
  );
  return marks;
}

/** The section of a card under one heading, from its heading to its close. */
function section(html: string, heading: string): string {
  const open = html.indexOf(`>${heading}</h3>`);
  assert.notEqual(open, -1, `no section headed ${heading}`);
  const end = html.indexOf("</section>", open);
  assert.notEqual(end, -1, `section ${heading} is not closed`);
  return html.slice(open, end);
}

/**
 * The reading one card was rendered from.
 *
 * The counting assertions need the lookup's own answer beside the HTML: "every
 * form still renders" is a claim about `reading.forms.length`, and reading that
 * number off the page would assert the page against itself.
 */
async function readingFor(
  db: DatabaseSync,
  query: string,
  word: string,
  pos: string,
): Promise<Reading> {
  const attempt: Attempt = await lookup({ db: fromNodeSqlite(db), releaseId: RELEASE, query });
  assert.equal(attempt.outcome, "found", `${query}: expected a found answer`);
  const readings = attempt.outcome === "found" ? attempt.readings : [];
  const match = readings.find((r) => r.word === word && r.pos === pos);
  assert.notEqual(match, undefined, `${query}: no ${pos} reading for ${word}`);
  return match as Reading;
}

/** Every reading one query answers with, in the order the page renders them. */
async function readingsFor(db: DatabaseSync, query: string): Promise<Reading[]> {
  const attempt: Attempt = await lookup({ db: fromNodeSqlite(db), releaseId: RELEASE, query });
  return attempt.outcome === "found" ? attempt.readings : [];
}

/** Each card of a page, in the order the page rendered them. */
function cardsOf(html: string): string[] {
  return html
    .split(`<article class="${CARD}"`)
    .slice(1)
    .map((part) => {
      const end = part.indexOf("</article>");
      assert.notEqual(end, -1, "a card is not closed");
      return part.slice(0, end);
    });
}

/**
 * One card out of a page, by the label it announces itself with.
 *
 * A query answers with every record that matched, so "the page shows no table"
 * and "this record shows no table" are different claims — and it is the second
 * one an assertion about `bella` is making.
 */
function card(html: string, label: string): string {
  const open = html.indexOf(`<article class="${CARD}" aria-label="${label}">`);
  assert.notEqual(open, -1, `no card labelled ${label}`);
  const end = html.indexOf("</article>", open);
  assert.notEqual(end, -1, `card ${label} is not closed`);
  return html.slice(open, end);
}

/** How many rows of each kind the index holds for one surface. */
function occurrences(db: DatabaseSync, surfaceKey: string): { direct: number; embedded: number } {
  const row = db
    .prepare(
      `SELECT sum(origin = 'headword') AS direct, sum(origin = 'embedded-form') AS embedded
         FROM lookup_form WHERE release_id = ? AND surface_key = ?`,
    )
    .get(RELEASE, surfaceKey) as { direct: number | null; embedded: number | null };
  return { direct: row.direct ?? 0, embedded: row.embedded ?? 0 };
}

/**
 * The twelve rows of the spot check, as this page has to answer them.
 *
 * `direct` and `embedded` are the report's own two counts for the query, and
 * `cards` is what they mean on screen: one card per record, so four evidence
 * rows spread over three records are three cards. `mentions` is how many of
 * those cards are records that merely list the word in their own table.
 */
const QUERIES = [
  {
    query: "casa", direct: 1, embedded: 0, cards: 1, mentions: 0,
    // The whole point of the entry: a gloss that defines nothing, and grammar
    // the source was asked for and did not give — said once, near the top,
    // with every section it would have filled simply absent (#60).
    expect: [
      /1 entry for/,
      /<q lang="it">casa<\/q>/,
      /casa \( approfondimento\) f sing/,
      exact(silence("The source states neither a gender nor a number and lists no forms for this entry.")),
    ],
  },
  {
    query: "case", direct: 1, embedded: 0, cards: 1, mentions: 0,
    expect: [/1 entry for/, /Form of<\/h3>/, /plurale di casa/],
  },
  {
    query: "studente", direct: 2, embedded: 3, cards: 5, mentions: 3,
    // Two analyses of the word, and the verb one is the claim later research
    // contradicts. It must not read as an ordinary fact.
    expect: [
      /5 entries for/,
      /Disputed by later research/,
      // Masculine singular is stated, so `it-articles/v1` derives all three.
      exact(rowLabel("definite") + `<td class="${BOX_CELL}"><span lang="it">lo</span>`),
      exact(rowLabel("indefinite") + `<td class="${BOX_CELL}"><span lang="it">uno</span>`),
      exact(rowLabel("partitive") + `<td class="${BOX_CELL}"><span lang="it">dello</span>`),
      /studiante as the present participle of studiare/,
      /it\.wiktionary\.org\/wiki\/Appendice:Coniugazioni\/Italiano\/studiare/,
      /claim <code>\/senses\/0\/glosses\/0<\/code>/,
    ],
  },
  {
    query: "studenti", direct: 1, embedded: 4, cards: 4, mentions: 3,
    expect: [/4 entries for/, /Does not define <q lang="it">studenti<\/q>/],
  },
  {
    query: "sale", direct: 3, embedded: 2, cards: 5, mentions: 2,
    // Three unrelated words spelled the same, none of them merged away, plus
    // the auxiliary row that is not a conjugation of anything.
    expect: [
      /5 entries for/,
      /cloruro di sodio/,
      /plurale di sala/,
      /Auxiliary named by the source: <span><span lang="it" data-form="\d+">avere o essere<\/span>/,
    ],
  },
  {
    query: "andare", direct: 2, embedded: 0, cards: 2, mentions: 0,
    expect: [
      /2 entries for/,
      /Grouped conjugations<\/h3>/,
      exact(`<h4 class="${CONJUGATION_TENSE}">present</h4>`),
      exact(`<h4 class="${CONJUGATION_TENSE}">imperfect</h4>`),
      /<span lang="it" data-form="\d+">andavano<\/span>/,
      /mood not stated in the source/,
    ],
  },
  {
    query: "andavano", direct: 1, embedded: 1, cards: 2, mentions: 1,
    expect: [
      /2 entries for/,
      /terza persona plurale dell&#x27;imperfetto indicativo di andare/,
      /Does not define <q lang="it">andavano<\/q>/,
    ],
  },
  {
    query: "parlare", direct: 2, embedded: 0, cards: 2, mentions: 0,
    expect: [
      /2 entries for/,
      /<span lang="it" data-form="\d+">parlerei<\/span>/,
      /Appendice:Coniugazioni/,
    ],
  },
  {
    query: "parlerei", direct: 1, embedded: 1, cards: 2, mentions: 1,
    // The mood is in prose on one record and missing from the tags on the
    // other. The page shows both and infers nothing.
    expect: [
      /2 entries for/,
      /condizionale presente di parlare/,
      /mood not stated in the source/,
    ],
  },
  {
    query: "bello", direct: 3, embedded: 7, cards: 10, mentions: 7,
    // Reverse ambiguity: every incoming edge names the word `bello`, which
    // three records spell, and the page says so on each of them.
    expect: [
      /10 entries for/,
      /Forms pointing here<\/h3>/,
      /3 entries share that spelling/,
      /The source does not say\s+which of them this form belongs to/,
    ],
  },
  {
    query: "bella", direct: 2, embedded: 7, cards: 9, mentions: 7,
    // Forward ambiguity, shown the same way.
    expect: [/9 entries for/, /3 entries share this spelling/, /The source does not say which\./],
  },
  {
    query: "città", direct: 1, embedded: 0, cards: 1, mentions: 0,
    expect: [
      /1 entry for/,
      exact(fact("gender", "feminine")),
      exact(fact("number", "invariable")),
      // Stated grammar still does not make an article: `invariable` is a
      // number the source states and not one an article agrees with.
      /Lexema derives no article: the source gives the number as invariable, which is neither singular nor plural/,
    ],
  },
] as const;

test("answers each of the twelve sampled queries with the state the report predicts", async () => {
  await withFixture(async ({ db }) => {
    for (const row of QUERIES) {
      const counted = occurrences(db, row.query.normalize("NFC").toLowerCase());
      assert.deepEqual(
        counted,
        { direct: row.direct, embedded: row.embedded },
        `${row.query}: the fixture must carry the spot check's own two counts`,
      );

      const html = await render(db, row.query);
      assert.equal(cards(html), row.cards, `${row.query}: one card per matching record`);
      assert.equal(mentions(html), row.mentions, `${row.query}: mentions labelled as mentions`);
      for (const pattern of row.expect) {
        assert.match(html, pattern, `${row.query}: ${pattern}`);
      }
    }
  });
});

/**
 * The header bar, on a noun card and an adjective card.
 *
 * "Under the headword: part of speech, then the few facts the source states for
 * it" (design-system-manifest.md, "The result card"). A fact the source did not
 * state is not a row: `casa`'s bar is the part of speech and nothing else.
 */
test("a card carries a header bar under the headword, holding only the facts the source states", async () => {
  await withFixture(async ({ db }) => {
    const studente = card(await render(db, "studente"), "studente, noun");
    // The headword carries its own mark, which is how the counting test tells
    // the entry's own word from the forms it lists.
    assert.match(
      studente,
      exact(
        `<h2 class="${HEADWORD}"><span lang="it" data-headword="">studente</span></h2>` +
          `<dl class="${HEADLINE}">`,
      ),
    );
    assert.match(studente, exact(fact("part of speech", "noun")));
    assert.match(studente, exact(fact("gender", "masculine")));
    assert.match(studente, exact(fact("number", "singular")));
    // The bar is inside the header, which closes before the card's middle.
    assert.match(studente, new RegExp(`<header>.*<dl class="${esc(HEADLINE)}">.*</dl>.*</header>`, "s"));

    const citta = card(await render(db, "città"), "città, noun");
    assert.match(citta, exact(fact("gender", "feminine")));
    assert.match(citta, exact(fact("number", "invariable")));

    // An adjective has a header bar too, and every gender the source tagged is
    // in it: `grande` is masculine *and* feminine.
    const grande = card(await render(db, "grande"), "grande, adjective");
    assert.match(
      grande,
      exact(
        `<h2 class="${HEADWORD}"><span lang="it" data-headword="">grande</span></h2>` +
          `<dl class="${HEADLINE}">`,
      ),
    );
    assert.match(grande, exact(fact("part of speech", "adjective")));
    assert.match(grande, exact(fact("gender", "masculine, feminine")));
    assert.match(grande, exact(fact("number", "singular")));

    const bello = card(await render(db, "bello"), "bello, adjective");
    assert.match(bello, exact(fact("gender", "masculine")));
    assert.match(bello, exact(fact("number", "singular")));
    const bella = card(await render(db, "bella"), "bella, adjective");
    assert.match(bella, exact(fact("gender", "feminine")));
    assert.match(bella, exact(fact("number", "singular")));
    const fine = card(await render(db, "fine"), "fine, adjective");
    assert.match(fine, exact(fact("gender", "masculine, feminine")));

    // `casa` states neither, so neither is a row — the silence line says it.
    const casa = card(await render(db, "casa"), "casa, noun");
    assert.match(
      casa,
      exact(
        `<dl class="${HEADLINE}"><div class="${HEADLINE_FACT}">` +
          `${fact("part of speech", "noun")}</div></dl>`,
      ),
    );
    // Neither dimension is a row here, in the header bar or as a claim pill.
    assert.doesNotMatch(casa, />gender<\/dt>/);
    assert.doesNotMatch(casa, />number<\/dt>/);
    assert.doesNotMatch(casa, /not stated in the source/);
  });
});

/**
 * Agreement sets as boxes, side by side in one wrapping row.
 *
 * "Each agreement set is one box with a heading; boxes sit in a row that wraps
 * on narrow screens. Rows inside a box are `label value`."
 */
test("agreement sets render as boxed groups in one wrapping row, never as stacked sections", async () => {
  await withFixture(async ({ db }) => {
    const studente = card(await render(db, "studente"), "studente, noun");
    assert.match(studente, exact(`<div class="${BOX_ROW}">`));
    // Every box on the card is inside that one row, and each has its heading.
    assert.equal(occurrencesOf(studente, `<div class="${BOX_ROW}">`), 1);
    // Two boxes, not three: `studente` files all three of its forms under a
    // number, so there is nothing left for an unplaced box to hold.
    assert.equal(occurrencesOf(studente, `<section class="${BOX}"`), 2);
    assert.equal(
      occurrencesOf(
        studente.slice(studente.indexOf(`<div class="${BOX_ROW}">`)),
        `<section class="${BOX}"`,
      ),
      2,
    );
    assert.match(studente, boxHeading("numbers-\\d+", "Singular and plural"));
    // The articles are a box in that same row, not a section of their own
    // (design-system-manifest.md § "The result card", "Three boxes to a row").
    assert.match(studente, boxHeading("articles-\\d+", "Articles"));
    // Counted on the row element, so a row that lost its class is still a row.
    assert.equal(patternsOf(section(studente, "Articles"), /<th[^>]*scope="row"/), 3);
    assert.equal(occurrencesOf(section(studente, "Articles"), `<th class="${BOX_ROW_LABEL}"`), 3);
    // A row inside a box is a small English label and an Italian value.
    assert.match(
      section(studente, "Singular and plural"),
      new RegExp(
        `${esc(rowLabel("plural"))}${esc(`<td class="${BOX_CELL}"><span><span lang="it" data-form="`)}\\d+">studenti</span>`,
      ),
    );
    assert.match(
      section(studente, "Articles"),
      exact(
        rowLabel("definite") +
          cell(
            `<span lang="it">lo</span> <span class="${MUTED}"><span lang="it">lo studente</span></span>`,
          ),
      ),
    );
    // The gendered pair, exactly as the source spelled it: one string, marked
    // Italian, never split on the slash.
    assert.match(studente, /<span lang="it" data-form="\d+">studente\/studentessa<\/span>/);
    assert.doesNotMatch(studente, /<span lang="it"[^>]*>studentessa<\/span><\/td>/);
    // The derivation is said once, under the rows, rather than once per row.
    assert.equal(occurrencesOf(studente, "<code>it-articles/v1</code>"), 1);
    // And it is said under the rows, inside the box, as the box's own note.
    assert.match(studente, exact(`<p class="${BOX_NOTE}">Not from the source:`));
    assert.match(studente, /Not from the source: Lexema derives these from the masculine singular/);

    // The adjective's paradigm and its degrees are boxes in the same row.
    const grande = card(await render(db, "grande"), "grande, adjective");
    assert.equal(occurrencesOf(grande, `<div class="${BOX_ROW}">`), 1);
    assert.equal(occurrencesOf(grande, `<section class="${BOX}"`), 3);
    assert.match(grande, boxHeading("paradigm-\\d+", "Gender and number"));
    assert.match(grande, boxHeading("degrees-\\d+", "Comparative and superlative"));
    const paradigm = section(grande, "Gender and number");
    assert.match(
      paradigm,
      exact(rowLabel("masculine plural") + cell(`<span lang="it" data-form="0">grandi</span>`)),
    );
    assert.match(
      paradigm,
      exact(rowLabel("feminine plural") + cell(`<span lang="it" data-form="0">grandi</span>`)),
    );
    const degrees = section(grande, "Comparative and superlative");
    assert.match(
      degrees,
      exact(
        rowLabel("comparative") +
          cell(`<span><span lang="it" data-form="1">maggiore</span></span>`),
      ),
    );
    // Verbatim, newline and leading space included, and marked as source text —
    // never split into `grandissimo` and `massimo`.
    assert.match(
      degrees,
      exact(
        rowLabel("superlative") +
          `<td class="${BOX_CELL}"><span><span lang="it" data-form="3">grandissimo\n massimo</span>`,
      ),
    );
    assert.match(
      degrees,
      exact(
        `<span lang="it" data-form="3">grandissimo\n massimo</span>` +
          `<span class="${AMBIGUOUS}"> · source text, not split into separate forms</span>`,
      ),
    );
    // The degrees box is the only place that form now sits, so the gender and
    // number the source also tagged are said there rather than lost with the
    // second rendering that used to carry them.
    assert.match(degrees, exact(claim("degree", "absolute")));
    assert.match(degrees, exact(claim("gender", "masculine")));
    assert.doesNotMatch(grande, /<span lang="it"[^>]*>massimo<\/span>/);

    // `bella` files nothing under three cells and lists no forms, so it has no
    // box at all — and no empty row container standing in for one.
    const bella = card(await render(db, "bella"), "bella, adjective");
    assert.doesNotMatch(bella, exact(`<div class="${BOX_ROW}">`));
    assert.doesNotMatch(bella, exact(`<section class="${BOX}"`));
    assert.doesNotMatch(bella, /<table/);
    // The page it sits on still boxes the cards that have something to box,
    // and every one of those boxes is inside a row.
    const bellaPage = await render(db, "bella");
    assert.ok(occurrencesOf(bellaPage, `<section class="${BOX}"`) > 0);
    assert.doesNotMatch(bellaPage, exact(`</div><section class="${BOX}"`));

    // `bello` fills all four cells, so the paradigm box renders.
    const bello = card(await render(db, "bello"), "bello, adjective");
    assert.match(section(bello, "Gender and number"), exact(rowLabel("masculine singular")));
    assert.match(
      section(bello, "Gender and number"),
      exact(rowLabel("feminine plural") + cell(`<span lang="it" data-form="2">belle</span>`)),
    );
  });
});

/**
 * Three boxes to a row, asserted as the class that produces it.
 *
 * "Paradigm boxes sit three across on a wide screen, in the order the source's
 * vocabulary gives, wrapping to fewer on narrow screens"
 * (design-system-manifest.md § "The result card"). This test renders static
 * markup and lays nothing out, so what it can check is the class the container
 * carries — and that is worth checking, because the class is the whole of the
 * rule: a grid of one column, two from `sm`, three from `lg`.
 */
test("the box row is three across on a wide screen and wraps to fewer on a narrow one", async () => {
  // Written out rather than imported, unlike every other class in this file:
  // this is the one assertion whose subject is the utilities themselves, so a
  // change to the row has to be made here as well as in the component.
  assert.equal(
    BOX_ROW,
    "mt-4 grid grid-cols-1 items-start gap-[0.9rem] sm:grid-cols-2 lg:grid-cols-3",
  );

  await withFixture(async ({ db }) => {
    for (const [query, label] of [
      ["studente", "studente, noun"],
      ["bello", "bello, adjective"],
    ] as const) {
      const html = card(await render(db, query), label);
      assert.ok(
        html.includes(`<div class="${BOX_ROW}">`),
        `${query}: the box container carries the three-across row`,
      );
      // And every box of that card is inside it, rather than beside it.
      assert.equal(occurrencesOf(html, `<div class="${BOX_ROW}">`), 1);
      assert.equal(
        occurrencesOf(html.slice(html.indexOf(`<div class="${BOX_ROW}">`)), `<section class="${BOX}"`),
        occurrencesOf(html, `<section class="${BOX}"`),
      );
    }
  });
});

/**
 * Empty is said once.
 *
 * "A section with nothing to show is omitted. One line near the top of the card
 * names what the source does not state for this entry." This is the whole of
 * #60: `casa` used to say the same absence five times.
 */
test("a section with nothing to show is omitted, and one line near the top names the silence", async () => {
  await withFixture(async ({ db }) => {
    const casa = card(await render(db, "casa"), "casa, noun");
    // One sentence, and one silence paragraph on the whole card.
    assert.equal(occurrencesOf(casa, `<p class="${EMPTY}">`), 1);
    assert.equal(occurrencesOf(casa, `class="${EMPTY}"`), 1);
    assert.match(
      casa,
      exact(
        silence("The source states neither a gender nor a number and lists no forms for this entry."),
      ),
    );
    // It is above the senses list, where a reader meets it first.
    assert.ok(
      casa.indexOf(`<p class="${EMPTY}">`) < casa.indexOf(`<ol class="${DEFINITIONS}">`),
      "the silence line renders above the senses",
    );
    // And every section it stands in for is gone.
    assert.doesNotMatch(casa, /Singular and plural/);
    assert.doesNotMatch(casa, /Articles<\/h3>/);
    assert.doesNotMatch(casa, /Forms listed by this entry/);
    assert.doesNotMatch(casa, /Not available in the source/);
    assert.doesNotMatch(casa, /No article is shown/);

    // `città` states both dimensions, so its line names only what is missing:
    // the forms, and the article Lexema will not derive from `invariable`.
    const citta = card(await render(db, "città"), "città, noun");
    assert.equal(occurrencesOf(citta, `<p class="${EMPTY}">`), 1);
    assert.match(
      citta,
      exact(
        silence(
          "The source lists no forms for this entry. Lexema derives no article: the source gives the number as invariable, which is neither singular nor plural.",
        ),
      ),
    );
    assert.doesNotMatch(citta, /Singular and plural/);
    assert.doesNotMatch(citta, /Articles<\/h3>/);

    // `fine` withholds its table and tags no degree, and says both once.
    const fine = card(await render(db, "fine"), "fine, adjective");
    assert.equal(occurrencesOf(fine, `<p class="${EMPTY}">`), 1);
    assert.match(
      fine,
      exact(
        silence(
          "The source tags no comparative or superlative for this entry. Lexema shows no gender-and-number table: this entry files nothing under masculine plural, neither its own headword nor any form it lists.",
        ),
      ),
    );
    assert.doesNotMatch(fine, /Comparative and superlative/);
    assert.doesNotMatch(fine, /Gender and number/);

    const bella = card(await render(db, "bella"), "bella, adjective");
    assert.equal(occurrencesOf(bella, `<p class="${EMPTY}">`), 1);
    assert.match(bella, /The source tags no comparative or superlative and lists no forms for this entry\./);
    assert.match(bella, /Lexema shows no gender-and-number table: this entry files nothing under masculine singular/);

    // A card with nothing missing carries no silence line at all.
    const studente = card(await render(db, "studente"), "studente, noun");
    assert.doesNotMatch(studente, exact(`class="${EMPTY}"`));
    const grande = card(await render(db, "grande"), "grande, adjective");
    assert.doesNotMatch(grande, exact(`class="${EMPTY}"`));

    // `bello` fills its paradigm and lists forms; only the degrees are absent.
    const bello = card(await render(db, "bello"), "bello, adjective");
    assert.equal(occurrencesOf(bello, `<p class="${EMPTY}">`), 1);
    assert.match(
      bello,
      exact(silence("The source tags no comparative or superlative for this entry.")),
    );
  });
});

/** A fact the source stated once is rendered once. */
test("no fact renders twice on a card", async () => {
  await withFixture(async ({ db }) => {
    // `pl.: case` is a sense label and an unclassified claim read from one
    // pointer, `/senses/0/raw_tags/0`. It is the entry's one real fact.
    const casa = card(await render(db, "casa"), "casa, noun");
    assert.equal(occurrencesOf(casa, "pl.: case"), 1);
    assert.match(
      casa,
      exact(`<p class="${LABELS}"><span><span lang="it">pl.: case</span></span></p>`),
    );
    // And not a second time as a claim pill, which is what the label replaces.
    assert.doesNotMatch(casa, exact(`<dt class="${CLAIM_LABEL}">unclassified</dt>`));

    const studente = card(await render(db, "studente"), "studente, noun");
    assert.equal(occurrencesOf(studente, "scuola"), 1);

    // Gender and number are in the header bar, so the record's own grammar is
    // not listed again as chips under it. What stays is a *form's* grammar,
    // which is a different fact about a different spelling.
    assert.doesNotMatch(studente, /aria-label="other grammar for studente"/);
    // A placed form's own grammar is not repeated either: the row it sits in
    // states the number and the gender, so there is nothing left to chip.
    assert.doesNotMatch(studente, /aria-label="grammar for studenti"/);
    // What the box does not state still renders, beside the form it belongs
    // to: `maggiori` carries a raw tag no degree row can read.
    const rest = card(await render(db, "grande"), "grande, adjective");
    assert.match(rest, /aria-label="grammar for maggiori"/);
    assert.equal(occurrencesOf(rest, "comparativo di maggioranza"), 1);
    const grande = card(await render(db, "grande"), "grande, adjective");
    assert.doesNotMatch(grande, /aria-label="other grammar for grande"/);
    assert.equal(patternsOf(grande, /<dt[^>]*>part of speech<\/dt>/), 1);
    assert.equal(occurrencesOf(grande, `<dt class="${HEADLINE_LABEL}">part of speech</dt>`), 1);
  });
});

/**
 * Two labels on one sense are two words, not one.
 *
 * The labels sit in a flex row, so the space between the pills is a matter of
 * layout — and layout is not what a serializer or a screen reader reads.
 * `studentessa` is this archive's one two-label sense, exactly as the real
 * record has it: `scuola` off the sense's `raw_tags`, `form-of` off its tags.
 * With no text separator between them they read as `scuolaform-of`, a word the
 * source never wrote.
 */
test("two labels on one sense are separated in the text, not only in the layout", async () => {
  await withFixture(async ({ db }) => {
    const studentessa = card(await render(db, "studente"), "studentessa, noun");
    const line = studentessa.match(new RegExp(`<p class="${esc(LABELS)}">.*?</p>`))?.[0];
    assert.notEqual(line, undefined, "studentessa renders no labels line");
    assert.match(
      line as string,
      exact(
        `<span><span lang="it">scuola</span></span><span> <span lang="it">form-of</span></span>`,
      ),
    );
    // The exact text between the two labels: one space, and nothing else.
    assert.equal(textOf(line as string), "scuola form-of");
  });
});

/**
 * "Forms pointing here" is one row per record, with the sense count.
 *
 * `casetta` declares itself a form of `casa` on two of its senses, which is one
 * record saying it twice — not two records. `readInflections` in
 * `src/lookup/lookup.ts` does the collapse, keeping both pointers.
 */
test("a record pointing here is listed once, with how many of its senses point here", async () => {
  await withFixture(async ({ db }) => {
    const casa = card(await render(db, "casa"), "casa, noun");
    const pointing = section(casa, "Forms pointing here");
    assert.equal(occurrencesOf(pointing, "<li>"), 2);
    assert.equal(occurrencesOf(pointing, ">casetta</a>"), 1);
    assert.match(
      pointing,
      exact(
        `<a class="${LINK}" href="/?q=casetta" lang="it">casetta</a> ` +
          `<span class="${MUTED}">(noun)</span> — declares itself a form of ` +
          `<span lang="it">casa</span>, in 2 of its senses</li>`,
      ),
    );
    // One sense, no count clause: `case` reads as it did before the collapse.
    assert.match(
      pointing,
      exact(
        `<a class="${LINK}" href="/?q=case" lang="it">case</a> ` +
          `<span class="${MUTED}">(noun)</span> — declares itself a form of ` +
          `<span lang="it">casa</span></li>`,
      ),
    );

    // The reverse ambiguity survives the collapse: one row per record, and the
    // record's own candidate set still says the edge named a word.
    const bello = card(await render(db, "bello"), "bello, adjective");
    assert.match(bello, /3 entries share that spelling/);
    assert.match(bello, /The source does not say\s+which of them this form belongs to/);
  });
});

/**
 * Layout never drops a form, and never renders one twice.
 *
 * The old version of this test asked whether each spelling was somewhere in
 * the card's HTML and then counted rows inside the all-forms box. Both passed
 * while every placed form rendered a second time in that box, because "at
 * least once" cannot see a second one and the row count only ever looked
 * inside one section. This counts what the whole card rendered, off the marks
 * `Reading.tsx` puts on each spelling, and names a literal per word.
 *
 * `occurrences` is the total across the card and `placed` is what a paradigm
 * put at a second coordinate: `grande` is filed under masculine *and* feminine
 * singular and `grandi` under both plurals, so its table renders `grandi`
 * twice and the headword twice — one fact at the two coordinates the source
 * gave it, inside one box, which `assertPlacedOnce` allows and a second box
 * rendering the same form does not.
 */
const PLACEMENTS = [
  // word, pos, query, forms[], form marks on the card, headword marks
  { word: "studente", pos: "noun", query: "studente", forms: 3, marks: 3, headword: 2 },
  { word: "casa", pos: "noun", query: "casa", forms: 0, marks: 0, headword: 1 },
  { word: "citt\u00e0", pos: "noun", query: "citt\u00e0", forms: 0, marks: 0, headword: 1 },
  { word: "bello", pos: "adj", query: "bello", forms: 3, marks: 3, headword: 2 },
  { word: "bella", pos: "adj", query: "bella", forms: 0, marks: 0, headword: 1 },
  { word: "fine", pos: "adj", query: "fine", forms: 1, marks: 1, headword: 1 },
  { word: "grande", pos: "adj", query: "grande", forms: 4, marks: 5, headword: 3 },
] as const;

test("every form renders exactly once on the card, counted against the lookup's own answer", async () => {
  await withFixture(async ({ db }) => {
    for (const row of PLACEMENTS) {
      const reading = await readingFor(db, row.query, row.word, row.pos);
      const label = `${row.word}, ${row.pos === "adj" ? "adjective" : row.pos}`;
      const html = card(await render(db, row.query), label);

      // The lookup's own answer first: the literal beside it is only a literal
      // if it is the number of forms this reading actually carries.
      assert.equal(reading.forms.length, row.forms, `${row.word}: forms[] length`);

      const marks = assertPlacedOnce(html, reading, row.word);
      assert.equal(marks.length, row.marks, `${row.word}: form spellings rendered on the card`);
      assert.equal(
        headwordMarks(html),
        row.headword,
        `${row.word}: the headword, which the card renders apart from its forms`,
      );

      // An entry that lists no form has no box to hold one.
      if (reading.forms.length === 0) {
        assert.doesNotMatch(html, /forms listed by this entry/i, `${row.word}: no empty box`);
      }
    }

    // `studente` and `bello` place every form they list, so neither carries an
    // unplaced box at all — which is what the old test could not tell from a
    // box holding all of them a second time.
    for (const [query, label] of [
      ["studente", "studente, noun"],
      ["bello", "bello, adjective"],
    ] as const) {
      const html = card(await render(db, query), label);
      assert.doesNotMatch(html, /Forms listed by this entry/, `${query}: every form is placed`);
      assert.doesNotMatch(html, /Other forms listed by this entry/, `${query}: no leftover box`);
    }

    // `fine` places none of its one form, so the box holds the whole table and
    // is named for that; `grande` places three of four, so the box is named
    // for the rest and holds only `maggiori`, whose degree the source states
    // in the prose of a raw tag and nowhere a degree row could read it.
    const fine = card(await render(db, "fine"), "fine, adjective");
    assert.match(fine, boxHeading("forms-\\d+", "Forms listed by this entry"));
    assert.equal(elementsOf(section(fine, "Forms listed by this entry"), "li"), 1);
    assert.equal(occurrencesOf(section(fine, "Forms listed by this entry"), formItem), 1);

    const grande = card(await render(db, "grande"), "grande, adjective");
    assert.match(grande, boxHeading("forms-\\d+", "Other forms listed by this entry"));
    const rest = section(grande, "Other forms listed by this entry");
    assert.equal(elementsOf(rest, "li"), 1);
    assert.equal(occurrencesOf(rest, formItem), 1);
    assert.match(rest, exact(`${formItem}<span lang="it" data-form="2">maggiori</span>`));
    assert.match(rest, /<q lang="it">comparativo di maggioranza<\/q>/);
    // And what the paradigm and the degrees took is not in it a second time.
    for (const surface of ["grandi", "maggiore", "grandissimo"]) {
      assert.ok(!rest.includes(surface), `${surface} is placed, so it is not in the unplaced box`);
    }
  });
});

/**
 * The same rule over the twelve sampled queries, card by card.
 *
 * Every card of every one of those pages, checked against the reading it was
 * rendered from: one box per form, no form outside a box, and no spelling of a
 * form rendered twice anywhere on those pages — none of the twelve answers
 * with an adjective whose paradigm files one spelling under two cells, so the
 * page total is exactly the number of forms the lookup returned.
 */
test("no card of the twelve sampled queries renders a form twice", async () => {
  await withFixture(async ({ db }) => {
    for (const row of QUERIES) {
      const readings = await readingsFor(db, row.query);
      const rendered = cardsOf(await render(db, row.query));
      assert.equal(rendered.length, readings.length, `${row.query}: one card per reading`);

      let total = 0;
      let expected = 0;
      for (const [i, reading] of readings.entries()) {
        total += assertPlacedOnce(rendered[i], reading, `${row.query}: ${reading.word}`).length;
        expected += reading.forms.length;
      }
      assert.equal(total, expected, `${row.query}: one rendering per forms[] entry on the page`);
    }
  });
});

/**
 * The searched form, outlined where it sits.
 *
 * "A query that is itself a form is marked inside the paradigm it belongs to,
 * by a border, not by colour alone" — so `.searched` draws the border and the
 * words beside it say the same thing for a reader who sees none.
 */
test("the searched form is outlined where it sits, and nothing is marked where it sits nowhere", async () => {
  await withFixture(async ({ db }) => {
    // `grandi` is the masculine and the feminine plural of `grande`, so both
    // cells of the paradigm are marked. The paradigm placed it, so it does not
    // appear again in the residual forms box: one fact at two coordinates.
    const grande = card(await render(db, "grandi"), "grande, adjective");
    const paradigm = section(grande, "Gender and number");
    assert.equal(occurrencesOf(paradigm, `<span class="${SEARCHED}">`), 2);
    assert.match(
      paradigm,
      exact(
        rowLabel("masculine plural") +
          cell(
            `<span class="${SEARCHED}"><span lang="it" data-form="0">grandi</span>` +
              `<span class="${MUTED}"> · the form you searched</span></span>`,
          ),
      ),
    );
    // Nothing that is not the query is marked.
    assert.match(
      paradigm,
      exact(
        rowLabel("masculine singular") + cell(`<span lang="it" data-headword="">grande</span>`),
      ),
    );

    // `fine` shows no paradigm, so `fini` is marked in the box it does sit in.
    const fine = card(await render(db, "fini"), "fine, adjective");
    assert.match(
      section(fine, "Forms listed by this entry"),
      exact(
        `${formItem}<span class="${SEARCHED}"><span lang="it" data-form="0">fini</span>` +
          `<span class="${MUTED}"> · the form you searched</span></span>`,
      ),
    );

    // `casa` renders no box, so its own card marks nothing and invents none.
    const casa = card(await render(db, "casa"), "casa, noun");
    assert.doesNotMatch(casa, exact(`class="${SEARCHED}"`));
    assert.doesNotMatch(casa, exact(`<section class="${BOX}"`));

    // `bella` is a form of `bello`, and `bello` files it under feminine
    // singular — so the mark lands on the card that has the cell, and on the
    // `bella` card, which has no box, nothing is marked.
    const page = await render(db, "bella");
    assert.match(
      section(card(page, "bello, adjective"), "Gender and number"),
      exact(
        rowLabel("feminine singular") +
          `<td class="${BOX_CELL}"><span class="${SEARCHED}"><span lang="it" data-form="1">bella</span>`,
      ),
    );
    assert.doesNotMatch(card(page, "bella, adjective"), exact(`class="${SEARCHED}"`));
  });
});

/**
 * The noun card, over the three noun shapes #53 names.
 *
 * One card per shape, because the three are the whole range: both dimensions
 * stated, a number the source states that no article agrees with, and a record
 * the source tagged not at all. Nothing here is read off the release — the
 * release carries no article field — so every article on the page has to say
 * where it came from.
 */
test("a noun renders its own card: agreement, numbers, and derived articles or a reason", async () => {
  await withFixture(async ({ db }) => {
    const studente = card(await render(db, "studente"), "studente, noun");
    // The three articles `it-articles/v1` derives for a masculine singular
    // starting `st`, each labelled with where it came from.
    for (const [kind, article] of [
      ["definite", "lo"],
      ["indefinite", "uno"],
      ["partitive", "dello"],
    ]) {
      assert.match(
        studente,
        exact(
          rowLabel(kind) +
            cell(
              `<span lang="it">${article}</span> ` +
                `<span class="${MUTED}"><span lang="it">${article} studente</span></span>`,
            ),
        ),
        `${kind} article, labelled`,
      );
    }

    // `città`: the source states a gender, and states the number as
    // `invariable`, which is neither singular nor plural — so no articles box,
    // and the reason is in the card's one silence line.
    const citta = card(await render(db, "città"), "città, noun");
    // No articles box at all: not the box, and not its heading.
    assert.doesNotMatch(citta, boxHeading("articles-\\d+", "Articles"));
    assert.match(citta, /Lexema derives no article: the source gives the number as invariable/);

    // A noun has no conjugation, and the noun card does not pretend to look
    // for one; the verb card still does.
    assert.doesNotMatch(citta, /Grouped conjugations/);
    assert.match(await render(db, "parlare"), /Grouped conjugations/);
  });
});

/**
 * The adjective card, over the four shapes #52 names.
 *
 * The four are the whole range the source offers here: a paradigm it fills, a
 * record that fills almost none of it, a record where a cell cannot be told
 * apart, and one whose degrees are written as source text rather than as one
 * word. The box appears in exactly one of them, and every other case has its
 * reason in the card's silence line.
 */
test("an adjective renders its own card: a paradigm when the source fills it, a reason when it does not", async () => {
  await withFixture(async ({ db }) => {
    // `bello`: masculine singular on the record, and three forms tagged for the
    // other three cells. All four are single words, so the box renders.
    const bello = card(await render(db, "bello"), "bello, adjective");
    const paradigm = section(bello, "Gender and number");
    assert.match(
      paradigm,
      exact(rowLabel("masculine plural") + cell(`<span lang="it" data-form="0">belli</span>`)),
    );
    assert.match(
      paradigm,
      exact(rowLabel("feminine singular") + cell(`<span lang="it" data-form="1">bella</span>`)),
    );
    // No form is dropped and none is shown twice: the table is the one place
    // each of the three sits, so there is no box of leftovers under it.
    for (const [i, form] of ["belli", "bella", "belle"].entries()) {
      assert.equal(
        occurrencesOf(bello, `<span lang="it" data-form="${i}">${form}</span>`),
        1,
        `${form} is rendered once`,
      );
    }
    assert.doesNotMatch(bello, /forms listed by this entry/i);
    // Nothing in this entry carries a degree tag, so there is no box for one.
    assert.doesNotMatch(bello, /Comparative and superlative/);
    assert.doesNotMatch(bello, exact(rowLabel("superlative")));

    // `bella`: the adjective card, and no box of its own — the record is
    // feminine singular and lists no forms, so three cells have nothing in
    // them. The `bello` card on the same page still has its box, which is why
    // this reads one card rather than the whole page.
    const bella = card(await render(db, "bella"), "bella, adjective");
    assert.match(
      bella,
      /Lexema shows no gender-and-number table: this entry files nothing under masculine singular/,
    );

    // `fine`: tagged masculine, feminine and singular, with one form under a
    // bare `plural`. Nothing says whether `fini` is the masculine plural or the
    // feminine one, so the box is withheld and `fini` stays in the forms box.
    const fine = card(await render(db, "fine"), "fine, adjective");
    assert.doesNotMatch(fine, /Gender and number/);
    assert.match(
      fine,
      /Lexema shows no gender-and-number table: this entry files nothing under masculine plural, neither its own headword nor any form it lists\./,
    );
    assert.match(fine, exact(`${formItem}<span lang="it" data-form="0">fini</span>`));

    // An adjective is not a noun and not a verb, so it claims neither's
    // boxes — and no other part of speech picked up the adjective's.
    const grande = card(await render(db, "grande"), "grande, adjective");
    assert.doesNotMatch(grande, /Grouped conjugations/);
    assert.doesNotMatch(grande, /Articles<\/h3>/);
    assert.doesNotMatch(await render(db, "casa"), /Gender and number<\/h3>/);
    assert.doesNotMatch(await render(db, "parlare"), /Gender and number<\/h3>/);
  });
});

test("every reading shows its own source forms, not only the forms pointing at it", async () => {
  await withFixture(async ({ db }) => {
    const html = await render(db, "studente");
    // The noun's own table, which the page used to leave out entirely. It is
    // the singular-and-plural box now: every form `studente` lists is filed
    // under a number, so that table is where they render.
    assert.match(html, /Singular and plural<\/h3>/);
    assert.match(html, /<span lang="it" data-form="\d+">studenti<\/span>/);
    // And the other direction, which is a different fact about the same word.
    assert.match(html, /Forms pointing here<\/h3>/);
    // A form no table places still has its own box, named for the rest.
    assert.match(await render(db, "fine"), /Forms listed by this entry<\/h3>/);
    assert.match(await render(db, "grande"), /Other forms listed by this entry<\/h3>/);

    // A verb's table renders as its own grouped conjugation, with the source's
    // silences kept: no mood is stated anywhere in this release.
    const parlare = await render(db, "parlare");
    assert.match(parlare, exact(`<h4 class="${CONJUGATION_TENSE}">present</h4>`));
    assert.match(parlare, /<span lang="it" data-form="\d+">parlavo<\/span>/);
    assert.match(
      parlare,
      /Auxiliary named by the source: <span><span lang="it" data-form="\d+">avere<\/span>/,
    );
    // The conjugation group is the only place those forms sit now, so a raw
    // tag no group heading states is said there: `parlerei` carries `io`.
    assert.equal(occurrencesOf(parlare, '<q lang="it">io</q>'), 1);
  });
});

test("Italian is marked as Italian, and the interface is not", async () => {
  await withFixture(async ({ db }) => {
    for (const query of ["casa", "bello", "zzzznothing"]) {
      const html = await render(db, query);
      // The document is English (see the layout assertion below), so every
      // Italian string has to say so where it sits.
      assert.doesNotMatch(html, /lang="en"/, `${query}: nothing re-declares English`);
      assert.match(html, /<input [^>]*lang="it"/, `${query}: the search box takes Italian`);
    }

    const found = await render(db, "città");
    assert.match(
      found,
      exact(`<h2 class="${HEADWORD}"><span lang="it" data-headword="">città</span>`),
    );
    assert.match(
      found,
      exact(`<p lang="it" class="${GLOSS}">centro abitato di grandi dimensioni</p>`),
    );

    // The one thing this test cannot render: the layout imports globals.css,
    // which Node cannot load. The document language is asserted on the file.
    const layout = await readFile(join(REPO, "web/app/layout.tsx"), "utf8");
    assert.match(layout, /<html lang="en">/);
  });
});

test("the page has the labels, headings and landmarks a keyboard reader needs", async () => {
  await withFixture(async ({ db }) => {
    const html = await render(db, "sale");
    // Counted by element and by role, so nothing depends on how a part is
    // classed: one `<main>`, no second element claiming that role, one `<h1>`,
    // and one search form.
    assert.equal(elementsOf(html, "main"), 1, "exactly one main landmark");
    assert.equal(occurrencesOf(html, 'role="main"'), 0, "no second element claims the main role");
    assert.equal(elementsOf(html, "h1"), 1, "exactly one first-level heading");
    assert.equal(occurrencesOf(html, 'role="search"'), 1, "exactly one search landmark");
    // The one of each carries the class string the page ships, which is the
    // separate fact that the restyle reached it.
    assert.equal(occurrencesOf(html, `<main class="${SHELL_TOP}">`), 1);
    assert.equal(occurrencesOf(html, `<h1 class="${SITE_NAME}">`), 1);
    assert.match(
      html,
      exact(`<form class="${SEARCH_FORM}" role="search" action="/" method="get">`),
    );
    assert.match(html, exact(`<label class="${SEARCH_LABEL}" for="q">Italian word</label>`));
    assert.match(
      html,
      new RegExp(`<input class="${esc(SEARCH_INPUT)}" id="q" type="search"[^>]* name="q"`),
    );
    assert.match(html, exact(`<button class="${SEARCH_BUTTON}" type="submit">Search</button>`));
    // One card, one heading, and every section under it is labelled by its own.
    // The total is counted by element; the classed count says they are the same
    // headings.
    assert.equal(elementsOf(html, "h2"), cards(html));
    assert.equal(occurrencesOf(html, `<h2 class="${HEADWORD}">`), cards(html));
    assert.match(
      html,
      new RegExp(`<section class="${esc(BOX)}" aria-labelledby="numbers-\\d+">`),
    );
    assert.match(html, new RegExp(`<h3 class="${esc(BOX_HEADING)}" id="numbers-\\d+">`));
    // And the unplaced box is labelled by its own heading the same way.
    const unplaced = await render(db, "fine");
    assert.match(
      unplaced,
      new RegExp(`<section class="${esc(BOX)}" aria-labelledby="forms-\\d+">`),
    );
    assert.match(unplaced, new RegExp(`<h3 class="${esc(BOX_HEADING)}" id="forms-\\d+">`));
    // The live regions that tell a screen reader something changed.
    assert.match(html, exact(`<p class="${COUNT}" role="status">`));

    const empty = await render(db, "zzzznothing");
    assert.match(empty, exact(`<p class="${EMPTY}" role="status">`));
    assert.match(empty, /Nothing in this release matches/);
  });
});

/**
 * Two states, one bar.
 *
 * "Before a query, the page is the search bar alone, centred on the screen with
 * the site name above it and nothing else competing. With a query, the bar sits
 * at the top and the results fill the page below it" — and "the same form serves
 * both states; the query stays in the URL so a result can be shared"
 * (design-system-manifest.md § "The page"). Both halves are read off the
 * rendered markup: which shell the page is in, and what order its parts come in.
 */
test("the bar is centred before a query and at the top with one, and it is the same form", async () => {
  const landing = renderToStaticMarkup(
    <SearchPage raw="">
      <FirstLoad />
    </SearchPage>,
  );

  // The centred shell, and the utilities that centre it.
  assert.match(landing, exact(`<main class="${SHELL_CENTRED}">`));
  for (const utility of ["mx-auto", "min-h-screen", "flex", "flex-col", "justify-center"]) {
    assert.ok(SHELL_CENTRED.split(" ").includes(utility), `the landing shell carries ${utility}`);
  }
  // The site name above the bar, and nothing but the hint under it.
  const name = landing.indexOf(">Lexema</h1>");
  const bar = landing.indexOf("<form");
  const hint = landing.indexOf("each shows a different kind of ambiguity");
  assert.ok(name < bar, "the site name is above the bar");
  assert.ok(bar < hint, "what FirstLoad says renders under the bar");
  assert.equal(cards(landing), 0, "nothing competes with the bar before a query");

  await withFixture(async ({ db }) => {
    const answered = await render(db, "casa");

    // The same bar, at the top of the page, with the results below it.
    assert.match(answered, exact(`<main class="${SHELL_TOP}">`));
    assert.ok(
      !SHELL_TOP.split(" ").includes("justify-center"),
      "the answered page does not centre its column",
    );
    assert.equal(occurrencesOf(answered, "<form"), 1, "one form, not a second route's");
    assert.match(
      answered,
      exact(`<form class="${SEARCH_FORM}" role="search" action="/" method="get">`),
    );
    assert.ok(
      answered.indexOf("<form") < answered.indexOf(`<article class="${CARD}"`),
      "the bar is above the results",
    );
    // The query is in the bar because it came from the URL, which is what makes
    // a result shareable: the form is a GET to the same route.
    assert.match(answered, exact('name="q" value="casa"'));
  });
});

test("a repeated query parameter is searched, not thrown on", async () => {
  // `?q=sale&q=casa` is a URL anyone can type, and the router hands a repeated
  // name back as an array. Reading it as a string made the page 500.
  assert.equal(firstQuery(["sale", "casa"]), "sale");
  assert.equal(firstQuery([]), "");
  assert.equal(firstQuery(undefined), "");
  assert.equal(firstQuery("sale"), "sale");

  await withFixture(async ({ db }) => {
    const html = await render(db, firstQuery(["sale", "casa"]));
    assert.match(html, /5 entries for <q lang="it">sale<\/q>/);
  });
});

test("renders the states that are not an answer: first load, loading, rejected, failed", async () => {
  const first = renderToStaticMarkup(
    <SearchPage raw="">
      <FirstLoad />
    </SearchPage>,
  );
  assert.match(first, /each shows a different kind of ambiguity/);

  // The Suspense fallback app/page.tsx streams while D1 is answering.
  const loading = renderToStaticMarkup(
    <SearchPage raw="sale">
      <Pending raw="sale" />
    </SearchPage>,
  );
  assert.match(
    loading,
    exact(`<p class="${PENDING}" role="status">Searching for <q lang="it">sale</q>`),
  );

  // A lookup that did not happen says so, and says nothing about why: the
  // database's own message is for the Worker's log, not for a reader.
  const failed = renderToStaticMarkup(
    <SearchPage raw="sale">
      <Outcome raw="sale" attempt={{ outcome: "failed" }} />
    </SearchPage>,
  );
  assert.match(failed, exact(`<p class="${ERROR}" role="alert">The lookup failed`));
  assert.doesNotMatch(failed, /release|D1|normalizer|SQLITE/i);
  // No release to name when nothing was read.
  assert.doesNotMatch(failed, exact(`<footer class="${RELEASE_FOOTER}">`));

  await withFixture(async ({ db }) => {
    const rejected = await render(db, "   ");
    assert.match(rejected, /Type a word to search for\./);

    const tooLong = await render(db, "a".repeat(200));
    assert.match(tooLong, /That is 200 characters\. The limit is 128\./);
  });
});

// The credit, as ADR 0009 has it: one small link per reading, no credit at all
// on the search page, and the whole of it on /attribution, reached from a
// footer on every page.

test("each reading credits its source with one link labelled Source, pointing where it did before", async () => {
  await withFixture(async ({ db }) => {
    const html = await render(db, "casa");
    assert.match(
      html,
      exact(
        `<a class="${LINK}" href="https://it.wiktionary.org/wiki/casa" rel="noreferrer" ` +
          `aria-label="Wiktionary page for casa, the source of this noun entry">Source</a>`,
      ),
    );
    // The link's visible text is the one word, and the old label is gone from
    // the text. It survives in the accessible name, which is where "Source"
    // repeated once per reading would otherwise say nothing about which
    // reading it belongs to.
    assert.doesNotMatch(html, /<a[^>]*>Wiktionary page for/);

    // A word with five readings gets five of them, each at its own href.
    const sale = await render(db, "sale");
    assert.equal(sale.split(">Source</a>").length - 1, cards(sale));
    assert.match(sale, /href="https:\/\/it\.wiktionary\.org\/wiki\/salire"[^>]*aria-label="Wiktionary page for salire, the source of this verb entry"/);
  });
});

test("the search page carries no credit line, no licence name and no contributor text", async () => {
  await withFixture(async ({ db }) => {
    for (const query of ["sale", "zzzznothing"]) {
      const html = await render(db, query);
      // The licence is named on /attribution and nowhere else. The fixture
      // release carries `CC-BY-SA-4.0` in its own row, so a page that still
      // read the column would show it here.
      assert.doesNotMatch(html, /CC.?BY.?SA/i, `${query}: no licence string`);
      assert.doesNotMatch(html, /kaikki|wiktextract/i, `${query}: no via-credit`);
      assert.doesNotMatch(html, /contributor|Wikimedia/i, `${query}: no contributor text`);
      assert.doesNotMatch(html, /example\.invalid/, `${query}: no link to the archive`);
      assert.doesNotMatch(html, /derived from Wiktionary/, `${query}: no credit prose`);
      // What stays is provenance: which release answered, so that the line
      // numbers and pointers on each card name something exact.
      assert.match(
        html,
        exact(
          `<footer class="${RELEASE_FOOTER}"><p class="${RELEASE_LINE}">Release ` +
            `<code>it-page-test</code></p></footer>`,
        ),
      );
    }

    // And the per-reading provenance under each card is untouched.
    const html = await render(db, "casa");
    assert.match(html, /· release line \d+/);
    assert.match(html, exact("<span> <code>/word</code></span>"));
  });
});

test("every page reaches the attribution page from the footer", async () => {
  const footer = renderToStaticMarkup(<SiteFooter />);
  assert.match(
    footer,
    new RegExp(
      `<footer class="${esc(SITE_FOOTER)}"><a class="${esc(LINK)}" href="/attribution">` +
        `[^<]+</a></footer>`,
    ),
  );

  // The layout itself cannot be rendered here — it imports globals.css, which
  // Node cannot load — so that it carries this footer is asserted on the file,
  // the way the document language above is.
  const layout = await readFile(join(REPO, "web/app/layout.tsx"), "utf8");
  assert.match(layout, /<SiteFooter \/>/);
  assert.match(layout, /import \{ SiteFooter \} from "\.\/SiteFooter";/);
});

/** The attribution page, over the release the fixture imported. */
async function attribution(db: DatabaseSync): Promise<string> {
  const release = await readRelease(fromNodeSqlite(db), RELEASE);
  assert.notEqual(release, undefined, "the fixture release must be readable");
  return renderToStaticMarkup(<Attribution release={release} />);
}

test("the attribution page carries the credit, the licence and the restructuring statement", async () => {
  await withFixture(async ({ db }) => {
    const html = await attribution(db);

    // The licence, linked, under the name the licence itself uses.
    assert.match(
      html,
      exact(
        `<a class="${LINK}" href="https://creativecommons.org/licenses/by-sa/4.0/" ` +
          `rel="noreferrer">Creative Commons Attribution-ShareAlike 4.0 International ` +
          `(CC BY-SA 4.0)</a>`,
      ),
    );
    // The credit: the contributors, and where their names are kept.
    assert.match(html, /written by Wiktionary’s contributors/);
    assert.match(html, /listed in the page history of that entry’s Wiktionary page/);
    assert.match(
      html,
      exact(
        `<a class="${LINK}" href="https://it.wiktionary.org/" rel="noreferrer">Italian Wiktionary</a>`,
      ),
    );
    assert.match(html, /kaikki\.org/);
    assert.match(html, /wiktextract/);
    // What Lexema did to the material, and what it did not do.
    assert.match(html, /Lexema modified this material/);
    assert.match(html, /extracted from wiki text and converted into a data structure/);
    assert.match(html, /The wording of the definitions was not rewritten and was not generated/);
  });
});

test("the attribution page states the release identity, and says which columns were not recorded", async () => {
  await withFixture(async ({ db }) => {
    const html = await attribution(db);
    const row = db
      .prepare("SELECT archive_sha256 AS sha FROM source_release WHERE release_id = ?")
      .get(RELEASE) as { sha: string };

    assert.match(html, exact(field("Release", `<code class="${CODE_IDENTITY}">it-page-test</code>`)));
    assert.match(
      html,
      exact(
        field(
          "Source file",
          `<a class="${LINK}" href="https://example.invalid/it-extract.jsonl.gz" rel="noreferrer">` +
            `<code class="${CODE_IDENTITY}">https://example.invalid/it-extract.jsonl.gz</code></a>`,
        ),
      ),
    );
    assert.match(
      html,
      exact(
        field(
          "SHA-256 of the downloaded file",
          `<code class="${CODE_IDENTITY}">${row.sha}</code>`,
        ),
      ),
    );
    // The two columns this import left NULL. Said in words, in place: never a
    // blank, and never a value nobody recorded.
    assert.match(
      html,
      exact(field("Downloaded at (UTC)", `<span class="${EMPTY}">not recorded</span>`)),
    );
    assert.match(
      html,
      exact(field("Upstream Wiktionary dump", `<span class="${EMPTY}">not recorded</span>`)),
    );
    // Counted on the element: a blank value is a blank whatever it is classed.
    assert.equal(patternsOf(html, /<dd[^>]*><\/dd>/), 0, "no field renders blank");

    // A release that cannot be read is a different answer from a release with
    // nothing in it, and the page gives it in words rather than as five gaps.
    const unread = renderToStaticMarkup(<Attribution release={undefined} />);
    assert.match(unread, /The release serving this site could not be read/);
    // And not one of the five rows is rendered in its place. Each is named by
    // its own label, matched on the element rather than on a class string, so a
    // row that comes back differently classed still fails this.
    for (const label of [
      "Release",
      "Source file",
      "Downloaded at (UTC)",
      "SHA-256 of the downloaded file",
      "Upstream Wiktionary dump",
    ]) {
      assert.doesNotMatch(unread, new RegExp(`<dt[^>]*>${esc(label)}</dt>`), label);
    }
    // Nor any value of theirs: the identity codes are what those rows carry.
    assert.doesNotMatch(unread, /<code[^>]*>/, "no release identity value is rendered");
  });
});

test("the attribution page shows every open field as open, with nothing guessed in it", async () => {
  await withFixture(async ({ db }) => {
    const html = await attribution(db);

    // The three the draft in docs/ATTRIBUTION_NOTICES.md leaves open, each
    // named as open and each saying what would settle it.
    assert.equal(html.split(`<span class="${OPEN_MARK}">— open</span>`).length - 1, 3);
    assert.match(
      html,
      exact(`The licence for Lexema’s own material <span class="${OPEN_MARK}">— open</span>`),
    );
    assert.match(html, /settled by the open decision recorded as §4/);
    assert.match(
      html,
      exact(`Pronunciation and audio <span class="${OPEN_MARK}">— open</span>`),
    );
    assert.match(html, /per-file review recorded as §5/);
    assert.match(
      html,
      exact(`The version of the extractor <span class="${OPEN_MARK}">— open</span>`),
    );
    assert.match(html, /version of wiktextract that produced this extraction is not recorded/);

    // Nothing filled in behind a reader's back: no placeholder survives from
    // the draft, and no licence is claimed for Lexema's own material.
    assert.doesNotMatch(html, /\{[a-zA-Z]+\}/, "no draft placeholder is published");
    assert.doesNotMatch(html, new RegExp(`Lexema’s own material[^<]*</dt><dd[^>]*>[^<]*CC`, "i"));
  });
});
