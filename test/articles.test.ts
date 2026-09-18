import assert from "node:assert/strict";
import test from "node:test";
import { generateItalianArticles } from "../src/italian/articles.js";

const displays = (surface: string, gender: "masculine" | "feminine", number: "singular" | "plural") => generateItalianArticles(surface, gender, number).articles.map((article) => article.displayForm);

test("generates articles for the queried surface grammar", () => {
  assert.deepEqual(displays("studente", "masculine", "singular"), ["lo studente", "uno studente", "dello studente"]);
  assert.deepEqual(displays("studenti", "masculine", "plural"), ["gli studenti", "degli studenti"]);
  assert.deepEqual(displays("casa", "feminine", "singular"), ["la casa", "una casa", "della casa"]);
  assert.deepEqual(displays("case", "feminine", "plural"), ["le case", "delle case"]);
});

test("handles vowel and special masculine initials without an indefinite plural", () => {
  assert.deepEqual(displays("amica", "feminine", "singular"), ["l'amica", "un'amica", "dell'amica"]);
  assert.deepEqual(displays("zaino", "masculine", "singular"), ["lo zaino", "uno zaino", "dello zaino"]);
  assert.equal(generateItalianArticles("zaini", "masculine", "plural").articles.some((article) => article.kind === "indefinite"), false);
});

test("withholds articles when source grammar or surface is unsafe", () => {
  assert.equal(generateItalianArticles("studente/studentessa", "masculine", "singular").withheldReason, "unsupported-or-composite-surface");
  assert.equal(generateItalianArticles("casa", undefined, "singular").withheldReason, "missing-or-ambiguous-gender-number");
});
