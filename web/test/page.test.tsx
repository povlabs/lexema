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
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { renderToStaticMarkup } from "react-dom/server";
import { TENSE_BOXES } from "../../src/italian/moods.js";
import { seedSql } from "../../src/import/seedSql.js";
import { writeKnownDisputes } from "../../src/import/knownDisputes.js";
import { fromNodeSqlite } from "../../src/lookup/database.js";
import { lookup, readRelease } from "../../src/lookup/lookup.js";
import type { Reading } from "../../src/lookup/types.js";
import type { Attempt } from "../app/attempt.ts";
import { Attribution } from "../app/Attribution";
import { DEFINITION_SLICE } from "../app/Reading";
import { FirstLoad, Outcome, Pending, SearchPage, TRY_WORDS } from "../app/SearchPage";
import { SiteFooter } from "../app/SiteFooter";
import { SiteHeader } from "../app/SiteHeader";
import { RELATED_SLICE } from "../app/Word";
import { wordPage } from "../app/wordPage.ts";
import { firstQuery } from "../app/params";
// The class strings the components carry, imported rather than copied, so a
// restyle that changes one changes both together.
import {
  BOX,
  BOX_HEADING,
  CARD,
  CARD_NUMBER,
  CODE_IDENTITY,
  EMPTY,
  ERROR,
  ETYMOLOGY_LABEL,
  FIELD_LABEL,
  FIELD_VALUE,
  HEADLINE_FORM,
  HEADLINE_LABEL,
  HEADLINE_VALUE,
  LINK,
  OPEN_MARK,
  PENDING,
  SEARCHED,
  SHELL_CENTRED,
  SHELL_TOP,
  SITE_FOOTER_LINK,
  TENSE_HEADING,
  TOP_BAR,
} from "../app/styles.ts";
import { FIXTURE_LINES } from "./fixture.js";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const RELEASE = "it-page-test";

interface Fixture {
  dir: string;
  db: DatabaseSync;
}

async function fixture(lines: readonly string[]): Promise<Fixture> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-page-"));
  const archive = join(dir, "fixture.jsonl.gz");
  const output = join(dir, "seed.sql");
  await writeFile(archive, gzipSync(Buffer.from(`${lines.join("\n")}\n`, "utf8")));
  await seedSql({
    input: archive,
    output,
    schema: join(REPO, "src/db/schema.sql"),
    releaseId: RELEASE,
    archiveR2Key: `releases/${RELEASE}.jsonl.gz`,
    sourceUrl: "https://example.invalid/it-extract.jsonl.gz",
    license: "CC-BY-SA-4.0",
    onRejection: (rejection) => {
      throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
    },
  });
  const db = new DatabaseSync(":memory:");
  db.exec(await readFile(output, "utf8"));
  // The same review rows `pnpm run seed:dev` writes, from the same module.
  assert.equal(writeKnownDisputes(db, RELEASE), 1);
  return { dir, db };
}

async function withLines(lines: readonly string[], run: (f: Fixture) => Promise<void>): Promise<void> {
  const f = await fixture(lines);
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

/** One headline fact of the header bar, label and value. */
const fact = (label: string, value: string, form = false): RegExp =>
  new RegExp(
    `<dt class="${esc(HEADLINE_LABEL)}">${esc(label)}</dt><dd class="${esc(form ? HEADLINE_FORM : HEADLINE_VALUE)}">` +
      `(?:<span[^>]*>)*${esc(value)}<`,
  );

/** One row of the attribution page's release identity. */
const field = (label: string, value: string): string =>
  `<dt class="${FIELD_LABEL}">${label}</dt><dd class="${FIELD_VALUE}">${value}</dd>`;

/** Each card of a page, in the order the page rendered them. */
function cardsOf(html: string): string[] {
  return html
    .split(`<article class="${CARD}"`)
    .slice(1)
    .map((part) => part.slice(0, part.indexOf("</article>")));
}

const cardLabels = (html: string): string[] =>
  [...html.matchAll(new RegExp(`<article class="${esc(CARD)}" id="[^"]+" aria-label="([^"]+)"`, "g"))].map(
    (match) => match[1],
  );

/** One card out of a page, by the label it announces itself with. */
function card(html: string, label: string): string {
  const open = html.search(new RegExp(`<article class="${esc(CARD)}" id="[^"]+" aria-label="${esc(label)}"`));
  assert.notEqual(open, -1, `no card labelled ${label}`);
  return html.slice(open, html.indexOf("</article>", open));
}

/** One card out of a page, by the record it renders. */
function cardById(html: string, recordId: number): string {
  const open = html.search(new RegExp(`<article class="${esc(CARD)}" id="reading-${recordId}"`));
  assert.notEqual(open, -1, `no card for record ${recordId}`);
  return html.slice(open, html.indexOf("</article>", open));
}

/** Every box of some markup, from its open tag to its close. */
function boxesOf(html: string): string[] {
  const found: string[] = [];
  let at = html.indexOf(`<section class="${BOX}"`);
  while (at !== -1) {
    const end = html.indexOf("</section>", at);
    found.push(html.slice(at, end));
    at = html.indexOf(`<section class="${BOX}"`, end);
  }
  return found;
}

/** The headings of every tense box, in page order. */
const tenseHeadings = (html: string): string[] =>
  [...html.matchAll(new RegExp(`<h4 class="${esc(TENSE_HEADING)}" id="[^"]+" lang="it">([^<]+)</h4>`, "g"))].map(
    (match) => match[1],
  );

const formMarks = (html: string): number[] => [...html.matchAll(/data-form="(\d+)"/g)].map((match) => Number(match[1]));

/**
 * Every form the lookup returned for a reading is on its card, and no box
 * renders one twice. The header bar may repeat a form a box also shows — the
 * frames put `studenti` in both — so the per-box count is the one held to one.
 */
function assertEveryFormShown(html: string, reading: Reading, where: string): void {
  const shown = new Set(formMarks(html));
  for (const form of reading.forms) {
    assert.ok(shown.has(form.index), `${where}: form ${form.index} (${form.surface}) is on the card`);
  }
  const inBoxes = boxesOf(html).flatMap(formMarks);
  assert.equal(new Set(inBoxes).size, inBoxes.length, `${where}: no box renders a form twice`);
}

// The six words the design frames draw, from their real records ---------------

test("each frame word renders every record the lookup returns as a card, and every lemma it points to as that card's panel", async () => {
  await withDevSeed(async ({ db }) => {
    const expected: Record<string, string[]> = {
      casa: ["casa, noun"],
      andare: ["andare, noun", "andare, verb"],
      andavano: ["andavano, verb form"],
      sale: ["sale, noun", "sale, noun form", "sale, verb form"],
      bello: ["bello, adjective", "bello, noun", "bello, noun", "bella, adjective form"],
      studente: ["studente, noun", "studente, verb form", "studenti, noun form", "studentessa, noun form"],
    };
    for (const [query, labels] of Object.entries(expected)) {
      const html = await render(db, query);
      const readings = await readingsFor(db, query);
      const page = wordPage(query, readings);
      assert.deepEqual(cardLabels(html), labels, query);
      // Nothing the lookup returned is dropped: every record is a card.
      assert.deepEqual(
        page.cards.map((c) => c.reading.recordId).sort((a, b) => a - b),
        readings.map((reading) => reading.recordId).sort((a, b) => a - b),
        `${query}: every record is a card`,
      );
      // And every lemma a reading points to is a panel on that reading's card,
      // naming every record the source leaves it open between.
      for (const reading of readings) {
        const panels = [...cardById(html, reading.recordId).matchAll(/data-lemma-panel=""(?: data-lemma-records="([^"]*)")?/g)];
        assert.equal(panels.length, reading.lemmaLinks.length, `${query}: ${reading.word} has one panel per lemma`);
        reading.lemmaLinks.forEach((link, i) => {
          const named = link.kind === "candidates" ? link.candidates.map((c) => c.recordId).join(" ") : undefined;
          assert.equal(panels[i][1], named, `${query}: ${reading.word}'s panel ${i} names its lemma's records`);
        });
      }
      // One h1, the headword; the index and the card numbers only when there
      // is more than one reading (#100).
      assert.equal(patternsOf(html, /<h1[\s>]/), 1, query);
      assert.match(html, new RegExp(`<h1 [^>]*lang="it">${esc(page.headword)}</h1>`), query);
      assert.equal(occurrencesOf(html, 'aria-label="Readings"'), labels.length > 1 ? 1 : 0, query);
      assert.equal(occurrencesOf(html, `class="${CARD_NUMBER}"`), labels.length > 1 ? labels.length : 0, query);
    }
  });
});

test("sale: the salt noun, then two form readings whose lemmas are sala and salire", async () => {
  await withDevSeed(async ({ db }) => {
    const html = await render(db, "sale");
    const readings = await readingsFor(db, "sale");
    // `sala` and `salire` list `sale` in their tables, and they are the lemmas
    // two `sale` readings name: so they come back as those readings' lemmas,
    // with the row that spells `sale`, and not as readings.
    assert.deepEqual(readings.map((reading) => reading.word), ["sale", "sale", "sale"]);
    const lemmaOf = (pos: string) => {
      const reading = readings.find((candidate) => candidate.pos === pos && candidate.lemmaLinks.length > 0);
      const link = reading?.lemmaLinks[0];
      assert.ok(link?.kind === "candidates");
      return link.candidates;
    };
    const sala = lemmaOf("noun");
    assert.deepEqual(sala.map((c) => `${c.word}/${c.pos}/${c.listing !== undefined}`), ["sala/noun/true", "sala/verb/false"]);
    const salire = lemmaOf("verb");
    assert.deepEqual(salire.map((c) => `${c.word}/${c.listing !== undefined}`), ["salire/true"]);

    const nounForm = card(html, "sale, noun form");
    assert.match(nounForm, /<p class="[^"]*" lang="it">sala<\/p>/);
    assert.match(nounForm, new RegExp(`data-lemma-records="${sala.map((c) => c.recordId).join(" ")}"`));
    assert.match(textOf(nounForm), /2 entries share this spelling: sala \(noun\), sala \(verb\)\. The source does not say which\./);
    assert.match(nounForm, /href="\/\?q=sala">Open entry →<\/a>/);
    assert.match(nounForm, fact("lemma", "sala", true));
    assert.match(nounForm, fact("gender", "feminine"));
    assert.match(nounForm, fact("number", "plural"));

    // The verb form reads its person, number and tense off salire's own row.
    const verbForm = card(html, "sale, verb form");
    assert.match(verbForm, new RegExp(`data-lemma-records="${salire[0].recordId}"`));
    assert.match(verbForm, fact("lemma", "salire", true));
    assert.match(verbForm, fact("person", "third"));
    assert.match(verbForm, fact("number", "singular"));
    assert.match(verbForm, fact("tense", "presente", true));
    // With several readings a form points to its lemma and carries no table.
    assert.equal(tenseHeadings(verbForm).length, 0);
  });
});

test("the articles box prints each article with its noun once, and says Lexema derived it", async () => {
  await withDevSeed(async ({ db }) => {
    const sale = card(await render(db, "sale"), "sale, noun");
    assert.equal(occurrencesOf(textOf(sale), "il sale"), 1);
    assert.doesNotMatch(textOf(sale), /il il|un un|del del/);
    assert.match(sale, /<dt class="[^"]*">definite sg<\/dt><dd class="[^"]*"><span lang="it">il sale<\/span>/);
    assert.match(textOf(sale), /Not from the source: Lexema derives these by rule it-articles\/v1/);
    // `sali` is tagged plural and nothing else, so no plural article is built.
    assert.doesNotMatch(textOf(sale), /definite pl/);
    assert.match(sale, fact("plural", "sali", true));

    // `studenti` is tagged masculine plural, so its articles come from the rule.
    const studente = card(await render(db, "studente"), "studente, noun");
    for (const [label, value] of [
      ["definite sg", "lo studente"],
      ["definite pl", "gli studenti"],
      ["indefinite sg", "uno studente"],
      ["partitive sg", "dello studente"],
      ["partitive pl", "degli studenti"],
    ]) {
      assert.match(studente, new RegExp(`<dt class="[^"]*">${label}</dt><dd class="[^"]*"><span lang="it">${value}</span>`), label);
    }
  });
});

test("studente carries its plural and feminine on the bar and a gender-and-number box", async () => {
  await withDevSeed(async ({ db }) => {
    const html = await render(db, "studente");
    const studente = card(html, "studente, noun");
    assert.match(studente, fact("gender", "masculine"));
    assert.match(studente, fact("plural", "studenti", true));
    assert.match(studente, fact("feminine", "studente/studentessa", true));
    const box = boxesOf(studente).find((part) => part.includes(">Gender and number</h4>"));
    assert.ok(box);
    assert.deepEqual([...box.matchAll(/<dt class="[^"]*">([^<]+)<\/dt>/g)].map((match) => match[1]), [
      "m sg",
      "m pl",
      "f sg",
      "f pl",
      "pl",
    ]);
    const [reading] = await readingsFor(db, "studente");
    assertEveryFormShown(studente, reading, "studente");
    // The verb reading the research contradicts is still marked disputed.
    assert.match(card(html, "studente, verb form"), /Disputed by later research\./);
  });
});

test("andare's verb card lays the conjugation out in sixteen boxes, in the frame's order", async () => {
  await withDevSeed(async ({ db }) => {
    const html = await render(db, "andare");
    const verb = card(html, "andare, verb");
    assert.deepEqual(tenseHeadings(verb), [...TENSE_BOXES, "imperativo", "modi indefiniti"]);
    assert.match(textOf(verb), /Lexema derives the congiuntivo and condizionale boxes by rule it-moods\/v1, from the che pronoun rows the source writes\./);

    const box = (name: string) => boxesOf(verb).find((part) => part.includes(`lang="it">${name}</h4>`)) ?? "";
    assert.match(textOf(box("congiuntivo presente")), /che iovada/);
    assert.match(textOf(box("condizionale presente")), /ioandrei/);
    assert.match(textOf(box("congiuntivo trapassato")), /che iofossi andato/);
    assert.match(textOf(box("condizionale passato")), /iosarei andato/);
    // `vado` and `vo` are both the source's `io` present: one row, two forms.
    assert.match(textOf(box("presente")), /iovado \/ vo/);
    // Nothing is left for the unplaced box on this verb.
    assert.doesNotMatch(verb, /Not placed in a tense/);

    // The header bar: the non-finite facts and the class, verbatim.
    assert.match(verb, fact("infinitive", "andare", true));
    assert.match(verb, fact("gerund", "andando", true));
    assert.match(verb, fact("participle", "andato", true));
    assert.match(verb, fact("auxiliary", "essere", true));
    assert.match(verb, fact("conjugation", "verbo di prima coniugazione (irregolare)"));

    const reading = (await readingsFor(db, "andare")).find((candidate) => candidate.pos === "verb");
    assert.ok(reading);
    assert.match(verb, new RegExp(`>Conjugation</h3><span class="[^"]*">${reading.forms.length} forms</span>`));
    assertEveryFormShown(verb, reading, "andare");
    // A lemma's own page outlines nothing in its table: the query is the title.
    assert.equal(occurrencesOf(verb, "data-searched"), 0);
  });
});

test("andavano is one reading: its own facts, andare's whole table with the form outlined, and the lemma", async () => {
  await withDevSeed(async ({ db }) => {
    const html = await render(db, "andavano");
    const [only] = cardsOf(html);
    assert.match(only, fact("lemma", "andare", true));
    assert.match(only, fact("person", "third"));
    assert.match(only, fact("number", "plural"));
    assert.match(only, fact("tense", "imperfetto", true));
    assert.deepEqual(tenseHeadings(only), [...TENSE_BOXES, "imperativo", "modi indefiniti"]);
    // Outlined exactly once, where it sits, and said in words.
    assert.equal(occurrencesOf(only, "data-searched"), 1);
    assert.match(only, new RegExp(`<div class="${esc(SEARCHED)}" data-searched=""><dt[^>]*><span lang="it">essi/esse</span></dt><dd[^>]*><span><span lang="it" data-form="\\d+">andavano</span></span></dd><span[^>]*>your search</span>`));
    assert.match(only, /href="\/\?q=andare">Open entry →<\/a>/);
    assert.match(only, /data-lemma-panel=""/);
  });
});

test("casa stays a thin entry: its notes as notes, no invented definition, its silence said once", async () => {
  await withDevSeed(async ({ db }) => {
    const html = await render(db, "casa");
    const casa = card(html, "casa, noun");
    assert.match(casa, />Source notes<\/h3>/);
    assert.doesNotMatch(casa, />Definitions<\/h3>/);
    assert.match(textOf(casa), /The source has entry notes but gives no definition for this reading\./);
    assert.match(casa, /lang="it">casa \( approfondimento\) f sing<\/p>/);
    assert.equal(occurrencesOf(textOf(casa), "The source states neither a gender nor a number for this entry."), 1);
    // Both transcriptions the source gives, each with its own qualifier.
    assert.match(html, /\/ˈkaza\/<span class="[^"]*" lang="it">italiano settentrionale<\/span>/);
    assert.match(html, /\/ˈkasa\/<span class="[^"]*" lang="it">italiano standard<\/span>/);
  });
});

test("the word-level sections come once, after the cards, with their slices and Show all buttons", async () => {
  await withDevSeed(async ({ db }) => {
    const html = await render(db, "sale");
    const page = wordPage("sale", await readingsFor(db, "sale"));
    const afterCards = html.slice(html.lastIndexOf("</article>"));

    // Two etymologies, and the source does not say which reading each is for.
    assert.equal(occurrencesOf(afterCards, `<span class="${ETYMOLOGY_LABEL}">`), 2);
    assert.match(afterCards, /Etymology 1 — reading not given/);
    assert.match(afterCards, /Etymology 2 — reading not given/);

    const synonyms = page.wordFacts.synonyms.length;
    assert.ok(synonyms > RELATED_SLICE);
    assert.match(afterCards, new RegExp(`>Synonyms</h2><span class="[^"]*">${synonyms} · showing ${RELATED_SLICE}</span>`));
    assert.match(afterCards, new RegExp(`<summary class="[^"]*flex w-full[^"]*"><span[^>]*>Show all ${synonyms} synonyms</span>`));
    // Every chip is in the document, each a search for its word.
    assert.equal(patternsOf(afterCards, /href="\/\?q=[^"]+" lang="it">/), synonyms + page.wordFacts.antonyms.length + page.wordFacts.derived.length);
    assert.match(afterCards, />Derived words<\/h2><span class="[^"]*">5<\/span>/);

    // Nothing of it is inside a card.
    for (const part of cardsOf(html)) assert.doesNotMatch(part, />Synonyms<|>Etymology</);
    // And a word without any of it has no section at all.
    const andavano = await render(db, "andavano");
    assert.doesNotMatch(andavano, />Synonyms<|>Antonyms<|>Derived words</);
    assert.doesNotMatch(andavano, />Pronunciation</);
    assert.match(andavano, />Syllables<\/dt>/);
  });
});

test("definitions and examples show one, and put the rest behind a bordered button", async () => {
  await withDevSeed(async ({ db }) => {
    const verb = card(await render(db, "andare"), "andare, verb");
    const reading = (await readingsFor(db, "andare")).find((candidate) => candidate.pos === "verb");
    assert.ok(reading);
    const examples = reading.senses.flatMap((sense) => sense.examples);
    assert.match(verb, new RegExp(`>Definitions</h3><span class="[^"]*">${reading.senses.length} · showing ${DEFINITION_SLICE}</span>`));
    assert.match(verb, new RegExp(`<summary class="[^"]*border-border-strong[^"]*"><span[^>]*>Show all ${reading.senses.length} definitions</span>`));
    assert.match(verb, new RegExp(`>Examples</h3><span class="[^"]*">${examples.length} · showing 1</span>`));
    assert.match(verb, new RegExp(`Show all ${examples.length} examples`));
    for (const example of examples) assert.ok(verb.includes(`lang="it">${example.text.replace(/'/g, "&#x27;").replace(/"/g, "&quot;")}</li>`), example.text);
  });
});

test("the noise the frames do not have is gone", async () => {
  await withDevSeed(async ({ db }) => {
    for (const query of ["casa", "andare", "andavano", "bello", "sale", "studente"]) {
      const html = await render(db, query);
      const text = textOf(html);
      assert.doesNotMatch(text, /form-of/, `${query}: no form-of label`);
      assert.doesNotMatch(text, /unclassified/, `${query}: no unclassified pill`);
      assert.doesNotMatch(text, /Forms pointing here/, `${query}: no reverse links`);
      assert.doesNotMatch(text, /lists no forms/, `${query}: no empty-section apology`);
      assert.doesNotMatch(text, /Release it-page-test|release line/, `${query}: no release line`);
      assert.doesNotMatch(text, /Sources and licences/, `${query}: no old footer`);
      assert.doesNotMatch(text, /entries for|Italian word/, `${query}: no count line or field label`);
      assert.equal(patternsOf(html, /<button[\s>]/), 0, `${query}: no search button`);
      // `warning` marks the etymology labels the frames colour, and the
      // disputed-claim mark, and nothing else.
      const warnings = occurrencesOf(html, "text-warning");
      const allowed = occurrencesOf(html, `class="${ETYMOLOGY_LABEL}"`) + occurrencesOf(html, "Disputed by later research.");
      assert.equal(warnings, allowed, `${query}: no other red text`);
      // One Source link per headword on the page.
      assert.equal(occurrencesOf(html, "aria-label=\"Wiktionary page for "), new Set(cardLabels(html).map((label) => label.split(",")[0])).size, query);
    }
  });
});

test("bello's superlatives are rows in a box, not a stack of pills", async () => {
  await withDevSeed(async ({ db }) => {
    const bella = card(await render(db, "bello"), "bella, adjective form");
    const box = boxesOf(bella).find((part) => part.includes(">Absolute superlative</h4>"));
    assert.ok(box);
    assert.deepEqual(textOf(box).replace("Absolute superlative", ""), "m sgbellissimom plbellissimif sgbellissimaf plbellissime");
    assert.match(textOf(bella), /This entry does not define “?"?bello"?”?; it lists the form in its own table\./);
  });
});

test("the source's Italian carries lang=\"it\": glosses and etymologies", async () => {
  await withDevSeed(async ({ db }) => {
    const html = await render(db, "sale");
    const reading = (await readingsFor(db, "sale"))[0];
    for (const sense of reading.senses) for (const gloss of sense.glosses) {
      assert.ok(html.includes(`lang="it">${gloss.text}`), gloss.text);
    }
    const page = wordPage("sale", await readingsFor(db, "sale"));
    for (const etymology of page.wordFacts.etymologies) {
      assert.ok(html.includes(`<span lang="it">${etymology.text}</span>`), etymology.text);
    }
    assert.doesNotMatch(html, /<html/);
  });
});

// Page chrome ------------------------------------------------------------------

test("the home page is the name, the field and the Try chips, centred", async () => {
  const home = renderToStaticMarkup(
    <SearchPage raw="">
      <FirstLoad />
    </SearchPage>,
  );
  assert.match(home, new RegExp(`^<main class="${esc(SHELL_CENTRED)}"><h1 [^>]*>Lexema</h1>`));
  assert.doesNotMatch(home, new RegExp(esc(TOP_BAR)));
  assert.match(home, /placeholder="Search an Italian word"/);
  assert.match(home, /aria-label="Search an Italian word"/);
  assert.match(home, />ENTER<\/kbd>/);
  assert.match(home, /<form class="[^"]*" role="search" action="\/" method="get">/);
  assert.match(home, />Try<\/span>/);
  for (const word of TRY_WORDS) assert.match(home, new RegExp(`href="/\\?q=${word}" lang="it">${word}</a>`));
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

test("every page reaches the attribution page from the footer's four links", async () => {
  const footer = renderToStaticMarkup(<SiteFooter />);
  const links = [...footer.matchAll(new RegExp(`<a class="${esc(SITE_FOOTER_LINK)}" href="([^"]+)">([^<]+)</a>`, "g"))];
  assert.deepEqual(links.map((match) => match[2]), ["Attribution", "About the data", "Licence", "Contact"]);
  for (const [, href] of links) assert.match(href, /^\/attribution(#|$)/);
  assert.match(footer, />Lexema<\/span>/);

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
    assert.match(sale, /href="https:\/\/it\.wiktionary\.org\/wiki\/sale" rel="noreferrer" aria-label="Wiktionary page for sale, the source of this page">Source/);
  });
});

// Edge cases the synthetic archive reaches ---------------------------------------

test("a verb whose auxiliary is source text shows it verbatim, and a second tagged cycle joins its tense rows", async () => {
  await withFixture(async ({ db }) => {
    const finire = card(await render(db, "finire"), "finire, verb");
    assert.match(finire, /<span lang="it" data-form="1">se intr\. essere<\/span>/);
    assert.match(finire, fact("conjugation", "verbo incoativo di terza coniugazione"));
    assert.deepEqual(tenseHeadings(finire), ["presente", "imperfetto", "imperativo", "modi indefiniti"]);

    // `provare`'s eight person-tagged cycles fill the eight tense boxes; its
    // second present cycle is person-tagged too, so it is alternates in the
    // same presente rows rather than a box of its own.
    const provare = card(await render(db, "provare"), "provare, verb");
    assert.deepEqual(tenseHeadings(provare), [
      "presente",
      "imperfetto",
      "passato remoto",
      "futuro semplice",
      "passato prossimo",
      "trapassato prossimo",
      "trapassato remoto",
      "futuro anteriore",
      "imperativo",
      "modi indefiniti",
    ]);
    assert.match(textOf(provare), /ioprovo \/ sub-io/);
    // No che rows, so nothing was derived and the rule is not named.
    assert.doesNotMatch(provare, /it-moods\/v1/);
    const reading = (await readingsFor(db, "provare"))[0];
    assertEveryFormShown(provare, reading, "provare");
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
