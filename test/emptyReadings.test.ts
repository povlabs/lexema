// Readings whose own source section defines nothing (#803, ADR 0031's
// amendment of 2026-10-18). A: `in ritardo`'s two readings, `scorso`'s
// adjective, `quindici`'s noun and `Giulia` show hand-kept definitions as
// their records' own. C: rule `it-empty-reading-variant/v1` leads `uno`'s
// article to `un`, the variant its page's `{{-var-}}` names. Inputs are
// verbatim (fixtures/empty-readings/PROVENANCE.md): their archive lines of
// it-0c432803, and the dump revisions of their it.wiktionary pages.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { linkedWords, sensesDefineNothing, variantLines, variantsOf, type VariantRecord } from "../src/italian/emptyReadingVariant.js";
import { EMPTY_READING_VARIANT_EVIDENCE } from "../src/italian/emptyReadingVariantEvidence.js";
import { HAND_KEPT_READINGS, handKeptReading, InvalidHandKeptReading, type HandKeptReading } from "../src/italian/handKeptReadings.js";
import { seedSql } from "../src/import/seedSql.js";
import { lookupBatch } from "../src/lookup/batch.js";
import { fromNodeSqlite, type LookupDatabase } from "../src/lookup/database.js";
import { lookup } from "../src/lookup/lookup.js";
import { definesNothing, isFormOfReading, type Reading } from "../src/lookup/types.js";

const RELEASE = "it-empty-readings";
const FIXTURES = resolve("fixtures/empty-readings");
const LINES = (await readFile(join(FIXTURES, "archive-lines.jsonl"), "utf8")).trimEnd().split("\n");
const pageOf = async (title: string): Promise<string> => readFile(join(FIXTURES, `${title}.wikitext`), "utf8");
const sha256 = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");

interface Line {
  word: string;
  pos: string;
  pos_title: string;
  senses: { glosses?: unknown; form_of?: unknown; examples?: unknown }[];
}
const RECORDS = LINES.map((line) => JSON.parse(line) as Line);

/** The readings #803 fills (A): every hand-kept reading that names an empty section. */
const FILLED = HAND_KEPT_READINGS.filter((reading): reading is HandKeptReading & { source: { kind: "empty" } } => reading.source.kind === "empty");

async function seeded(readings: readonly HandKeptReading[] | undefined): Promise<DatabaseSync> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-empty-readings-"));
  try {
    const archive = join(dir, "archive.jsonl.gz");
    await writeFile(archive, gzipSync(`${LINES.join("\n")}\n`));
    const { parts } = await seedSql({
      input: archive,
      outputDir: join(dir, "sql"),
      schema: "src/db/schema.sql",
      releaseId: RELEASE,
      license: "CC-BY-SA-4.0",
      handKeptReadings: readings,
      onRejection: (rejection) => {
        throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
      },
    });
    const sqlite = new DatabaseSync(":memory:");
    for (const part of parts) sqlite.exec(await readFile(part, "utf8"));
    return sqlite;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

let kept: DatabaseSync;
let plain: DatabaseSync;
before(async () => {
  [kept, plain] = await Promise.all([seeded(undefined), seeded([])]);
});
after(() => {
  kept.close();
  plain.close();
});

async function readingsOf(sqlite: DatabaseSync, query: string): Promise<Reading[]> {
  const result = await lookup({ db: fromNodeSqlite(sqlite), releaseId: RELEASE, query });
  assert.ok(result.outcome === "found", query);
  return result.readings;
}

/** A reading as a page tells it apart: its part of speech, its section title and its definitions' text. */
const shown = (reading: Reading) => [
  reading.pos,
  reading.posTitle,
  [...reading.senses.flatMap((sense) => sense.glosses.map((gloss) => gloss.text)), ...reading.recovered.map((definition) => definition.text)],
];

test("each reading #803 fills names its empty section on the page its record was read from", async () => {
  assert.ok(FILLED.length > 0);
  for (const reading of FILLED) {
    const { heading } = reading.source;
    const lines = (await pageOf(reading.source.title)).split("\n");
    assert.equal(lines[heading.line - 1], heading.wikitext, reading.word);
    // Below the heading, up to the next one: the headword line, `{{Nodef}}`, an example, or nothing. No line defines.
    const end = lines.findIndex((line, i) => i >= heading.line && /^(?:\{\{-|=)/.test(line));
    const section = lines.slice(heading.line, end === -1 ? undefined : end).filter((line) => line.trim() !== "" && !line.startsWith("[[File:"));
    for (const line of section) assert.match(line, /^(?:\{\{Pn\b|#\s*\{\{Nodef\|it\}\}$|#\*)/, `${reading.word}: ${line}`);
    // Its one archive record of that part of speech defines nothing.
    const records = RECORDS.filter((record) => record.word === reading.word && record.pos === reading.partOfSpeech.pos);
    assert.equal(records.length, 1, reading.word);
    assert.equal(records[0].pos_title, reading.partOfSpeech.posTitle);
    assert.ok(sensesDefineNothing(reading.word, records[0].senses), `${reading.word} defines nothing`);
  }
  // A reading that fills a section names one on its own word's page.
  const [inRitardo] = FILLED;
  assert.throws(() => handKeptReading({ ...inRitardo, source: { ...inRitardo.source, title: "ritardo" } }), InvalidHandKeptReading);
  assert.throws(() => handKeptReading({ ...inRitardo, source: { ...inRitardo.source, revisionId: 0 } }), InvalidHandKeptReading);
});

test("a lookup shows each filled reading's hand-kept definitions as its record's own, and no reading beside it (A)", async () => {
  const definitions = (word: string, posTitle: string) => FILLED.filter((reading) => reading.word === word && reading.partOfSpeech.posTitle === posTitle).flatMap((reading) => reading.definitions.map((definition) => definition.text));
  const expected = {
    "in ritardo": [
      ["phrase", "Locuzione aggettivale", definitions("in ritardo", "Locuzione aggettivale")],
      ["adv_phrase", "Locuzione avverbiale", definitions("in ritardo", "Locuzione avverbiale")],
    ],
    scorso: [
      ["adj", "Aggettivo", definitions("scorso", "Aggettivo")],
      ["verb", "Voce verbale", ["participio passato di scorrere"]],
    ],
    quindici: [
      ["adj", "Aggettivo numerale", ["numero naturale che segue il quattordici e precede il sedici; tre volte cinque"]],
      ["noun", "Sostantivo", definitions("quindici", "Sostantivo")],
    ],
    Giulia: [["name", "Nome proprio", definitions("Giulia", "Nome proprio")]],
  };
  for (const [word, readings] of Object.entries(expected)) {
    const filled = await readingsOf(kept, word);
    assert.deepEqual(filled.map(shown), readings, word);
    // Every reading is a record's: the hand-kept reading shows as none of its own.
    assert.ok(filled.every((reading) => reading.recordId !== undefined && reading.handKeptId === undefined), word);
    // Without the list, the same records define nothing where #803 fills them.
    const before = await readingsOf(plain, word);
    assert.deepEqual(before.map((reading) => reading.recordId), filled.map((reading) => reading.recordId));
    assert.deepEqual(
      before.map((reading) => definesNothing(reading)),
      filled.map((reading) => FILLED.some((one) => one.word === word && one.partOfSpeech.pos === reading.pos)),
    );
  }
  // A filled definition points at the en.wiktionary sense line it paraphrases, and carries nothing that marks it (ADR 0016).
  const [adjective] = await readingsOf(kept, "scorso");
  assert.deepEqual(adjective.recovered, [
    { route: "hand-kept", text: "appena passato, immediatamente precedente", correction: null, labels: [], ref: { wiki: "en.wiktionary.org", title: "scorso", revisionId: 90562962, line: 13 }, examples: [], heldAsExample: null, items: [] },
  ]);
  // The record keeps its own example and forms.
  assert.deepEqual(adjective.senses.flatMap((sense) => sense.examples.map((example) => example.text)), ["il primo giubileo del secolo scorso fu indetto nel 1900 da Leone XIII"]);
  assert.deepEqual(adjective.forms.map((form) => form.surface), ["scorsi", "scorsa", "scorse"]);
  // The source's lines stay byte for byte.
  assert.deepEqual(
    kept.prepare("SELECT raw_json FROM source_record_json ORDER BY record_id").all().map((row) => (row as { raw_json: string }).raw_json),
    LINES,
  );
  // A batch lookup answers each with its records alone, as the lookup does.
  const { answers } = await lookupBatch({ db: fromNodeSqlite(kept), releaseId: RELEASE, queries: Object.keys(expected) });
  assert.deepEqual(
    answers.map((answer) => (answer.outcome === "found" ? answer.candidates.map((candidate) => [candidate.word, candidate.pos, candidate.handKeptId ?? candidate.lineNo]) : [])),
    [
      [["in ritardo", "phrase", 10], ["in ritardo", "adv_phrase", 11]],
      [["scorso", "adj", 12], ["scorso", "verb", 13]],
      [["quindici", "adj", 1], ["quindici", "noun", 2]],
      [["Giulia", "name", 9]],
    ],
  );
});

test("rule it-empty-reading-variant/v1 reads uno's {{-var-}} line, and links its empty article to un (C)", async () => {
  const uno = await pageOf("uno");
  assert.deepEqual(variantLines({ wikitext: uno }), [{ line: 64, wikitext: "* {{Glossa|aggettivo numerale}} {{Glossa|articolo}} [[un]]" }]);
  // A label template links nothing; a link into another namespace names no word; each word once.
  assert.deepEqual(linkedWords("* {{Term|antico|it}}, {{Term|popolare|it}} [[sciaurato]]"), ["sciaurato"]);
  assert.deepEqual(linkedWords("* [[sopraporta]], [[soprapporta|soprapporta]], [[sopraporta#Italiano]]"), ["sopraporta", "soprapporta"]);
  assert.deepEqual(linkedWords("#* ''fu indetto da [[w:Leone XIII|Leone XIII]]"), []);

  // Of uno's records, only the article defines nothing; un's article and adjective define something.
  const records: VariantRecord[] = RECORDS.map((record, i) => ({
    lineNo: i + 1, lineSha256: sha256(LINES[i]), word: record.word, posTitle: record.pos_title, definesSomething: !sensesDefineNothing(record.word, record.senses),
  }));
  assert.deepEqual(records.filter((record) => record.word === "uno").map((record) => [record.posTitle, record.definesSomething]), [
    ["Aggettivo numerale", true], ["Articolo", false], ["Pronome", true], ["Sostantivo", true],
  ]);
  const recordsOf = (word: string) => records.filter((record) => record.word === word);
  const article = records.find((record) => record.word === "uno" && record.posTitle === "Articolo");
  assert.ok(article);
  const unArticle = records.find((record) => record.word === "un" && record.posTitle === "Articolo");
  assert.ok(unArticle);
  assert.deepEqual(variantsOf("uno", "Articolo", variantLines({ wikitext: uno }), recordsOf), [
    { word: "un", line: { line: 64, wikitext: "* {{Glossa|aggettivo numerale}} {{Glossa|articolo}} [[un]]" }, record: { lineNo: unArticle.lineNo, lineSha256: unArticle.lineSha256 } },
  ]);
  // A variant with no reading of the section's title that defines something is none: un has no Pronome.
  assert.deepEqual(variantsOf("uno", "Pronome", variantLines({ wikitext: uno }), recordsOf), []);

  // The pinned list holds uno's article as the archive's line 2324, these bytes, leading to un's article at line 25470.
  const pinned = EMPTY_READING_VARIANT_EVIDENCE.readings.find((reading) => reading.record.word === "uno");
  assert.deepEqual(pinned, {
    record: { lineNo: 2324, lineSha256: article.lineSha256, word: "uno", pos: "article", posTitle: "Articolo" },
    revisionId: 4012236,
    variants: [{ word: "un", line: { line: 64, wikitext: "* {{Glossa|aggettivo numerale}} {{Glossa|articolo}} [[un]]" }, record: { lineNo: 25470, lineSha256: unArticle.lineSha256 } }],
  });
  assert.equal(EMPTY_READING_VARIANT_EVIDENCE.releaseId, "it-0c432803");
  // No reading #803 fills by hand is one the rule links.
  for (const reading of FILLED) assert.ok(!EMPTY_READING_VARIANT_EVIDENCE.readings.some(({ record }) => record.word === reading.word && record.pos === reading.partOfSpeech.pos), reading.word);
});

test("a lookup of uno reads its article as a form of un, at the {{-var-}} line, and a batch answers it with un's article (C)", async () => {
  const db: LookupDatabase = fromNodeSqlite(kept);
  const readings = await readingsOf(kept, "uno");
  assert.deepEqual(readings.map((reading) => [reading.pos, reading.posTitle]), [["adj", "Aggettivo numerale"], ["article", "Articolo"], ["pron", "Pronome"], ["noun", "Sostantivo"]]);
  const [, article, ...others] = readings;
  assert.ok(isFormOfReading(article));
  const [link, ...more] = article.lemmaLinks;
  assert.deepEqual(more, []);
  assert.ok(link?.kind === "candidates");
  assert.equal(link.targetWord, "un");
  assert.deepEqual(link.ref, { wiki: "it.wiktionary.org", title: "uno", revisionId: 4012236, line: 64 });
  assert.deepEqual(link.candidates.map((candidate) => [candidate.word, candidate.pos, candidate.ref.lineNo]), [["un", "article", 7], ["un", "adj", 8]]);
  // The other readings define themselves and lead nowhere.
  for (const reading of [readings[0], ...others]) assert.deepEqual(reading.lemmaLinks, []);

  // A batch answers the article with un's article, as the API answers a form-of reading with its lemmas of its own part of speech.
  const { answers } = await lookupBatch({ db, releaseId: RELEASE, queries: ["uno"] });
  const [answer] = answers;
  assert.ok(answer.outcome === "found");
  assert.deepEqual(answer.candidates.map((candidate) => [candidate.word, candidate.pos, candidate.lineNo]), [
    ["uno", "adj", 3], ["un", "article", 7], ["uno", "pron", 5], ["uno", "noun", 6],
  ]);
});
