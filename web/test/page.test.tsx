// The search page, rendered.
//
// Two archives are seeded here exactly as the development seed seeds D1,
// the real `lookup` answers each query, and the real components render the
// answer to HTML — no D1, no browser, so it runs in CI.
//
// - `fixtures/dev-seed.jsonl` is the fifty-word development fixture: real
//   archive lines for every word Huey's design frames draw (casa, andare,
//   andavano, bello, sale, studente). The page's shape is asserted against it,
//   so a count here is a count of the real record, never a number copied from
//   a frame.
// - `web/test/fixture.ts` is a small synthetic archive for the edge cases the
//   real words do not all reach: a verb auxiliary written as source text, a
//   tense cycle the source leaves without a pronoun, and the attribution page.
//
// What this cannot cover is the wiring in app/(lexema)/page.tsx: reaching D1 needs
// `cloudflare:workers`, which exists only inside workerd.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { renderToStaticMarkup } from "react-dom/server";
import { seedSql } from "../../src/import/seedSql.js";
import type { CuratedCorrection } from "../../src/italian/curatedCorrections.js";
import { atFixtureLines, correctionFixtureLines } from "../../test/correctionFixture.js";
import { loadFixturePages, rawPageSource, type RawPageSource } from "../../src/source/rawPage.js";
import { PUBLISHED_ARCHIVE_SHA256, sourceOf, type ArchiveFacts, type ReleaseSource } from "../../src/source/archiveFacts.js";
import { fromNodeSqlite } from "../../src/lookup/database.js";
import type { Reading, SourceRef } from "../../src/lookup/types.js";
import type { Attempt } from "@/lib/dictionary/attempt.ts";
import { searchAttempt } from "@/lib/dictionary/searchAttempt.ts";
import { Attribution } from "@/components/dictionary/Attribution";
import { FirstLoad, Limited, Outcome, SearchPage, TRY_WORDS } from "@/components/dictionary/SearchPage";
import { SiteFooter } from "@/components/dictionary/SiteFooter";
import { ORIGIN } from "@/worker/hosts.ts";
import { SiteHeader } from "@/components/dictionary/SiteHeader";
import { readingChoiceLabel } from "@/components/dictionary/ReportDialog";
import { reportReadings } from "@/lib/dictionary/report.ts";
import { NotFound } from "@/components/dictionary/NotFound";
import { PhraseView } from "@/components/dictionary/Phrase";
import { phrasePage } from "@/lib/dictionary/phrasePage.ts";
import { EXPRESSION_FILTER_ABOVE, matchesExpression, wordPage } from "@/lib/dictionary/wordPage.ts";
import { firstQuery, pageTitle } from "@/lib/dictionary/params";
// The class strings the components carry, imported rather than copied, so a
// restyle that changes one changes both together.
import {
  CODE_IDENTITY,
  DEFINITION,
  DEFINITION_EXTRA,
  DEFINITION_NUMBER_CLOSED,
  DEFINITION_NUMBER_OPEN,
  EMPTY,
  EXPRESSION_FILTER,
  EXPRESSION_LINK,
  EXPRESSION_MEANING,
  EXPRESSION_PHRASE,
  EXPRESSION_ROW,
  EXPRESSION_ROW_EXTRA,
  EXPRESSIONS_MORE,
  ERROR,
  EXAMPLE_EXTRA,
  FIELD_LABEL,
  FIELD_VALUE,
  GLOSS_LINK,
  JUMP_LINK,
  LINK,
  NON_FINITE_LABEL_SEARCHED,
  NOT_FOUND_HEADING,
  NOT_FOUND_LINK,
  OPEN_MARK,
  PERSON_SEARCHED,
  READING,
  SHELL_CENTRED,
  SHELL_TOP,
  SITE_FOOTER_LINK,
  SOURCE_LINE,
  SITE_FOOTER_NAME,
  TENSE_HEAD_SEARCHED,
  TOP_BAR,
  WORD_HEADING,
  WORD_LINK,
  WORD_NOTE,
} from "@/components/shared/styles.ts";
import { FIXTURE_LINES } from "./fixture.js";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const RELEASE = "it-page-test";
/** The served version's token a page hands its search field. */
const VERSION = `${RELEASE}.0`;

interface Fixture {
  dir: string;
  db: DatabaseSync;
}

async function fixture(
  lines: readonly string[],
  rawPages?: RawPageSource,
  facts?: ArchiveFacts,
  corrections?: readonly CuratedCorrection[],
): Promise<Fixture> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-page-"));
  const archive = join(dir, "fixture.jsonl.gz");
  const outputDir = join(dir, "sql");
  const bytes = gzipSync(Buffer.from(`${lines.join("\n")}\n`, "utf8"));
  await writeFile(archive, bytes);
  const { parts } = await seedSql({
    input: archive,
    outputDir,
    schema: join(REPO, "src/db/schema.sql"),
    releaseId: RELEASE,
    archiveR2Key: `releases/${RELEASE}.jsonl.gz`,
    // Facts, when a test gives them, are keyed by this archive's own checksum,
    // exactly as the committed ones are keyed by the July archive's.
    archiveFacts:
      facts === undefined ? undefined : { [createHash("sha256").update(bytes).digest("hex")]: facts },
    license: "CC-BY-SA-4.0",
    rawPages,
    corrections,
    onRejection: (rejection) => {
      throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
    },
  });
  const db = new DatabaseSync(":memory:");
  for (const part of parts) db.exec(await readFile(part, "utf8"));
  // No review comes from Lexema: the seed writes no `claim_review` row (#117).
  assert.deepEqual({ ...db.prepare("SELECT count(*) AS n FROM claim_review").get() }, { n: 0 });
  return { dir, db };
}

async function withLines(
  lines: readonly string[],
  run: (f: Fixture) => Promise<void>,
  rawPages?: RawPageSource,
  facts?: ArchiveFacts,
  corrections?: readonly CuratedCorrection[],
): Promise<void> {
  const f = await fixture(lines, rawPages, facts, corrections);
  try {
    await run(f);
  } finally {
    f.db.close();
    await rm(f.dir, { recursive: true, force: true });
  }
}

/** The synthetic archive in `fixture.ts`. */
const withFixture = (run: (f: Fixture) => Promise<void>) => withLines(FIXTURE_LINES, run);

/** The real development fixture, `fixtures/dev-seed.jsonl`. */
async function withDevSeed(run: (f: Fixture) => Promise<void>): Promise<void> {
  const text = await readFile(join(REPO, "fixtures/dev-seed.jsonl"), "utf8");
  return withLines(text.trim().split("\n"), run);
}

/**
 * The development fixture seeded the way `pnpm run seed:dev` seeds it: with the
 * raw pages under `fixtures/`, so records like `casa` carry the recovered layer.
 */
async function withDevSeedAndPages(run: (f: Fixture) => Promise<void>): Promise<void> {
  const text = await readFile(join(REPO, "fixtures/dev-seed.jsonl"), "utf8");
  return withLines(text.trim().split("\n"), run, await loadFixturePages(join(REPO, "fixtures")));
}

async function attempt(db: DatabaseSync, query: string): Promise<Attempt> {
  return searchAttempt(fromNodeSqlite(db), RELEASE, query);
}

/** The whole page, as the Worker would send it for `?q=<query>`. */
async function render(db: DatabaseSync, query: string): Promise<string> {
  const answer = await attempt(db, query);
  return renderToStaticMarkup(
    <SearchPage raw={query} version={VERSION}>
      <Outcome raw={query} attempt={answer} />
    </SearchPage>,
  );
}

type ArchiveReading = Reading & { recordId: number; ref: SourceRef };

function archiveReadings(readings: readonly Reading[]): [ArchiveReading, ...ArchiveReading[]] {
  const narrowed = readings.map((reading) => {
    assert.ok(reading.recordId !== undefined, "existing archive fixture remains record-backed");
    return reading;
  });
  const [first, ...rest] = narrowed;
  assert.ok(first);
  return [first, ...rest];
}

async function readingsFor(db: DatabaseSync, query: string): Promise<[ArchiveReading, ...ArchiveReading[]]> {
  const answer = await attempt(db, query);
  assert.equal(answer.outcome, "found", `${query}: expected a found answer`);
  if (answer.outcome !== "found") throw new Error("unreachable");
  return archiveReadings(answer.readings);
}

/** How many times a literal string occurs. Counting, never pattern-matching. */
const occurrencesOf = (html: string, needle: string): number => html.split(needle).length - 1;

/** How many times a pattern occurs, counted over the whole markup. */
const patternsOf = (html: string, pattern: RegExp): number =>
  html.match(new RegExp(pattern, "g"))?.length ?? 0;

/** The words of some markup, with the tags taken out. */
const textOf = (html: string): string => html.replace(/<[^>]*>/g, "").replace(/&#x27;/g, "'").replace(/&quot;/g, '"');

const esc = (literal: string): string => literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const exact = (literal: string): RegExp => new RegExp(esc(literal));

/** One row of the attribution page's release identity. */
const field = (label: string, value: string): string =>
  `<dt class="${FIELD_LABEL}">${label}</dt><dd class="${FIELD_VALUE}">${value}</dd>`;

/** Each reading of a page, in the order the page rendered them. */
function readingsOfPage(html: string): string[] {
  return html
    .split(`<article class="${READING}"`)
    .slice(1)
    .map((part) => part.slice(0, part.indexOf("</article>")));
}

/** The headings of a page's readings, as text: `1·Sostantivo`. */
const headingsOf = (html: string): string[] =>
  [...html.matchAll(/<h2 class="[^"]*" id="reading-heading-\d+">(.*?)<\/h2>/g)].map((match) => textOf(match[1]));

/** One reading out of a page, by the record it renders. */
function readingById(html: string, recordId: number): string {
  const open = html.search(new RegExp(`<article class="${esc(READING)}" id="reading-${recordId}"`));
  assert.notEqual(open, -1, `no reading for record ${recordId}`);
  return html.slice(open, html.indexOf("</article>", open));
}

/** A reading by its 1-based place on the page. */
const nth = (html: string, n: number): string => readingsOfPage(html)[n - 1];

/** One mood's panel out of some markup. */
function panel(html: string, mood: string): string {
  const open = html.search(new RegExp(`<div [^>]*data-mood="${mood}"`));
  assert.notEqual(open, -1, `no ${mood} panel`);
  const next = html.slice(open + 1).search(/<div [^>]*data-mood="/);
  return next === -1 ? html.slice(open) : html.slice(open, open + 1 + next);
}

/** The words of a grid, row by row: `maschile | bello il bello un bello | belli …`. */
function gridRows(html: string): string[][] {
  const grid = html.slice(html.indexOf('data-grid=""'));
  return [...grid.matchAll(/<div role="row" class="contents">(.*?)(?=<div role="row"|<\/div><\/section>|<\/div><p |$)/g)].map(
    (row) => [...row[1].matchAll(/<(?:span|div) class="[^"]*" role="(?:rowheader|cell|columnheader)"[^>]*>(.*?)<\/(?:span|div)>(?=<(?:span|div) class="[^"]*" role=|<\/div>|$)/g)].map((cell) => textOf(cell[1]).trim()),
  );
}

/** Every form link in some markup: its text and where it points. */
const formLinks = (html: string): { text: string; href: string; searched: boolean }[] =>
  [...html.matchAll(/<a class="[^"]*" href="([^"]+)" lang="it" data-form="[\d ]+"( data-searched="")?>([^<]+)<\/a>/g)].map((match) => ({
    href: textOf(match[1]),
    searched: match[2] !== undefined,
    text: textOf(match[3]),
  }));

// The design's words, from their real records ----------------------------------

test("every record the lookup returns is a reading, headed by its number and its own pos_title", async () => {
  await withDevSeed(async ({ db }) => {
    const expected: Record<string, string[]> = {
      // After a grid reading's part of speech, the gender and number its
      // record states, and never on a verb or a Voce verbale. casa states
      // them only in its gloss stamp `f sing` (#317).
      casa: ["1·Sostantivo·femminile, singolare"],
      andare: ["1·Sostantivo·maschile", "2·Verbo"],
      andavano: ["1·Voce verbale"],
      bello: [
        "1·Aggettivo·maschile, singolare",
        "2·Sostantivo·maschile, invariabile",
        "3·Sostantivo·maschile, singolare",
        "4·Aggettivo, forma flessa·femminile, singolare",
      ],
      sale: ["1·Sostantivo·maschile, singolare", "2·Sostantivo, forma flessa·femminile, plurale", "3·Voce verbale"],
    };
    for (const [query, headings] of Object.entries(expected)) {
      const html = await render(db, query);
      const readings = await readingsFor(db, query);
      assert.deepEqual(headingsOf(html), headings, query);
      // Nothing the lookup returned is dropped: every record is a reading.
      assert.deepEqual(
        wordPage(query, readings).readings.map((entry) => entry.reading.recordId).sort((a, b) => { assert.ok(a !== undefined && b !== undefined); return a - b; }),
        readings.map((reading) => reading.recordId).sort((a, b) => a - b),
        query,
      );
      assert.equal(patternsOf(html, /<h1[\s>]/), 1, `${query}: one h1`);
    }
  });
});

test("jump links appear from three readings up, one per reading, and never below", async () => {
  await withDevSeed(async ({ db }) => {
    const bello = await render(db, "bello");
    const jumps = [...bello.matchAll(new RegExp(`<a class="${esc(JUMP_LINK)}" href="#reading-(\\d+)">(.*?)</a>`, "g"))];
    assert.deepEqual(
      jumps.map((match) => textOf(match[2])),
      ["1Aggettivo", "2Sostantivo", "3Sostantivo", "4Aggettivo, forma flessa"],
    );
    for (const [, id] of jumps) assert.match(bello, new RegExp(`<article [^>]*id="reading-${id}"`));
    assert.doesNotMatch(await render(db, "andare"), /aria-label="Readings"/);
  });
});

test("the headword carries its IPA and no syllable breaks", async () => {
  await withDevSeed(async ({ db }) => {
    const andare = await render(db, "andare");
    assert.match(andare, /<h1 [^>]*lang="it">andare<\/h1><p class="[^"]*" aria-label="Pronunciation"><span>\/anˈda\.re\/<\/span><\/p>/);
    assert.doesNotMatch(andare, /Syllables|an·da·re/);
  });
});

test("casa shows the definitions its raw page states, with no mark for where they came from", async () => {
  await withDevSeedAndPages(async ({ db }) => {
    const casa = await render(db, "casa");
    const reading = nth(casa, 1);
    assert.equal(patternsOf(reading, /data-definition="/g), 7);
    assert.match(textOf(reading), /edificio costruito per essere utilizzato come abitazione/);
    // ADR 0016: no recovered mark, no revision link, no rule note, and the
    // two furniture glosses are not definitions.
    assert.doesNotMatch(casa, /recovered|oldid=|it-moods|it-articles|Not from the source/i);
    assert.doesNotMatch(textOf(reading), /\( citazioni\)|\( approfondimento\)/);
  });
  // Without the raw page, the furniture is all the record says, so it shows
  // rather than leaving the reading silent: as stored, its gender stamp moved
  // into the heading (#317).
  await withDevSeed(async ({ db }) => {
    const reading = nth(await render(db, "casa"), 1);
    assert.match(textOf(reading), /casa \( approfondimento\)/);
    assert.doesNotMatch(textOf(reading), /f sing/);
    assert.match(textOf(reading), /casa \( citazioni\)/);
  });
});

test("a noun or adjective's forms are a gender by number grid with its article lines, and a missing form is a dash", async () => {
  await withDevSeed(async ({ db }) => {
    const bello = await render(db, "bello");
    assert.deepEqual(gridRows(nth(bello, 1)), [
      ["", "singolare", "plurale"],
      ["maschile", "belloil bello·un bello", "bellii belli·dei belli"],
      ["femminile", "bellala bella·una bella", "bellele belle·delle belle"],
    ]);
    // `andare` the noun is masculine and states no number: its headword is the
    // singular, and the plural the source does not give is a dash, no note.
    const noun = nth(await render(db, "andare"), 1);
    assert.deepEqual(gridRows(noun), [
      ["", "singolare", "plurale"],
      ["maschile", "andarel'andare·un andare", "—"],
    ]);
    // A grid never marks the searched form.
    assert.doesNotMatch(bello, /data-searched/);
  });
});

test("casa takes its plural from `case`, which glosses itself plurale di casa, and never from the diminutive casetta (#145)", async () => {
  await withDevSeed(async ({ db }) => {
    // The real lines: `casa` lists no forms, `case` says "plurale di casa",
    // `casetta` says "diminutivo di casa". All three are in the dev seed.
    const casa = nth(await render(db, "casa"), 1);
    assert.deepEqual(gridRows(casa), [
      ["", "singolare", "plurale"],
      ["femminile", "casala casa·una casa", "casele case·delle case"],
    ]);
    assert.doesNotMatch(textOf(casa.slice(casa.indexOf('data-grid=""'))), /casett/);
    // The cell keeps where `case` came from: the declaring record's own line.
    const declaring = (await readingsFor(db, "case")).filter((reading) => reading.word === "case");
    assert.equal(declaring.length, 1);
    assert.match(casa, new RegExp(`<span data-line="${declaring[0].ref.lineNo}">case</span>`));
  });
});

test("a plural gloss that could mean two noun records of a word fills neither one's cell (#145)", async () => {
  // Whole lines of it-0c432803, fixtures/declared-plural.jsonl: `temi` says
  // "plurale di tema", `rose` "plurale di rosa" and `colli` "plurale di colle",
  // and each of those words is two noun records.
  const text = await readFile(join(REPO, "fixtures/declared-plural.jsonl"), "utf8");
  await withLines(text.trimEnd().split("\n"), async ({ db }) => {
    const head = ["", "singolare", "plurale"];
    // The masculine `tema` lists `temi` itself. The feminine one, "paura", lists no plural.
    const tema = await render(db, "tema");
    assert.deepEqual(headingsOf(tema).slice(0, 2), ["1·Sostantivo·maschile, singolare", "2·Sostantivo·femminile, singolare"]);
    assert.deepEqual(gridRows(nth(tema, 1)), [head, ["maschile", "temail tema·un tema", "temii temi·dei temi"]]);
    assert.deepEqual(gridRows(nth(tema, 2)), [head, ["femminile", "temala tema·una tema", "—"]]);
    // The feminine `rosa` lists `rose` itself. The masculine one, the colour, lists no plural.
    const rosa = await render(db, "rosa");
    assert.deepEqual(headingsOf(rosa), ["1·Sostantivo·femminile", "2·Sostantivo·maschile"]);
    assert.deepEqual(gridRows(nth(rosa, 1)), [head, ["femminile", "rosala rosa·una rosa", "rosele rose·delle rose"]]);
    assert.deepEqual(gridRows(nth(rosa, 2)), [head, ["maschile", "rosail rosa·un rosa", "—"]]);
    // The masculine `colle` lists `colli` itself. The form record, "plurale di colla", has no grid.
    const colle = await render(db, "colle");
    assert.deepEqual(headingsOf(colle), ["1·Sostantivo·maschile, singolare", "2·Sostantivo, forma flessa·femminile"]);
    assert.deepEqual(gridRows(nth(colle, 1)), [head, ["maschile", "colleil colle·un colle", "collii colli·dei colli"]]);
    assert.doesNotMatch(nth(colle, 2), /data-grid|colli/);
    // No cell on the three pages comes from a declaring record.
    assert.equal(occurrencesOf(tema + rosa + colle, "<span data-line="), 0);

    // `altruista` is an adjective and one noun, so its two plural records can
    // mean that noun alone, each in the gender its own tags state.
    const altruista = await render(db, "altruista");
    assert.deepEqual(headingsOf(altruista).slice(0, 2), ["1·Aggettivo·maschile e femminile, singolare", "2·Sostantivo·maschile"]);
    assert.deepEqual(gridRows(nth(altruista, 2)), [
      head,
      ["maschile", "altruistal'altruista·un altruista", "altruistigli altruisti·degli altruisti"],
      ["femminile", "—", "altruistele altruiste·delle altruiste"],
    ]);
  });
});

test("a searched noun or adjective form, headword or inflected, is found but never marked in its grid (#111)", async () => {
  await withDevSeed(async ({ db }) => {
    // The lookup still returns the inflected form's own reading; only the mark is withheld.
    const pages: Record<string, string[]> = {
      studente: ["1·Sostantivo·maschile, singolare", "2·Voce verbale", "3·Sostantivo, forma flessa·maschile, plurale", "4·Sostantivo, forma flessa·femminile, singolare"],
      studenti: ["1·Sostantivo, forma flessa·maschile, plurale", "2·Sostantivo, forma flessa·femminile, singolare"],
      bella: ["1·Aggettivo, forma flessa·femminile, singolare", "2·Sostantivo, forma flessa·femminile, singolare"],
    };
    for (const [query, headings] of Object.entries(pages)) {
      const html = await render(db, query);
      assert.deepEqual(headingsOf(html), headings, query);
      assert.ok(readingsOfPage(html).some((reading) => reading.includes('data-grid=""')), `${query} renders a grid`);
      assert.doesNotMatch(html, /data-searched|your search/, `${query}: a grid marks nothing`);
    }
  });
});

test("an adjective's superlatives are a second grid, labelled superlativo", async () => {
  await withDevSeed(async ({ db }) => {
    const bella = nth(await render(db, "bello"), 4);
    const superlative = textOf(bella.slice(bella.indexOf(">superlativo</p>")));
    assert.match(
      superlative,
      /^>superlativosingolarepluralemaschilebellissimoil bellissimo·un bellissimobellissimii bellissimi·dei bellissimifemminilebellissimala bellissima·una bellissimabellissimele bellissime·delle bellissime/,
    );
  });
});

test("a verb's conjugation: the non-finite line, four Italian mood tabs, persons down, every form a link", async () => {
  await withDevSeed(async ({ db }) => {
    const verb = nth(await render(db, "andare"), 2);
    const reading = (await readingsFor(db, "andare")).find((r) => r.pos === "verb");
    assert.ok(reading);
    assert.match(textOf(verb), /gerundioandando·participio presenteandante·participioandato·ausiliareessere/);
    const tabs = [...verb.matchAll(/<button [^>]*role="tab"[^>]*>([^<]+)<\/button>/g)];
    assert.deepEqual(tabs.map((match) => match[1]), ["Indicativo", "Congiuntivo", "Condizionale", "Imperativo"]);
    assert.match(tabs[0][0], /aria-selected="true"/, "Indicativo opens when no finite form was searched");

    const indicativo = panel(verb, "Indicativo");
    assert.deepEqual(
      [...indicativo.matchAll(/<th scope="row"[^>]*>([^<]+)<\/th>/g)].slice(0, 6).map((match) => match[1]),
      ["io", "tu", "lui, lei", "noi", "voi", "loro"],
    );
    assert.deepEqual(
      [...indicativo.matchAll(/<th scope="col"[^>]*>([^<]+)<\/th>/g)].map((match) => match[1]),
      ["presente", "imperfetto", "passato remoto", "futuro semplice", "passato prossimo", "trapassato prossimo", "trapassato remoto", "futuro anteriore"],
    );
    assert.match(textOf(panel(verb, "Congiuntivo")), /che lui, leivada/);

    // Every form the source gives is on the page, variants included, each a
    // link to its own search; nothing is marked, since none was searched.
    const links = formLinks(verb);
    const shown = new Set([...verb.matchAll(/data-form="(\d+)"/g)].map((match) => Number(match[1])));
    for (const form of reading.forms) assert.ok(shown.has(form.index), `form ${form.index} (${form.surface}) is shown`);
    for (const variant of ["vo", "annò", "anderò"]) assert.ok(links.some((link) => link.text === variant), variant);
    for (const link of links) assert.equal(link.href, `/?q=${encodeURIComponent(link.text)}`);
    assert.ok(links.every((link) => !link.searched));
    // Several spellings in one cell link each one.
    assert.match(textOf(panel(verb, "Imperativo")), /tuva', va, vai, non andare/);
    assert.equal(links.filter((link) => ["va'", "non andare"].includes(link.text)).length, 2);
  });
});

test("a searched verb form is marked where it sits, in its lemma's table opened on its mood: a cell, two cells, a non-finite form", async () => {
  await withDevSeed(async ({ db }) => {
    const html = await render(db, "andavano");
    const reading = nth(html, 1);
    // Its definition links to its lemma, and the lemma's table follows.
    assert.match(reading, /imperfetto indicativo di <a class="[^"]*" href="\/\?q=andare">andare<\/a>/);
    assert.match(textOf(reading), /Forms ofandare/);
    const indicativo = panel(reading, "Indicativo");
    assert.deepEqual(formLinks(reading).filter((link) => link.searched).map((link) => link.text), ["andavano"]);
    assert.match(indicativo, new RegExp(`<th scope="row" class="${esc(PERSON_SEARCHED)}" lang="it">loro</th>`));
    assert.match(indicativo, new RegExp(`<th scope="col" class="${esc(TENSE_HEAD_SEARCHED)}" lang="it">imperfetto</th>`));
    // Two pages' content is shown, and still one Source, to the searched word's page (#281).
    assert.deepEqual(
      [...html.matchAll(/href="https:\/\/it\.wiktionary\.org\/wiki\/([^"]+)" target="_blank"/g)].map((match) => match[1]),
      ["andavano"],
    );

    // One spelling in two cells marks both, and the tabs open on its mood.
    const andassi = await render(db, "andassi");
    const tabs = [...andassi.matchAll(/<button [^>]*role="tab"[^>]*>([^<]+)<\/button>/g)];
    assert.match(tabs.find((match) => match[1] === "Congiuntivo")?.[0] ?? "", /aria-selected="true"/);
    const congiuntivo = panel(andassi, "Congiuntivo");
    assert.deepEqual(formLinks(congiuntivo).filter((link) => link.searched).map((link) => link.text), ["andassi", "andassi"]);
    assert.equal(patternsOf(congiuntivo, new RegExp(esc(`class="${PERSON_SEARCHED}"`), "g")), 2);
  });
  await withDevSeed(async ({ db }) => {
    const html = await render(db, "andando");
    assert.deepEqual(formLinks(html).filter((link) => link.searched).map((link) => link.text), ["andando"]);
    assert.match(html, new RegExp(`<dt class="${esc(NON_FINITE_LABEL_SEARCHED)}" lang="it">gerundio</dt>`));
  });
});

test("a searched compound form opens the compound tenses; otherwise they wait behind + more", async () => {
  await withDevSeed(async ({ db }) => {
    const plain = nth(await render(db, "andavano"), 1);
    const closed = panel(plain, "Indicativo");
    // The compound tables are Base UI's collapsible panel, in the HTML while closed, and the control ends them.
    assert.match(closed, /<div data-closed="" hidden="" id="[^"]+"[^>]*><p class="[^"]*" lang="it">Tempi composti<\/p>/);
    assert.match(closed, /<button type="button"[^>]*aria-expanded="false"[^>]*><span [^>]*>\+ more<\/span><span [^>]*>less<\/span><\/button>/);
    assert.ok(closed.indexOf("Tempi composti") < closed.indexOf("+ more"), "the control ends the compound tables");
    assert.doesNotMatch(closed, /compound tenses/);
    const compound = await render(db, "sono andato");
    assert.match(panel(compound, "Indicativo"), /<button type="button" data-panel-open=""[^>]*aria-expanded="true"[^>]*><span [^>]*>\+ more/);
  });
});

test("etymology and synonyms come once after the readings: every synonym a search, then + more and no count", async () => {
  await withDevSeed(async ({ db }) => {
    const html = await render(db, "andare");
    const facts = html.slice(html.lastIndexOf("</article>"));
    assert.equal(patternsOf(html, />Etymology</g), 1);
    const synonyms = facts.slice(facts.indexOf('id="synonyms"'), facts.indexOf("</section>", facts.indexOf('id="synonyms"')));
    const words = [...synonyms.matchAll(new RegExp(`<a class="${esc(WORD_LINK)}" href="([^"]+)" lang="it">([^<]+)</a>`, "g"))];
    assert.equal(words.length, wordPage("andare", await readingsFor(db, "andare")).wordFacts.synonyms.length, "every synonym is in the document");
    for (const [, href, word] of words) assert.equal(href, `/?q=${encodeURIComponent(textOf(word))}`);
    // The one control, last in the list so it ends what shows, open or closed.
    assert.match(synonyms, /<li[^>]*><div class="[^"]*"><button type="button"[^>]*aria-controls="synonyms-words" aria-expanded="false"[^>]*><span class="[^"]*">\+ more<\/span><span class="[^"]*">less<\/span><\/button><\/div><\/li><\/ul>$/);
    // No count anywhere: not beside a label, not on a control.
    assert.doesNotMatch(textOf(html), /showing \d|\d+ more/);
  });
});

test("an identical spelling in one place shows once and keeps every entry: a grid cell, a conjugation slot", async () => {
  await withFixture(async ({ db }) => {
    // `studente` lists `studenti` as masculine plural and as bare plural; both
    // land in maschile plurale.
    const reading = nth(await render(db, "studente"), 1);
    assert.equal(patternsOf(reading, />studenti</g), 1);
    assert.match(reading, /<span data-form="0 1">studenti<\/span>/);
  });
  await withFixture(async ({ db }) => {
    const verb = nth(await render(db, "abbisognare"), 1);
    assert.equal(patternsOf(verb, />abbisognando<\/a>/g), 1);
    assert.match(verb, /data-form="0 7">abbisognando<\/a>/);
    assert.equal(patternsOf(verb, />abbisogno<\/a>/g), 1);
    assert.match(verb, /data-form="1 8">abbisogno<\/a>/);
  });
});

/** A reading's Definitions block, from its label to the end of its section. */
function definitionsBlock(reading: string): string {
  const at = reading.search(/id="definitions-\d+"/);
  assert.notEqual(at, -1, "no Definitions block");
  return reading.slice(at, reading.indexOf("</section>", at));
}

/**
 * What a Definitions block shows closed, as text: the first definition, less
 * the examples that wait for `+ more`. The other definitions and every
 * example after them are hidden by class until the control is open.
 */
function closedDefinitions(block: string): string {
  const firstEnd = block.indexOf(`<li class="${DEFINITION_EXTRA}"`);
  const first = block.slice(0, firstEnd === -1 ? block.indexOf("</ol>") : firstEnd);
  return textOf(first.replace(new RegExp(`<p class="${esc(EXAMPLE_EXTRA)}[^"]*">.*?</p>`, "g"), ""));
}

/** The one expand control, last in its block, so `less` ends what the open block shows. */
const MORE_LAST = /<div class="[^"]*"><button type="button"[^>]*aria-expanded="false"[^>]*><span class="[^"]*">\+ more<\/span><span class="[^"]*">less<\/span><\/button><\/div><\/div>$/;

test("closed, the first definition and its own first example; + more, last, opens every definition and example in order", async () => {
  await withDevSeed(async ({ db }) => {
    const readings = await readingsFor(db, "libro");
    const noun = readings.find((reading) => reading.pos === "noun");
    assert.ok(noun);
    const examples = noun.senses[0].examples.map((example) => example.text);
    assert.ok(examples.length > 2, "libro's first sense carries several examples");
    const block = definitionsBlock(readingById(await render(db, "libro"), noun.recordId));
    const closed = closedDefinitions(block);
    // Every example is in the document, in order; closed, only the first shows.
    const all = textOf(block);
    let at = -1;
    for (const text of examples) {
      assert.ok(all.indexOf(text) > at, `example in the page, in order: ${text}`);
      at = all.indexOf(text);
    }
    assert.ok(closed.includes(examples[0]));
    for (const text of examples.slice(1)) assert.ok(!closed.includes(text), `extra example starts hidden: ${text}`);
    assert.equal(patternsOf(block, /data-definition="/g), noun.senses.length, "every definition is in the document");
    assert.equal(patternsOf(block, /aria-expanded="/g), 1, "one control for the whole reading");
    assert.match(block, MORE_LAST);
    assert.doesNotMatch(textOf(block), /\d+ more|fewer/);

    // A single-definition reading still gets the control when its first
    // definition has more examples.
    const onlyDefinition = await renderChanged(db, "libro", (changed) => {
      const target = changed.find((reading) => reading.recordId === noun.recordId);
      assert.ok(target);
      target.senses.splice(1);
    });
    const only = definitionsBlock(readingById(onlyDefinition, noun.recordId));
    assert.equal(patternsOf(only, /data-definition="/g), 1);
    assert.match(only, MORE_LAST);

    // bello's first adjective sense has no example, so it shows none: no other
    // definition's example is borrowed, and no "from definition" label appears.
    // The third definition's example stays under the third.
    const bello = await readingsFor(db, "bello");
    const adjective = bello.find((r) => r.pos === "adj" && r.isAboutQuery);
    assert.ok(adjective);
    const third = adjective.senses[2].examples[0].text;
    const belloBlock = definitionsBlock(readingById(await render(db, "bello"), adjective.recordId));
    assert.ok(!closedDefinitions(belloBlock).includes(third), "not borrowed onto the first definition");
    const thirdDefinition = belloBlock.slice(belloBlock.indexOf('data-definition="3"'), belloBlock.indexOf('data-definition="4"'));
    assert.ok(textOf(thirdDefinition).includes(third), "reachable under its own definition");
    assert.doesNotMatch(belloBlock, /from definition/);
  });
  await withDevSeed(async ({ db }) => {
    const block = definitionsBlock(nth(await render(db, "andare"), 2));
    const closed = closedDefinitions(block);
    assert.match(closed, /muoversi da un luogo verso un altro luogo/);
    assert.match(closed, /ogni mattina devo andare a scuola/);
    assert.equal(patternsOf(block, /data-definition="/g), 5, "all five definitions are in the document");
    assert.match(block, MORE_LAST);

    // A reading with one definition and one example has no control.
    assert.doesNotMatch(definitionsBlock(nth(await render(db, "bello"), 3)), /aria-expanded|\+ more/);
  });
});

test("a lemma the release has is linked where the gloss names it, every one of them; one it has no entry for is not mentioned", async () => {
  await withFixture(async ({ db }) => {
    // Huey, 2026-09-27: a missing target is simply empty.
    const reading = nth(await render(db, "pigmento"), 1);
    assert.doesNotMatch(reading, /href="\/\?q=pigmentare"|no entry|not in this release/);
    assert.match(textOf(reading), /indicativo presente di pigmentare/);
    // A lemma the release has is linked in the gloss, and not said again.
    const andavano = nth(await render(db, "andavano"), 1);
    assert.match(andavano, /href="\/\?q=andare">andare<\/a>/);
    assert.doesNotMatch(andavano, /Form of/);
  });
  await withFixture(async ({ db }) => {
    const vadi = nth(await render(db, "vadi"), 1);
    assert.match(vadi, /forma antica di <a class="[^"]*" href="\/\?q=andare">andare<\/a>, come di <a class="[^"]*" href="\/\?q=salire">salire<\/a>/);
    assert.doesNotMatch(vadi, /Form of/);
  });
});

/** The definition lines of a page, as text, in page order. */
const definitionLines = (html: string): string[] =>
  [...html.matchAll(/<li class="[^"]*" data-definition="\d+">(.*?)<\/li>/g)].map((match) => textOf(match[1]).replace(/^(\d+\.)+/, ""));

/** The definition lines that show before `+ more` opens: a folded one carries `DEFINITION_EXTRA`. */
const closedLines = (html: string): string[] =>
  [...html.matchAll(new RegExp(`<li class="${esc(DEFINITION)}" data-definition="\\d+">(.*?)</li>`, "g"))].map((match) =>
    textOf(match[1]).replace(/^(\d+\.)+/, ""),
  );

/** The words of the Wiktionary pages a page's *Source* links name, in order. */
const sourcePages = (html: string): string[] =>
  [...html.matchAll(/aria-label="Wiktionary page for ([^,]+), the source of this page/g)].map((match) => textOf(match[1]));

/** A page's footer line: *Source* and *Report a mistake*. */
const sourceLine = (html: string): string => {
  const start = html.lastIndexOf(`<footer class="${SOURCE_LINE}">`);
  return html.slice(start, html.indexOf("</footer>", start));
};

test("an inflected expression opens a short page: its words, the expression's first meaning, then each form entry with the lemma swapped for the expression; the other meanings wait for + more", async () => {
  await withDevSeed(async ({ db }) => {
    // *andare via*'s meanings as its own page writes them, labels and examples included.
    const andareVia = [
      "(familiare) lasciare un luogo: un'abitazione, una città, un posto qualsiasi",
      "(figuratively) morire",
      "(familiare) con riferimento ad un amore, d'affetto e/o passionale, significa lasciarsi" +
        "\"Ne ricordo ancora la voce: ormai è andata via dal mio cuore\"",
    ];
    const tirareFuori = ["levare fuori", "(figuratively) far raccontare", "(figuratively) esplicitare il proprio parere"];
    for (const [query, heading, meanings, forms] of [
      ["vado via", "1·Voce verbale", andareVia, ["prima persona singolare del presente semplice indicativo di andare via"]],
      ["tiro fuori", "1·Voce verbale", tirareFuori, ["prima persona singolare dell'indicativo presente di tirare fuori"]],
      ["sono andati via", "1·Voce verbale", andareVia, ["participio passato plurale maschile di andare via"]],
      // `vada` is a congiuntivo and an imperativo: the meanings once, then every form entry.
      ["vada via", "1·Voce verbale", andareVia, [
        "prima persona congiuntivo presente di andare via",
        "seconda persona congiuntivo presente di andare via",
        "terza persona congiuntivo presente di andare via",
        "terza persona singolare dell'imperativo di andare via",
        "seconda persona singolare dell'imperativo di andare via",
      ]],
    ] as const) {
      const html = await render(db, query);
      assert.match(html, new RegExp(`<h1 class="${esc(WORD_HEADING)}" lang="it">${esc(query)}</h1>`), query);
      assert.deepEqual(headingsOf(html), [heading], query);
      assert.deepEqual(definitionLines(html), [...meanings, ...forms], query);
      // The expression in each form line is a link to its own entry.
      const phrase = query === "tiro fuori" ? "tirare fuori" : "andare via";
      assert.equal(
        occurrencesOf(html, `<a class="${GLOSS_LINK}" href="/?q=${encodeURIComponent(phrase)}" lang="it">${phrase}</a>`),
        forms.length,
        query,
      );
      // Closed, the first meaning, then the form lines, then the one `+ more`;
      // the other meanings are in the page, folded under the first.
      assert.deepEqual(closedLines(html), [meanings[0], ...forms], query);
      assert.equal(occurrencesOf(html, "+ more"), 1, query);
      assert.ok(html.indexOf("+ more") > html.lastIndexOf(forms[forms.length - 1]), query);
      // The first form line counts what shows: `2.` closed, after the folded meanings open.
      assert.match(
        html,
        new RegExp(`<span class="${esc(DEFINITION_NUMBER_CLOSED)}">2\\.</span><span class="${esc(DEFINITION_NUMBER_OPEN)}">${meanings.length + 1}\\.</span>`),
        query,
      );
      // Nothing else of either word: no forms, no pronunciation.
      assert.doesNotMatch(html, />Forms</, query);
      assert.doesNotMatch(html, /aria-label="Pronunciation"/, query);
      assert.doesNotMatch(html, /Form of/, query);
      // One *Source*, to the expression's page, never the searched word's.
      assert.deepEqual(sourcePages(html), [phrase], query);
      assert.match(textOf(html), /Source\s*·\s*Report a mistake/, query);
    }

    // One word with a form entry for each of two expressions: one reading,
    // each expression's meanings before its own line, and closed, each
    // expression's first meaning.
    const volto = await render(db, "volto le spalle");
    assert.deepEqual(headingsOf(volto), ["1·Voce verbale"]);
    assert.deepEqual(definitionLines(volto), [
      "particolrmente in un convegno, in un comitiva, non essere di fronte a qualcuno, ritenuto come comportamento disdicevole",
      "(figuratively) lasciare qualcuno senza il proprio sostegno",
      "prima persona singolare del presente di voltare le spalle",
      "correre via",
      "disinteressarsi in modo intenzionale",
      "participio passato maschile singolare di volgere le spalle",
    ]);
    assert.deepEqual(closedLines(volto), [
      "particolrmente in un convegno, in un comitiva, non essere di fronte a qualcuno, ritenuto come comportamento disdicevole",
      "prima persona singolare del presente di voltare le spalle",
      "correre via",
      "participio passato maschile singolare di volgere le spalle",
    ]);
    // Two expressions, and still one *Source* (#281): the first the page shows,
    // voltare le spalle, though the lookup found volgere le spalle first (#291).
    assert.ok(textOf(volto).indexOf("voltare le spalle") < textOf(volto).indexOf("volgere le spalle"));
    assert.deepEqual(sourcePages(volto), ["voltare le spalle"]);
    assert.match(sourceLine(volto), /href="https:\/\/it\.wiktionary\.org\/wiki\/voltare_le_spalle" target="_blank"/);

    // An expression with no gloss (#250) has no meanings to copy: only the form line shows.
    const abitudine = await render(db, "faccio l'abitudine");
    assert.deepEqual(headingsOf(abitudine), ["1·Voce verbale"]);
    assert.deepEqual(definitionLines(abitudine), ["prima persona singolare del presente semplice indicativo di fare l'abitudine"]);
    assert.deepEqual(sourcePages(abitudine), ["fare l'abitudine"]);
    // Nothing folded, so no `+ more`.
    assert.doesNotMatch(abitudine, /\+ more/);

    // A participle whose records name the verb only through its past
    // participle: `fatte` names `fatto`, `fare`'s. The meanings, then the
    // verb record's line; *Source* is *fare fuori*'s page. *fare fuori*'s second
    // sense is only the source's missing-definition placeholder, which no page
    // shows (#255).
    const fatte = await render(db, "hanno fatte fuori");
    assert.deepEqual(headingsOf(fatte), ["1·Voce verbale"]);
    assert.deepEqual(definitionLines(fatte), [
      "uccidere un individuo",
      "participio passato plurale femminile di fare fuori",
    ]);
    assert.deepEqual(closedLines(fatte), ["uccidere un individuo", "participio passato plurale femminile di fare fuori"]);
    assert.deepEqual(sourcePages(fatte), ["fare fuori"]);

    // A typo in one word of an expression offers the typed words corrected,
    // not the headword, and the offer opens their short page (Huey's hand
    // check of 2026-09-30).
    for (const [query, corrected] of [
      ["vadoo via", "vado via"],
      ["vado vja", "vado via"],
      ["tiro fuory", "tiro fuori"],
    ]) {
      const offer = await render(db, query);
      assert.match(offer, new RegExp(`No entry for “<span lang="it">${esc(query)}</span>”`), query);
      assert.match(
        offer,
        new RegExp(`Did you mean <a class="[^"]*" href="/\\?q=${esc(encodeURIComponent(corrected))}" lang="it">${esc(corrected)}</a>\\?`),
        query,
      );
      assert.match(await render(db, corrected), new RegExp(`<h1 class="${esc(WORD_HEADING)}" lang="it">${esc(corrected)}</h1>`), corrected);
    }

    // A sequence that is no headword is still no entry, and nearly spells none.
    const fuori = await render(db, "vado fuori");
    assert.match(fuori, /No entry for “<span lang="it">vado fuori<\/span>”/);
    assert.doesNotMatch(fuori, /Did you mean/);

    // One word misspelled: no entry, and the expression is offered.
    const fouri = textOf(await render(db, "tiro fouri"));
    assert.match(fouri, /No entry for “tiro fouri”/);
    assert.match(fouri, /Did you mean tiro fuori\?/);
    // `vadp` is one edit from `vada` and `vado`: each correction is offered.
    const vadp = await render(db, "vadp via");
    assert.match(vadp, /Did you mean <a class="[^"]*" href="\/\?q=vada%20via" lang="it">vada via<\/a>\?/);
    assert.match(textOf(vadp), /Other expressions\s*vado via/);

    // The headword searched as written is its own full entry, meanings and all.
    const plain = await render(db, "andare via");
    assert.match(plain, new RegExp(`<h1 class="${esc(WORD_HEADING)}" lang="it">andare via</h1>`));
    assert.deepEqual(headingsOf(plain), ["1·Espressione"]);
    assert.match(plain, /lasciare un luogo/);
  });
});

test("an expression no searched word has a form line for still shows its meanings and its Source", async () => {
  await withDevSeed(async ({ db }) => {
    // The lookup answer for `hanno fatte fuori`, with its form lines taken
    // away: the page a participle whose records never write the verb gets.
    const answer = await attempt(db, "hanno fatte fuori");
    assert.ok(answer.outcome === "found" && answer.route.kind === "phrase");
    const html = renderToStaticMarkup(
      <PhraseView page={phrasePage("hanno fatte fuori", { ...answer.route, forms: [] }, answer.readings)} />,
    );
    assert.match(html, new RegExp(`<h1 class="${esc(WORD_HEADING)}" lang="it">hanno fatte fuori</h1>`));
    // *fare fuori*'s own record, its meanings under *Definitions*.
    assert.deepEqual(headingsOf(html), ["1·Locuzione verbale"]);
    assert.match(html, />Definitions</);
    // Its second sense is only the missing-definition placeholder, so none shows (#255).
    assert.deepEqual(definitionLines(html), ["uccidere un individuo"]);
    // One meaning and no examples: nothing folds, as on any such reading.
    assert.deepEqual(closedLines(html), ["uccidere un individuo"]);
    assert.equal(occurrencesOf(html, "+ more"), 0);
    assert.deepEqual(sourcePages(html), ["fare fuori"]);
    assert.match(textOf(html), /Report a mistake/);
  });
});

test("identical lemma tables show once; tables that differ each show", async () => {
  await withFixture(async ({ db }) => {
    const chiusi = nth(await render(db, "chiusi"), 1);
    assert.equal(patternsOf(chiusi, />Forms of<span[^>]*>chiudere</g), 1);
    const punsi = nth(await render(db, "punsi"), 1);
    assert.equal(patternsOf(punsi, />Forms of<span[^>]*>pungere</g), 2);
    assert.match(textOf(punsi), /pungesti/);
    assert.match(textOf(punsi), /pungisti/);
  });
});

// Curated corrections (#420) ----------------------------------------------------

/** fixtures/curated-corrections.jsonl, seeded with the committed list keyed to its lines, or with none. */
async function withCorrectionLines(corrected: boolean, run: (f: Fixture) => Promise<void>): Promise<void> {
  const lines = await correctionFixtureLines();
  return withLines(lines, run, undefined, undefined, corrected ? atFixtureLines(lines, RELEASE) : []);
}

/** The grid of a page's first reading, keyed by the word searched. */
async function gridsOf(db: DatabaseSync, words: readonly string[]): Promise<Record<string, string[][]>> {
  return Object.fromEntries(await Promise.all(words.map(async (word) => [word, gridRows(nth(await render(db, word), 1))] as const)));
}

const HEAD = ["", "singolare", "plurale"];

test("the eight declared spellings the source states wrongly render in the cell their corrected gender and number name (#420)", async () => {
  await withCorrectionLines(true, async ({ db }) => {
    assert.deepEqual(
      await gridsOf(db, ["ammaliatore", "romantico", "sudafricano", "amorevolezza", "congiuntivo", "giocatrice", "maniaco", "predatrice"]),
      {
        // "plurale di ammaliatore", and its femminile singolare: never `le ammaliatrice`.
        ammaliatore: [HEAD, ["maschile", "ammaliatorel'ammaliatore·un ammaliatore", "—"], ["femminile", "ammaliatricel'ammaliatrice·un'ammaliatrice", "—"]],
        // The noun records of romantico and sudafricano state no gender, so their headword takes no cell.
        romantico: [HEAD, ["femminile", "romanticala romantica·una romantica", "—"]],
        sudafricano: [HEAD, ["femminile", "sudafricanala sudafricana·una sudafricana", "—"]],
        // Tagged masculine: never `gli amorevolezze`.
        amorevolezza: [HEAD, ["femminile", "amorevolezzal'amorevolezza·un'amorevolezza", "amorevolezzele amorevolezze·delle amorevolezze"]],
        // Tagged feminine singular: the maschile plurale.
        congiuntivo: [HEAD, ["maschile", "congiuntivoil congiuntivo·un congiuntivo", "congiuntivii congiuntivi·dei congiuntivi"]],
        giocatrice: [HEAD, ["femminile", "giocatricela giocatrice·una giocatrice", "giocatricile giocatrici·delle giocatrici"]],
        maniaco: [HEAD, ["maschile", "maniacoil maniaco·un maniaco", "maniacii maniaci·dei maniaci"]],
        predatrice: [HEAD, ["femminile", "—", "predatricile predatrici·delle predatrici"]],
      },
    );
    // A corrected record's own page says the corrected gender and number too.
    assert.deepEqual(headingsOf(await render(db, "congiuntivi")), ["1·Sostantivo, forma flessa·maschile, plurale"]);
    assert.deepEqual(gridRows(nth(await render(db, "maniaci"), 1))[1], ["maschile", "maniacoil maniaco·un maniaco", "maniacii maniaci·dei maniaci"]);
  });
});

test("a noun tagged with the wrong gender loses the row it made, and its plural stays where it was (#420)", async () => {
  const words = ["fissazione", "nozione", "fiaschetteria", "rimbalzo"];
  await withCorrectionLines(false, async ({ db }) => {
    // As the source states it: `il fissazione` in a maschile row of its own.
    assert.deepEqual((await gridsOf(db, words)).fissazione, [
      HEAD,
      ["maschile", "fissazioneil fissazione·un fissazione", "—"],
      ["femminile", "—", "fissazionile fissazioni·delle fissazioni"],
    ]);
  });
  await withCorrectionLines(true, async ({ db }) => {
    assert.deepEqual(await gridsOf(db, words), {
      fissazione: [HEAD, ["femminile", "fissazionela fissazione·una fissazione", "fissazionile fissazioni·delle fissazioni"]],
      nozione: [HEAD, ["femminile", "nozionela nozione·una nozione", "nozionile nozioni·delle nozioni"]],
      fiaschetteria: [HEAD, ["femminile", "fiaschetteriala fiaschetteria·una fiaschetteria", "fiaschetteriele fiaschetterie·delle fiaschetterie"]],
      rimbalzo: [HEAD, ["maschile", "rimbalzoil rimbalzo·un rimbalzo", "rimbalzii rimbalzi·dei rimbalzi"]],
    });
    assert.deepEqual(headingsOf(await render(db, "fissazione")), ["1·Sostantivo·femminile, singolare"]);
  });
});

test("a declared plural the source states rightly renders exactly as it did, and a correction leaves no mark on the page (#420)", async () => {
  const pages = async (corrected: boolean): Promise<Record<string, string>> => {
    let read: Record<string, string> = {};
    await withCorrectionLines(corrected, async ({ db }) => {
      read = Object.fromEntries(await Promise.all(["costruttrice", "fissazione", "ammaliatore"].map(async (word) => [word, await render(db, word)] as const)));
    });
    return read;
  };
  const [before, after] = [await pages(false), await pages(true)];
  // `costruttrici` says "plurale di costruttrice" and is right: nothing about the noun moves.
  // Only its own reading, which the page shows too, now says plural (#449).
  assert.deepEqual(readingsBesides(after.costruttrice, COSTRUTTRICI), readingsBesides(before.costruttrice, COSTRUTTRICI));
  assert.deepEqual(gridRows(nth(after.costruttrice, 1)), [HEAD, ["femminile", "—", "costruttricile costruttrici·delle costruttrici"]]);
  // The page shows the corrected fact as data, and nothing about the correction (ADR 0016).
  for (const page of Object.values(after)) {
    assert.doesNotMatch(page, /wiktionary\.org\/w\/index\.php|oldid|it-page-test:\d|corrett|corrected|correction/i);
  }
});

/** `costruttrici`'s record: its line in fixtures/curated-corrections.jsonl. */
const COSTRUTTRICI = 31;

/** A page's readings, but for the ones of these records. */
const readingsBesides = (html: string, ...recordIds: number[]): string[] =>
  readingsOfPage(html).filter((reading) => !recordIds.some((id) => reading.startsWith(` id="reading-${id}"`)));

test("a real plural tagged singular is plural on its own page, and its noun's page does not move (#449)", async () => {
  const plurals = ["costruttrici", "scolare", "curde", "anfitrioni", "mosse", "portatrici", "ricoverati", "scontente"];
  const nouns = ["costruttrice", "scolara", "curdo", "anfitrione", "portatrice", "mossa", "ricoverato", "scontento"];
  const pages = async (corrected: boolean): Promise<Record<string, string>> => {
    let read: Record<string, string> = {};
    await withCorrectionLines(corrected, async ({ db }) => {
      read = Object.fromEntries(await Promise.all([...plurals, ...nouns].map(async (word) => [word, await render(db, word)] as const)));
    });
    return read;
  };
  const [before, after] = [await pages(false), await pages(true)];
  // As the source states it: `la costruttrici`, in the singolare beside costruttrice.
  assert.deepEqual(gridRows(nth(before.costruttrici, 1))[2], ["femminile", "costruttricila costruttrici·una costruttricicostruttricela costruttrice·una costruttrice", "—"]);

  assert.deepEqual(gridRows(nth(after.costruttrici, 1)), [
    HEAD,
    ["maschile", "costruttoreil costruttore·un costruttore", "costruttorii costruttori·dei costruttori"],
    ["femminile", "costruttricela costruttrice·una costruttrice", "costruttricile costruttrici·delle costruttrici"],
  ]);
  assert.deepEqual(gridRows(nth(after.scolare, 1))[2], ["femminile", "scolarala scolara·una scolara", "scolarele scolare·delle scolare"]);
  assert.deepEqual(gridRows(nth(after.anfitrioni, 1))[1], ["maschile", "anfitrionel'anfitrione·un anfitrione", "anfitrionigli anfitrioni·degli anfitrioni"]);
  for (const word of plurals) {
    const own = nth(after[word], 1);
    assert.match(headingsOf(after[word])[0], /^1·Sostantivo, forma flessa·(maschile|femminile), plurale$/, word);
    // The word sits in no singolare cell of its own grid (`mosse` and `portatrici` list no forms, so take none).
    for (const row of gridRows(own).slice(1)) assert.ok(!row[1].startsWith(word), `${word}: ${row[1]}`);
    assert.doesNotMatch(after[word], /wiktionary\.org\/w\/index\.php|oldid|it-page-test:\d|corrett|corrected|correction/i);
  }

  // Each noun's own readings render exactly as before; only the plurals' own readings, when its page shows them, moved.
  const corrected = [8, 10, 25, 26, COSTRUTTRICI, 38, 39, 41];
  for (const noun of nouns) assert.deepEqual(readingsBesides(after[noun], ...corrected), readingsBesides(before[noun], ...corrected), noun);
});

test("a record that states both numbers fills both columns and names both in its heading; a proper name names neither", async () => {
  await withFixture(async ({ db }) => {
    const khmer = nth(await render(db, "khmer"), 1);
    assert.deepEqual(gridRows(khmer).map((row) => row.map((cell) => cell.split(/(?=il |un |i |dei |gli |degli )/)[0])), [
      ["", "singolare", "plurale"],
      ["maschile", "khmer", "khmer"],
    ]);
  });
  await withFixture(async ({ db }) => {
    assert.deepEqual(headingsOf(await render(db, "khmer")), ["1·Sostantivo·maschile, singolare e plurale"]);
    assert.deepEqual(headingsOf(await render(db, "Mercurio")), ["1·Nome proprio"]);
    // The grammar is muted and Italian, beside the part of speech, not inside it.
    assert.match(await render(db, "khmer"), /<span lang="it">Sostantivo<\/span><span class="[^"]*"><span class="[^"]*" aria-hidden="true">·<\/span><span class="[^"]*" lang="it">maschile, singolare e plurale<\/span><\/span><\/h2>/);
  });
});

/** The page for a query after `change` edits the readings the lookup returned. */
async function renderChanged(db: DatabaseSync, query: string, change: (readings: ArchiveReading[]) => void): Promise<string> {
  const answer = await attempt(db, query);
  assert.equal(answer.outcome, "found");
  if (answer.outcome !== "found") throw new Error("unreachable");
  change(archiveReadings(answer.readings));
  return renderToStaticMarkup(
    <SearchPage raw={query} version={VERSION}>
      <Outcome raw={query} attempt={answer} />
    </SearchPage>,
  );
}

const recoveredExample = (text: string, line: number) => ({
  text,
  ref: { wiki: "it.wiktionary.org", title: "x", revisionId: 1, line },
});

test("no example becomes unreachable: nested items', hidden furniture's and glossless senses' examples wait for + more", async () => {
  // No committed record carries either, so the lookup's own readings are
  // given one of each before the page renders them.
  await withLines(
    [
      ...(await readFile(join(REPO, "fixtures/dev-seed.jsonl"), "utf8")).trim().split("\n"),
      ...(await readFile(join(REPO, "fixtures/accollato.jsonl"), "utf8")).trim().split("\n"),
    ],
    async ({ db }) => {
      const html = await renderChanged(db, "accollato", (readings) => {
        const first = readings[0].senses[0];
        first.recoveredItems.push({
          text: "una voce annidata della prima definizione",
          labels: [],
          route: "lead-in-item",
          ref: { wiki: "it.wiktionary.org", title: "x", revisionId: 1, line: 9000 },
          examples: [recoveredExample("uno scudo accollato a un altro", 9001)],
          heldAsExample: null,
          items: [],
        });
      });
      const block = definitionsBlock(nth(html, 1));
      assert.doesNotMatch(closedDefinitions(block), /uno scudo accollato a un altro/);
      assert.match(closedDefinitions(block), /una voce annidata della prima definizione/, "the nested item itself shows");
      assert.match(textOf(block), /uno scudo accollato a un altro/);
      assert.match(block, MORE_LAST);
    },
    await loadFixturePages(join(REPO, "fixtures")),
  );
  await withDevSeedAndPages(async ({ db }) => {
    const html = await renderChanged(db, "casa", (readings) => {
      const citazioni = readings[0].senses.find((sense) => sense.glosses[0]?.text === "casa ( citazioni)");
      assert.ok(citazioni);
      citazioni.examples.push({ text: "la casa è dove si torna", ref: { ...citazioni.ref, jsonPointer: "/senses/1/examples/0" } });
    });
    const reading = nth(html, 1);
    assert.doesNotMatch(textOf(reading), /\( citazioni\)/, "the furniture gloss stays hidden");
    const block = definitionsBlock(reading);
    assert.doesNotMatch(closedDefinitions(block), /la casa è dove si torna/);
    assert.match(textOf(block), /la casa è dove si torna/, "its example waits for + more");
    assert.match(block, MORE_LAST);
  });
  await withDevSeed(async ({ db }) => {
    const noun = (await readingsFor(db, "libro")).find((reading) => reading.pos === "noun");
    assert.ok(noun);
    const html = await renderChanged(db, "libro", (readings) => {
      const target = readings.find((reading) => reading.recordId === noun.recordId);
      assert.ok(target);
      target.senses.push({
        index: 99,
        ref: { ...target.ref, jsonPointer: "/senses/99" },
        examples: [{ text: "un libro senza definizione", ref: { ...target.ref, jsonPointer: "/senses/99/examples/0/text" } }],
        glosses: [],
        labels: [],
        recoveredItems: [],
      });
    });
    const reading = readingById(html, noun.recordId);
    assert.equal(patternsOf(reading, /data-definition="/g), noun.senses.length, "no numbered line for it");
    assert.doesNotMatch(reading, /no definition|gives no/i);
    const block = definitionsBlock(reading);
    assert.doesNotMatch(closedDefinitions(block), /un libro senza definizione/);
    assert.match(textOf(block), /un libro senza definizione/);
  });
});

test("a meaning that only repeats the headword is not shown, and a reading left with none reads like any reading with none (#395)", async () => {
  const lines = (await readFile(join(REPO, "fixtures/headword-echo.jsonl"), "utf8")).trim().split("\n");
  await withLines(lines, async ({ db }) => {
    // presina's one gloss is `presina f`; with the stamp off it is the headword.
    const presina = await render(db, "presina");
    assert.deepEqual(headingsOf(presina), ["Sostantivo·femminile"], "no number: the reading has no definition");
    assert.deepEqual(definitionLines(presina), []);
    const reading = nth(presina, 1);
    assert.doesNotMatch(reading, /id="definitions-\d+"/, "no Definitions block");
    assert.doesNotMatch(textOf(reading), /no definition|gives no|mancante/i);

    // A meaning that names the headword stays.
    assert.deepEqual(definitionLines(await render(db, "sci")), [
      "lunga lamina, un tempo di legno e oggigiorno di metallo e plastica: agganciandone uno a ciascuno dei piedi mediante appositi scarponi e attacchi, viene adoperato come pattino per scivolare sulla neve",
      "sport associato all'attività di andare sugli sci",
    ]);
  });
});

/** The dev seed plus the real lines of the words `fixtures/word-facts-placement.jsonl` holds. */
async function withPlacementWords(run: (f: Fixture) => Promise<void>): Promise<void> {
  const lines = async (file: string) => (await readFile(join(REPO, file), "utf8")).trim().split("\n");
  return withLines([...(await lines("fixtures/dev-seed.jsonl")), ...(await lines("fixtures/word-facts-placement.jsonl"))], run);
}

/** The text of a reading's own Etymology block, or undefined when it has none. */
function readingEtymology(reading: string): string | undefined {
  const at = reading.indexOf('id="etymology-');
  if (at === -1) return undefined;
  // The text alone, without its one-line toggle's `+ more` / `less`.
  const section = reading.slice(reading.indexOf(">", at) + 1, reading.indexOf("</section>", at));
  return textOf(section.replace(/<button[^>]*aria-expanded[\s\S]*?<\/button>/g, ""));
}

/** The words of a Synonyms run, from a reading or from the facts after the readings. */
const synonymWords = (html: string, id: string): string[] => {
  const at = html.indexOf(`id="${id}"`);
  if (at === -1) return [];
  const section = html.slice(at, html.indexOf("</section>", at));
  return [...section.matchAll(new RegExp(`<a class="${esc(WORD_LINK)}" href="[^"]+" lang="it">([^<]+)</a>`, "g"))].map((match) => textOf(match[1]));
};

/** The page after the last reading: the facts no reading took. */
const afterReadings = (html: string): string => html.slice(html.lastIndexOf("</article>"));

test("an etymology moves to the one reading its label names, without the label; a label naming none or two stays once at the bottom", async () => {
  await withPlacementWords(async ({ db }) => {
    // sale: the singular noun gets the salt etymology, the plural noun form
    // (plural of sala) gets `vedi sala`; nothing is left for the bottom.
    const sale = await render(db, "sale");
    assert.match(readingEtymology(nth(sale, 1)) ?? "", /^Etymologyderivato dal greco/);
    assert.equal(readingEtymology(nth(sale, 2)), "Etymologyvedi sala");
    assert.equal(readingEtymology(nth(sale, 3)), undefined);
    assert.doesNotMatch(afterReadings(sale), />Etymology</);
    assert.doesNotMatch(sale, /\(sostantivo (singolare|plurale)\)/);

    // libero: (aggettivo) to the adjective, (voce verbale) to the verb form;
    // the noun reading has no etymology of its own.
    const libero = await render(db, "libero");
    assert.match(readingEtymology(nth(libero, 1)) ?? "", /^Etymologyderivato dal latino liber/);
    assert.equal(readingEtymology(nth(libero, 2)), undefined);
    assert.equal(readingEtymology(nth(libero, 3)), "Etymologyvedi liberare");

    // calcio: only (voce verbale) names a reading; the topic labels stay at
    // the bottom verbatim, with no note about them.
    const calcio = await render(db, "calcio");
    assert.equal(readingEtymology(nth(calcio, 3)), "Etymologyvedi calciare");
    const bottom = textOf(afterReadings(calcio));
    assert.match(bottom, /\(elemento chimico\) dal latino calx/);
    assert.match(bottom, /\(sport\) dalla somiglianza/);
    assert.doesNotMatch(bottom, /voce verbale|vedi calciare/);
    assert.doesNotMatch(bottom, /not matched|unmatched/i);

    // svolta: (aggettivo) and (sostantivo) each name one reading, but it has
    // two Voce verbale readings, so its two (voce verbale) etymologies could
    // be either and stay at the bottom rather than go to both.
    const svolta = await render(db, "svolta");
    const readings = await readingsFor(db, "svolta");
    const verbForms = readings.filter((reading) => reading.posTitle === "Voce verbale");
    assert.equal(verbForms.length, 2);
    for (const reading of verbForms) assert.equal(readingEtymology(readingById(svolta, reading.recordId)), undefined);
    const adjective = readings.find((reading) => reading.posTitle === "Aggettivo, forma flessa");
    assert.ok(adjective);
    assert.equal(readingEtymology(readingById(svolta, adjective.recordId)), "Etymologyvedi svolto");
    const svoltaBottom = textOf(afterReadings(svolta));
    assert.match(svoltaBottom, /\(voce verbale\) vedi svoltare/);
    assert.match(svoltaBottom, /\(voce verbale\) vedi svolgere/);

    // strutto: its only etymology, `(voce verbale)`, still names one reading.
    const strutto = await render(db, "strutto");
    const struttoVerb = (await readingsFor(db, "strutto")).find((reading) => reading.posTitle === "Voce verbale");
    assert.ok(struttoVerb);
    assert.equal(readingEtymology(readingById(strutto, struttoVerb.recordId)), "Etymologyvedi struggere");
    assert.doesNotMatch(afterReadings(strutto), />Etymology</);

    // sette: a bare `(sostantivo)` fits both the Sostantivo and the
    // Sostantivo, forma flessa reading, so it goes to neither.
    const sette = await render(db, "sette");
    for (const reading of await readingsFor(db, "sette")) {
      assert.doesNotMatch(readingEtymology(readingById(sette, reading.recordId)) ?? "", /plurale di setta/);
    }
    const setteReadings = await readingsFor(db, "sette");
    const numeral = setteReadings.find((reading) => reading.posTitle === "Aggettivo numerale");
    assert.ok(numeral);
    assert.equal(readingEtymology(readingById(sette, numeral.recordId)), "Etymologydal latino sĕptem");
    assert.match(textOf(afterReadings(sette)), /\(sostantivo\) plurale di setta/);

    // ori: `(sostantivo, forma flessa)` is a whole pos_title with a comma in
    // it, not the compound `sostantivo` + `forma flessa`, so it names the
    // Sostantivo, forma flessa reading; `(voce verbale)` names the verb form.
    const ori = await render(db, "ori");
    const oriReadings = await readingsFor(db, "ori");
    const inflectedNoun = oriReadings.find((reading) => reading.posTitle === "Sostantivo, forma flessa");
    const oriVerb = oriReadings.find((reading) => reading.posTitle === "Voce verbale");
    assert.ok(inflectedNoun && oriVerb);
    assert.equal(readingEtymology(readingById(ori, inflectedNoun.recordId)), "Etymologyvedi oro");
    assert.equal(readingEtymology(readingById(ori, oriVerb.recordId)), "Etymologyvedi orare");
    assert.doesNotMatch(afterReadings(ori), />Etymology</);
  });
  await withPlacementWords(async ({ db }) => {
    // medico: `(aggettivo e sostantivo)` names the Aggettivo and the
    // Sostantivo reading; it is not copied into both.
    const medico = await render(db, "medico");
    assert.doesNotMatch(medico, /id="etymology-\d+"/);
    assert.equal(patternsOf(medico, /\(aggettivo e sostantivo\)/g), 1);
    assert.match(textOf(afterReadings(medico)), /Etymology\(aggettivo e sostantivo\)/);

    // cazzi: each etymology is only a label naming one reading. Nothing is
    // left to say, so no reading has an empty Etymology block, and nothing
    // stays at the bottom.
    const cazzi = await render(db, "cazzi");
    assert.doesNotMatch(cazzi, /id="etymology-\d+"/);
    assert.doesNotMatch(cazzi, />Etymology</);

    // dai: `(voce verbale di dare)` names its head, voce verbale, despite the
    // words after it; `(contrazione di da e i)` names nothing and stays.
    const dai = await render(db, "dai");
    const daiVerb = (await readingsFor(db, "dai")).find((reading) => reading.posTitle === "Voce verbale");
    assert.ok(daiVerb);
    assert.equal(readingEtymology(readingById(dai, daiVerb.recordId)), "Etymologyvedi dare");
    assert.match(textOf(afterReadings(dai)), /\(contrazione di da e i\) deriva dalla fusione/);
  });
});

test("a synonym group labelled with one reading's part of speech goes to it; an ambiguous one stays at the bottom", async () => {
  await withDevSeed(async ({ db }) => {
    const html = await render(db, "vivere");
    const readings = await readingsFor(db, "vivere");
    const noun = readings.find((reading) => reading.pos === "noun");
    const verbs = readings.filter((reading) => reading.pos === "verb");
    assert.ok(noun && verbs.length === 2);
    const nounWords = synonymWords(readingById(html, noun.recordId), `synonyms-${noun.recordId}`);
    assert.equal(nounWords[0], "esistenza");
    assert.ok(!nounWords.includes("esistere"));
    // vivere has two Verbo readings, so the `verbo` group could be either:
    // it stays at the bottom, starting at its label, rather than go to both.
    for (const verb of verbs) {
      assert.deepEqual(synonymWords(readingById(html, verb.recordId), `synonyms-${verb.recordId}`), []);
    }
    const bottomWords = synonymWords(afterReadings(html), "synonyms");
    assert.ok(bottomWords.includes("esistere"));
    assert.ok(!bottomWords.includes("esistenza"), "the sostantivo group moved to its reading");
    // Every synonym is still on the page, in a reading or at the bottom.
    const shown = new Set([
      ...[noun, ...verbs].flatMap((reading) => synonymWords(readingById(html, reading.recordId), `synonyms-${reading.recordId}`)),
      ...synonymWords(afterReadings(html), "synonyms"),
    ]);
    for (const word of noun.wordFacts.synonyms) assert.ok(shown.has(word.word), word.word);

    // An unlabelled list stays once at the bottom.
    const andare = await render(db, "andare");
    assert.doesNotMatch(andare, /id="synonyms-\d+"/);
    assert.ok(synonymWords(afterReadings(andare), "synonyms").length > 0);
  });
});

test("a word with one reading keeps its etymology and synonyms after the reading", async () => {
  await withDevSeed(async ({ db }) => {
    const casa = await render(db, "casa");
    assert.doesNotMatch(casa, /id="etymology-\d+"|id="synonyms-\d+"/);
    assert.match(textOf(afterReadings(casa)), /Etymologydal latino casa/);
    assert.ok(synonymWords(afterReadings(casa), "synonyms").length > 0);
  });
});

test("casa's note fragments are the note the source wrote, in place and read-only; its words and derived list are unchanged (#120)", async () => {
  await withDevSeed(async ({ db }) => {
    const html = afterReadings(await render(db, "casa"));
    const readings = await readingsFor(db, "casa");
    const fragments = ["(per es. palazzo d'abitazione", "(per es. rurale", "industriale)"];
    const section = (id: string) => html.slice(html.indexOf(`id="${id}"`), html.indexOf("</section>", html.indexOf(`id="${id}"`)));
    const synonyms = section("synonyms");
    const links = synonymWords(html, "synonyms");

    for (const fragment of fragments) assert.ok(!links.includes(fragment), `${fragment} is not a search`);
    const notes = [...synonyms.matchAll(new RegExp(`<span class="${esc(WORD_NOTE)}" lang="it">([^<]+)</span>`, "g"))].map((m) => textOf(m[1]));
    assert.deepEqual(notes, ["(per es. palazzo d'abitazione", "(per es. rurale, civile, industriale)"]);
    // Each note sits where its first piece did: after the word before it.
    const order = textOf(synonyms);
    assert.ok(order.indexOf("edificio") < order.indexOf("(per es. palazzo") && order.indexOf("(per es. palazzo") < order.indexOf("scuola"));
    assert.ok(order.indexOf("fabbricato") < order.indexOf("(per es. rurale") && order.indexOf("(per es. rurale") < order.indexOf("dimora"));

    // Every other synonym is still a search, in order; `civile` is the note's.
    const expected = readings[0].wordFacts.synonyms.map((word) => word.word).filter((word) => ![...fragments, "civile"].includes(word));
    assert.deepEqual(links, expected);
    // An ordinary list does not change: every derived word is a search, and no note.
    assert.deepEqual(synonymWords(html, "derived"), readings[0].wordFacts.derived.map((word) => word.word));
    assert.doesNotMatch(section("derived"), new RegExp(esc(WORD_NOTE)));

    // The source record is unchanged: the lookup still carries each piece as imported.
    for (const fragment of fragments) assert.ok(readings[0].wordFacts.synonyms.some((word) => word.word === fragment), fragment);
  });
});

test("every word page ends with Source and Report a mistake together", async () => {
  await withDevSeed(async ({ db }) => {
    for (const query of ["casa", "andavano", "bello"]) {
      const source = (await render(db, query)).split("</article>").pop() ?? "";
      const line = source.slice(source.lastIndexOf("<footer"), source.indexOf("</footer>", source.lastIndexOf("<footer")));
      assert.match(textOf(line), /Source.*·.*Report a mistake$/, query);
      assert.match(line, /<button [^>]*>Report a mistake<\/button>/, `${query}: a button that opens the box`);
    }
  });
});

// The lookup's reads may change order and grouping (#385); the page they build
// may not. The snapshot is the whole page, one tag per line so a change reads
// as a diff. Regenerate it only for a change that means to alter the page:
// `--test-update-snapshots` on this file.
test("bello's whole page is the page the snapshot holds (#385)", async (t) => {
  await withDevSeedAndPages(async ({ db }) => {
    t.assert.snapshot((await render(db, "bello")).replaceAll("><", ">\n<"), { serializers: [(html) => html] });
  });
});

test("a result page has one Source, with no word after it, to the page of the spelling in its title (#281)", async () => {
  // macchina: a noun, and a form of macchinare whose table shows under it.
  // The page of macchina holds both entries, so one link covers both readings.
  const lines = (await readFile(join(REPO, "fixtures/macchina.jsonl"), "utf8")).trim().split("\n");
  await withLines(lines, async ({ db }) => {
    const html = await render(db, "macchina");
    assert.deepEqual(headingsOf(html), ["1·Sostantivo·femminile", "2·Voce verbale"]);
    assert.match(textOf(html), /Forms ofmacchinare/);
    const line = sourceLine(html);
    assert.equal(textOf(line), "Source·Report a mistake");
    assert.deepEqual(sourcePages(html), ["macchina"]);
    assert.equal(occurrencesOf(line, 'href="https://it.wiktionary.org/wiki/'), 1);
    assert.match(line, /href="https:\/\/it\.wiktionary\.org\/wiki\/macchina" target="_blank"/);
  });
  // A searched expression: the title is what was typed, and the one link is
  // the expression's page, as #214 built.
  await withDevSeed(async ({ db }) => {
    for (const [query, phrase] of [
      ["vado via", "andare_via"],
      ["tiro fuori", "tirare_fuori"],
    ]) {
      const line = sourceLine(await render(db, query));
      assert.equal(textOf(line), "Source·Report a mistake", query);
      assert.equal(occurrencesOf(line, 'href="https://it.wiktionary.org/wiki/'), 1, query);
      assert.match(line, new RegExp(`href="https://it\\.wiktionary\\.org/wiki/${phrase}" target="_blank"`), query);
    }
  });
});

test("an etymology shows one cut line and a + more that opens the whole text in place", async () => {
  await withDevSeed(async ({ db }) => {
    const html = await render(db, "andare");
    const facts = afterReadings(html);
    const reading = (await readingsFor(db, "andare"))[0];
    const [etymology] = reading.wordFacts.etymologies;
    const block = facts.slice(facts.indexOf('data-one-line=""'));
    // The whole text is in the HTML; CSS cuts it to one line.
    assert.ok(textOf(block).includes(textOf(etymology.text.replace(/</g, "&lt;"))));
    // The line is Base UI's collapsible and the toggle its trigger, which
    // names the text it opens; the script hides it when the text already fits.
    assert.match(block, /^data-one-line="" class="[^"]*"><p id="([^"]+)"[^>]*>[\s\S]*?<\/p><div class="[^"]*"><button type="button"[^>]*aria-controls="\1" aria-expanded="false"[^>]*><span class="[^"]*">\+ more<\/span><span class="[^"]*">less<\/span><\/button><\/div>/);
  });
});

test("the page shows data only: no dispute, no 'lists … among its forms', no 'not given' on a dash", async () => {
  await withDevSeed(async ({ db }) => {
    // As seeded, no reading of studente carries a review, and none shows one.
    assert.ok((await readingsFor(db, "studente")).every((reading) => reading.reviews.length === 0));
    assert.doesNotMatch(await render(db, "studente"), /Disputed|treccani|role="note"/i);
    // A disputed review row, written here as a reviewer (#12) would write it:
    // lookup reads it, and the page still does not show it.
    const verb = db
      .prepare("SELECT record_id FROM source_record WHERE release_id = ? AND word = 'studente' AND pos = 'verb'")
      .get(RELEASE) as { record_id: number };
    db.prepare(
      `INSERT INTO claim_review (record_id, json_pointer, status, note, evidence_url, reviewed_at, reviewed_by)
       VALUES (?, '/senses/0/glosses/0', 'disputed', 'Treccani gives studiante.', 'https://www.treccani.it/vocabolario/studiare/', '2026-09-29', 'test')`,
    ).run(verb.record_id);
    assert.ok((await readingsFor(db, "studente")).some((reading) => reading.reviews.some((review) => review.status === "disputed")));
    assert.doesNotMatch(await render(db, "studente"), /Disputed|treccani|role="note"/i);
    // A record that only lists the query in its table is a reading like any other.
    const listed: string[] = [];
    for (const query of ["andavano", "sale", "bello", "casa", "belli"]) {
      if ((await readingsFor(db, query)).some((reading) => !reading.isAboutQuery)) listed.push(query);
      assert.doesNotMatch(textOf(await render(db, query)), /among its forms/, query);
    }
    assert.ok(listed.length > 0, "some query here is listed by a record that is not about it");
    // An empty cell is a dash and nothing more.
    assert.doesNotMatch(await render(db, "andare"), /not given/);
    assert.match(await render(db, "andare"), /<span class="[^"]*" aria-hidden="true">—<\/span>/);
  });
});

test("every link that leaves Lexema, on a result or on /attribution, opens in a new tab; every link inside it stays", async () => {
  await withDevSeed(async ({ db }) => {
    for (const query of ["andavano", "sale", "studente", "bello"]) {
      const html = await render(db, query);
      const links = [...html.matchAll(/<a ([^>]*)>/g)].map((match) => match[1]);
      const external = links.filter((attributes) => /href="https?:\/\//.test(attributes));
      const internal = links.filter((attributes) => /href="[/#]/.test(attributes));
      assert.ok(external.length > 0 && internal.length > 0, query);
      for (const attributes of external) {
        assert.match(attributes, /target="_blank" rel="noopener noreferrer"/, `${query}: ${attributes}`);
      }
      // Each says so to a screen reader, in its label or its text.
      for (const [, attributes, inner] of html.matchAll(/<a ([^>]*href="https?:\/\/[^>]*)>(.*?)<\/a>/g)) {
        assert.match(`${attributes} ${inner}`, /opens in a new tab/, `${query}: ${attributes}`);
      }
      for (const attributes of internal) assert.doesNotMatch(attributes, /target=/, `${query}: ${attributes}`);
    }
  });
  // /attribution's credits leave Lexema too; its nav and footer links stay.
  const page = attribution();
  const external = [...page.matchAll(/<a ([^>]*href="https?:\/\/[^>]*)>(.*?)<\/a>/g)];
  assert.ok(external.length >= 5, "the attribution page links out");
  for (const [, attributes, inner] of external) {
    assert.match(attributes, /target="_blank" rel="noopener noreferrer"/, attributes);
    assert.match(inner, /opens in a new tab/, attributes);
  }
  for (const [, attributes] of page.matchAll(/<a ([^>]*href="[/#][^>]*)>/g)) assert.doesNotMatch(attributes, /target=/, attributes);
});

test("a search that finds nothing offers, in order: an accent, one edit, words that begin with it, or how to search", async () => {
  await withDevSeed(async ({ db }) => {
    const heading = (query: string) => new RegExp(`<h1 class="${esc(NOT_FOUND_HEADING)}">No entry for “<span lang="it">${esc(query)}</span>”</h1>`);
    const link = (word: string) => new RegExp(`<a class="${esc(NOT_FOUND_LINK)}" href="/\\?q=${encodeURIComponent(word)}" lang="it">${esc(word)}</a>`);

    // B: the same letters with an accent, before any other step.
    const citta = await render(db, "citta");
    assert.match(citta, heading("citta"));
    assert.match(citta, /Did you mean /);
    assert.match(citta, link("città"));

    // C: one edit away, from a lemma headword.
    const mangare = await render(db, "mangare");
    assert.match(mangare, heading("mangare"));
    assert.match(mangare, link("mangiare"));

    // A: nothing close, so the words that begin with it, each a search.
    const stud = textOf(await render(db, "stud"));
    assert.match(stud, /Lexema has no word spelled this way\. Words that begin with “stud”:/);
    assert.match(stud, /Suggestionsstudente·studentessa·studenti·studiare/);

    // Among spellings one edit away, the more common word leads: mangiare,
    // translated into three languages, before the shorter magnare.
    await withFixture(async ({ db: fixture }) => {
      const offers = textOf(await render(fixture, "mangare"));
      assert.match(offers, /Did you mean mangiare\?/);
      assert.match(offers, /Other close spellingsmagnare/);
    });

    // A three-letter query skips the typo step: `mar` is one edit from `mare`,
    // but the words that begin with it are the better offer.
    assert.match(textOf(await render(db, "mar")), /Words that begin with “mar”:Suggestionsmare/);

    // D: nothing at all.
    const none = textOf(await render(db, "xqzt"));
    assert.match(none, /No entry for “xqzt”/);
    assert.match(none, /Check the spelling, or search for the word’s base form: the infinitive of a verb, the singular of a noun\./);
    assert.doesNotMatch(none, /Did you mean|Suggestions/);
  });
});

test("every not-found page ends with one Report a missing word, below the offers, in the word page's footer row", async () => {
  await withDevSeed(async ({ db }) => {
    for (const [query, kind] of [
      ["stud", "prefix"],
      ["citta", "accent"],
      ["mangare", "typo"],
      ["vadoo via", "phrase"],
      ["xqzt", "none"],
    ] as const) {
      const answer = await attempt(db, query);
      assert.ok(answer.outcome === "not-found" && answer.nearby.kind === kind, `${query} is a not-found page of kind ${kind}`);
      const html = await render(db, query);
      assert.equal(occurrencesOf(html, `<footer class="${SOURCE_LINE}">`), 1, query);
      const line = sourceLine(html);
      // The footer row holds the one link and nothing else: no Source, no note.
      assert.equal(textOf(line), "Report a missing word", query);
      assert.match(line, /<button [^>]*>Report a missing word<\/button>/, `${query}: a button that opens the box`);
      assert.equal(occurrencesOf(html, "Report a missing word"), 1, query);
      assert.doesNotMatch(html, /Report a mistake/, query);
      // Below the heading and every offer.
      const footer = html.indexOf(`<footer class="${SOURCE_LINE}">`);
      assert.ok(footer > html.indexOf(NOT_FOUND_HEADING), query);
      if (kind !== "none") assert.ok(footer > html.lastIndexOf('id="nearby'), query);
    }
  });
});

test("the not-found page is handed the Turnstile site key, as a word page is", async () => {
  await withDevSeed(async ({ db }) => {
    const element = Outcome({ raw: "xqzt", attempt: await attempt(db, "xqzt"), siteKey: "site-key" });
    assert.equal(element.type, NotFound);
    assert.equal((element.props as { siteKey?: string }).siteKey, "site-key");
    assert.equal((element.props as { query?: string }).query, "xqzt");
  });
});

test("a form the page cannot place is not shown, and nothing on the page says so", async () => {
  await withFixture(async ({ db }) => {
    // A proper name gets no grid and no generated articles; `Mercuria` has no place.
    const mercurio = nth(await render(db, "Mercurio"), 1);
    assert.doesNotMatch(mercurio, /data-grid=""|>Forms</);
    assert.doesNotMatch(textOf(mercurio), /Mercuria|il Mercurio/);
    // `fine` is tagged masculine and feminine; `fini` only plural. Which
    // gender's plural it is, the source does not say, so it is not guessed.
    const fine = nth(await render(db, "fine"), 1);
    assert.deepEqual(gridRows(fine).map((row) => row[0]), ["", "maschile", "femminile"]);
    assert.doesNotMatch(textOf(fine), /\bfini\b/);
    // `parlarsi (coniugazione)` is the link to the reflexive verb, not a cell.
    const parlare = await render(db, "parlare");
    assert.doesNotMatch(textOf(parlare), /parlarsi/);
    // `maggiori` states its degree only in raw prose; `grandi` still has its cell.
    const grande = textOf(await render(db, "grande"));
    assert.doesNotMatch(grande, /maggiori|comparativo di maggioranza/);
    assert.match(grande, /grandi/);
    for (const html of [mercurio, fine, parlare, grande]) {
      assert.doesNotMatch(html, /not given|Not a noun|data-unplaced/i);
    }
    // An auxiliary the source writes as text still has its slot, as it wrote it.
    assert.match(textOf(await render(db, "finire")), /ausiliareavere, se intr\. essere/);
  });
});

test("each spelling of a cell has its own article line", async () => {
  await withFixture(async ({ db }) => {
    const olio = textOf(nth(await render(db, "olio"), 1));
    assert.match(olio, /oligli oli·degli olioliigli olii·degli olii/);
  });
});

// The page around the result ----------------------------------------------------

test("the home page is the name, the field and the Try chips, centred", async () => {
  const home = renderToStaticMarkup(
    <SearchPage raw="" version={VERSION}>
      <FirstLoad />
    </SearchPage>,
  );
  assert.match(home, new RegExp(`^<main class="${esc(SHELL_CENTRED)}"><h1 [^>]*>Lexema</h1>`));
  // Under the wordmark: its pronunciation, then what it is.
  assert.match(textOf(home), /^Lexema\/lekˈsɛːma\/a simple dictionary/);
  assert.doesNotMatch(home, new RegExp(esc(TOP_BAR)));
  assert.match(home, /placeholder="Search an Italian word"/);
  assert.match(home, /aria-label="Search an Italian word"/);
  assert.match(home, />ENTER<\/kbd>/);
  assert.match(home, /<form class="[^"]*" role="search" action="\/" method="get">/);
  assert.match(home, />Try<\/span>/);
  for (const word of TRY_WORDS) assert.match(home, new RegExp(`href="/\\?q=${word}" lang="it">${word}</a>`));
  assert.doesNotMatch(home, /href="\/\?q=andavano"/);
});

test("a results page has the top bar and one bordered field with a clear control", async () => {
  await withDevSeed(async ({ db }) => {
    const html = await render(db, "casa");
    assert.match(html, new RegExp(`^<header class="${esc(TOP_BAR)}"><div class="[^"]*"><a class="[^"]*" href="/">Lexema</a></div></header><main class="${esc(SHELL_TOP)}">`));
    assert.match(html, /<input [^>]*type="search" aria-label="Search an Italian word"[^>]*name="q" value="casa"\/>/);
    assert.match(html, /<a class="[^"]*" href="\/" aria-label="Clear search">×<\/a>/);
    assert.doesNotMatch(html, />ENTER</);
    assert.equal(patternsOf(html, /<label[\s>]/), 0);
  });
  assert.match(renderToStaticMarkup(<SiteHeader />), />Lexema<\/a>/);
});

test("the field is a combobox in both states, and still a plain named input for the GET form", async () => {
  const home = renderToStaticMarkup(
    <SearchPage raw="" version={VERSION}>
      <FirstLoad />
    </SearchPage>,
  );
  await withDevSeed(async ({ db }) => {
    for (const [state, html] of [["home", home], ["results", await render(db, "casa")]] as const) {
      const input = html.match(/<input [^>]*role="combobox"[^>]*\/>/)?.[0];
      assert.ok(input, `${state}: the field is a combobox`);
      assert.match(input, /aria-expanded="false"/, state);
      assert.match(input, /aria-autocomplete="list"/, state);
      assert.match(input, / name="q"/, `${state}: the form submits the field as q`);
      assert.equal(patternsOf(html, /role="combobox"/), 1, `${state}: one field`);
      // Enter submits a form without a submit button only when the form holds
      // one text field. Base UI renders a second, typeless input beside the
      // field; it has to fall outside the form, or Enter does nothing.
      const form = html.match(/<form [^>]*role="search"[^>]*>.*?<\/form>/)?.[0];
      assert.ok(form, state);
      assert.equal(patternsOf(form, /<input[\s>]/), 1, `${state}: the form holds one input`);
      // The live region that says how many suggestions opened is in the page
      // before any list is, so the first announcement is not lost.
      assert.match(html, /<div role="status" aria-live="polite" aria-atomic="true" class="sr-only"><\/div>/, state);
      // No list is rendered on the server: nothing has been typed yet.
      assert.doesNotMatch(html, /role="listbox"/, state);
    }
  });
});

test("every page reaches the attribution page from the footer's four links, and the developer site from a fifth", async () => {
  const footer = renderToStaticMarkup(<SiteFooter origins={ORIGIN} />);
  const links = [...footer.matchAll(new RegExp(`<a class="${esc(SITE_FOOTER_LINK)}" href="([^"]+)">([^<]+)</a>`, "g"))];
  assert.deepEqual(links.map((match) => match[2]), ["Attribution", "About the data", "Licence", "Contact", "Developers"]);
  for (const [, href] of links.slice(0, 4)) assert.match(href, /^\/attribution(#|$)/);
  assert.equal(links[4][1], "https://developers.lexema.fyi");
  // The footer's wordmark goes home, in the same tab, like the top bar's.
  assert.match(footer, new RegExp(`<a class="${esc(SITE_FOOTER_NAME)}" href="/">Lexema</a>`));
  assert.match(renderToStaticMarkup(<SiteHeader />), /<a class="[^"]*" href="\/">Lexema<\/a>/);

  // The layout imports globals.css, which Node cannot load, so that it carries
  // this footer is asserted on the file.
  const layout = await readFile(join(REPO, "web/app/(lexema)/layout.tsx"), "utf8");
  assert.match(layout, /<SiteFooter origins=\{await siteOrigins\(\)\} \/>/);
});

test("the search page carries no credit line, no licence name and no contributor text", async () => {
  await withFixture(async ({ db }) => {
    for (const query of ["sale", "zzzznothing"]) {
      const html = await render(db, query);
      assert.doesNotMatch(html, /CC.?BY.?SA/i, `${query}: no licence string`);
      assert.doesNotMatch(html, /kaikki|wiktextract/i, `${query}: no via-credit`);
      assert.doesNotMatch(html, /contributor|Wikimedia/i, `${query}: no contributor text`);
      assert.doesNotMatch(html, /example\.invalid/, `${query}: no link to the archive`);
    }
    const sale = await render(db, "sale");
    assert.match(
      sale,
      /href="https:\/\/it\.wiktionary\.org\/wiki\/sale" target="_blank" rel="noopener noreferrer" aria-label="Wiktionary page for sale, the source of this page \(opens in a new tab\)">Source/,
    );
  });
});

test("the tab title is the word on a result, and what Lexema is on the home page", () => {
  assert.equal(pageTitle(""), "Lexema — a simple dictionary");
  assert.equal(pageTitle("   "), "Lexema — a simple dictionary");
  // A result's title capitalises the headword's first letter; the page does not.
  assert.equal(pageTitle(" casa ", { found: "casa" }), "Casa — Lexema");
  assert.equal(pageTitle("citta", { found: "città" }), "Città — Lexema");
  assert.equal(pageTitle("roma", { found: "Roma" }), "Roma — Lexema");
  assert.equal(pageTitle("andavano", { found: "andavano" }), "Andavano — Lexema");
  assert.equal(pageTitle("xqzt", "not-found"), 'No entry for "xqzt" — Lexema');
});

test("a repeated query parameter is searched, not thrown on", async () => {
  assert.equal(firstQuery(["sale", "casa"]), "sale");
  assert.equal(firstQuery([]), "");
  assert.equal(firstQuery(undefined), "");
  assert.equal(firstQuery("sale"), "sale");

  await withFixture(async ({ db }) => {
    const html = await render(db, firstQuery(["sale", "casa"]));
    assert.match(html, /<h1 [^>]*lang="it">sale<\/h1>/);
  });
});

test("renders the states that are not an answer: rejected, failed, not found", async () => {
  const failed = renderToStaticMarkup(
    <SearchPage raw="sale" version={VERSION}>
      <Outcome raw="sale" attempt={{ outcome: "failed" }} />
    </SearchPage>,
  );
  assert.match(failed, exact(`<p class="${ERROR}" role="alert">The lookup failed`));
  assert.doesNotMatch(failed, /release|D1|normalizer|SQLITE/i);
  assert.equal(patternsOf(failed, /<h1[\s>]/), 1);

  await withFixture(async ({ db }) => {
    assert.match(await render(db, "   "), /Type a word to search for\./);
    assert.match(await render(db, "a".repeat(200)), /That is 200 characters\. The limit is 128\./);
    const missing = await render(db, "zzzznothing");
    assert.match(missing, /No entry for “<span lang="it">zzzznothing<\/span>”<\/h1>/);
    assert.doesNotMatch(missing, /Nothing in this release matches|Accents matter/);
  });
});

test("a search over the limit says so plainly, under the same field, and claims nothing about the word", () => {
  const html = renderToStaticMarkup(
    <SearchPage raw="sale" version={VERSION}>
      <Limited raw="sale" />
    </SearchPage>,
  );
  assert.match(
    html,
    exact(
      `<p class="${ERROR}" role="alert">Too many searches in the last minute, so this one did not run. ` +
        `Try again in a minute.</p>`,
    ),
  );
  assert.match(html, /<input [^>]*type="search" aria-label="Search an Italian word"[^>]*name="q" value="sale"\/>/);
  assert.equal(patternsOf(html, /<h1[\s>]/), 1);
  assert.doesNotMatch(html, /Nothing in this release|The lookup failed|Searching for/);
});

/** The attribution page, over the release the fixture imported. */
/** The page as the route serves it: the published archive's source. It reads no database. */
function attribution(source: ReleaseSource = sourceOf(PUBLISHED_ARCHIVE_SHA256)): string {
  return renderToStaticMarkup(<Attribution source={source} />);
}

/** A source nothing is recorded for. */
const UNRECORDED: ReleaseSource = { dump: null, sourceUrl: null };

test("the attribution page carries the credit, the licence and the restructuring statement", () => {
  {
    const html = attribution();

    // The licence, linked, under the name the licence itself uses.
    assert.match(
      html,
      exact(
        `<a class="${LINK}" href="https://creativecommons.org/licenses/by-sa/4.0/" ` +
          `target="_blank" rel="noopener noreferrer">Creative Commons Attribution-ShareAlike 4.0 International ` +
          `(CC BY-SA 4.0)<span class="sr-only"> (opens in a new tab)</span></a>`,
      ),
    );
    // The credit: the contributors, and where their names are kept.
    assert.match(html, /written by Wiktionary’s contributors/);
    assert.match(html, /listed in the page history of that entry’s Wiktionary page/);
    assert.match(
      html,
      exact(
        `<a class="${LINK}" href="https://it.wiktionary.org/" target="_blank" rel="noopener noreferrer">Italian Wiktionary<span class="sr-only"> (opens in a new tab)</span></a>`,
      ),
    );
    assert.match(html, /kaikki\.org/);
    assert.match(html, /wiktextract/);
    // What Lexema did to the material, and what it did not do.
    assert.match(html, /Lexema modified this material/);
    assert.match(html, /extracted from wiki text and converted into a data structure/);
    assert.match(html, /The wording of the definitions was not rewritten and was not generated/);
  }
});

test("the attribution page names the dump and links the download the release came from, with no database", () => {
  {
    const html = attribution();

    assert.match(
      html,
      exact(
        field(
          "Source",
          `<a class="${LINK}" href="https://dumps.wikimedia.org/itwiktionary/20260701/" target="_blank" rel="noopener noreferrer">` +
            `Italian Wiktionary, dump of 1 July 2026<span class="sr-only"> (opens in a new tab)</span></a>`,
        ),
      ),
    );
    assert.match(
      html,
      exact(
        field(
          "Downloaded from",
          `<a class="${LINK}" href="https://kaikki.org/dictionary/downloads/it/it-extract.jsonl.gz" target="_blank" rel="noopener noreferrer">` +
            `<code class="${CODE_IDENTITY}">https://kaikki.org/dictionary/downloads/it/it-extract.jsonl.gz</code><span class="sr-only"> (opens in a new tab)</span></a>`,
        ),
      ),
    );

    // Short and plain, by Huey's ruling on #133: the two facts a reader needs
    // to know where the data came from, and nothing else about the release.
    const identity = html.slice(html.indexOf('id="version"'), html.indexOf('id="open"'));
    assert.deepEqual(
      [...identity.matchAll(/<dt[^>]*>([^<]*)<\/dt>/g)].map((match) => match[1]),
      ["Source", "Downloaded from"],
    );
    assert.doesNotMatch(html, /0c432803/, "no checksum and no release id");
    assert.doesNotMatch(html, /2026-07-20|20 July|16 July|3 July/, "no download, build or edit date");
    assert.doesNotMatch(html, /560,357/, "no counts");
    assert.doesNotMatch(html, /inferred/i, "the basis stays in the facts and the docs");
    assert.doesNotMatch(html, /github\.com\/hueypov|reports\//, "no report links");
  }
});

test("the attribution page says not recorded for a release with no recorded facts", () => {
  {
    const html = attribution(UNRECORDED);

    // Said in words, in place: never a blank, and never a value nobody recorded.
    assert.match(html, exact(field("Source", `<span class="${EMPTY}">not recorded</span>`)));
    assert.match(html, exact(field("Downloaded from", `<span class="${EMPTY}">not recorded</span>`)));
    // The sources paragraph links Wikimedia's dump index in general; the
    // release section itself must name no dump and no download.
    const version = html.slice(html.indexOf('id="version"'), html.indexOf('id="open"'));
    assert.doesNotMatch(version, /kaikki\.org\/dictionary\/downloads|dumps\.wikimedia\.org/);
    // Counted on the element: a blank value is a blank whatever it is classed.
    assert.equal(patternsOf(html, /<dd[^>]*><\/dd>/), 0, "no field renders blank");

    // An archive with no facts recorded says the same.
    const other = attribution(sourceOf("f".repeat(64)));
    assert.match(other, exact(field("Source", `<span class="${EMPTY}">not recorded</span>`)));
    assert.match(other, exact(field("Downloaded from", `<span class="${EMPTY}">not recorded</span>`)));
  }
});

test("the attribution page shows every open field as open, with nothing guessed in it", async () => {
  await withFixture(async () => {
    const html = attribution();

    // The two the draft in docs/ATTRIBUTION_NOTICES.md still leaves open, each
    // named as open and each saying what would settle it. The licence for
    // Lexema's own material is settled (ADR 0009's amendment) and stated.
    assert.equal(html.split(`<span class="${OPEN_MARK}">— open</span>`).length - 1, 2);
    assert.doesNotMatch(html, /Lexema’s own material <span/);
    assert.match(textOf(html), /What Lexema writes itself — its own explanations, examples and review records — is published under the same licence, CC BY-SA 4\.0\./);
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
    // the draft.
    assert.doesNotMatch(html, /\{[a-zA-Z]+\}/, "no draft placeholder is published");

    // The page says where recovered definitions were read, not only the extraction.
    assert.doesNotMatch(textOf(html), /did not read Wiktionary directly/);
    assert.match(textOf(html), /Where that extraction dropped a definition, Lexema reads it from the page itself/);
  });
});

test("Wikizionario's missing-field placeholders are not data: no Etymology block, no definition, the example kept (#255)", async () => {
  const lines = (await readFile(join(REPO, "fixtures/placeholders.jsonl"), "utf8")).trim().split("\n");
  await withLines(lines, async ({ db }) => {
    // andare via: its only etymology is the placeholder, so no Etymology block renders.
    const andareVia = await render(db, "andare via");
    assert.equal(readingEtymology(nth(andareVia, 1)), undefined);
    assert.doesNotMatch(andareVia, />Etymology</);

    // addì: `(avverbio) → Etimologia mancante…` is gone; `(voce verbale) vedi addire` still finds its reading.
    const addi = await render(db, "addì");
    const verb = (await readingsFor(db, "addì")).find((reading) => reading.pos === "verb");
    assert.ok(verb);
    assert.equal(readingEtymology(readingById(addi, verb.recordId)), "Etymologyvedi addire");

    // Plutone: one reading, so its etymology is the word's, after the reading;
    // the real text after the placeholder is all of it.
    const plutone = textOf(afterReadings(await render(db, "Plutone")));
    assert.match(plutone, /Etymologydal greco vagabondo/);
    assert.doesNotMatch(plutone, /Etimologia mancante/);

    // bianca: the two placeholder senses, one behind `(tipografia)`, are no definitions.
    const bianca = await render(db, "bianca");
    const noun = (await readingsFor(db, "bianca")).find((reading) => reading.pos === "noun");
    assert.ok(noun);
    assert.equal(patternsOf(readingById(bianca, noun.recordId), /data-definition="/g), 1);

    // piratato: its adjective's one sense is the placeholder; the sense's example stays reachable.
    const piratato = await render(db, "piratato");
    const adjective = (await readingsFor(db, "piratato")).find((reading) => reading.pos === "adj");
    assert.ok(adjective);
    const reading = readingById(piratato, adjective.recordId);
    assert.equal(patternsOf(reading, /data-definition="/g), 0);
    assert.match(textOf(reading), /è un cd pirataro/);

    for (const html of [andareVia, addi, bianca, piratato, await render(db, "sbrisolona"), await render(db, "rapitore")]) {
      assert.doesNotMatch(textOf(html), /mancant[ei][.;] se vuoi/i);
      assert.doesNotMatch(textOf(html), /\(tipografia\)|\(avverbio\)/, "no label is left standing for a placeholder");
    }
    // A real gloss saying mancante stays.
    assert.match(textOf(await render(db, "poco")), /mancante/);
  });
});

test("a reading with no definition is its part of speech alone; the readings with one number 1, 2 among themselves (#250)", async () => {
  const lines = (await readFile(join(REPO, "fixtures/no-definition.jsonl"), "utf8")).trim().split("\n");
  await withLines(lines, async ({ db }) => {
    // fare l'abitudine: its one sense is `no-gloss`. No number, no dot, no
    // Definitions or Examples block; its synonym still shows.
    const fare = await render(db, "fare l'abitudine");
    assert.deepEqual(headingsOf(fare), ["Locuzione verbale"]);
    assert.doesNotMatch(nth(fare, 1), /id="(?:definitions|examples)-/);
    assert.match(textOf(afterReadings(fare)), /Synonymsabituarsi/);

    // litigante: the noun between the adjective and the verb form has no
    // definition; the two that do are 1 and 2, with no gap.
    const litigante = await render(db, "litigante");
    assert.deepEqual(headingsOf(litigante), ["1·Aggettivo·maschile e femminile, singolare", "Sostantivo", "2·Voce verbale"]);
    assert.deepEqual(
      readingsOfPage(litigante).map((reading) => patternsOf(reading, /data-definition="/g)),
      [1, 0, 1],
    );
    const jumps = [...litigante.matchAll(new RegExp(`<a class="${esc(JUMP_LINK)}" href="#reading-\\d+">(.*?)</a>`, "g"))];
    assert.deepEqual(
      jumps.map((match) => textOf(match[1])),
      ["1Aggettivo", "Sostantivo", "2Voce verbale"],
    );
    assert.deepEqual(
      reportReadings(wordPage("litigante", await readingsFor(db, "litigante")).readings).map(readingChoiceLabel),
      ["1 · Aggettivo", "Sostantivo", "2 · Voce verbale"],
    );

    for (const html of [fare, litigante]) {
      assert.doesNotMatch(textOf(html), /no definition|definizione|mancante|not given|missing/i, "no note about the missing definition");
    }
  });
});

// --- Expressions (#213) -------------------------------------------------------

/** The page's *Expressions* sections, each from its heading to the end of its section. */
function expressionSections(html: string): string[] {
  return [...html.matchAll(/<section[^>]*aria-labelledby="expressions-\d+"[^>]*>([\s\S]*?)<\/section>/g)].map((match) => match[1]);
}

/** A section's label, and its rows as [phrase, meaning], in order. */
function expressionRows(section: string): { label: string; rows: [string, string | null][] } {
  const label = textOf(/<h2[^>]*>([\s\S]*?)<\/h2>/.exec(section)?.[1] ?? "");
  const rows = [...section.matchAll(/<li class="[^"]*" data-expression="">([\s\S]*?)<\/li>/g)].map((match): [string, string | null] => {
    const meaning = new RegExp(`<p class="${esc(EXPRESSION_MEANING)}"[^>]*>([\\s\\S]*?)</p>`).exec(match[1]);
    const phrase = textOf(match[1].replace(/<p[\s\S]*<\/p>/, ""));
    return [phrase, meaning === null ? null : textOf(meaning[1])];
  });
  return { label, rows };
}

test("a word's expressions are the last word-level section before Source: labelled with no count, one row, then + more", async () => {
  await withDevSeed(async ({ db }) => {
    const html = await render(db, "casa");
    const [section, ...others] = expressionSections(html);
    assert.ok(section !== undefined);
    assert.equal(others.length, 0);
    const { label, rows } = expressionRows(section);
    assert.equal(label, "Expressions");
    // Each phrase casa's records list shows once.
    const readings = await readingsFor(db, "casa");
    assert.equal(rows.length, new Set(readings.flatMap((reading) => reading.wordFacts.expressions.map((row) => row.phrase))).size);
    // Closed, the first row shows; the rest wait for `+ more`, which ends the section.
    assert.equal(occurrencesOf(section, `class="${EXPRESSION_ROW}"`), 1);
    assert.equal(occurrencesOf(section, `class="${EXPRESSION_ROW_EXTRA}"`), rows.length - 1);
    assert.ok(section.includes(`<div class="${EXPRESSIONS_MORE}">`));
    assert.match(textOf(section), /\+ moreless$/);
    // Thirty rows or fewer: no filter box.
    assert.ok(rows.length <= EXPRESSION_FILTER_ABOVE);
    assert.ok(!section.includes("Find an expression"));
    // Nothing between the section and the Source line.
    const tail = html.slice(html.lastIndexOf('aria-labelledby="expressions-'));
    assert.ok(!tail.slice(tail.indexOf("</section>") + "</section>".length, tail.indexOf(`<footer class="${SOURCE_LINE}"`)).includes("<section"));
  });
});

test("a row is the phrase, then its meaning muted; a headword phrase links to its entry, another is plain", async () => {
  await withDevSeed(async ({ db }) => {
    const [section] = expressionSections(await render(db, "fare"));
    assert.ok(section !== undefined);
    const { rows } = expressionRows(section);
    assert.deepEqual(rows[0], ["andare a fare in culo", "mandare al diavolo, mandare a quel paese"]);
    // "fare l'amore" heads its own record in the fixture; "avere da fare" does not.
    assert.ok(section.includes(`<a class="${EXPRESSION_LINK}" href="/?q=fare%20l&#x27;amore" lang="it">fare l&#x27;amore</a>`));
    assert.ok(section.includes(`<span class="${EXPRESSION_PHRASE}" lang="it">avere da fare</span>`));
    // A row with no meaning is the phrase alone.
    assert.ok(rows.some(([, meaning]) => meaning === null), "fare lists a phrase with no sense");
    // fare's two records repeat one list: each phrase once.
    assert.equal(new Set(rows.map(([phrase]) => phrase)).size, rows.length);
    // More than thirty rows: the filter box, shown once the list is open.
    assert.ok(rows.length > EXPRESSION_FILTER_ABOVE);
    assert.ok(section.includes(`<div class="${EXPRESSION_FILTER}">`));
    assert.match(section, /placeholder="Find an expression"/);
  });
});

test("Find an expression matches the phrase or the meaning, whatever the case", () => {
  const row = { phrase: "andare a Canossa", meanings: ["umiliarsi, invocare un perdono mortificante"], hasEntry: false, refs: [] as never };
  assert.ok(matchesExpression(row, "canossa"));
  assert.ok(matchesExpression(row, "PERDONO"));
  assert.ok(matchesExpression(row, "  "));
  assert.ok(!matchesExpression(row, "bottega"));
});

test("a form's page shows its lemma's expressions as Expressions with <lemma>, after its own", async () => {
  await withDevSeed(async ({ db }) => {
    const sections = expressionSections(await render(db, "andavano")).map(expressionRows);
    assert.deepEqual(sections.map(({ label }) => label), ["Expressions with andare"]);
    assert.deepEqual(sections[0]?.rows[0], ["a lungo andare", "col trascorrere del tempo"]);
  });
  const lines = (await readFile(join(REPO, "fixtures/expressions.jsonl"), "utf8")).trim().split("\n");
  await withLines(lines, async ({ db }) => {
    const sections = expressionSections(await render(db, "stato")).map(expressionRows);
    assert.deepEqual(sections.map(({ label }) => label), ["Expressions", "Expressions with stare"]);
    assert.equal(sections[0]?.rows.length, 5);
    assert.deepEqual(sections[0]?.rows[1], ["lo stato delle cose è questo!", null]);
  });
});

test("a page with no expressions shows no section and says nothing about it (ADR 0016)", async () => {
  await withFixture(async ({ db }) => {
    const html = await render(db, "casa");
    assert.equal(expressionSections(html).length, 0);
    assert.ok(!textOf(html).includes("Expressions"));
  });
});

test("a list of one row has no + more", async () => {
  const lines = (await readFile(join(REPO, "fixtures/expressions.jsonl"), "utf8")).trim().split("\n");
  await withLines(lines, async ({ db }) => {
    const [section] = expressionSections(await render(db, "colore"));
    assert.ok(section !== undefined);
    assert.deepEqual(expressionRows(section).rows, [["di colore", null]]);
    assert.ok(!section.includes(EXPRESSIONS_MORE));
  });
});

// Declared lemmas (#453) ------------------------------------------------------
//
// `fixtures/declared-lemmas.jsonl` holds real lines of it-0c432803: some of the
// form records of `verbalizzare`, `videoregistrare`, `aggrapparsi`,
// `fratellino`, `lussare`, `calabro` and `tassofono`, none of which any record
// heads.

const DECLARED_LINES = (await readFile(join(REPO, "fixtures/declared-lemmas.jsonl"), "utf8")).trimEnd().split("\n");
const withDeclared = (run: (f: Fixture) => Promise<void>) => withLines(DECLARED_LINES, run);

/** The archive line of a record in that fixture, which its forms' refs name. */
const declaredLine = (word: string, pos = "verb"): number =>
  DECLARED_LINES.findIndex((line) => {
    const record = JSON.parse(line) as { word: string; pos: string };
    return record.word === word && record.pos === pos;
  }) + 1;

/** The headings of a declared lemma's readings, as text. */
const declaredHeadings = (html: string): string[] =>
  [...html.matchAll(/<h2 class="[^"]*" id="reading-heading-declared-[a-z]+">(.*?)<\/h2>/g)].map((match) => textOf(match[1]));

/** The words in one person's row of a mood panel's first table: its first tense's cell. */
const firstCell = (html: string, person: string): string | undefined =>
  new RegExp(`<th scope="row"[^>]*>${esc(person)}</th><td[^>]*>(.*?)</td>`).exec(html)?.[1];

/** What the non-finite line holds under one label. */
const nonFinite = (html: string, label: string): string | undefined =>
  new RegExp(`<dt [^>]*>${esc(label)}</dt><dd [^>]*>(.*?)</dd>`).exec(html)?.[1];

test("a word only form-of records name is a word page with its forms table, not the not-found page (#453)", async () => {
  await withDeclared(async ({ db }) => {
    for (const word of ["verbalizzare", "videoregistrare", "aggrapparsi", "fratellino"]) {
      const html = await render(db, word);
      assert.match(html, new RegExp(`<h1 class="${esc(WORD_HEADING)}" lang="it">${esc(word)}</h1>`), word);
      assert.match(html, />Forms</, word);
      // A grid, or a conjugation; `aggrapparsi` has its participle alone.
      assert.match(html, /data-grid=""|<dl class="[^"]*"><div [^>]*><dt [^>]*>gerundio<\/dt>/, word);
      assert.ok(!html.includes(NOT_FOUND_HEADING), word);
      assert.equal(occurrencesOf(html, `class="${SOURCE_LINE}"`), 1, word);
      assert.equal(occurrencesOf(html, 'href="https://it.wiktionary.org/wiki/'), 1, word);
    }
  });
});

test("a declared lemma's Source opens the page of the first form its table shows that a record declares (#459)", async () => {
  await withDeclared(async ({ db }) => {
    // The conjugation's first form is the non-finite line's gerundio; the
    // grid's is `fratellini`, since the lemma's own singolare is no record's.
    for (const [word, form] of [
      ["verbalizzare", "verbalizzando"],
      ["fratellino", "fratellini"],
    ]) {
      const line = sourceLine(await render(db, word));
      assert.equal(occurrencesOf(line, 'href="https://it.wiktionary.org/wiki/'), 1, word);
      assert.match(line, new RegExp(`href="https://it\\.wiktionary\\.org/wiki/${esc(form)}" target="_blank"`), word);
      assert.match(line, new RegExp(`aria-label="Wiktionary page for ${esc(form)}, the source of this page`), word);
    }
  });
});

test("a declared lemma's page has no definitions and no note on what it lacks", async () => {
  await withDeclared(async ({ db }) => {
    const shown: string[] = [];
    for (const word of ["verbalizzare", "videoregistrare", "aggrapparsi", "fratellino", "calabro", "lussare"]) {
      const html = await render(db, word);
      assert.doesNotMatch(html, /id="definitions-|>Definitions<|>Examples<|aria-label="Pronunciation"/, word);
      assert.doesNotMatch(textOf(html), /definizion|no entry|not found|no definition|missing|non ha|nessun/i, word);
      // The report names the word alone: no record heads it, so there is no reading to choose.
      assert.doesNotMatch(html, /name="reading"/, word);
      shown.push(word);
    }
    assert.equal(shown.length, 6);
  });
});

test("a declared lemma's word type is its declaring records' part of speech in Italian, one reading for each", async () => {
  await withDeclared(async ({ db }) => {
    assert.deepEqual(declaredHeadings(await render(db, "verbalizzare")), ["Verbo"]);
    assert.deepEqual(declaredHeadings(await render(db, "fratellino")), ["Sostantivo"]);
    // `calabri` and `calabre` each have an adjective record and a noun record.
    const calabro = await render(db, "calabro");
    assert.deepEqual(declaredHeadings(calabro), ["Aggettivo", "Sostantivo"]);
    assert.equal(patternsOf(calabro, /data-grid=""/), 2);
  });
});

test("a declared verb's conjugation places each form where its gloss says, and shows no form the rule refuses or no cell holds", async () => {
  await withDeclared(async ({ db }) => {
    const html = await render(db, "verbalizzare");
    assert.equal(textOf(firstCell(panel(html, "Indicativo"), "io") ?? ""), "verbalizzo");
    assert.equal(textOf(nonFinite(html, "gerundio") ?? ""), "verbalizzando");
    assert.equal(textOf(nonFinite(html, "participio") ?? ""), "verbalizzato");
    assert.equal(textOf(nonFinite(html, "participio presente") ?? ""), "verbalizzante");
    assert.equal(textOf(firstCell(panel(html, "Condizionale"), "io") ?? ""), "verbalizzerei");
    assert.match(textOf(panel(html, "Congiuntivo")), /che ioverbalizzi/);
    assert.match(textOf(panel(html, "Imperativo")), /tuverbalizza/);
    // Agreement forms are no cell of a conjugation: `verbalizzati`, "participio
    // passato maschile plurale", and `verbalizzanti` are not on the page.
    assert.doesNotMatch(textOf(html), /verbalizzati|verbalizzanti/);
    // Nothing was searched but the lemma, which no cell holds.
    assert.doesNotMatch(html, /data-searched=""/);

    // `lusso` says "… del verbo lussare", which the rule refuses: it is not
    // shown, and `lussando` still has its slot.
    const lussare = await render(db, "lussare");
    assert.doesNotMatch(textOf(lussare), /\blusso\b/);
    assert.equal(textOf(nonFinite(lussare, "gerundio") ?? ""), "lussando");
  });
});

test("a declared noun's grid has the lemma in singolare and its plural where the plural's record puts it", async () => {
  await withDeclared(async ({ db }) => {
    const rows = gridRows(await render(db, "fratellino"));
    assert.deepEqual(rows.map((row) => row[0]), ["", "maschile"]);
    assert.match(rows[1][1], /^fratellino/);
    assert.match(rows[1][2], /^fratellini/);
    // A feminine plural names no gender of the lemma's own: `calabro` sits in
    // maschile only, beside `calabri`, and `calabre` in femminile plurale.
    const [adjective] = readingsOfPage(await render(db, "calabro"));
    const calabro = gridRows(adjective);
    assert.deepEqual(calabro.map((row) => row[0]), ["", "maschile", "femminile"]);
    assert.match(calabro[1][1], /^calabro/);
    assert.match(calabro[1][2], /^calabri/);
    assert.equal(calabro[2][1], "—");
    assert.match(calabro[2][2], /^calabre/);
  });
});

test("each form a declared lemma shows names the record it came from", async () => {
  await withDeclared(async ({ db }) => {
    const verbalizzare = await render(db, "verbalizzare");
    for (const word of ["verbalizzo", "verbalizzando", "verbalizzato", "verbalizzerei"]) {
      assert.match(verbalizzare, new RegExp(`href="/\\?q=${word}" lang="it" data-line="${declaredLine(word)}">${word}</a>`), word);
    }
    // `verbalizzi` fills five slots from one record; every cell names that record.
    assert.equal(patternsOf(verbalizzare, new RegExp(`data-line="${declaredLine("verbalizzi")}">verbalizzi<`)), 5);
    assert.match(await render(db, "fratellino"), new RegExp(`<span data-line="${declaredLine("fratellini", "noun")}">fratellini</span>`));
  });
});

test("a declared lemma whose forms take no cell keeps the not-found page", async () => {
  await withDeclared(async ({ db }) => {
    // `tassofoni` says "plurale di tassofono." and states no gender, so it has no cell.
    assert.match(await render(db, "tassofono"), new RegExp(`<h1 class="${esc(NOT_FOUND_HEADING)}">No entry for`));
    assert.equal((await attempt(db, "tassofono")).outcome, "not-found");
  });
});

test("a word a record heads or lists answers exactly as it did: the declared probe runs only after both find nothing", async () => {
  await withDeclared(async ({ db }) => {
    const answer = await attempt(db, "verbalizzo");
    assert.deepEqual(answer.outcome === "found" && answer.readings.map((reading) => reading.word), ["verbalizzo"]);
  });
  await withDevSeed(async ({ db }) => {
    const outcomes: string[] = [];
    for (const query of ["casa", "andare", "andavano", "vado via", "xqzt"]) outcomes.push((await attempt(db, query)).outcome);
    assert.deepEqual(outcomes, ["found", "found", "found", "found", "not-found"]);
  });
});

test("page-only readings present definitions without origin marks or invented forms, and API IDs are page identities", async () => {
  // Verbatim archive lines 52740/53209, not a manufactured lemma record.
  const text = await readFile(join(REPO, "fixtures/page-entry-forms.jsonl"), "utf8");
  await withLines(text.trimEnd().split("\n"), async ({ db }) => {
    const answer = await attempt(db, "raccontare");
    assert.ok(answer.outcome === "found");
    const reading = answer.readings[0];
    assert.ok(reading.entryId !== undefined);
    const model = wordPage("raccontare", answer.readings);
    assert.equal(model.readings.length, 1);
    // A report names only a source record, so a page-only reading is not offered as a choice.
    assert.deepEqual(reportReadings(model.readings), []);
    const html = await render(db, "raccontare");
    assert.match(textOf(html), /narrare, oralmente o tramite scrittura, eventi o storie/);
    assert.match(textOf(html), /rappresentare qualcosa, in genere cosa non gradita/);
    assert.match(html, new RegExp(`id="reading-page-${reading.entryId}"`));
    assert.doesNotMatch(html, /reading-undefined|forms-page-|<table/);
    assert.doesNotMatch(textOf(html), /recovered|derived|Pronunciation|Etymology|Forms|Indicativo/);
    assert.equal(occurrencesOf(textOf(html), "Source"), 1);
    const { candidatesOf, resultJson, idOf } = await import("@/worker/api/lookupAnswer.ts");
    const { readLookupFilters } = await import("@/worker/api/lookupFilters.ts");
    const filters = readLookupFilters(new URLSearchParams());
    assert.ok(filters.ok);
    const candidates = await candidatesOf(answer, async () => undefined);
    const json = resultJson(candidates[0], filters.filters);
    assert.equal(json.id, `${RELEASE}:page:${reading.ref.revisionId}:${reading.ref.line}`);
    assert.equal(idOf(reading), json.id);
    assert.equal(json.forms, null);
    assert.deepEqual(json.pronunciations, []);
    assert.equal(json.etymology, null);
  }, await loadFixturePages(join(REPO, "fixtures")));
});

test("a page-only noun no form names renders like any other entry, with no note on where it came from", async () => {
  // `mastoide` (revision in fixtures/upstream-pages) states `{{-sost-|it}}`; no archive line names it.
  const pages = await loadFixturePages(join(REPO, "fixtures"));
  const mastoide = pages.page("mastoide");
  assert.ok(mastoide !== undefined);
  const text = await readFile(join(REPO, "fixtures/page-entry-forms.jsonl"), "utf8");
  await withLines(text.trimEnd().split("\n"), async ({ db }) => {
    const answer = await attempt(db, "mastoide");
    assert.ok(answer.outcome === "found");
    assert.equal(answer.readings.length, 1);
    const [reading] = answer.readings;
    assert.ok(reading.entryId !== undefined);
    assert.equal(reading.posTitle, "Sostantivo");
    const html = await render(db, "mastoide");
    // The part of speech heads the reading exactly as a record's does.
    assert.match(html, /<span lang="it">Sostantivo<\/span>/);
    assert.match(html, new RegExp(`id="reading-page-${reading.entryId}"`));
    assert.match(textOf(html), /prominenza tondeggiante dell'osso temporale, posta dietro il padiglione dell'orecchio/);
    assert.doesNotMatch(textOf(html), /recovered|derived|page-only|italian-page-entry|Not from the source/i);
    assert.equal(occurrencesOf(textOf(html), "Source"), 1);
  }, rawPageSource([mastoide]));
});
