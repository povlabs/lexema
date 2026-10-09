// The punctuation that only separates usage labels goes with them (#712).
// it.wiktionary prints each label template as `(''label'')` (Template:Term,
// read 2026-10-09), so in `{{Term|matematica|it}}, {{Term|aritmetica|it}}
// [[numero]]…` the comma is no part of the definition. `renderInline` drops
// it, and rule `rendered-label-punctuation/v1` brings rows a seed wrote
// before to the same text. `travet` is a verbatim revision of
// itwiktionary-20260701 (fixtures/label-punctuation/); `cinquantadue` and its
// archive line are #706's (fixtures/unlisted-definitions/).

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { dropStoredLabelPunctuation, LABEL_PUNCTUATION_RULE } from "../src/import/labelPunctuationUpdate.js";
import { planSourceText, SOURCE_TEXT_UPDATE_RULES } from "../src/import/normalizeSourceText.js";
import { seedSql } from "../src/import/seedSql.js";
import type { DictionarySql } from "../src/import/sourceTextUpdate.js";
import { recoverPageEntry } from "../src/italian/pageEntry.js";
import { labelPunctuation, readItalianSections, renderInline } from "../src/italian/wikitext.js";
import { RAW_PAGE_WIKI, rawPageSource, readSavedPage, type RawPage } from "../src/source/rawPage.js";

const saved = async (path: string, name: string): Promise<RawPage> => readSavedPage(await readFile(resolve(path, name), "utf8"), name);
const travet = await saved("fixtures/label-punctuation", "travet.wikitext");
const cinquantadue = await saved("fixtures/unlisted-definitions", "cinquantadue.wikitext");

/** A page of `title` whose wikitext is `lines`. */
const pageOf = (title: string, lines: readonly string[]): RawPage => ({
  wiki: RAW_PAGE_WIKI, title, revisionId: 1, timestamp: "2026-07-01T00:00:00Z", wikitext: lines.join("\n"),
});

/** The text and labels `renderInline` gives `body`. */
function rendered(body: string): [string, string[]] {
  const line = renderInline(body, "prova");
  assert.ok(line.rendered, body);
  return [line.text, line.labels];
}

test("a comma, semicolon or colon between labels, or between the opening labels and the first word, goes with the labels", () => {
  assert.deepEqual(
    rendered("{{Term|matematica|it}}, {{Term|aritmetica|it}} [[numero]] che viene dopo il [[cinquantuno]] e prima del [[cinquantatré]]; è [[tredici]] [[volte]] il [[quadrato]] di [[due]]"),
    ["numero che viene dopo il cinquantuno e prima del cinquantatré; è tredici volte il quadrato di due", ["matematica", "aritmetica"]],
  );
  assert.deepEqual(rendered("{{Term|zoologia|it}}; {{Fig}}: [[felino]]"), ["felino", ["zoologia", "figurato"]]);
  assert.deepEqual(rendered("{{Term|a|it}}, , {{Term|b|it}}, [[parola]]"), ["parola", ["a", "b"]]);
  // Emphasis around the labels still toggles, and the words keep theirs.
  const italic = renderInline("''{{Term|a|it}}'', ''{{Term|b|it}}'' ''[[parola]]'' scritta", "prova");
  assert.ok(italic.rendered);
  assert.equal(italic.text, "parola scritta");
  assert.deepEqual(italic.runs.filter((run) => run.text.trim() !== "").map((run) => [run.text.trim(), run.italic]), [["parola", true], ["scritta", false]]);
  // Labels the line writes after its first words are separated the same way.
  assert.deepEqual(rendered("[[numero]] {{Term|a|it}}, {{Term|b|it}} intero"), ["numero intero", ["a", "b"]]);
});

test("punctuation between words of visible text stays, and so does a line that is labels alone", () => {
  assert.deepEqual(rendered("[[uno]], [[due]]; tre: quattro"), ["uno, due; tre: quattro", []]);
  // A label between two words: the comma after it stands between words.
  assert.deepEqual(rendered("[[numero]] {{Term|a|it}}, intero"), ["numero , intero", ["a"]]);
  // No visible word follows, so the colon still opens the list below it.
  assert.deepEqual(rendered("{{Term|botanica|it}}:"), [":", ["botanica"]]);
  assert.deepEqual(rendered("{{Term|a|it}}, {{Term|b|it}}:"), [":", ["a", "b"]]);
});

test("`labelPunctuation` gives the text beside what the renderer gave before #712, and nothing for a line it cannot render", () => {
  assert.deepEqual(labelPunctuation("{{Term|zoologia|it}}, {{Term|mammalogia|it}} [[gattopardo]] [[americano]] ", "ozelot"), {
    text: "gattopardo americano",
    kept: ", gattopardo americano",
  });
  assert.deepEqual(labelPunctuation("[[uno]], [[due]]", "prova"), { text: "uno, due", kept: "uno, due" });
  // `{{Coppia aspettuale}}` prints its arguments, so it stays unknown (#711).
  assert.equal(labelPunctuation("{{Coppia aspettuale|uno|due}} [[uno]]", "prova"), undefined);
  // A fixed-label template (#711) is a label like `{{Term}}`: its comma goes with it.
  assert.deepEqual(labelPunctuation("{{Intransitivo|it}}, {{Spreg}} [[uno]]", "prova"), { text: "uno", kept: ", uno" });
});

test("a `#` line opening with two labels and a comma: travet's page-only sense", () => {
  const result = recoverPageEntry(travet, new Set());
  assert.ok(result.outcome === "recovered");
  assert.deepEqual(
    result.entries.flatMap((entry) => entry.definitions.map((definition) => [definition.route, definition.ref.line, definition.text, definition.labels])),
    [["sense-line", 4, "impiegato diligente e puntuale, specialmente con valore ironico o dispregiativo", ["dialettale", "regionale"]]],
  );
  // A `#:` definition below a page control reads the same way.
  const [noun] = readItalianSections(pageOf("prova", ["== {{-it-}} ==", "{{-sost-|it}}", "# {{Pn}} ''f''", "#: {{Term|zoologia|it}}, {{Term|entomologia|it}} [[insetto]] tropicale"]));
  assert.deepEqual(
    noun.senseLines.flatMap((line) => line.below.map((definition) => [definition.route, definition.text, definition.labels])),
    [["below-page-control", "insetto tropicale", ["zoologia", "entomologia"]]],
  );
});

test("a page-fact line: an expression's meaning and an etymology that open with labels and a comma", () => {
  // Laid out like travet's page: a bare `{{-it-}}`, which the extraction cannot read.
  const page = pageOf("prova", [
    "{{-it-}}",
    "{{-sost-|it}}",
    "{{Pn}} ''f sing''",
    "# [[cosa]] da provare",
    "",
    "{{-etim-}}",
    "{{Term|raro|it}}; {{Term|antico|it}}: dal [[latino]] ''probare''",
    "",
    "{{-prov-}}",
    "* ''mettere alla {{Pn}}'': {{Term|figurato|it}}, {{Term|familiare|it}} [[verificare]] qualcosa",
  ]);
  const result = recoverPageEntry(page, new Set());
  assert.ok(result.outcome === "recovered");
  const facts = result.entries.flatMap((entry) => entry.facts);
  assert.deepEqual(
    facts.flatMap((fact) => (fact.kind === "etymology" ? [fact.text] : fact.kind === "expression" ? [fact.phrase, fact.meaning] : [])),
    ["dal latino probare", "mettere alla prova", "verificare qualcosa"],
  );
});

/** A dictionary seeded from cinquantadue's archive line, with its page and travet's, which no record spells. */
async function seeded(run: (db: DatabaseSync, sql: DictionarySql) => void): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-label-punctuation-"));
  const db = new DatabaseSync(":memory:");
  try {
    const line = (await readFile("fixtures/unlisted-definitions/archive-lines.jsonl", "utf8"))
      .trimEnd().split("\n").find((archived) => (JSON.parse(archived) as { word: string }).word === "cinquantadue");
    assert.ok(line);
    const input = join(dir, "fixture.jsonl");
    await writeFile(input, `${line}\n`);
    const report = await seedSql({
      input, outputDir: join(dir, "sql"), schema: resolve("src/db/schema.sql"), releaseId: "it-test",
      requiredWords: [], validateFixtureClosure: false, rawPages: rawPageSource([cinquantadue, travet]),
    });
    for (const part of report.parts) db.exec(await readFile(part, "utf8"));
    run(db, { query: <Row>(text: string) => db.prepare(text).all() as Row[], run: (text: string) => db.exec(text) });
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
}

const CINQUANTADUE = "numero che viene dopo il cinquantuno e prima del cinquantatré; è tredici volte il quadrato di due";
const TRAVET = "impiegato diligente e puntuale, specialmente con valore ironico o dispregiativo";
const texts = (db: DatabaseSync) => ({
  recovered: db.prepare("SELECT text FROM recovered_definition ORDER BY recovered_id").all().map((row) => row.text),
  entry: db.prepare("SELECT text FROM entry_definition ORDER BY entry_id, definition_index").all().map((row) => row.text),
  labels: db.prepare("SELECT label FROM recovered_label ORDER BY recovered_id, label_index").all().map((row) => row.label),
});

test("the seed writes the text without the labels' punctuation, and the update brings a dictionary seeded before #712 to it, once", async () => {
  await seeded((db, sql) => {
    const fresh = texts(db);
    assert.deepEqual(fresh, { recovered: [CINQUANTADUE], entry: [TRAVET], labels: ["matematica", "aritmetica"] });

    // As a seed before #712 wrote them.
    db.exec(`UPDATE recovered_definition SET text = ', ${CINQUANTADUE}'; UPDATE entry_definition SET text = ', ${TRAVET}';`);
    assert.deepEqual(planSourceText(sql).counts.toJSON().written, { recovered_definition: 1, entry_definition: 1 });
    assert.equal(planSourceText(sql).counts.records.changed, 1);
    assert.ok(SOURCE_TEXT_UPDATE_RULES.includes(LABEL_PUNCTUATION_RULE));

    const changed = { recovered_definition: 1, recovered_example: 0, entry_definition: 1, entry_example: 0 };
    assert.deepEqual(dropStoredLabelPunctuation(sql), { rule: LABEL_PUNCTUATION_RULE, candidates: 2, changed });
    assert.deepEqual(texts(db), fresh);
    assert.deepEqual(dropStoredLabelPunctuation(sql), { rule: LABEL_PUNCTUATION_RULE, candidates: 0, changed: { ...changed, recovered_definition: 0, entry_definition: 0 } });
  });
});

test("the update leaves a row alone whose text is not what the renderer gave before #712", async () => {
  await seeded((db, sql) => {
    // A text someone set another way, with the same leading comma: not the old rendering, so not the rule's.
    db.exec("UPDATE recovered_definition SET text = ', numero cinquantadue'");
    assert.deepEqual(dropStoredLabelPunctuation(sql).changed.recovered_definition, 0);
    assert.deepEqual(texts(db).recovered, [", numero cinquantadue"]);
  });
});
