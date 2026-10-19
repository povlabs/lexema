// Name entries on the word page and in the API (ADR 0032, #794): a name entry
// reads as `Nome proprio` with its Wikidata description as its one definition;
// every page has one *Fonte*, in the footer beside *Segnala un errore*, to
// Wiktionary when any reading is Wiktionary's, else to the first name entry's
// Wikidata item, and no reading has its own (#827); and the API names and
// credits a name entry by its item.
// Seeded from fixtures/names/ as the dev seed seeds names: three verbatim
// archive lines, then `load:names` over items of the committed snapshot.

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
import { planNames } from "../../src/names/loadNames.js";
import { nameItem } from "../../src/names/nameItem.js";
import { searchAttempt } from "@/lib/dictionary/searchAttempt.ts";
import { Outcome, SearchPage } from "@/components/dictionary/SearchPage";
import { SOURCE_LINE } from "@/components/shared/styles.ts";
import { candidatesOf, entryAttribution, resultJson } from "@/worker/api/lookupAnswer.ts";
import { UNFILTERED } from "@/worker/api/lookupFilters.ts";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const RELEASE = "it-names-page";
const VERSION = `${RELEASE}.0`;

const NAMES = [
  nameItem({ item: "Q46", label: "Europa", description: "continente della Terra", category: "continent" }),
  nameItem({ item: "Q686341", label: "Giulia", description: "fiume", category: "river" }),
  nameItem({ item: "Q193089", label: "Europa", description: "isola nel Canale del Mozambico", category: "island" }),
  nameItem({ item: "Q695265", label: "Hormuz", description: "isola dell'Iran", category: "island" }),
  nameItem({ item: "Q17660", label: "Sale", description: "comune italiano", category: "comune" }),
];

let dir: string;
let db: DatabaseSync;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "lexema-names-page-"));
  const archive = join(dir, "fixture.jsonl.gz");
  await writeFile(archive, gzipSync(await readFile(join(REPO, "fixtures/names/archive-lines.jsonl"))));
  const { parts } = await seedSql({
    input: archive,
    outputDir: join(dir, "sql"),
    schema: join(REPO, "src/db/schema.sql"),
    releaseId: RELEASE,
    license: "CC-BY-SA-4.0",
    // No hand-kept reading: Giulia's record stands here for one with no meaning,
    // which the list fills since #803 (web/test/page.test.tsx).
    handKeptReadings: [],
    onRejection: (rejection) => {
      throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
    },
  });
  db = new DatabaseSync(":memory:");
  for (const part of parts) db.exec(await readFile(part, "utf8"));
  db.exec((await planNames({ query: <Row,>(sql: string) => db.prepare(sql).all() as Row[] }, NAMES)).sql);
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

/** The footer's *Fonte*: where it links. */
const footerSource = (html: string): string | undefined => footerOf(html).match(/<a [^>]*href="([^"]+)"/)?.[1];

test("a page whose one reading is a name entry reads as a proper name, its one Fonte to its Wikidata item beside Segnala un errore", async () => {
  const html = await render("Hormuz");
  // A lone reading keeps its number (§ 2): only an empty lone reading drops it.
  assert.deepEqual(headingsOf(html), ["1·Nome proprio"]);
  assert.match(textOf(html), /Definizioni1\.isola dell'Iran/);
  const footer = footerOf(html);
  assert.equal(textOf(footer), "Fonte·Segnala un errore");
  assert.equal(footerSource(html), "https://www.wikidata.org/wiki/Q695265");
  assert.match(footer, /aria-label="Voce di Wikidata per Hormuz, la fonte di questa voce \(si apre in una nuova scheda\)"/);
  // The footer's is the page's one Fonte: none sits under the definition (#827).
  assert.deepEqual(sourceLinks(html), ["https://www.wikidata.org/wiki/Q695265"]);
  assert.doesNotMatch(footer, /wiktionary/);
  assert.doesNotMatch(textOf(html), /Wikidata/);
});

test("a spelling two items share shows both, the continent before the island, and one Fonte to the first", async () => {
  const html = await render("europa");
  assert.deepEqual(headingsOf(html), ["1·Nome proprio", "2·Nome proprio"]);
  assert.ok(textOf(html).indexOf("continente della Terra") < textOf(html).indexOf("isola nel Canale del Mozambico"));
  assert.equal(textOf(footerOf(html)), "Fonte·Segnala un errore");
  assert.match(footerOf(html), /aria-label="Voce di Wikidata per Europa, la fonte di questa voce/);
  assert.deepEqual(sourceLinks(html), ["https://www.wikidata.org/wiki/Q46"]);
});

test("a word Wiktionary has keeps its page: a name with no meaning gains the name after it, and a word with one is unchanged", async () => {
  // Giulia's record has a sense with no gloss; the river is its first meaning on the page.
  const giulia = await render("Giulia");
  assert.match(textOf(giulia), /fiume/);
  assert.equal(textOf(footerOf(giulia)), "Fonte·Segnala un errore");
  // A mixed page credits Wiktionary alone: the name shows no Wikidata Fonte (#827).
  assert.deepEqual(sourceLinks(giulia), ["https://it.wiktionary.org/wiki/Giulia"]);
  assert.doesNotMatch(giulia, /wikidata\.org/);
  // `Sale` the comune is the key of the salt noun, so load:names left it out: the page is the noun's alone.
  const sale = await render("sale");
  assert.deepEqual(headingsOf(sale), ["1·Sostantivo·maschile, singolare"]);
  assert.deepEqual(sourceLinks(sale), ["https://it.wiktionary.org/wiki/sale"]);
  assert.doesNotMatch(textOf(sale), /comune italiano/);
});

test("the API returns a name entry like any entry, named and credited by its Wikidata item", async () => {
  const result = await lookup({ db: fromNodeSqlite(db), releaseId: RELEASE, query: "Hormuz" });
  assert.ok(result.outcome === "found");
  const [candidate] = await candidatesOf(result, async () => undefined);
  const json = resultJson(candidate, UNFILTERED);
  assert.deepEqual(
    [json.id, json.word, json.pos, json.pos_title, json.match.via, json.definitions, json.attribution],
    [
      `${RELEASE}:wikidata:Q695265`,
      "Hormuz",
      "name",
      "Nome proprio",
      "headword",
      [{ definition: "isola dell'Iran", labels: [], examples: [], items: [] }],
      { licence: "CC0 1.0", licence_url: "https://creativecommons.org/publicdomain/zero/1.0/", source: "Wikidata", source_url: "https://www.wikidata.org/wiki/Q695265" },
    ],
  );
  assert.deepEqual(entryAttribution({ word: "sale" }).source, "Wikizionario");
});
