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

const cards = (html: string): number => html.split('<article class="reading"').length - 1;
const mentions = (html: string): number => html.split('class="mention"').length - 1;

/** How many times a literal string occurs. Counting, never pattern-matching. */
const occurrencesOf = (html: string, needle: string): number => html.split(needle).length - 1;

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

/**
 * One card out of a page, by the label it announces itself with.
 *
 * A query answers with every record that matched, so "the page shows no table"
 * and "this record shows no table" are different claims — and it is the second
 * one an assertion about `bella` is making.
 */
function card(html: string, label: string): string {
  const open = html.indexOf(`<article class="reading" aria-label="${label}">`);
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
      /<p class="empty">The source states neither a gender nor a number and lists no forms for this entry\.<\/p>/,
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
      /<th scope="row">definite<\/th><td><span lang="it">lo<\/span>/,
      /<th scope="row">indefinite<\/th><td><span lang="it">uno<\/span>/,
      /<th scope="row">partitive<\/th><td><span lang="it">dello<\/span>/,
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
      /Auxiliary named by the source: <span><span lang="it">avere o essere<\/span>/,
    ],
  },
  {
    query: "andare", direct: 2, embedded: 0, cards: 2, mentions: 0,
    expect: [
      /2 entries for/,
      /Grouped conjugations<\/h3>/,
      /<h4>present<\/h4>/,
      /<h4>imperfect<\/h4>/,
      /<span lang="it">andavano<\/span>/,
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
    expect: [/2 entries for/, /<span lang="it">parlerei<\/span>/, /Appendice:Coniugazioni/],
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
      /<dt>gender<\/dt><dd>feminine/,
      /<dt>number<\/dt><dd>invariable/,
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
    assert.match(studente, /<h2><span lang="it">studente<\/span><\/h2><dl class="headline">/);
    assert.match(studente, /<dt>part of speech<\/dt><dd>noun<\/dd>/);
    assert.match(studente, /<dt>gender<\/dt><dd>masculine<\/dd>/);
    assert.match(studente, /<dt>number<\/dt><dd>singular<\/dd>/);
    // The bar is inside the header, which closes before the card's middle.
    assert.match(studente, /<header>.*<dl class="headline">.*<\/dl>.*<\/header>/s);

    const citta = card(await render(db, "città"), "città, noun");
    assert.match(citta, /<dt>gender<\/dt><dd>feminine<\/dd>/);
    assert.match(citta, /<dt>number<\/dt><dd>invariable<\/dd>/);

    // An adjective has a header bar too, and every gender the source tagged is
    // in it: `grande` is masculine *and* feminine.
    const grande = card(await render(db, "grande"), "grande, adjective");
    assert.match(grande, /<h2><span lang="it">grande<\/span><\/h2><dl class="headline">/);
    assert.match(grande, /<dt>part of speech<\/dt><dd>adjective<\/dd>/);
    assert.match(grande, /<dt>gender<\/dt><dd>masculine, feminine<\/dd>/);
    assert.match(grande, /<dt>number<\/dt><dd>singular<\/dd>/);

    const bello = card(await render(db, "bello"), "bello, adjective");
    assert.match(bello, /<dt>gender<\/dt><dd>masculine<\/dd>/);
    assert.match(bello, /<dt>number<\/dt><dd>singular<\/dd>/);
    const bella = card(await render(db, "bella"), "bella, adjective");
    assert.match(bella, /<dt>gender<\/dt><dd>feminine<\/dd>/);
    assert.match(bella, /<dt>number<\/dt><dd>singular<\/dd>/);
    const fine = card(await render(db, "fine"), "fine, adjective");
    assert.match(fine, /<dt>gender<\/dt><dd>masculine, feminine<\/dd>/);

    // `casa` states neither, so neither is a row — the silence line says it.
    const casa = card(await render(db, "casa"), "casa, noun");
    assert.match(casa, /<dl class="headline"><div><dt>part of speech<\/dt><dd>noun<\/dd><\/div><\/dl>/);
    assert.doesNotMatch(casa, /<dt>gender<\/dt>/);
    assert.doesNotMatch(casa, /<dt>number<\/dt>/);
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
    assert.match(studente, /<div class="box-row">/);
    // Every box on the card is inside that one row, and each has its heading.
    assert.equal(occurrencesOf(studente, '<div class="box-row">'), 1);
    assert.equal(occurrencesOf(studente, '<section class="box"'), 3);
    assert.equal(
      occurrencesOf(studente.slice(studente.indexOf('<div class="box-row">')), '<section class="box"'),
      3,
    );
    assert.match(studente, /<h3 id="numbers-\d+">Singular and plural<\/h3>/);
    assert.match(studente, /<h3 id="articles-\d+">Articles<\/h3>/);
    assert.match(studente, /<h3 id="forms-\d+">Forms listed by this entry<\/h3>/);
    // A row inside a box is a small English label and an Italian value.
    assert.match(
      section(studente, "Singular and plural"),
      /<th scope="row">plural<\/th><td><span><span lang="it">studenti<\/span>/,
    );
    assert.match(
      section(studente, "Articles"),
      /<th scope="row">definite<\/th><td><span lang="it">lo<\/span> <span class="muted"><span lang="it">lo studente<\/span><\/span><\/td>/,
    );
    // The gendered pair, exactly as the source spelled it: one string, marked
    // Italian, never split on the slash.
    assert.match(studente, /<span lang="it">studente\/studentessa<\/span>/);
    assert.doesNotMatch(studente, /<span lang="it">studentessa<\/span><\/td>/);
    // The derivation is said once, under the rows, rather than once per row.
    assert.equal(occurrencesOf(studente, "<code>it-articles/v1</code>"), 1);
    assert.match(studente, /Not from the source: Lexema derives these from the masculine singular/);

    // The adjective's paradigm and its degrees are boxes in the same row.
    const grande = card(await render(db, "grande"), "grande, adjective");
    assert.equal(occurrencesOf(grande, '<div class="box-row">'), 1);
    assert.equal(occurrencesOf(grande, '<section class="box"'), 3);
    assert.match(grande, /<h3 id="paradigm-\d+">Gender and number<\/h3>/);
    assert.match(grande, /<h3 id="degrees-\d+">Comparative and superlative<\/h3>/);
    const paradigm = section(grande, "Gender and number");
    assert.match(paradigm, /<th scope="row">masculine plural<\/th><td><span lang="it">grandi<\/span><\/td>/);
    assert.match(paradigm, /<th scope="row">feminine plural<\/th><td><span lang="it">grandi<\/span><\/td>/);
    const degrees = section(grande, "Comparative and superlative");
    assert.match(degrees, /<th scope="row">comparative<\/th><td><span><span lang="it">maggiore<\/span><\/span><\/td>/);
    // Verbatim, newline and leading space included, and marked as source text —
    // never split into `grandissimo` and `massimo`.
    assert.match(degrees, /<th scope="row">superlative<\/th><td><span><span lang="it">grandissimo\n massimo<\/span>/);
    assert.match(
      degrees,
      /<span lang="it">grandissimo\n massimo<\/span><span class="ambiguous"> · source text, not split into separate forms<\/span>/,
    );
    assert.doesNotMatch(grande, /<span lang="it">massimo<\/span>/);

    // `bella` files nothing under three cells and lists no forms, so it has no
    // box at all — and no empty row container standing in for one.
    const bella = card(await render(db, "bella"), "bella, adjective");
    assert.doesNotMatch(bella, /<div class="box-row">/);
    assert.doesNotMatch(bella, /<section class="box"/);
    assert.doesNotMatch(bella, /<table/);
    // The page it sits on still boxes the cards that have something to box,
    // and every one of those boxes is inside a row.
    const bellaPage = await render(db, "bella");
    assert.ok(occurrencesOf(bellaPage, '<section class="box"') > 0);
    assert.doesNotMatch(bellaPage, /<\/div><section class="box"/);

    // `bello` fills all four cells, so the paradigm box renders.
    const bello = card(await render(db, "bello"), "bello, adjective");
    assert.match(section(bello, "Gender and number"), /<th scope="row">masculine singular<\/th>/);
    assert.match(section(bello, "Gender and number"), /<th scope="row">feminine plural<\/th><td><span lang="it">belle<\/span><\/td>/);
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
    // One sentence, and one `class="empty"` paragraph on the whole card.
    assert.equal(occurrencesOf(casa, '<p class="empty">'), 1);
    assert.equal(occurrencesOf(casa, 'class="empty"'), 1);
    assert.match(
      casa,
      /<p class="empty">The source states neither a gender nor a number and lists no forms for this entry\.<\/p>/,
    );
    // It is above the senses list, where a reader meets it first.
    assert.ok(
      casa.indexOf('<p class="empty">') < casa.indexOf('<ol class="definitions">'),
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
    assert.equal(occurrencesOf(citta, '<p class="empty">'), 1);
    assert.match(
      citta,
      /<p class="empty">The source lists no forms for this entry\. Lexema derives no article: the source gives the number as invariable, which is neither singular nor plural\.<\/p>/,
    );
    assert.doesNotMatch(citta, /Singular and plural/);
    assert.doesNotMatch(citta, /Articles<\/h3>/);

    // `fine` withholds its table and tags no degree, and says both once.
    const fine = card(await render(db, "fine"), "fine, adjective");
    assert.equal(occurrencesOf(fine, '<p class="empty">'), 1);
    assert.match(
      fine,
      /<p class="empty">The source tags no comparative or superlative for this entry\. Lexema shows no gender-and-number table: this entry files nothing under masculine plural, neither its own headword nor any form it lists\.<\/p>/,
    );
    assert.doesNotMatch(fine, /Comparative and superlative/);
    assert.doesNotMatch(fine, /Gender and number/);

    const bella = card(await render(db, "bella"), "bella, adjective");
    assert.equal(occurrencesOf(bella, '<p class="empty">'), 1);
    assert.match(bella, /The source tags no comparative or superlative and lists no forms for this entry\./);
    assert.match(bella, /Lexema shows no gender-and-number table: this entry files nothing under masculine singular/);

    // A card with nothing missing carries no silence line at all.
    const studente = card(await render(db, "studente"), "studente, noun");
    assert.doesNotMatch(studente, /class="empty"/);
    const grande = card(await render(db, "grande"), "grande, adjective");
    assert.doesNotMatch(grande, /class="empty"/);

    // `bello` fills its paradigm and lists forms; only the degrees are absent.
    const bello = card(await render(db, "bello"), "bello, adjective");
    assert.equal(occurrencesOf(bello, '<p class="empty">'), 1);
    assert.match(bello, /<p class="empty">The source tags no comparative or superlative for this entry\.<\/p>/);
  });
});

/** A fact the source stated once is rendered once. */
test("no fact renders twice on a card", async () => {
  await withFixture(async ({ db }) => {
    // `pl.: case` is a sense label and an unclassified claim read from one
    // pointer, `/senses/0/raw_tags/0`. It is the entry's one real fact.
    const casa = card(await render(db, "casa"), "casa, noun");
    assert.equal(occurrencesOf(casa, "pl.: case"), 1);
    assert.match(casa, /<p class="labels"><span class="label"><span lang="it">pl\.: case<\/span><\/span><\/p>/);
    assert.doesNotMatch(casa, /claim-unclassified/);

    const studente = card(await render(db, "studente"), "studente, noun");
    assert.equal(occurrencesOf(studente, "scuola"), 1);

    // Gender and number are in the header bar, so the record's own grammar is
    // not listed again as chips under it. What stays is a *form's* grammar,
    // which is a different fact about a different spelling.
    assert.doesNotMatch(studente, /aria-label="other grammar for studente"/);
    assert.match(studente, /aria-label="grammar for studenti"/);
    const grande = card(await render(db, "grande"), "grande, adjective");
    assert.doesNotMatch(grande, /aria-label="other grammar for grande"/);
    assert.equal(occurrencesOf(grande, "<dt>part of speech</dt>"), 1);
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
      /<a href="\/\?q=casetta" lang="it">casetta<\/a> <span class="muted">\(noun\)<\/span> — declares itself a form of <span lang="it">casa<\/span>, in 2 of its senses<\/li>/,
    );
    // One sense, no count clause: `case` reads as it did before the collapse.
    assert.match(
      pointing,
      /<a href="\/\?q=case" lang="it">case<\/a> <span class="muted">\(noun\)<\/span> — declares itself a form of <span lang="it">casa<\/span><\/li>/,
    );

    // The reverse ambiguity survives the collapse: one row per record, and the
    // record's own candidate set still says the edge named a word.
    const bello = card(await render(db, "bello"), "bello, adjective");
    assert.match(bello, /3 entries share that spelling/);
    assert.match(bello, /The source does not say\s+which of them this form belongs to/);
  });
});

/** Layout never drops a form: every `forms[]` entry is somewhere on the card. */
test("every form the source listed still renders, counted against the lookup's own answer", async () => {
  await withFixture(async ({ db }) => {
    for (const [query, word, pos] of [
      ["studente", "studente", "noun"],
      ["grande", "grande", "adj"],
      ["fine", "fine", "adj"],
      ["bella", "bella", "adj"],
    ] as const) {
      const reading = await readingFor(db, query, word, pos);
      const label = `${word}, ${pos === "adj" ? "adjective" : pos}`;
      const html = card(await render(db, query), label);

      // Every entry is rendered, and the forms box lists exactly as many rows
      // as the lookup returned — so a form no box reaches fails here.
      let rendered = 0;
      for (const form of reading.forms) {
        if (html.includes(`<span lang="it">${form.surface}</span>`)) rendered += 1;
      }
      assert.equal(rendered, reading.forms.length, `${query}: every form is on the card`);

      if (reading.forms.length === 0) {
        assert.doesNotMatch(html, /Forms listed by this entry/, `${query}: no empty forms box`);
        continue;
      }
      const forms = section(html, "Forms listed by this entry");
      assert.equal(
        occurrencesOf(forms, "<li>"),
        reading.forms.length,
        `${query}: one row per forms[] entry`,
      );
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
    // cells are marked, and the forms box marks it too.
    const grande = card(await render(db, "grandi"), "grande, adjective");
    const paradigm = section(grande, "Gender and number");
    assert.equal(occurrencesOf(paradigm, '<span class="searched">'), 2);
    assert.match(
      paradigm,
      /<th scope="row">masculine plural<\/th><td><span class="searched"><span lang="it">grandi<\/span><span class="muted"> · the form you searched<\/span><\/span><\/td>/,
    );
    // Nothing that is not the query is marked.
    assert.match(paradigm, /<th scope="row">masculine singular<\/th><td><span lang="it">grande<\/span><\/td>/);

    // `fine` shows no paradigm, so `fini` is marked in the box it does sit in.
    const fine = card(await render(db, "fini"), "fine, adjective");
    assert.match(
      section(fine, "Forms listed by this entry"),
      /<li><span class="searched"><span lang="it">fini<\/span><span class="muted"> · the form you searched<\/span><\/span>/,
    );

    // `casa` renders no box, so its own card marks nothing and invents none.
    const casa = card(await render(db, "casa"), "casa, noun");
    assert.doesNotMatch(casa, /class="searched"/);
    assert.doesNotMatch(casa, /<section class="box"/);

    // `bella` is a form of `bello`, and `bello` files it under feminine
    // singular — so the mark lands on the card that has the cell, and on the
    // `bella` card, which has no box, nothing is marked.
    const page = await render(db, "bella");
    assert.match(
      section(card(page, "bello, adjective"), "Gender and number"),
      /<th scope="row">feminine singular<\/th><td><span class="searched"><span lang="it">bella<\/span>/,
    );
    assert.doesNotMatch(card(page, "bella, adjective"), /class="searched"/);
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
        new RegExp(
          `<th scope="row">${kind}</th><td><span lang="it">${article}</span> ` +
            `<span class="muted"><span lang="it">${article} studente</span></span></td>`,
        ),
        `${kind} article, labelled`,
      );
    }

    // `città`: the source states a gender, and states the number as
    // `invariable`, which is neither singular nor plural — so no articles box,
    // and the reason is in the card's one silence line.
    const citta = card(await render(db, "città"), "città, noun");
    assert.doesNotMatch(citta, /class="articles"/);
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
    assert.match(paradigm, /<th scope="row">masculine plural<\/th><td><span lang="it">belli<\/span><\/td>/);
    assert.match(paradigm, /<th scope="row">feminine singular<\/th><td><span lang="it">bella<\/span><\/td>/);
    // No form is dropped: each of the three is in the forms box too.
    for (const form of ["belli", "bella", "belle"]) {
      assert.match(bello, new RegExp(`<li><span lang="it">${form}</span>`), `${form} is listed`);
    }
    // Nothing in this entry carries a degree tag, so there is no box for one.
    assert.doesNotMatch(bello, /Comparative and superlative/);
    assert.doesNotMatch(bello, /<th scope="row">superlative<\/th>/);

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
    assert.match(fine, /<li><span lang="it">fini<\/span>/);

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
    // The noun's own table, which the page used to leave out entirely.
    assert.match(html, /Forms listed by this entry<\/h3>/);
    assert.match(html, /<span lang="it">studenti<\/span>/);
    // And the other direction, which is a different fact about the same word.
    assert.match(html, /Forms pointing here<\/h3>/);

    // A verb's table renders as its own grouped conjugation, with the source's
    // silences kept: no mood is stated anywhere in this release.
    const parlare = await render(db, "parlare");
    assert.match(parlare, /<h4>present<\/h4>/);
    assert.match(parlare, /<span lang="it">parlavo<\/span>/);
    assert.match(parlare, /Auxiliary named by the source: <span><span lang="it">avere<\/span>/);
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
    assert.match(found, /<h2><span lang="it">città<\/span>/);
    assert.match(found, /<p lang="it" class="gloss">centro abitato di grandi dimensioni<\/p>/);

    // The one thing this test cannot render: the layout imports globals.css,
    // which Node cannot load. The document language is asserted on the file.
    const layout = await readFile(join(REPO, "web/app/layout.tsx"), "utf8");
    assert.match(layout, /<html lang="en">/);
  });
});

test("the page has the labels, headings and landmarks a keyboard reader needs", async () => {
  await withFixture(async ({ db }) => {
    const html = await render(db, "sale");
    assert.equal(html.split("<main>").length - 1, 1, "exactly one main landmark");
    assert.equal(html.split("<h1>").length - 1, 1, "exactly one first-level heading");
    assert.match(html, /<form role="search" action="\/" method="get">/);
    assert.match(html, /<label for="q">Italian word<\/label>/);
    assert.match(html, /<input id="q" type="search"[^>]* name="q"/);
    assert.match(html, /<button type="submit">Search<\/button>/);
    // One card, one heading, and every section under it is labelled by its own.
    assert.equal(html.split("<h2>").length - 1, cards(html));
    assert.match(html, /<section class="box" aria-labelledby="forms-\d+">/);
    assert.match(html, /<h3 id="forms-\d+">/);
    // The live regions that tell a screen reader something changed.
    assert.match(html, /<p class="count" role="status">/);

    const empty = await render(db, "zzzznothing");
    assert.match(empty, /<p class="empty" role="status">/);
    assert.match(empty, /Nothing in this release matches/);
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
  assert.match(loading, /<p class="pending" role="status">Searching for <q lang="it">sale<\/q>/);

  // A lookup that did not happen says so, and says nothing about why: the
  // database's own message is for the Worker's log, not for a reader.
  const failed = renderToStaticMarkup(
    <SearchPage raw="sale">
      <Outcome raw="sale" attempt={{ outcome: "failed" }} />
    </SearchPage>,
  );
  assert.match(failed, /<p class="error" role="alert">The lookup failed/);
  assert.doesNotMatch(failed, /release|D1|normalizer|SQLITE/i);
  // No release to name when nothing was read.
  assert.doesNotMatch(failed, /class="release"/);

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
      /<a href="https:\/\/it\.wiktionary\.org\/wiki\/casa" rel="noreferrer" aria-label="Wiktionary page for casa, the source of this noun entry">Source<\/a>/,
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
      assert.match(html, /<footer class="release"><p>Release <code>it-page-test<\/code><\/p><\/footer>/);
    }

    // And the per-reading provenance under each card is untouched.
    const html = await render(db, "casa");
    assert.match(html, /· release line \d+/);
    assert.match(html, /<span class="pointer"> <code>\/word<\/code><\/span>/);
  });
});

test("every page reaches the attribution page from the footer", async () => {
  const footer = renderToStaticMarkup(<SiteFooter />);
  assert.match(footer, /<footer class="site-footer"><a href="\/attribution">[^<]+<\/a><\/footer>/);

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
      /<a href="https:\/\/creativecommons\.org\/licenses\/by-sa\/4\.0\/" rel="noreferrer">Creative Commons Attribution-ShareAlike 4\.0 International \(CC BY-SA 4\.0\)<\/a>/,
    );
    // The credit: the contributors, and where their names are kept.
    assert.match(html, /written by Wiktionary’s contributors/);
    assert.match(html, /listed in the page history of that entry’s Wiktionary page/);
    assert.match(html, /<a href="https:\/\/it\.wiktionary\.org\/" rel="noreferrer">Italian Wiktionary<\/a>/);
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

    assert.match(html, /<dt>Release<\/dt><dd><code>it-page-test<\/code><\/dd>/);
    assert.match(
      html,
      /<dt>Source file<\/dt><dd><a href="https:\/\/example\.invalid\/it-extract\.jsonl\.gz" rel="noreferrer"><code>https:\/\/example\.invalid\/it-extract\.jsonl\.gz<\/code><\/a><\/dd>/,
    );
    assert.match(
      html,
      new RegExp(`<dt>SHA-256 of the downloaded file</dt><dd><code>${row.sha}</code></dd>`),
    );
    // The two columns this import left NULL. Said in words, in place: never a
    // blank, and never a value nobody recorded.
    assert.match(
      html,
      /<dt>Downloaded at \(UTC\)<\/dt><dd><span class="empty">not recorded<\/span><\/dd>/,
    );
    assert.match(
      html,
      /<dt>Upstream Wiktionary dump<\/dt><dd><span class="empty">not recorded<\/span><\/dd>/,
    );
    assert.equal(html.split("<dd></dd>").length - 1, 0, "no field renders blank");

    // A release that cannot be read is a different answer from a release with
    // nothing in it, and the page gives it in words rather than as five gaps.
    const unread = renderToStaticMarkup(<Attribution release={undefined} />);
    assert.match(unread, /The release serving this site could not be read/);
    assert.doesNotMatch(unread, /class="release-identity"/);
  });
});

test("the attribution page shows every open field as open, with nothing guessed in it", async () => {
  await withFixture(async ({ db }) => {
    const html = await attribution(db);

    // The three the draft in docs/ATTRIBUTION_NOTICES.md leaves open, each
    // named as open and each saying what would settle it.
    assert.equal(html.split('<span class="ambiguous">— open</span>').length - 1, 3);
    assert.match(
      html,
      /The licence for Lexema’s own material <span class="ambiguous">— open<\/span>/,
    );
    assert.match(html, /settled by the open decision recorded as §4/);
    assert.match(html, /Pronunciation and audio <span class="ambiguous">— open<\/span>/);
    assert.match(html, /per-file review recorded as §5/);
    assert.match(html, /The version of the extractor <span class="ambiguous">— open<\/span>/);
    assert.match(html, /version of wiktextract that produced this extraction is not recorded/);

    // Nothing filled in behind a reader's back: no placeholder survives from
    // the draft, and no licence is claimed for Lexema's own material.
    assert.doesNotMatch(html, /\{[a-zA-Z]+\}/, "no draft placeholder is published");
    assert.doesNotMatch(html, /Lexema’s own material[^<]*<\/dt><dd>[^<]*CC/i);
  });
});
