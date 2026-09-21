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
import { lookup } from "../../src/lookup/lookup.js";
import type { Attempt } from "../app/attempt.ts";
import { FirstLoad, Outcome, Pending, SearchPage } from "../app/SearchPage";
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
    // the source was asked for and did not give.
    expect: [
      /1 entry for/,
      /<q lang="it">casa<\/q>/,
      /casa \( approfondimento\) f sing/,
      /gender<\/dt><dd>not stated in the source/,
      /number<\/dt><dd>not stated in the source/,
      /Not available in the source: this entry lists no forms\./,
      // A noun, so the noun card: no number to tabulate, and no article
      // without a gender or a number for one to agree with.
      /this entry gives neither a singular nor a plural/,
      /No article is shown: an article agrees with gender and number, and the source states neither/,
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
      /<td><span lang="it">lo<\/span><\/td>/,
      /<td><span lang="it">uno<\/span><\/td>/,
      /<td><span lang="it">dello<\/span><\/td>/,
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
      /No article is shown: the source gives the number as invariable, which is neither singular nor plural/,
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
    const studente = await render(db, "studente");
    // Header: the part of speech, and both dimensions the source stated.
    assert.match(studente, /<h2><span lang="it">studente<\/span> <span class="pos">noun<\/span><\/h2>/);
    assert.match(studente, /<dt>gender<\/dt><dd>masculine<\/dd>/);
    assert.match(studente, /<dt>number<\/dt><dd>singular<\/dd>/);
    // The singular/plural table, with the headword under the record's own
    // number and each forms row under its own.
    assert.match(studente, /<h3 id="numbers-\d+">Singular and plural<\/h3><table class="numbers">/);
    assert.match(
      studente,
      /<th scope="row">plural<\/th><td><span><span lang="it">studenti<\/span>/,
    );
    // The gendered pair, exactly as the source spelled it: one string, marked
    // Italian, never split on the slash.
    assert.match(studente, /<span lang="it">studente\/studentessa<\/span>/);
    assert.doesNotMatch(studente, /<span lang="it">studentessa<\/span><\/td>/);
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
          `<th scope="row">${kind}</th><td><span lang="it">${article}</span></td>` +
            `<td><span lang="it">${article} studente</span></td>` +
            `<td class="muted"><code>lexema-deterministic</code> · <code>it-articles/v1</code></td>`,
        ),
        `${kind} article, labelled`,
      );
    }
    assert.match(studente, /Not from the source: Lexema derives these from the masculine singular/);

    // `città`: the source states a gender, and states the number as
    // `invariable`, which is neither singular nor plural.
    const citta = await render(db, "città");
    assert.match(citta, /<dt>gender<\/dt><dd>feminine<\/dd>/);
    assert.doesNotMatch(citta, /class="articles"/);
    assert.match(
      citta,
      /No article is shown: the source gives the number as invariable, which is neither singular nor plural/,
    );
    assert.match(citta, /this entry gives neither a singular nor a plural/);

    // `casa`: no tags at all, so both dimensions are visibly missing and the
    // withholding names both.
    const casa = await render(db, "casa");
    assert.match(casa, /<dt>gender<\/dt><dd>not stated in the source<\/dd>/);
    assert.match(casa, /<dt>number<\/dt><dd>not stated in the source<\/dd>/);
    assert.doesNotMatch(casa, /class="articles"/);
    assert.match(
      casa,
      /No article is shown: an article agrees with gender and number, and the source states neither for this entry/,
    );

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
 * word. The table appears in exactly one of them, and every other case says in
 * words why it does not.
 */
test("an adjective renders its own card: a paradigm when the source fills it, a reason when it does not", async () => {
  await withFixture(async ({ db }) => {
    // `bello`: masculine singular on the record, and three forms tagged for the
    // other three cells. All four are single words, so the table renders.
    const bello = await render(db, "bello");
    assert.match(bello, /<h2><span lang="it">bello<\/span> <span class="pos">adjective<\/span><\/h2>/);
    assert.match(bello, /<h3 id="paradigm-\d+">Gender and number<\/h3><table class="numbers">/);
    assert.match(
      bello,
      /<th scope="row">masculine<\/th><td><span lang="it">bello<\/span><\/td><td><span lang="it">belli<\/span><\/td>/,
    );
    assert.match(
      bello,
      /<th scope="row">feminine<\/th><td><span lang="it">bella<\/span><\/td><td><span lang="it">belle<\/span><\/td>/,
    );
    // No form is dropped: each of the three is in the list under the table too.
    for (const form of ["belli", "bella", "belle"]) {
      assert.match(bello, new RegExp(`<li><span lang="it">${form}</span>`), `${form} is listed`);
    }
    // Nothing in this entry carries a degree tag, so there is no row for one.
    assert.match(bello, /no form in this entry is tagged comparative or superlative/);
    assert.doesNotMatch(bello, /<th scope="row">superlative<\/th>/);

    // `bella`: the adjective card, and no table of its own — the record is
    // feminine singular and lists no forms, so three cells have nothing in
    // them. The `bello` card on the same page still has its table, which is
    // why this reads one card rather than the whole page.
    const bella = card(await render(db, "bella"), "bella, adjective");
    assert.match(bella, /<h2><span lang="it">bella<\/span> <span class="pos">adjective<\/span><\/h2>/);
    assert.match(
      bella,
      /No table is shown: a gender-and-number table needs a masculine singular, and this entry files nothing under one/,
    );
    assert.doesNotMatch(bella, /<table/);

    // `fine`: tagged masculine, feminine and singular, with one form under a
    // bare `plural`. Nothing says whether `fini` is the masculine plural or the
    // feminine one, so the table is withheld and `fini` stays in the list.
    const fine = await render(db, "fine");
    assert.match(fine, /<h2><span lang="it">fine<\/span> <span class="pos">adjective<\/span><\/h2>/);
    assert.doesNotMatch(fine, /class="numbers"/);
    assert.match(
      fine,
      /No table is shown: a gender-and-number table needs a masculine plural, and this entry files nothing under one — neither its own headword nor any form it lists\./,
    );
    assert.match(fine, /<li><span lang="it">fini<\/span>/);

    // `grande`: four single words fill the table, and the source's own degree
    // tags carry the odd strings. The superlative here is tagged masculine
    // singular too, so the masculine singular cell holds `grande` alone only
    // because a stated degree keeps a form out of the plain paradigm.
    const grande = await render(db, "grande");
    assert.match(
      grande,
      /<th scope="row">masculine<\/th><td><span lang="it">grande<\/span><\/td><td><span lang="it">grandi<\/span><\/td>/,
    );
    assert.doesNotMatch(grande, /No table is shown/);
    assert.match(
      grande,
      /<th scope="row">comparative<\/th><td><span><span lang="it">maggiore<\/span><\/span><\/td>/,
    );
    // Verbatim, newline and leading space included, and marked as source text —
    // never split into `grandissimo` and `massimo`.
    assert.match(
      grande,
      /<th scope="row">superlative<\/th><td><span><span lang="it">grandissimo\n massimo<\/span>/,
    );
    assert.match(
      grande,
      /<span lang="it">grandissimo\n massimo<\/span><span class="ambiguous"> · source text, not split into separate forms<\/span>/,
    );
    assert.doesNotMatch(grande, /<span lang="it">massimo<\/span>/);
    // Every entry the lookup returned is somewhere on the card.
    for (const form of ["grandi", "maggiore", "grandissimo\n massimo"]) {
      assert.ok(grande.includes(`<span lang="it">${form}</span>`), `${form} is rendered`);
    }

    // An adjective is not a noun and not a verb, so it claims neither's
    // sections — and no other part of speech picked up the adjective's.
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
    assert.match(html, /<section class="links" aria-labelledby="forms-\d+">/);
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
  // Nothing to attribute when nothing was read.
  assert.doesNotMatch(failed, /class="attribution"/);

  await withFixture(async ({ db }) => {
    const rejected = await render(db, "   ");
    assert.match(rejected, /Type a word to search for\./);

    const tooLong = await render(db, "a".repeat(200));
    assert.match(tooLong, /That is 200 characters\. The limit is 128\./);
  });
});
