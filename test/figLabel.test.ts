// `{{Fig}}` prints `senso figurato` (Template:Fig, read on it.wiktionary
// 2026-10-11): the renderer labels a line with it, and rule
// `rendered-fig-label/v1` brings the labels a seed wrote before #800, as
// `figurato`, to it. `{{Term|figurato|it}}` prints `figurato`, then and now.
// `casa`, `raccontare` and `pantomima` are verbatim revisions
// (fixtures/upstream-pages/); the `{{Term|figurato|it}}` line is verbatim from
// `fotografare`, revision 4070398 of itwiktionary-20260701.

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { FIG_LABEL_RULE, relabelStoredFig } from "../src/import/figLabelUpdate.js";
import { planSourceText, SOURCE_TEXT_UPDATE_RULES } from "../src/import/normalizeSourceText.js";
import { seedSql } from "../src/import/seedSql.js";
import type { DictionarySql } from "../src/import/sourceTextUpdate.js";
import { recoverPageEntry } from "../src/italian/pageEntry.js";
import { readItalianSections, renderInline } from "../src/italian/wikitext.js";
import { loadFixturePages, RAW_PAGE_WIKI, rawPageSource, type RawPage } from "../src/source/rawPage.js";

const pages = await loadFixturePages(resolve("fixtures"));
const page = (title: string): RawPage => pages.page(title) ?? assert.fail(title);

/** casa's line 15, verbatim. */
const FIG_LINE = "#* {{Fig}} {{Term|industriale|it}} casa [[costruttrice]]";
/** fotografare's sense line, verbatim. */
const TERM_LINE = "# {{Term|figurato|it}} [[rappresentare]] precisamente qualcosa";

/** A page-only verb laid out as raccontare's page is, whose one sense is `TERM_LINE`. */
const TERM_PAGE: RawPage = {
  wiki: RAW_PAGE_WIKI, title: "fotografarsi", revisionId: 1, timestamp: "2026-07-01T00:00:00Z",
  wikitext: ["== {{-it-}} ==", "{{Transitivo|it}}", "{{Pn|c}}", TERM_LINE].join("\n"),
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

/** A dictionary seeded from casa's and pantomima's archive lines, with their pages and two page-only entries: raccontare's and `TERM_PAGE`'s. */
async function seeded(run: (db: DatabaseSync, sql: DictionarySql) => void): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-fig-label-"));
  const db = new DatabaseSync(":memory:");
  try {
    const casa = (await readFile("fixtures/dev-seed.jsonl", "utf8")).split("\n").find((line) => line.startsWith('{"word": "casa",'));
    assert.ok(casa);
    const input = join(dir, "fixture.jsonl");
    await writeFile(input, `${casa}\n${(await readFile("fixtures/pantomima.jsonl", "utf8")).trimEnd()}\n`);
    const report = await seedSql({
      input, outputDir: join(dir, "sql"), schema: resolve("src/db/schema.sql"), releaseId: "it-test",
      requiredWords: [], validateFixtureClosure: false,
      rawPages: rawPageSource([page("casa"), page("pantomima"), page("raccontare"), TERM_PAGE]),
    });
    for (const part of report.parts) db.exec(await readFile(part, "utf8"));
    run(db, { query: <Row>(text: string) => db.prepare(text).all() as Row[], run: (text: string) => db.exec(text) });
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

test("the seed writes `senso figurato` for `{{Fig}}`, and the update brings a dictionary seeded before #800 to it, once", async () => {
  await seeded((db, sql) => {
    const fresh = labels(db);
    assert.deepEqual(fresh, [
      ["casa", "15", "0", "senso figurato"],
      ["pantomima", "6", "0", "senso figurato"],
      ["fotografarsi", "4", "0", "figurato"],
      ["raccontare", "5", "0", "senso figurato"],
    ]);
    const before = db.prepare("SELECT * FROM source_record_json ORDER BY record_id").all();
    assert.equal(before.length, 2);

    // As a seed before #800 wrote them.
    db.exec("UPDATE recovered_label SET label = 'figurato' WHERE label = 'senso figurato'");
    db.exec("UPDATE entry_label SET label = 'figurato' WHERE label = 'senso figurato'");
    assert.ok(SOURCE_TEXT_UPDATE_RULES.includes(FIG_LABEL_RULE));
    const plan = planSourceText(sql);
    assert.deepEqual(plan.counts.toJSON().written, { recovered_label: 1, entry_label: 1 });
    assert.equal(plan.counts.records.changed, 1);

    // casa's and raccontare's `{{Fig}}` labels change. fotografarsi's
    // `{{Term|figurato|it}}` stays. pantomima's label is printed by the `#`
    // line above its stored line, so the rule cannot tell which template
    // printed it, and leaves it.
    assert.deepEqual(relabelStoredFig(sql), { rule: FIG_LABEL_RULE, candidates: 4, changed: { recovered_label: 1, entry_label: 1 }, undecided: 1 });
    assert.deepEqual(labels(db), [
      ["casa", "15", "0", "senso figurato"],
      ["pantomima", "6", "0", "figurato"],
      ["fotografarsi", "4", "0", "figurato"],
      ["raccontare", "5", "0", "senso figurato"],
    ]);
    assert.deepEqual(db.prepare("SELECT * FROM source_record_json ORDER BY record_id").all(), before);

    // A second run plans nothing.
    assert.deepEqual(relabelStoredFig(sql), { rule: FIG_LABEL_RULE, candidates: 2, changed: { recovered_label: 0, entry_label: 0 }, undecided: 1 });
    assert.equal(planSourceText(sql).statements, 0);
  });
});

test("the update leaves a label alone that its line did not print", async () => {
  await seeded((db, sql) => {
    // casa's labels set another way: not what the line printed before #800, so not the rule's.
    db.exec("UPDATE recovered_label SET label = 'figurato' WHERE label = 'senso figurato'");
    db.exec("UPDATE recovered_label SET label = 'commerciale' WHERE label = 'industriale'");
    const report = relabelStoredFig(sql);
    assert.deepEqual([report.changed.recovered_label, report.undecided], [0, 2]);
    assert.deepEqual(labels(db).filter(([word]) => word === "casa"), [["casa", "15", "0", "figurato"]]);
  });
});
