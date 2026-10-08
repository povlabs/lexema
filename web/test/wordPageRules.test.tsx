// One page-wide check per word-page rule (#709), run on real words.
//
// Each rule of design-system-manifest.md § "How a word page renders", and of
// ADR 0030 for the corrections, is one check over a whole page: the
// `wordPage()` or `phrasePage()` model the search builds, and the HTML the page
// renders from it. A check reads every reading of the page, never one word's
// snapshot, so it holds for any word it is given. Each rule runs on the words
// the manifest and the #707 census name for it, and every built rule runs on
// one real word for each shape the census found (wordPageShapeWords.ts).
//
// A rule whose fix is not built yet is a `node:test` todo naming its fix
// issue: the check runs, and its failure is reported, not counted. The fix
// removes its `todo`, and the check then proves it.
//
// The words are real: their records are it-0c432803's lines, in
// `fixtures/dev-seed.jsonl` (docs/DEV_SEED.md). The words whose lines cannot
// sit there are read from their own fixtures, also it-0c432803's lines:
// salivate's and salivare's from `fixtures/salivate.jsonl`, which page.test.tsx
// adds to the dev seed; citto's from `fixtures/citto.jsonl`, which would take
// away the dev seed's accent-offer page; assorbire's from
// `fixtures/essere-compound-cells.jsonl`, which page.test.tsx adds too;
// sfocato's from `fixtures/sfocato.jsonl`, which pageStatements.test.ts adds;
// and the words of `fixtures/no-base-record.jsonl`, such as calabra and zurlò,
// one of whose form_of edges names a word with no record, since the dev seed
// holds no edge without a target. The raw pages are the ones committed under
// `fixtures/`, as the dev seed reads them when no dump is cached.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { renderToStaticMarkup } from "react-dom/server";
import { seedSql } from "../../src/import/seedSql.js";
import { CURATED_CORRECTIONS, cellCorrections } from "../../src/italian/curatedCorrections.js";
import { loadFixturePages } from "../../src/source/rawPage.js";
import { compoundAuxiliary } from "../../src/italian/compoundAuxiliary.js";
import { essereAgreement } from "../../src/italian/essereAgreement.js";
import { glossBase } from "../../src/italian/formOfGlossEdge.js";
import { fromNodeSqlite } from "../../src/lookup/database.js";
import { entryKey, isFormOfReading, isSourceRef, type LemmaLink, type Reading } from "../../src/lookup/types.js";
import { atFixtureLines, edgeCorrectionsAt } from "../../test/correctionFixture.js";
import { seededDictionary } from "../../test/seededDictionary.js";
import { phrasePageFacts, wordPageFacts } from "../../tools/wordPageShapes/facts.ts";
import { shapeOf } from "../../tools/wordPageShapes/shape.ts";
import { SHAPE_WORDS } from "./wordPageShapeWords.ts";
import { wordPageProblems } from "@/builds/previewSmokeCommand.ts";
import { Outcome, SearchPage } from "@/components/dictionary/SearchPage";
import { FORM_LINES, JUMP_LINK } from "@/components/shared/styles.ts";
import type { Conjugation } from "@/lib/dictionary/conjugation.ts";
import { definitionsOf, type DefinitionItem } from "@/lib/dictionary/definitions.ts";
import { phrasePage, type PhrasePage } from "@/lib/dictionary/phrasePage.ts";
import { searchAttempt } from "@/lib/dictionary/searchAttempt.ts";
import {
  baseWordOf,
  numberedEntries,
  readingAnchor,
  shownRecords,
  showsJumpLinks,
  wordPage,
  type FormOfPart,
  type LemmaPart,
  type ShownEntry,
  type WordPage,
} from "@/lib/dictionary/wordPage.ts";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const RELEASE = "it-word-page-rules";

const linesOf = async (file: string): Promise<string[]> => (await readFile(join(REPO, file), "utf8")).trimEnd().split("\n");

/**
 * The dev seed and the five companion fixtures, with the committed raw pages,
 * seeded once for this file: with the committed list's table cells (#723) and
 * edges (ADR 0030, #722) on these lines, as the seed of it-0c432803 writes
 * them and the page serves them, or, for the #707 census, with the edges as
 * the source stated them when the census read the release (`as-censused`).
 */
async function dictionary(edges: "corrected" | "as-censused" = "corrected"): Promise<DatabaseSync> {
  return seededDictionary(`word-page-rules-${edges}`, async (outputDir) => {
    const lines = [
      ...(await linesOf("fixtures/dev-seed.jsonl")),
      ...(await linesOf("fixtures/salivate.jsonl")),
      ...(await linesOf("fixtures/citto.jsonl")),
      ...(await linesOf("fixtures/essere-compound-cells.jsonl")),
      ...(await linesOf("fixtures/sfocato.jsonl")),
      ...(await linesOf("fixtures/no-base-record.jsonl")),
    ];
    await mkdir(outputDir, { recursive: true });
    const archive = join(outputDir, "fixture.jsonl.gz");
    await writeFile(archive, gzipSync(Buffer.from(`${lines.join("\n")}\n`, "utf8")));
    return seedSql({
      input: archive,
      outputDir,
      schema: join(REPO, "src/db/schema.sql"),
      releaseId: RELEASE,
      archiveR2Key: `releases/${RELEASE}.jsonl.gz`,
      license: "CC-BY-SA-4.0",
      rawPages: await loadFixturePages(join(REPO, "fixtures")),
      // The committed list's table cells (#723) keyed to the lines here, as a seed of the release writes them, and its edges unless as censused.
      corrections: [
        ...atFixtureLines(lines, RELEASE, cellCorrections(CURATED_CORRECTIONS)),
        ...(edges === "corrected" ? edgeCorrectionsAt(lines, RELEASE) : []),
      ],
      onRejection: (rejection) => {
        throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
      },
    });
  });
}

/** A searched page: the model the search builds, the readings the lookup found, and the HTML it renders. */
type SearchedPage =
  | { kind: "word"; query: string; page: WordPage; readings: readonly Reading[]; html: string }
  | { kind: "phrase"; query: string; page: PhrasePage; readings: readonly Reading[]; html: string };

/** What a check may ask beyond the page: the records the lookup finds for another word. */
interface Lookup {
  recordsOf(word: string): Promise<readonly Reading[]>;
}

async function searched(db: DatabaseSync, query: string): Promise<SearchedPage> {
  const attempt = await searchAttempt(fromNodeSqlite(db), RELEASE, query);
  assert.equal(attempt.outcome, "found", `${query}: the search finds it`);
  if (attempt.outcome !== "found") throw new Error("unreachable");
  const html = renderToStaticMarkup(
    <SearchPage raw={query} version={`${RELEASE}.0`}>
      <Outcome raw={query} attempt={attempt} />
    </SearchPage>,
  );
  if (attempt.route.kind === "phrase") {
    return { kind: "phrase", query, page: phrasePage(query, attempt.route, attempt.readings), readings: attempt.readings, html };
  }
  return { kind: "word", query, page: wordPage(query, attempt.readings, attempt.lemmas, attempt.route), readings: attempt.readings, html };
}

function lookupOf(db: DatabaseSync): Lookup {
  return {
    async recordsOf(word) {
      const attempt = await searchAttempt(fromNodeSqlite(db), RELEASE, word);
      return attempt.outcome === "found" ? attempt.readings.filter((reading) => reading.word === word) : [];
    },
  };
}

// What the HTML says ------------------------------------------------------------

const textOf = (html: string): string => html.replace(/<[^>]*>/g, "").replace(/&#x27;/g, "'").replace(/&quot;/g, '"');

/** The headings of a page's readings, as text: `1·Sostantivo`. */
const headingsOf = (html: string): string[] =>
  [...html.matchAll(/<h2 class="[^"]*" id="reading-heading-[^"]+">(.*?)<\/h2>/g)].map((match) => textOf(match[1]));

/** Whether the page lists its readings under the headword. */
const hasJumpList = (html: string): boolean => html.includes('aria-label="Readings"');

/** The jump links' texts: `1Sostantivo`. */
const jumpLinksOf = (html: string): string[] => [...html.matchAll(/<a class="([^"]*)" href="#[^"]+">(.*?)<\/a>/g)].filter((match) => match[1] === JUMP_LINK).map((match) => textOf(match[2]));

const jumpLinkCount = (html: string): number => jumpLinksOf(html).length;

/** One entry's article, by its anchor. */
function articleOf(html: string, entry: ShownEntry): string {
  const open = html.indexOf(`id="${readingAnchor(entry)}"`);
  return open === -1 ? "" : html.slice(open, html.indexOf("</article>", open));
}

// What the model says -----------------------------------------------------------

/** Every entry that is a block about a base word: a noun's or adjective's form-of reading, a verb's or a grid's block. */
const blocksOf = (page: WordPage): ShownEntry[] =>
  page.readings.filter((entry) => entry.kind === "verb-form" || entry.kind === "grid-form" || (entry.kind === "source" && entry.role === "form-of"));

/** The kinds of what a source reading shows; none for a block or a bare reading. */
const partKindsOf = (entry: ShownEntry): string[] => (entry.kind === "source" ? entry.parts.map((part) => part.kind) : []);

/** Two headwords that differ only in which apostrophe they use read as one (§ 2). */
const oneApostrophe = (word: string): string => word.replace(/[’‘ʼ]/g, "'");

/** Each table the page draws, named so two drawings of one table share a name. */
function tablesOf(page: WordPage): string[] {
  const names: string[] = [];
  for (const entry of page.readings) {
    if (entry.kind === "verb-form") for (const table of entry.tables) names.push(`conjugation ${table.lemma.word}`);
    if (entry.kind === "grid-form") for (const table of entry.tables) names.push(`grid ${table.lemma.word} ${JSON.stringify(table.agreement.grid)}`);
    if (entry.kind !== "source") continue;
    for (const part of entry.parts) {
      if (part.kind === "own-forms") {
        names.push(part.forms.kind === "conjugation" ? `conjugation ${entry.reading.word}` : `grid ${entry.reading.word} ${JSON.stringify(part.forms.agreement.grid)}`);
      }
      if (part.kind === "lemma-forms") {
        for (const table of part.tables) {
          names.push(table.kind === "conjugation" ? `conjugation ${table.lemma.word}` : `grid ${table.lemma.word} ${JSON.stringify(table.agreement.grid)}`);
        }
      }
    }
  }
  return names;
}

/** Each conjugation the page draws. */
function conjugationsOf(page: WordPage): { word: string; conjugation: Conjugation }[] {
  return page.readings.flatMap((entry) =>
    entry.kind === "source"
      ? entry.parts.flatMap((part) => (part.kind === "own-forms" && part.forms.kind === "conjugation" ? [{ word: entry.reading.word, conjugation: part.forms.conjugation }] : []))
      : [],
  );
}

const duplicates = (values: readonly string[]): string[] => [...new Set(values.filter((value, i) => values.indexOf(value) !== i))];

// The rules ----------------------------------------------------------------------

type Problems = string[];

interface Rule {
  /** The row it enforces, as its home writes it: a manifest row's bold rule, or an ADR's decision. */
  row: string;
  /** Where the row is written. */
  home: string;
  words: readonly string[];
  /** The fix issue that builds the rule, while it is not built. */
  todo?: `#${number}`;
  /** The rule, over any page: what on the page breaks it. A page the rule does not reach has nothing to break. */
  check(page: SearchedPage, lookup: Lookup): Problems | Promise<Problems>;
  /** What the rule's home says of its own example words, beyond the page-wide check. */
  named?: Record<string, (page: SearchedPage) => Problems>;
}

const MANIFEST = "design-system-manifest.md#how-a-word-page-renders";

const S1_ONLY_ABOUT: Rule = {
  row: "§ 1 Only records about the searched word.",
  home: `${MANIFEST} (§ 1)`,
  words: ["costruttrici", "bellissima", "grande"],
  // A record is a reading only when its headword is the word searched; a record
  // of another word shows only as the verb of a block. A page none of whose own
  // records shows anything falls back to the records that list it.
  check(p) {
    if (p.kind !== "word") return [];
    const about = new Set(p.readings.filter((reading) => reading.isAboutQuery).map(entryKey));
    const shown = shownRecords(p.page.readings);
    if (!shown.some((record) => about.has(entryKey(record.reading)))) return [];
    const blockVerbs = new Set(p.page.readings.flatMap((entry) => (entry.kind === "verb-form" ? entry.verbs.map(entryKey) : [])));
    return shown
      .filter((record) => !about.has(entryKey(record.reading)) && !blockVerbs.has(entryKey(record.reading)))
      .map((record) => `record ${entryKey(record.reading)} is a reading, and is not about ${p.query}`);
  },
  named: Object.fromEntries(
    Object.entries({
      // costruttore's and costruttori's records list costruttrici; neither is one of its readings (#698).
      costruttrici: ["costruttore", "costruttori", "costruttrice"],
      bellissima: ["bella", "bellissimo", "bello"],
      grande: ["grandissimo", "grandissima", "grandissimi", "grandissime"],
    }).map(([word, others]) => [
      word,
      (p: SearchedPage): Problems =>
        p.kind !== "word"
          ? [`${word} opens no word page`]
          : shownRecords(p.page.readings)
              .filter((record) => others.includes((record.reading as Reading).word))
              .map((record) => `${(record.reading as Reading).word}'s record is a reading of ${word}`),
    ]),
  ),
};

const S1_NOTHING_TO_SHOW: Rule = {
  row: "§ 1 A reading with nothing to show is not rendered.",
  home: `${MANIFEST} (§ 1)`,
  words: ["litigante"],
  // On a page where some reading shows something, a record about the word that
  // is not shown has no definition, no example, no form line and no table.
  check(p) {
    if (p.kind !== "word" || p.page.readings.some((entry) => entry.kind === "bare" || entry.kind === "lone-bare")) return [];
    const shown = new Set(shownRecords(p.page.readings).map((record) => entryKey(record.reading)));
    return p.readings
      .filter((reading) => reading.isAboutQuery && !shown.has(entryKey(reading)))
      .filter((reading) => {
        const { items, looseExamples } = definitionsOf(reading);
        return items.length > 0 || looseExamples.length > 0 || reading.lemmaLinks.length > 0 || reading.forms.length > 0;
      })
      .map((reading) => `${reading.posTitle} ${entryKey(reading)} has something to show and is left out`);
  },
  named: {
    // The noun, whose one sense has no gloss, is left out between the two.
    litigante: (p) => assertEqual(headingsOf(p.html), ["1·Aggettivo·maschile e femminile, singolare", "2·Voce verbale·litigare"]),
  },
};

const S1_LONE_EMPTY: Rule = {
  row: "§ 1 A page where every reading is empty (P2) keeps the part of speech under the word.",
  home: `${MANIFEST} (§ 1)`,
  words: ["sbucciapatate", "fare l'abitudine"],
  // A page whose readings are all empty keeps their headings: one alone is its
  // part of speech, unnumbered; two or more are numbered.
  check(p) {
    if (p.kind !== "word") return [];
    const { readings } = p.page;
    const kinds = readings.map((entry) => entry.kind);
    if (!kinds.every((kind) => kind === "bare" || kind === "lone-bare")) return kinds.some((kind) => kind === "bare" || kind === "lone-bare") ? ["an empty reading sits beside one that shows something"] : [];
    if (readings.length === 1) {
      const [only] = readings;
      if (only.kind !== "lone-bare") return ["the one empty reading carries a number"];
      return assertEqual(headingsOf(p.html), [only.reading.posTitle]);
    }
    const headings = headingsOf(p.html);
    return readings.flatMap((entry, i) =>
      entry.kind === "bare" && headings[i]?.startsWith(`${i + 1}·${entry.reading.posTitle}`) ? [] : [`empty reading ${i + 1} is headed ${headings[i]}`],
    );
  },
  named: {
    sbucciapatate: (p) => assertEqual(headingsOf(p.html), ["Sostantivo"]),
    "fare l'abitudine": (p) => assertEqual(headingsOf(p.html), ["Locuzione verbale"]),
  },
};

const S2_NUMBERED: Rule = {
  row: "§ 2 Every reading is numbered, and the numbers never skip.",
  home: `${MANIFEST} (§ 2)`,
  words: ["salivare", "litigante"],
  // Every entry is numbered 1, 2, 3 in page order, and every heading leads with its number.
  check(p) {
    if (p.kind !== "word") return [];
    const entries = numberedEntries(p.page.readings);
    if (entries === undefined) return [];
    const problems = assertEqual(entries.map((entry) => entry.number), entries.map((_, i) => i + 1));
    const headings = headingsOf(p.html);
    if (headings.length !== entries.length) problems.push(`${headings.length} headings for ${entries.length} readings`);
    headings.forEach((heading, i) => {
      if (!heading.startsWith(`${i + 1}·`)) problems.push(`heading ${i + 1} reads ${heading}`);
    });
    return problems;
  },
  named: {
    salivare: (p) => assertEqual(headingsOf(p.html), ["1·Aggettivo·maschile e femminile, singolare", "2·Verbo"]),
  },
};

/**
 * The jump links show for three readings or more, or for two readings about
 * two different words; two headwords that differ only in their apostrophe are
 * one word, two that differ in capitals are two.
 */
function jumpLinkProblems(p: SearchedPage): Problems {
  if (p.kind !== "word") return [];
  const { readings } = p.page;
  const words = new Set(readings.map((entry) => oneApostrophe(baseWordOf(entry))));
  const expected = readings.length >= 3 || words.size >= 2;
  const problems: Problems = [];
  if (showsJumpLinks(p.page) !== expected) problems.push(`the model ${expected ? "hides" : "shows"} the jump links`);
  if (hasJumpList(p.html) !== expected) problems.push(`the page ${expected ? "has no" : "has a"} jump list`);
  if (expected && jumpLinkCount(p.html) !== readings.length) problems.push(`${jumpLinkCount(p.html)} jump links for ${readings.length} readings`);
  return problems;
}

const links = (shows: boolean) => (p: SearchedPage): Problems => (hasJumpList(p.html) === shows ? [] : [`expected ${shows ? "a" : "no"} jump list`]);

const S2_JUMP_LINKS: Rule = {
  row: "§ 2 Jump links for three or more readings, or for two readings about two different words.",
  home: `${MANIFEST} (§ 2)`,
  words: ["studente", "salivate", "salivare", "andare"],
  check: jumpLinkProblems,
  named: { studente: links(true), salivate: links(true), salivare: links(false), andare: links(false) },
};

const S2_CAPITALS: Rule = {
  row: "§ 1 A record whose headword differs only in capitals is a reading; § 2 Headwords that differ only in capitals are two words (Q2, Q3).",
  home: `${MANIFEST} (§ 1, § 2)`,
  words: ["abaco", "AC"],
  // Every record whose headword is the word searched in other capitals is a
  // reading, about a word of its own.
  check(p) {
    if (p.kind !== "word") return [];
    const shown = new Set(shownRecords(p.page.readings).map((record) => entryKey(record.reading)));
    const about = new Set(p.page.readings.map(baseWordOf));
    return p.readings
      .filter((reading) => reading.isAboutQuery && reading.word !== p.query && reading.word.toLowerCase() === p.query.toLowerCase())
      .flatMap((reading) => [
        ...(shown.has(entryKey(reading)) ? [] : [`${reading.word}'s record is not a reading`]),
        ...(isFormOfReading(reading) || about.has(reading.word) ? [] : [`no reading is about ${reading.word}`]),
      ]);
  },
  named: {
    abaco: (p) => assertEqual(jumpLinksOf(p.html), ["1Sostantivo", "2Nome proprio"]),
    AC: (p) => links(true)(p),
  },
};

const S6_NO_JUMP_LINKS: Rule = {
  row: "§ 2 and § 6: an expression page never has jump links, even with three or more readings (Q6).",
  home: `${MANIFEST} (§ 2, § 6)`,
  words: ["Venerdì santi", "servizio sanitario nazionali"],
  check: (p) => (p.kind === "phrase" && hasJumpList(p.html) ? [`the expression page has a jump list for ${p.page.readings.length} readings`] : []),
  named: Object.fromEntries(
    ["Venerdì santi", "servizio sanitario nazionali"].map((word) => [
      word,
      (p: SearchedPage): Problems => (p.kind === "phrase" && p.page.readings.length >= 3 ? [] : [`${word} is not an expression page of three readings or more`]),
    ]),
  ),
};

const S3_TABLE_ONCE: Rule = {
  row: "§ 3 A table shows once on a page.",
  home: `${MANIFEST} (§ 3)`,
  words: ["essere", "vivere"],
  check: (p) => (p.kind === "word" ? duplicates(tablesOf(p.page)).map((name) => `${name.split(" {")[0]} drawn twice`) : []),
  named: Object.fromEntries(
    ["essere", "vivere"].map((word) => [word, (p: SearchedPage): Problems => (p.kind === "word" && tablesOf(p.page).filter((name) => name === `conjugation ${word}`).length === 1 ? [] : [`${word}'s conjugation is not drawn once`])]),
  ),
};

/** Two blocks about one base word (rule 1). */
const oneBlockProblems = (p: SearchedPage): Problems =>
  p.kind === "word" ? duplicates(blocksOf(p.page).map(baseWordOf)).map((word) => `two blocks about ${word}`) : [];

const S4_ONE_BLOCK: Rule = {
  row: "§ 4 One block per base word.",
  home: `${MANIFEST} (§ 4)`,
  words: ["costruttrici", "bella", "stato"],
  check: oneBlockProblems,
  named: {
    // costruttrici's adjective and noun records are one block, for costruttore (#698).
    costruttrici: (p) => (p.kind === "word" ? assertEqual(p.page.readings.map((entry) => `${entry.kind} ${baseWordOf(entry)}`), ["source costruttore"]) : ["no word page"]),
    bella: (p) => (p.kind === "word" ? assertEqual(p.page.readings.map(baseWordOf), ["bello"]) : ["no word page"]),
  },
};

/** The page is one form block about `base`, heading both of its records, which draws `line` once. */
const oneFormBlock = (base: string, line: string) => (p: SearchedPage): Problems => {
  if (p.kind !== "word") return ["no word page"];
  const [only] = p.page.readings;
  if (p.page.readings.length !== 1 || only.kind !== "source" || only.role !== "form-of") return [`${JSON.stringify(headingsOf(p.html))}, expected one form block`];
  const lines = textOf(articleOf(p.html, only)).split(line).length - 1;
  return [
    ...assertEqual([baseWordOf(only)], [base]),
    ...(headingsOf(p.html).length === 1 ? [] : [`${headingsOf(p.html).length} headings`]),
    ...(only.also.length === 1 ? [] : [`the block heads ${1 + only.also.length} records, expected 2`]),
    ...(lines === 1 ? [] : [`"${line}" shows ${lines} times`]),
  ];
};

const S4_NO_BASE_RECORD: Rule = {
  row: "§ 4 One block per base word: a form's adjective, noun or pronoun records of one base word are one block.",
  home: `${MANIFEST} (§ 4)`,
  words: ["calabra", "altri", "blasfeme"],
  check: oneBlockProblems,
  // Each word's two records are one block under one heading, whether or not the
  // page reads a record of their base word, their one identical line shown once (#717).
  named: {
    calabra: (p) => [...oneFormBlock("calabro", "femminile di calabro")(p), ...links(false)(p)],
    altri: oneFormBlock("altro", "plurale di altro"),
    blasfeme: oneFormBlock("blasfema", "plurale di blasfema"),
  },
};

/** The labels over a form block's groups of meanings (#727), in page order. */
const groupLabelsOf = (html: string): string[] => [...html.matchAll(/<h4 class="[^"]*" lang="it">(.*?)<\/h4>/g)].map((match) => textOf(match[1]));

/** The texts of a block's numbered meanings, in page order. */
const meaningsOf = (html: string): string[] =>
  [...html.matchAll(/<li class="[^"]*" data-definition="\d+">(.*?)<\/li>/g)].map((match) => textOf(match[1]).replace(/^\d+\./, ""));

/** `parts` show in this order in the page's text, each after the one before. */
const inOrder = (html: string, parts: readonly string[]): Problems => {
  const text = textOf(html);
  let at = -1;
  for (const part of parts) {
    at = text.indexOf(part, at + 1);
    if (at === -1) return [`expected in order: ${parts.join(" | ")}`];
  }
  return [];
};

/** A block's *Definitions* section, up to its end. */
const definitionsSectionOf = (article: string): string => {
  const open = article.indexOf('id="definitions-');
  return open === -1 ? "" : article.slice(open, article.indexOf("</section>", open));
};

const S4_MERGED_BLOCK: Rule = {
  row: "§ 4 One block per base word: a block whose records have several parts of speech names each in its heading, and groups its base word's meanings by them under small labels.",
  home: `${MANIFEST} (§ 4)`,
  words: ["bella", "costruttrici", "grandi", "bellissima", "blasfeme", "poltroni"],
  // A noun or adjective form block's heading names each part of speech of its
  // records that are not verbs', in record order, each once, or the first
  // record's own pos_title when they share one. Its meanings group under a
  // label per part of speech, in the heading's order, only when it names
  // several; no meaning shows twice (Huey's ruling of 2026-10-07 on #727).
  check(p) {
    if (p.kind !== "word") return [];
    return p.page.readings.flatMap((entry) => {
      if (entry.kind !== "source" || entry.role !== "form-of") return [];
      const records = [entry.reading, ...entry.also].filter((record) => record.pos !== "verb");
      const parts = [...new Set(records.map((record) => record.posTitle.replace(/, forma flessa$/, "")))];
      const title = parts.length > 1 ? parts.join("·") : entry.reading.posTitle;
      const article = articleOf(p.html, entry);
      const [heading = ""] = headingsOf(article);
      const head = `${entry.number}·${title}`;
      const labels = groupLabelsOf(article);
      const meanings = meaningsOf(article);
      return [
        ...(heading === head || heading.startsWith(`${head}·`) ? [] : [`${entry.baseWord}'s block is headed ${heading}, expected ${head}`]),
        ...(parts.length > 1
          ? labels.length === new Set(labels).size && labels.every((label, i) => parts.includes(label) && (i === 0 || parts.indexOf(label) > parts.indexOf(labels[i - 1])))
            ? []
            : [`${entry.baseWord}'s groups are ${JSON.stringify(labels)}, expected a run of ${JSON.stringify(parts)}`]
          : labels.map((label) => `${entry.baseWord}'s block of one part of speech labels a group ${label}`)),
        ...(parts.length > 1 && meanings.length > 0 && labels.length === 0 ? [`${entry.baseWord}'s meanings carry no label`] : []),
        ...duplicates(meanings).map((meaning) => `"${meaning}" shows twice in ${entry.baseWord}'s block`),
        ...(occurrencesIn(definitionsSectionOf(article), "+ more</span>") > 1 ? [`${entry.baseWord}'s Definitions have more than one + more`] : []),
      ];
    });
  },
  named: {
    // bello's adjective meanings, then its noun meanings, each under its label.
    bella: (p) => [
      // bello's adjective record's six meanings, then its two noun records', two and one.
      ...assertEqual([JSON.stringify(modelBlock(p))], [JSON.stringify({ heading: ["Aggettivo", "Sostantivo"], groups: ["Aggettivo bello 6", "Sostantivo bello 2, bello 1"] })]),
      ...assertEqual(headingsOf(p.html), ["1·Aggettivo·Sostantivo·femminile, singolare"]),
      ...assertEqual(groupLabelsOf(p.html), ["Aggettivo", "Sostantivo"]),
      ...inOrder(p.html, ["femminile singolare di bello", "femminile di bello", "Aggettivo", "che desta impressione di piacere e gradimento", "Sostantivo", "individuo di particolare fascino", "Forms of"]),
    ],
    costruttrici: (p) => [
      ...assertEqual([JSON.stringify(modelBlock(p))], [JSON.stringify({ heading: ["Aggettivo", "Sostantivo"], groups: ["Aggettivo costruttore 1", "Sostantivo costruttore 1"] })]),
      ...assertEqual(headingsOf(p.html), ["1·Aggettivo·Sostantivo·femminile, singolare"]),
      ...inOrder(p.html, ["plurale di costruttrice", "Aggettivo", "che costruisce", "Sostantivo", "chi costruisce", "Forms of"]),
    ],
    grandi: (p) => assertEqual(groupLabelsOf(p.html), ["Aggettivo", "Sostantivo"]),
    // One record, or two of one part of speech: the source's own heading, and no label.
    bellissima: (p) => [...assertEqual(headingsOf(p.html), ["1·Aggettivo, forma flessa·femminile, singolare"]), ...assertEqual(groupLabelsOf(p.html), [])],
    blasfeme: (p) => [...assertEqual(headingsOf(p.html).map((heading) => heading.split("·").slice(0, 2).join("·")), ["1·Aggettivo, forma flessa"]), ...assertEqual(groupLabelsOf(p.html), [])],
    poltroni: (p) => [...assertEqual(headingsOf(p.html).map((heading) => heading.split("·").slice(0, 2).join("·")), ["1·Sostantivo, forma flessa"]), ...assertEqual(groupLabelsOf(p.html), [])],
  },
};

/**
 * What the page model says of a page's one form block: its heading's parts of
 * speech, and each group of meanings with the base records it is read from.
 */
function modelBlock(p: SearchedPage): { heading: string[]; groups: string[] } | undefined {
  if (p.kind !== "word") return undefined;
  const [only] = p.page.readings;
  if (p.page.readings.length !== 1 || only.kind !== "source" || only.role !== "form-of") return undefined;
  const definitions = only.parts.flatMap((part) => (part.kind === "lemma-definitions" ? [part.definitions] : []));
  return {
    heading: only.heading.kind === "one" ? [only.heading.posTitle] : only.heading.partsOfSpeech,
    groups: definitions.flatMap((one) =>
      one.kind === "one"
        ? one.lists.map((list) => `- ${list.lemma.word}`)
        : one.groups.map((group) => `${group.partOfSpeech} ${group.lists.map((list) => `${list.lemma.word} ${list.items.length}`).join(", ")}`),
    ),
  };
}

/** How many times a literal string occurs. */
const occurrencesIn = (html: string, text: string): number => html.split(text).length - 1;

const S4_NO_OWN_FORMS: Rule = {
  row: "§ 4 One block per base word: a form-of reading never shows a Forms table of its own.",
  home: `${MANIFEST} (§ 4)`,
  words: ["costruttrici", "bella"],
  check(p) {
    if (p.kind !== "word") return [];
    return p.page.readings.flatMap((entry) => {
      if (entry.kind !== "source" || entry.role !== "form-of") return [];
      const own = entry.parts.flatMap((part) => (part.kind === "lemma-forms" ? part.tables.filter((table) => table.lemma.word === entry.reading.word) : []));
      return [
        ...(partKindsOf(entry).includes("own-forms") ? [`${entry.reading.word}'s form-of reading shows its own Forms`] : []),
        ...own.map(() => `${entry.reading.word}'s form-of reading shows a table of ${entry.reading.word}`),
        ...(articleOf(p.html, entry).includes(`Forms of ${entry.reading.word}<`) ? [`the page draws Forms of ${entry.reading.word}`] : []),
      ];
    });
  },
};

const S4_NO_ETYMOLOGY: Rule = {
  row: "§ 4 No Etymology inside a block (P14).",
  home: `${MANIFEST} (§ 4)`,
  words: ["stato", "sale"],
  check(p) {
    if (p.kind !== "word") return [];
    return blocksOf(p.page).flatMap((entry) => {
      const kinds = partKindsOf(entry);
      const article = articleOf(p.html, entry);
      return [
        ...(kinds.includes("etymology") || article.includes(">Etymology<") ? [`the block about ${baseWordOf(entry)} has an Etymology`] : []),
        ...(kinds.includes("synonyms") || article.includes(">Synonyms<") ? [`the block about ${baseWordOf(entry)} has Synonyms`] : []),
      ];
    });
  },
  named: {
    // The noun's own etymology, `dal sostantivo latino statu(m)`, stays; the one the source labels `(voce verbale)` shows nowhere.
    stato: (p) => (textOf(p.html).includes("dal latino statu(m), participio passato") ? ["stato shows the etymology the source ties to its verb form"] : []),
    sale: (p) => (/vedi sala/.test(textOf(p.html)) ? ["sale shows vedi sala"] : []),
  },
};

const S4_BASE_TABLE: Rule = {
  row: "§ 4 The base word's table.",
  home: `${MANIFEST} (§ 4)`,
  words: ["smentita"],
  // A table the page draws fills a cell: a base word's conjugation none of
  // whose forms fills one is not drawn, so no Forms row is dashes only (#674).
  check: (p) => wordPageProblems(p.html, p.query).filter((problem) => problem.endsWith("a Forms row of dashes only")),
  named: {
    // smentito's one record is a participle whose forms are its agreement: its
    // block keeps smentito's meaning and draws no Forms of smentito.
    smentita: (p) => [
      ...(textOf(p.html).includes("participio passato di smentire, smentirsi") ? [] : ["smentita's block drops smentito's meaning"]),
      ...(/Forms of<span[^>]*>smentito</.test(p.html) ? ["smentita draws Forms of smentito"] : []),
    ],
  },
};

const S4_NO_RECORD: Rule = {
  row: "§ 4 A form no record describes (P3).",
  home: `${MANIFEST} (§ 4)`,
  words: ["gravida", "citta"],
  // A grid's form block shows only on a page none of whose records about the
  // word shows anything, as a noun or adjective form block reads.
  check(p) {
    if (p.kind !== "word") return [];
    const grids = p.page.readings.flatMap((entry) => (entry.kind === "grid-form" ? [entry] : []));
    if (grids.length === 0) return [];
    const problems: Problems = [];
    if (shownRecords(p.page.readings).some((record) => (record.reading as Reading).isAboutQuery)) problems.push("a grid's form block beside a record about the word");
    for (const block of grids) {
      const base = block.records[0].word;
      if (!block.posTitle.endsWith(", forma flessa")) problems.push(`${base}'s block is headed ${block.posTitle}`);
      for (const line of block.lines) if (line.lemma !== base || !line.text.endsWith(` di ${base}`)) problems.push(`line "${line.text}" does not end with ${base}`);
      for (const table of block.tables) if (table.lemma.word !== base) problems.push(`${base}'s block draws ${table.lemma.word}'s table`);
    }
    return problems;
  },
  named: {
    gravida: (p) => (p.kind === "word" ? assertEqual(p.page.readings.map((entry) => `${entry.kind} ${baseWordOf(entry)}`), ["grid-form gravido"]) : ["no word page"]),
    citta: (p) => (p.kind === "word" ? assertEqual(p.page.readings.map((entry) => `${entry.kind} ${baseWordOf(entry)}`), ["grid-form citto"]) : ["no word page"]),
  },
};

const S4_ADJECTIVE_AND_VERB: Rule = {
  row: "§ 4 A form that is both an adjective's and a verb's, of one base word, is one block (Q5).",
  home: `${MANIFEST} (§ 4)`,
  words: ["presiedute", "laureati"],
  // A noun or adjective form block beside a verb block about the same base
  // word is a second block about it.
  check(p) {
    if (p.kind !== "word") return [];
    const verbs = p.page.readings.flatMap((entry) => (entry.kind === "verb-form" ? [entry] : []));
    return p.page.readings.flatMap((entry) => {
      if (entry.kind !== "source" || entry.role !== "form-of") return [];
      const verb = verbs.find((block) => block.verb === entry.baseWord);
      return verb === undefined ? [] : [`${entry.reading.posTitle} of ${entry.baseWord} is a block beside Voce verbale · ${verb.verb}`];
    });
  },
  named: {
    // presiedere is a verb: one verb block, the verb's line, the adjective's under it, then presiedere's conjugation.
    presiedute: (p) => {
      if (p.kind !== "word") return ["no word page"];
      const [only] = p.page.readings;
      if (p.page.readings.length !== 1 || only.kind !== "verb-form") return [`${JSON.stringify(headingsOf(p.html))}, expected one Voce verbale block`];
      const text = textOf(articleOf(p.html, only));
      const at = ["participio passato plurale femminile di presiedere", "femminile plurale di presiedere", "Forms of"].map((part) => text.indexOf(part));
      return [
        ...assertEqual(headingsOf(p.html), ["1·Voce verbale·presiedere"]),
        ...assertEqual(only.lines.map((line) => (line.kind === "source" ? line.reading.posTitle : line.kind)), ["Voce verbale", "Aggettivo, forma flessa"]),
        ...assertEqual(tablesOf(p.page), ["conjugation presiedere"]),
        ...(at.every((place, i) => place !== -1 && (i === 0 || place > at[i - 1])) ? [] : [`the block reads ${text.slice(0, 160)}`]),
      ];
    },
    // laureato is no verb: its adjective block, with laureato's grid; laurearsi keeps its own block.
    laureati: (p) =>
      p.kind === "word"
        ? [
            ...assertEqual(p.page.readings.map((entry) => `${entry.kind} ${baseWordOf(entry)}`), ["source laureato", "verb-form laurearsi"]),
            // Its adjective and noun records name both parts of speech (#727); the verb form record adds none.
            ...assertEqual(headingsOf(p.html), ["1·Aggettivo·Sostantivo·maschile, plurale", "2·Voce verbale·laurearsi"]),
            ...assertEqual(tablesOf(p.page).map((name) => name.split(" {")[0]), ["grid laureato"]),
          ]
        : ["no word page"],
  },
};

const S5_WORD_FACTS: Rule = {
  row: "§ 5 No base-word extras on any page (P5, P6); a word's own facts stay.",
  home: `${MANIFEST} (§ 5)`,
  words: ["bella", "vada", "andata", "andate"],
  // The word's Etymology, Synonyms, Antonyms and Derived words are its own
  // records' that are not forms; its Expressions, any record's about it.
  check(p) {
    if (p.kind !== "word") return [];
    const about = p.readings.filter((reading) => reading.isAboutQuery);
    const own = about.filter((reading) => !isFormOfReading(reading));
    // The page drops an etymology's bracket label, `(sostantivo)`, so a shown text is part of its record's.
    const ownTexts = own.flatMap((reading) => reading.wordFacts.etymologies.map((etymology) => etymology.text));
    const ownWords = (list: "synonyms" | "antonyms" | "derived") => new Set(own.flatMap((reading) => reading.wordFacts[list].map((related) => related.word)));
    const placed = p.page.readings.flatMap((entry): (LemmaPart | FormOfPart)[] => (entry.kind === "source" ? entry.parts : []));
    const etymologies = [
      ...p.page.wordFacts.etymologies.map((etymology) => etymology.text),
      ...placed.flatMap((part) => (part.kind === "etymology" ? part.etymologies.map((etymology) => etymology.text) : [])),
    ];
    const problems = etymologies.filter((text) => !ownTexts.some((own) => own.includes(text))).map((text) => `the etymology "${text}" is a form record's`);
    for (const list of ["synonyms", "antonyms", "derived"] as const) {
      const allowed = ownWords(list);
      for (const related of p.page.wordFacts[list]) if (!allowed.has(related.word)) problems.push(`${list}: ${related.word} is a form record's`);
    }
    const synonymItems = placed.flatMap((part) => (part.kind === "synonyms" ? part.items : []));
    for (const item of synonymItems) if (item.kind === "word" && !ownWords("synonyms").has(item.word)) problems.push(`a reading's synonym ${item.word} is a form record's`);
    const ownPhrases = new Set(about.flatMap((reading) => reading.wordFacts.expressions.map((expression) => expression.phrase)));
    for (const expression of p.page.expressions?.expressions ?? []) if (!ownPhrases.has(expression.phrase)) problems.push(`the expression ${expression.phrase} is another word's`);
    return problems;
  },
  named: {
    bella: (p) => (/vedi bello/.test(textOf(p.html)) ? ["bella shows vedi bello"] : []),
    vada: (p) => [...(/da andare/.test(textOf(p.html)) ? ["vada shows da andare"] : []), ...(/muova/.test(textOf(p.html)) ? ["vada shows si muova"] : [])],
    andata: (p) => (p.kind === "word" && p.page.wordFacts.etymologies.some((etymology) => /vedi andare/.test(etymology.text)) ? [] : ["andata loses its own vedi andare"]),
    andate: (p) => (p.kind === "word" && p.page.expressions !== undefined ? [] : ["andate loses its own Expressions"]),
  },
};

const S6_EXPRESSION_LINES: Rule = {
  row: "§ 6 A searched expression gets a short page.",
  home: `${MANIFEST} (§ 6)`,
  words: ["vado via"],
  // Each form line names an expression the search found; the page draws no
  // Forms, and a reading's form lines come before its Definitions.
  check(p) {
    if (p.kind !== "phrase") return [];
    const expressions = new Set(p.readings.map((reading) => reading.word));
    const problems: Problems = [];
    for (const entry of p.page.readings) {
      if (entry.text.kind !== "form") continue;
      for (const line of entry.text.forms) if (!expressions.has(line.phrase)) problems.push(`a line names ${line.phrase}, which the search did not find`);
    }
    if (/Forms of|>Forms</.test(p.html)) problems.push("the expression page draws a Forms table");
    for (const article of p.html.split("<article ").slice(1)) {
      const definitions = article.indexOf(">Definitions<");
      const firstLine = article.indexOf(`class="${FORM_LINES}"`);
      if (definitions !== -1 && firstLine > definitions) problems.push("a form line comes after the Definitions");
    }
    return problems;
  },
  named: {
    "vado via": (p) =>
      p.kind === "phrase" && p.page.readings[0]?.text.kind === "form"
        ? assertEqual(
            p.page.readings[0].text.forms.map((line) => `${line.before}${line.phrase}${line.after}`),
            ["prima persona singolare del presente semplice indicativo di andare via"],
          )
        : ["vado via is not an expression page with form lines"],
  },
};

// Rules not built yet ------------------------------------------------------------

const S2_APOSTROPHES: Rule = {
  row: "§ 2 Headwords that differ only in their apostrophe are one word (Q4).",
  home: `${MANIFEST} (§ 2)`,
  words: ["all'improvviso", "fare l'occhiolino"],
  check: jumpLinkProblems,
};

/**
 * The senses whose lines an entry shows, each with its record: a form block's
 * form lines, a verb block's source lines, and any other reading's every
 * sense. A record split across blocks, or a verb form record's lines across
 * verbs, shows each sense in one entry only.
 */
function sensesShownIn(entry: ShownEntry): { record: Reading; sense: Reading["senses"][number] }[] {
  const ofItem = (record: Reading, item: DefinitionItem) => (item.from === "record" ? [{ record, sense: item.sense }] : []);
  if (entry.kind === "verb-form") return entry.lines.flatMap((line) => (line.kind === "source" ? ofItem(line.reading, line.item) : []));
  if (entry.kind !== "source") return [];
  if (entry.role !== "form-of") return entry.reading.senses.map((sense) => ({ record: entry.reading, sense }));
  return entry.parts.flatMap((part) =>
    part.kind === "form-lines" ? part.records.flatMap(({ reading, text }) => (text.kind === "definitions" ? text.items.flatMap((item) => ofItem(reading, item)) : [])) : [],
  );
}

/**
 * Whether `link` is a `form_of` edge the source states on sense `sense`, read
 * at `/senses/<sense>/form_of/<i>/word`; an edge a correction set is read at
 * the gloss that names its word (ADR 0030).
 */
const isSourceEdgeOn = (link: LemmaLink, sense: number): boolean =>
  isSourceRef(link.ref) && new RegExp(`^/senses/${sense}/form_of/\\d+/word$`).test(link.ref.jsonPointer);

/** The words ADR 0030 names for its edges: each base word their glosses name must be found, or the check proves nothing. */
const EDGE_WORDS = ["aerei", "costruttori", "parti"];

/** The page is one block, about `base`, with no reading list. */
const oneBlockAbout = (base: string) => (p: SearchedPage): Problems =>
  p.kind === "word" ? [...assertEqual(p.page.readings.map(baseWordOf), [base]), ...links(false)(p)] : ["no word page"];

const ADR_0030_EDGES: Rule = {
  row: "ADR 0030: a form_of edge added or fixed when the gloss names X after \"di\" and X's own table lists the word (Q7 to Q9).",
  home: ".decisions/0030-corrections-may-fix-edges-and-cells.md",
  words: EDGE_WORDS,
  // Every line of a form record about the word that the source leaves with no
  // edge, whose gloss names X after "di" as a form's gloss does (rule
  // `it-form-of-gloss-edge/v1`) and whose word X's own table lists, sits in
  // X's block or draws X's table. A line whose source edge names another word
  // stays as the source states it unless a ruling fixed it (question 9), so
  // only an edge a correction set counts. On the rule's own words a base word
  // the lookup does not find is a problem: a missing record would otherwise
  // leave the check nothing to hold.
  async check(p, lookup) {
    if (p.kind !== "word") return [];
    const problems: Problems = [];
    for (const entry of p.page.readings) {
      const named = new Set<string>([baseWordOf(entry)]);
      if (entry.kind === "source") {
        for (const part of entry.parts) {
          if (part.kind === "lemma-forms") for (const table of part.tables) named.add(table.lemma.word);
          if (part.kind === "lemma-lines") for (const word of part.words) named.add(word);
        }
      }
      for (const { record, sense } of sensesShownIn(entry)) {
        const [gloss] = sense.glosses;
        const read = gloss === undefined ? undefined : glossBase(gloss.text);
        if (!record.isAboutQuery || gloss === undefined || read === undefined || !read.formOpening || read.base === record.word) continue;
        if (record.lemmaLinks.some((link) => isSourceEdgeOn(link, sense.index))) continue;
        const bases = await lookup.recordsOf(read.base);
        if (EDGE_WORDS.includes(p.query) && bases.length === 0) problems.push(`${read.base}, which "${gloss.text}" names, has no record here`);
        if (named.has(read.base)) continue;
        if (bases.some((base) => base.forms.some((form) => form.surface === record.word))) problems.push(`"${gloss.text}" is not in ${read.base}'s block`);
      }
    }
    return problems;
  },
  named: {
    aerei: oneBlockAbout("aereo"),
    costruttori: oneBlockAbout("costruttore"),
    // A parto block holding parti's two lines about parto, and a parte block holding neither.
    parti: (p) => {
      if (p.kind !== "word") return ["no word page"];
      const blockOf = (base: string) => p.page.readings.find((entry) => baseWordOf(entry) === base);
      const parto = blockOf("parto");
      const parte = blockOf("parte");
      const partoLines = ["nell'accezione di atto biologico", "nell'accezione di persona della popolazione dei Parti"];
      return [
        ...(parto === undefined
          ? ["no parto block"]
          : partoLines.filter((line) => !textOf(articleOf(p.html, parto)).includes(line)).map((line) => `parto's block lacks "${line}"`)),
        ...(parte === undefined
          ? ["no parte block"]
          : partoLines.filter((line) => textOf(articleOf(p.html, parte)).includes(line)).map((line) => `parte's block holds "${line}"`)),
      ];
    },
  },
};

const ADR_0030_CELLS: Rule = {
  row: "ADR 0030: a conjugation cell set by hand (Q10); a plural essere cell agrees with its subject.",
  home: ".decisions/0030-corrections-may-fix-edges-and-cells.md",
  words: ["assorbire"],
  check(p) {
    if (p.kind !== "word") return [];
    const problems: Problems = [];
    for (const { word, conjugation } of conjugationsOf(p.page)) {
      for (const mood of conjugation.moods) {
        for (const tense of mood.compound) {
          tense.cells.forEach((cell, row) => {
            if (!["noi", "voi", "loro"].includes(mood.persons[row])) return;
            for (const { surface } of cell.forms) {
              if (compoundAuxiliary(surface) === "essere" && essereAgreement(surface, "plural").kind !== "agrees") {
                problems.push(`${word}: ${mood.mood} ${tense.name} ${mood.persons[row]} reads "${surface}"`);
              }
            }
          });
        }
      }
    }
    return problems;
  },
  named: {
    // The 21 plural essere cells read as Huey ruled (#723): the plural participle, then `assorti` once.
    // Every other cell keeps the source's participles: `sono assorbito, assorto`, `abbiamo assorbito, assorto`.
    assorbire: (p) => {
      if (p.kind !== "word") return ["assorbire opens no word page"];
      const problems: Problems = [];
      let corrected = 0;
      for (const { conjugation } of conjugationsOf(p.page)) {
        for (const mood of conjugation.moods) {
          for (const tense of mood.compound) {
            tense.cells.forEach((cell, row) => {
              for (const { surface } of cell.forms) {
                const spellings = surface.split(", ");
                if (new Set(spellings).size !== spellings.length) problems.push(`${mood.mood} ${tense.name} ${mood.persons[row]} repeats a spelling: "${surface}"`);
                const plural = compoundAuxiliary(surface) === "essere" && ["noi", "voi", "loro"].includes(mood.persons[row]);
                if (plural) corrected += 1;
                const participles = spellings.map((spelling) => spelling.split(" ").at(-1)).join(", ");
                const expected = plural ? "assorbiti, assorti" : "assorbito, assorto";
                if (participles !== expected) problems.push(`${mood.mood} ${tense.name} ${mood.persons[row]} reads "${surface}", not ${expected}`);
              }
            });
          }
        }
      }
      return [...problems, ...assertEqual([corrected], [21])];
    },
  },
};

const RULES: readonly Rule[] = [
  S1_ONLY_ABOUT,
  S1_NOTHING_TO_SHOW,
  S1_LONE_EMPTY,
  S2_NUMBERED,
  S2_JUMP_LINKS,
  S2_CAPITALS,
  S6_NO_JUMP_LINKS,
  S3_TABLE_ONCE,
  S4_ONE_BLOCK,
  S4_NO_BASE_RECORD,
  S4_MERGED_BLOCK,
  S4_NO_OWN_FORMS,
  S4_NO_ETYMOLOGY,
  S4_BASE_TABLE,
  S4_NO_RECORD,
  S4_ADJECTIVE_AND_VERB,
  S5_WORD_FACTS,
  S6_EXPRESSION_LINES,
  S2_APOSTROPHES,
  ADR_0030_EDGES,
  ADR_0030_CELLS,
];

function assertEqual<T>(actual: readonly T[], expected: readonly T[]): Problems {
  return JSON.stringify(actual) === JSON.stringify(expected) ? [] : [`${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`];
}

async function problemsOf(rule: Rule, p: SearchedPage, lookup: Lookup): Promise<Problems> {
  return [...(await rule.check(p, lookup)), ...(rule.named?.[p.query]?.(p) ?? [])];
}

for (const rule of RULES) {
  test(`${rule.row} [${rule.home}]: ${rule.words.join(", ")}`, rule.todo === undefined ? {} : { todo: rule.todo }, async () => {
    const db = await dictionary();
    try {
      const lookup = lookupOf(db);
      const found: Record<string, Problems> = {};
      for (const word of rule.words) found[word] = await problemsOf(rule, await searched(db, word), lookup);
      assert.deepEqual(found, Object.fromEntries(rule.words.map((word) => [word, []])));
    } finally {
      db.close();
    }
  });
}

// One real word per census shape ---------------------------------------------------

interface Census {
  headwords: { shapes: { shape: string }[] };
  expressionSearches: { shapes: { shape: string }[] };
}

const census = JSON.parse(readFileSync(join(REPO, "reports/2026-10-07-word-page-shapes.json"), "utf8")) as Census;
/** Every shape the #707 census found, headword pages and expression searches together, each once. */
const CENSUS_SHAPES = [...new Set([...census.headwords.shapes, ...census.expressionSearches.shapes].map(({ shape }) => shape))];

/**
 * The census parts a rule not built yet takes off the page once its fix lands.
 * Until then a shape with the part breaks that rule, so its word is checked
 * under the fix's todo; once the fix is built, its word no longer has the part
 * and keeps every built rule like any other.
 */
const PARTS_A_FIX_REMOVES: Record<string, Rule> = {
  "two blocks about one word": S4_NO_BASE_RECORD,
  "a verb block and a noun or adjective block about one word": S4_ADJECTIVE_AND_VERB,
};

/** A noun or adjective form block that names a second base word (`shape.ts`). */
const SECOND_BASE_WORD = "form-of 2+ base words";

/**
 * The census shapes whose word a built fix takes a part off, where other
 * shapes keep that part for another cause. A noun or adjective form whose
 * lines name two base words, each of whose tables lists it, shows a block per
 * base word (Q9 of #708; #722), so no block of `geni` names a second base word
 * any more; `instillare`'s verb form still names one by a lemma line.
 */
const SHAPES_A_FIX_TAKES_APART: Record<string, { part: string; fix: Rule }> = Object.fromEntries(
  [
    "form-of 2+ base words · form-of noun · 1 reading · no links",
    "form-of 2+ base words · form-of noun · verb-form · 2 readings, 2+ words · links",
    "form-of 2+ base words · form-of adjective · verb-form · 2 readings, 2+ words · links",
    "form-of 2+ base words · form-of noun · verb-form · 3+ readings · links",
    "form-of 2+ base words · form-of adjective · 1 reading · no links",
    "form-of 2+ base words · form-of adjective · form-of noun · 2 readings, 2+ words · links",
    "form-of 2+ base words · form-of noun · own noun · 2 readings, 2+ words · links",
  ].map((shape) => [shape, { part: SECOND_BASE_WORD, fix: ADR_0030_EDGES }]),
);

/** The fix not built yet that takes a part of `shape` off the page, if one does. */
const pendingFixOf = (shape: string): Rule | undefined =>
  shape.split(" · ").map((part) => PARTS_A_FIX_REMOVES[part]).find((fix) => fix !== undefined && fix.todo !== undefined);

/** A shape with no page: the search finds nothing, so no rule has a page to read. */
const NO_PAGE = "no page (not-found)";

/** The shape `word`'s search opens, read as the census reads it. */
async function shapeOfSearch(db: DatabaseSync, word: string): Promise<{ key: string; parts: string[] }> {
  const attempt = await searchAttempt(fromNodeSqlite(db), RELEASE, word);
  if (attempt.outcome !== "found") return shapeOf({ word, page: "none", outcome: attempt.outcome });
  if (attempt.route.kind === "phrase") return shapeOf(phrasePageFacts(word, phrasePage(word, attempt.route, attempt.readings)));
  return shapeOf(wordPageFacts(word, wordPage(word, attempt.readings, attempt.lemmas, attempt.route)));
}

test("every shape the #707 census found has one real word here whose page has that shape (#709)", async () => {
  assert.deepEqual(
    CENSUS_SHAPES.filter((shape) => SHAPE_WORDS[shape] === undefined),
    [],
    "a census shape with no word",
  );
  assert.deepEqual(
    Object.keys(SHAPE_WORDS).filter((shape) => !CENSUS_SHAPES.includes(shape)),
    [],
    "a word for a shape the census did not find",
  );
  // The census read the release before #722's edges; with them, a form record
  // the source left without an edge is no longer a reading of its own (`aerei`).
  const db = await dictionary("as-censused");
  try {
    const wrong: Record<string, string> = {};
    for (const shape of CENSUS_SHAPES) {
      const word = SHAPE_WORDS[shape];
      const found = await shapeOfSearch(db, word);
      const apart = SHAPES_A_FIX_TAKES_APART[shape];
      if (apart !== undefined && apart.fix.todo === undefined) {
        if (found.parts.includes(apart.part)) wrong[`${word} · ${shape}`] = found.key;
        continue;
      }
      // A part a built fix removes is gone from the page, so the word now has another shape.
      const removed = shape.split(" · ").filter((part) => PARTS_A_FIX_REMOVES[part] !== undefined && PARTS_A_FIX_REMOVES[part].todo === undefined);
      if (removed.length > 0 ? removed.some((part) => found.parts.includes(part)) : found.key !== shape) wrong[`${word} · ${shape}`] = found.key;
    }
    assert.deepEqual(wrong, {});
  } finally {
    db.close();
  }
});

/** The words of rules that are built, and each census shape's word: each page must keep every built rule. */
const ASSERTED = RULES.filter((rule) => rule.todo === undefined);
const TODO_WORDS = new Set(RULES.flatMap((rule) => (rule.todo === undefined ? [] : rule.words)));
const SHAPE_PAGE_WORDS = CENSUS_SHAPES.filter((shape) => shape !== NO_PAGE && pendingFixOf(shape) === undefined).map((shape) => SHAPE_WORDS[shape]);
const PAGE_WORDS = [...new Set([...ASSERTED.flatMap((rule) => rule.words).filter((word) => !TODO_WORDS.has(word)), ...SHAPE_PAGE_WORDS])];

async function brokenRules(db: DatabaseSync, words: readonly string[]): Promise<Record<string, Problems>> {
  const lookup = lookupOf(db);
  const broken: Record<string, Problems> = {};
  for (const word of words) {
    const p = await searched(db, word);
    for (const rule of ASSERTED) {
      const problems = await rule.check(p, lookup);
      if (problems.length > 0) broken[`${word} · ${rule.row}`] = problems;
    }
  }
  return broken;
}

test("every word here, one for each census shape among them, keeps every rule that is built, not only its own (#709)", async () => {
  const db = await dictionary();
  try {
    assert.deepEqual(await brokenRules(db, PAGE_WORDS), {});
  } finally {
    db.close();
  }
});

// A census shape a fix not built yet takes apart: its word breaks that fix's
// rule today, so it keeps every built rule only once the fix lands.
for (const fix of new Set(Object.values(PARTS_A_FIX_REMOVES))) {
  const words = CENSUS_SHAPES.filter((shape) => pendingFixOf(shape) === fix).map((shape) => SHAPE_WORDS[shape]);
  if (words.length === 0) continue;
  test(`the census shapes ${fix.todo} takes apart keep every built rule once it lands: ${words.join(", ")}`, { todo: fix.todo }, async () => {
    const db = await dictionary();
    try {
      assert.deepEqual(await brokenRules(db, words), {});
    } finally {
      db.close();
    }
  });
}
