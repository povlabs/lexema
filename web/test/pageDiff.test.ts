// The word page render diff (#808): every word page of the development
// fixture, rendered by the code the site runs (web/pageDiff/renderPages.ts),
// before and after one definition changes, and a declared lemma's page
// (fixtures/declared-lemmas.jsonl) before and after it gains a form.

import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { seedSql } from "../../src/import/seedSql.js";
import { seededDictionary } from "../../test/seededDictionary.js";
import { PageDiff, PageSnapshot, type RenderedPage } from "@/pageDiff/pageDiff.ts";
import { pageWordsOf } from "@/pageDiff/pageWords.ts";
import { renderPages } from "@/pageDiff/renderPages.ts";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const RELEASE = "it-page-diff-test";

/** zaino's noun record, whose first definition the change rewrites. */
const ZAINO_NOUN = '"word": "zaino", "lang_code": "it", "lang": "Italiano", "pos": "noun"';
const BEFORE = "sacco di pelle di ovino che usano i pastori per riporvi cibo ed arnesi";
const AFTER = "sacco di pelle di pecora che usano i pastori per riporvi cibo e arnesi";

const linesOf = async (fixture: string): Promise<string[]> => (await readFile(join(REPO, fixture), "utf8")).trimEnd().split("\n");
const devSeedLines = (): Promise<string[]> => linesOf("fixtures/dev-seed.jsonl");

async function seeded(key: string, lines: readonly string[]): Promise<DatabaseSync> {
  return seededDictionary(`page-diff:${key}`, async (outputDir) => {
    await mkdir(outputDir, { recursive: true });
    const input = join(outputDir, "fixture.jsonl.gz");
    await writeFile(input, gzipSync(Buffer.from(`${lines.join("\n")}\n`, "utf8")));
    return seedSql({ input, outputDir, schema: join(REPO, "src/db/schema.sql"), releaseId: RELEASE, license: "CC-BY-SA-4.0" });
  });
}

async function snapshotOf(db: DatabaseSync): Promise<PageSnapshot> {
  const pages: RenderedPage[] = [];
  for await (const page of renderPages(db, RELEASE, pageWordsOf(db, RELEASE))) pages.push(page);
  return PageSnapshot.of(pages);
}

test("a changed definition shows as one changed page, and an untouched page as unchanged", async () => {
  const lines = await devSeedLines();
  const zaino = lines.findIndex((line) => line.includes(ZAINO_NOUN));
  assert.ok(lines[zaino].includes(BEFORE), "the fixture's zaino noun has the definition the change rewrites");
  const changed = lines.map((line, i) => (i === zaino ? line.replace(BEFORE, AFTER) : line));

  const [baseDb, headDb] = [await seeded("base", lines), await seeded("head", changed)];
  try {
    const [base, head] = [await snapshotOf(baseDb), await snapshotOf(headDb)];
    const diff = PageDiff.between(base, head);

    assert.deepEqual(diff.changed, ["zaino"]);
    assert.deepEqual([diff.added, diff.removed], [[], []]);
    assert.equal(diff.compared, base.size);
    assert.equal(diff.unchanged, diff.compared - 1);
    assert.equal(head.digestOf("casa"), base.digestOf("casa"), "an untouched page renders the same");
  } finally {
    baseDb.close();
    headDb.close();
  }
});

test("a declared lemma's page is asked for, and a form it gains shows as one changed page", async () => {
  const lines = [...(await devSeedLines()), ...(await linesOf("fixtures/declared-lemmas.jsonl"))];
  const verbalizzo = lines.findIndex((line) => line.startsWith('{"word": "verbalizzo", "lang_code": "it"'));
  assert.ok(verbalizzo >= 0, "the fixture has verbalizzo, a form record of verbalizzare");
  // The head adds the line last, so every other record keeps its line number, which a page cites.
  const withoutVerbalizzo = lines.filter((_, i) => i !== verbalizzo);
  const withVerbalizzo = [...withoutVerbalizzo, lines[verbalizzo]];

  const [baseDb, headDb] = [await seeded("declared-base", withoutVerbalizzo), await seeded("declared-head", withVerbalizzo)];
  try {
    const heads = headDb.prepare("SELECT 1 FROM source_record WHERE release_id = ? AND word = 'verbalizzare'").all(RELEASE);
    assert.deepEqual(heads, [], "no record heads verbalizzare");
    assert.ok(pageWordsOf(headDb, RELEASE).includes("verbalizzare"), "the edges naming verbalizzare put it in the word list");

    const [base, head] = [await snapshotOf(baseDb), await snapshotOf(headDb)];
    assert.ok(base.digestOf("verbalizzare") !== undefined, "verbalizzare has a page at the base");
    const diff = PageDiff.between(base, head);

    assert.deepEqual(diff.changed, ["verbalizzare"]);
    assert.deepEqual([diff.added, diff.removed], [["verbalizzo"], []]);
  } finally {
    baseDb.close();
    headDb.close();
  }
});

test("a page only the head has is added, and one only the base has is removed", () => {
  const base = PageSnapshot.of([
    { word: "casa", sha256: "a" },
    { word: "quei", sha256: "b" },
  ]);
  const head = PageSnapshot.of([
    { word: "casa", sha256: "a" },
    { word: "stanotte", sha256: "c" },
  ]);
  const diff = PageDiff.between(base, head);

  assert.deepEqual(
    { compared: diff.compared, changed: diff.changed, added: diff.added, removed: diff.removed },
    { compared: 1, changed: [], added: ["stanotte"], removed: ["quei"] },
  );
  assert.match(diff.summary("aaaa", "bbbb", "fixtures/dev-seed.jsonl"), /\| added \| 1 \|[\s\S]*\*\*Added \(1\):\*\* stanotte/);
});
