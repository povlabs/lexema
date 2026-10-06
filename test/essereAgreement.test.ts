import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { bothGenders, ESSERE_FINITE_FORMS, essereAgreement, feminineOf } from "../src/italian/essereAgreement.js";
import { placeItalianVerbForm } from "../src/italian/moods.js";

const feminineAt = (spelling: string, number: "singular" | "plural"): string | undefined => {
  const read = essereAgreement(spelling, number);
  return read.kind === "agrees" ? read.spelling.feminine : undefined;
};

test("an essere spelling agrees with its row's number: sono andato, siamo andati (#676)", () => {
  assert.equal(feminineAt("sono andato", "singular"), "sono andata");
  assert.equal(feminineAt("siamo andati", "plural"), "siamo andate");
  assert.equal(feminineAt("fossero venuti", "plural"), "fossero venute");
  const sono = essereAgreement("sono andato", "singular");
  const siamo = essereAgreement("siamo andati", "plural");
  assert.ok(sono.kind === "agrees" && siamo.kind === "agrees");
  assert.equal(bothGenders(sono.spelling), "sono andato/a");
  assert.equal(bothGenders(siamo.spelling), "siamo andati/e");
});

test("an avere spelling, a reflexive, two participles and the wrong number do not agree (#676)", () => {
  for (const spelling of ["ho mangiato", "ho vissuto", "mi sono arreso, arresosi", "sono assorbito, assorto"]) {
    assert.equal(essereAgreement(spelling, "singular").kind, "does-not-agree", spelling);
  }
  assert.equal(essereAgreement("siamo andato", "plural").kind, "does-not-agree");
  assert.equal(essereAgreement("sono andati", "singular").kind, "does-not-agree");
});

test("a typed feminine reads back to the masculine it agrees with, and nothing else does (#676)", () => {
  assert.deepEqual(feminineOf("sono andata"), { rule: "it-essere-agreement/v1", number: "singular", masculine: "sono andato", feminine: "sono andata" });
  assert.deepEqual(feminineOf("siamo andate"), { rule: "it-essere-agreement/v1", number: "plural", masculine: "siamo andati", feminine: "siamo andate" });
  for (const typed of ["ho mangiata", "sono andat", "sono andato", "andata", "la casa", "mi sono arresa"]) {
    assert.equal(feminineOf(typed), undefined, typed);
  }
});

test("the essere forms are the one-word indicative, subjunctive and conditional cells of essere in the dev seed (#676)", async () => {
  const records = (await readFile(new URL("../fixtures/dev-seed.jsonl", import.meta.url), "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as { word: string; pos: string; forms?: { form: string; tags?: string[]; raw_tags?: string[] }[] })
    .filter((record) => record.word === "essere" && record.pos === "verb");
  assert.ok(records.length > 0, "the dev seed has essere");
  const finite = new Set(
    records.flatMap((record) =>
      (record.forms ?? [])
        .filter((form) => !form.form.includes(" "))
        .filter((form) => placeItalianVerbForm({ tags: form.tags ?? [], rawTags: form.raw_tags ?? [] }).kind === "tense")
        .map((form) => form.form),
    ),
  );
  assert.deepEqual([...ESSERE_FINITE_FORMS].sort(), [...finite].sort());
  for (const outside of ["sii", "essendo", "essente", "stato"]) assert.ok(!ESSERE_FINITE_FORMS.has(outside), outside);
});
