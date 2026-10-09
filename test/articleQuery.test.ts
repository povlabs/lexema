// Rule `it-article-query/v1` (#738): a query read as an Italian article and
// one word. The lookup over real records is in test/articleLookup.test.ts.

import assert from "node:assert/strict";
import { test } from "node:test";
import { ARTICLE_QUERY_RULE, articleQuery, QUERY_ARTICLES } from "../src/italian/articleQuery.js";
import { articlesFor } from "../src/italian/articles.js";

/** The article and the word the rule reads, or undefined. */
const read = (query: string): [string, string] | undefined => {
  const result = articleQuery(query);
  return result === undefined ? undefined : [result.article, result.word];
};

test("an article from the list and one word is read as the two", () => {
  assert.deepEqual(read("una macchina"), ["una", "macchina"]);
  assert.deepEqual(read("la macchina"), ["la", "macchina"]);
  assert.deepEqual(read("gli zaini"), ["gli", "zaini"]);
  assert.deepEqual(read("le macchine"), ["le", "macchine"]);
  assert.deepEqual(read("il riso"), ["il", "riso"]);
  assert.deepEqual(read("lo zaino"), ["lo", "zaino"]);
  assert.deepEqual(read("i lama"), ["i", "lama"]);
  assert.deepEqual(read("un riso"), ["un", "riso"]);
  assert.deepEqual(read("uno zaino"), ["uno", "zaino"]);
  assert.equal(articleQuery("una macchina")?.rule, ARTICLE_QUERY_RULE);
});

test("an elided article joins its word with any of the four apostrophes the normalizer folds", () => {
  for (const apostrophe of ["'", "’", "‘", "ʼ"]) {
    assert.deepEqual(read(`l${apostrophe}acqua`), ["l'", "acqua"], `l${apostrophe}acqua`);
    assert.deepEqual(read(`un${apostrophe}auto`), ["un'", "auto"], `un${apostrophe}auto`);
  }
  assert.deepEqual(read("l’acqua"), ["l'", "acqua"]);
  assert.deepEqual(read("un'auto"), ["un'", "auto"]);
});

test("the query is read as the index keys it: case and surrounding space do not matter", () => {
  assert.deepEqual(read("  La Macchina "), ["la", "macchina"]);
  assert.deepEqual(read("L’Acqua"), ["l'", "acqua"]);
});

test("anything but an article and one word is refused", () => {
  for (const query of [
    "la",
    "l'",
    "un'",
    "macchina",
    "della macchina",
    "nella macchina",
    "sul tavolo",
    "dei ragazzi",
    "la macchina rossa",
    "l'acqua fresca",
    "l' acqua",
    "la 3",
    "lamacchina",
    "",
  ]) {
    assert.equal(articleQuery(query), undefined, query);
  }
});

test("the list is exactly the definite and indefinite articles it-articles/v3 gives", () => {
  // One word per initial group the rule tells apart: a vowel, `lo`'s and `il`'s.
  const given = new Set<string>();
  for (const surface of ["acqua", "zaino", "riso"]) {
    for (const gender of ["masculine", "feminine"] as const) {
      for (const number of ["singular", "plural"] as const) {
        const result = articlesFor(surface, gender, number);
        assert.equal(result.status, "derived", `${surface} ${gender} ${number}`);
        if (result.status !== "derived") continue;
        for (const one of result.articles) if (one.kind !== "partitive") given.add(one.article);
      }
    }
  }
  assert.deepEqual([...given].sort(), [...QUERY_ARTICLES].sort());
});
