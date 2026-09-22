import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { importRelease } from "../src/import/importRelease.js";
import { contentFilePath, convertRelease, wordPrefix } from "../src/content/converter.js";

const record = (word: string, pos: string, pos_title: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ word, lang_code: "it", pos, pos_title, tags: ["masculine"], forms: [{ form: `${word}-forma`, tags: ["plural"] }], senses: [{ glosses: [`glossa di ${word}`], tags: ["figuratively"], form_of: [{ word: "casa" }] }], ...extra });

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "lexema-content-"));
  const archive = join(dir, "release.jsonl.gz");
  const database = join(dir, "release.sqlite");
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
  await writeFile(archive, gzipSync(`${lines.join("\n")}\n`));
  await importRelease({ input: archive, database, schema: "src/db/schema.sql", releaseId: "it-test", archiveR2Key: "release.jsonl.gz", onRejection: () => {} });
  return { dir, database, output: join(dir, "content") };
}

test("keys identify every sale, casa and bello record exactly once", async () => {
  const setup_ = await setup();
  try {
    convertRelease({ database: setup_.database, output: setup_.output });
    const sale = JSON.parse(await readFile(contentFilePath(setup_.output, "sale"), "utf8"));
    assert.deepEqual(Object.keys(sale.entries), ["noun:Sostantivo", "noun:Sostantivo, forma flessa", "verb:Voce verbale"]);
    const casa = JSON.parse(await readFile(contentFilePath(setup_.output, "casa"), "utf8"));
    assert.equal(Object.keys(casa.entries).length, 1);
    const bello = JSON.parse(await readFile(contentFilePath(setup_.output, "bello"), "utf8"));
    assert.deepEqual(Object.keys(bello.entries), ["noun:Sostantivo", "noun:Sostantivo#2"]);
    assert.equal(sale.entries["noun:Sostantivo"].senses[0].glosses[0].source.line, 1);
  } finally { await rm(setup_.dir, { recursive: true, force: true }); }
});

test("prefix rule places ordinary and awkward words", () => {
  assert.deepEqual(wordPrefix("casa"), ["c", "ca", "cas", "casa"]);
  assert.deepEqual(wordPrefix("a"), ["a", "a_", "a__", "a___"]);
  assert.deepEqual(wordPrefix("1x"), ["_", "_x", "_x_", "_x__"]);
  assert.deepEqual(wordPrefix("g/r"), ["g", "g_", "g_r", "g_r_"]);
});

test("a second run is a no-op and editorial fields survive", async () => {
  const setup_ = await setup();
  try {
    const first = convertRelease({ database: setup_.database, output: setup_.output });
    const path = contentFilePath(setup_.output, "casa");
    const document = JSON.parse(await readFile(path, "utf8"));
    document.entries["noun:Sostantivo"].lexema = {
      italianExplanation: "Una casa è un'abitazione.",
      englishExplanation: "A house is a dwelling.",
      italianExample: "La casa è grande.",
    };
    await writeFile(path, `${JSON.stringify(document)}\n`);
    const second = convertRelease({ database: setup_.database, output: setup_.output });
    assert.equal(first.files, 7);
    assert.equal(second.files, 0); // editorial fields are preserved byte-for-byte
    const third = convertRelease({ database: setup_.database, output: setup_.output });
    assert.deepEqual(third, { files: 0, words: 6, records: 9, bytes: 0 });
    const updated = JSON.parse(await readFile(path, "utf8"));
    assert.deepEqual(updated.entries["noun:Sostantivo"].lexema, document.entries["noun:Sostantivo"].lexema);
  } finally { await rm(setup_.dir, { recursive: true, force: true }); }
});
