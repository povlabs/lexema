// `{{Fig}}` prints `senso figurato` (Template:Fig, read on it.wiktionary
// 2026-10-11): the renderer labels a line with it, and rule
// `rendered-fig-label/v1` brings the labels a seed wrote before #800, as
// `figurato`, to it. `{{Term|figurato|it}}` and `{{Glossa|figurato}}` print
// `figurato`, then and now. `pantomima`'s label is printed by the `#` line
// above its stored line, so the rule reads that line from the master's dump
// (#814). `casa`, `raccontare` and `pantomima` are verbatim revisions
// (fixtures/upstream-pages/); the `{{Term|figurato|it}}` line is verbatim from
// `fotografare`, revision 4070398 of itwiktionary-20260701. The numbered
// verb page is made up for the test.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { planWrite, readyChange } from "../src/deploy/writePlan.js";
import { FIG_LABEL_RULE, figLabelPageTitles, readFigLabelPages, relabelStoredFig } from "../src/import/figLabelUpdate.js";
import { planSourceText, SOURCE_TEXT_UPDATE_RULES } from "../src/import/normalizeSourceText.js";
import { seedSql } from "../src/import/seedSql.js";
import type { DictionarySql } from "../src/import/sourceTextUpdate.js";
import { recoverPageEntry } from "../src/italian/pageEntry.js";
import { pageFigLabels, readItalianSections, readRuledVerbSections, renderInline } from "../src/italian/wikitext.js";
import type { ArchiveFactsCatalog } from "../src/source/archiveFacts.js";
import { loadFixturePages, RAW_PAGE_WIKI, rawPageSource, type RawPage, type RawPageSource } from "../src/source/rawPage.js";
import { VerifiedDump } from "../src/source/wiktionaryDump.js";
import { parseChange } from "../src/update/declaration.js";

const pages = await loadFixturePages(resolve("fixtures"));
const page = (title: string): RawPage => pages.page(title) ?? assert.fail(title);

/** casa's line 15, verbatim. */
const FIG_LINE = "#* {{Fig}} {{Term|industriale|it}} casa [[costruttrice]]";
/** fotografare's sense line, verbatim. */
const TERM_LINE = "# {{Term|figurato|it}} [[rappresentare]] precisamente qualcosa";
/** pantomima's line 5, verbatim: the `#` line whose `{{Fig}}` labels the definition the page wrapped onto line 6. */
const PANTOMIMA_FIG_LINE = "#{{Fig}} ";

/** A page-only verb laid out as raccontare's page is, whose one sense is `TERM_LINE`. */
const TERM_PAGE: RawPage = {
  wiki: RAW_PAGE_WIKI, title: "fotografarsi", revisionId: 1, timestamp: "2026-07-01T00:00:00Z",
  wikitext: ["== {{-it-}} ==", "{{Transitivo|it}}", "{{Pn|c}}", TERM_LINE].join("\n"),
};

/** pantomima's revision with its line 5 set to `line`. */
const pantomimaWith = (line: string): RawPage => {
  const lines = page("pantomima").wikitext.split("\n");
  assert.equal(lines[4], PANTOMIMA_FIG_LINE);
  lines[4] = line;
  return { ...page("pantomima"), wikitext: lines.join("\n") };
};

test("a line's `{{Fig}}` labels it `senso figurato`, and `{{Term|figurato|it}}` still `figurato`", () => {
  const fig = renderInline(FIG_LINE.replace(/^#\*\s*/, ""), "casa");
  assert.ok(fig.rendered);
  assert.deepEqual([fig.text, fig.labels], ["casa costruttrice", ["senso figurato", "industriale"]]);
  const term = renderInline(TERM_LINE.replace(/^#\s*/, ""), "fotografare");
  assert.ok(term.rendered);
  assert.deepEqual([term.text, term.labels], ["rappresentare precisamente qualcosa", ["figurato"]]);

  // The recovered definitions read off those lines carry the same labels.
  const [noun] = readItalianSections(page("casa"));
  const costruttrice = noun.senseLines.flatMap((line) => line.below).find((definition) => definition.ref.line === 15);
  assert.equal(costruttrice?.wikitext, FIG_LINE);
  assert.deepEqual(costruttrice?.labels, ["senso figurato", "industriale"]);
  const entry = recoverPageEntry(TERM_PAGE, new Set());
  assert.ok(entry.outcome === "recovered");
  assert.deepEqual(entry.entries.flatMap((read) => read.definitions.map((definition) => [definition.wikitext, definition.labels])), [[TERM_LINE, ["figurato"]]]);
});

test("a wrapped-prose definition's labels are read off the `#` line above it, as the seed reads them", () => {
  const [noun] = readItalianSections(page("pantomima"));
  const wrapped = noun.senseLines.flatMap((line) => line.below).find((definition) => definition.route === "wrapped-prose");
  assert.ok(wrapped !== undefined);
  assert.equal(wrapped.ref.line, 6);
  assert.deepEqual(wrapped.labels, ["senso figurato"]);
  assert.deepEqual(pageFigLabels(page("pantomima"), "wrapped-prose", 6, wrapped.wikitext), [{ labels: ["senso figurato"], kept: ["figurato"] }]);

  // `{{Term|figurato|it}}` and `{{Glossa|figurato}}` on that line print `figurato`, then and now.
  for (const line of ["# {{Term|figurato|it}} ", "#{{Glossa|figurato}} "]) {
    assert.deepEqual(pageFigLabels(pantomimaWith(line), "wrapped-prose", 6, wrapped.wikitext), [{ labels: ["figurato"], kept: ["figurato"] }], line);
  }
  // A stored line the page does not hold there, or a line above that does not wrap it, decides nothing.
  assert.deepEqual(pageFigLabels(page("pantomima"), "wrapped-prose", 7, wrapped.wikitext), []);
  assert.deepEqual(pageFigLabels(pantomimaWith("# rappresentazione {{Fig}}"), "wrapped-prose", 6, wrapped.wikitext), []);
});

test("a numbered-prose definition's labels are its line's lead-in and its own meaning's, one reading per meaning", () => {
  const line = "v. tr., arc. '''1.''' {{Fig}} [[ingannare]] qualcuno '''2.''' [[stupire]] qualcuno";
  const verb: RawPage = { wiki: RAW_PAGE_WIKI, title: "dismagare", revisionId: 1, timestamp: "2026-07-01T00:00:00Z", wikitext: ["== {{-it-}} ==", "'''''Verbo'''''", line].join("\n") };
  const [section] = readRuledVerbSections(verb);
  assert.deepEqual(section.definitions.map((definition) => [definition.route, definition.labels]), [
    ["numbered-prose", ["arc.", "senso figurato"]],
    ["numbered-prose", ["arc."]],
  ]);
  assert.deepEqual(pageFigLabels(verb, "numbered-prose", 3, line), [
    { labels: ["arc.", "senso figurato"], kept: ["arc.", "figurato"] },
    { labels: ["arc."], kept: ["arc."] },
  ]);
});

/** What a test of the update reads: the dictionary, and the master's dump. */
interface Seeded {
  db: DatabaseSync;
  sql: DictionarySql;
  /** The archive the dictionary was seeded from, and its release id. */
  archive: string;
  releaseId: string;
  /** A dump holding the seeded pages, and the catalogs that tie it to the archive. */
  dump: string;
  catalog: ArchiveFactsCatalog;
  dumps: Record<string, { bytes: number; sha1: string }>;
  /** The verified dump, opened; counts how often it was. */
  open: () => Promise<VerifiedDump>;
  opened: () => number;
}

const escape = (text: string): string => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/** A dictionary seeded from casa's and pantomima's archive lines, with their pages and two page-only entries: raccontare's and `TERM_PAGE`'s. */
async function seeded(run: (seed: Seeded) => Promise<void> | void): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-fig-label-"));
  const db = new DatabaseSync(":memory:");
  try {
    const casa = (await readFile("fixtures/dev-seed.jsonl", "utf8")).split("\n").find((line) => line.startsWith('{"word": "casa",'));
    assert.ok(casa);
    const archive = join(dir, "fixture.jsonl");
    await writeFile(archive, `${casa}\n${(await readFile("fixtures/pantomima.jsonl", "utf8")).trimEnd()}\n`);
    const seededPages = [page("casa"), page("pantomima"), page("raccontare"), TERM_PAGE];
    const report = await seedSql({
      input: archive, outputDir: join(dir, "sql"), schema: resolve("src/db/schema.sql"), releaseId: "it-test",
      requiredWords: [], validateFixtureClosure: false,
      rawPages: rawPageSource(seededPages),
    });
    for (const part of report.parts) db.exec(await readFile(part, "utf8"));

    const dump = join(dir, "dump.xml");
    const xml = seededPages.map((held) => `  <page>\n    <title>${escape(held.title)}</title>\n    <ns>0</ns>\n    <revision>\n      <id>${held.revisionId}</id>\n      <timestamp>${held.timestamp}</timestamp>\n      <text xml:space="preserve">${escape(held.wikitext)}</text>\n    </revision>\n  </page>`).join("\n");
    await writeFile(dump, `<mediawiki>\n${xml}\n</mediawiki>\n`);
    const dumpBytes = await readFile(dump);
    const archiveSha = createHash("sha256").update(await readFile(archive)).digest("hex");
    const identity = { bytes: dumpBytes.length, sha1: createHash("sha1").update(dumpBytes).digest("hex") };
    let opened = 0;
    await run({
      db,
      sql: { query: <Row>(text: string) => db.prepare(text).all() as Row[], run: (text: string) => db.exec(text) },
      archive,
      releaseId: `it-${archiveSha.slice(0, 8)}`,
      dump,
      catalog: { [archiveSha]: { sourceUrl: "https://example.org/fixture", retrievedAt: "2026-10-01T00:00:00Z", dump: { id: "itwiktionary-20991001", basis: "recorded" }, evidence: ["synthetic fixture"] } },
      dumps: { "itwiktionary-20991001": identity },
      open: () => {
        opened += 1;
        return VerifiedDump.open(dump, identity);
      },
      opened: () => opened,
    });
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
}

/** Every stored label that reads `figurato` or `senso figurato`, with the word and line it labels. */
const labels = (db: DatabaseSync): string[][] => [
  ...db.prepare(
    `SELECT r.word, d.page_line, l.label_index, l.label FROM recovered_label l
       JOIN recovered_definition d USING (recovered_id) JOIN source_record r USING (record_id)
      WHERE l.label LIKE '%figurato' ORDER BY r.word, d.page_line, l.label_index`,
  ).all(),
  ...db.prepare(
    `SELECT e.word, d.page_line, l.label_index, l.label FROM entry_label l
       JOIN entry_definition d USING (entry_id, definition_index) JOIN recovered_entry e USING (entry_id)
      WHERE l.label LIKE '%figurato' ORDER BY e.word, d.page_line, l.label_index`,
  ).all(),
].map((row) => [String(row.word), String(row.page_line), String(row.label_index), String(row.label)]);

/** Every column the update must leave as it is: the records' JSON, the definitions whole, and the label rows but their label. */
const untouched = (db: DatabaseSync): unknown[] => [
  db.prepare("SELECT * FROM source_record_json ORDER BY record_id").all(),
  db.prepare("SELECT * FROM recovered_definition ORDER BY recovered_id").all(),
  db.prepare("SELECT * FROM entry_definition ORDER BY entry_id, definition_index").all(),
  db.prepare("SELECT recovered_id, label_index FROM recovered_label ORDER BY recovered_id, label_index").all(),
  db.prepare("SELECT entry_id, definition_index, label_index FROM entry_label ORDER BY entry_id, definition_index, label_index").all(),
];

/** As a seed before #800 wrote the labels. */
const beforeTheRule = (db: DatabaseSync): void => {
  db.exec("UPDATE recovered_label SET label = 'figurato' WHERE label = 'senso figurato'");
  db.exec("UPDATE entry_label SET label = 'figurato' WHERE label = 'senso figurato'");
};

test("the seed writes `senso figurato` for `{{Fig}}`, and the update brings a dictionary seeded before #800 to it, once, pantomima's wrapped line read off the dump", async () => {
  await seeded(async ({ db, sql, open, opened }) => {
    assert.deepEqual(labels(db), [
      ["casa", "15", "0", "senso figurato"],
      ["pantomima", "6", "0", "senso figurato"],
      ["fotografarsi", "4", "0", "figurato"],
      ["raccontare", "5", "0", "senso figurato"],
    ]);
    beforeTheRule(db);
    const before = untouched(db);
    assert.equal((before[0] as unknown[]).length, 2);
    assert.ok(SOURCE_TEXT_UPDATE_RULES.includes(FIG_LABEL_RULE));

    // Only pantomima's page is read: its label is printed by the `#` line above its stored line.
    assert.deepEqual([...figLabelPageTitles(sql)], ["pantomima"]);
    const read = await readFigLabelPages(sql, open);
    assert.deepEqual([...read.titles()], ["pantomima"]);
    assert.equal(opened(), 1);
    const plan = planSourceText(sql, read);
    assert.deepEqual(plan.counts.toJSON().written, { recovered_label: 2, entry_label: 1 });
    assert.equal(plan.counts.records.changed, 2);

    // casa's, raccontare's and pantomima's `{{Fig}}` labels change. fotografarsi's
    // `{{Term|figurato|it}}` stays.
    assert.deepEqual(relabelStoredFig(sql, read), { rule: FIG_LABEL_RULE, candidates: 4, changed: { recovered_label: 2, entry_label: 1 }, undecided: 0 });
    assert.deepEqual(labels(db), [
      ["casa", "15", "0", "senso figurato"],
      ["pantomima", "6", "0", "senso figurato"],
      ["fotografarsi", "4", "0", "figurato"],
      ["raccontare", "5", "0", "senso figurato"],
    ]);
    assert.deepEqual(untouched(db), before);

    // A second run plans nothing, and opens no dump: no candidate needs a page.
    const again = await readFigLabelPages(sql, () => assert.fail("no page is needed"));
    assert.deepEqual(relabelStoredFig(sql, again), { rule: FIG_LABEL_RULE, candidates: 1, changed: { recovered_label: 0, entry_label: 0 }, undecided: 0 });
    assert.equal(planSourceText(sql, again).statements, 0);
  });
});

test("the deploy plans normalize:source-text from the master's dump, and refuses another archive", async () => {
  await seeded(async ({ db, sql, archive, releaseId, dump, catalog, dumps }) => {
    beforeTheRule(db);
    const change = parseChange("test", JSON.stringify({ command: "normalize:source-text", inputs: { archive: releaseId, rules: [...SOURCE_TEXT_UPDATE_RULES] } }));
    const plan = await planWrite(readyChange(change, { archive, dump }), sql, "2026-10-17T00:00:00Z", { catalog, dumps });
    assert.deepEqual(plan.run.counts.toJSON().written, { recovered_label: 2, entry_label: 1 });
    db.exec(plan.sql);
    assert.deepEqual(plan.readBack(sql), []);
    assert.equal(labels(db).find(([word]) => word === "pantomima")?.[3], "senso figurato");

    const other = join(dump, "..", "other.jsonl");
    await writeFile(other, "{}\n");
    await assert.rejects(planWrite(readyChange(change, { archive: other, dump }), sql, "2026-10-17T00:00:00Z", { catalog, dumps }), /was seeded from the archive/);
    assert.throws(() => readyChange(change, null), /reads an archive and a dump/);
  });
});

test("the update leaves a label alone that its line did not print, or whose line it cannot read", async () => {
  await seeded(async ({ db, sql, open }) => {
    beforeTheRule(db);
    // casa's labels set another way: not what the line printed before #800, so not the rule's.
    db.exec("UPDATE recovered_label SET label = 'commerciale' WHERE label = 'industriale'");
    const report = relabelStoredFig(sql, await readFigLabelPages(sql, open));
    assert.deepEqual([report.changed.recovered_label, report.undecided], [1, 1]);
    assert.deepEqual(labels(db).filter(([word]) => word !== "fotografarsi" && word !== "raccontare"), [
      ["casa", "15", "0", "figurato"],
      ["pantomima", "6", "0", "senso figurato"],
    ]);
  });

  const pantomima = async (held: RawPageSource): Promise<{ report: ReturnType<typeof relabelStoredFig>; label: string | undefined }> => {
    let result: { report: ReturnType<typeof relabelStoredFig>; label: string | undefined } | undefined;
    await seeded(({ db, sql }) => {
      beforeTheRule(db);
      const report = relabelStoredFig(sql, held);
      result = { report, label: labels(db).find(([word]) => word === "pantomima")?.[3] };
    });
    return result ?? assert.fail("not run");
  };
  // With no page, or another revision of it, the line above is not read: pantomima is undecided.
  for (const held of [rawPageSource([]), rawPageSource([{ ...page("pantomima"), revisionId: page("pantomima").revisionId + 1 }])]) {
    const { report, label } = await pantomima(held);
    assert.deepEqual([report.changed.recovered_label, report.undecided, label], [1, 1, "figurato"]);
  }
  // A `{{Term|figurato|it}}` or `{{Glossa|figurato}}` on the line above prints `figurato`: the label stays, decided.
  for (const line of ["# {{Term|figurato|it}} ", "#{{Glossa|figurato}} "]) {
    const { report, label } = await pantomima(rawPageSource([pantomimaWith(line)]));
    assert.deepEqual([report.changed.recovered_label, report.undecided, label], [1, 0, "figurato"], line);
  }
});
