// The grid's article lines take the record's own IPA for the headword's
// spelling and for no other (#341).

import assert from "node:assert/strict";
import test from "node:test";
import { agreementOf } from "@/lib/dictionary/genderGrid.ts";
import type { CorrectedClaim, GrammarClaim, InflectionOf, Reading, SourceForm, SourceRef, StatedClaim } from "@lexema/lookup/types.ts";

const ref = (jsonPointer: string): SourceRef => ({ releaseId: "it-test", lineNo: 1, jsonPointer, lineSha256: "0".repeat(64) });

const stated = (dimension: string, value: string): StatedClaim => ({
  status: "stated",
  dimension,
  value,
  sourceText: value,
  ref: ref("/tags/0"),
});

/** A noun reading with only what the grid reads: its word, grammar, forms and IPA. */
function noun(word: string, ipas: string[], forms: SourceForm[] = []): Reading {
  return {
    pos: "noun",
    word,
    grammar: { record: [stated("gender", "masculine"), stated("number", "singular")] },
    forms,
    lemmaLinks: [],
    inflections: [],
    wordFacts: { pronunciations: ipas.map((ipa, i) => ({ ipa, note: null, ref: ref(`/sounds/${i}/ipa`) })) },
  } as unknown as Reading;
}

const lines = (reading: Reading): string[][] =>
  agreementOf(reading).grid?.rows.flatMap((row) => row.cells.flatMap((cell) => cell.spellings.map((spelling) => spelling.articles))) ?? [];

test("the headword's article line reads the record's IPA where the spelling leaves the sound open", () => {
  assert.deepEqual(lines(noun("hotel", ["/oˈtɛl/"])), [["l'hotel", "un hotel"]]);
  assert.deepEqual(lines(noun("chef", ["/ʃɛf/"])), [["lo chef", "uno chef"]]);
  assert.deepEqual(lines(noun("hotel", [])), [[]]);
});

test("a form's spelling does not take the headword's IPA", () => {
  const hotels: SourceForm = {
    index: 0,
    surface: "hotels",
    ref: ref("/forms/0/form"),
    formSource: null,
    claims: [stated("gender", "masculine"), stated("number", "plural")],
  };
  assert.deepEqual(lines(noun("hotel", ["/oˈtɛl/"], [hotels])), [["l'hotel", "un hotel"], []]);
});

// A noun's plural from a record that glosses itself "plurale di <word>" (#145).

const lineOf = (lineNo: number, jsonPointer: string): SourceRef => ({ ...ref(jsonPointer), lineNo });

/** A curated correction (#420) of one dimension, standing in for the tags it names. */
const corrected = (dimension: "gender" | "number", value: string, replaces: StatedClaim[] = []): CorrectedClaim => ({
  status: "corrected",
  dimension,
  value,
  correction: { id: "it-test:1", evidenceUrl: "https://en.wiktionary.org/w/index.php?title=x&oldid=1" },
  replaces,
});

/**
 * A record pointing at the noun, with what the lookup read off its gloss and
 * tags. `candidates` is the part of speech of every record the named word
 * resolves to: the noun itself, unless a test says the word is more records.
 */
function declaring(
  word: string,
  lineNo: number,
  plural:
    | {
        glossGender?: "masculine" | "feminine";
        tags?: ("masculine" | "feminine")[];
        /** A correction of the record's gender, in place of its tags. */
        correctedGender?: "masculine" | "feminine";
        correctedNumber?: "singular" | "plural";
      }
    | undefined,
  pos = "noun",
  candidates: string[] = ["noun"],
): InflectionOf {
  return {
    recordId: lineNo,
    word,
    pos,
    refs: [lineOf(lineNo, "/senses/0/form_of/0/word")],
    targetWord: "x",
    targetCandidates: candidates.map((candidatePos, i) => ({ recordId: 1000 + i, word: "x", pos: candidatePos, ref: lineOf(1000 + i, "/word") })),
    plural:
      plural === undefined
        ? undefined
        : {
            gloss: { text: "plurale di x", ref: lineOf(lineNo, "/senses/0/glosses/0") },
            glossGender: plural.glossGender,
            recordGenders:
              plural.correctedGender === undefined
                ? (plural.tags ?? []).map((gender) => ({ ...stated("gender", gender), ref: lineOf(lineNo, "/tags/0") }))
                : [corrected("gender", plural.correctedGender)],
            correctedNumber: plural.correctedNumber === undefined ? undefined : corrected("number", plural.correctedNumber),
          },
  };
}

/** A noun reading stating `genders` and singular, with the given forms and incoming records. */
function nounOf(word: string, genders: string[] | CorrectedClaim, inflections: InflectionOf[], forms: SourceForm[] = [], numbers = ["singular"]): Reading {
  return {
    pos: "noun",
    word,
    grammar: {
      record: [...(Array.isArray(genders) ? genders.map((g) => stated("gender", g)) : [genders]), ...numbers.map((n) => stated("number", n))],
    },
    forms,
    lemmaLinks: [],
    inflections,
    wordFacts: { pronunciations: [] },
  } as unknown as Reading;
}

/** `gender number: spelling@line` for every non-headword spelling in the plain grid. */
const placed = (reading: Reading): string[] =>
  (agreementOf(reading).grid?.rows ?? []).flatMap((row) =>
    row.cells.flatMap((cell, n) =>
      cell.spellings
        .filter((spelling) => !spelling.headword)
        .map((spelling) => `${row.gender} ${n === 0 ? "singular" : "plural"}: ${spelling.surface}@${spelling.declaredBy.map((r) => r.refs[0].lineNo).join(",")}`),
    ),
  );

const pluralForm = (surface: string, claims: GrammarClaim[]): SourceForm => ({
  index: 0,
  surface,
  ref: ref("/forms/0/form"),
  formSource: null,
  claims,
});

test("a declared plural goes in the gender its gloss names, else its tags, else the noun's one gender", () => {
  assert.deepEqual(placed(nounOf("casa", ["feminine"], [declaring("case", 8864, {})])), ["feminine plural: case@8864"]);
  assert.deepEqual(
    placed(nounOf("recluso", ["masculine"], [declaring("recluse", 7, { glossGender: "feminine", tags: ["masculine"] })])),
    ["feminine plural: recluse@7"],
  );
  assert.deepEqual(placed(nounOf("cantante", [], [declaring("cantanti", 9, { tags: ["masculine", "feminine"] })])), [
    "masculine plural: cantanti@9",
    "feminine plural: cantanti@9",
  ]);
  // The record states no gender and neither does the noun, or it states two: no cell.
  assert.deepEqual(placed(nounOf("x", [], [declaring("xs", 3, {})])), []);
  assert.deepEqual(placed(nounOf("fine", ["masculine", "feminine"], [declaring("fini", 4, {})])), []);
});

test("only a noun record's plural gloss fills a cell: a diminutive or another part of speech does not", () => {
  const casa = nounOf("casa", ["feminine"], [declaring("casetta", 2, undefined), declaring("case", 1, { tags: ["feminine"] }, "adj")]);
  assert.deepEqual(placed(casa), []);
  // A verb or an adjective reading takes none either.
  const adjective = { ...nounOf("bello", ["masculine"], [declaring("belli", 5, {})]), pos: "adj" } as unknown as Reading;
  assert.deepEqual(placed(adjective).filter((cell) => cell.includes("@5")), []);
});

test("a declared plural fills a cell only when one noun record spells the word it names", () => {
  // `temi` says "plurale di tema", and `tema` is two noun records: neither takes it.
  const temi = declaring("temi", 7, { tags: ["masculine"] }, "noun", ["noun", "noun", "verb"]);
  assert.deepEqual(placed(nounOf("tema", ["feminine"], [temi])), []);
  assert.deepEqual(placed(nounOf("tema", ["masculine"], [temi])), []);
  // A record of another part of speech spelling the word does not make it two.
  const altruiste = declaring("altruiste", 8, { tags: ["feminine"] }, "noun", ["adj", "noun"]);
  assert.deepEqual(placed(nounOf("altruista", ["masculine"], [altruiste])), ["feminine plural: altruiste@8"]);
});

test("a record's own plural always wins, and a declared plural changes no other cell", () => {
  const studenti = pluralForm("studenti", [stated("gender", "masculine"), stated("number", "plural")]);
  assert.deepEqual(placed(nounOf("studente", ["masculine"], [declaring("studenti", 6, {})], [studenti])), [
    "masculine plural: studenti@",
  ]);
  // A plural form with no gender still is the record's plural (`fine` lists `fini`).
  const fini = pluralForm("fini", [stated("number", "plural")]);
  assert.deepEqual(placed(nounOf("fine", ["masculine", "feminine"], [declaring("fini", 6, { tags: ["masculine"] })], [fini])), []);
  // So is the headword of a record that states plural or invariable.
  assert.deepEqual(placed(nounOf("forbici", ["feminine"], [declaring("forbicis", 6, {})], [], ["plural"])), []);
  assert.deepEqual(placed(nounOf("città", ["feminine"], [declaring("cittàs", 6, {})], [], ["invariable"])), []);
  // casa's singular cell keeps only its headword.
  const grid = agreementOf(nounOf("casa", ["feminine"], [declaring("case", 8864, {})])).grid;
  assert.deepEqual(
    grid?.rows.map((row) => row.cells.map((cell) => cell.spellings.map((s) => s.surface))),
    [[["casa"], ["case"]]],
  );
});

// Curated corrections (#420): a fact the source states wrongly, set right in the master.

test("a correction of the declaring record's gender outranks its tags and its gloss", () => {
  // `giocatrici` is tagged masculine; corrected, it is giocatrice's femminile plurale.
  assert.deepEqual(placed(nounOf("giocatrice", ["feminine"], [declaring("giocatrici", 423567, { tags: ["masculine"], correctedGender: "feminine" })])), [
    "feminine plural: giocatrici@423567",
  ]);
  assert.deepEqual(placed(nounOf("x", ["feminine"], [declaring("xs", 2, { glossGender: "masculine", correctedGender: "feminine" })])), ["feminine plural: xs@2"]);
});

test("a correction of the declaring record's number overrides the gloss's plurale", () => {
  // `ammaliatrice` glosses itself "plurale di ammaliatore" and is its femminile singolare.
  const grid = agreementOf(nounOf("ammaliatore", ["masculine"], [declaring("ammaliatrice", 449969, { tags: ["feminine"], correctedNumber: "singular" })])).grid;
  assert.deepEqual(
    grid?.rows.map((row) => [row.gender, row.cells.map((cell) => cell.spellings.map((s) => [s.surface, ...s.articles]))]),
    [
      ["masculine", [[["ammaliatore", "l'ammaliatore", "un ammaliatore"]], []]],
      ["feminine", [[["ammaliatrice", "l'ammaliatrice", "un'ammaliatrice"]], []]],
    ],
  );
});

test("a correction of the noun's own gender places its headword by it", () => {
  // `fissazione` is tagged masculine; `fissazioni` is tagged feminine.
  const fissazione = nounOf("fissazione", corrected("gender", "feminine", [stated("gender", "masculine")]), [declaring("fissazioni", 97083, { tags: ["feminine"] })]);
  assert.deepEqual(
    agreementOf(fissazione).grid?.rows.map((row) => [row.gender, row.cells.map((cell) => cell.spellings.map((s) => s.surface))]),
    [["feminine", [["fissazione"], ["fissazioni"]]]],
  );
});
