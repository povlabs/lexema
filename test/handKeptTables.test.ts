// Hand-kept conjugation tables (ADR 0031's 2026-10-16 amendment, #844): the
// committed list, each table checked cell for cell against the en.wiktionary
// table its cited `{{it-conj}}` call expands to; the 24 pronominal verbs
// `it-regular-conjugation/v1` leaves without a table, each given one outcome;
// and the type that refuses an invalid table.
//
// Inputs are verbatim (fixtures/hand-kept-tables/PROVENANCE.md): the 24 verb
// records of it-0c432803, each cited en.wiktionary revision's wikitext, and
// the table each revision's call expands to.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { CONJUGATION_TEMPLATE_CALLS } from "../src/italian/conjugationTemplateCalls.js";
import { evidenceUrl } from "../src/italian/curatedCorrections.js";
import {
  HAND_KEPT_TABLES,
  handKeptCells,
  handKeptTable,
  handKeptTableOf,
  InvalidHandKeptTable,
  type HandKeptCell,
  type HandKeptTable,
  type HandKeptTableSpec,
} from "../src/italian/handKeptTables.js";
import { personOfItalianVerbForm, placeItalianVerbForm, TENSE_NAMES } from "../src/italian/moods.js";
import { pronominalSpellings, pronominalVerb, type PronominalVerb } from "../src/italian/pronominalConjugation.js";
import { regularClassOf } from "../src/italian/regularConjugation.js";
import { readEnWiktionaryTable, type EnWiktionarySlot, type EnWiktionaryTable } from "./enWiktionaryTable.js";

const FIXTURES = resolve("fixtures/hand-kept-tables");
const RULING_838 = "https://github.com/povlabs/lexema/issues/838#issuecomment-6214333127";

interface RawRecord {
  word: string;
  pos: string;
  forms?: unknown[];
  senses?: { glosses?: string[] }[];
}

const RECORDS = (await readFile(join(FIXTURES, "archive-lines.jsonl"), "utf8"))
  .trimEnd()
  .split("\n")
  .map((line) => JSON.parse(line) as RawRecord);

/** The 24 records #844 lists, by the reason #838's report gave. */
const LISTED = {
  "ire-isc": ["appassirsi", "assennirsi", "attremirsi", "immusonirsi", "impadronirsi", "informicolirsi", "susseguirsi"],
  "iare-stress": ["adastiarsi", "appollaiarsi", "incacchiarsi", "industriarsi", "infischiarsi", "obliarsi"],
  "second-conjugation": ["avvalersi", "avvedersi", "genuflettersi", "imbattersi", "ravvedersi", "rivalersi"],
  "irregular-family": ["assuefarsi", "stupefarsi", "sdarsi", "inostrarsi"],
  "template-not-read": ["prefiggersi"],
} as const;

/** The three en.wiktionary has no page for, nor for their base verbs: listed for Huey. */
const FOR_HUEY = ["attremirsi", "sdarsi", "inostrarsi"];

const verbOf = (word: string): PronominalVerb => {
  const verb = pronominalVerb(word);
  assert.ok(verb !== undefined, word);
  return verb;
};

const tableOf = (word: string): HandKeptTable => {
  const table = handKeptTableOf(word);
  assert.ok(table !== undefined, `the list keeps ${word}`);
  return table;
};

/** A record's glosses, as its page reads them: the missing-definition notice is none. */
const glossesOf = (record: RawRecord): string[] =>
  (record.senses ?? []).flatMap((sense) => (sense.glosses ?? []).filter((gloss) => gloss !== "definizione mancante; se vuoi, aggiungila tu"));

/** Where an en.wiktionary table shows a base cell, or undefined for a cell it does not show (a compound tense). */
function enPlaceOf(cell: HandKeptCell): { slot: EnWiktionarySlot; row: number } | undefined {
  const slot = placeItalianVerbForm(cell);
  const row = personOfItalianVerbForm(cell);
  const rowIndex = row === undefined ? 0 : ["first", "second", "third"].indexOf(row.person) + (row.number === "plural" ? 3 : 0);
  switch (slot.kind) {
    case "auxiliary":
      return { slot: "verbo ausiliare", row: 0 };
    case "non-finite":
      return slot.role === "gerundio" || slot.role === "participio presente" || slot.role === "participio passato" ? { slot: slot.role, row: 0 } : undefined;
    case "tense":
      return TENSE_NAMES[slot.box].compound ? undefined : { slot: slot.box as EnWiktionarySlot, row: rowIndex };
    case "imperative":
      return { slot: cell.spelling.startsWith("non ") ? "imperativo negativo" : "imperativo", row: rowIndex };
    case "unplaced":
      return undefined;
  }
}

const enTableOf = async (title: string): Promise<EnWiktionaryTable> => readEnWiktionaryTable(await readFile(join(FIXTURES, `${title}.expanded`), "utf8"));

/**
 * Each spelling the table shows, by place, against each one `spellings` gives
 * the same cell. Every place but the negative imperative holds exactly the
 * table's spellings; the negative one holds one of the table's two (`non
 * avvederti`, not `non ti avvedere`). Every place the table fills is filled,
 * but the negative imperative of a row other than tu, which no record's table has.
 */
function assertSameTable(label: string, cells: readonly HandKeptCell[], spellings: readonly (string | undefined)[], en: EnWiktionaryTable, auxiliary: boolean) {
  const filled = new Set<string>();
  cells.forEach((cell, i) => {
    const place = enPlaceOf(cell);
    if (place === undefined || (place.slot === "verbo ausiliare" && !auxiliary)) return;
    const shown = en.get(place.slot)?.[place.row] ?? [];
    const ours = spellings[i]?.split(", ") ?? [];
    const where = `${label}: ${place.slot} ${place.row}`;
    if (place.slot === "imperativo negativo") assert.ok(ours.length > 0 && ours.every((one) => shown.includes(one)), `${where}: ${ours} in ${shown}`);
    else assert.deepEqual([...ours].sort(), [...shown].sort(), where);
    filled.add(`${place.slot} ${place.row}`);
  });
  for (const [slot, rows] of en) {
    rows.forEach((shown, row) => {
      // A record's table, and so a base table here, has one negative imperative: the tu one.
      const shows = shown.length > 0 && (slot !== "verbo ausiliare" || auxiliary) && (slot !== "imperativo negativo" || row === 1);
      if (shows) assert.ok(filled.has(`${slot} ${row}`), `${label}: ${slot} ${row} is filled`);
    });
  }
}

test("each of the 24 records #844 lists gets one outcome: 21 hand-kept tables and 3 listed for Huey (#844)", () => {
  const listed = Object.values(LISTED).flat();
  assert.equal(listed.length, 24);
  assert.deepEqual(RECORDS.map((record) => record.word).sort(), [...listed].sort());
  const kept = listed.filter((word) => handKeptTableOf(word) !== undefined);
  const none = listed.filter((word) => handKeptTableOf(word) === undefined);
  assert.deepEqual(none.sort(), [...FOR_HUEY].sort());
  assert.equal(kept.length + none.length, 24);
  assert.deepEqual([...HAND_KEPT_TABLES.keys()].sort(), kept.sort());
});

test("each record is a pronominal verb record with no forms, and the rule still declines it for the reason #838 gave (#844)", () => {
  for (const [reason, words] of Object.entries(LISTED)) {
    for (const word of words) {
      const record = RECORDS.find((one) => one.word === word);
      assert.ok(record !== undefined && record.pos === "verb" && (record.forms ?? []).length === 0, word);
      const answer = regularClassOf(verbOf(word), glossesOf(record), CONJUGATION_TEMPLATE_CALLS);
      assert.equal(answer.kind === "declined" ? answer.reason : answer.kind, reason, word);
    }
  }
});

test("each table cites revisions of the verb's or its base's page, pinned verbatim, and shows the call the page's Conjugation section writes (#844)", async () => {
  for (const table of HAND_KEPT_TABLES.values()) {
    assert.equal(table.ruling, RULING_838);
    for (const evidence of table.evidence) {
      assert.match(evidenceUrl(evidence), /^https:\/\/en\.wiktionary\.org\/w\/index\.php\?title=[a-z]+&oldid=\d+$/);
      const lines = (await readFile(join(FIXTURES, `${evidence.title}.wikitext`), "utf8")).split("\n");
      assert.equal(lines[0], "==Italian==", evidence.title);
      const at = lines.indexOf(evidence.shows);
      assert.ok(at > 0 && lines[at - 1] === "====Conjugation====", `${evidence.title}: ${evidence.shows}`);
      const expanded = await readFile(join(FIXTURES, `${evidence.title}.expanded`), "utf8");
      assert.match(expanded, new RegExp(`Conjugation of <i [^>]*>\\[\\[:${evidence.title.replace(/rsi$/u, "re")}#Italian\\|`), evidence.title);
    }
  }
});

test("each table's cells are the ones its cited revisions' tables show, cell for cell (#844)", async () => {
  let compared = 0;
  for (const table of HAND_KEPT_TABLES.values()) {
    const verb = verbOf(table.verb);
    const cells = handKeptCells(table);
    for (const evidence of table.evidence) {
      const en = await enTableOf(evidence.title);
      if (evidence.title === table.verb) {
        // The verb's own page shows the pronominal table, which the rule builds on the kept base cells.
        assertSameTable(table.verb, cells, pronominalSpellings(verb, cells), en, true);
      } else {
        // The base's page shows the base table itself; its auxiliary is the base verb's, not the pronominal one's.
        assertSameTable(`${table.verb} (${evidence.title})`, cells, cells.map((cell) => cell.spelling), en, false);
      }
      compared += 1;
    }
  }
  assert.equal(compared, 23);
});

test("every built cell has the pronominal shape: pronouns, essere, and a participle that agrees in number (#844)", () => {
  for (const table of HAND_KEPT_TABLES.values()) {
    const cells = handKeptCells(table);
    const built = pronominalSpellings(verbOf(table.verb), cells);
    // Only the infinitive's own cell is left out, as on any base table.
    assert.ok(built.every((spelling, i) => spelling !== undefined || placeItalianVerbForm(cells[i]).kind === "non-finite"), table.verb);
    assert.equal(built[0], "essere");
    const compound = cells.flatMap((cell, i) => {
      const slot = placeItalianVerbForm(cell);
      return slot.kind === "tense" && TENSE_NAMES[slot.box].compound ? [{ spelling: built[i] ?? "", plural: personOfItalianVerbForm(cell)?.number === "plural" }] : [];
    });
    assert.equal(compound.length, 42, table.verb);
    for (const { spelling, plural } of compound) {
      const [first] = spelling.split(", ");
      assert.match(first, plural ? /^[cvs]i \S+ \S+i$/u : /^[mts]i \S+ \S+o$/u, `${table.verb}: ${spelling}`);
    }
  }
});

/** The pronominal spelling of the cell at a slot and row of a kept verb's table. */
function builtAt(word: string, find: (cell: HandKeptCell) => boolean): string | undefined {
  const cells = handKeptCells(tableOf(word));
  const built = pronominalSpellings(verbOf(word), cells);
  const at = cells.findIndex(find);
  assert.ok(at >= 0, word);
  return built[at];
}

const io = (box: string) => (cell: HandKeptCell) => {
  const slot = placeItalianVerbForm(cell);
  const row = personOfItalianVerbForm(cell);
  return slot.kind === "tense" && slot.box === box && row?.person === "first" && row.number === "singular";
};
const tuImperative = (cell: HandKeptCell) =>
  placeItalianVerbForm(cell).kind === "imperative" && personOfItalianVerbForm(cell)?.person === "second" && !cell.spelling.startsWith("non ");

test("real words, one per group: impadronirsi, infischiarsi, obliarsi, avvedersi, assuefarsi, prefiggersi (#844)", () => {
  // -ire with -isc-, as {{it-conj|+isc}} says.
  assert.equal(builtAt("impadronirsi", io("presente")), "mi impadronisco");
  assert.equal(builtAt("impadronirsi", io("passato prossimo")), "mi sono impadronito");
  assert.equal(builtAt("susseguirsi", io("presente")), "mi susseguo");
  // -iare with an unstressed i, and with a stressed one.
  assert.equal(builtAt("infischiarsi", io("presente")), "mi infischio");
  assert.equal(builtAt("infischiarsi", tuImperative), "infischiati");
  assert.equal(builtAt("obliarsi", io("congiuntivo presente")), "mi oblii");
  // The second conjugation.
  assert.equal(builtAt("avvedersi", io("passato remoto")), "mi avvidi");
  assert.equal(builtAt("avvedersi", io("passato prossimo")), "mi sono avvisto, avveduto");
  assert.equal(builtAt("rivalersi", io("futuro semplice")), "mi rivarrò");
  // Made on fare: the short tu imperative doubles the pronoun.
  assert.equal(builtAt("assuefarsi", io("presente")), "mi assuefaccio");
  assert.equal(builtAt("assuefarsi", io("passato remoto")), "mi assuefeci");
  assert.equal(builtAt("assuefarsi", tuImperative), "assuefatti");
  // The call that overrides the participle: prefisso.
  assert.equal(builtAt("prefiggersi", io("passato prossimo")), "mi sono prefisso");
  assert.equal(builtAt("prefiggersi", io("passato remoto")), "mi prefissi");
});

test("a verb listed for Huey gets no table: attremirsi, sdarsi, inostrarsi (#844)", () => {
  for (const word of FOR_HUEY) {
    assert.equal(handKeptTableOf(word), undefined, word);
    const record = RECORDS.find((one) => one.word === word);
    assert.ok(record !== undefined);
    assert.equal(regularClassOf(verbOf(word), glossesOf(record), CONJUGATION_TEMPLATE_CALLS).kind, "declined", word);
  }
});

const SPEC: HandKeptTableSpec = {
  verb: "impadronirsi",
  base: "impadronire",
  conjugation: { kind: "class", conjugationClass: "ire-b", stem: "impadron" },
  evidence: [{ wiki: "en.wiktionary.org", title: "impadronirsi", revisionId: 91778278, timestamp: "2026-08-02T12:28:45Z", shows: "{{it-conj|+isc}}" }],
  ruling: RULING_838,
};

test("the type refuses a table with no permanent link, no ruling, or a base, class or cells that do not fit the verb (#844)", () => {
  assert.equal(handKeptTable(SPEC).verb, "impadronirsi");
  const refused = (spec: HandKeptTableSpec, why: RegExp) => assert.throws(() => handKeptTable(spec), (error: unknown) => error instanceof InvalidHandKeptTable && why.test(error.message));
  const evidence = SPEC.evidence[0];
  refused({ ...SPEC, ruling: "" }, /no ruling comment/);
  refused({ ...SPEC, ruling: "https://github.com/povlabs/lexema/issues/844" }, /no ruling comment/);
  refused({ ...SPEC, evidence: [] as unknown as HandKeptTableSpec["evidence"] }, /cites no revision/);
  refused({ ...SPEC, evidence: [{ ...evidence, revisionId: 0 }] }, /permanent link/);
  refused({ ...SPEC, evidence: [{ ...evidence, wiki: "it.wiktionary.org" as "en.wiktionary.org" }] }, /permanent link/);
  refused({ ...SPEC, evidence: [{ ...evidence, title: "impadronito" }] }, /neither the verb nor its base/);
  refused({ ...SPEC, evidence: [{ ...evidence, shows: "{{it-verb|+isc}}" }] }, /no conjugation call/);
  refused({ ...SPEC, evidence: [{ ...evidence, timestamp: "" }] }, /no timestamp/);
  refused({ ...SPEC, verb: "impadronire" }, /not pronominal/);
  refused({ ...SPEC, base: "impadronare" }, /not a base verb/);
  refused({ ...SPEC, conjugation: { kind: "class", conjugationClass: "ire-b", stem: "impadr" } }, /is not impadronire/);
  const cells = handKeptCells(tableOf("avvedersi"));
  assert.ok(cells.length > 0);
  const paradigm = (tableOf("avvedersi").conjugation as Extract<HandKeptTableSpec["conjugation"], { kind: "cells" }>).paradigm;
  const avvedersi: HandKeptTableSpec = { ...tableOf("avvedersi") };
  refused({ ...avvedersi, conjugation: { kind: "cells", paradigm: { ...paradigm, infinitive: "vedere" } } }, /conjugate vedere/);
  refused({ ...avvedersi, conjugation: { kind: "cells", paradigm: { ...paradigm, gerund: "" } } }, /not a form/);
  refused({ ...avvedersi, conjugation: { kind: "cells", paradigm: { ...paradigm, gerund: "mi avvedo" } } }, /not a form/);
});
