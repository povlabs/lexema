import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { importRelease } from "../src/import/importRelease.js";
import { writePrefixArchive } from "../src/import/prefixArchive.js";

// The composition `seed:dev` relies on, end to end: cut a prefix into its own
// archive, then import that archive whole. The claim under test is the one
// #47 was about: the release the page serves is `complete`, and its checksum
// describes the prefix file, not the archive it was cut from.
const italian = (word: string) =>
  JSON.stringify({ word, pos: "noun", pos_title: "Sostantivo", lang_code: "it" });

const LINES = [
  italian("casa"),
  JSON.stringify({ word: "house", pos: "noun", pos_title: "Noun", lang_code: "en" }),
  italian("sale"),
  italian("città"),
  italian("parlare"),
  italian("zaino"),
];

test("a prefix archive imported whole lands a complete release whose checksum is the prefix", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lexema-seed-"));
  try {
    const source = join(dir, "it-extract.jsonl.gz");
    const prefix = join(dir, "it-dev.jsonl.gz");
    const database = join(dir, "dev.sqlite");
    await writeFile(source, gzipSync(`${LINES.join("\n")}\n`));

    const cut = await writePrefixArchive({ input: source, output: prefix, records: 3 });
    assert.equal(cut.records, 3);
    assert.equal(cut.exhausted, false, "the source holds more than the prefix");

    const rejections: string[] = [];
    const report = await importRelease({
      input: prefix,
      database,
      schema: "src/db/schema.sql",
      releaseId: "it-dev",
      archiveR2Key: "releases/it-dev.jsonl.gz",
      onRejection: ({ lineNo, kind }) => rejections.push(`${lineNo}:${kind}`),
    });

    // No `limit` was passed, so the importer read the prefix to its last line.
    assert.equal(report.status, "complete");
    assert.equal(report.admitted, 3);
    // The one non-Italian line inside the prefix is still counted and located.
    assert.deepEqual(rejections, ["2:other-language"]);

    // The release names the bytes that were read: the prefix, not the source.
    const prefixBytes = await readFile(prefix);
    const sourceBytes = await readFile(source);
    const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
    assert.equal(report.archiveSha256, sha(prefixBytes));
    assert.notEqual(report.archiveSha256, sha(sourceBytes));
    assert.equal(report.archiveBytes, prefixBytes.byteLength);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
