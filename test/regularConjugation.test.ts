// Rule `it-regular-conjugation/v1` (#838): the regular class of a pronominal
// verb whose base verb has no record with a table, read only off what the
// source shows, and the base cells of that class.
//
// The pinned `{{It-conj}}` calls are the module the page reads
// (src/italian/conjugationTemplateCalls.ts). The records are verbatim lines of
// it-0c432803 in fixtures/pronominal-verb-tables.jsonl: 448681 `pentirsi`,
// 768 `appisolarsi`, 90544 `obliarsi`, 264711 `traversi`, 422393 `accertare`
// (a record with no forms), 442416 `riarsi`, 449227 `smentirsi`, 456263
// `accertarsi` and 596085 `abbuffarsi`. The regular tables are checked against
// whole source tables of the same classes in fixtures/dev-seed.jsonl.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { CONJUGATION_TEMPLATE_CALLS } from "../src/italian/conjugationTemplateCalls.js";
import { personOfItalianVerbForm, placeItalianVerbForm, type TenseBox, type VerbFormTags } from "../src/italian/moods.js";
import { pronominalSpellings, pronominalVerb, type PronominalVerb } from "../src/italian/pronominalConjugation.js";
import {
  conjugationPageOf,
  REGULAR_CONJUGATION_RULE,
  regularCells,
  regularClassOf,
  type ClassAnswer,
  type ConjugationClass,
  type SettledClass,
} from "../src/italian/regularConjugation.js";

interface RawRecord {
  word: string;
  pos: string;
  lang_code?: string;
  forms?: { form: string; tags?: string[]; raw_tags?: string[] }[];
  senses?: { glosses?: string[] }[];
}

const recordsOf = async (fixture: string): Promise<RawRecord[]> =>
  (await readFile(new URL(`../fixtures/${fixture}`, import.meta.url), "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as RawRecord);

const PRONOMINAL = await recordsOf("pronominal-verb-tables.jsonl");
const DEV_SEED = await recordsOf("dev-seed.jsonl");

const verbOf = (word: string): PronominalVerb => {
  const verb = pronominalVerb(word);
  assert.ok(verb !== undefined, word);
  return verb;
};

/** A fixture record's glosses, as its page reads them: the missing-definition notice is none. */
const glossesOf = (word: string): string[] => {
  const record = PRONOMINAL.find((one) => one.word === word && one.pos === "verb");
  assert.ok(record !== undefined, `the fixture has ${word}'s verb record`);
  return (record.senses ?? []).flatMap((sense) => (sense.glosses ?? []).filter((gloss) => gloss !== "definizione mancante; se vuoi, aggiungila tu"));
};

const classOf = (word: string): ClassAnswer => regularClassOf(verbOf(word), glossesOf(word), CONJUGATION_TEMPLATE_CALLS);

const settledOf = (word: string): SettledClass => {
  const answer = classOf(word);
  assert.ok(answer.kind === "settled", `${word}: ${JSON.stringify(answer)}`);
  return answer;
};

/** The cell a form fills: its tense or imperative and row, or its non-finite role. */
function slotKey(tags: VerbFormTags): string | undefined {
  const slot = placeItalianVerbForm(tags);
  if (slot.kind === "auxiliary") return "ausiliare";
  if (slot.kind === "non-finite") return slot.role;
  if (slot.kind !== "tense" && slot.kind !== "imperative") return undefined;
  const row = personOfItalianVerbForm(tags);
  return row === undefined ? undefined : `${slot.kind === "tense" ? slot.box : "imperativo"} ${row.person} ${row.number}`;
}

/** The pronominal table the two rules build for `word`, by cell. */
function builtTable(word: string): Map<string, string[]> {
  const cells = regularCells(settledOf(word));
  const built = pronominalSpellings(verbOf(word), cells);
  const table = new Map<string, string[]>();
  cells.forEach((cell, i) => {
    const key = slotKey(cell);
    const spelling = built[i];
    if (key !== undefined && spelling !== undefined) table.set(key, [...(table.get(key) ?? []), spelling]);
  });
  return table;
}

const column = (table: Map<string, string[]>, box: TenseBox | "imperativo"): string[] =>
  ["first singular", "second singular", "third singular", "first plural", "second plural", "third plural"].flatMap((row) => table.get(`${box} ${row}`) ?? []);

test("pentirsi's class is its own {{It-conj}} call's, the third conjugation without -isc-: mi pento, ti penti, pentiti, mi sono pentito (#838)", () => {
  assert.equal(REGULAR_CONJUGATION_RULE, "it-regular-conjugation/v1");
  const settled = settledOf("pentirsi");
  assert.equal(settled.conjugationClass, "ire");
  assert.equal(settled.base, "pentire");
  assert.ok(settled.evidence.kind === "template");
  assert.equal(settled.evidence.page.title, "Appendice:Coniugazioni/Italiano/pentirsi");
  assert.equal(settled.evidence.page.call, "{{It-conj|pent|irsi|essere}}");

  const table = builtTable("pentirsi");
  assert.deepEqual(column(table, "presente"), ["mi pento", "ti penti", "si pente", "ci pentiamo", "vi pentite", "si pentono"]);
  assert.deepEqual(column(table, "passato prossimo"), ["mi sono pentito", "ti sei pentito", "si è pentito", "ci siamo pentiti", "vi siete pentiti", "si sono pentiti"]);
  assert.deepEqual(column(table, "imperativo"), ["pentiti", "non pentirti", "si penta", "pentiamoci", "pentitevi", "si pentano"]);
  assert.deepEqual(column(table, "passato remoto")[2], "si pentì");
  assert.deepEqual(table.get("ausiliare"), ["essere"]);
  assert.deepEqual(table.get("gerundio"), ["pentendosi"]);
  assert.ok(![...table.values()].flat().some((spelling) => spelling.includes("pentisc")), "never pentisco");
});

test("accertarsi takes accertare's call, though accertare's record has no forms: mi accerto, ci siamo accertati (#838)", () => {
  const accertare = PRONOMINAL.find((one) => one.word === "accertare");
  assert.ok(accertare !== undefined && (accertare.forms ?? []).length === 0, "accertare's record has no table");
  const settled = settledOf("accertarsi");
  assert.equal(settled.conjugationClass, "are");
  assert.ok(settled.evidence.kind === "template");
  assert.equal(settled.evidence.page.call, "{{It-conj|accert|are|avere}}");
  const table = builtTable("accertarsi");
  assert.equal(column(table, "presente")[0], "mi accerto");
  assert.equal(column(table, "passato prossimo")[3], "ci siamo accertati");
  assert.equal(column(table, "futuro semplice")[0], "mi accerterò");
  assert.deepEqual(column(table, "imperativo").slice(0, 2), ["accertati", "non accertarti"]);
});

test("abbuffarsi and appisolarsi, with no call, take the first conjugation from the ending: mi abbuffo, mi appisolo (#838)", () => {
  for (const [word, stem] of [
    ["abbuffarsi", "abbuff"],
    ["appisolarsi", "appisol"],
  ] as const) {
    const settled = settledOf(word);
    assert.equal(settled.conjugationClass, "are", word);
    assert.deepEqual(settled.evidence, { kind: "ending", base: `${stem}are`, ending: "-are" });
    for (const one of [word, ...verbOf(word).bases]) assert.equal(CONJUGATION_TEMPLATE_CALLS[conjugationPageOf(one)], undefined, one);
    const table = builtTable(word);
    assert.deepEqual(column(table, "presente"), [`mi ${stem}o`, `ti ${stem}i`, `si ${stem}a`, `ci ${stem}iamo`, `vi ${stem}ate`, `si ${stem}ano`]);
    assert.equal(column(table, "passato prossimo")[0], `mi sono ${stem}ato`);
    assert.equal(column(table, "congiuntivo presente")[5], `si ${stem}ino`);
  }
});

test("smentirsi takes smentire's call, the -isc- third conjugation: mi smentisco, smentisciti (#838)", () => {
  const settled = settledOf("smentirsi");
  assert.equal(settled.conjugationClass, "ire-b");
  const table = builtTable("smentirsi");
  assert.deepEqual(column(table, "presente"), ["mi smentisco", "ti smentisci", "si smentisce", "ci smentiamo", "vi smentite", "si smentiscono"]);
  assert.equal(column(table, "imperativo")[0], "smentisciti");
});

test("a verb the source does not settle gets no class: obliarsi's i may be stressed (#838)", () => {
  assert.deepEqual(classOf("obliarsi"), { kind: "declined", reason: "iare-stress" });
});

test("each reason the rule declines, on real words (#838)", () => {
  const decline = (word: string, glosses: string[] = []) => regularClassOf(verbOf(word), glosses, CONJUGATION_TEMPLATE_CALLS);
  // -ire with no call: -isc- or not, the ending does not say.
  for (const word of ["impadronirsi", "susseguirsi", "appassirsi"]) assert.deepEqual(decline(word), { kind: "declined", reason: "ire-isc" }, word);
  // The second conjugation's passato remoto and participle are the verb's own.
  for (const word of ["avvedersi", "ravvedersi", "imbattersi"]) assert.deepEqual(decline(word), { kind: "declined", reason: "second-conjugation" }, word);
  // Verbs made on fare, dare, andare, stare and trarre.
  for (const word of ["assuefarsi", "stupefarsi", "sdarsi", "inostrarsi", "riandarsi", "ristarsi"]) {
    assert.deepEqual(decline(word), { kind: "declined", reason: "irregular-family" }, word);
  }
  // A call that overrides a form settles nothing here.
  const prefiggersi = decline("prefiggersi");
  assert.ok(prefiggersi.kind === "declined" && prefiggersi.reason === "template-not-read");
  assert.equal(prefiggersi.page?.title, "Appendice:Coniugazioni/Italiano/prefiggere");
  // Another -iare, with no call: stressed or not, the ending does not say.
  for (const word of ["incacchiarsi", "infischiarsi", "appollaiarsi"]) assert.deepEqual(decline(word), { kind: "declined", reason: "iare-stress" }, word);
  // A regular verb whose ending looks like a family's is still regular.
  for (const word of ["accodarsi", "abbuffarsi", "rattristarsi"]) assert.equal(decline(word).kind, "settled", word);
});

test("a record whose glosses say it is a form of another verb gets no class: traversi, riarsi (#838)", () => {
  assert.deepEqual(classOf("traversi"), { kind: "declined", reason: "form-of-another-word" });
  assert.deepEqual(classOf("riarsi"), { kind: "declined", reason: "form-of-another-word" });
  // The glosses are read before the ending; one gloss that names no form is enough to read the ending instead.
  assert.deepEqual(regularClassOf(verbOf("traversi"), [...glossesOf("traversi"), "mettersi di traverso"], CONJUGATION_TEMPLATE_CALLS), {
    kind: "declined",
    reason: "second-conjugation",
  });
});

test("the pinned calls are It-conj calls of Appendice pages, each under its own title (#838)", () => {
  const pages = Object.entries(CONJUGATION_TEMPLATE_CALLS);
  assert.ok(pages.length > 40);
  for (const [title, page] of pages) {
    assert.equal(page.title, title);
    assert.match(title, /^Appendice:Coniugazioni\/Italiano\/\p{Ll}+$/u);
    assert.match(page.call, /^\{\{It-conj\|[\s\S]*\}\}$/u);
    assert.ok(Number.isInteger(page.revisionId) && page.revisionId > 0 && !Number.isNaN(Date.parse(page.timestamp)), title);
  }
});

test("each class's cells are the ones a whole source table of that class holds, cell for cell, in the dev seed (#838)", () => {
  const cases: readonly [string, ConjugationClass, string][] = [
    ["parlare", "are", "parl"],
    ["unificare", "care", "unific"],
    ["litigare", "gare", "litig"],
    ["slanciare", "ciare", "slanc"],
    ["mangiare", "giare", "mang"],
    ["studiare", "iare", "studi"],
    ["vestire", "ire", "vest"],
    ["rimbambire", "ire-b", "rimbamb"],
  ];
  for (const [word, conjugationClass, stem] of cases) {
    const record = DEV_SEED.find((one) => one.word === word && one.pos === "verb" && one.lang_code === "it" && (one.forms ?? []).length > 0);
    assert.ok(record !== undefined, `the dev seed has ${word}'s table`);
    const source = new Map<string, Set<string>>();
    for (const form of record.forms ?? []) {
      const key = slotKey({ tags: form.tags ?? [], rawTags: form.raw_tags ?? [] });
      if (key !== undefined) source.set(key, new Set([...(source.get(key) ?? []), ...form.form.split(", ")]));
    }
    const cells = regularCells({ kind: "settled", conjugationClass, stem, base: word, evidence: { kind: "ending", base: word, ending: "-are" } });
    const built = new Map<string, Set<string>>();
    for (const cell of cells) {
      const key = slotKey(cell);
      assert.ok(key !== undefined, `${word}: ${cell.spelling} has a cell`);
      built.set(key, new Set([...(built.get(key) ?? []), cell.spelling]));
    }
    // The auxiliary is the verb's own, the call's third parameter; a pronominal table's is essere whatever it is.
    // So a verb on essere (slanciare) is compared in its simple tenses only.
    assert.deepEqual([...(built.get("ausiliare") ?? [])], ["avere"], word);
    const onEssere = source.get("ausiliare")?.has("essere") === true;
    const isCompound = (key: string) => !key.startsWith("imperativo") && [...(built.get(key) ?? [])].some((one) => one.includes(" "));
    const compared = (keys: Iterable<string>) =>
      [...keys].filter((key) => key !== "infinito" && key !== "ausiliare" && !(onEssere && isCompound(key))).sort();
    assert.deepEqual(compared(built.keys()), compared(source.keys()), word);
    for (const key of compared(built.keys())) assert.deepEqual([...(built.get(key) ?? [])].sort(), [...(source.get(key) ?? [])].sort(), `${word} ${key}`);
  }
});
