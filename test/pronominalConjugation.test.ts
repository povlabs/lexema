import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { personOfItalianVerbForm, placeItalianVerbForm, type TenseBox } from "../src/italian/moods.js";
import { ESSERE_OF, PRONOMINAL_CONJUGATION_RULE, pronominalSpellings, pronominalVerb, type BaseCell, type PronominalVerb } from "../src/italian/pronominalConjugation.js";

interface RawRecord {
  word: string;
  pos: string;
  forms?: { form: string; tags?: string[]; raw_tags?: string[] }[];
}

const recordsOf = async (fixture: string): Promise<RawRecord[]> =>
  (await readFile(new URL(`../fixtures/${fixture}`, import.meta.url), "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as RawRecord);

// fixtures/pronominal-verb-tables.jsonl holds verbatim lines of it-0c432803:
// 624 `arrendersi`, 770 `accorgersi`, 2061 `alzarsi`, 2344 and 2345 `andare`,
// 8179 `andarsene`, 47593 `alzare`, 50299 `trasferire`, 50301 `trasferirsi`,
// 448681 `pentirsi`, 532997 `arrendere`, 137017 and 137018 `figurare`, 464591
// and 464592 `figurarsi`, 59328 `laureati`, 463524 `laurearsi`, 547967
// `laureare`.
const PRONOMINAL = await recordsOf("pronominal-verb-tables.jsonl");

const cellsOf = (word: string): BaseCell[] => {
  const record = PRONOMINAL.find((one) => one.word === word && one.pos === "verb");
  assert.ok(record?.forms !== undefined, `the fixture has ${word}'s verb record with forms`);
  return record.forms.map((form) => ({ spelling: form.form, tags: form.tags ?? [], rawTags: form.raw_tags ?? [] }));
};

const verbOf = (word: string): PronominalVerb => {
  const verb = pronominalVerb(word);
  assert.ok(verb !== undefined, word);
  return verb;
};

/** The built spelling of every base cell `pick` names, in source order. */
function built(word: string, base: string, pick: (cell: BaseCell) => boolean): string[] {
  const cells = cellsOf(base);
  const spellings = pronominalSpellings(verbOf(word), cells);
  return cells.flatMap((cell, i) => (pick(cell) && spellings[i] !== undefined ? [spellings[i] as string] : []));
}

const inBox = (box: TenseBox) => (cell: BaseCell) => {
  const slot = placeItalianVerbForm(cell);
  return slot.kind === "tense" && slot.box === box;
};
const imperative = (cell: BaseCell) => placeItalianVerbForm(cell).kind === "imperative";
const nonFinite = (cell: BaseCell) => ["non-finite", "auxiliary"].includes(placeItalianVerbForm(cell).kind);

test("a pronominal verb names its base verbs: -arsi, -ersi, -irsi, -orsi, -ursi and -rsene (#837)", () => {
  assert.equal(PRONOMINAL_CONJUGATION_RULE, "it-pronominal-conjugation/v1");
  const read = (word: string) => {
    const verb = pronominalVerb(word);
    return verb === undefined ? undefined : [verb.ending, verb.stem, ...verb.bases];
  };
  assert.deepEqual(read("alzarsi"), ["si", "alzar", "alzare", "alzarre"]);
  assert.deepEqual(read("arrendersi"), ["si", "arrender", "arrendere"]);
  assert.deepEqual(read("trasferirsi"), ["si", "trasferir", "trasferire"]);
  assert.deepEqual(read("porsi"), ["si", "por", "porre"]);
  assert.deepEqual(read("ridursi"), ["si", "ridur", "ridurre"]);
  assert.deepEqual(read("andarsene"), ["sene", "andar", "andare", "andarre"]);
  assert.deepEqual(read("distrarsi"), ["si", "distrar", "distrare", "distrarre"]);
  for (const word of ["trasferire", "rsi", "Alzarsi", "darsi da fare", "mangiasi", "andarsene via"]) assert.equal(pronominalVerb(word), undefined, word);
});

test("simple tenses put the pronoun before the base form: mi trasferisco, si trasferiscono (#837)", () => {
  assert.deepEqual(built("trasferirsi", "trasferire", inBox("presente")), [
    "mi trasferisco",
    "ti trasferisci",
    "si trasferisce",
    "ci trasferiamo",
    "vi trasferite",
    "si trasferiscono",
  ]);
  assert.deepEqual(built("alzarsi", "alzare", inBox("presente")), ["mi alzo", "ti alzi", "si alza", "ci alziamo", "vi alzate", "si alzano"]);
  assert.deepEqual(built("alzarsi", "alzare", inBox("congiuntivo imperfetto")).slice(0, 2), ["mi alzassi", "ti alzassi"]);
});

test("compound tenses are built on essere, the participle agreeing in number: mi sono alzato, ci siamo alzati (#837)", () => {
  // alzare's own table is built on avere: `ho alzato`, `abbiamo alzato`.
  assert.deepEqual(built("alzarsi", "alzare", inBox("passato prossimo")), [
    "mi sono alzato",
    "ti sei alzato",
    "si è alzato",
    "ci siamo alzati",
    "vi siete alzati",
    "si sono alzati",
  ]);
  assert.deepEqual(built("trasferirsi", "trasferire", inBox("congiuntivo trapassato")), [
    "mi fossi trasferito",
    "ti fossi trasferito",
    "si fosse trasferito",
    "ci fossimo trasferiti",
    "vi foste trasferiti",
    "si fossero trasferiti",
  ]);
});

test("non-finite forms and the tu, noi and voi imperatives take the pronoun attached; lui and loro before (#837)", () => {
  assert.deepEqual(built("trasferirsi", "trasferire", nonFinite), ["essere", "trasferendosi", "trasferentesi", "trasferitosi"]);
  assert.deepEqual(built("trasferirsi", "trasferire", imperative), [
    "trasferisciti",
    "non trasferirti",
    "si trasferisca",
    "trasferiamoci",
    "trasferitevi",
    "si trasferiscano",
  ]);
});

test("an -rsene verb takes me ne, te ne, se ne, ce ne, ve ne, and -tene, -cene, -vene attached (#837)", () => {
  assert.deepEqual(built("andarsene", "andare", inBox("presente")), [
    "me ne vado",
    "me ne vo",
    "te ne vai",
    "se ne va",
    "ce ne andiamo",
    "ve ne andate",
    "se ne vanno",
  ]);
  assert.deepEqual(built("andarsene", "andare", inBox("passato prossimo")), [
    "me ne sono andato",
    "te ne sei andato",
    "se ne è andato",
    "ce ne siamo andati",
    "ve ne siete andati",
    "se ne sono andati",
  ]);
  assert.deepEqual(built("andarsene", "andare", nonFinite), ["essere", "andandosene", "andantesene", "andatosene"]);
  // andare's tu cell is `va'`, `va`, `vai`, `non andare`: only the short `va'` takes the pronoun.
  assert.deepEqual(built("andarsene", "andare", imperative), ["vattene", "non andartene", "se ne vada", "andiamocene", "andatevene", "se ne vadano"]);
});

test("a short tu imperative doubles the pronoun's consonant; a cell's plain spellings beside it take none (#837)", () => {
  const verb = verbOf("farsi");
  const tu = (spelling: string): BaseCell => ({ spelling, tags: ["imperative"], rawTags: ["tu"] });
  assert.deepEqual(pronominalSpellings(verb, [tu("fa'"), tu("fai"), tu("fa"), tu("non fare")]), ["fatti", undefined, undefined, "non farti"]);
  assert.deepEqual(pronominalSpellings(verbOf("darsi"), [tu("da’"), tu("dà"), tu("dai")]), ["datti", "datti", undefined]);
  assert.deepEqual(pronominalSpellings(verbOf("alzarsi"), [tu("alza")]), ["alzati"]);
});

test("what the rule cannot read it leaves out: the link to the pronominal verb, an unplaced form, a compound of another shape (#837)", () => {
  const verb = verbOf("alzarsi");
  assert.deepEqual(
    pronominalSpellings(verb, [
      { spelling: "alzarsi (coniugazione)", tags: ["reflexive", "pronominal"], rawTags: ["verbo di prima coniugazione"] },
      { spelling: "alzo", tags: ["singular", "first-person"], rawTags: ["io"] },
      { spelling: "ho alzata", tags: ["singular", "first-person", "past", "perfect"], rawTags: ["io"] },
      { spelling: "ho proprio alzato", tags: ["singular", "first-person", "past", "perfect"], rawTags: ["io"] },
    ]),
    [undefined, undefined, undefined, undefined],
  );
  // A cell of several spellings takes the pronoun on each, and a later bare participle agrees too.
  assert.deepEqual(
    pronominalSpellings(verbOf("assorbirsi"), [
      { spelling: "siedo, seggo", tags: ["singular", "first-person", "present"], rawTags: ["io"] },
      { spelling: "abbiamo assorbito, assorto", tags: ["plural", "first-person", "past", "perfect"], rawTags: ["noi"] },
    ]),
    ["mi siedo, mi seggo", "ci siamo assorbiti, assorti"],
  );
});

test("each compound tense's essere form is essere's own cell of the simple tense it is built on, in the dev seed (#837)", async () => {
  const essere = (await recordsOf("dev-seed.jsonl")).filter((record) => record.word === "essere" && record.pos === "verb");
  assert.ok(essere.length > 0, "the dev seed has essere");
  const SIMPLE_OF: Record<string, TenseBox> = {
    "passato prossimo": "presente",
    "trapassato prossimo": "imperfetto",
    "trapassato remoto": "passato remoto",
    "futuro anteriore": "futuro semplice",
    "condizionale passato": "condizionale presente",
    "congiuntivo passato": "congiuntivo presente",
    "congiuntivo trapassato": "congiuntivo imperfetto",
  };
  const rows = ["first singular", "second singular", "third singular", "first plural", "second plural", "third plural"];
  assert.deepEqual(Object.keys(ESSERE_OF).sort(), Object.keys(SIMPLE_OF).sort());
  for (const [compound, forms] of Object.entries(ESSERE_OF)) {
    for (const [i, form] of (forms ?? []).entries()) {
      const cell = essere.flatMap((record) =>
        (record.forms ?? []).flatMap((one) => {
          const tags = { tags: one.tags ?? [], rawTags: one.raw_tags ?? [] };
          const slot = placeItalianVerbForm(tags);
          const row = personOfItalianVerbForm(tags);
          return slot.kind === "tense" && slot.box === SIMPLE_OF[compound] && row !== undefined && `${row.person} ${row.number}` === rows[i] ? [one.form] : [];
        }),
      );
      assert.ok(cell.includes(form), `${compound} ${rows[i]}: ${form} is not in essere's ${SIMPLE_OF[compound]} cell ${JSON.stringify(cell)}`);
    }
  }
});
