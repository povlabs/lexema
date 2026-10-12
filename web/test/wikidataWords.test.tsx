// Wikidata words on the word page, the Licence page and in the API (ADR 0033,
// #812): a word Wiktionary lacks reads as an ordinary entry, its Italian
// glosses its definitions, and one with no Italian gloss is not loaded at all;
// the page's one *Fonte* opens its lexeme; a word
// Wiktionary has keeps its page; the Licence page has one Wikidata credit; and
// the API names and credits a Wikidata word by its lexeme.
// Seeded from the development fixture, then `load:wikidata-words` over the
// lexemes of fixtures/wikidata-words/lexemes.jsonl.

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
import { fromNodeSqlite } from "../../src/lookup/database.js";
import { lookup } from "../../src/lookup/lookup.js";
import { planWikidataWords } from "../../src/wikidataWords/loadWikidataWords.js";
import { parseSnapshot } from "../../src/wikidataWords/wordSnapshot.js";
import { searchAttempt } from "@/lib/dictionary/searchAttempt.ts";
import { Outcome, SearchPage } from "@/components/dictionary/SearchPage";
import { Licence } from "@/components/dictionary/Licence";
import { SOURCE_LINE } from "@/components/shared/styles.ts";
import { candidatesOf, entryAttribution, resultJson } from "@/worker/api/lookupAnswer.ts";
import { UNFILTERED } from "@/worker/api/lookupFilters.ts";
import type { ServedRelease } from "@lexema/source/servedRelease.ts";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const RELEASE = "it-wikidata-words-page";
const VERSION = `${RELEASE}.0`;

let dir: string;
let db: DatabaseSync;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "lexema-wikidata-words-page-"));
  const archive = join(dir, "fixture.jsonl.gz");
  await writeFile(archive, gzipSync(await readFile(join(REPO, "fixtures/dev-seed.jsonl"))));
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
  const words = parseSnapshot(await readFile(join(REPO, "fixtures/wikidata-words/lexemes.jsonl"), "utf8"));
  db.exec((await planWikidataWords({ query: <Row,>(sql: string) => db.prepare(sql).all() as Row[] }, words)).sql);
});

after(async () => {
  db.close();
  await rm(dir, { recursive: true, force: true });
});

async function render(query: string): Promise<string> {
  const attempt = await searchAttempt(fromNodeSqlite(db), RELEASE, query);
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

test("a Wikidata word with an Italian gloss shows it as its definition, and its one Fonte opens its lexeme", async () => {
  const html = await render("paparino");
  assert.deepEqual(headingsOf(html), ["1·Sostantivo"]);
  assert.match(textOf(html), /Definizioni1\.termine affettuoso per riferirsi al genitore di sesso maschile/);
  assert.equal(textOf(footerOf(html)), "Fonte·Segnala un errore");
  assert.deepEqual(sourceLinks(html), ["https://www.wikidata.org/wiki/Lexeme:L1144362"]);
  assert.match(footerOf(html), /aria-label="Voce di Wikidata per papà, la fonte di questa voce \(si apre in una nuova scheda\)"/);
  assert.doesNotMatch(html, /wiktionary/);
  // No mark of where it came from (ADR 0016).
  assert.doesNotMatch(textOf(html), /Wikidata|lessema/i);
});

test("a Wikidata word with no Italian gloss is not loaded, so its spellings get no Wikidata entry", async () => {
  // paralimpico (L1247138) has no Italian gloss (ADR 0033's 2026-10-12 amendment).
  for (const query of ["paralimpico", "paralimpiche"]) {
    const html = await render(query);
    assert.deepEqual(headingsOf(html), []);
    assert.doesNotMatch(html, /wikidata\.org/);
  }
});

test("a word Wiktionary has keeps its page: papà shows its record alone, credited to Wiktionary", async () => {
  const html = await render("papà");
  assert.deepEqual(sourceLinks(html), ["https://it.wiktionary.org/wiki/pap%C3%A0"]);
  assert.doesNotMatch(html, /wikidata\.org/);
  assert.deepEqual(headingsOf(html), ["1·Sostantivo·maschile, invariabile"]);
});

test("the Licence page carries exactly one Wikidata credit, in Italian, naming the words beside the names", () => {
  const served: ServedRelease = { release: "it-0c432803", dump: { url: "https://dumps.wikimedia.org/itwiktionary/20260701/", date: "2026-07-01" } } as ServedRelease;
  const html = renderToStaticMarkup(<Licence release={served} />);
  const credits = [...html.matchAll(/<p[^>]*>((?:(?!<\/p>).)*provengono da(?:(?!<\/p>).)*)<\/p>/g)].map((match) => textOf(match[1]));
  assert.equal(credits.length, 1, credits.join("\n"));
  assert.match(credits[0], /e le parole italiane che il Wikizionario non ha provengono da Wikidata/);
  assert.match(credits[0], /e ogni parola al proprio lessema\./);
  // Both Wikidata layers stay CC0 (Huey, 2026-10-12, #802).
  assert.match(credits[0], /Questi dati restano nel pubblico dominio e si possono riutilizzare liberamente\.$/);
  assert.equal([...html.matchAll(/href="https:\/\/www\.wikidata\.org\/"/g)].length, 1);
});

test("the API returns a Wikidata word like any entry, named and credited by its lexeme under CC0", async () => {
  const result = await lookup({ db: fromNodeSqlite(db), releaseId: RELEASE, query: "pento" });
  assert.ok(result.outcome === "found");
  const [candidate] = await candidatesOf(result, async () => undefined);
  const json = resultJson(candidate, UNFILTERED);
  assert.deepEqual(
    [json.id, json.word, json.pos, json.pos_title, json.definitions, json.attribution],
    [
      `${RELEASE}:wikidata:L1422655`,
      "pentirsi",
      "verb",
      "Verbo",
      [{ definition: "provare romorso per un'azione sbagliata commessa", labels: [], examples: [], items: [] }],
      { licence: "CC0 1.0", licence_url: "https://creativecommons.org/publicdomain/zero/1.0/", source: "Wikidata", source_url: "https://www.wikidata.org/wiki/Lexeme:L1422655" },
    ],
  );
  assert.deepEqual(entryAttribution({ word: "paralimpico", lexeme: "L1247138" }).source_url, "https://www.wikidata.org/wiki/Lexeme:L1247138");
});
