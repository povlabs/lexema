// Wikidata words on the word page, the Licence page and in the API (ADR 0033,
// #812): a word Wiktionary lacks reads as an ordinary entry, its Italian
// glosses its definitions, and one with no Italian gloss is not loaded at all;
// the page's one *Fonte* opens its lexeme; a word
// Wiktionary has keeps its page; the Licence page has one Wikidata credit; and
// the API names and credits a Wikidata word by its lexeme.
// Seeded from the development fixture, then `load:wikidata-words` over the
// lexemes of fixtures/wikidata-words/lexemes.jsonl and three lexemes of the
// committed snapshot, `trucco`, `targhetta` and `professore` (#833).

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
import { parseSnapshot, readWordSnapshot } from "../../src/wikidataWords/wordSnapshot.js";
import { searchAttempt } from "@/lib/dictionary/searchAttempt.ts";
import { Outcome, SearchPage } from "@/components/dictionary/SearchPage";
import { Licence } from "@/components/dictionary/Licence";
import { SOURCE_LINE } from "@/components/shared/styles.ts";
import { candidatesOf, entryAttribution, resultJson, type LemmaReader } from "@/worker/api/lookupAnswer.ts";
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
  const served = (await readWordSnapshot(REPO)).filter((word) => ["trucco", "targhetta", "professore"].includes(word.lemma));
  const words = [...parseSnapshot(await readFile(join(REPO, "fixtures/wikidata-words/lexemes.jsonl"), "utf8")), ...served];
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
  // papà states maschile for the whole lexeme, so its heading names it, as a record's does (#849).
  assert.deepEqual(headingsOf(html), ["1·Sostantivo·maschile"]);
  assert.match(textOf(html), /Definizioni1\.termine affettuoso per riferirsi al genitore di sesso maschile/);
  assert.equal(textOf(footerOf(html)), "Fonte·Segnala un errore");
  assert.deepEqual(sourceLinks(html), ["https://www.wikidata.org/wiki/Lexeme:L1144362"]);
  assert.match(footerOf(html), /aria-label="Voce di Wikidata per papà, la fonte di questa voce \(si apre in una nuova scheda\)"/);
  assert.doesNotMatch(html, /wiktionary/);
  // No mark of where it came from (ADR 0016).
  assert.doesNotMatch(textOf(html), /Wikidata|lessema/i);
});

test("a Wikidata word with no Italian gloss is not loaded, so its spellings get no Wikidata entry", async () => {
  // paralimpico (L1247138) has no Italian gloss (ADR 0033's 2026-10-12
  // amendment). Its page, and paralimpiche's as its plural, show only its
  // hand-kept adjective (#915), credited to en.wiktionary.
  for (const [query, heading] of [["paralimpico", "1·Aggettivo"], ["paralimpiche", "1·Aggettivo·paralimpico"]]) {
    const html = await render(query);
    assert.deepEqual(headingsOf(html), [heading]);
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
  // Huey's approved wording names no link per name or word: since #827 a name on a mixed page links none (2026-10-12, #802).
  assert.doesNotMatch(credits[0], /Ogni nome tratto da Wikidata/);
  assert.match(credits[0], /Quando una pagina mostra solo dati di Wikidata, il suo link Fonte rimanda all’elemento o al lessema da cui provengono\./);
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

/** The text of the page's first gender and number grid, or none. */
const gridOf = (html: string): string | undefined => {
  const start = html.indexOf('data-grid=""');
  if (start < 0) return undefined;
  return textOf(html.slice(html.indexOf(">", start) + 1, html.indexOf("</section>", start)));
};

test("a Wikidata word's Forme grid holds the forms its features place, and none with a feature the table does not map (#833)", async () => {
  const professore = await render("professore");
  // prof., prof, prof.ssa, prof.i, prof.sse (abbreviazione) and professor (apocope) are not drawn.
  assert.equal(
    gridOf(professore),
    "singolarepluralemaschileprofessoreil professore·un professoreprofessorii professori·dei professorifemminileprofessoressala professoressa·una professoressaprofessoressele professoresse·delle professoresse",
  );
  assert.doesNotMatch(professore, />(prof|prof\.|prof\.ssa|prof\.i|prof\.sse|professor)</);
  // trucchetto and trucchettino are diminutives.
  assert.doesNotMatch(await render("trucco"), /trucchett/);
  // No mark of where the forms came from (ADR 0016).
  assert.doesNotMatch(textOf(professore), /Wikidata|lessema/i);
  assert.equal(textOf(footerOf(professore)), "Fonte·Segnala un errore");
});

test("a Wikidata noun whose forms state only their number draws its Forme grid under the gender its lexeme states (#849)", async () => {
  // targhetta (L709002) states femminile once, for the whole lexeme; its forms state singolare and plurale.
  assert.equal(gridOf(await render("targhetta")), "singolarepluralefemminiletarghettala targhetta·una targhettatarghettele targhette·delle targhette");
  // trucco (L580449) states maschile; trucchetto and trucchettino, diminutives, stay off.
  assert.equal(gridOf(await render("trucco")), "singolarepluralemaschiletruccoil trucco·un truccotrucchii trucchi·dei trucchi");
});

test("a Wikidata verb's Forme is its conjugation, each form where its features place it (#833)", async () => {
  const text = textOf(await render("pentimmo"));
  // pentimmo is one of its forms, so the conjugation is drawn as a lemma's, under its name (#851).
  assert.match(text, /Forme dipentirsiinfinitopentire·gerundiopentendo·participio presentepenitente·participiopentito/);
  assert.match(text, /passato remotofuturo sempliceiopentiipentirò/);
  // Congiuntivo and condizionale rows, placed as a record's are, by their pronouns.
  assert.match(text, /presenteimperfettoche iopentapentissi/);
  assert.match(text, /presenteiopentireitupentiresti/);
  assert.doesNotMatch(text, /Wikidata|lessema/i);
});

test("a Wiktionary word's Forme grid is unchanged beside the Wikidata words", async () => {
  assert.equal(gridOf(await render("casa")), "singolarepluralefemminilecasala casa·una casacasele case·delle case");
});

/** The spellings a conjugation marks as searched. */
const searchedOf = (html: string): string[] => [...html.matchAll(/data-searched="">([^<]+)</g)].map((match) => match[1]);

/** How the API says the query reached each candidate, `/v1/lookup`'s `match`, lemmas read as the endpoint reads them. */
async function matchesOf(query: string): Promise<unknown[]> {
  const result = await lookup({ db: fromNodeSqlite(db), releaseId: RELEASE, query });
  assert.ok(result.outcome === "found", query);
  const readLemma: LemmaReader = async (target) => {
    const lemma = await lookup({ db: fromNodeSqlite(db), releaseId: RELEASE, query: target.word });
    return lemma.outcome === "found" ? lemma.readings.find((reading) => reading.recordId === target.recordId) : undefined;
  };
  return (await candidatesOf(result, readLemma)).map((candidate) => resultJson(candidate, UNFILTERED).match);
}

test("a form only a Wikidata word answers is marked in its Forme, under the line a record's form gets (#851)", async () => {
  // No line of it-0c432803 spells pentimmo, as a headword or in a table, so in the release too only lexeme L1422655 answers it.
  const html = await render("pentimmo");
  assert.deepEqual(headingsOf(html), ["1·Voce verbale·pentirsi"]);
  // Its lines, then the lexeme's glosses as its Definizioni, then its table, as a record's form block reads (rule 1).
  assert.match(textOf(html), /Voce verbale·pentirsiprima persona plurale del passato remoto indicativo di pentirsiDefinizioni1\.provare romorso per un'azione sbagliata commessaForme dipentirsi/);
  assert.deepEqual(searchedOf(html), ["pentimmo"]);
  assert.match(textOf(html), /passato remotofuturo sempliceiopentiipentiròtupentistipentirailui, leipentìpentirànoipentimmo/);
  assert.doesNotMatch(textOf(html), /Wikidata|lessema/i);
});

test("a Wikidata noun's form reads as a record's: its gender and number in the heading, its line, the lemma's Definizioni and Forme (#851)", async () => {
  // No record of this fixture spells professoresse, so lexeme L1180137 answers it here. In
  // it-0c432803 the record `professoresse` does, and Wiktionary wins there; no served Wikidata
  // noun has a gendered form the release lacks, so the grid is read off this one.
  const html = await render("professoresse");
  assert.deepEqual(headingsOf(html), ["1·Sostantivo, forma flessa·femminile, plurale"]);
  assert.match(textOf(html), /femminile, pluralefemminile plurale di professoreDefinizioni1\.persona che insegna in una scuola o in una università/);
  assert.match(textOf(html), /Forme diprofessoresingolareplurale/);
  assert.doesNotMatch(textOf(html), /Wikidata|lessema/i);
});

test("/v1/lookup names a Wikidata word's searched form as it names a record's (#851)", async () => {
  assert.deepEqual(await matchesOf("pentimmo"), [{ surface: "pentimmo", via: "form", grammar: [{ mood: "indicativo", tense: "passato remoto", person: "noi" }] }]);
  assert.deepEqual(await matchesOf("professoresse"), [{ surface: "professoresse", via: "form", grammar: [{ gender: "femminile", number: "plurale" }] }]);
  // Its lemma is its headword, which a record's table also lists: the cell it sits in.
  assert.deepEqual(await matchesOf("professore"), [{ surface: "professore", via: "headword", grammar: [{ gender: "maschile", number: "singolare" }] }]);
  // A form no cell holds (paparino, a diminutive) is found through the lexeme's forms, and placed nowhere.
  assert.deepEqual(await matchesOf("paparino"), [{ surface: "paparino", via: "form", grammar: [] }]);
});

test("a Wiktionary form's searched cell is the one it was before the Wikidata key (#851)", async () => {
  // As main at 8f82db0 renders and answers costruttrici: costruttore's table, and costruttrice's for the form-of records.
  const html = await render("costruttrici");
  assert.deepEqual(headingsOf(html), ["1·Aggettivo·Sostantivo·femminile, singolare"]);
  const plural = { surface: "costruttrici", via: "form", grammar: [{ gender: "femminile", number: "plurale" }] };
  const formOf = { surface: "costruttrici", via: "form_of", grammar: [{ gender: "femminile", number: "singolare" }] };
  assert.deepEqual(await matchesOf("costruttrici"), [plural, plural, formOf, formOf, plural, plural]);
  // A Wiktionary verb form still marks its own cells, the two main at 8f82db0 marks.
  assert.deepEqual(searchedOf(await render("andassi")), ["andassi", "andassi"]);
});
