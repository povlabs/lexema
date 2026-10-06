import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { agreeingQuery, bothGenders, ESSERE_CLITICS, ESSERE_FINITE_FORMS, essereAgreement, type AgreeingSpelling } from "../src/italian/essereAgreement.js";
import { placeItalianVerbForm } from "../src/italian/moods.js";

const feminineAt = (spelling: string, number: "singular" | "plural"): string | undefined => {
  const read = essereAgreement(spelling, number);
  return read.kind === "agrees" ? read.spelling.feminine : undefined;
};

const shownAt = (spelling: string, number: "singular" | "plural"): string | undefined => {
  const read = essereAgreement(spelling, number);
  return read.kind === "agrees" ? bothGenders(read.spelling) : undefined;
};

test("an essere spelling agrees with its row's number: sono andato, siamo andati (#676)", () => {
  assert.equal(feminineAt("sono andato", "singular"), "sono andata");
  assert.equal(feminineAt("siamo andati", "plural"), "siamo andate");
  assert.equal(feminineAt("fossero venuti", "plural"), "fossero venute");
  assert.equal(shownAt("sono andato", "singular"), "sono andato/a");
  assert.equal(shownAt("siamo andati", "plural"), "siamo andati/e");
});

test("a reflexive spelling agrees: mi sono accorto, ci siamo accorti (#676)", () => {
  assert.equal(feminineAt("mi sono accorto", "singular"), "mi sono accorta");
  assert.equal(feminineAt("ci siamo accorti", "plural"), "ci siamo accorte");
  assert.equal(shownAt("mi sono accorto", "singular"), "mi sono accorto/a");
  assert.equal(shownAt("ci siamo accorti", "plural"), "ci siamo accorti/e");
});

test("only a cell's first spelling agrees; the later ones stay as the source gives them (#676)", () => {
  assert.equal(feminineAt("mi sono arreso, arresosi", "singular"), "mi sono arresa, arresosi");
  assert.equal(shownAt("mi sono arreso, arresosi", "singular"), "mi sono arreso/a, arresosi");
  assert.equal(shownAt("ci siamo arresi, arresosi", "plural"), "ci siamo arresi/e, arresosi");
  assert.equal(feminineAt("sono assorbito, assorto", "singular"), "sono assorbita, assorto");
  assert.equal(shownAt("sono assorbito, assorto", "singular"), "sono assorbito/a, assorto");
  const arreso = essereAgreement("mi sono arreso, arresosi", "singular");
  assert.ok(arreso.kind === "agrees");
  assert.equal(arreso.spelling.masculine, "mi sono arreso, arresosi");
  assert.equal(arreso.spelling.first, "mi sono arreso");
});

test("an avere spelling, a simple tense and the wrong number do not agree (#676)", () => {
  for (const spelling of ["ho mangiato", "ho vissuto", "mi arrendo"]) {
    assert.equal(essereAgreement(spelling, "singular").kind, "does-not-agree", spelling);
  }
  for (const spelling of ["siamo assorbito, assorti, assorti", "siamo andato"]) {
    assert.equal(essereAgreement(spelling, "plural").kind, "does-not-agree", spelling);
  }
  assert.equal(essereAgreement("sono andati", "singular").kind, "does-not-agree");
  // Three words agree only with a clitic first.
  assert.equal(essereAgreement("non sono andato", "singular").kind, "does-not-agree");
  assert.equal(essereAgreement("me ne sono andato", "singular").kind, "does-not-agree");
});

test("a typed query reads as the agreeing first spelling it is, or is the feminine of (#676)", () => {
  const read = (typed: string) => {
    const query = agreeingQuery(typed);
    return query === undefined ? undefined : [query.spelled, query.spelling.number, query.spelling.first];
  };
  assert.deepEqual(read("sono andata"), ["feminine", "singular", "sono andato"]);
  assert.deepEqual(read("siamo andate"), ["feminine", "plural", "siamo andati"]);
  assert.deepEqual(read("mi sono accorta"), ["feminine", "singular", "mi sono accorto"]);
  assert.deepEqual(read("ci siamo accorte"), ["feminine", "plural", "ci siamo accorti"]);
  assert.deepEqual(read("mi sono arresa"), ["feminine", "singular", "mi sono arreso"]);
  assert.deepEqual(read("mi sono arreso"), ["masculine", "singular", "mi sono arreso"]);
  for (const typed of ["ho mangiata", "sono andat", "andata", "la casa", "mi arrendo", "non sono andata", "mi sono arreso, arresosi"]) {
    assert.equal(agreeingQuery(typed), undefined, typed);
  }
});

test("an agreeing spelling is built only by the rule (#676)", () => {
  // @ts-expect-error: an object literal carries no brand, so it is not an agreeing spelling.
  const forged: AgreeingSpelling = { rule: "it-essere-agreement/v1", number: "singular", masculine: "ho mangiato", first: "ho mangiato", feminine: "ho mangiata" };
  assert.ok(forged);
});

test("the essere forms are the one-word indicative, subjunctive and conditional cells of essere in the dev seed, and the clitics are mi, ti, si, ci, vi (#676)", async () => {
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
  assert.deepEqual([...ESSERE_CLITICS].sort(), ["ci", "mi", "si", "ti", "vi"]);
});
