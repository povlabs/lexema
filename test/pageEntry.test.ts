// Real dump revisions and archive lines (52740 racconto; 53209 fornito),
// it-0c432803 / itwiktionary-20260701. See fixtures/page-entry-provenance.md.
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { seedSql } from "../src/import/seedSql.js";
import { fromNodeSqlite, type LookupDatabase } from "../src/lookup/database.js";
import { OPTIONAL_TABLES_SQL, PAGE_ENTRY_TABLES } from "../src/lookup/served.js";
import { lookup, exists } from "../src/lookup/lookup.js";
import { lookupBatch } from "../src/lookup/batch.js";
import { loadFixturePages, rawPageSource } from "../src/source/rawPage.js";
import { recoverPageEntry, PAGE_ENTRY_RULE, PAGE_ENTRY_RULE_V2, type RecoveredEntry } from "../src/italian/pageEntry.js";
import { POS_BY_TITLE } from "../src/italian/partOfSpeech.js";
import type { RawPage } from "../src/source/rawPage.js";

const pages = await loadFixturePages(resolve("fixtures"));
const page = (title: string) => { const value = pages.page(title); assert.ok(value); return value; };

/** Every recovered fact names its revision and 1-based line, and keeps that line verbatim. */
function assertLineEvidence(source: RawPage, entry: RecoveredEntry): void {
  const lines = source.wikitext.split("\n");
  assert.equal(entry.posRef.revisionId, source.revisionId);
  assert.equal(entry.posRef.title, source.title);
  assert.equal(entry.posWikitext, lines[entry.posRef.line - 1]);
  for (const definition of entry.definitions) {
    assert.equal(definition.ref.revisionId, source.revisionId);
    assert.equal(definition.ref.title, source.title);
    assert.equal(definition.wikitext, lines[definition.ref.line - 1]);
    for (const example of definition.examples) {
      assert.equal(example.ref.revisionId, source.revisionId);
      assert.equal(example.wikitext, lines[example.ref.line - 1]);
    }
  }
}

/** One part-of-speech section as recovered: its title, the line stating it, its definitions in page order. */
type Section = [posTitle: string, posLine: number, texts: string[]];

const sectionsOf = (title: string): Section[] => {
  const source = page(title);
  const result = recoverPageEntry(source, new Set());
  assert.equal(result.outcome, "recovered", title);
  assert.ok(result.outcome === "recovered");
  return result.entries.map((entry) => {
    assert.equal(entry.rule, PAGE_ENTRY_RULE_V2, title);
    assert.equal(entry.pos, POS_BY_TITLE[entry.posTitle], title);
    assertLineEvidence(source, entry);
    return [entry.posTitle, entry.posRef.line, entry.definitions.map((definition) => definition.text)];
  });
};

test("each layout ADR 0028 admits recovers under rule v2 with the part of speech it states", () => {
  // One real page per layout, named by the 2026-10-03 report's group.
  const expected: Record<string, [layout: string, Section]> = {
    mastoide: ["none-heading/template", ["Sostantivo", 1, ["prominenza tondeggiante dell'osso temporale, posta dietro il padiglione dell'orecchio"]]],
    finora: ["bare-heading/template", ["Avverbio", 3, ["fino a questo momento"]]],
    "a monte": ["standard-heading/spaced-template", ["Locuzione avverbiale", 2, ["nella parte parte superiore di un monte", "indietro nel passato"]]],
    trincetto: ["bare-heading/bare-template", ["Sostantivo", 2, ["Strumento che il calzolaio usa per tagliare e rifilare cuoio e pelli; è costituito, in genere, da una lunga lama d'acciaio che ad un'estrenità è tagliata in tralice e affilata ."]]],
    accerchiarsi: ["standard-heading/verb-label", ["Verbo", 2, ["circondarsi con, portare a se un insieme di persone"]]],
    "purità": ["malformed-heading/template", ["Sostantivo", 2, [
      "condizione spirituale e fisica di chi non viene corrotto, è mondo ed addirittura apporta miglioramenti anche per gli altri",
      "situazione di massimo bene ricercata anche nell'ordine, comunque con la possibilità di estenderla anche al mondo materiale",
      "integrità interiore, spirituale e quindi \"fisica\"",
      "vivere in modo da non essere coinvolti nel desiderio errato di voler ostinatamente trovare errori o causare cose sbagliate",
    ]]],
    // The two templates ADR 0028 adds to the table.
    "piangere sul latte versato": ["standard-heading/unknown-template", ["Locuzione verbale", 2, ["lamentarsi di qualcosa in ritardo"]]],
    tantundem: ["standard-heading/unknown-template", ["Pronome", 2, ["equibarabile"]]],
  };
  for (const [title, [layout, section]] of Object.entries(expected)) {
    assert.deepEqual(sectionsOf(title), [section], `${title} (${layout})`);
  }
  const accerchiarsi = recoverPageEntry(page("accerchiarsi"), new Set());
  assert.ok(accerchiarsi.outcome === "recovered");
  assert.equal(accerchiarsi.entries[0].pos, "verb");
  const tantundem = recoverPageEntry(page("tantundem"), new Set());
  assert.ok(tantundem.outcome === "recovered");
  assert.equal(tantundem.entries[0].pos, "pron");
  assert.deepEqual(tantundem.entries[0].definitions[0].labels, ["diritto"]);
  // An archive record for the title still wins over the page.
  assert.equal(recoverPageEntry(page("mastoide"), new Set(["mastoide"])).outcome, "present-in-archive");
});

test("a page with several Italian part-of-speech sections gives one entry per section, in page order", () => {
  // `lungo` (`[[]]== {{-it-}} ==`): Aggettivo, then Preposizione.
  assert.deepEqual(sectionsOf("lungo"), [
    ["Aggettivo", 2, ["che si prolunga nel tempo", "di grande lunghezza"]],
    ["Preposizione", 11, ["per un tratto abbastanza ampio al limite di... confinante con...", "in tangenza"]],
  ]);
  const result = recoverPageEntry(page("lungo"), new Set());
  assert.ok(result.outcome === "recovered");
  assert.deepEqual(result.entries.map((entry) => entry.pos), ["adj", "prep"]);
  assert.deepEqual(result.entries[0].definitions[0].examples.map((example) => example.text), ["l'Italia è uno dei Paesi in cui si vive più a lungo"]);
  assert.deepEqual(result.entries[1].definitions[1].labels, ["raro"]);
});

test("no part of speech is guessed: a page with no signal, an English heading or an English Wiktionary copy gives nothing", () => {
  // `motteggio`: `== {{-it-}} ==`, then a `#` definition under no part-of-speech heading.
  // `irrequieti`: its only section is `===Adjective===`. `mezz'ora`: `{{Trasfen}}`, read as Sostantivo.
  for (const title of ["motteggio", "irrequieti", "mezz'ora"]) {
    assert.equal(recoverPageEntry(page(title), new Set()).outcome, "no-ruled-layout", title);
  }
});

test("the schema admits exactly the parts of speech a recovered entry can have", async () => {
  const schema = await readFile(resolve("src/db/schema.sql"), "utf8");
  const table = /CREATE TABLE recovered_entry \(([\s\S]*?)\) STRICT;/.exec(schema)?.[1];
  assert.ok(table !== undefined);
  const allowed = /pos TEXT NOT NULL CHECK \(pos IN \(([^)]*)\)\)/.exec(table)?.[1];
  assert.ok(allowed !== undefined);
  assert.deepEqual(new Set(allowed.split(",").map((code) => code.trim().replace(/^'|'$/g, ""))), new Set(Object.values(POS_BY_TITLE)));
  assert.match(table, new RegExp(`rule IN \\('${PAGE_ENTRY_RULE}', '${PAGE_ENTRY_RULE_V2}'\\)`));
});

test("ruled layouts recover definitions in page order with exact line evidence, not foreign entries or existing words", () => {
  const expected: Record<string, [number, string[]]> = {
    raccontare: [2, ["narrare, oralmente o tramite scrittura, eventi o storie", "rappresentare qualcosa, in genere cosa non gradita"]],
    dipendere: [2, ["esprime una condizione necessaria"]],
    dismagare: [2, ["Togliere, escludere", "Distogliere dalla coscienza di sè o del dovere."]],
    fornire: [2, ["dare cose a qualcuno"]],
    // The definition sits above the heading; the `#` line below it is the etymology.
    fidelizzare: [4, ["Rendere fedeli i consumatori di un prodotto, servizio o a una catena di negozi con opportune tecniche pubblicitarie e di marketing"]],
    // A bare `{{-verb-}}` is a part-of-speech heading, not a language that ends the Italian section.
    piallare: [3, ["appiattire con la pialla"]],
  };
  for (const [title, [posLine, texts]] of Object.entries(expected)) {
    const source = page(title);
    const result = recoverPageEntry(source, new Set());
    assert.equal(result.outcome, "recovered", title);
    assert.ok(result.outcome === "recovered");
    // Every page rule v1 recovers keeps its single v1 verb entry under rule v2's widening.
    assert.equal(result.entries.length, 1, title);
    const [entry] = result.entries;
    assert.equal(entry.rule, PAGE_ENTRY_RULE, title);
    assert.equal(entry.pos, "verb");
    assert.equal(entry.posTitle, "Verbo");
    assert.equal(entry.posRef.line, posLine);
    assert.equal(entry.posWikitext, source.wikitext.split("\n")[posLine - 1]);
    assert.deepEqual(entry.definitions.map((item) => item.text), texts);
    assertLineEvidence(source, entry);
  }
  const labelsOf = (title: string) => {
    const recovered = recoverPageEntry(page(title), new Set());
    assert.ok(recovered.outcome === "recovered");
    return recovered.entries[0].definitions.map((definition) => definition.labels);
  };
  // The lead-in `v. tr. (dismago, dismaghi, ecc.), arc.` labels every meaning it opens.
  assert.deepEqual(labelsOf("dismagare"), [["arc."], ["arc."]]);
  assert.deepEqual(labelsOf("fidelizzare"), [[]]);
  const result = recoverPageEntry(page("raccontare"), new Set());
  assert.ok(result.outcome === "recovered");
  assert.deepEqual(result.entries[0].definitions[1].labels, ["figurato"]);
  assert.deepEqual(result.entries[0].definitions[1].examples.map((example) => example.text), ["quello lì non me la racconta giusta"]);
  for (const title of ["movere", "skirmish", "notiziare"]) {
    assert.notEqual(recoverPageEntry(page(title), new Set()).outcome, "recovered", title);
  }
  assert.equal(recoverPageEntry(page("raccontare"), new Set(["raccontare"])).outcome, "present-in-archive");
});

test("isolated seed finds page entries and resolves real form records without inventing archive identities or fields", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lexema-page-entry-"));
  const db = new DatabaseSync(":memory:");
  try {
    const input = join(dir, "input.jsonl");
    await writeFile(input, (await readFile(resolve("fixtures/dev-seed.jsonl"), "utf8")) + (await readFile(resolve("fixtures/page-entry-forms.jsonl"), "utf8")));
    const options = { input, outputDir: join(dir, "sql"),
      schema: resolve("src/db/schema.sql"), releaseId: "it-page-entry-test" };
    // The comparison seed has precisely the same originals, without page recovery.
    const baseline = await seedSql({ ...options, rawPages: rawPageSource([...pages.titles()]
      .filter((title) => title !== "raccontare" && title !== "fornire").map(page)) });
    assert.ok(baseline.rows.recovered_definition > 0);
    const before = new DatabaseSync(":memory:");
    try {
      for (const part of baseline.parts) before.exec(await readFile(part, "utf8"));
      const report = await seedSql({ ...options, rawPages: pages });
      for (const part of report.parts) db.exec(await readFile(part, "utf8"));
      const read = fromNodeSqlite(db);
      for (const [title, form] of [["raccontare", "racconto"], ["fornire", "fornito"]]) {
        const result = await lookup({ db: read, releaseId: options.releaseId, query: title });
        assert.equal(result.outcome, "found", title);
        assert.ok(result.outcome === "found");
        const entry = result.readings[0];
        assert.ok(entry.entryId !== undefined);
        assert.equal(entry.recordId, undefined);
        assert.equal(entry.ref.lineNo, undefined);
        assert.equal(entry.ref.revisionId, page(title).revisionId);
        assert.ok(entry.recovered.length > 0);
        // Neither page writes its forms out, so neither entry has any; each
        // gives its pronunciation and etymology (ADR 0026, test/pageFacts.test.ts).
        assert.deepEqual(entry.forms, []);
        assert.deepEqual(entry.wordFacts.pronunciations.map((sound) => sound.ipa), [title === "raccontare" ? "/rakkonˈtare/" : "/forˈnire/"]);
        assert.equal(entry.wordFacts.etymologies.length, 1);
        const inflected = await lookup({ db: read, releaseId: options.releaseId, query: form });
        assert.ok(inflected.outcome === "found");
        const link = inflected.readings.flatMap((reading) => reading.lemmaLinks).find((link) => link.targetWord === title);
        assert.ok(link?.kind === "candidates");
        assert.equal(link.candidates[0].entryId, entry.entryId);
        assert.equal((await exists({ db: read, releaseId: options.releaseId, query: title })).outcome, "present");
      }
      // Batch is the same candidate identity and stays light at any batch size.
      const queries = ["raccontare", "racconto", "fornire", "fornito"];
      const statements: string[] = [];
      const batch = await lookupBatch({ db: { all: (sql, params) => { statements.push(sql); return read.all(sql, params); } },
        releaseId: options.releaseId, queries });
      assert.deepEqual(batch.answers.map((answer) => answer.outcome), queries.map(() => "found"));
      // The release and the optional tables (one D1 call), the search, the links.
      assert.equal(statements.length, 4);
      for (const answer of batch.answers) {
        assert.ok(answer.outcome === "found");
        assert.ok(answer.candidates[0].entryId !== undefined);
        assert.equal(answer.candidates[0].lineNo, undefined);
      }
      for (const table of ["source_record", "source_record_json", "sense", "sense_gloss", "lookup_form", "form_of_edge", "recovered_definition", "recovered_label", "recovered_example"]) {
        assert.deepEqual(db.prepare(`SELECT * FROM ${table}`).all(), before.prepare(`SELECT * FROM ${table}`).all(), table);
      }
      assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
      const stored = db.prepare(`SELECT p.title, p.revision_id, p.revision_timestamp, d.page_line, d.wikitext
        FROM entry_definition d JOIN recovered_entry e USING (entry_id) JOIN raw_page p USING (page_id)
        WHERE p.title IN ('raccontare', 'fornire')`).all();
      assert.equal(stored.length, 3);
      for (const row of stored) {
        const source = page(String(row.title));
        assert.equal(row.revision_id, source.revisionId);
        assert.equal(row.revision_timestamp, source.timestamp);
        assert.equal(row.wikitext, source.wikitext.split("\n")[Number(row.page_line) - 1]);
      }
      const present = await seedSql({ ...options, outputDir: join(dir, "present"), rawPages: rawPageSource([page("skirmish")]) });
      assert.equal(present.rows.recovered_entry, 0);
    } finally { before.close(); }
  } finally { db.close(); await rm(dir, { recursive: true, force: true }); }
});

test("the seed recovers every raw page no Italian record spells, not only the pages a form names", async () => {
  // Archive line 93815: `lunga`, a form of `lungo`, which has no Italian record.
  // No line names `mastoide` (Sostantivo) or `finora` (Avverbio); `casa` has a record.
  const dir = await mkdtemp(join(tmpdir(), "lexema-page-entry-"));
  const db = new DatabaseSync(":memory:");
  try {
    const input = join(dir, "input.jsonl");
    await writeFile(input, (await readFile(resolve("fixtures/dev-seed.jsonl"), "utf8"))
      + (await readFile(resolve("fixtures/page-entry-forms.jsonl"), "utf8"))
      + (await readFile(resolve("fixtures/page-entry-v2-forms.jsonl"), "utf8")));
    const source = rawPageSource(["casa", "fornire", "raccontare", "lungo", "mastoide", "finora"].map(page));
    const seeded = await seedSql({ input, outputDir: join(dir, "sql"), schema: resolve("src/db/schema.sql"), releaseId: "it-page-entry-test", rawPages: source });
    for (const part of seeded.parts) db.exec(await readFile(part, "utf8"));
    const named = db.prepare("SELECT DISTINCT target_word FROM form_of_edge WHERE target_word IN ('mastoide', 'finora')").all();
    assert.deepEqual(named, [], "no form names the two pages");
    const rows = db.prepare("SELECT word, pos, pos_title, rule, page_line FROM recovered_entry ORDER BY word, page_line").all().map((row) => ({ ...row }));
    assert.deepEqual(rows, [
      { word: "finora", pos: "adv", pos_title: "Avverbio", rule: PAGE_ENTRY_RULE_V2, page_line: 3 },
      { word: "fornire", pos: "verb", pos_title: "Verbo", rule: PAGE_ENTRY_RULE, page_line: 2 },
      { word: "lungo", pos: "adj", pos_title: "Aggettivo", rule: PAGE_ENTRY_RULE_V2, page_line: 2 },
      { word: "lungo", pos: "prep", pos_title: "Preposizione", rule: PAGE_ENTRY_RULE_V2, page_line: 11 },
      { word: "mastoide", pos: "noun", pos_title: "Sostantivo", rule: PAGE_ENTRY_RULE_V2, page_line: 1 },
      { word: "raccontare", pos: "verb", pos_title: "Verbo", rule: PAGE_ENTRY_RULE, page_line: 2 },
    ]);
    // Each entry names the revision it was read from, and keeps its line verbatim.
    const evidence = db.prepare(`SELECT p.title, p.revision_id, e.page_line, e.wikitext
      FROM recovered_entry e JOIN raw_page p USING (page_id)`).all();
    for (const row of evidence) {
      const read = page(String(row.title));
      assert.equal(row.revision_id, read.revisionId);
      assert.equal(row.wikitext, read.wikitext.split("\n")[Number(row.page_line) - 1]);
    }
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally { db.close(); await rm(dir, { recursive: true, force: true }); }
});

test("a dictionary seeded before the page-entry tables answers as it did, and never names them", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lexema-page-entry-"));
  const empty = new DatabaseSync(":memory:");
  const old = new DatabaseSync(":memory:");
  try {
    const releaseId = "it-page-entry-test";
    // Only `casa`'s page, which its record already heads: no page-only entry.
    const seeded = await seedSql({ input: resolve("fixtures/dev-seed.jsonl"), outputDir: join(dir, "sql"), schema: resolve("src/db/schema.sql"), releaseId, rawPages: rawPageSource([page("casa")]) });
    for (const part of seeded.parts) {
      const sql = await readFile(part, "utf8");
      empty.exec(sql);
      old.exec(sql);
    }
    assert.equal((empty.prepare("SELECT count(*) AS n FROM recovered_entry").get() as { n: number }).n, 0);
    for (const table of [...PAGE_ENTRY_TABLES].reverse()) old.exec(`DROP TABLE ${table}`);

    const sent: string[] = [];
    const watched = fromNodeSqlite(old);
    const oldRead: LookupDatabase = { all: (sql, params) => { sent.push(sql); return watched.all(sql, params); } };
    const emptyRead = fromNodeSqlite(empty);
    const words = ["casa", "vado", "andare", "bello", "raccontare"];
    for (const query of words) {
      assert.deepEqual(await lookup({ db: oldRead, releaseId, query }), await lookup({ db: emptyRead, releaseId, query }), query);
      assert.deepEqual(await exists({ db: oldRead, releaseId, query }), await exists({ db: emptyRead, releaseId, query }), query);
    }
    assert.equal((await lookup({ db: oldRead, releaseId, query: "casa" })).outcome, "found");
    assert.equal((await lookup({ db: oldRead, releaseId, query: "vado" })).outcome, "found");
    assert.deepEqual(await lookupBatch({ db: oldRead, releaseId, queries: words }), await lookupBatch({ db: emptyRead, releaseId, queries: words }));
    const named = sent.filter((sql) => PAGE_ENTRY_TABLES.some((table) => new RegExp(`\\b${table}\\b`).test(sql.replace(OPTIONAL_TABLES_SQL, ""))));
    assert.deepEqual(named, []);

    // Some page-entry tables without the rest is no schema anyone seeded: refused, never read as either.
    empty.exec("DROP TABLE entry_example");
    await assert.rejects(lookup({ db: emptyRead, releaseId, query: "casa" }), /not every page-entry table/);
  } finally { empty.close(); old.close(); await rm(dir, { recursive: true, force: true }); }
});
