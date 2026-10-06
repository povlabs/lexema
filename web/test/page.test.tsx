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
//   tense cycle the source leaves without a pronoun.
//
// What this cannot cover is the wiring in app/(lexema)/page.tsx: reaching D1 needs
// `cloudflare:workers`, which exists only inside workerd.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { renderToStaticMarkup } from "react-dom/server";
import { seedSql } from "../../src/import/seedSql.js";
import { PageOnlyCandidates, readUnrecordedPageTitles, UNRECORDED_PAGE_TITLES_FILE } from "../../src/import/pageOnlyCandidates.js";
import { CURATED_CORRECTIONS, definitionCorrections, type CuratedCorrection } from "../../src/italian/curatedCorrections.js";
import { atFixtureLines, correctionFixtureLines } from "../../test/correctionFixture.js";
import { DECLARED_CORRECTION_LINES, declaredCorrections } from "../../test/declaredCorrectionFixture.js";
import { seededDictionary } from "../../test/seededDictionary.js";
import { loadFixturePages, rawPageSource, type RawPageSource } from "../../src/source/rawPage.js";
import type { ArchiveFacts } from "../../src/source/archiveFacts.js";
import { servedRelease, ServedReleaseUnknown, type ServedRelease } from "../../src/source/servedRelease.js";
import type { DeclaredChange, ReleaseId } from "../../src/update/declaration.js";
import { readServedRelease } from "../../src/update/readServedRelease.js";
import { fromNodeSqlite } from "../../src/lookup/database.js";
import { formsOfQueryReadings, otherFormsOfQueryLemmas, type Reading, type SourceRef } from "../../src/lookup/types.js";
import type { Attempt } from "@/lib/dictionary/attempt.ts";
import { searchAttempt } from "@/lib/dictionary/searchAttempt.ts";
import { declaredGridOf, NUMBERS } from "@/lib/dictionary/genderGrid.ts";
import { Licence } from "@/components/dictionary/Licence";
import { Privacy } from "@/components/dictionary/Privacy";
import { readingIndex } from "@/components/shared/LegalContents";
import { FirstLoad, Limited, Outcome, SearchPage, TRY_WORDS } from "@/components/dictionary/SearchPage";
import { SiteFooter } from "@/components/dictionary/SiteFooter";
import { CONTACT_EMAIL } from "@/components/shared/contact.ts";
import { byHost, ORIGIN } from "@/worker/shared/hosts.ts";
import { SiteHeader } from "@/components/dictionary/SiteHeader";
import { readingChoiceLabel } from "@/components/dictionary/ReportDialog";
import { reportReadings } from "@/lib/dictionary/report.ts";
import { NotFound } from "@/components/dictionary/NotFound";
import { PhraseView } from "@/components/dictionary/Phrase";
import { phrasePage } from "@/lib/dictionary/phrasePage.ts";
import { EXPRESSION_FILTER_ABOVE, matchesExpression, shownRecords, wordPage } from "@/lib/dictionary/wordPage.ts";
import { firstQuery, pageTitle } from "@/lib/dictionary/params";
import { readingProblem, SMOKE_WORDS } from "@/builds/previewSmokeCommand.ts";
// The class strings the components carry, imported rather than copied, so a
// restyle that changes one changes both together.
import {
  DEFINITION,
  DEFINITION_EXTRA,
  DEFINITION_NUMBER_CLOSED,
  DEFINITION_NUMBER_OPEN,
  EXPRESSION_FILTER,
  EXPRESSION_LINK,
  EXPRESSION_MEANING,
  EXPRESSION_PHRASE,
  EXPRESSION_ROW,
  EXPRESSION_ROW_EXTRA,
  EXPRESSIONS_MORE,
  ERROR,
  EXAMPLE_EXTRA,
  GLOSS_LINK,
  JUMP_LINK,
  LEGAL_ADDRESS,
  LEGAL_CONTENTS,
  LEGAL_EFFECTIVE,
  LEGAL_KICKER,
  LEGAL_LAYOUT,
  LEGAL_LEDE,
  LEGAL_SECTION,
  LEGAL_SECTION_NUMBER,
  LEGAL_SHELL,
  LEGAL_TITLE,
  LEGAL_UNBROKEN,
  LINK,
  NON_FINITE_LABEL_SEARCHED,
  NOT_FOUND_HEADING,
  NOT_FOUND_LINK,
  PERSON_SEARCHED,
  READING,
  SEARCH_FIELD,
  SHELL_CENTRED,
  SHELL_TOP,
  SITE_FOOTER_LINK,
  SOURCE_LINE,
  SITE_FOOTER_NAME,
  TENSE_CELL_SEARCHED_ROW,
  TENSE_CELL_SEARCHED_ROW_WIDE,
  TENSE_HEAD_SEARCHED,
  TOP_BAR,
  WORD_HEADING,
  WORD_LINK,
  WORD_NOTE,
  WRITTEN_OFFER_LEAD,
  WRITTEN_OFFER_LINK,
} from "@/components/shared/styles.ts";
import { FIXTURE_LINES } from "./fixture.js";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const RELEASE = "it-page-test";
/** The served version's token a page hands its search field. */
const VERSION = `${RELEASE}.0`;

interface Fixture {
  db: DatabaseSync;
}

/** Seed `lines` as one gzipped archive into `outputDir`. */
async function seedLines(
  outputDir: string,
  lines: readonly string[],
  rawPages?: RawPageSource,
  facts?: ArchiveFacts,
  corrections?: readonly CuratedCorrection[],
  pageOnly?: PageOnlyCandidates,
): Promise<{ parts: readonly string[] }> {
  await mkdir(outputDir, { recursive: true });
  const archive = join(outputDir, "fixture.jsonl.gz");
  const bytes = gzipSync(Buffer.from(`${lines.join("\n")}\n`, "utf8"));
  await writeFile(archive, bytes);
  return seedSql({
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
    pageOnly,
    corrections,
    onRejection: (rejection) => {
      throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
    },
  });
}

/** Run `run` over `db`, then close it. */
async function withDatabase(db: DatabaseSync, run: (f: Fixture) => Promise<void>): Promise<void> {
  try {
    // No review comes from Lexema: the seed writes no `claim_review` row (#117).
    assert.deepEqual({ ...db.prepare("SELECT count(*) AS n FROM claim_review").get() }, { n: 0 });
    await run({ db });
  } finally {
    db.close();
  }
}

async function withLines(
  lines: readonly string[],
  run: (f: Fixture) => Promise<void>,
  rawPages?: RawPageSource,
  facts?: ArchiveFacts,
  corrections?: readonly CuratedCorrection[],
): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-page-"));
  try {
    const { parts } = await seedLines(join(dir, "sql"), lines, rawPages, facts, corrections);
    const db = new DatabaseSync(":memory:");
    for (const part of parts) db.exec(await readFile(part, "utf8"));
    await withDatabase(db, run);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const devSeedLines = async (): Promise<string[]> => (await readFile(join(REPO, "fixtures/dev-seed.jsonl"), "utf8")).trim().split("\n");

/** The synthetic archive in `fixture.ts`, seeded once for this file (test/seededDictionary.ts). */
const withFixture = async (run: (f: Fixture) => Promise<void>) =>
  withDatabase(await seededDictionary("page:fixture", (outputDir) => seedLines(outputDir, FIXTURE_LINES)), run);

/** The real development fixture, `fixtures/dev-seed.jsonl`, seeded once for this file. */
const withDevSeed = async (run: (f: Fixture) => Promise<void>) =>
  withDatabase(await seededDictionary("page:dev-seed", async (outputDir) => seedLines(outputDir, await devSeedLines())), run);

/**
 * The development fixture seeded the way `pnpm run seed:dev` seeds it: with the
 * raw pages under `fixtures/`, so records like `casa` carry the recovered layer,
 * and only the committed record-less titles as page-only entries (#499).
 * Seeded once for this file.
 */
async function withDevSeedAndPages(run: (f: Fixture) => Promise<void>): Promise<void> {
  const db = await seededDictionary("page:dev-seed+pages", async (outputDir) =>
    seedLines(
      outputDir, await devSeedLines(), await loadFixturePages(join(REPO, "fixtures")), undefined, undefined,
      PageOnlyCandidates.listed(await readUnrecordedPageTitles(join(REPO, UNRECORDED_PAGE_TITLES_FILE))),
    ));
  return withDatabase(db, run);
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

/** Each reading of a page, in the order the page rendered them. */
function readingsOfPage(html: string): string[] {
  return html
    .split(`<article class="${READING}"`)
    .slice(1)
    .map((part) => part.slice(0, part.indexOf("</article>")));
}

/** The headings of a page's readings, as text: `1·Sostantivo`. */
const headingsOf = (html: string): string[] =>
  [...html.matchAll(/<h2 class="[^"]*" id="reading-heading-[^"]+">(.*?)<\/h2>/g)].map((match) => textOf(match[1]));

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

test("the preview smoke finds a reading on every smoke word's page, a verb form block's included (#246, #636)", async () => {
  await withDevSeed(async ({ db }) => {
    for (const word of SMOKE_WORDS) assert.equal(readingProblem(await render(db, word), word), undefined, word);
  });
});

test("every record the lookup returns is a reading, except a form of the query's own readings or lemma, headed by its number and its own pos_title", async () => {
  await withDevSeed(async ({ db }) => {
    const expected: Record<string, string[]> = {
      // After a grid reading's part of speech, the gender and number its
      // record states, and never on a verb or a Voce verbale. casa states
      // them only in its gloss stamp `f sing` (#317).
      casa: ["1·Sostantivo·femminile, singolare"],
      andare: ["1·Sostantivo·maschile", "2·Verbo"],
      andavano: ["1·Voce verbale·andare"],
      bello: [
        "1·Aggettivo·maschile, singolare",
        "2·Sostantivo·maschile, invariabile",
        "3·Sostantivo·maschile, singolare",
      ],
      sale: ["1·Sostantivo·maschile, singolare", "2·Sostantivo, forma flessa·femminile, plurale", "3·Voce verbale·salire"],
      // A form's page keeps only the readings about it: bella's two, case's
      // one, andati's two (#626).
      bella: ["1·Aggettivo, forma flessa·femminile, singolare", "2·Sostantivo, forma flessa·femminile, singolare"],
      case: ["1·Sostantivo, forma flessa·femminile, plurale"],
      andati: ["1·Aggettivo, forma flessa·maschile", "2·Voce verbale·andare"],
    };
    for (const [query, headings] of Object.entries(expected)) {
      const html = await render(db, query);
      const answer = await attempt(db, query);
      assert.ok(answer.outcome === "found", query);
      const readings = await readingsFor(db, query);
      assert.deepEqual(headingsOf(html), headings, query);
      assert.match(html, new RegExp(`<h1 [^>]*lang="it">${query}</h1>`), `${query}: headed as typed`);
      // Every record the lookup returned is shown, as a reading or in a verb
      // form block, except a form of the query's own readings (#622) or of its
      // own lemma (#626): bello's page leaves out bella's record.
      const forms = formsOfQueryReadings(readings);
      const siblings = otherFormsOfQueryLemmas(readings);
      assert.deepEqual(
        shownRecords(wordPage(query, readings, answer.lemmas).readings).map((entry) => entry.reading.recordId).sort((a, b) => { assert.ok(a !== undefined && b !== undefined); return a - b; }),
        readings.filter((reading) => !forms.has(reading) && !siblings.has(reading)).map((reading) => reading.recordId).sort((a, b) => a - b),
        query,
      );
      assert.equal(patternsOf(html, /<h1[\s>]/), 1, `${query}: one h1`);
    }
    // The one record left out in the seed: bella lists bello and is its form.
    const bello = await readingsFor(db, "bello");
    assert.deepEqual([...formsOfQueryReadings(bello)].map((reading) => `${reading.word} ${reading.posTitle}`), ["bella Aggettivo, forma flessa"]);
    assert.ok(bello.some((reading) => reading.word === "bella"), "the lookup still returns bella for bello");
  });
});

test("jump links appear from three readings up, one per reading, and never below", async () => {
  await withDevSeed(async ({ db }) => {
    const bello = await render(db, "bello");
    const jumps = [...bello.matchAll(new RegExp(`<a class="${esc(JUMP_LINK)}" href="#reading-(\\d+)">(.*?)</a>`, "g"))];
    assert.deepEqual(
      jumps.map((match) => textOf(match[2])),
      ["1Aggettivo", "2Sostantivo", "3Sostantivo"],
    );
    for (const [, id] of jumps) assert.match(bello, new RegExp(`<article [^>]*id="reading-${id}"`));
    assert.doesNotMatch(await render(db, "andare"), /aria-label="Readings"/);
    // Two readings, one of them a verb form block, are still too few (#654).
    const studente = await render(db, "studente");
    assert.deepEqual(headingsOf(studente), ["1·Sostantivo·maschile, singolare", "2·Voce verbale·studiare"]);
    assert.doesNotMatch(studente, /aria-label="Readings"/);
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
      // studenti and studentessa are forms of studente, so its page leaves them out (#622).
      studente: ["1·Sostantivo·maschile, singolare", "2·Voce verbale·studiare"],
      // studentessa is another form of studente, as studenti is, so studenti's page leaves it out (#626).
      studenti: ["1·Sostantivo, forma flessa·maschile, plurale"],
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
  await withFixture(async ({ db }) => {
    const grande = nth(await render(db, "grande"), 1);
    const superlative = textOf(grande.slice(grande.indexOf(">superlativo</p>")));
    assert.match(superlative, /^>superlativosingolarepluralemaschilegrandissimo\n massimo/);
  });
});

test("a searched noun or adjective form shows its lemma's grid as Forms of the lemma, unmarked, in place of its own (#626)", async () => {
  await withDevSeed(async ({ db }) => {
    const lemmaForms = (html: string): string[] =>
      [...html.matchAll(/<h3 [^>]*id="lemma-forms-[^"]*">(.*?)<\/h3>/g)].map((match) => textOf(match[1]));
    const ownForms = (html: string): number => patternsOf(html, /<h3 [^>]*id="forms-\d+">Forms<\/h3>/);

    // bella the adjective shows bello's grid, as bello's own reading draws it.
    const bella = await render(db, "bella");
    const adjective = nth(bella, 1);
    assert.deepEqual(lemmaForms(adjective), ["Forms ofbello"]);
    assert.equal(ownForms(adjective), 0, "bella's own grid is not shown beside bello's");
    assert.deepEqual(gridRows(adjective), gridRows(nth(await render(db, "bello"), 1)));
    assert.match(adjective, /<div [^>]*role="table" aria-label="Forms of bello" data-grid="">/);
    // bella the noun names the bello nouns, and neither one's grid lists bella.
    assert.deepEqual(lemmaForms(nth(bella, 2)), []);
    // Its own reading stays: its gender and number, its line linking bello.
    assert.match(textOf(adjective), /femminile singolare di bello/);
    assert.match(adjective, new RegExp(`<a class="${esc(GLOSS_LINK)}" href="/\\?q=bello">bello</a>`));

    // case shows casa's grid, which takes case from case's own plural gloss (#145).
    const caseReading = nth(await render(db, "case"), 1);
    assert.deepEqual(lemmaForms(caseReading), ["Forms ofcasa"]);
    assert.deepEqual(gridRows(caseReading), [
      ["", "singolare", "plurale"],
      ["femminile", "casala casa·una casa", "casele case·delle case"],
    ]);

    // A grid never marks the searched form (#111).
    assert.doesNotMatch(bella + caseReading, /data-searched/);
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
    // The searched row is taller in its own pair and, on a wide screen only,
    // in the pair beside it, so the two tables keep one row line (frames 17, 21).
    assert.equal(patternsOf(indicativo, new RegExp(esc(`class="${TENSE_CELL_SEARCHED_ROW}"`), "g")), 2);
    assert.equal(patternsOf(indicativo, new RegExp(esc(`class="${TENSE_CELL_SEARCHED_ROW_WIDE}"`), "g")), 2);
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

/** A page's verb form block for `verb` (#636), or undefined when it has none. */
function verbBlock(html: string, verb: string): string | undefined {
  const open = html.indexOf(`<article class="${READING}" id="reading-voce-verbale-${verb}"`);
  return open === -1 ? undefined : html.slice(open, html.indexOf("</article>", open));
}

/** The *Forms of* labels in some markup, as text: `Forms ofandare`. */
const lemmaFormsOf = (html: string): string[] =>
  [...html.matchAll(/<h3 [^>]*id="lemma-forms-[^"]*">(.*?)<\/h3>/g)].map((match) => textOf(match[1]));

/** The searched spellings a conjugation marks. */
const searchedForms = (html: string): string[] => formLinks(html).filter((link) => link.searched).map((link) => link.text);

/** The first gloss of each of a word's verb readings: its definitions, which a form's page never shows. */
async function verbDefinitions(db: DatabaseSync, word: string): Promise<string[]> {
  return (await readingsFor(db, word))
    .filter((reading) => reading.word === word && reading.pos === "verb")
    .flatMap((reading) => reading.senses.flatMap((sense) => sense.glosses.map((gloss) => gloss.text)));
}

/**
 * A verb form block that shows andare's whole conjugation as its only *Forms*,
 * with nothing marked: the shape of a block whose verb's table does not list
 * the query (#666).
 */
function assertWholeUnmarkedConjugation(block: string, query: string): void {
  assert.match(textOf(block), /gerundioandando·participio presenteandante·participioandato·ausiliareessere/, `${query}: andare's non-finite line`);
  const tabs = [...block.matchAll(/<button [^>]*role="tab"[^>]*>([^<]+)<\/button>/g)];
  assert.deepEqual(tabs.map((match) => match[1]), ["Indicativo", "Congiuntivo", "Condizionale", "Imperativo"], `${query}: andare's mood tabs`);
  assert.match(tabs[0][0], /aria-selected="true"/, `${query}: opens at Indicativo, as andare's own page does`);
  assert.match(textOf(panel(block, "Indicativo")), /lorovannoandavano/, `${query}: andare's tenses`);
  // Nothing is marked: no cell, no person or tense, no non-finite label.
  assert.deepEqual(searchedForms(block), [], `${query}: a cell is marked`);
  for (const marked of [PERSON_SEARCHED, TENSE_HEAD_SEARCHED, NON_FINITE_LABEL_SEARCHED]) {
    assert.ok(!block.includes(`class="${marked}"`), `${query}: marks ${marked}`);
  }
  // No Forms of the form record's own, so no row of dashes.
  assert.doesNotMatch(block, /id="forms-/, `${query}: shows its record's own Forms`);
  assert.doesNotMatch(textOf(block), /gerundio—|participio—|ausiliare—/, `${query}: shows a dash-only row`);
}

/** `fixtures/andata.jsonl`: andata's adjective, noun and verb form records, as release it-0c432803 has them (lines 30497-30499). */
const ANDATA_LINES = (await readFile(join(REPO, "fixtures/andata.jsonl"), "utf8")).trimEnd().split("\n");

test("a verb form its verb's table does not list shows that verb's whole table, opened as the verb's own page opens it, nothing marked (#666)", async () => {
  await withLines([...(await devSeedLines()), ...ANDATA_LINES], async ({ db }) => {
    const html = await render(db, "andata");
    const block = verbBlock(html, "andare");
    assert.ok(block !== undefined, "andata: no andare block");
    assert.deepEqual(definitionLines(block), ["participio passato femminile singolare di andare"]);
    assert.deepEqual(lemmaFormsOf(block), ["Forms ofandare"]);
    assertWholeUnmarkedConjugation(block, "andata");
    // andare's own page opens its table at the same mood.
    const selected = (markup: string): string[] =>
      [...markup.matchAll(/<button [^>]*role="tab"[^>]*>([^<]+)<\/button>/g)].filter((match) => /aria-selected="true"/.test(match[0])).map((match) => match[1]);
    assert.deepEqual(selected(block), selected(nth(await render(db, "andare"), 2)));
  });
});

test("a verb reading whose own forms fill no cell shows no Forms block, so never a dash-only row (#674)", async () => {
  // The dev seed has no andata records, so andato's and andati's Voce verbale
  // records stay readings; their forms carry only gender and number tags.
  await withDevSeed(async ({ db }) => {
    const html = await render(db, "andata");
    const voci = readingsOfPage(html).filter((reading) => /<h2 [^>]*>.*?Voce verbale.*?<\/h2>/.test(reading));
    assert.equal(voci.length, 2, "andata: andato's and andati's Voce verbale readings");
    for (const reading of voci) assert.doesNotMatch(reading, /id="forms-/, "andata: a Voce verbale reading shows Forms");
    assert.doesNotMatch(textOf(html), /gerundio—|participio—|ausiliare—/, "andata: a dash-only row");
  });
  // sditalinare's only form is `plurale della parola`, tagged plural.
  const lines = (await readFile(join(REPO, "fixtures/sditalinare.jsonl"), "utf8")).trimEnd().split("\n");
  await withLines(lines, async ({ db }) => {
    const html = await render(db, "sditalinare");
    assert.deepEqual(headingsOf(html), ["1·Verbo"]);
    assert.deepEqual(definitionLines(html), ["(vulgar) fare un ditalino"]);
    assert.doesNotMatch(html, /id="forms-/, "sditalinare: shows a Forms block");
    assert.doesNotMatch(textOf(html), /gerundio|ausiliare/, "sditalinare: a non-finite row");
  });
});

/** `fixtures/salivate.jsonl`: salivate, salivare (adjective and verb) and saliva (noun and verb form), as the release has them. */
const SALIVATE_LINES = (await readFile(join(REPO, "fixtures/salivate.jsonl"), "utf8")).trimEnd().split("\n");

test("a searched compound form is one block: Voce verbale · its verb, the line built from its cell, then Forms of the verb opened at it (#627, #636)", async () => {
  await withDevSeed(async ({ db }) => {
    const html = await render(db, "sono andato");
    assert.deepEqual(headingsOf(html), ["1·Voce verbale·andare"]);
    const block = verbBlock(html, "andare");
    assert.ok(block !== undefined, "sono andato: no andare block");
    assert.deepEqual(definitionLines(block), ["prima persona singolare del passato prossimo indicativo di andare"]);
    // The lemma links to its search, as frame 17's line links it.
    assert.match(block, /indicativo di <a class="[^"]*" href="\/\?q=andare">andare<\/a><\/p>/);
    // Nothing on the page says the line was built by rule (ADR 0016).
    assert.doesNotMatch(html, /lexema-deterministic|it-verb-form-line|generated/i);
    // Then andare's table, the compound tenses open at the marked cell, and
    // no Verbo reading and none of andare's definitions.
    assert.deepEqual(lemmaFormsOf(block), ["Forms ofandare"]);
    assert.equal(occurrencesOf(html, 'data-mood="Indicativo"'), 1, "one conjugation table on the page");
    assert.match(panel(block, "Indicativo"), /<button type="button" data-panel-open=""[^>]*aria-expanded="true"[^>]*><span [^>]*>\+ more/);
    assert.deepEqual(searchedForms(block), ["sono andato"]);
    assert.doesNotMatch(html, />Verbo</);
    const definitions = await verbDefinitions(db, "andare");
    assert.ok(definitions.length > 0);
    for (const definition of definitions) assert.ok(!textOf(html).includes(definition), `sono andato: shows andare's "${definition}"`);
  });
});

test("a compound form in two moods' cells gives a line for each, one in three cells three, in one block; a form with a record of its own shows its record's lines (#627, #636)", async () => {
  await withDevSeed(async ({ db }) => {
    const siamo = await render(db, "siamo andati");
    assert.deepEqual(headingsOf(siamo), ["1·Voce verbale·andare"]);
    assert.deepEqual(definitionLines(verbBlock(siamo, "andare") ?? ""), [
      "prima persona plurale del passato prossimo indicativo di andare",
      "prima persona plurale del passato congiuntivo di andare",
    ]);
    const siaPage = await render(db, "sia andato");
    assert.deepEqual(headingsOf(siaPage), ["1·Voce verbale·andare"]);
    const sia = verbBlock(siaPage, "andare") ?? "";
    assert.deepEqual(definitionLines(sia), [
      "prima persona singolare del passato congiuntivo di andare",
      "seconda persona singolare del passato congiuntivo di andare",
      "terza persona singolare del passato congiuntivo di andare",
    ]);
    // Closed, the first line shows, then the one expand control.
    assert.deepEqual(closedLines(sia), ["prima persona singolare del passato congiuntivo di andare"]);
    assert.match(sia, /\+ more/);
    assert.deepEqual(definitionLines(verbBlock(await render(db, "sarei andato"), "andare") ?? ""), [
      "prima persona singolare del passato condizionale di andare",
    ]);

    // A form whose own record says what it is: that record's line, then andare's table.
    const andavano = await render(db, "andavano");
    assert.deepEqual(headingsOf(andavano), ["1·Voce verbale·andare"]);
    assert.deepEqual(definitionLines(verbBlock(andavano, "andare") ?? ""), ["terza persona plurale dell'imperfetto indicativo di andareloro/essi andavano"]);
    assert.deepEqual(lemmaFormsOf(andavano), ["Forms ofandare"]);
    // The verb's own page reads as before.
    assert.deepEqual(headingsOf(await render(db, "andare")), ["1·Sostantivo·maschile", "2·Verbo"]);

    // The dev seed has no record of `andassi`, so here it is a form only its
    // verb's table holds: one block with a line for each of its two cells.
    const andassi = await render(db, "andassi");
    assert.deepEqual(headingsOf(andassi), ["1·Voce verbale·andare"]);
    assert.deepEqual(definitionLines(verbBlock(andassi, "andare") ?? ""), [
      "prima persona singolare dell'imperfetto congiuntivo di andare",
      "seconda persona singolare dell'imperfetto congiuntivo di andare",
    ]);
    assert.deepEqual(lemmaFormsOf(andassi), ["Forms ofandare"]);
  });
  // With its own record, as the release has it, `andassi` shows the record's
  // lines alone, then andare's table under them.
  const andassi = JSON.stringify({
    word: "andassi",
    lang_code: "it",
    lang: "Italiano",
    pos: "verb",
    pos_title: "Voce verbale",
    senses: [
      { glosses: ["prima persona congiuntivo imperfetto di andare"], tags: ["form-of"], form_of: [{ word: "andare" }] },
      { glosses: ["seconda persona congiuntivo imperfetto di andare"], tags: ["form-of"], form_of: [{ word: "andare" }] },
    ],
    tags: ["form-of"],
  });
  await withLines([...(await devSeedLines()), andassi], async ({ db }) => {
    const html = await render(db, "andassi");
    assert.deepEqual(headingsOf(html), ["1·Voce verbale·andare"]);
    const block = verbBlock(html, "andare") ?? "";
    assert.deepEqual(definitionLines(block), [
      "prima persona congiuntivo imperfetto di andare",
      "seconda persona congiuntivo imperfetto di andare",
    ]);
    assert.deepEqual(lemmaFormsOf(block), ["Forms ofandare"]);
  });
});

test("a form of two verbs is one block per verb, each line under its verb's heading and above its verb's table (#636, frame 37)", async () => {
  await withLines([...(await devSeedLines()), ...SALIVATE_LINES], async ({ db }) => {
    const html = await render(db, "salivate");
    assert.deepEqual(headingsOf(html), ["1·Voce verbale·salire", "2·Voce verbale·salivare"]);

    // salire's line is built from its table, which lists salivate.
    const salire = verbBlock(html, "salire") ?? "";
    assert.deepEqual(definitionLines(salire), ["seconda persona plurale dell'imperfetto indicativo di salire"]);
    assert.deepEqual(lemmaFormsOf(salire), ["Forms ofsalire"]);
    assert.deepEqual(searchedForms(salire), ["salivate"]);

    // salivare's two lines are salivate's own record's; the second waits for + more.
    const salivare = verbBlock(html, "salivare") ?? "";
    assert.deepEqual(definitionLines(salivare), [
      "seconda persona plurale dell'indicativo presente di salivare",
      "seconda persona plurale dell'imperativo di salivare",
    ]);
    assert.deepEqual(closedLines(salivare), ["seconda persona plurale dell'indicativo presente di salivare"]);
    assert.match(salivare, /\+ more/);
    assert.deepEqual(lemmaFormsOf(salivare), ["Forms ofsalivare"]);
    assert.deepEqual(searchedForms(salivare), ["salivate", "salivate"]);

    // No salire definitions anywhere on the page, and no Verbo reading.
    assert.doesNotMatch(html, />Verbo</);
    for (const definition of await verbDefinitions(db, "salire")) {
      assert.ok(!textOf(html).includes(definition), `salivate: shows salire's "${definition}"`);
    }
    // A form of two verbs names both under the headword, though it has only
    // two readings (#654, frame 37), each link pointing to its block.
    const verbJumps = [...html.matchAll(new RegExp(`<a class="${esc(JUMP_LINK)}" href="#([^"]+)">(.*?)</a>`, "g"))];
    assert.deepEqual(verbJumps.map((match) => textOf(match[2])), ["1Voce verbale · salire", "2Voce verbale · salivare"]);
    for (const [, id] of verbJumps) assert.equal(patternsOf(html, new RegExp(`<article [^>]*id="${esc(id)}"`)), 1, id);
    assert.deepEqual(
      verbJumps.map(([, id]) => id),
      ["salire", "salivare"].map((verb) => `reading-voce-verbale-${verb}`),
    );

    // The report names each record the page shows once, with its block's
    // number: salire's, whose table block 1 draws, and salivate's.
    const answer = await attempt(db, "salivate");
    assert.ok(answer.outcome === "found" && answer.route.kind !== "phrase");
    const page = wordPage("salivate", answer.readings, answer.lemmas);
    const records = await readingsFor(db, "salivate");
    assert.deepEqual(
      reportReadings(shownRecords(page.readings)).map((reading) => [readingChoiceLabel(reading), reading.recordId]),
      [
        ["1 · Voce verbale · salire", records.find((reading) => reading.word === "salire")?.recordId],
        ["2 · Voce verbale · salivare", records.find((reading) => reading.word === "salivate")?.recordId],
      ],
    );

    // One record naming two verbs gives a line to each: saliva the noun, then
    // its Voce verbale record's salivare line, then its salire line.
    const saliva = await render(db, "saliva");
    assert.deepEqual(headingsOf(saliva), ["1·Sostantivo·femminile, invariabile", "2·Voce verbale·salivare", "3·Voce verbale·salire"]);
    assert.deepEqual(definitionLines(verbBlock(saliva, "salivare") ?? ""), ["terza persona singolare, tempo presente del verbo salivare"]);
    assert.deepEqual(definitionLines(verbBlock(saliva, "salire") ?? ""), ["terza persona singolare, tempo imperfetto del verbo salire"]);
    assert.deepEqual(lemmaFormsOf(verbBlock(saliva, "salire") ?? ""), ["Forms ofsalire"]);
    const jumps = [...saliva.matchAll(new RegExp(`<a class="${esc(JUMP_LINK)}" href="#([^"]+)">(.*?)</a>`, "g"))];
    assert.deepEqual(jumps.map((match) => textOf(match[2])), ["1Sostantivo", "2Voce verbale · salivare", "3Voce verbale · salire"]);
  });
});

test("a form that is also a noun keeps its noun readings, and its verb form is a headed block with its verb's table (#636)", async () => {
  await withDevSeed(async ({ db }) => {
    const sale = await render(db, "sale");
    assert.deepEqual(headingsOf(sale), ["1·Sostantivo·maschile, singolare", "2·Sostantivo, forma flessa·femminile, plurale", "3·Voce verbale·salire"]);
    const salire = verbBlock(sale, "salire") ?? "";
    assert.deepEqual(lemmaFormsOf(salire), ["Forms ofsalire"]);
    assert.deepEqual(searchedForms(salire), ["sale"]);
    // Each block has its own anchor, and every jump link resolves to one.
    const jumps = [...sale.matchAll(new RegExp(`<a class="${esc(JUMP_LINK)}" href="#([^"]+)">(.*?)</a>`, "g"))];
    assert.deepEqual(jumps.map((match) => textOf(match[2])), ["1Sostantivo", "2Sostantivo, forma flessa", "3Voce verbale · salire"]);
    for (const [, id] of jumps) assert.equal(patternsOf(sale, new RegExp(`<article [^>]*id="${esc(id)}"`)), 1, id);
    assert.deepEqual(
      reportReadings(shownRecords(wordPage("sale", await readingsFor(db, "sale"), []).readings)).map(readingChoiceLabel),
      ["1 · Sostantivo", "2 · Sostantivo, forma flessa", "3 · Voce verbale · salire"],
    );

    // andati the adjective form reads as before; its verb form is andare's
    // block. andare's table lists `andato` and not `andati`, and the block
    // still shows it whole, as its only Forms (#666).
    const andati = await render(db, "andati");
    assert.deepEqual(headingsOf(andati), ["1·Aggettivo, forma flessa·maschile", "2·Voce verbale·andare"]);
    const verb = verbBlock(andati, "andare") ?? "";
    assert.deepEqual(definitionLines(verb), ["participio passato plurale maschile di andare"]);
    assert.deepEqual(lemmaFormsOf(verb), ["Forms ofandare"]);
    assertWholeUnmarkedConjugation(verb, "andati");
    // studente the noun reads as before; its verb form is studiare's block.
    assert.deepEqual(headingsOf(await render(db, "studente")), ["1·Sostantivo·maschile, singolare", "2·Voce verbale·studiare"]);
  });
});

test("the rule-built line is kept apart from a source line in the page's data: its source type, rule and the forms[] entry it came from (#627, #636)", async () => {
  await withDevSeed(async ({ db }) => {
    const answer = await attempt(db, "sono andato");
    assert.ok(answer.outcome === "found" && answer.route.kind !== "phrase");
    const page = wordPage("sono andato", answer.readings, answer.lemmas);
    assert.equal(page.readings.length, 1);
    const [block] = page.readings;
    assert.ok(block.kind === "verb-form");
    assert.equal(block.number, 1);
    assert.equal(block.verb, "andare");
    const [verb] = block.verbs;
    assert.ok(verb !== undefined && verb.word === "andare");
    assert.deepEqual(block.lines, [
      {
        kind: "rule",
        text: "prima persona singolare del passato prossimo indicativo di andare",
        lemma: "andare",
        sourceType: "lexema-deterministic",
        rule: "it-verb-form-line/v1",
        ref: verb.evidence.find((occurrence) => occurrence.surface === "sono andato")?.ref,
      },
    ]);
    const [line] = block.lines;
    assert.ok(line.kind === "rule");
    assert.equal(line.ref.jsonPointer, "/forms/29/form");
    // A report names the verb record whose table the block shows, under the block's number.
    assert.deepEqual(reportReadings(shownRecords(page.readings)).map((reading) => [reading.number, reading.recordId]), [[1, verb.recordId]]);

    // A source line is the record's own definition, kept by its type.
    const andavano = await attempt(db, "andavano");
    assert.ok(andavano.outcome === "found" && andavano.route.kind !== "phrase");
    const [form] = wordPage("andavano", andavano.readings, andavano.lemmas).readings;
    assert.ok(form.kind === "verb-form");
    assert.deepEqual(form.lines.map((one) => one.kind), ["source"]);
  });
});

test("etymology and synonyms come once after the readings: every synonym a search, then + more and no count", async () => {
  await withDevSeed(async ({ db }) => {
    const html = await render(db, "andare");
    const facts = html.slice(html.lastIndexOf("</article>"));
    assert.equal(patternsOf(html, />Etymology</g), 1);
    const synonyms = facts.slice(facts.indexOf('id="synonyms"'), facts.indexOf("</section>", facts.indexOf('id="synonyms"')));
    const words = [...synonyms.matchAll(new RegExp(`<a class="${esc(WORD_LINK)}" href="([^"]+)" lang="it">([^<]+)</a>`, "g"))];
    assert.equal(words.length, wordPage("andare", await readingsFor(db, "andare"), []).wordFacts.synonyms.length, "every synonym is in the document");
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

test("the plural-gloss rule's corrections render as plain data: plural nouns and adjectives read plurale with their gender's articles, a wrong-gloss noun reads singolare (#483)", async () => {
  const words = ["agostiniani", "guerriglieri", "curve", "competitive", "mima", "mimo"];
  const pages = async (corrected: boolean): Promise<Record<string, string>> => {
    let read: Record<string, string> = {};
    await withCorrectionLines(corrected, async ({ db }) => {
      read = Object.fromEntries(await Promise.all(words.map(async (word) => [word, await render(db, word)] as const)));
    });
    return read;
  };
  const [before, after] = [await pages(false), await pages(true)];

  // `agostiniani` [noun] is tagged feminine singular: `l'agostiniani`, in the femminile singolare.
  assert.deepEqual(headingsOf(before.agostiniani), ["1·Sostantivo·maschile, singolare", "2·Sostantivo·femminile, singolare"]);
  assert.deepEqual(gridRows(nth(before.agostiniani, 2))[2], ["femminile", "agostinianil'agostiniani·un'agostinianiagostinianal'agostiniana·un'agostiniana", "agostinianele agostiniane·delle agostiniane"]);
  // Corrected to masculine plural, as en.wiktionary states it: `gli agostiniani`.
  assert.deepEqual(headingsOf(after.agostiniani), ["1·Sostantivo·maschile, singolare", "2·Sostantivo·maschile, plurale"]);
  assert.deepEqual(gridRows(nth(after.agostiniani, 2)), [
    HEAD,
    ["maschile", "agostinianol'agostiniano·un agostiniano", "agostinianigli agostiniani·degli agostiniani"],
    ["femminile", "agostinianal'agostiniana·un'agostiniana", "agostinianele agostiniane·delle agostiniane"],
  ]);
  // A number-only correction keeps the tagged gender: `i guerriglieri`, never `il guerriglieri`.
  assert.deepEqual(headingsOf(before.guerriglieri), ["1·Sostantivo, forma flessa·maschile, singolare"]);
  assert.deepEqual(headingsOf(after.guerriglieri), ["1·Sostantivo, forma flessa·maschile, plurale"]);
  assert.deepEqual(gridRows(nth(after.guerriglieri, 1))[1], ["maschile", "guerriglieroil guerrigliero·un guerrigliero", "guerriglierii guerriglieri·dei guerriglieri"]);

  // Adjectives: `curve` tagged masculine singular, `competitive` feminine singular; each heading now says plurale.
  assert.deepEqual(headingsOf(before.curve), ["1·Aggettivo, forma flessa·maschile, singolare"]);
  assert.deepEqual(headingsOf(after.curve), ["1·Aggettivo, forma flessa·femminile, plurale"]);
  assert.deepEqual(gridRows(nth(after.curve, 1)), [HEAD, ["maschile", "curvoil curvo·un curvo", "curvii curvi·dei curvi"], ["femminile", "curvala curva·una curva", "curvele curve·delle curve"]]);
  assert.deepEqual(headingsOf(before.competitive), ["1·Aggettivo, forma flessa·femminile, singolare"]);
  assert.deepEqual(headingsOf(after.competitive), ["1·Aggettivo, forma flessa·femminile, plurale"]);
  assert.deepEqual(gridRows(nth(after.competitive, 1))[2], ["femminile", "competitivala competitiva·una competitiva", "competitivele competitive·delle competitive"]);

  // `mima` says "femminile plurale di mimo" and is mimo's femminile singolare: it stays singolare, beside mimo.
  assert.deepEqual(headingsOf(after.mima), ["1·Sostantivo·maschile, singolare", "2·Sostantivo·femminile, singolare"]);
  assert.deepEqual(gridRows(nth(after.mimo, 1))[2], ["femminile", "mimala mima·una mima", "mimele mime·delle mime"]);
  assert.equal(after.mima, before.mima);

  // The page shows the corrected facts as data, and nothing about the correction (ADR 0016).
  for (const page of Object.values(after)) {
    assert.doesNotMatch(page, /wiktionary\.org\/w\/index\.php|oldid|it-page-test:\d|corrett|corrected|correction|it-plural-gloss/i);
  }
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
          correction: null,
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
    assert.deepEqual(headingsOf(html), ["1·Sostantivo·femminile", "2·Voce verbale·macchinare"]);
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

test("every link that leaves Lexema, on a result, opens in a new tab; every link inside it stays", async () => {
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

// Board 32 (#478): a word found whose query a headword also writes with an
// accent or a final apostrophe, over real archive lines (e and è, Po and po',
// abbandono and abbandonò, città).
test("a found word that a headword also writes with a mark offers it in one line under the bar, above the result", async () => {
  const lines = (await readFile(join(REPO, "fixtures/bare-spellings.jsonl"), "utf8")).trim().split("\n");
  await withLines(lines, async ({ db }) => {
    // React writes an apostrophe as `&#x27;`, in text and in attributes.
    const html = (text: string) => esc(text).replaceAll("'", "&#x27;");
    const line = (word: string) =>
      new RegExp(
        `<p class="${esc(WRITTEN_OFFER_LEAD)}">Did you mean <a class="${esc(WRITTEN_OFFER_LINK)}" href="/\\?q=${html(encodeURIComponent(word))}" lang="it">${html(word)}</a>\\?</p>`,
      );
    for (const [query, word] of [
      ["po", "po'"],
      ["e", "è"],
      ["abbandono", "abbandonò"],
    ] as const) {
      const page = await render(db, query);
      const offer = page.search(line(word));
      assert.ok(offer >= 0, `${query} offers ${word}`);
      assert.ok(offer > page.indexOf("<form"), `${query}: the line sits under the search bar`);
      assert.ok(offer < page.indexOf(`<h1 class="${WORD_HEADING}"`), `${query}: the line sits above the result`);
      assert.equal(page.match(/Did you mean/g)?.length, 1, `${query}: one line`);
      // The result below is the one the search finds without the line, but
      // for the ids React generates from where an element sits.
      const answer = await attempt(db, query);
      assert.ok(answer.outcome === "found");
      const ids = (html: string) => html.replaceAll(/_R_[0-9a-z]+_/g, "_R_");
      const without = renderToStaticMarkup(
        <SearchPage raw={query} version={VERSION}>
          <Outcome raw={query} attempt={{ ...answer, written: [] }} />
        </SearchPage>,
      );
      assert.equal(ids(page.replace(line(word), "")), ids(without));
    }
    for (const query of ["città", "abbandonò", "dalla"]) {
      assert.doesNotMatch(await render(db, query), /Did you mean/, `${query} offers nothing`);
    }
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
  // Frame 00 draws the field before a query larger than the result frames draw it.
  assert.match(home, new RegExp(`class="${esc(SEARCH_FIELD.centred)}"`));
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
    assert.match(html, new RegExp(`class="${esc(SEARCH_FIELD.top)}"`));
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

test("the footer links Licence, Privacy, Contact and Developers, and marks the page being shown", async () => {
  const linksOf = (current: string) =>
    [...renderToStaticMarkup(<SiteFooter origins={ORIGIN} current={current} />).matchAll(/<a class="([^"]*)" href="([^"]+)"( aria-current="page")?>([^<]+)<\/a>/g)]
      .filter((match) => match[1] === SITE_FOOTER_LINK)
      .map((match) => [match[4], match[2], match[3] !== undefined]);
  assert.deepEqual(linksOf("/"), [
    ["Licence", "/licence", false],
    ["Privacy", "/privacy", false],
    ["Contact", `mailto:${CONTACT_EMAIL}`, false],
    ["Developers", "https://developers.lexema.fyi", false],
  ]);
  assert.deepEqual(linksOf("/licence").map(([label, , current]) => [label, current]), [["Licence", true], ["Privacy", false], ["Contact", false], ["Developers", false]]);
  assert.deepEqual(linksOf("/privacy").map(([label, , current]) => [label, current]), [["Licence", false], ["Privacy", true], ["Contact", false], ["Developers", false]]);
  // Contact is a mail link, so no page is ever its own: it is never marked.
  assert.deepEqual(linksOf(`mailto:${CONTACT_EMAIL}`).map(([label, , current]) => [label, current]), [["Licence", false], ["Privacy", false], ["Contact", false], ["Developers", false]]);
  // The marked link is drawn highlighted, in the strong text role.
  assert.ok(SITE_FOOTER_LINK.split(" ").includes("aria-[current=page]:text-text-strong"));
  // The footer's wordmark goes home, in the same tab, like the top bar's.
  const footer = renderToStaticMarkup(<SiteFooter origins={ORIGIN} current="/" />);
  assert.match(footer, new RegExp(`<a class="${esc(SITE_FOOTER_NAME)}" href="/">Lexema</a>`));
  assert.match(renderToStaticMarkup(<SiteHeader />), /<a class="[^"]*" href="\/">Lexema<\/a>/);

  // The layout imports globals.css, which Node cannot load, so that it carries
  // this footer, told the page being shown, is asserted on the files.
  const layout = await readFile(join(REPO, "web/app/(lexema)/layout.tsx"), "utf8");
  assert.match(layout, /const \{ developers \} = await siteOrigins\(\);/);
  // Only the origin the footer links to crosses into the client component (#647).
  assert.match(layout, /<CurrentSiteFooter origins=\{\{ developers \}\} \/>/);
  const current = await readFile(join(REPO, "web/components/dictionary/CurrentSiteFooter.tsx"), "utf8");
  assert.match(current, /<SiteFooter origins=\{origins\} current=\{usePathname\(\)\} \/>/);
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

/** The release today's repository serves, read from `dictionary-changes/` as the build reads it. */
const SERVED = await readServedRelease(REPO);

/** The Licence page as the route serves it, over a release. It reads no database. */
const licence = (release: ServedRelease = SERVED): string => renderToStaticMarkup(<Licence release={release} />);
const privacy = (): string => renderToStaticMarkup(<Privacy />);

/** The words a reader reads: tags, and the screen reader's "(opens in a new tab)", taken out. */
const readOf = (html: string): string => textOf(html.replace(/<span class="sr-only">[^<]*<\/span>/g, "")).replace(/&amp;/g, "&");

/** One section of a legal page, by its id. */
function sectionOf(html: string, id: string): string {
  const open = html.indexOf(`<section class="${LEGAL_SECTION}" id="${id}"`);
  assert.notEqual(open, -1, `no section #${id}`);
  return html.slice(open, html.indexOf("</section>", open));
}

/** A section as a reader reads it: its heading, then each paragraph and item in order. */
function readSection(html: string, id: string): { heading: string; blocks: string[] } {
  const section = sectionOf(html, id);
  const heading = section.match(/<h2[^>]*>(.*?)<\/h2>/);
  assert.ok(heading, `#${id} has a heading`);
  const blocks = [...section.matchAll(/<(p|li)\b[^>]*>(.*?)<\/\1>/g)].map((match) => readOf(match[2]));
  return { heading: readOf(heading[1]), blocks };
}

/** Every section of a legal page, in order: its id and its numbered heading. */
const sectionsOf = (html: string): [string, string][] =>
  [...html.matchAll(new RegExp(`<section class="${esc(LEGAL_SECTION)}" id="([^"]+)"[^>]*><h2[^>]*>(.*?)</h2>`, "g"))].map((match) => [
    match[1],
    readOf(match[2]),
  ]);

test("the Licence page reads, section by section, exactly as Huey approved it (#139)", () => {
  const html = licence();
  assert.match(html, exact(`<p class="${LEGAL_KICKER}">LEXEMA · LEGAL</p>`));
  assert.match(html, exact(`<h1 class="${LEGAL_TITLE}">Licence</h1>`));
  assert.match(html, exact(`<p class="${LEGAL_EFFECTIVE}">Effective 4 October 2026</p>`));
  assert.match(
    html,
    exact(
      `<p class="${LEGAL_LEDE}">This page sets out the terms under which the lexical content published on Lexema may be reused, and credits the sources from which it is derived.</p>`,
    ),
  );
  const expected: [string, string, string[]][] = [
    ["licence", "1. Licence", ["The definitions and other lexical content derived from the sources below are made available under the Creative Commons Attribution-ShareAlike 4.0 International licence (CC BY-SA 4.0)."]],
    [
      "reuse",
      "2. Reuse",
      [
        "Under that licence you may:",
        "(a) copy and redistribute the content in any medium or format;",
        "(b) adapt, transform and build upon it, for any purpose, including commercially;",
        "provided that you give appropriate credit, provide a link to the licence, indicate any changes made, and distribute your contributions under the same licence.",
      ],
    ],
    [
      "where",
      "3. Sources",
      [
        "The content is derived from the Italian Wiktionary (Wikizionario), a project of the Wikimedia Foundation written by volunteer contributors. Most entries are taken from the extraction published by kaikki.org, produced with wiktextract by Tatu Ylonen. Where that extraction could not read a page, Lexema reads the entry from the page’s own text in the Wikimedia dump.",
        "The authors of each entry are recorded in the revision history of its Wiktionary page. Every entry on Lexema links to that page.",
      ],
    ],
    [
      "changed",
      "4. Modifications",
      ["Lexema has adapted the source material: it is restructured and indexed for search, some grammatical information is added by rule, some wording is made consistent, and individual errors are corrected. Lexema does not write or generate definitions."],
    ],
    ["version", "5. Version of the data", ["The content is up to date with release it-78385b62, published by kaikki.org and built from the Italian Wiktionary dump of 1 September 2026."]],
    [
      "disclaimer",
      "6. Disclaimer",
      ["The content is provided “as is”, without warranties of any kind, as set out in section 5 of the licence. Lexema does not warrant that the content is accurate, complete or fit for any particular purpose."],
    ],
    [
      "trademarks",
      "7. Trademarks",
      ["Wikipedia, Wiktionary, Wikizionario and Wikimedia are registered trademarks of the Wikimedia Foundation, Inc. Lexema is not affiliated with, endorsed or sponsored by the Wikimedia Foundation."],
    ],
  ];
  assert.deepEqual(sectionsOf(html), expected.map(([id, heading]) => [id, heading]));
  for (const [id, heading, blocks] of expected) assert.deepEqual(readSection(html, id), { heading, blocks }, id);
});

test("the Licence page links each source and the licence where /attribution did, each in a new tab", () => {
  const html = licence();
  const external = [...html.matchAll(/<a ([^>]*href="(https?:\/\/[^"]+)"[^>]*)>(.*?)<\/a>/g)];
  assert.deepEqual(
    external.map((match) => [readOf(match[3]), match[2]]),
    [
      ["Creative Commons Attribution-ShareAlike 4.0 International licence (CC BY-SA 4.0)", "https://creativecommons.org/licenses/by-sa/4.0/"],
      ["Italian Wiktionary", "https://it.wiktionary.org/"],
      ["Wikimedia Foundation", "https://wikimediafoundation.org/"],
      ["kaikki.org", "https://kaikki.org/itwiktionary/"],
      ["wiktextract", "https://github.com/tatuylonen/wiktextract"],
      // The dump's own page, as /attribution linked it: the served release's dump.
      ["Wikimedia dump", "https://dumps.wikimedia.org/itwiktionary/20260901/"],
      ["section 5 of the licence", "https://creativecommons.org/licenses/by-sa/4.0/legalcode"],
    ],
  );
  for (const [, attributes, , inner] of external) {
    assert.match(attributes, /target="_blank" rel="noopener noreferrer"/, attributes);
    assert.match(inner, /opens in a new tab/, attributes);
  }
  for (const page of [html, privacy()]) {
    for (const [, attributes] of page.matchAll(/<a ([^>]*href="(?:[/#]|mailto:)[^>]*)>/g)) assert.doesNotMatch(attributes, /target=/, attributes);
  }
});

test("the Privacy page reads, section by section, exactly as Huey approved it (#139)", () => {
  const html = privacy();
  assert.match(html, exact(`<p class="${LEGAL_KICKER}">LEXEMA · LEGAL</p>`));
  assert.match(html, exact(`<h1 class="${LEGAL_TITLE}">Privacy</h1>`));
  assert.match(html, exact(`<p class="${LEGAL_EFFECTIVE}">Effective 4 October 2026</p>`));
  assert.match(
    html,
    exact(`<p class="${LEGAL_LEDE}">This notice explains what information Lexema processes when you use lexema.fyi, why, and for how long.</p>`),
  );
  const expected: [string, string, string[]][] = [
    [
      "information",
      "1. Information we process",
      [
        "Lexema has no user accounts and does not use advertising, analytics or tracking cookies. We process only:",
        "(a) your IP address, transiently, to limit the number of requests a single visitor can make. It is not stored;",
        "(b) when you report a mistake or suggest a correction: the entry, the option you selected, any note you write, and, for one hour, a one-way code derived from your IP address, used only to limit the number of reports per hour.",
      ],
    ],
    [
      "purpose",
      "2. Purpose and legal basis",
      ["We process this information to operate the service, protect it from abuse and review reported errors. The legal basis is our legitimate interest in providing a reliable dictionary (Article 6(1)(f) GDPR)."],
    ],
    [
      "providers",
      "3. Service providers",
      ["Lexema is hosted by Cloudflare, Inc., which processes requests on our behalf and may keep short-lived security logs. Report forms are protected by Cloudflare Turnstile. We do not sell or share information with anyone else."],
    ],
    [
      "retention",
      "4. Retention",
      ["Request counts expire within minutes. The code derived from your IP address is erased one hour after a report is sent. Reports themselves are kept as a record of corrections to the dictionary; any note you wrote is erased as soon as the report is resolved."],
    ],
    [
      "rights",
      "5. Your rights",
      ["Because Lexema does not store your IP address or any account, we generally cannot link stored information to you. Until a report is resolved, you may ask us to remove a note you wrote, using the address below. You also have the right to lodge a complaint with your data protection authority."],
    ],
    ["changes", "6. Changes", ["We may update this notice. The effective date above shows when it last changed."]],
    ["contact", "7. Contact", ["For any question about this notice, write to:", "privacy@lexema.fyi"]],
  ];
  assert.deepEqual(sectionsOf(html), expected.map(([id, heading]) => [id, heading]));
  for (const [id, heading, blocks] of expected) assert.deepEqual(readSection(html, id), { heading, blocks }, id);
  // The address is a mailto link, on a line of its own.
  assert.match(
    sectionOf(html, "contact"),
    exact(`<p class="${LEGAL_ADDRESS}"><a class="${LINK}" href="mailto:privacy@lexema.fyi">privacy@lexema.fyi</a></p>`),
  );
});

test("both legal pages: the header, a Contents column on a wide screen only, no attribution heading and no note about the page", async () => {
  for (const html of [licence(), privacy()]) {
    assert.match(html, exact(renderToStaticMarkup(<SiteHeader />)));
    // The Contents column lists every section, in order, each a link to it; on a phone it is hidden.
    const contents = html.slice(html.indexOf(`<nav class="${LEGAL_CONTENTS}"`), html.indexOf("</nav>"));
    assert.deepEqual(LEGAL_CONTENTS.split(" "), ["hidden", "sm:block"], "no Contents column on a phone");
    const entries = [...contents.matchAll(/<a class="[^"]*" href="#([^"]+)"( aria-current="location")?>(.*?)<\/a>/g)];
    const listed = entries.map((match) => [match[1], readOf(match[3])]);
    assert.deepEqual(listed, sectionsOf(html));
    assert.equal(listed.length, 7);
    // At rest the page is at its top, so entry 1 is the section being read, and no other (#581).
    assert.deepEqual(
      entries.map((match) => match[2] !== undefined),
      [true, false, false, false, false, false, false],
    );
    // "attribution" is never a heading, and nothing on the page talks about the page.
    for (const [, heading] of html.matchAll(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/g)) assert.doesNotMatch(heading, /attribution/i);
    assert.doesNotMatch(readOf(html), /Still open|— open|not recorded|recovered|derived by Lexema/i);
    assert.equal(patternsOf(html, /<h1[\s>]/), 1);
  }
  const { metadata: licenceMeta } = await import("@/app/(lexema)/licence/page");
  const { metadata: privacyMeta } = await import("@/app/(lexema)/privacy/page");
  assert.equal(licenceMeta.title, "Licence — Lexema");
  assert.equal(privacyMeta.title, "Privacy — Lexema");
});

test("every dictionary page puts header, text and footer 20 px in on a phone, as frames 19 to 21, 33m and 34m draw (#588, #595)", () => {
  const gutter = (classes: string) => classes.split(" ").filter((name) => /^(sm:)?px-/.test(name));
  for (const html of [licence(), privacy()]) assert.match(html, exact(`<main class="${LEGAL_SHELL.dictionary}">`));
  const footerOf = (current: string) =>
    renderToStaticMarkup(<SiteFooter origins={ORIGIN} current={current} />).match(/<footer[^>]*><div class="([^"]*)"/)?.[1] ?? "";
  const header = renderToStaticMarkup(<SiteHeader />).match(/<header[^>]*><div class="([^"]*)"/)?.[1] ?? "";
  const shells = [LEGAL_SHELL.dictionary, SHELL_TOP, header, footerOf("/"), footerOf("/licence"), footerOf("/privacy")];
  for (const classes of shells) assert.deepEqual(gutter(classes), ["px-5", "sm:px-6"], classes);
});

test("on a phone a legal section number is its own width and a fixed gap; from sm up it keeps #585's slot (#588)", () => {
  const classes = LEGAL_SECTION_NUMBER.split(" ");
  assert.ok(classes.includes("w-(--legal-hang)"), "the wide slot");
  assert.ok(classes.includes("max-sm:w-auto"), "no slot on a phone");
  assert.ok(classes.includes("max-sm:mr-4"), "frames 33m to 36m: the title 16 px after the number");
});

test("the dictionary's legal pages have one-digit section numbers, so their titles take frames 33 and 34's edge (#596)", () => {
  for (const html of [licence(), privacy()]) assert.match(html, exact(`<div class="${LEGAL_LAYOUT[1]}">`));
});

test("a legal page's heading and Contents link read the number, a full stop and a space before the title (#581)", () => {
  for (const [html, id, read] of [
    [licence(), "licence", "1. Licence"],
    [privacy(), "information", "1. Information we process"],
  ] as const) {
    const heading = sectionOf(html, id).match(/<h2[^>]*>(.*?)<\/h2>/);
    assert.equal(textOf(heading?.[1] ?? ""), read);
    const link = html.match(new RegExp(`<a class="[^"]*" href="#${id}"[^>]*>(.*?)</a>`));
    assert.equal(textOf(link?.[1] ?? ""), read);
  }
});

test("the Contents mark follows the section whose top has passed the read line, and the last one at the end (#581)", () => {
  assert.equal(readingIndex([400, 700, 1000], false), 0);
  assert.equal(readingIndex([-300, 20, 600], false), 1);
  assert.equal(readingIndex([-900, -500, 300], true), 2);
});

test("Privacy keeps \"one-way\" on one line on a phone (#581)", () => {
  assert.match(sectionOf(privacy(), "information"), exact(`<span class="${LEGAL_UNBROKEN}">one-way</span>`));
});

test("the old /attribution sections land on the /licence sections that replaced them", () => {
  const html = licence();
  assert.deepEqual(
    ["licence", "where", "changed", "version", "trademarks"].map((id) => readSection(html, id).heading),
    ["1. Licence", "3. Sources", "4. Modifications", "5. Version of the data", "7. Trademarks"],
  );
});

test("/attribution answers a permanent redirect to /licence, and only on the dictionary's host", async () => {
  const app: string[] = [];
  const send = byHost<undefined>({
    app: async (request) => {
      app.push(request.url);
      return new Response("page");
    },
    api: async () => new Response("api"),
    apiNotFound: () => new Response("none", { status: 404 }),
  });
  const ctx = {} as ExecutionContext;
  for (const [url, location] of [
    ["https://lexema.fyi/attribution", "/licence"],
    ["https://lexema.fyi/attribution/", "/licence"],
    ["https://lexema.fyi//attribution", "/licence"],
    ["https://lexema.fyi/attribution?from=old", "/licence?from=old"],
    ["https://name.preview.lexema.fyi/attribution", "/licence"],
    ["http://localhost:8790/attribution", "/licence"],
  ]) {
    const response = await send(new Request(url), undefined, ctx);
    assert.equal(response.status, 308, url);
    assert.equal(response.headers.get("location"), location, url);
  }
  assert.deepEqual(app, []);
  // Other pages, and the developer site's own paths, are served as before.
  await send(new Request("https://lexema.fyi/licence"), undefined, ctx);
  await send(new Request("https://developers.lexema.fyi/attribution"), undefined, ctx);
  assert.deepEqual(app, ["https://lexema.fyi/licence", "https://developers.lexema.fyi/developer-site/attribution"]);
});

test("Version of the data follows the declarations: the newest feed release and its dump, else the master release", () => {
  // Today's repository: the September feed of the master.
  assert.deepEqual(SERVED, { release: "it-78385b62", dump: { date: "2026-09-01", url: "https://dumps.wikimedia.org/itwiktionary/20260901/" } });

  // A second catalog: a master and two feeds, declared out of dump order.
  const master = "a".repeat(64);
  const october = `b${"0".repeat(63)}`;
  const november = `c${"0".repeat(63)}`;
  const facts = (dump: `itwiktionary-${string}`): ArchiveFacts => ({
    sourceUrl: "https://example.invalid/it-extract.jsonl.gz",
    retrievedAt: "2026-11-02T00:00:00Z",
    dump: { id: dump, basis: "recorded" },
    evidence: [],
  });
  const catalog = { [master]: facts("itwiktionary-20260801"), [october]: facts("itwiktionary-20261001"), [november]: facts("itwiktionary-20261101") };
  const feed = (feedRelease: ReleaseId, file: string): DeclaredChange => ({ file, command: "update:auto", inputs: { feedRelease } });
  const other: DeclaredChange = { file: "dictionary-changes/2026-12-01-update-upgrade.json", command: "update:upgrade", inputs: {} };
  const version = (release: ServedRelease) => readSection(licence(release), "version").blocks;

  const fed = servedRelease(
    [feed("it-c0000000", "dictionary-changes/it-c0000000.json"), feed("it-b0000000", "dictionary-changes/2026-12-02-update-auto.json"), other],
    catalog,
    master,
  );
  assert.deepEqual(version(fed), [
    "The content is up to date with release it-c0000000, published by kaikki.org and built from the Italian Wiktionary dump of 1 November 2026.",
  ]);
  assert.match(licence(fed), exact(`href="https://dumps.wikimedia.org/itwiktionary/20261101/"`));

  // With no feed declared, the master is what the dictionary serves.
  assert.deepEqual(version(servedRelease([other], catalog, master)), [
    "The content is up to date with release it-aaaaaaaa, published by kaikki.org and built from the Italian Wiktionary dump of 1 August 2026.",
  ]);
  // A release with no recorded dump is refused, never shown without one.
  assert.throws(() => servedRelease([feed("it-dddddddd", "dictionary-changes/it-dddddddd.json")], catalog, master), ServedReleaseUnknown);
});

test("the Licence page's release is never typed into the page or its route", async () => {
  for (const file of ["web/components/dictionary/Licence.tsx", "web/app/(lexema)/licence/page.tsx"]) {
    const source = await readFile(join(REPO, file), "utf8");
    assert.doesNotMatch(source, /it-[0-9a-f]{8}|2026090|September/, file);
  }
  const config = await readFile(join(REPO, "web/vite.config.ts"), "utf8");
  assert.match(config, /__LEXEMA_SERVED_RELEASE__: JSON\.stringify\(await readServedRelease\(/);
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
      reportReadings(shownRecords(wordPage("litigante", await readingsFor(db, "litigante"), []).readings)).map(readingChoiceLabel),
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

/** The labels of a page's Expressions sections, in order. */
const expressionLabels = (html: string): string[] => expressionSections(html).map((section) => expressionRows(section).label);

test("a verb shown as a verb form block brings no Expressions with <verb>; the word's own Expressions stay (#668)", async () => {
  await withDevSeed(async ({ db }) => {
    const andavano = await render(db, "andavano");
    assert.deepEqual(headingsOf(andavano), ["1·Voce verbale·andare"]);
    assert.deepEqual(expressionLabels(andavano), []);
    // The verb's own page still lists them.
    const [andare] = expressionSections(await render(db, "andare")).map(expressionRows);
    assert.deepEqual(andare?.label, "Expressions");
    assert.deepEqual(andare?.rows[0], ["a lungo andare", "col trascorrere del tempo"]);
  });
  const lines = (await readFile(join(REPO, "fixtures/expressions.jsonl"), "utf8")).trim().split("\n");
  await withLines(lines, async ({ db }) => {
    const stato = await render(db, "stato");
    assert.ok(verbBlock(stato, "stare") !== undefined, "stato: no stare block");
    const sections = expressionSections(stato).map(expressionRows);
    assert.deepEqual(sections.map(({ label }) => label), ["Expressions"]);
    assert.equal(sections[0]?.rows.length, 5);
    assert.deepEqual(sections[0]?.rows[1], ["lo stato delle cose è questo!", null]);
  });
});

/** `fixtures/andate.jsonl`: andate's noun, adjective and verb form records, as release it-0c432803 has them (lines 138798-138800). */
const ANDATE_LINES = (await readFile(join(REPO, "fixtures/andate.jsonl"), "utf8")).trimEnd().split("\n");

test("a form page shows no `vedi <verb>` Etymology for a verb it shows as a block; the word's own facts stay (#668)", async () => {
  await withLines([...(await devSeedLines()), ...ANDATA_LINES, ...ANDATE_LINES, ...SALIVATE_LINES], async ({ db }) => {
    // andavano: one block, nothing after it.
    const andavano = await render(db, "andavano");
    assert.doesNotMatch(andavano, />Etymology</);
    assert.ok(!textOf(andavano).includes("vedi andare"));

    // andati: its only other reading is a form too, so it is a form page.
    const andati = await render(db, "andati");
    assert.deepEqual(headingsOf(andati), ["1·Aggettivo, forma flessa·maschile", "2·Voce verbale·andare"]);
    assert.ok(!textOf(andati).includes("vedi andare"), "andati: shows vedi andare");
    assert.doesNotMatch(andati, />Etymology</);
    assert.deepEqual(expressionLabels(andati), []);

    // salivate: two blocks, no vedi salivare.
    const salivate = await render(db, "salivate");
    assert.deepEqual(headingsOf(salivate), ["1·Voce verbale·salire", "2·Voce verbale·salivare"]);
    assert.ok(!textOf(salivate).includes("vedi salivare"), "salivate: shows vedi salivare");
    assert.doesNotMatch(salivate, />Etymology</);

    // andata: andata the noun is a reading of its own, so the word keeps its
    // Etymology, Synonyms and Antonyms, but not andare's expressions.
    const andata = await render(db, "andata");
    const bottom = textOf(afterReadings(andata));
    assert.match(bottom, /Etymologyvedi andare/);
    assert.deepEqual(synonymWords(afterReadings(andata), "synonyms"), ["cammino", "spostamento", "viaggio"]);
    assert.match(bottom, /Antonyms.*ritorno/);
    assert.ok(!expressionLabels(andata).includes("Expressions with andare"));

    // andate: a form page, but `da andare` points to nothing; it stays, with
    // andate's own Expressions and not andare's.
    const andate = await render(db, "andate");
    assert.ok(verbBlock(andate, "andare") !== undefined, "andate: no andare block");
    assert.match(textOf(afterReadings(andate)), /Etymologyda andare/);
    assert.deepEqual(expressionLabels(andate), ["Expressions"]);
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

// Made-up declared lemmas whose plural records a test-only curated correction
// sets right (#470): test/declaredCorrectionFixture.ts.

const withDeclaredCorrections = (corrected: boolean, run: (f: Fixture) => Promise<void>) =>
  withLines(DECLARED_CORRECTION_LINES, run, undefined, undefined, corrected ? declaredCorrections(DECLARED_CORRECTION_LINES, RELEASE) : []);

/** `declaredGridOf` over a declared lemma's one reading: each spelling as `gender number: surface`. */
async function declaredCellsOf(db: DatabaseSync, word: string): Promise<string[]> {
  const answer = await attempt(db, word);
  assert.ok(answer.outcome === "declared-lemma", `${word}: ${answer.outcome}`);
  const [reading] = answer.readings;
  assert.ok(reading.pos !== "verb");
  return (declaredGridOf(reading.word, reading.forms)?.rows ?? []).flatMap((row) =>
    row.cells.flatMap((cell, n) => cell.spellings.map((spelling) => `${row.gender} ${NUMBERS[n]}: ${spelling.surface}`)),
  );
}

test("a declared lemma's grid places a corrected plural where its correction says, and says nothing of the correction (#470)", async () => {
  await withDeclaredCorrections(false, async ({ db }) => {
    // As the source states them: both tagged feminine plural.
    assert.deepEqual(await declaredCellsOf(db, "gattolino"), ["feminine singular: gattolino", "feminine plural: gattolini"]);
    assert.deepEqual(await declaredCellsOf(db, "volpatore"), ["feminine singular: volpatore", "feminine plural: volpatrice"]);
  });
  await withDeclaredCorrections(true, async ({ db }) => {
    // A gender correction moves the plural, and the lemma with it, to maschile.
    assert.deepEqual(await declaredCellsOf(db, "gattolino"), ["masculine singular: gattolino", "masculine plural: gattolini"]);
    // A number correction to singular puts the form in singolare, and it places no lemma.
    assert.deepEqual(await declaredCellsOf(db, "volpatore"), ["feminine singular: volpatrice"]);

    const gattolino = await render(db, "gattolino");
    assert.deepEqual(gridRows(gattolino), [
      ["", "singolare", "plurale"],
      ["maschile", "gattolinoil gattolino·un gattolino", "gattolinii gattolini·dei gattolini"],
    ]);
    const volpatore = await render(db, "volpatore");
    assert.deepEqual(gridRows(volpatore), [
      ["", "singolare", "plurale"],
      ["femminile", "volpatricela volpatrice·una volpatrice", "—"],
    ]);
    // The page shows the corrected fact as data, and nothing about the correction (ADR 0016).
    for (const page of [gattolino, volpatore]) {
      assert.doesNotMatch(page, /wiktionary\.org\/w\/index\.php|oldid|it-page-test:\d|corrett|corrected|correction/i);
    }
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

test("page-only readings present their page's fields without origin marks or invented forms, and API IDs are page identities", async () => {
  // Verbatim archive lines 52740/53209, not a manufactured lemma record.
  const text = await readFile(join(REPO, "fixtures/page-entry-forms.jsonl"), "utf8");
  await withLines(text.trimEnd().split("\n"), async ({ db }) => {
    const answer = await attempt(db, "raccontare");
    assert.ok(answer.outcome === "found");
    const reading = answer.readings[0];
    assert.ok(reading.entryId !== undefined);
    const model = wordPage("raccontare", answer.readings, answer.lemmas);
    assert.equal(model.readings.length, 1);
    // A report names only a source record, so a page-only reading is not offered as a choice.
    assert.deepEqual(reportReadings(shownRecords(model.readings)), []);
    const html = await render(db, "raccontare");
    assert.match(textOf(html), /narrare, oralmente o tramite scrittura, eventi o storie/);
    assert.match(textOf(html), /rappresentare qualcosa, in genere cosa non gradita/);
    assert.match(html, new RegExp(`id="reading-page-${reading.entryId}"`));
    // The page writes no forms out, so there is no Forms block and no conjugation (ADR 0026).
    assert.doesNotMatch(html, /reading-undefined|forms-page-|<table/);
    assert.doesNotMatch(textOf(html), /recovered|page-only|italian-page|Forms|Indicativo/i);
    // Every other field its page gives, through the components and in the order an archive entry's take:
    // the IPA under the headword, the readings, then the word's facts, its expressions last, then Source.
    assert.match(html, /<h1 [^>]*lang="it">raccontare<\/h1><p class="[^"]*" aria-label="Pronunciation"><span>\/rakkonˈtare\/<\/span><\/p>/);
    const order = ["/rakkonˈtare/", "Definitions", "Etymology", "derivazione di contare", "Synonyms", "dar notizia", "Antonyms", "Derived words",
      "raccontafavole", "Expressions", "raccontare per filo e per segno", "Source"].map((text) => textOf(html).indexOf(text));
    assert.ok(order.every((at, i) => at >= 0 && (i === 0 || at > order[i - 1])), `${order}`);
    // Its `{{-sill-}}` line is not read: hyphenation is no field the word page shows.
    assert.doesNotMatch(textOf(html), /rac \| con|rac-con|racconta-re/);
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
    assert.deepEqual(json.pronunciations, [{ ipa: "/rakkonˈtare/", note: null }]);
    assert.match(json.etymology ?? "", /^derivazione di contare/);
    assert.deepEqual(json.antonyms, ["tacere", "nascondere", "celare"]);
  }, await loadFixturePages(join(REPO, "fixtures")));
});

test("a page-only form's definition links the lemma it names, as a record's gloss does", async () => {
  // A page in the layout `avventurieri` writes (fixtures/page-facts), naming `racconto`, an archive line here.
  const racconti = {
    wiki: "it.wiktionary.org" as const, title: "racconti", revisionId: 1, timestamp: "2026-10-04T00:00:00Z",
    wikitext: "{{-sost form-|it}}\n{{Pn}} ''m pl''\n#plurale di [[racconto]]",
  };
  const text = await readFile(join(REPO, "fixtures/page-entry-forms.jsonl"), "utf8");
  await withLines(text.trimEnd().split("\n"), async ({ db }) => {
    const html = await render(db, "racconti");
    assert.match(html, /plurale di <a class="[^"]*" href="\/\?q=racconto">racconto<\/a>/);
    assert.doesNotMatch(textOf(html), /Form of/);
    // Its heading states the number its stamp writes.
    assert.match(textOf(html), /Sostantivo, forma flessa·maschile, plurale/);
  }, rawPageSource([racconti]));
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
    // `{{Pn}} ''f sing'' {{Linkp|mastoidi}}`: the heading states the gender and number, and the grid holds the plural the page writes.
    assert.match(textOf(html), /Sostantivo·femminile, singolare/);
    assert.match(html, new RegExp(`id="forms-page-${reading.entryId}"`));
    assert.match(textOf(html), /mastoidi/);
    assert.match(textOf(html), /Etymology/);
    // The page gives no pronunciation and no word list, so the page shows none.
    assert.doesNotMatch(html, /aria-label="Pronunciation"/);
    assert.doesNotMatch(textOf(html), /Synonyms|Antonyms|Derived words|Expressions/);
    assert.doesNotMatch(textOf(html), /recovered|page-only|italian-page-entry|Not from the source/i);
    assert.equal(occurrencesOf(textOf(html), "Source"), 1);
  }, rawPageSource([mastoide]));
});

test("a curated definition correction shows in place of the page's wrong words, with no note, and leaves the rest as it was", async () => {
  // Verbatim archive lines 119046 `tremo` and 283047 `grufolando`, and the
  // dump's revisions 4002473 and 3906191 of their lemmas (#450).
  const lines = (await readFile(join(REPO, "fixtures/definition-corrections.jsonl"), "utf8")).trimEnd().split("\n");
  const pages = await loadFixturePages(join(REPO, "fixtures"));
  const [grufolare, tremare] = definitionCorrections(CURATED_CORRECTIONS);
  const rendered = async (corrections: readonly CuratedCorrection[] | undefined): Promise<Record<string, string>> => {
    const html: Record<string, string> = {};
    await withLines(lines, async ({ db }) => {
      for (const word of ["grufolare", "tremare"]) html[word] = await render(db, word);
      const answer = await attempt(db, "tremare");
      assert.ok(answer.outcome === "found");
      const { candidatesOf, resultJson } = await import("@/worker/api/lookupAnswer.ts");
      const { readLookupFilters } = await import("@/worker/api/lookupFilters.ts");
      const filters = readLookupFilters(new URLSearchParams());
      assert.ok(filters.ok);
      html.api = JSON.stringify(resultJson((await candidatesOf(answer, async () => undefined))[0], filters.filters).definitions);
    }, pages, undefined, corrections);
    return html;
  };
  // The committed list, as every seed writes it; and none, as the page reads without it.
  const corrected = await rendered(undefined);
  const source = await rendered([]);

  assert.match(textOf(corrected.grufolare), exact(grufolare.text));
  assert.doesNotMatch(textOf(corrected.grufolare), /verso prodotto dai suini/);
  assert.match(textOf(source.grufolare), /verso prodotto dai suini/);
  assert.match(textOf(corrected.tremare), exact(tremare.text));
  assert.doesNotMatch(textOf(corrected.tremare), /convulso dei muscoli/);
  // Nothing on the page says a definition was corrected (ADR 0016).
  for (const html of [corrected.grufolare, corrected.tremare]) assert.doesNotMatch(textOf(html), /correct|corrett|evidence|Wiktionary revision|oldid/i);
  // Only the corrected words differ: tremare's figurative sense 2, its label, and every other byte render exactly as before.
  assert.match(textOf(corrected.tremare), /figurato/);
  assert.match(textOf(corrected.tremare), /essere agitato da scosse continue/);
  assert.equal(corrected.tremare.replace(tremare.text, tremare.replaces.text), source.tremare);
  assert.equal(corrected.grufolare.replace(grufolare.text, grufolare.replaces.text), source.grufolare);
  // The API answers the same definitions the page shows.
  assert.deepEqual(JSON.parse(corrected.api).map((definition: { definition: string; labels: string[] }) => [definition.definition, definition.labels]), [
    [tremare.text, []],
    ["essere agitato da scosse continue", ["figurato"]],
  ]);
});

test("dictionary text that holds markup renders as escaped text, never as a script (#620)", async () => {
  const hostile = "<script>alert(1)</script>";
  // A gloss and a plural form carrying a script tag, as an edit upstream could.
  const line = JSON.stringify({
    word: "veleno", pos: "noun", pos_title: "Sostantivo", lang_code: "it",
    tags: ["masculine", "singular"],
    forms: [{ form: `veleni${hostile}`, tags: ["masculine", "plural"] }],
    senses: [{ glosses: [`sostanza tossica ${hostile}`] }],
  });
  await withLines([line], async ({ db }) => {
    const html = await render(db, "veleno");
    const escaped = "&lt;script&gt;alert(1)&lt;/script&gt;";
    assert.ok(html.includes(`sostanza tossica ${escaped}`), "the gloss, escaped");
    assert.ok(html.includes(`veleni${escaped}`), "the form, escaped");
    assert.doesNotMatch(html, /<script/i);
  });
});
