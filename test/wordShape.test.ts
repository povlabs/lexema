// Rule `it-word-shape/v1` (#809): the words a typed form is a shape of.
// The words are from the missing-word count
// (reports/2026-10-11-missing-common-words.md); the lookup over them is
// test/wordShapeLookup.test.ts.

import assert from "node:assert/strict";
import test from "node:test";
import { answeringSpellings, shapedSpellings, shapeAdmits, type ShapedRecord, type Shape } from "../src/italian/wordShape.js";

/** The keys the rule names for `key` under `shape`, in its order. */
const keysOf = (key: string, shape: Shape): string[] =>
  shapedSpellings(key)
    .filter((spelling) => spelling.shape === shape)
    .map((spelling) => spelling.key);

const record = (pos: string, plural = false, pastParticiple = false): ShapedRecord => ({ pos, plural, pastParticiple });

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
  for (const shape of ["clitic", "elided", "truncated", "demonstrative", "superlative", "participle"] as const) {
    assert.equal(shapeAdmits(shape, record("name")), false, shape);
    assert.equal(shapeAdmits(shape, record("abbrev")), false, shape);
    assert.equal(shapeAdmits(shape, record("symbol")), false, shape);
    assert.equal(shapeAdmits(shape, record("adj", true)), false, shape);
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
