// Rule `it-regular-conjugation/v1` (#838): the regular class of a pronominal
// verb whose base verb has no record with a table, read only off what the
// source shows, and the base cells of that class.
//
// The pinned `{{It-conj}}` calls are the module the page reads
// (src/italian/conjugationTemplateCalls.ts). The records are verbatim lines of
// it-0c432803 in fixtures/pronominal-verb-tables.jsonl: 448681 `pentirsi`,
// 768 `appisolarsi`, 90544 `obliarsi`, 264711 `traversi`, 422393 `accertare`
// (a record with no forms), 442416 `riarsi`, 449227 `smentirsi`, 456263
// `accertarsi` and 596085 `abbuffarsi` (and pentirsi's form records 595530,
// 596003 and 597777, which the page tests read). The regular tables are checked against
// whole source tables of the same classes in fixtures/dev-seed.jsonl.
//
// A verb that is not pronominal takes its class from its own page's call alone
// (`ownClassOf`, #841): the verb records of fixtures/base-verb-regular-tables.jsonl,
// verbatim lines of it-0c432803, none of which has forms.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { CONJUGATION_TEMPLATE_CALLS } from "../src/italian/conjugationTemplateCalls.js";
import { personOfItalianVerbForm, placeItalianVerbForm, type TenseBox, type VerbFormTags } from "../src/italian/moods.js";
import { pronominalSpellings, pronominalVerb, type PronominalVerb } from "../src/italian/pronominalConjugation.js";
import {
  conjugationPageOf,
  ownClassOf,
  REGULAR_CONJUGATION_RULE,
  regularCells,
  regularClassOf,
  type ClassAnswer,
  tableAuxiliaryOf,
  type ConjugationClass,
  type PinnedTemplateCall,
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
const BASE_VERBS = await recordsOf("base-verb-regular-tables.jsonl");
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

test("each class's cells, on each auxiliary, are the ones a whole source table of that class holds, cell for cell, in the dev seed (#838, #873)", () => {
  // The auxiliary is the record's own, the call's third parameter as the record's table spells it:
  // essere for slanciare, partire and rimbambire; avere and essere for finire and rinsavire.
  const cases: readonly [string, ConjugationClass, string][] = [
    ["parlare", "are", "parl"],
    ["unificare", "care", "unific"],
    ["litigare", "gare", "litig"],
    ["slanciare", "ciare", "slanc"],
    ["mangiare", "giare", "mang"],
    ["studiare", "iare", "studi"],
    ["vestire", "ire", "vest"],
    ["partire", "ire", "part"],
    ["rimbambire", "ire-b", "rimbamb"],
    ["finire", "ire-b", "fin"],
    ["rinsavire", "ire-b", "rinsav"],
  ];
  const auxiliaries = new Set<string>();
  for (const [word, conjugationClass, stem] of cases) {
    const record = DEV_SEED.find((one) => one.word === word && one.pos === "verb" && one.lang_code === "it" && (one.forms ?? []).length > 0);
    assert.ok(record !== undefined, `the dev seed has ${word}'s table`);
    const source = new Map<string, Set<string>>();
    for (const form of record.forms ?? []) {
      const key = slotKey({ tags: form.tags ?? [], rawTags: form.raw_tags ?? [] });
      if (key !== undefined) source.set(key, new Set([...(source.get(key) ?? []), ...form.form.split(", ")]));
    }
    const named = [...(source.get("ausiliare") ?? [])].join(", ");
    const auxiliary = tableAuxiliaryOf(named);
    assert.ok(auxiliary !== undefined, `${word}: ${named}`);
    auxiliaries.add(auxiliary.kind);
    const cells = regularCells({ kind: "settled", conjugationClass, stem, base: word, auxiliary, evidence: { kind: "ending", base: word, ending: "-are" } });
    const built = new Map<string, Set<string>>();
    for (const cell of cells) {
      const key = slotKey(cell);
      assert.ok(key !== undefined, `${word}: ${cell.spelling} has a cell`);
      built.set(key, new Set([...(built.get(key) ?? []), cell.spelling]));
    }
    const compared = (keys: Iterable<string>) => [...keys].filter((key) => key !== "infinito").sort();
    assert.deepEqual(compared(built.keys()), compared(source.keys()), word);
    for (const key of compared(built.keys())) assert.deepEqual([...(built.get(key) ?? [])].sort(), [...(source.get(key) ?? [])].sort(), `${word} ${key}`);
  }
  assert.deepEqual([...auxiliaries].sort(), ["avere", "both", "essere"]);
});

/** What `ownClassOf` answers for a verb record of the base-verb fixture, read off its own glosses. */
function ownClassOfRecord(word: string): ClassAnswer {
  const record = BASE_VERBS.find((one) => one.word === word && one.pos === "verb" && (one.forms ?? []).length === 0);
  assert.ok(record !== undefined, `the fixture has ${word}'s verb record, with no forms`);
  return ownClassOf(word, (record.senses ?? []).flatMap((sense) => sense.glosses ?? []), CONJUGATION_TEMPLATE_CALLS);
}

/** The simple present a settled class's cells spell, io to loro. */
const presentOf = (settled: SettledClass): string[] =>
  regularCells(settled)
    .filter((cell) => slotKey(cell)?.startsWith("presente ") === true)
    .map((cell) => cell.spelling);

test("a verb that is not pronominal takes the class its own page's call settles: verificare, stampare, ingraziare, seccare, accudire (#841)", () => {
  const cases: readonly [string, ConjugationClass, string[]][] = [
    ["verificare", "care", ["verifico", "verifichi", "verifica", "verifichiamo", "verificate", "verificano"]],
    ["stampare", "are", ["stampo", "stampi", "stampa", "stampiamo", "stampate", "stampano"]],
    ["ingraziare", "iare", ["ingrazio", "ingrazi", "ingrazia", "ingraziamo", "ingraziate", "ingraziano"]],
    ["seccare", "care", ["secco", "secchi", "secca", "secchiamo", "seccate", "seccano"]],
  ];
  for (const [word, conjugationClass, present] of cases) {
    const answer = ownClassOfRecord(word);
    assert.ok(answer.kind === "settled", `${word}: ${JSON.stringify(answer)}`);
    assert.equal(answer.conjugationClass, conjugationClass, word);
    assert.equal(answer.base, word);
    assert.ok(answer.evidence.kind === "template" && answer.evidence.page.title === conjugationPageOf(word), word);
    assert.deepEqual(presentOf(answer), present, word);
  }
  // `accudire` has no fixture record; its call alone settles the -isc- class.
  const accudire = ownClassOf("accudire", [], CONJUGATION_TEMPLATE_CALLS);
  assert.ok(accudire.kind === "settled" && accudire.conjugationClass === "ire-b");
  assert.deepEqual(presentOf(accudire), ["accudisco", "accudisci", "accudisce", "accudiamo", "accudite", "accudiscono"]);
});

test("care and ciare take a stem in g, as Modulo:It-conj writes them: vangare vanghi, conteggiare conteggerò (#841)", () => {
  const vangare = ownClassOfRecord("vangare");
  assert.ok(vangare.kind === "settled" && vangare.evidence.kind === "template" && vangare.evidence.page.call === "{{It-conj|vang|care|avere}}");
  assert.deepEqual(presentOf(vangare), ["vango", "vanghi", "vanga", "vanghiamo", "vangate", "vangano"]);
  const conteggiare = ownClassOfRecord("conteggiare");
  assert.ok(conteggiare.kind === "settled" && conteggiare.evidence.kind === "template" && conteggiare.evidence.page.call === "{{It-conj|contegg|ciare|avere}}");
  assert.deepEqual(presentOf(conteggiare), ["conteggio", "conteggi", "conteggia", "conteggiamo", "conteggiate", "conteggiano"]);
  assert.ok(regularCells(conteggiare).some((cell) => cell.spelling === "conteggerò"));
});

test("each reason ownClassOf declines, on real words (#841)", () => {
  // A call that overrides a form, or names the second conjugation.
  for (const word of ["prefiggere", "rivendere"]) {
    const answer = ownClassOfRecord(word);
    assert.ok(answer.kind === "declined" && answer.reason === "template-not-read" && answer.page?.title === conjugationPageOf(word), word);
  }
  // A call naming neither auxiliary: of the release's pinned calls none does, so the call here is made up.
  const parlare: PinnedTemplateCall = { title: conjugationPageOf("parlare"), revisionId: 0, timestamp: "", call: "{{It-conj|parl|are}}" };
  assert.deepEqual(ownClassOf("parlare", [], { [parlare.title]: parlare }), { kind: "declined", reason: "auxiliary-not-read", page: parlare });
  // No call pinned for its own page: the ending alone settles nothing for such a verb.
  assert.deepEqual(ownClassOf("parlottare", [], CONJUGATION_TEMPLATE_CALLS), { kind: "declined", reason: "no-own-call" });
  // A call on a base verb's page is no call of a pronominal verb's own.
  assert.deepEqual(ownClassOf("accertarsi", [], CONJUGATION_TEMPLATE_CALLS), { kind: "declined", reason: "no-own-call" });
  // A record whose every gloss names the verb it is a form of.
  assert.deepEqual(ownClassOf("verificare", ["prima persona singolare dell'indicativo presente di verificare"], CONJUGATION_TEMPLATE_CALLS), {
    kind: "declined",
    reason: "form-of-another-word",
  });
});

test("a call naming essere, or both auxiliaries, settles the class with its compound tenses on what it names: affaticare, scolare, and the other fifteen (#873)", () => {
  const affaticare = ownClassOfRecord("affaticare");
  assert.ok(affaticare.kind === "settled" && affaticare.evidence.kind === "template" && affaticare.evidence.page.call === "{{It-conj|affatic|care|essere}}");
  assert.deepEqual(affaticare.auxiliary, { kind: "essere" });
  const affaticareCells = regularCells(affaticare);
  assert.deepEqual(
    affaticareCells.filter((cell) => slotKey(cell)?.startsWith("passato prossimo ") === true).map((cell) => cell.spelling),
    ["sono affaticato", "sei affaticato", "è affaticato", "siamo affaticati", "siete affaticati", "sono affaticati"],
  );
  assert.deepEqual(affaticareCells.filter((cell) => slotKey(cell) === "ausiliare").map((cell) => cell.spelling), ["essere"]);

  const scolare = ownClassOfRecord("scolare");
  assert.ok(scolare.kind === "settled" && scolare.evidence.kind === "template" && scolare.evidence.page.call === "{{It-conj|scol|are|avere, come intr. essere}}");
  assert.deepEqual(scolare.auxiliary, { kind: "both", named: "avere, come intr. essere" });
  const scolareCells = regularCells(scolare);
  // Each cell holds the avere spelling, then the essere one, as Modulo:It-conj writes them.
  assert.deepEqual(
    scolareCells.filter((cell) => slotKey(cell)?.startsWith("congiuntivo trapassato ") === true).map((cell) => cell.spelling),
    [
      "avessi scolato",
      "fossi scolato",
      "avessi scolato",
      "fossi scolato",
      "avesse scolato",
      "fosse scolato",
      "avessimo scolato",
      "fossimo scolati",
      "aveste scolato",
      "foste scolati",
      "avessero scolato",
      "fossero scolati",
    ],
  );
  assert.deepEqual(scolareCells.filter((cell) => slotKey(cell) === "ausiliare").map((cell) => cell.spelling), ["avere", "come intr. essere"]);
  // Every cell has a place of its own in the table.
  assert.equal(new Set(scolareCells.map((cell) => cell.index)).size, scolareCells.length);

  // The seventeen words of reports/2026-10-17-base-verb-regular-tables.md whose calls name essere, or both.
  const essere = ["affaticare", "cascare", "infradiciare", "insanguinare", "rifuggire", "rifugiare", "rintristire", "sbilanciare"];
  const both = ["incocciare", "incrudelire", "inferocire", "insalvatichire", "insecchire", "insuperbire", "invelenire", "rifiorire", "scolare"];
  for (const [words, kind] of [
    [essere, "essere"],
    [both, "both"],
  ] as const) {
    for (const word of words) {
      const answer = ownClassOf(word, [], CONJUGATION_TEMPLATE_CALLS);
      assert.ok(answer.kind === "settled" && answer.auxiliary.kind === kind, `${word}: ${JSON.stringify(answer)}`);
    }
  }
});

test("a pronominal verb's base cells stay on avere whatever its call names: pentirsi's names essere (#873)", () => {
  const pentirsi = settledOf("pentirsi");
  assert.ok(pentirsi.evidence.kind === "template" && pentirsi.evidence.page.call === "{{It-conj|pent|irsi|essere}}");
  assert.deepEqual(pentirsi.auxiliary, { kind: "avere" });
  assert.equal(column(builtTable("pentirsi"), "passato prossimo")[3], "ci siamo pentiti");
});
