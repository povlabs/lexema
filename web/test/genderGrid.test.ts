// The grid's article lines take the record's own IPA for the headword's
// spelling and for no other (#341), and a headword whose record states no
// gender fills the singolare cells its forms leave open (#909), and the line
// may break between its two articles (#913).

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { seedSql } from "../../src/import/seedSql.js";
import { lookup } from "../../src/lookup/lookup.js";
import { readOnlyDictionary } from "../../test/databases.js";
import { GridView } from "@/components/dictionary/Forms";
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

// A headword whose record states no gender (#909). The records are verbatim
// archive lines of it-0c432803, in fixtures/headword-singular-cells.jsonl:
// 106 `rosso`, 853 `indispensabile`, 8557 `altro`, 48158 `caratteristica`,
// 49700 `fascista`, 102015 `altrettanto` and 139659 `caratteristico`, each
// the word's adjective record.

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const RELEASE = "it-headword-singular-cells";

let dir: string;
let db: DatabaseSync;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "lexema-headword-singular-cells-"));
  const archive = join(dir, "fixture.jsonl.gz");
  await writeFile(archive, gzipSync(await readFile(join(REPO, "fixtures/headword-singular-cells.jsonl"))));
  const { parts } = await seedSql({
    input: archive,
    outputDir: join(dir, "sql"),
    schema: join(REPO, "src/db/schema.sql"),
    releaseId: RELEASE,
    license: "CC-BY-SA-4.0",
    onRejection: (rejection) => {
      throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
    },
  });
  db = new DatabaseSync(":memory:");
  for (const part of parts) db.exec(await readFile(part, "utf8"));
});

after(async () => {
  db.close();
  await rm(dir, { recursive: true, force: true });
});

async function adjective(word: string): Promise<Reading> {
  const result = await lookup({ db: readOnlyDictionary(db), releaseId: RELEASE, query: word });
  assert.ok(result.outcome === "found", word);
  const reading = result.readings.find((candidate) => candidate.word === word && candidate.pos === "adj");
  assert.ok(reading !== undefined, word);
  return reading;
}

/** Each cell of the plain grid as `gender number`, mapped to its spellings: `surface` and its article line, `*` marking the headword. */
function cellsOf(reading: Reading): Record<string, string[][]> {
  const cells: Record<string, string[][]> = {};
  for (const row of agreementOf(reading).grid?.rows ?? []) {
    for (const [i, number] of (["singular", "plural"] as const).entries()) {
      cells[`${row.gender} ${number}`] = row.cells[i].spellings.map((s) => [`${s.surface}${s.headword ? "*" : ""}`, ...s.articles]);
    }
  }
  return cells;
}

test("an -o adjective whose record states no gender is its own maschile singolare: altrettanto, altro", async () => {
  assert.deepEqual(cellsOf(await adjective("altrettanto")), {
    "masculine singular": [["altrettanto*", "l'altrettanto", "un altrettanto"]],
    "masculine plural": [["altrettanti", "gli altrettanti", "degli altrettanti"]],
    "feminine singular": [["altrettanta", "l'altrettanta", "un'altrettanta"]],
    "feminine plural": [["altrettante", "le altrettante", "delle altrettante"]],
  });
  assert.deepEqual(cellsOf(await adjective("altro"))["masculine singular"], [["altro*", "l'altro", "un altro"]]);
});

test("an adjective whose forms are only plurals fills both singolare cells: indispensabile, fascista", async () => {
  assert.deepEqual(cellsOf(await adjective("indispensabile")), {
    "masculine singular": [["indispensabile*", "l'indispensabile", "un indispensabile"]],
    "masculine plural": [["indispensabili", "gli indispensabili", "degli indispensabili"]],
    "feminine singular": [["indispensabile*", "l'indispensabile", "un'indispensabile"]],
    "feminine plural": [["indispensabili", "le indispensabili", "delle indispensabili"]],
  });
  assert.deepEqual(cellsOf(await adjective("fascista")), {
    "masculine singular": [["fascista*", "il fascista", "un fascista"]],
    "masculine plural": [["fascisti", "i fascisti", "dei fascisti"]],
    "feminine singular": [["fascista*", "la fascista", "una fascista"]],
    "feminine plural": [["fasciste", "le fasciste", "delle fasciste"]],
  });
});

test("a record that states its gender keeps its grid: rosso", async () => {
  assert.deepEqual(cellsOf(await adjective("rosso")), {
    "masculine singular": [["rosso*", "il rosso", "un rosso"]],
    "masculine plural": [["rossi", "i rossi", "dei rossi"]],
    "feminine singular": [["rossa", "la rossa", "una rossa"]],
    "feminine plural": [["rosse", "le rosse", "delle rosse"]],
  });
});

test("a form reading gains no headword cell: caratteristica, a form of caratteristico", async () => {
  const caratteristica = await adjective("caratteristica");
  assert.ok(caratteristica.lemmaLinks.length > 0);
  assert.deepEqual(cellsOf(caratteristica), {
    "masculine singular": [["caratteristico", "il caratteristico", "un caratteristico"]],
    "masculine plural": [["caratteristici", "i caratteristici", "dei caratteristici"]],
    "feminine singular": [],
    "feminine plural": [["caratteristiche", "le caratteristiche", "delle caratteristiche"]],
  });
});

// On a wide screen `l'indispensabile · un'indispensabile` is wider than its
// cell, and neither article has a space to break at (#913). The rendered line
// offers its break after the dot, between the two articles, so it wraps inside
// its cell instead of running into the plurale cell.
test("each article line of indispensabile's grid may break between its two articles", async () => {
  const reading = await adjective("indispensabile");
  const grid = agreementOf(reading).grid;
  assert.ok(grid !== undefined);
  // The page's text, with `|` where the markup lets the line break.
  const text = renderToStaticMarkup(createElement(GridView, { grid, label: "Forme" }))
    .replace(/<wbr\/?>/g, "|")
    .replace(/<[^>]*>/g, "")
    .replace(/&#x27;/g, "'");
  const lines = grid.rows.flatMap((row) => row.cells.flatMap((cell) => cell.spellings.map((spelling) => spelling.articles)));
  assert.deepEqual(lines[2], ["l'indispensabile", "un'indispensabile"]);
  for (const [first, second] of lines) assert.ok(text.includes(`${first}·|${second}`), `${first} · ${second} has no break between its articles`);
});
