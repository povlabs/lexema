// Rule-built cardinals (ADR 0034, #804): a spelled Italian number up to
// 999.999 that nothing in the dictionary answers gets one reading rule
// `it-cardinal/v1` builds, with the fixed Lexema definition "numero cardinale
// corrispondente a N", alike in `lookup()`, `lookupBatch()`, `exists()` and
// on the word page; its *Fonte* opens /licence and the API credits Lexema.
// A number word the source lists keeps exactly its source readings.
//
// fixtures/cardinals.jsonl holds verbatim lines of it-0c432803, in archive
// order: 39076 `cinquantanove`, 41858 `ventitré` and 43015 `duemila`,
// Aggettivi numerali all.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { renderToStaticMarkup } from "react-dom/server";
import { seedSql } from "../../src/import/seedSql.js";
import { lookupBatch } from "../../src/lookup/batch.js";
import { fromNodeSqlite } from "../../src/lookup/database.js";
import { exists, lookup } from "../../src/lookup/lookup.js";
import { isRuleBuiltCardinal, type Reading } from "../../src/lookup/types.js";
import { searchAttempt } from "@/lib/dictionary/searchAttempt.ts";
import { definitionsOf } from "@/lib/dictionary/definitions.ts";
import { Outcome, SearchPage } from "@/components/dictionary/SearchPage";
import { SOURCE_LINE } from "@/components/shared/styles.ts";
import { candidatesOf, entryAttribution, resultJson } from "@/worker/api/lookupAnswer.ts";
import { UNFILTERED } from "@/worker/api/lookupFilters.ts";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const RELEASE = "it-cardinals-page";
const VERSION = `${RELEASE}.0`;
const LINES = (await readFile(join(REPO, "fixtures/cardinals.jsonl"), "utf8")).trimEnd().split("\n");

let dir: string;
let db: DatabaseSync;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "lexema-cardinals-"));
  const archive = join(dir, "fixture.jsonl.gz");
  await writeFile(archive, gzipSync(Buffer.from(`${LINES.join("\n")}\n`, "utf8")));
  const { parts } = await seedSql({
    input: archive,
    outputDir: join(dir, "sql"),
    schema: join(REPO, "src/db/schema.sql"),
    releaseId: RELEASE,
    license: "CC-BY-SA-4.0",
    onRejection: (rejection) => {
      throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
    },
  });
  db = new DatabaseSync(":memory:");
  for (const part of parts) db.exec(await readFile(part, "utf8"));
});

after(async () => {
  db.close();
  await rm(dir, { recursive: true, force: true });
});

const dictionary = () => fromNodeSqlite(db);

async function render(query: string): Promise<string> {
  const attempt = await searchAttempt(dictionary(), RELEASE, query);
  return renderToStaticMarkup(
    <SearchPage raw={query} version={VERSION}>
      <Outcome raw={query} attempt={attempt} />
    </SearchPage>,
  );
}

const textOf = (html: string): string => html.replace(/<[^>]*>/g, "").replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
const headingsOf = (html: string): string[] => [...html.matchAll(/<h2 class="[^"]*" id="reading-heading-[^"]+">(.*?)<\/h2>/g)].map((match) => textOf(match[1]));
const footerOf = (html: string): string => {
  const start = html.lastIndexOf(`<footer class="${SOURCE_LINE}" lang="it">`);
  return html.slice(start, html.indexOf("</footer>", start));
};
/** Every *Fonte* on the page, footer included: where each links. */
const sourceLinks = (html: string): string[] => [...html.matchAll(/<a [^>]*href="([^"]+)"[^>]*>Fonte</g)].map((match) => match[1]);

/** The one reading a lookup of `query` answers with, which must be rule-built. */
async function ruleBuilt(query: string): Promise<Reading> {
  const result = await lookup({ db: dictionary(), releaseId: RELEASE, query });
  assert.ok(result.outcome === "found", query);
  assert.equal(result.readings.length, 1, query);
  const [reading] = result.readings;
  assert.ok(isRuleBuiltCardinal(reading), query);
  return reading;
}

const definitionTexts = (reading: Reading): string[] =>
  definitionsOf(reading).items.map((item) => (item.from === "cardinal" ? item.text : item.from === "record" ? item.sense.glosses.map((gloss) => gloss.text).join("\n") : item.from));

test("duemilauno, centoventitré and millenovecentottanta are each answered by rule it-cardinal/v1, with the fixed Lexema definition", async () => {
  for (const [query, value] of [["duemilauno", 2001], ["centoventitré", 123], ["millenovecentottanta", 1980]] as const) {
    const reading = await ruleBuilt(query);
    assert.deepEqual([reading.word, reading.pos, reading.posTitle, reading.cardinal?.rule, reading.cardinal?.value], [query, "adj", "Aggettivo numerale", "it-cardinal/v1", value]);
    assert.deepEqual(definitionTexts(reading), [`numero cardinale corrispondente a ${value}`]);
  }
});

test("one cardinal gets the same answer from single lookup, batch lookup, exists and the word page", async () => {
  const reading = await ruleBuilt("duemilauno");

  const { answers } = await lookupBatch({ db: dictionary(), releaseId: RELEASE, queries: ["duemilauno"] });
  const [answer] = answers;
  assert.ok(answer.outcome === "found");
  assert.deepEqual(
    answer.candidates.map((candidate) => [candidate.word, candidate.pos, candidate.posTitle, candidate.cardinal]),
    [[reading.word, reading.pos, reading.posTitle, reading.cardinal]],
  );

  const present = await exists({ db: dictionary(), releaseId: RELEASE, query: "duemilauno" });
  assert.ok(present.outcome === "present");
  assert.deepEqual([present.word, present.cardinal], [reading.word, reading.cardinal]);

  const html = await render("duemilauno");
  assert.deepEqual(headingsOf(html), ["1·Aggettivo numerale"]);
  assert.match(textOf(html), /Definizioni1\.numero cardinale corrispondente a 2001/);

  // The API credits Lexema alike on all three routes, under CC0, linking the Licenza page the page's Fonte opens.
  const lexema = { licence: "CC0 1.0", licence_url: "https://creativecommons.org/publicdomain/zero/1.0/", source: "Lexema", source_url: "https://lexema.fyi/licence" };
  const result = await lookup({ db: dictionary(), releaseId: RELEASE, query: "duemilauno" });
  assert.ok(result.outcome === "found");
  const [candidate] = await candidatesOf(result, async () => undefined);
  const json = resultJson(candidate, UNFILTERED);
  assert.deepEqual(
    [json.id, json.word, json.definitions, json.attribution],
    [`${RELEASE}:cardinal:2001`, "duemilauno", [{ definition: "numero cardinale corrispondente a 2001", labels: [], examples: [], items: [] }], lexema],
  );
  assert.deepEqual(entryAttribution(answer.candidates[0]), lexema);
  assert.deepEqual(entryAttribution(present), lexema);
  assert.deepEqual(sourceLinks(html), ["/licence"]);
});

test("a number above the limit, unmilione, gets no rule-built reading on any route", async () => {
  assert.equal((await lookup({ db: dictionary(), releaseId: RELEASE, query: "unmilione" })).outcome, "not-found");
  assert.equal((await exists({ db: dictionary(), releaseId: RELEASE, query: "unmilione" })).outcome, "absent");
  assert.equal((await lookupBatch({ db: dictionary(), releaseId: RELEASE, queries: ["unmilione"] })).answers[0].outcome, "not-found");
});

test("a malformed spelling, centocento, gets no rule-built reading on any route", async () => {
  assert.equal((await lookup({ db: dictionary(), releaseId: RELEASE, query: "centocento" })).outcome, "not-found");
  assert.equal((await exists({ db: dictionary(), releaseId: RELEASE, query: "centocento" })).outcome, "absent");
  assert.equal((await lookupBatch({ db: dictionary(), releaseId: RELEASE, queries: ["centocento"] })).answers[0].outcome, "not-found");
});

test("a number the source has, cinquantanove, keeps exactly its source readings, with no rule-built reading added", async () => {
  const result = await lookup({ db: dictionary(), releaseId: RELEASE, query: "cinquantanove" });
  assert.ok(result.outcome === "found");
  const source = JSON.parse(LINES[0]) as { word: string; senses: { glosses: string[] }[] };
  assert.deepEqual(
    result.readings.map((reading) => [reading.word, reading.ref.lineNo, reading.cardinal, reading.senses.map((sense) => sense.glosses.map((gloss) => gloss.text))]),
    [[source.word, 1, undefined, source.senses.map((sense) => sense.glosses)]],
  );
  const { answers } = await lookupBatch({ db: dictionary(), releaseId: RELEASE, queries: ["cinquantanove", "duemila"] });
  assert.deepEqual(
    answers.map((answer) => (answer.outcome === "found" ? answer.candidates.map((candidate) => [candidate.word, candidate.lineNo, candidate.cardinal]) : answer.outcome)),
    [[["cinquantanove", 1, undefined]], [["duemila", 3, undefined]]],
  );
  const present = await exists({ db: dictionary(), releaseId: RELEASE, query: "cinquantanove" });
  assert.ok(present.outcome === "present");
  assert.equal(present.cardinal, undefined);
  assert.deepEqual(sourceLinks(await render("cinquantanove")), ["https://it.wiktionary.org/wiki/cinquantanove"]);
});

test("ventitre, the accentless spelling of a number the source has, opens the source's ventitré, not a rule-built reading", async () => {
  const result = await lookup({ db: dictionary(), releaseId: RELEASE, query: "ventitre" });
  assert.ok(result.outcome === "found");
  assert.deepEqual(result.route, { kind: "accentless", headword: "ventitré" });
  assert.deepEqual(result.readings.map((reading) => [reading.word, reading.cardinal]), [["ventitré", undefined]]);
  // A compound the source lacks takes the accentless tre as the rule does.
  assert.equal((await ruleBuilt("centoventitre")).cardinal?.value, 123);
});

test("the word page shows a rule-built cardinal like any other reading, with no note that it is derived or missing from the source", async () => {
  const built = await render("duemilauno");
  const listed = await render("cinquantanove");
  // The parts of a source numeral's page: its part of speech heading, its definitions, then Fonte and the report.
  // The rule states no grammar, so the heading names no `invariabile` the source states of cinquantanove.
  assert.deepEqual(headingsOf(built), ["1·Aggettivo numerale"]);
  assert.deepEqual(headingsOf(listed), ["1·Aggettivo numerale·invariabile"]);
  assert.match(textOf(built), /Definizioni1\./);
  assert.match(textOf(listed), /Definizioni1\./);
  assert.equal(textOf(footerOf(built)), "Fonte·Segnala un errore");
  assert.equal(textOf(footerOf(built)), textOf(footerOf(listed)));
  assert.doesNotMatch(textOf(built), /regola|it-cardinal|generat|derivat|Lexema ha|non .*fonte|Wikizionario non|Nessuna voce/i);
  assert.match(footerOf(built), /aria-label="Pagina Licenza di Lexema per duemilauno, la fonte di questa voce \(si apre in una nuova scheda\)"/);
});
