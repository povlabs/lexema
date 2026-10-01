// Rule `it-articles/v2` and the lookup layer around it. The grammar each case
// follows is cited in reports/2026-10-01-italian-articles.md.

import assert from "node:assert/strict";
import test from "node:test";
import { articlesFor, generateItalianArticles, type ArticleGender, type ArticleNumber } from "../src/italian/articles.js";
import { readingPartOfSpeech } from "../src/lookup/articles.js";
import type { GrammarClaim, ReadingArticles, SourceForm, SourceRef } from "../src/lookup/types.js";

const displays = (surface: string, gender: ArticleGender, number: ArticleNumber) =>
  generateItalianArticles(surface, gender, number).articles.map((article) => article.displayForm);

const cause = (surface: string, gender: ArticleGender, number: ArticleNumber) => {
  const result = articlesFor(surface, gender, number);
  return result.status === "withheld" ? result.cause : undefined;
};

test("each initial group takes its own masculine articles", () => {
  // il: the remaining consonants and clusters.
  assert.deepEqual(displays("casco", "masculine", "singular"), ["il casco", "un casco"]);
  assert.deepEqual(displays("caschi", "masculine", "plural"), ["i caschi", "dei caschi"]);
  assert.deepEqual(displays("criminale", "masculine", "singular"), ["il criminale", "un criminale"]);
  assert.deepEqual(displays("sale", "masculine", "singular"), ["il sale", "un sale"]);
  assert.deepEqual(displays("chicco", "masculine", "singular"), ["il chicco", "un chicco"]);
  assert.deepEqual(displays("quadro", "masculine", "singular"), ["il quadro", "un quadro"]);
  assert.deepEqual(displays("kiwi", "masculine", "singular"), ["il kiwi", "un kiwi"]);
  // l': a vowel, and `u` before a vowel (l'uomo).
  assert.deepEqual(displays("albero", "masculine", "singular"), ["l'albero", "un albero"]);
  assert.deepEqual(displays("uomo", "masculine", "singular"), ["l'uomo", "un uomo"]);
  assert.deepEqual(displays("alberi", "masculine", "plural"), ["gli alberi", "degli alberi"]);
});

test("s + consonant, z, x, gn, ps and pn take lo, uno, gli and degli", () => {
  assert.deepEqual(displays("studente", "masculine", "singular"), ["lo studente", "uno studente"]);
  assert.deepEqual(displays("studenti", "masculine", "plural"), ["gli studenti", "degli studenti"]);
  assert.deepEqual(displays("shampoo", "masculine", "singular"), ["lo shampoo", "uno shampoo"]);
  assert.deepEqual(displays("zaino", "masculine", "singular"), ["lo zaino", "uno zaino"]);
  assert.deepEqual(displays("xilofono", "masculine", "singular"), ["lo xilofono", "uno xilofono"]);
  assert.deepEqual(displays("gnomo", "masculine", "singular"), ["lo gnomo", "uno gnomo"]);
  assert.deepEqual(displays("gnomi", "masculine", "plural"), ["gli gnomi", "degli gnomi"]);
  assert.deepEqual(displays("psicologo", "masculine", "singular"), ["lo psicologo", "uno psicologo"]);
  assert.deepEqual(displays("pneumatico", "masculine", "singular"), ["lo pneumatico", "uno pneumatico"]);
  assert.deepEqual(displays("pneumatici", "masculine", "plural"), ["gli pneumatici", "degli pneumatici"]);
});

test("the feminine elides before a vowel only, and its plural is always le", () => {
  assert.deepEqual(displays("casa", "feminine", "singular"), ["la casa", "una casa"]);
  assert.deepEqual(displays("amica", "feminine", "singular"), ["l'amica", "un'amica"]);
  assert.deepEqual(displays("scelta", "feminine", "singular"), ["la scelta", "una scelta"]);
  assert.deepEqual(displays("case", "feminine", "plural"), ["le case", "delle case"]);
  assert.deepEqual(displays("anatre", "feminine", "plural"), ["le anatre", "delle anatre"]);
  // The plural article does not depend on the initial, so an unsettled one does not stop it.
  assert.deepEqual(displays("iene", "feminine", "plural"), ["le iene", "delle iene"]);
});

test("there is no indefinite plural, and a plural's partitive is labelled partitive", () => {
  for (const [surface, gender] of [["zaini", "masculine"], ["caschi", "masculine"], ["case", "feminine"]] as const) {
    const articles = generateItalianArticles(surface, gender, "plural").articles;
    assert.equal(articles.some((article) => article.kind === "indefinite"), false, surface);
    const partitive = articles.find((article) => article.article.startsWith("de"));
    assert.equal(partitive?.kind, "partitive", surface);
    assert.equal(partitive?.number, "plural", surface);
  }
});

test("a singular gets no partitive, since the source never says a noun is a mass noun", () => {
  for (const [surface, gender] of [["pane", "masculine"], ["acqua", "feminine"], ["studente", "masculine"]] as const) {
    const kinds = generateItalianArticles(surface, gender, "singular").articles.map((article) => article.kind);
    assert.deepEqual(kinds, ["definite", "indefinite"], surface);
  }
});

test("dei is the one listed exception: gli dei", () => {
  assert.deepEqual(displays("dèi", "masculine", "plural"), ["gli dèi", "degli dèi"]);
  assert.deepEqual(displays("dei", "masculine", "plural"), ["gli dei", "degli dei"]);
  // The source tags its `dei` record masculine singular; the exception does not cover that.
  assert.equal(cause("dei", "masculine", "singular"), "irregular-surface");
});

test("an initial whose sound the spelling does not settle is withheld", () => {
  const unsettled: [string, ArticleGender][] = [
    ["iato", "masculine"], // lo iato, but l'ione: the spelling is the same
    ["iena", "feminine"], // la iena or l'iena
    ["hotel", "masculine"],
    ["hall", "feminine"],
    ["jazz", "masculine"],
    ["whisky", "masculine"],
    ["webcam", "feminine"],
    ["yogurt", "masculine"],
    ["champagne", "masculine"], // a `ch` Italian spelling never writes
    ["pterodattilo", "masculine"],
    ["thriller", "masculine"],
    ["khmer", "masculine"],
    ["föhn", "masculine"],
    ["tsunami", "masculine"],
  ];
  for (const [surface, gender] of unsettled) {
    assert.equal(cause(surface, gender, "singular"), "initial-sound-not-settled", surface);
  }
  assert.equal(cause("hotel", "masculine", "plural"), "initial-sound-not-settled");
});

test("an apostrophe, hyphen, space or slash makes a composite, which is withheld", () => {
  for (const surface of ["'ndrangheta", "’ndrangheta", "po'", "e-mail", "città-stato", "spina dorsale", "studente/studentessa"]) {
    assert.equal(cause(surface, "feminine", "singular"), "composite-surface", surface);
    assert.equal(cause(surface, "feminine", "plural"), "composite-surface", surface);
  }
});

test("a letter name, acronym or symbol is not a spelled word", () => {
  for (const surface of ["x", "m", "mms", "mmHg", "rRNA", "mp3", "3"]) {
    assert.equal(cause(surface, "masculine", "singular"), "not-a-spelled-word", surface);
  }
  // A capital initial is still a word.
  assert.deepEqual(displays("Natale", "masculine", "singular"), ["il Natale", "un Natale"]);
});

test("the rule withholds when either gender or number is missing", () => {
  assert.equal(generateItalianArticles("casa", undefined, "singular").withheldReason, "missing-or-ambiguous-gender-number");
  assert.equal(generateItalianArticles("casa", "feminine", undefined).withheldReason, "missing-or-ambiguous-gender-number");
});

test("every derived article names its rule, agreement and kind", () => {
  const [definite, indefinite] = generateItalianArticles("zaino", "masculine", "singular").articles;
  assert.deepEqual(definite, {
    kind: "definite",
    article: "lo",
    displayForm: "lo zaino",
    gender: "masculine",
    number: "singular",
    sourceType: "lexema-deterministic",
    rule: "it-articles/v2",
  });
  assert.equal(indefinite?.kind, "indefinite");
});

// The lookup layer, which reads one record's stated grammar.

const ref = (jsonPointer: string): SourceRef => ({ releaseId: "it-test", lineNo: 1, jsonPointer, lineSha256: "0".repeat(64) });

const stated = (dimension: string, value: string, pointer = "/tags/0"): GrammarClaim => ({
  status: "stated",
  dimension,
  value,
  sourceText: value,
  ref: ref(pointer),
});

const missing = (dimension: string): GrammarClaim => ({ status: "missing", dimension, ref: ref("/tags") });

const form = (index: number, surface: string, claims: GrammarClaim[]): SourceForm => ({
  index,
  surface,
  ref: ref(`/forms/${index}/form`),
  formSource: null,
  claims,
});

function articlesOf(surface: string, claims: GrammarClaim[], forms: SourceForm[] = []): ReadingArticles {
  const reading = readingPartOfSpeech("noun", surface, claims, forms);
  assert.equal(reading.pos, "noun");
  return reading.articles as ReadingArticles;
}

const withheld = (articles: ReadingArticles) => (articles.status === "withheld" ? articles.withholding : undefined);

test("articles attach per reading: one spelling, two records, two agreements", () => {
  // `sale` is two records in the source: lines 21651 (masculine singular, salt)
  // and 21652 (feminine plural, a form of `sala`).
  const salt = articlesOf("sale", [stated("gender", "masculine"), stated("number", "singular")]);
  const halls = articlesOf("sale", [stated("gender", "feminine"), stated("number", "plural")]);
  assert.deepEqual(salt.status === "derived" && salt.articles.map((a) => a.displayForm), ["il sale", "un sale"]);
  assert.deepEqual(halls.status === "derived" && halls.articles.map((a) => a.displayForm), ["le sale", "delle sale"]);
});

test("a singular reading adds the articles of the one plural the source tags with its gender", () => {
  const studente = articlesOf("studente", [stated("gender", "masculine"), stated("number", "singular")], [
    form(0, "studenti", [stated("gender", "masculine", "/forms/0/tags/0"), stated("number", "plural", "/forms/0/tags/1")]),
    // A form with no gender of its own is not given the record's.
    form(1, "studentessa", [stated("number", "singular", "/forms/1/tags/0")]),
  ]);
  assert.deepEqual(studente.status === "derived" && studente.articles.map((a) => a.displayForm), [
    "lo studente",
    "uno studente",
    "gli studenti",
    "degli studenti",
  ]);

  const sale = articlesOf("sale", [stated("gender", "masculine"), stated("number", "singular")], [
    form(0, "sali", [stated("number", "plural", "/forms/0/tags/0")]),
  ]);
  assert.deepEqual(sale.status === "derived" && sale.articles.map((a) => a.displayForm), ["il sale", "un sale"]);

  // `dio` lists `dèi` tagged masculine plural: the exception, not `i dèi`.
  const dio = articlesOf("dio", [stated("gender", "masculine"), stated("number", "singular")], [
    form(0, "dèi", [stated("gender", "masculine", "/forms/0/tags/0"), stated("number", "plural", "/forms/0/tags/1")]),
  ]);
  assert.deepEqual(dio.status === "derived" && dio.articles.map((a) => a.displayForm), ["il dio", "un dio", "gli dèi", "degli dèi"]);
});

test("sparse varicella gets no gender: the reason names what the source left out", () => {
  // The source's `varicella` record (line 1128) has no tags and no gloss grammar stamp.
  assert.deepEqual(withheld(articlesOf("varicella", [missing("gender"), missing("number")])), { reason: "no-gender-or-number-stated" });
  assert.deepEqual(withheld(articlesOf("varicella", [stated("number", "singular")])), { reason: "gender-not-stated" });
  assert.deepEqual(withheld(articlesOf("varicella", [stated("gender", "feminine")])), { reason: "number-not-stated" });
});

test("invariable città is withheld rather than given a number", () => {
  assert.deepEqual(withheld(articlesOf("città", [stated("gender", "feminine"), stated("number", "invariable")])), {
    reason: "number-is-not-singular-or-plural",
    statedNumber: "invariable",
  });
});

test("a record stating two genders or two numbers is withheld, not given the first", () => {
  assert.deepEqual(
    withheld(articlesOf("psichiatra", [stated("gender", "feminine"), stated("gender", "masculine"), stated("number", "singular")])),
    { reason: "more-than-one-gender-stated", statedGenders: ["feminine", "masculine"] },
  );
  assert.deepEqual(
    withheld(articlesOf("khmer", [stated("gender", "masculine"), stated("number", "plural"), stated("number", "singular")])),
    { reason: "more-than-one-number-stated", statedNumbers: ["plural", "singular"] },
  );
  // The same tag twice is one statement.
  assert.equal(articlesOf("casa", [stated("gender", "feminine"), stated("gender", "feminine"), stated("number", "singular")]).status, "derived");
});

test("a gender articles cannot agree with is named", () => {
  assert.deepEqual(withheld(articlesOf("x", [stated("gender", "neuter"), stated("number", "singular")])), {
    reason: "gender-is-not-masculine-or-feminine",
    statedGender: "neuter",
  });
});

test("a surface the rule refuses carries the rule's own cause", () => {
  const agreeing = [stated("gender", "masculine"), stated("number", "singular")];
  assert.deepEqual(withheld(articlesOf("hotel", agreeing)), { reason: "surface-not-handled", surface: "hotel", cause: "initial-sound-not-settled" });
  assert.deepEqual(withheld(articlesOf("knock-out", agreeing)), { reason: "surface-not-handled", surface: "knock-out", cause: "composite-surface" });
  assert.deepEqual(withheld(articlesOf("mms", agreeing)), { reason: "surface-not-handled", surface: "mms", cause: "not-a-spelled-word" });
});

test("a part of speech other than noun carries no articles", () => {
  assert.equal(readingPartOfSpeech("verb", "casa", [stated("gender", "feminine")]).articles, undefined);
});
