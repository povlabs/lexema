import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { admitsRecord } from "../src/import/importRelease.js";
import { writePrefixArchive } from "../src/import/prefixArchive.js";

// A hand-built archive carrying the three kinds of line the cut has to tell
// apart: an Italian record, another language, and an Italian line the importer
// refuses. Only the first kind counts towards the prefix length.
const italian = (word: string) =>
  JSON.stringify({ word, pos: "noun", pos_title: "Sostantivo", lang_code: "it" });

const LINES: string[] = [
  italian("casa"),
  JSON.stringify({ word: "house", pos: "noun", pos_title: "Noun", lang_code: "en" }),
  italian("sale"),
  // Italian, but missing pos_title: the importer calls this malformed, so it is
  // not a record and must not shorten the prefix.
  JSON.stringify({ word: "rotto", pos: "noun", lang_code: "it" }),
  italian("città"),
  italian("parlare"),
];

async function archive(): Promise<{ dir: string; input: string; output: string }> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-prefix-"));
  const input = join(dir, "it-extract.jsonl.gz");
  await writeFile(input, gzipSync(`${LINES.join("\n")}\n`));
  return { dir, input, output: join(dir, "prefix.jsonl.gz") };
}

const linesOf = async (path: string): Promise<string[]> =>
  gunzipSync(await readFile(path)).toString("utf8").split("\n").slice(0, -1);

test("counts records the way the importer does, not lines", async () => {
  const { dir, input, output } = await archive();
  try {
    const report = await writePrefixArchive({ input, output, records: 2 });

    // `casa` is the first record and `sale` the second; the English line
    // between them is carried along but counts for nothing.
    assert.deepEqual(report, { lines: 3, records: 2, exhausted: false });
    assert.deepEqual(await linesOf(output), LINES.slice(0, 3));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a line the importer refuses does not shorten the prefix", async () => {
  const { dir, input, output } = await archive();
  try {
    const report = await writePrefixArchive({ input, output, records: 3 });

    // The malformed Italian line at index 3 is not a record, so the third one
    // is `città` and the cut lands past both.
    assert.equal(report.records, 3);
    assert.equal(report.lines, 5);
    assert.equal(admitsRecord(LINES[3]!), false);
    assert.equal(await linesOf(output).then((l) => l.at(-1)), LINES[4]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("the prefix ends on a record, never on the lines after one", async () => {
  const { dir, input, output } = await archive();
  try {
    const report = await writePrefixArchive({ input, output, records: 1 });

    assert.deepEqual(await linesOf(output), [LINES[0]]);
    assert.equal(report.lines, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("an archive with fewer records than asked for is copied whole, and says so", async () => {
  const { dir, input, output } = await archive();
  try {
    const report = await writePrefixArchive({ input, output, records: 99 });

    assert.deepEqual(report, { lines: LINES.length, records: 4, exhausted: true });
    assert.deepEqual(await linesOf(output), LINES);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("refuses a prefix length that is not a positive whole number", async () => {
  const { dir, input, output } = await archive();
  try {
    for (const records of [0, -1, 1.5, Number.NaN]) {
      await assert.rejects(() => writePrefixArchive({ input, output, records }), RangeError);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a source that cannot be read fails the cut instead of shortening it", async () => {
  const { dir, input, output } = await archive();
  try {
    // A prefix that stops because the read failed is indistinguishable, by its
    // own report, from one that stopped because the archive ended — and the
    // release built from it would be `complete` for bytes nobody chose. So
    // both read failures have to reach the caller.
    const notGzip = join(dir, "plain.jsonl.gz");
    await writeFile(notGzip, "this is not a gzip member\n");
    await assert.rejects(
      () => writePrefixArchive({ input: notGzip, output, records: 1 }),
      /incorrect header check|Z_DATA_ERROR/,
    );

    await assert.rejects(
      () => writePrefixArchive({ input: join(dir, "absent.jsonl.gz"), output, records: 1 }),
      /ENOENT/,
    );

    // The good path still works from the same directory, so the failures above
    // are the input's and not the harness's.
    const report = await writePrefixArchive({ input, output, records: 1 });
    assert.equal(report.records, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
