import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import {
  assertUniqueContentKeys,
  contentFilePath,
  contentKey,
  convertRelease,
  wordPrefix,
} from "../src/content/converter.js";

const record = (word: string, pos: string, pos_title: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ word, lang_code: "it", pos, pos_title, tags: ["masculine"], forms: [{ form: `${word}-forma`, tags: ["plural"] }], senses: [{ glosses: [`glossa di ${word}`], tags: ["figuratively"], form_of: [{ word: "casa" }] }], ...extra });

async function setupRelease(dir: string, releaseId: string, lines: string[]) {
  const archive = join(dir, `${releaseId}.jsonl.gz`);
  await writeFile(archive, gzipSync(`${lines.join("\n")}\n`));
  return archive;
}

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "lexema-content-"));
  const lines = [
    record("sale", "noun", "Sostantivo"),
    record("sale", "noun", "Sostantivo, forma flessa"),
    record("sale", "verb", "Voce verbale"),
    record("casa", "noun", "Sostantivo"),
    record("bello", "noun", "Sostantivo"),
    record("bello", "noun", "Sostantivo"),
    record("1x", "noun", "Sostantivo"),
    record("a", "noun", "Sostantivo"),
    record("g/r", "noun", "Sostantivo"),
  ];
  const archive = await setupRelease(dir, "it-test", lines);
  return { dir, archive, output: join(dir, "content") };
}

test("keys identify every sale, casa and bello record exactly once", async () => {
  const setup_ = await setup();
  try {
    await convertRelease({ input: setup_.archive, output: setup_.output, releaseId: "it-test" });
    const sale = JSON.parse(await readFile(contentFilePath(setup_.output, "sale"), "utf8"));
    assert.deepEqual(Object.keys(sale.entries), ["noun:Sostantivo", "noun:Sostantivo, forma flessa", "verb:Voce verbale"]);
    const casa = JSON.parse(await readFile(contentFilePath(setup_.output, "casa"), "utf8"));
    assert.equal(Object.keys(casa.entries).length, 1);
    const bello = JSON.parse(await readFile(contentFilePath(setup_.output, "bello"), "utf8"));
    assert.deepEqual(Object.keys(bello.entries), ["noun:Sostantivo", "noun:Sostantivo#2"]);
    assert.equal(sale.entries["noun:Sostantivo"].senses[0].glosses[0].source.line, 1);
  } finally { await rm(setup_.dir, { recursive: true, force: true }); }
});

test("key escaping is injective and duplicate-key validation fails loudly", () => {
  assert.notEqual(contentKey("noun", "X", 1), contentKey("noun", "X#2", 1));
  assert.equal(contentKey("noun", "X#2", 1), "noun:X%232");
  assert.throws(() => assertUniqueContentKeys(["noun:X", "noun:X"], "collision"), /duplicate content key/);
});

test("prefix rule places ordinary and awkward words", () => {
  assert.deepEqual(wordPrefix("casa"), ["c", "ca", "cas", "casa"]);
  assert.deepEqual(wordPrefix("a"), ["a", "a_", "a__", "a___"]);
  assert.deepEqual(wordPrefix("1x"), ["_", "_x", "_x_", "_x__"]);
  assert.deepEqual(wordPrefix("g/r"), ["g", "g_", "g_r", "g_r_"]);
  assert.deepEqual(wordPrefix("ſ"), ["%C5%BF", "%C5%BF_", "%C5%BF__", "%C5%BF___"]);
});

test("re-conversion makes release B exact, preserves stable keys and editorial values", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lexema-content-reconversion-"));
  const output = join(dir, "content");
  try {
    const firstArchive = await setupRelease(dir, "release-a", [
      record("sale", "noun", "Sostantivo"),
      record("sale", "noun", "Forma flessa"),
      record("sparito", "noun", "Sostantivo"),
      record("orfano", "noun", "Sostantivo"),
      record("stabile", "noun", "X", { marker: "first" }),
      record("stabile", "noun", "X", { marker: "second" }),
    ]);
    await convertRelease({ input: firstArchive, output, releaseId: "release-a" });

    const salePath = contentFilePath(output, "sale");
    const sale = JSON.parse(await readFile(salePath, "utf8"));
    sale.entries["noun:Sostantivo"].lexema = { italianExplanation: "Testo editoriale" };
    await writeFile(salePath, `${JSON.stringify(sale)}\n`);
    const orphanPath = contentFilePath(output, "orfano");
    const orphan = JSON.parse(await readFile(orphanPath, "utf8"));
    orphan.entries["noun:Sostantivo"].lexema = { italianExample: "Un esempio." };
    await writeFile(orphanPath, `${JSON.stringify(orphan)}\n`);
    const stablePath = contentFilePath(output, "stabile");
    const stable = JSON.parse(await readFile(stablePath, "utf8"));
    stable.entries["noun:X"].lexema = { englishExplanation: "Stable editorial text" };
    await writeFile(stablePath, `${JSON.stringify(stable)}\n`);

    const secondArchive = await setupRelease(dir, "release-b", [
      record("stabile", "noun", "X", { marker: "second" }),
      record("stabile", "noun", "X", { marker: "first" }),
      record("sale", "noun", "Sostantivo"),
    ]);
    const second = await convertRelease({ input: secondArchive, output, releaseId: "release-b" });

    const updatedSale = JSON.parse(await readFile(salePath, "utf8"));
    assert.deepEqual(Object.keys(updatedSale.entries), ["noun:Sostantivo"]);
    assert.deepEqual(updatedSale.entries["noun:Sostantivo"].lexema, { italianExplanation: "Testo editoriale" });
    await assert.rejects(readFile(contentFilePath(output, "sparito"), "utf8"));

    const updatedOrphan = JSON.parse(await readFile(orphanPath, "utf8"));
    assert.equal(updatedOrphan.status, "orphaned");
    assert.equal(updatedOrphan.orphanedFromReleaseId, "release-a");
    assert.deepEqual(updatedOrphan.orphanedEntries["noun:Sostantivo"].lexema, { italianExample: "Un esempio." });
    assert.equal("entries" in updatedOrphan, false);
    assert.equal("releaseId" in updatedOrphan, false);

    const updatedStable = JSON.parse(await readFile(stablePath, "utf8"));
    assert.deepEqual(Object.keys(updatedStable.entries), ["noun:X", "noun:X#2"]);
    assert.deepEqual(updatedStable.entries["noun:X"].lexema, { englishExplanation: "Stable editorial text" });
    assert.equal(second.words, 2);
    assert.equal(second.records, 3);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("a second run is a no-op and editorial values survive canonicalization", async () => {
  const setup_ = await setup();
  try {
    const first = await convertRelease({ input: setup_.archive, output: setup_.output, releaseId: "it-test" });
    const path = contentFilePath(setup_.output, "casa");
    const document = JSON.parse(await readFile(path, "utf8"));
    document.entries["noun:Sostantivo"].lexema = {
      italianExplanation: "Una casa è un'abitazione.",
      englishExplanation: "A house is a dwelling.",
      italianExample: "La casa è grande.",
    };
    await writeFile(path, ` {\n  "entries": ${JSON.stringify(document.entries)},\n  "releaseId": "it-test",\n  "schema": "lexema-content/v1"\n}\n`);
    const second = await convertRelease({ input: setup_.archive, output: setup_.output, releaseId: "it-test" });
    assert.equal(first.files, 7);
    assert.equal(second.files, 1); // the non-canonical document is normalized
    const third = await convertRelease({ input: setup_.archive, output: setup_.output, releaseId: "it-test" });
    assert.equal(third.files, 0);
    const updated = JSON.parse(await readFile(path, "utf8"));
    assert.deepEqual(updated.entries["noun:Sostantivo"].lexema, document.entries["noun:Sostantivo"].lexema);
  } finally { await rm(setup_.dir, { recursive: true, force: true }); }
});
