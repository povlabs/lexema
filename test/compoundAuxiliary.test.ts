import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { AVERE_FINITE_FORMS, compoundAuxiliary, groupByAuxiliary } from "../src/italian/compoundAuxiliary.js";
import { placeItalianVerbForm } from "../src/italian/moods.js";

test("an avere spelling is built on avere: ho vissuto, avremmo mangiato (#683)", () => {
  assert.equal(compoundAuxiliary("ho vissuto"), "avere");
  assert.equal(compoundAuxiliary("abbiamo assorbito"), "avere");
  assert.equal(compoundAuxiliary("avremmo mangiato"), "avere");
});

test("an essere spelling is built on essere: sono vissuto, fossero venuti (#683)", () => {
  assert.equal(compoundAuxiliary("sono vissuto"), "essere");
  assert.equal(compoundAuxiliary("fossero venuti"), "essere");
});

test("a reflexive spelling is built on essere after its clitic: mi sono accorto (#683)", () => {
  assert.equal(compoundAuxiliary("mi sono accorto"), "essere");
  assert.equal(compoundAuxiliary("ci saremmo accorti"), "essere");
});

test("a comma spelling is read by its first spelling: sono assorbito, assorto (#683)", () => {
  assert.equal(compoundAuxiliary("sono assorbito, assorto"), "essere");
  assert.equal(compoundAuxiliary("ho assorbito, assorto"), "avere");
  assert.equal(compoundAuxiliary("mi sono arreso, arresosi"), "essere");
});

test("a simple-tense spelling is built on no auxiliary: vivo, mi accorgo, sono, ho (#683)", () => {
  for (const spelling of ["vivo", "mi accorgo", "sono", "ho", "va', va, vai"]) assert.equal(compoundAuxiliary(spelling), undefined, spelling);
});

test("a cell groups its spellings by auxiliary, in source order (#683)", () => {
  const same = (spelling: string) => spelling;
  assert.deepEqual(groupByAuxiliary(["ho vissuto", "sono vissuto"], same), [["ho vissuto"], ["sono vissuto"]]);
  assert.deepEqual(groupByAuxiliary(["sono corso", "ho corso"], same), [["sono corso"], ["ho corso"]]);
  assert.deepEqual(groupByAuxiliary(["mi sono arreso, arresosi"], same), [["mi sono arreso, arresosi"]]);
  assert.deepEqual(groupByAuxiliary(["va'", "va", "vai"], same), [["va'", "va", "vai"]]);
  assert.deepEqual(groupByAuxiliary(["ho visto", "ho veduto", "sono visto"], same), [["ho visto", "ho veduto"], ["sono visto"]]);
});

test("AVERE_FINITE_FORMS is avere's own one-word finite forms in the dev seed (#683)", async () => {
  const records = (await readFile(new URL("../fixtures/dev-seed.jsonl", import.meta.url), "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as { word: string; pos: string; forms?: { form: string; tags?: string[]; raw_tags?: string[] }[] })
    .filter((record) => record.word === "avere" && record.pos === "verb");
  assert.ok(records.length > 0, "the dev seed has avere");
  const finite = new Set(
    records.flatMap((record) =>
      (record.forms ?? [])
        .filter((form) => !form.form.includes(" "))
        .filter((form) => placeItalianVerbForm({ tags: form.tags ?? [], rawTags: form.raw_tags ?? [] }).kind === "tense")
        .map((form) => form.form),
    ),
  );
  assert.deepEqual([...finite].sort(), [...AVERE_FINITE_FORMS].sort());
});
