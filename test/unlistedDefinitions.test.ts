// The two layouts the recovered layer reads outside a section's `#` list
// (#706, ADR 0029): a `*` bullet line and a plain prose line under the
// part-of-speech heading. The pages are verbatim revisions of
// itwiktionary-20260701 and the records verbatim archive lines of it-0c432803
// (fixtures/unlisted-definitions/), as reports/2026-10-06-empty-word-pages.json
// names them.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import { recordText, recoverDefinitions, type RecordRecovery } from "../src/italian/recovery.js";
import { readItalianSections } from "../src/italian/wikitext.js";
import { RAW_PAGE_WIKI, readSavedPage, type RawPage } from "../src/source/rawPage.js";

const DIR = resolve("fixtures/unlisted-definitions");
const pages = new Map(
  readdirSync(DIR)
    .filter((name) => name.endsWith(".wikitext"))
    .map((name) => readSavedPage(readFileSync(join(DIR, name), "utf8"), name))
    .map((page) => [page.title, page]),
);
const records = readFileSync(join(DIR, "archive-lines.jsonl"), "utf8")
  .trimEnd()
  .split("\n")
  .map((line) => JSON.parse(line) as Parameters<typeof recordText>[0]);

function page(title: string): RawPage {
  const found = pages.get(title);
  assert.ok(found, `fixtures/unlisted-definitions has no page for ${title}`);
  return found;
}

/** The recovery of `word`'s record of `posTitle`, read off its page. */
function recovery(word: string, posTitle: string): RecordRecovery {
  const record = records.find((line) => line.word === word && line.pos_title === posTitle);
  assert.ok(record, `no archive line for ${word} (${posTitle})`);
  return recoverDefinitions(recordText(record), page(word));
}

/** Each recovered definition as [route, line, text]. */
function recovered(word: string, posTitle: string): [string, number, string][] {
  const result = recovery(word, posTitle);
  assert.equal(result.outcome, "matched", `${word} (${posTitle})`);
  assert.ok(result.outcome === "matched");
  return result.recovered.map((definition) => [definition.route, definition.ref.line, definition.text]);
}

test("a `*` bullet line under the part-of-speech heading is a definition of that section's record", () => {
  assert.deepEqual(recovered("centouno", "Aggettivo numerale"), [
    ["bullet-line", 4, "numero che viene dopo il cento e prima del centodue"],
  ]);
  assert.deepEqual(recovered("decrepito", "Aggettivo"), [
    ["bullet-line", 6, "persona molto vecchia e quindi privo completamente di forze"],
    ["bullet-line", 7, "cosa assolutamente inefficiente e inadeguata; in particolare, privo di validità e di efficacia, perché antiquata e inattuale"],
  ]);
  // The `*` lines under `{{-sin-}}` and `{{-der-}}` are those sections' own, and stay theirs.
  const result = recovery("centouno", "Aggettivo numerale");
  assert.ok(result.outcome === "matched");
  assert.deepEqual(result.recovered[0].labels, ["matematica"]);
  assert.equal(result.loss, "full");
});

test("a plain line with no list mark under the part-of-speech heading is a definition, the headword line is not", () => {
  assert.deepEqual(recovered("bavaglio", "Sostantivo"), [
    ["prose-line", 4, "Fazzoletto o cencio che si lega attorno alla bocca di una persona per impedirle di parlare o gridare."],
  ]);
  // `museruola` writes its headword line above the heading; the line under it is the definition.
  assert.deepEqual(recovered("museruola", "Sostantivo"), [
    ["prose-line", 5, "Arnese a forma di gabbia che si applica al muso di alcuni animali per impedire loro di mordere o di mangiare."],
  ]);
  // Bold initials in plain words are not a bold headword.
  assert.deepEqual(recovered("Consap", "Acronimo / Abbreviazione"), [["prose-line", 4, "CONcessionaria Servizi Assicurativi Pubblici"]]);
});

test("each record reads the lines of its own section: `furbo` and `esterofilo` give their adjective and their noun apart", () => {
  // `furbo` numbers its lines `1.` to `7.` across two sections; the numbers stay as the page writes them.
  // `{{Spreg}}` is a template the renderer does not know, so its lines are reported, never printed wrong.
  assert.deepEqual(recovered("furbo", "Aggettivo"), [
    ["prose-line", 5, "1. che usa la sua intelligenza"],
    ["prose-line", 8, "2. chi considera, spesso meditando in proposito, quando e come qualcosa debba essere detto e/o fatto"],
  ]);
  assert.deepEqual(recovered("furbo", "Sostantivo"), [["prose-line", 17, "5. chi è molto astuto (spesso con una sfumatura di malizia)"]]);
  const adjective = recovery("furbo", "Aggettivo");
  assert.ok(adjective.outcome === "matched");
  assert.deepEqual(adjective.unrendered.map((line) => [line.ref.line, line.template]), [[10, "spreg"], [12, "spreg"]]);
  assert.deepEqual(adjective.recovered[1].labels, ["per estensione"]);

  assert.deepEqual(recovered("esterofilo", "Aggettivo"), [["bullet-line", 6, "amante dell'estero"]]);
  assert.deepEqual(recovered("esterofilo", "Sostantivo"), [
    ["bullet-line", 15, "colui che tende ad avere sudditanza, a prescindere dall'argomento e dalla sua reale conoscenza, nei confronti di usanze, culture e strutture sociali provenienti dall'estero."],
  ]);
});

test("every recovered line keeps its wikitext byte for byte, with the page revision and its 1-based line", () => {
  for (const [word, posTitle] of [["centouno", "Aggettivo numerale"], ["decrepito", "Aggettivo"], ["bavaglio", "Sostantivo"], ["museruola", "Sostantivo"], ["furbo", "Aggettivo"], ["furbo", "Sostantivo"]] as const) {
    const result = recovery(word, posTitle);
    assert.ok(result.outcome === "matched");
    const raw = page(word);
    const lines = raw.wikitext.split("\n");
    assert.ok(result.recovered.length > 0, word);
    for (const definition of result.recovered) {
      assert.deepEqual(definition.ref, { wiki: RAW_PAGE_WIKI, title: word, revisionId: raw.revisionId, line: definition.ref.line });
      assert.equal(definition.wikitext, lines[definition.ref.line - 1], `${word} line ${definition.ref.line}`);
      assert.equal(definition.listedUnder, null);
      assert.deepEqual(definition.examples, []);
    }
  }
});

test("a part-of-speech heading stacked directly on another titles one section: `cinquantadue`", () => {
  const sections = readItalianSections(page("cinquantadue"));
  assert.deepEqual(sections.map((section) => [section.posTemplate, section.posTitle]), [["card", "Aggettivo numerale"]]);
  assert.deepEqual(recovered("cinquantadue", "Aggettivo numerale"), [
    // The comma between its two labels stays, as on a `#` line the renderer prints.
    ["bullet-line", 7, ", numero che viene dopo il cinquantuno e prima del cinquantatré; è tredici volte il quadrato di due"],
  ]);
});

test("the rules read no other layout: a `:` line, `#*` alone, the grammar stamp, a `;` line, the headword line and an empty page give nothing", () => {
  for (const [word, posTitle] of [
    ["coi", "Preposizione"],
    ["harmonium", "Sostantivo"],
    ["ottemperanza", "Sostantivo"],
    ["scafandro", "Sostantivo"],
    ["clavicembalista", "Sostantivo"],
    ["sbucciapatate", "Sostantivo"],
  ] as const) {
    assert.deepEqual(recovered(word, posTitle), [], word);
    assert.ok(readItalianSections(page(word)).every((section) => section.unlisted.length === 0), word);
  }
});

/** A page of one revision holding `lines` under `== {{-it-}} ==`. */
const synthetic = (title: string, ...lines: string[]): RawPage => ({
  wiki: RAW_PAGE_WIKI,
  title,
  revisionId: 1,
  timestamp: "2026-07-01T00:00:00Z",
  wikitext: ["== {{-it-}} ==", ...lines].join("\n"),
});

test("a section that states a meaning on a `#` line keeps its definitions there, and reads no line beside them", () => {
  const sections = readItalianSections(synthetic("prova", "{{-sost-|it}}", "{{Pn}} ''f sing''", "# [[prova]] di un fatto", "* una nota a margine", "Una riga di commento."));
  assert.deepEqual(sections.map((section) => section.unlisted), [[]]);
});

test("a line is not read when it shows only bold and italics, sits inside markup that spans lines, or follows a written heading", () => {
  const sections = readItalianSections(
    synthetic(
      "Valter",
      "{{-nome-|it}}",
      // A bold headword with its spelling variants and its grammar (`Valter`, `Walter`).
      "'''Valter, [[Walter]], [[Gualtiero]]'''  ''m''",
      // The tail of a template opened on the line above (`lindezza`).
      "{{Linkp|",
      "lindezze}}",
      // A picture whose caption runs past the line (`Sparidi`).
      "[[File:Sparus aurata.Dourada.jpg|thumb|alcune orate ([[w:Sparus aurata|Sparus aurata]])",
      "<!-- un commento",
      "su due righe -->",
      "=== Etimologia ===",
      "dal latino",
    ),
  );
  assert.deepEqual(sections.map((section) => section.unlisted), [[]]);
});
