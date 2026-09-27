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
// What this cannot cover is the wiring in app/page.tsx: reaching D1 needs
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
import { writeKnownDisputes } from "../../src/import/knownDisputes.js";
import { loadFixturePages, type RawPageSource } from "../../src/source/rawPage.js";
import { PUBLISHED_ARCHIVE_SHA256, sourceOf, type ArchiveFacts, type ReleaseSource } from "../../src/source/archiveFacts.js";
import { fromNodeSqlite } from "../../src/lookup/database.js";
import { lookup } from "../../src/lookup/lookup.js";
import type { Reading } from "../../src/lookup/types.js";
import type { Attempt } from "../app/attempt.ts";
import { Attribution } from "../app/Attribution";
import { FirstLoad, Limited, Outcome, Pending, SearchPage, TRY_WORDS } from "../app/SearchPage";
import { SiteFooter } from "../app/SiteFooter";
import { SiteHeader } from "../app/SiteHeader";
import { JUMP_LINKS_FROM, WORD_LIST_SLICE } from "../app/Word";
import { wordPage } from "../app/wordPage.ts";
import { firstQuery } from "../app/params";
// The class strings the components carry, imported rather than copied, so a
// restyle that changes one changes both together.
import {
  CODE_IDENTITY,
  EMPTY,
  ERROR,
  FIELD_LABEL,
  FIELD_VALUE,
  HOME_PRONUNCIATION,
  HOME_TAGLINE,
  JUMP_LINK,
  LINK,
  NON_FINITE_LABEL_SEARCHED,
  ONE_LINE_TEXT,
  OPEN_MARK,
  PENDING,
  PERSON_SEARCHED,
  READING,
  SHELL_CENTRED,
  SHELL_TOP,
  SITE_FOOTER_LINK,
  SITE_FOOTER_NAME,
  TENSE_HEAD_SEARCHED,
  TOP_BAR,
  WORD_LINK,
} from "../app/styles.ts";
import { FIXTURE_LINES } from "./fixture.js";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const RELEASE = "it-page-test";

interface Fixture {
  dir: string;
  db: DatabaseSync;
}

async function fixture(
  lines: readonly string[],
  rawPages?: RawPageSource,
  facts?: ArchiveFacts,
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
    onRejection: (rejection) => {
      throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
    },
  });
  const db = new DatabaseSync(":memory:");
  for (const part of parts) db.exec(await readFile(part, "utf8"));
  // The same review rows `pnpm run seed:dev` writes, from the same module.
  assert.equal(writeKnownDisputes(db, RELEASE), 1);
  return { dir, db };
}

async function withLines(
  lines: readonly string[],
  run: (f: Fixture) => Promise<void>,
  rawPages?: RawPageSource,
  facts?: ArchiveFacts,
): Promise<void> {
  const f = await fixture(lines, rawPages, facts);
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
  return lookup({ db: fromNodeSqlite(db), releaseId: RELEASE, query });
}

/** The whole page, as the Worker would send it for `?q=<query>`. */
async function render(db: DatabaseSync, query: string): Promise<string> {
  const answer = await attempt(db, query);
  return renderToStaticMarkup(
    <SearchPage raw={query}>
      <Outcome raw={query} attempt={answer} />
    </SearchPage>,
  );
}

async function readingsFor(db: DatabaseSync, query: string): Promise<[Reading, ...Reading[]]> {
  const answer = await attempt(db, query);
  assert.equal(answer.outcome, "found", `${query}: expected a found answer`);
  if (answer.outcome !== "found") throw new Error("unreachable");
  return answer.readings;
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
      // record states: none for casa, whose record states neither, and never
      // on a verb or a Voce verbale.
      casa: ["1·Sostantivo"],
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
        wordPage(query, readings).readings.map((entry) => entry.reading.recordId).sort((a, b) => a - b),
        readings.map((reading) => reading.recordId).sort((a, b) => a - b),
        query,
      );
      assert.equal(patternsOf(html, /<h1[\s>]/), 1, `${query}: one h1`);
      // No box or card: nothing on a result page carries the old card frame.
      assert.doesNotMatch(html, /rounded-\[6px\]/, query);
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
    assert.equal(JUMP_LINKS_FROM, 3);
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

test("one definition and its example show, the rest are in the document behind N more definitions", async () => {
  await withDevSeed(async ({ db }) => {
    const verb = nth(await render(db, "andare"), 2);
    const [first, rest] = verb.split("<details");
    assert.equal(patternsOf(first, /data-definition="/g), 1);
    assert.match(textOf(first), /muoversi da un luogo verso un altro luogo/);
    assert.match(textOf(first), /ogni mattina devo andare a scuola/);
    assert.match(rest, />4 more definitions</);
    assert.equal(patternsOf(verb, /data-definition="/g), 5, "all five definitions are in the document");

    // bello's first adjective sense has no example, so the reading's first
    // example stands in, marked with the definition it belongs to.
    const adjective = nth(await render(db, "bello"), 1).split("<details")[0];
    assert.match(textOf(adjective), /from definition 3/);
    assert.equal(patternsOf(adjective, /from definition/g), 1);

    // A reading with one definition has no link.
    assert.doesNotMatch(nth(await render(db, "bello"), 3), /more definition/);
  });
});

test("casa shows the definitions its raw page states, with no mark for where they came from", async () => {
  await withDevSeedAndPages(async ({ db }) => {
    const casa = await render(db, "casa");
    const reading = nth(casa, 1);
    assert.equal(patternsOf(reading, /data-definition="/g), 7);
    assert.match(textOf(reading), /edificio costruito per essere utilizzato come abitazione/);
    assert.match(reading, />6 more definitions</);
    // ADR 0016: no recovered mark, no revision link, no rule note, and the
    // two furniture glosses are not definitions.
    assert.doesNotMatch(casa, /recovered|oldid=|it-moods|it-articles|Not from the source/i);
    assert.doesNotMatch(textOf(reading), /\( citazioni\)|\( approfondimento\)/);
  });
  // Without the raw page, the furniture is all the record says, so it shows
  // verbatim rather than leaving the reading silent.
  await withDevSeed(async ({ db }) => {
    const reading = nth(await render(db, "casa"), 1);
    assert.match(textOf(reading), /casa \( approfondimento\) f sing/);
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

test("a searched verb form shows its lemma's table, opened on its mood with its cell and labels marked", async () => {
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
    // Two pages are shown, so each has its own Source link (ADR 0009).
    assert.deepEqual(
      [...html.matchAll(/href="https:\/\/it\.wiktionary\.org\/wiki\/([^"]+)" target="_blank"/g)].map((match) => match[1]),
      ["andavano", "andare"],
    );

    // One spelling in two cells marks both, and the tabs open on its mood.
    const andassi = await render(db, "andassi");
    const tabs = [...andassi.matchAll(/<button [^>]*role="tab"[^>]*>([^<]+)<\/button>/g)];
    assert.match(tabs.find((match) => match[1] === "Congiuntivo")?.[0] ?? "", /aria-selected="true"/);
    const congiuntivo = panel(andassi, "Congiuntivo");
    assert.deepEqual(formLinks(congiuntivo).filter((link) => link.searched).map((link) => link.text), ["andassi", "andassi"]);
    assert.equal(patternsOf(congiuntivo, new RegExp(esc(`class="${PERSON_SEARCHED}"`), "g")), 2);
  });
});

test("a searched compound form opens the compound tenses; otherwise they wait behind their link", async () => {
  await withDevSeed(async ({ db }) => {
    const plain = nth(await render(db, "andavano"), 1);
    assert.match(panel(plain, "Indicativo"), /<details class="[^"]*"><summary [^>]*><span [^>]*>compound tenses<\/span>/);
    const compound = await render(db, "sono andato");
    assert.match(panel(compound, "Indicativo"), /<details class="[^"]*" open=""><summary/);
  });
});

test("etymology and synonyms come once after the readings: eight synonyms, then + N more, each a search", async () => {
  await withDevSeed(async ({ db }) => {
    const html = await render(db, "andare");
    const facts = html.slice(html.lastIndexOf("</article>"));
    assert.equal(patternsOf(html, />Etymology</g), 1);
    const synonyms = facts.slice(facts.indexOf('id="synonyms"'), facts.indexOf("</section>", facts.indexOf('id="synonyms"')));
    const words = [...synonyms.matchAll(new RegExp(`<a class="${esc(WORD_LINK)}" href="([^"]+)" lang="it">([^<]+)</a>`, "g"))];
    const total = (await readingsFor(db, "andare"))[0].wordFacts.synonyms.length;
    assert.ok(total > WORD_LIST_SLICE);
    assert.equal(words.length, wordPage("andare", await readingsFor(db, "andare")).wordFacts.synonyms.length, "every synonym is in the document");
    assert.match(synonyms, new RegExp(`>\\+ ${words.length - WORD_LIST_SLICE} more<`));
    for (const [, href, word] of words) assert.equal(href, `/?q=${encodeURIComponent(textOf(word))}`);
    // No count beside a label.
    assert.doesNotMatch(html, /showing \d/);
  });
});

test("every form entry of every reading is on the page, whatever shape its forms take", async () => {
  await withDevSeed(async ({ db }) => {
    for (const query of ["andare", "bello", "sale", "studente", "grande", "casa", "vivere"]) {
      const html = await render(db, query);
      for (const reading of await readingsFor(db, query)) {
        const shown = new Set(
          [...readingById(html, reading.recordId).matchAll(/data-form="([\d ]+)"/g)].flatMap((match) =>
            match[1].split(" ").map(Number),
          ),
        );
        for (const form of reading.forms) {
          assert.ok(shown.has(form.index), `${query}: ${reading.word} form ${form.index} (${form.surface}) is shown`);
        }
      }
    }
  });
});

test("a spelling the source files twice in one cell is shown once and keeps both entries", async () => {
  await withFixture(async ({ db }) => {
    // `studente` lists `studenti` as masculine plural and as bare plural; both
    // land in maschile plurale.
    const reading = nth(await render(db, "studente"), 1);
    assert.equal(patternsOf(reading, />studenti</g), 1);
    assert.match(reading, /<span data-form="0 1">studenti<\/span>/);
  });
});

test("one example per definition shows; one control per reading reveals every other example", async () => {
  await withDevSeed(async ({ db }) => {
    const readings = await readingsFor(db, "libro");
    const noun = readings.find((reading) => reading.pos === "noun");
    assert.ok(noun);
    const examples = noun.senses[0].examples.map((example) => example.text);
    assert.ok(examples.length > 2, "libro's first sense carries several examples");
    const reading = readingById(await render(db, "libro"), noun.recordId);
    const definitions = reading.slice(0, reading.indexOf(`id="forms-${noun.recordId}"`));
    const closed = definitions.slice(0, definitions.indexOf("<details"));
    const control = definitions.slice(definitions.indexOf("<details"));
    // Every example is in the document; the first shows, the others wait for
    // the one control, which also holds the other definitions.
    for (const text of examples) assert.ok(textOf(definitions).includes(text), `example in the page: ${text}`);
    assert.ok(closed.includes(examples[0]));
    for (const text of examples.slice(1)) assert.ok(!textOf(closed).includes(text), `extra example starts hidden: ${text}`);
    for (const text of examples.slice(1)) assert.ok(textOf(control).includes(text), `extra example is reachable: ${text}`);
    assert.equal(patternsOf(definitions, /<details[\s>]/g), 1, "one control for the whole reading");
    assert.match(definitions, new RegExp(`>6 more definitions · ${examples.length - 1} more examples<`));

    // A single-definition reading still gets the control when its first
    // definition has additional examples.
    const onlyDefinition = await renderChanged(db, "libro", (changed) => {
      const target = changed.find((reading) => reading.recordId === noun.recordId);
      assert.ok(target);
      target.senses.splice(1);
    });
    const onlyReading = readingById(onlyDefinition, noun.recordId);
    const onlyDefinitions = onlyReading.slice(0, onlyReading.indexOf(`id="forms-${noun.recordId}"`));
    assert.equal(patternsOf(onlyReading, /data-definition="/g), 1);
    assert.equal(patternsOf(onlyDefinitions, /<details[\s>]/g), 1);
    assert.match(onlyReading, new RegExp(`>${examples.length - 1} more examples<`));

    // A borrowed example shows once: under the first definition, not again
    // under its own when the rest open.
    const bello = await readingsFor(db, "bello");
    const adjective = bello.find((r) => r.pos === "adj" && r.isAboutQuery);
    assert.ok(adjective);
    const borrowed = adjective.senses[2].examples[0].text;
    const html = textOf(readingById(await render(db, "bello"), adjective.recordId));
    assert.equal(html.split(borrowed).length - 1, 1, "the borrowed example shows once");
  });
});

test("a lemma the release has no entry for is not mentioned; one it has is always reachable", async () => {
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

test("a searched non-finite form is marked in its table like any cell", async () => {
  await withDevSeed(async ({ db }) => {
    const html = await render(db, "andando");
    assert.deepEqual(formLinks(html).filter((link) => link.searched).map((link) => link.text), ["andando"]);
    assert.match(html, new RegExp(`<dt class="${esc(NON_FINITE_LABEL_SEARCHED)}" lang="it">gerundio</dt>`));
  });
});

test("a spelling the source files twice in one conjugation slot shows once and keeps both entries", async () => {
  await withFixture(async ({ db }) => {
    const verb = nth(await render(db, "abbisognare"), 1);
    assert.equal(patternsOf(verb, />abbisognando<\/a>/g), 1);
    assert.match(verb, /data-form="0 7">abbisognando<\/a>/);
    assert.equal(patternsOf(verb, />abbisogno<\/a>/g), 1);
    assert.match(verb, /data-form="1 8">abbisogno<\/a>/);
  });
});

test("a headword whose record states both numbers fills both columns", async () => {
  await withFixture(async ({ db }) => {
    const khmer = nth(await render(db, "khmer"), 1);
    assert.deepEqual(gridRows(khmer).map((row) => row.map((cell) => cell.split(/(?=il |un |i |dei |gli |degli )/)[0])), [
      ["", "singolare", "plurale"],
      ["maschile", "khmer", "khmer"],
    ]);
  });
});

test("an identical spelling with the same grammar shows once in an unplaced group", async () => {
  await withFixture(async ({ db }) => {
    const alpe = nth(await render(db, "alpe"), 1);
    const group = alpe.slice(alpe.indexOf('data-unplaced="gender not given"'));
    assert.equal(patternsOf(group, />alpi</g), 1);
    assert.match(group, /<span data-form="0 1">alpi<\/span>/);
  });
});

/** The page for a query after `change` edits the readings the lookup returned. */
async function renderChanged(db: DatabaseSync, query: string, change: (readings: Reading[]) => void): Promise<string> {
  const answer = await attempt(db, query);
  assert.equal(answer.outcome, "found");
  if (answer.outcome !== "found") throw new Error("unreachable");
  change(answer.readings);
  return renderToStaticMarkup(
    <SearchPage raw={query}>
      <Outcome raw={query} attempt={answer} />
    </SearchPage>,
  );
}

const recoveredExample = (text: string, line: number) => ({
  text,
  ref: { wiki: "it.wiktionary.org", title: "x", revisionId: 1, line },
});

test("examples on nested items and on hidden furniture senses stay reachable behind the control", async () => {
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
      const reading = nth(html, 1);
      const closed = reading.slice(0, reading.indexOf("<details"));
      const control = reading.slice(reading.indexOf("<details"));
      assert.doesNotMatch(textOf(closed), /uno scudo accollato a un altro/);
      assert.match(textOf(control), /uno scudo accollato a un altro/);
      assert.match(control, />2 more definitions · 1 more example</);
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
    const control = reading.slice(reading.indexOf("<details"));
    assert.match(textOf(control), /la casa è dove si torna/, "its example is behind the control");
    assert.match(control, />6 more definitions · 1 more example</);
  });
});

test("a gloss that names two lemmas links both, and neither is repeated on a line of its own", async () => {
  await withFixture(async ({ db }) => {
    const vadi = nth(await render(db, "vadi"), 1);
    assert.match(vadi, /forma antica di <a class="[^"]*" href="\/\?q=andare">andare<\/a>, come di <a class="[^"]*" href="\/\?q=salire">salire<\/a>/);
    assert.doesNotMatch(vadi, /Form of/);
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
  return textOf(section.replace(/<details[\s\S]*?<\/details>/g, ""));
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

test("an etymology whose label names a reading shows in that reading, without its label", async () => {
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
});

test("a label that names two readings stays once at the bottom; a label with nothing after it leaves no block", async () => {
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

test("a sense with no gloss is not a definition and carries no note; its examples stay behind the control", async () => {
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
    const control = reading.slice(reading.indexOf("<details"));
    assert.match(textOf(control), /un libro senza definizione/);
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

test("a heading states both numbers when the record does, and nothing on a proper name", async () => {
  await withFixture(async ({ db }) => {
    assert.deepEqual(headingsOf(await render(db, "khmer")), ["1·Sostantivo·maschile, singolare e plurale"]);
    assert.deepEqual(headingsOf(await render(db, "Mercurio")), ["1·Nome proprio"]);
    // The grammar is muted and Italian, beside the part of speech, not inside it.
    assert.match(await render(db, "khmer"), /<span lang="it">Sostantivo<\/span><span class="[^"]*"><span class="[^"]*" aria-hidden="true">·<\/span><span class="[^"]*" lang="it">maschile, singolare e plurale<\/span><\/span><\/h2>/);
  });
});

test("an etymology shows one cut line and a native + more that opens the whole text in place", async () => {
  await withDevSeed(async ({ db }) => {
    const html = await render(db, "andare");
    const facts = afterReadings(html);
    const reading = (await readingsFor(db, "andare"))[0];
    const [etymology] = reading.wordFacts.etymologies;
    const block = facts.slice(facts.indexOf('data-one-line=""'));
    // The whole text is in the HTML, on a line that CSS cuts with an ellipsis
    // and lets wrap once the toggle is open.
    assert.match(block, new RegExp(`<p class="${esc(ONE_LINE_TEXT.replace(/&/g, "&amp;"))}" lang="it">`));
    assert.ok(textOf(block).includes(textOf(etymology.text.replace(/</g, "&lt;"))));
    assert.match(ONE_LINE_TEXT, /\btruncate\b/);
    assert.match(ONE_LINE_TEXT, /group-has-\[details\[open\]\]\/line:whitespace-normal/);
    // The toggle is a native <details>, so it opens with no script; the
    // script only hides it when the text already fits.
    assert.match(block, /<details class="[^"]*"><summary class="[^"]*"><span class="[^"]*">\+ more<\/span><span class="[^"]*">less<\/span><\/summary><\/details>/);
  });
});

test("every link that leaves Lexema opens in a new tab; every link inside it stays in this one", async () => {
  await withDevSeed(async ({ db }) => {
    // studente carries a disputed claim, whose evidence link leaves Lexema.
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
    assert.match(await render(db, "studente"), /Disputed by later research/);
  });
});

test("a proper name gets no grid and no generated articles; its forms stay visible", async () => {
  await withFixture(async ({ db }) => {
    const mercurio = nth(await render(db, "Mercurio"), 1);
    assert.doesNotMatch(mercurio, /data-grid=""/);
    assert.doesNotMatch(textOf(mercurio), /\bi Mercuria|dei Mercuria|il Mercurio/);
    const group = mercurio.slice(mercurio.indexOf('data-unplaced="not a noun, adjective or phrase"'));
    assert.match(group, /^data-unplaced="not a noun, adjective or phrase"><p class="[^"]*">Not a noun, adjective or phrase<\/p>/);
    assert.match(group, /<dt class="[^"]*" lang="it">plurale<\/dt><dd [^>]*><span data-form="0">Mercuria<\/span>/);
  });
});

test("a form with no gender of its own is not guessed into a record that states both", async () => {
  await withFixture(async ({ db }) => {
    // `fine` is tagged masculine and feminine; `fini` only plural. Which
    // gender's plural it is, the source does not say.
    const fine = nth(await render(db, "fine"), 1);
    const grid = fine.slice(0, fine.indexOf("data-unplaced"));
    assert.doesNotMatch(grid, />fini</);
    assert.deepEqual(gridRows(fine).map((row) => row[0]), ["", "maschile", "femminile"]);
    assert.match(fine, /data-unplaced="gender not given"><p class="[^"]*">Gender not given<\/p>/);
    const unplaced = fine.slice(fine.indexOf('data-unplaced="gender not given"'));
    assert.match(unplaced, /<span data-form="0">fini<\/span>/);
    // Its grammar is labelled in Italian (ADR 0015), not as the tag `plural`.
    assert.match(unplaced, /<dt class="[^"]*" lang="it">plurale<\/dt>/);
    assert.doesNotMatch(unplaced, />plural</);
  });
});

test("each spelling of a cell has its own article line", async () => {
  await withFixture(async ({ db }) => {
    const olio = textOf(nth(await render(db, "olio"), 1));
    assert.match(olio, /oligli oli·degli olioliigli olii·degli olii/);
  });
});

test("forms that fit no cell are shown verbatim, grouped under what they lack", async () => {
  await withFixture(async ({ db }) => {
    // `parlarsi (coniugazione)` carries no tense and no mood: it is the link
    // to the reflexive verb, and the page files it under what it lacks.
    const parlare = await render(db, "parlare");
    const verbGroup = parlare.slice(parlare.indexOf('data-unplaced="mood and tense not given"'));
    assert.match(verbGroup, /^data-unplaced="mood and tense not given"><p class="[^"]*">Mood and tense not given<\/p>/);
    assert.match(verbGroup, />parlarsi \(coniugazione\)</);
    assert.doesNotMatch(parlare, />Other forms</);
    // `maggiore` and `maggiori` state no gender and no number, and `grande`
    // states both genders, so neither is guessed.
    const grande = await render(db, "grande");
    assert.match(grande, /data-unplaced="gender and number not given"><p class="[^"]*">Gender and number not given<\/p>/);
    assert.match(textOf(grande), /comparativo di maggioranzamaggiori/);
    // An auxiliary the source writes as text is shown as it wrote it.
    assert.match(textOf(await render(db, "finire")), /ausiliareavere, se intr\. essere/);
  });
});

// The page around the result ----------------------------------------------------

test("the home page is the name, the field and the Try chips, centred", async () => {
  const home = renderToStaticMarkup(
    <SearchPage raw="">
      <FirstLoad />
    </SearchPage>,
  );
  assert.match(home, new RegExp(`^<main class="${esc(SHELL_CENTRED)}"><h1 [^>]*>Lexema</h1>`));
  // Under the wordmark: its pronunciation, drawn as a word's is, then what it is.
  assert.match(
    home,
    new RegExp(
      `</h1><p class="${esc(HOME_PRONUNCIATION)}" aria-label="Pronunciation">/lekˈsɛːma/</p>` +
        `<p class="${esc(HOME_TAGLINE)}">a simple dictionary</p>`,
    ),
  );
  assert.doesNotMatch(home, new RegExp(esc(TOP_BAR)));
  assert.match(home, /placeholder="Search an Italian word"/);
  assert.match(home, /aria-label="Search an Italian word"/);
  assert.match(home, />ENTER<\/kbd>/);
  assert.match(home, /<form class="[^"]*" role="search" action="\/" method="get">/);
  assert.match(home, />Try<\/span>/);
  assert.deepEqual([...TRY_WORDS], ["casa", "andare", "bello", "sale", "studente"]);
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
    <SearchPage raw="">
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

test("every page reaches the attribution page from the footer's four links", async () => {
  const footer = renderToStaticMarkup(<SiteFooter />);
  const links = [...footer.matchAll(new RegExp(`<a class="${esc(SITE_FOOTER_LINK)}" href="([^"]+)">([^<]+)</a>`, "g"))];
  assert.deepEqual(links.map((match) => match[2]), ["Attribution", "About the data", "Licence", "Contact"]);
  for (const [, href] of links) assert.match(href, /^\/attribution(#|$)/);
  // The footer's wordmark goes home, in the same tab, like the top bar's.
  assert.match(footer, new RegExp(`<a class="${esc(SITE_FOOTER_NAME)}" href="/">Lexema</a>`));
  assert.match(renderToStaticMarkup(<SiteHeader />), /<a class="[^"]*" href="\/">Lexema<\/a>/);

  // The layout imports globals.css, which Node cannot load, so that it carries
  // this footer is asserted on the file.
  const layout = await readFile(join(REPO, "web/app/layout.tsx"), "utf8");
  assert.match(layout, /<SiteFooter \/>/);
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

test("renders the states that are not an answer: loading, rejected, failed, not found", async () => {
  const loading = renderToStaticMarkup(
    <SearchPage raw="sale">
      <Pending raw="sale" />
    </SearchPage>,
  );
  assert.match(loading, exact(`<p class="${PENDING}" role="status">Searching for <q lang="it">sale</q>`));

  const failed = renderToStaticMarkup(
    <SearchPage raw="sale">
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
    assert.match(missing, exact(`<p class="${EMPTY}" role="status">Nothing in this release matches`));
  });
});

test("a search over the limit says so plainly, under the same field, and claims nothing about the word", () => {
  const html = renderToStaticMarkup(
    <SearchPage raw="sale">
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
          `<a class="${LINK}" href="https://dumps.wikimedia.org/itwiktionary/20260701/" rel="noreferrer">` +
            `Italian Wiktionary, dump of 1 July 2026</a>`,
        ),
      ),
    );
    assert.match(
      html,
      exact(
        field(
          "Downloaded from",
          `<a class="${LINK}" href="https://kaikki.org/dictionary/downloads/it/it-extract.jsonl.gz" rel="noreferrer">` +
            `<code class="${CODE_IDENTITY}">https://kaikki.org/dictionary/downloads/it/it-extract.jsonl.gz</code></a>`,
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
