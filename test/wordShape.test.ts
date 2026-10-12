// Rule `it-word-shape/v1` (#809): the words a typed form is a shape of.
// The words are from the missing-word count
// (reports/2026-10-11-missing-common-words.md); the lookup over them is
// test/wordShapeLookup.test.ts.

import assert from "node:assert/strict";
import test from "node:test";
import { answeringSpellings, shapedSpellings, shapeAdmits, wordShapeLine, type ShapedRecord, type Shape } from "../src/italian/wordShape.js";

/** The keys the rule names for `key` under `shape`, in its order. */
const keysOf = (key: string, shape: Shape): string[] =>
  shapedSpellings(key)
    .filter((spelling) => spelling.shape === shape)
    .map((spelling) => spelling.key);

const record = (pos: string, plural = false, pastParticiple = false, listsForms = false): ShapedRecord => ({ pos, plural, pastParticiple, listsForms });

test("a verb with clitics names its infinitive, and its pronominal verb when the cluster opens with a reflexive: raccontarvi, vergognarti, andartene (#809)", () => {
  assert.ok(keysOf("raccontarvi", "clitic").includes("raccontare"));
  assert.ok(keysOf("raccontarmi", "clitic").includes("raccontare"));
  assert.deepEqual(keysOf("vergognarti", "clitic"), ["vergognare", "vergognarsi"]);
  assert.deepEqual(keysOf("andartene", "clitic"), ["andare", "andarsene"]);
  assert.deepEqual(keysOf("dirglielo", "clitic"), ["dire"]);
  // An infinitive in -rre: trarne of trarre.
  assert.ok(keysOf("trarne", "clitic").includes("trarre"));
});

test("an imperative or gerund with clitics names that form: scusami, scusatemi, facciamolo, dicendomi, tieniti (#809)", () => {
  assert.deepEqual(keysOf("scusami", "clitic"), ["scusa"]);
  assert.deepEqual(keysOf("scusatemi", "clitic"), ["scusate"]);
  assert.deepEqual(keysOf("facciamolo", "clitic"), ["facciamo"]);
  assert.deepEqual(keysOf("dicendomi", "clitic"), ["dicendo"]);
  assert.deepEqual(keysOf("tieniti", "clitic"), ["tieni"]);
  // `smettete-la`, never `smette-tela`: a third person singular takes no clitic.
  assert.deepEqual(keysOf("smettetela", "clitic"), ["smettete"]);
  // A participle plural takes none either: fuggitivi is no fuggiti-vi.
  assert.deepEqual(keysOf("fuggitivi", "clitic"), []);
});

test("an imperative of one syllable doubles its clitic's consonant, never gli's: dammi, dimmi, vattene, fallo, dagli (#809)", () => {
  assert.deepEqual(keysOf("dammi", "clitic"), ["da'"]);
  assert.deepEqual(keysOf("dimmi", "clitic"), ["di'"]);
  assert.deepEqual(keysOf("vattene", "clitic"), ["va'"]);
  assert.deepEqual(keysOf("fallo", "clitic"), ["fa'"]);
  assert.deepEqual(keysOf("dagli", "clitic"), ["da'"]);
  // `fa-telo` is no form: fatelo is fate-lo.
  assert.deepEqual(keysOf("fatelo", "clitic"), ["fate"]);
});

test("quei and quegli name quello, bei and begli bello; nothing else is a demonstrative form (#809)", () => {
  assert.deepEqual(keysOf("quei", "demonstrative"), ["quello"]);
  assert.deepEqual(keysOf("quegli", "demonstrative"), ["quello"]);
  assert.deepEqual(keysOf("bei", "demonstrative"), ["bello"]);
  assert.deepEqual(keysOf("begli", "demonstrative"), ["bello"]);
  assert.deepEqual(keysOf("quelli", "demonstrative"), []);
});

test("an elided word names each vowel it may have dropped; a one-letter pronoun names its pronoun; an accent written as an apostrophe is no elision (#809)", () => {
  assert.deepEqual(keysOf("quell'", "elided"), ["quello", "quella", "quelle"]);
  assert.deepEqual(keysOf("dov'", "elided"), ["dovo", "dova", "dove"]);
  assert.deepEqual(keysOf("m'", "elided"), ["mi"]);
  assert.deepEqual(keysOf("s'", "elided"), ["si"]);
  assert.deepEqual(keysOf("citta'", "elided"), []);
  assert.deepEqual(keysOf("liberta'", "elided"), []);
});

test("a truncated word names -e, then -o and -no, in tiers; ancor names ancora alone; a double consonant or no vowel is no truncation (#809)", () => {
  const tiers = (key: string) => shapedSpellings(key).filter((spelling) => spelling.shape === "truncated").map(({ key: spelled, tier }) => [spelled, tier]);
  assert.deepEqual(tiers("aver"), [["avere", 0], ["avero", 1]]);
  assert.deepEqual(tiers("han"), [["hane", 0], ["hano", 1], ["hanno", 1]]);
  assert.deepEqual(tiers("ancor"), [["ancora", 0]]);
  assert.deepEqual(tiers("siam"), [["siamo", 0]]);
  assert.deepEqual(tiers("bell"), []);
  assert.deepEqual(tiers("pr"), []);
  assert.deepEqual(tiers("com"), []);
});

test("an absolute superlative names its adjective; -chissimo drops the h (#809)", () => {
  assert.deepEqual(keysOf("bravissimo", "superlative"), ["bravo", "brave"]);
  assert.deepEqual(keysOf("felicissima", "superlative"), ["felico", "felice"]);
  assert.deepEqual(keysOf("ricchissimi", "superlative"), ["ricco"]);
});

test("an agreeing past participle names its masculine singular: piaciuta, piaciuti, valsa (#809)", () => {
  assert.deepEqual(keysOf("piaciute", "participle"), ["piaciuto"]);
  assert.deepEqual(keysOf("piaciuti", "participle"), ["piaciuto"]);
  assert.deepEqual(keysOf("valsa", "participle"), ["valso"]);
});

test("a word of none of the shapes names nothing, and neither does a phrase", () => {
  assert.deepEqual(shapedSpellings("qqqqqq"), []);
  assert.deepEqual(shapedSpellings("sono andata"), []);
  assert.deepEqual(shapedSpellings("vado via"), []);
});

test("no shape's word is a name, an abbreviation, a symbol or a nominal plural; a verb's plural is (#809)", () => {
  for (const shape of ["clitic", "elided", "truncated", "demonstrative", "superlative", "participle", "inflected", "conjugated", "plural-spelling", "english-plural"] as const) {
    assert.equal(shapeAdmits(shape, record("name")), false, shape);
    assert.equal(shapeAdmits(shape, record("abbrev")), false, shape);
    assert.equal(shapeAdmits(shape, record("symbol")), false, shape);
    // Only a plural has another plural spelling.
    if (shape !== "plural-spelling") assert.equal(shapeAdmits(shape, record("adj", true)), false, shape);
  }
  assert.equal(shapeAdmits("truncated", record("verb", true)), true, "devon of devono");
  assert.equal(shapeAdmits("truncated", record("noun")), true, "cuor of cuore");
  assert.equal(shapeAdmits("elided", record("noun")), false, "com' is no coma");
  assert.equal(shapeAdmits("elided", record("verb")), true, "dev' of deve");
  assert.equal(shapeAdmits("clitic", record("noun")), false, "scusami is no scusa the noun");
  assert.equal(shapeAdmits("demonstrative", record("pron")), false, "quei is quello the adjective");
  assert.equal(shapeAdmits("participle", record("verb")), false, "a verb form that is no participle");
  assert.equal(shapeAdmits("participle", record("verb", false, true)), true);
});

test("of each shape the lowest tier with an admitted row answers: capitan is capitano, since capitane is a plural (#809)", () => {
  const rows: Record<string, ShapedRecord[]> = {
    capitane: [record("noun", true), record("adj", true)],
    capitano: [record("noun"), record("verb")],
  };
  const answering = answeringSpellings(shapedSpellings("capitan"), (key) => rows[key] ?? [], (row) => row);
  assert.deepEqual(answering.map(({ spelling }) => spelling.key), ["capitano"]);

  const aver = answeringSpellings(shapedSpellings("aver"), (key) => (key === "avere" || key === "avero" ? [record("verb")] : []), (row) => row);
  assert.deepEqual(aver.map(({ spelling }) => spelling.key), ["avere"]);
});

test("a regular plural or feminine names its word, in tiers: tate tata, follie follia, crucchi crucco, artificieri artificiere, valige valigia, poverina poverino (#809)", () => {
  const tiers = (key: string) => shapedSpellings(key).filter((spelling) => spelling.shape === "inflected").map(({ key: spelled, tier }) => [spelled, tier]);
  assert.deepEqual(tiers("tate"), [["tata", 0], ["tato", 2]]);
  assert.deepEqual(tiers("follie"), [["follia", 0], ["follio", 2]]);
  assert.deepEqual(tiers("crucchi"), [["crucco", 0]]);
  assert.deepEqual(tiers("bianche"), [["bianca", 0], ["bianco", 2]]);
  assert.deepEqual(tiers("fuggitivi"), [["fuggitivo", 0], ["fuggitive", 0], ["fuggitivio", 0]]);
  assert.deepEqual(tiers("artificieri"), [["artificiero", 0], ["artificiere", 0], ["artificierio", 0]]);
  assert.deepEqual(tiers("valige"), [["valiga", 0], ["valigia", 0], ["valigo", 2]]);
  assert.deepEqual(tiers("poverina"), [["poverino", 1]]);
  assert.deepEqual(tiers("ai"), [], "no word of one letter is inflected");
});

test("a regular verb form names its infinitive: fischia fischiare, annette annettere, cerchi cercare, finisce finire (#809)", () => {
  assert.ok(keysOf("fischia", "conjugated").includes("fischiare"));
  assert.ok(keysOf("fischi", "conjugated").includes("fischiare"));
  assert.ok(keysOf("annette", "conjugated").includes("annettere"));
  assert.ok(keysOf("cerchi", "conjugated").includes("cercare"));
  assert.ok(keysOf("cercheremo", "conjugated").includes("cercare"));
  assert.ok(keysOf("finisce", "conjugated").includes("finire"));
  assert.ok(keysOf("parlavano", "conjugated").includes("parlare"));
  assert.ok(keysOf("temettero", "conjugated").includes("temere"));
  assert.ok(keysOf("ama", "conjugated").includes("amare"));
  assert.deepEqual(keysOf("da", "conjugated"), [], "no stem of one letter");
});

test("a -ce or -ge plural names its -cie or -gie spelling, and back: valige valigie, provincie province (#809)", () => {
  assert.deepEqual(keysOf("valige", "plural-spelling"), ["valigie"]);
  assert.deepEqual(keysOf("provincie", "plural-spelling"), ["province"]);
  assert.deepEqual(keysOf("case", "plural-spelling"), []);
});

test("an English plural in -s names its loanword: marines marine, games game, yankees yankee, studios studio (#809)", () => {
  assert.deepEqual(keysOf("marines", "english-plural"), ["marine"]);
  assert.deepEqual(keysOf("games", "english-plural"), ["game"]);
  assert.deepEqual(keysOf("yankees", "english-plural"), ["yankee"]);
  assert.deepEqual(keysOf("studios", "english-plural"), ["studio"]);
  assert.deepEqual(keysOf("cas", "english-plural"), [], "too short");
  assert.deepEqual(keysOf("sig.", "english-plural"), []);
});

test("an inflected or conjugated word is a record that lists no forms; a plural spelling is a plural; an English plural is a noun's (#809)", () => {
  assert.equal(shapeAdmits("inflected", record("noun")), true, "tata lists no forms");
  assert.equal(shapeAdmits("inflected", record("adj")), true, "crucco lists no forms");
  assert.equal(shapeAdmits("inflected", record("noun", false, false, true)), false, "studio lists studi");
  assert.equal(shapeAdmits("inflected", record("verb")), false);
  assert.equal(shapeAdmits("inflected", record("noun"), 1), true, "poverina of poverino, a noun");
  assert.equal(shapeAdmits("inflected", record("noun"), 2), false, "home is no feminine plural of homo");
  assert.equal(shapeAdmits("inflected", record("adj"), 2), true, "fuggitive of fuggitivo");
  assert.equal(shapeAdmits("conjugated", record("verb")), true, "fischiare lists no conjugation");
  assert.equal(shapeAdmits("conjugated", record("verb", false, false, true)), false, "a verb with a table lists its forms");
  assert.equal(shapeAdmits("conjugated", record("noun")), false);
  assert.equal(shapeAdmits("plural-spelling", record("noun", true)), true, "valigie, the plural valigia lists");
  assert.equal(shapeAdmits("plural-spelling", record("noun")), false);
  assert.equal(shapeAdmits("plural-spelling", record("verb", true)), false);
  assert.equal(shapeAdmits("english-plural", record("noun", false, false, true)), true, "studio lists only its Italian plural");
  assert.equal(shapeAdmits("english-plural", record("adj")), false);
});

test("rule it-word-shape-line/v1 says what each shape is of its word, ending with the word: one line per shape (#802)", () => {
  /** The line for `key` read as `word` under `shape`. */
  const lineOf = (key: string, shape: Shape, word: string): string => {
    const spelling = shapedSpellings(key).find((one) => one.shape === shape && one.key === word);
    assert.ok(spelling !== undefined, `${key} is no ${shape} of ${word}`);
    return wordShapeLine(key, spelling);
  };
  assert.equal(lineOf("raccontarvi", "clitic", "raccontare"), "pronome vi unito a raccontare");
  assert.equal(lineOf("aggrapparti", "clitic", "aggrappare"), "pronome ti unito ad aggrappare");
  assert.equal(lineOf("dirglielo", "clitic", "dire"), "pronomi gli e lo uniti a dire");
  assert.equal(lineOf("dammi", "clitic", "da'"), "pronome mi unito a da'");
  assert.equal(lineOf("dicendomi", "clitic", "dicendo"), "pronome mi unito a dicendo");
  assert.equal(lineOf("vergognarti", "clitic", "vergognarsi"), "infinito di vergognarsi");
  assert.equal(lineOf("andartene", "clitic", "andarsene"), "infinito di andarsene");
  assert.equal(lineOf("quell'", "elided", "quello"), "forma elisa di quello");
  assert.equal(lineOf("m'", "elided", "mi"), "forma elisa di mi");
  assert.equal(lineOf("aver", "truncated", "avere"), "forma tronca di avere");
  assert.equal(lineOf("quei", "demonstrative", "quello"), "maschile plurale di quello");
  assert.equal(lineOf("begli", "demonstrative", "bello"), "maschile plurale di bello");
  assert.equal(lineOf("bravissimo", "superlative", "bravo"), "superlativo assoluto di bravo");
  assert.equal(lineOf("piaciuta", "participle", "piaciuto"), "femminile singolare di piaciuto");
  assert.equal(lineOf("piaciuti", "participle", "piaciuto"), "maschile plurale di piaciuto");
  assert.equal(lineOf("piaciute", "participle", "piaciuto"), "femminile plurale di piaciuto");
  assert.equal(lineOf("tate", "inflected", "tata"), "plurale di tata");
  assert.equal(lineOf("crucchi", "inflected", "crucco"), "plurale di crucco");
  assert.equal(lineOf("poverina", "inflected", "poverino"), "femminile singolare di poverino");
  assert.equal(lineOf("fuggitive", "inflected", "fuggitivo"), "femminile plurale di fuggitivo");
  assert.equal(lineOf("fischia", "conjugated", "fischiare"), "voce del verbo fischiare");
  assert.equal(lineOf("valige", "plural-spelling", "valigie"), "variante grafica di valigie");
  assert.equal(lineOf("marines", "english-plural", "marine"), "plurale di marine");
});

test("a regular inflection answers only when no other shape does, and its lowest tier wins: tipe is tipa, piaciute stays the participle (#809)", () => {
  const tipe = answeringSpellings(shapedSpellings("tipe"), (key) => (key === "tipa" ? [record("noun")] : key === "tipo" ? [record("adj")] : []), (row) => row);
  assert.deepEqual(tipe.map(({ spelling }) => `${spelling.shape}:${spelling.key}`), ["inflected:tipa"]);

  const rows: Record<string, ShapedRecord[]> = { piaciuto: [record("verb", false, true), record("adj")] };
  const piaciute = answeringSpellings(shapedSpellings("piaciute"), (key) => rows[key] ?? [], (row) => row);
  assert.deepEqual(piaciute.map(({ spelling }) => `${spelling.shape}:${spelling.key}`), ["participle:piaciuto"]);
});
