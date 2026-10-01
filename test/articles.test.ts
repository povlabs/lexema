// Rule `it-articles/v3` and the lookup layer around it. The grammar each case
// follows is cited in reports/2026-10-01-italian-articles.md.

import assert from "node:assert/strict";
import test from "node:test";
import { articlesFor, generateItalianArticles, spokenOpening, type ArticleGender, type ArticleNumber } from "../src/italian/articles.js";
import { readingPartOfSpeech } from "../src/lookup/articles.js";
import type { GrammarClaim, Pronunciation, ReadingArticles, SourceForm, SourceRef } from "../src/lookup/types.js";

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

// The record's own IPA, where the spelling leaves the first sound open (#341).
// Each transcription below is the one the source writes for that word in
// release it-0c432803, style and all, except where a case says otherwise.

const spokenDisplays = (surface: string, gender: ArticleGender, number: ArticleNumber, ipas: string[]) =>
  generateItalianArticles(surface, gender, number, spokenOpening(ipas)).articles.map((article) => article.displayForm);

const spokenCause = (surface: string, gender: ArticleGender, number: ArticleNumber, ipas: string[]) => {
  const result = articlesFor(surface, gender, number, spokenOpening(ipas));
  return result.status === "withheld" ? result.cause : undefined;
};

test("an IPA that settles the first sound gives the article it implies", () => {
  assert.deepEqual(spokenDisplays("hotel", "masculine", "singular", ["/oˈtɛl/"]), ["l'hotel", "un hotel"]);
  assert.deepEqual(spokenDisplays("hotel", "masculine", "plural", ["/oˈtɛl/"]), ["gli hotel", "degli hotel"]);
  assert.deepEqual(spokenDisplays("hostess", "feminine", "singular", ["/ˈɔstes/"]), ["l'hostess", "un'hostess"]);
  assert.deepEqual(spokenDisplays("io", "masculine", "singular", ["/ˈio/"]), ["l'io", "un io"]);
  // Semivowel /j/ takes lo, and its feminine la and una (una iattura).
  assert.deepEqual(spokenDisplays("yogurt", "masculine", "singular", ["/ˈjɔɡurt/"]), ["lo yogurt", "uno yogurt"]);
  assert.deepEqual(spokenDisplays("ione", "masculine", "singular", ["/ˈjone/"]), ["lo ione", "uno ione"]);
  assert.deepEqual(spokenDisplays("iena", "feminine", "singular", ["/ˈjɛna/"]), ["la iena", "una iena"]);
  assert.deepEqual(spokenDisplays("yoghurt", "masculine", "singular", ["/'jɔ:.gurt/"]), ["lo yoghurt", "uno yoghurt"]);
  // An ordinary consonant takes il, alone or before l or r.
  assert.deepEqual(spokenDisplays("water", "masculine", "singular", ["/ˈvater/"]), ["il water", "un water"]);
  assert.deepEqual(spokenDisplays("jeans", "masculine", "plural", ["/ˈd͡ʒins/"]), ["i jeans", "dei jeans"]);
  assert.deepEqual(spokenDisplays("thriller", "masculine", "singular", ["/ˈtriller/"]), ["il thriller", "un thriller"]);
  // /ts/ is the sound of ‹z›: lo.
  assert.deepEqual(spokenDisplays("tsunami", "masculine", "singular", ["/tsuˈnami/"]), ["lo tsunami", "uno tsunami"]);
  // Two transcriptions that open the same way agree, in one string or two.
  assert.deepEqual(spokenDisplays("jazz", "masculine", "singular", ["/ˈd͡ʒɛts/, /ˈd͡ʒɛz//"]), ["il jazz", "un jazz"]);
  assert.deepEqual(spokenDisplays("würstel", "masculine", "singular", ["/ˈvurstel/", "/ˈvyrstel/"]), ["il würstel", "un würstel"]);
});

test("a missing IPA, or IPA that disagrees, still withholds", () => {
  assert.equal(spokenCause("hotel", "masculine", "singular", []), "initial-sound-not-settled");
  // `iato` is written both ways in the source: a vowel /i/ and a semivowel /j/.
  assert.equal(spokenCause("iato", "masculine", "singular", ["/iˈa.to/", "/ˈja.to/"]), "initial-sound-not-settled");
  // Two in one string, one with /h/ and one without.
  assert.equal(spokenCause("hertz", "masculine", "singular", ["ɛrts/, /ˈhɛrts"]), "initial-sound-not-settled");
  assert.equal(spokenCause("hora", "feminine", "singular", ["[ho'ra]", "[ora]"]), "initial-sound-not-settled");
  // An optional sound, or nothing readable, settles nothing.
  assert.equal(spokenCause("hikikomori", "masculine", "singular", ["/(h)ikikoˈmɔri/"]), "initial-sound-not-settled");
  assert.equal(spokenCause("jena", "feminine", "singular", ["["]), "initial-sound-not-settled");
});

test("an IPA that agrees on a sound the references give no article still withholds", () => {
  // /h/ is not an Italian sound; /w/ takes l' "a rigore" but il by usage (il web).
  assert.equal(spokenCause("hobby", "masculine", "singular", ["/ˈhobbi/"]), "initial-sound-not-settled");
  assert.equal(spokenCause("web", "masculine", "singular", ["/ˈwɛb/"]), "initial-sound-not-settled");
  assert.equal(spokenCause("pterodattilo", "masculine", "singular", ["/pteroˈdattilo/"]), "initial-sound-not-settled");
});

test("ch before e or i takes the IPA's sound when the record has one", () => {
  // Read /ʃ/, a loan is not given il.
  assert.deepEqual(spokenDisplays("chef", "masculine", "singular", ["/ʃɛf/"]), ["lo chef", "uno chef"]);
  assert.deepEqual(spokenDisplays("chic", "masculine", "singular", ["/ˈʃik/"]), ["lo chic", "uno chic"]);
  assert.deepEqual(spokenDisplays("chela", "feminine", "singular", ["/ˈkɛla/"]), ["la chela", "una chela"]);
  // With no IPA, or IPA that opens on /k/ every time it is read, the spelling's
  // Italian /k/ stands, as in v2.
  assert.deepEqual(spokenDisplays("chilo", "masculine", "singular", []), ["il chilo", "un chilo"]);
  assert.deepEqual(spokenDisplays("chiasmo", "masculine", "singular", ["/ˈkjazmo/", "/kiˈazmo/"]), ["il chiasmo", "un chiasmo"]);
  assert.deepEqual(spokenDisplays("chilo", "masculine", "singular", ["/ˈkilo/", "["]), ["il chilo", "un chilo"]);
  // An IPA that is not /k/ and gives no article withholds rather than falls back (made up).
  assert.equal(spokenCause("cheque", "masculine", "singular", ["/ˈhɛk/"]), "initial-sound-not-settled");

});

test("ch before e or i is withheld when its transcriptions disagree and one is not /k/", () => {
  // Made up: the source reads it /ʃ/ at least once, so the presumed /k/ is contradicted.
  assert.equal(spokenCause("chef", "masculine", "singular", ["/ʃɛf/", "/kɛf/"]), "initial-sound-not-settled");
  assert.equal(spokenCause("chef", "masculine", "singular", ["/ʃɛf/, /ˈkɛf/"]), "initial-sound-not-settled");
  assert.equal(spokenCause("chef", "masculine", "plural", ["/ʃɛf/", "/kɛf/"]), "initial-sound-not-settled");
  // One /ʃ/ beside one that cannot be read is no agreement on /k/ either.
  assert.equal(spokenCause("chef", "masculine", "singular", ["/ʃɛf/", "["]), "initial-sound-not-settled");
  // /tʃ/ and /k/ disagree too: neither stands for the record.
  assert.equal(spokenCause("chimes", "masculine", "plural", ["/tʃajmz/", "/kimes/"]), "initial-sound-not-settled");
});

test("an initial the spelling settles ignores the IPA", () => {
  // Made up: the spelling's reading stands whatever the IPA says.
  assert.deepEqual(spokenDisplays("casa", "feminine", "singular", ["/ˈhasa/"]), ["la casa", "una casa"]);
  assert.deepEqual(spokenDisplays("uomo", "masculine", "singular", ["/ˈwɔmo/"]), ["l'uomo", "un uomo"]);
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
    rule: "it-articles/v3",
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

test("sparse casa gets no gender: the reason names what the source left out", () => {
  // The source's `casa` record has no tags at all; its gender is only in gloss prose.
  assert.deepEqual(withheld(articlesOf("casa", [missing("gender"), missing("number")])), { reason: "no-gender-or-number-stated" });
  assert.deepEqual(withheld(articlesOf("casa", [stated("number", "singular")])), { reason: "gender-not-stated" });
  assert.deepEqual(withheld(articlesOf("casa", [stated("gender", "feminine")])), { reason: "number-not-stated" });
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

test("a reading's own IPA reaches its headword's articles, never its plural form's", () => {
  const pronunciation = (ipa: string): Pronunciation => ({ ipa, note: null, ref: ref("/sounds/0/ipa") });
  const agreeing = [stated("gender", "masculine"), stated("number", "singular")];
  const hotel = articlesOf("hotel", agreeing, [
    form(0, "hotels", [stated("gender", "masculine", "/forms/0/tags/0"), stated("number", "plural", "/forms/0/tags/1")]),
  ]);
  assert.equal(hotel.status, "withheld");
  const spoken = readingPartOfSpeech("noun", "hotel", agreeing, [
    form(0, "hotels", [stated("gender", "masculine", "/forms/0/tags/0"), stated("number", "plural", "/forms/0/tags/1")]),
  ], [pronunciation("/oˈtɛl/")]).articles as ReadingArticles;
  // `hotels` is spelled, and may be said, otherwise: it gets no article from the headword's IPA.
  assert.deepEqual(spoken.status === "derived" && spoken.articles.map((a) => a.displayForm), ["l'hotel", "un hotel"]);

  const iato = readingPartOfSpeech("noun", "iato", agreeing, [], [pronunciation("/iˈa.to/"), pronunciation("/ˈja.to/")]);
  assert.deepEqual(withheld(iato.articles as ReadingArticles), {
    reason: "surface-not-handled",
    surface: "iato",
    cause: "initial-sound-not-settled",
  });
});

test("a part of speech other than noun carries no articles", () => {
  assert.equal(readingPartOfSpeech("verb", "casa", [stated("gender", "feminine")]).articles, undefined);
});
