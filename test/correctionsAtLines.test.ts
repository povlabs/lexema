// Keying the committed corrections to a fixture's lines (#742): each record
// entry moves to the line with its digest, and an entry no line carries byte
// for byte is left out. Every line is a verbatim line of fixtures/dev-seed.jsonl.

import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { FixtureLines } from "../src/italian/correctionsAtLines.js";
import { CURATED_CORRECTIONS, edgeCorrections, recordCorrections } from "../src/italian/curatedCorrections.js";

const devSeedLines = (await readFile(new URL("../fixtures/dev-seed.jsonl", import.meta.url), "utf8")).trimEnd().split("\n");
const lineOf = (word: string, pos: string): string =>
  devSeedLines.find((line) => {
    const record = JSON.parse(line) as { word: string; pos: string };
    return record.word === word && record.pos === pos;
  }) ?? assert.fail(`no dev-seed line is ${word} ${pos}`);

const COSTRUTTORI = lineOf("costruttori", "noun");
const costruttoriEdge = edgeCorrections(CURATED_CORRECTIONS).find((correction) => correction.record.word === "costruttori") ?? assert.fail("costruttori");
const fissazione = recordCorrections(CURATED_CORRECTIONS).find((correction) => correction.record.word === "fissazione") ?? assert.fail("fissazione");
const grufolare = CURATED_CORRECTIONS.find((correction) => correction.entry?.title === "grufolare") ?? assert.fail("grufolare");

test("a record entry moves to the fixture line with its digest, keyed to the fixture's release", () => {
  const fixture = FixtureLines.of([lineOf("costruttore", "noun"), COSTRUTTORI], "it-test");
  assert.deepEqual(fixture.place(costruttoriEdge)?.record, { ...costruttoriEdge.record, releaseId: "it-test", lineNo: 2 });
});

test("an entry whose line the fixture does not hold is left out, and a definition entry is held as listed", () => {
  const keyed = FixtureLines.of([COSTRUTTORI], "it-test").key([fissazione, costruttoriEdge, grufolare]);
  assert.deepEqual(keyed.leftOut, [fissazione]);
  assert.deepEqual(keyed.held.map((correction) => correction.record?.releaseId ?? correction.entry?.title), ["it-test", "grufolare"]);
  assert.equal(keyed.held[1], grufolare);
});

test("a line that differs by one byte does not hold the entry checked against it", () => {
  const keyed = FixtureLines.of([`${COSTRUTTORI} `], "it-test").key([costruttoriEdge]);
  assert.deepEqual(keyed, { held: [], leftOut: [costruttoriEdge] });
});

test("reading the fixture keys the same lines as its text split into lines", async () => {
  const path = new URL("../fixtures/dev-seed.jsonl", import.meta.url);
  const [read, split] = [(await FixtureLines.read(path, "it-dev")).key(CURATED_CORRECTIONS), FixtureLines.of(devSeedLines, "it-dev").key(CURATED_CORRECTIONS)];
  assert.deepEqual(read, split);
  assert.ok(read.held.some((correction) => correction.record?.word === "costruttori" && correction.record.releaseId === "it-dev"));
});
