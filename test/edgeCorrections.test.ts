// A sense's `form_of` edge, set right beside the record (ADR 0030, #722): rule
// `it-form-of-gloss-edge/v1`, the hand entries for `parti`, what the seed and
// `correct:records` write, and what a lookup then reads. Every record is a
// verbatim line of it-0c432803, from fixtures/dev-seed.jsonl.

import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { CURATED_CORRECTIONS, correctionId, edgeCorrections, evidenceUrl, HAND_CORRECTIONS, type EdgeCorrection } from "../src/italian/curatedCorrections.js";
import {
  FORM_OF_GLOSS_EDGE_RULE,
  formOfGlossEdgeCorrections,
  glossBase,
  judgeSense,
  type PageRevisions,
  type ScannedLemma,
  type ScannedSense,
} from "../src/italian/formOfGlossEdge.js";
import { FORM_OF_GLOSS_EDGE_EVIDENCE } from "../src/italian/formOfGlossEdgeEvidence.js";
import { CorrectedLayer } from "../src/import/correctedLayer.js";
import { describeEntry, planCorrections, unwritten } from "../src/import/correctRecords.js";
import type { ImportStatement } from "../src/import/importRelease.js";
import { seedSql } from "../src/import/seedSql.js";
import { fromNodeSqlite } from "../src/lookup/database.js";
import { lookup } from "../src/lookup/lookup.js";
import type { Reading } from "../src/lookup/types.js";
import type { MasterReader } from "../src/update/master.js";
import { edgeCorrectionsAt } from "./correctionFixture.js";

const RELEASE = "it-edges";
const WORDS = new Set(["aerei", "aereo", "costruttori", "costruttore", "parti", "parto", "parte"]);

/** The dev seed's lines of `WORDS`, byte for byte. */
async function fixtureLines(): Promise<string[]> {
  const lines = (await readFile(new URL("../fixtures/dev-seed.jsonl", import.meta.url), "utf8")).trimEnd().split("\n");
  return lines.filter((line) => WORDS.has((JSON.parse(line) as { word: string }).word));
}

const readerOf = (db: DatabaseSync): MasterReader => ({ query: <Row>(sql: string) => db.prepare(sql).all() as Row[] });
const all = (db: DatabaseSync, sql: string): unknown[] => db.prepare(sql).all().map((row) => ({ ...row }));
/** A permanent link to an it.wiktionary page's revision. */
const page = (title: string, revisionId: number): string => `https://it.wiktionary.org/w/index.php?title=${title}&oldid=${revisionId}`;

async function seeded(corrections: readonly EdgeCorrection[]): Promise<DatabaseSync> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-edges-"));
  try {
    const archive = join(dir, "fixture.jsonl.gz");
    await writeFile(archive, gzipSync(Buffer.from(`${(await fixtureLines()).join("\n")}\n`, "utf8")));
    const { parts } = await seedSql({
      input: archive,
      outputDir: join(dir, "sql"),
      schema: "src/db/schema.sql",
      releaseId: RELEASE,
      license: "CC-BY-SA-4.0",
      corrections,
      onRejection: (rejection) => {
        throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
      },
    });
    const db = new DatabaseSync(":memory:");
    for (const part of parts) db.exec(await readFile(part, "utf8"));
    return db;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function readingsOf(db: DatabaseSync, word: string): Promise<Reading[]> {
  const result = await lookup({ db: fromNodeSqlite(db), releaseId: RELEASE, query: word });
  assert.equal(result.outcome, "found", word);
  return result.outcome === "found" ? result.readings.filter((reading) => reading.word === word) : [];
}

/** Each link of the noun reading of `word`: the word it names and where it was read. */
const nounLinks = async (db: DatabaseSync, word: string): Promise<string[]> =>
  (await readingsOf(db, word)).filter((reading) => reading.pos === "noun").flatMap((reading) => reading.lemmaLinks.map((link) => `${link.targetWord} ${"jsonPointer" in link.ref ? link.ref.jsonPointer : ""}`));

// The rule ------------------------------------------------------------------------

test("a form's gloss names its base word after its opening; any other gloss names one too, but is no form's", () => {
  assert.deepEqual(glossBase("plurale di aereo"), { base: "aereo", formOpening: true });
  assert.deepEqual(glossBase("femminile plurale di corsivo"), { base: "corsivo", formOpening: true });
  assert.deepEqual(glossBase("Femminile singolare di avventore"), { base: "avventore", formOpening: true });
  assert.deepEqual(glossBase("terza persona singolare del congiuntivo presente di filare"), { base: "filare", formOpening: true });
  assert.deepEqual(glossBase("seconda persona singolare dell'imperativo presente di sbarrare"), { base: "sbarrare", formOpening: true });
  assert.deepEqual(glossBase("plurale di parto, nell'accezione di persona della popolazione dei Parti"), { base: "parto", formOpening: true });
  assert.deepEqual(glossBase("studioso di chimica"), { base: "chimica", formOpening: false });
  assert.deepEqual(glossBase("diritto di appoggiare il proprio edificio al muro di un altro"), { base: "appoggiare", formOpening: false });
  // An opening of article words alone names no form; a misspelt one is not read as one.
  assert.deepEqual(glossBase("del di casa"), { base: "casa", formOpening: false });
  assert.deepEqual(glossBase("pòurale di cane"), { base: "cane", formOpening: false });
  assert.equal(glossBase("veicolo a motore"), undefined);
});

const sense = (gloss: string, formOf: readonly string[] = [], word = "aerei", langCode = "it"): ScannedSense => ({
  lineNo: 10,
  lineSha256: "a".repeat(64),
  word,
  pos: "noun",
  langCode,
  senseIndex: 0,
  gloss,
  formOf,
});
const lemma = (word: string, forms: readonly string[], lineNo = 5, langCode = "it"): ScannedLemma => ({ lineNo, lineSha256: "b".repeat(64), word, pos: "noun", langCode, forms });

/** The dump revisions of the pages the rule's examples cite. */
const PAGES: PageRevisions = new Map([
  ["aerei", 4016979],
  ["aereo", 3963800],
]);

test("the rule adds an edge only to a form's gloss with no edge, whose base word's own table lists the word, citing both words' pages", () => {
  const verdict = judgeSense(sense("plurale di aereo"), "it-x", [lemma("aereo", ["aerei"], 7), lemma("aereo", ["aerei"], 3)], new Set(), PAGES);
  assert.equal(verdict?.kind, "edge");
  if (verdict?.kind !== "edge") return;
  // The first record of the base word in archive order that lists it.
  assert.deepEqual(verdict.lemma, { lineNo: 3, lineSha256: "b".repeat(64), word: "aereo", pos: "noun", langCode: "it", formIndex: 0 });
  assert.deepEqual(verdict.correction, {
    record: { releaseId: "it-x", lineNo: 10, lineSha256: "a".repeat(64), word: "aerei", pos: "noun" },
    edge: { sense: 0, gloss: { pointer: "/senses/0/glosses/0", text: "plurale di aereo" }, target: "aereo" },
    // The two Wiktionary pages, at their dump revisions (Huey's ruling of 2026-10-08 on #722).
    evidence: {
      form: { wiki: "it.wiktionary.org", title: "aerei", revisionId: 4016979, shows: "plurale di aereo" },
      base: { wiki: "it.wiktionary.org", title: "aereo", revisionId: 3963800, shows: "aerei" },
    },
    rule: FORM_OF_GLOSS_EDGE_RULE,
  });
  assert.deepEqual([verdict.correction.evidence.form, verdict.correction.evidence.base].map(evidenceUrl), [
    "https://it.wiktionary.org/w/index.php?title=aerei&oldid=4016979",
    "https://it.wiktionary.org/w/index.php?title=aereo&oldid=3963800",
  ]);
});

test("every other sense the rule reads stays as the source states it, with its reason", () => {
  const reason = (scanned: ScannedSense, lemmas: readonly ScannedLemma[], hand = new Set<string>(), pages = PAGES) => {
    const verdict = judgeSense(scanned, "it-x", lemmas, hand, pages);
    return verdict?.kind === "left-alone" ? verdict.reason : verdict?.kind;
  };
  const listing = [lemma("aereo", ["aerei"])];
  assert.equal(reason(sense("studioso di aereo"), listing), "not-a-form-gloss");
  assert.equal(reason(sense("plurale di aereo"), []), "no-record-of-base");
  assert.equal(reason(sense("plurale di aereo"), [lemma("aereo", ["aeree"])]), "base-table-does-not-list");
  // Another language's record of the base word is not its own table.
  assert.equal(reason(sense("plurale di aereo"), [lemma("aereo", ["aerei"], 5, "fr")]), "no-record-of-base");
  assert.equal(reason(sense("plurale di aerei"), [lemma("aerei", ["aerei"])]), "names-itself");
  assert.equal(reason(sense("plurale di aereo", [], "aerei", "scn"), listing), "not-italian");
  assert.equal(reason(sense("plurale di aereo"), listing, new Set(["10:0"])), "hand-entry");
  assert.equal(reason(sense("plurale di aereo", ["aria"]), listing), "edge-names-another-word");
  // With no page to cite, either the word's or the base's, there is no correction.
  assert.equal(reason(sense("plurale di aereo"), listing, new Set(), new Map([["aerei", 4016979]])), "page-not-in-dump");
  assert.equal(reason(sense("plurale di aereo"), listing, new Set(), new Map([["aereo", 3963800]])), "page-not-in-dump");
  // A sense whose edge names the base word is right, and one with no "di" not the rule's at all.
  assert.equal(judgeSense(sense("plurale di aereo", ["aereo"]), "it-x", listing, new Set(), PAGES), undefined);
  assert.equal(judgeSense(sense("veicolo a motore"), "it-x", listing, new Set(), PAGES), undefined);
  // A gloss that is no form's, whose base word's table does not list the word, is not read either.
  assert.equal(judgeSense(sense("studioso di chimica"), "it-x", [lemma("chimica", [])], new Set(), PAGES), undefined);
});

// The committed list ---------------------------------------------------------------

test("the committed edges: aerei's and costruttori's from the rule, parti's two from a hand entry, each citing its two Wiktionary pages", () => {
  const edges = edgeCorrections(CURATED_CORRECTIONS);
  const cited = ({ evidence }: EdgeCorrection) => `${evidence.form.title}@${evidence.form.revisionId} ${evidence.base.title}@${evidence.base.revisionId}`;
  const at = (lineNo: number) => edges.filter((correction) => correction.record.lineNo === lineNo).map((correction) => `${correction.edge.sense} ${correction.edge.replaces?.text ?? "-"} -> ${correction.edge.target} (${cited(correction)})`);
  assert.deepEqual(at(69147), ["0 - -> aereo (aerei@4016979 aereo@3963800)"]);
  assert.deepEqual(at(449508), ["0 - -> costruttore (costruttori@3635849 costruttore@3782550)"]);
  assert.deepEqual(at(77162), ["1 neonato -> parto (parti@3948893 parto@3892725)", "2 Parti -> parto (parti@3948893 parto@3892725)"]);
  assert.deepEqual(edgeCorrections(HAND_CORRECTIONS).map(correctionId), ["it-0c432803:77162/senses/1", "it-0c432803:77162/senses/2"]);

  const made = formOfGlossEdgeCorrections(FORM_OF_GLOSS_EDGE_EVIDENCE, edgeCorrections(HAND_CORRECTIONS));
  assert.equal(made.length, FORM_OF_GLOSS_EDGE_EVIDENCE.edges.length, "every pinned sense is still confirmed");
  assert.equal(new Set(made.map(correctionId)).size, made.length, "one correction per sense");
  const hand = new Set(edgeCorrections(HAND_CORRECTIONS).map(correctionId));
  for (const correction of edges) {
    const id = correctionId(correction);
    assert.ok(!made.some((one) => correctionId(one) === id) || !hand.has(id), `${id} is set by hand and by the rule`);
    // The record's own page shows the gloss that names the target, and the target's page lists the word.
    const { form, base } = correction.evidence;
    assert.equal(glossBase(correction.edge.gloss.text)?.base, correction.edge.target, id);
    assert.equal(correction.edge.gloss.pointer, `/senses/${correction.edge.sense}/glosses/0`, id);
    assert.deepEqual([form.wiki, form.title, form.shows], ["it.wiktionary.org", correction.record.word, correction.edge.gloss.text], id);
    assert.deepEqual([base.wiki, base.title, base.shows], ["it.wiktionary.org", correction.edge.target, correction.record.word], id);
    assert.ok(Number.isInteger(form.revisionId) && form.revisionId > 0 && Number.isInteger(base.revisionId) && base.revisionId > 0, id);
  }
});

// The seed, correct:records and the lookup ------------------------------------------

test("the seed writes each edge beside its sense and leaves the record's own rows as imported", async () => {
  const lines = await fixtureLines();
  const corrections = edgeCorrectionsAt(lines, RELEASE);
  assert.deepEqual(corrections.map((correction) => `${correction.record.word} ${correction.edge.sense}`).sort(), ["aerei 0", "costruttori 0", "parti 1", "parti 2"]);
  const [plain, corrected] = [await seeded([]), await seeded(corrections)];
  try {
    for (const table of ["source_record", "source_record_json", "form_of_edge", "sense", "sense_gloss", "grammar_claim", "lookup_form"]) {
      assert.deepEqual(all(corrected, `SELECT * FROM ${table} ORDER BY 1, 2`), all(plain, `SELECT * FROM ${table} ORDER BY 1, 2`), table);
    }
    assert.deepEqual(all(plain, "SELECT * FROM corrected_edge"), []);
    assert.deepEqual(
      all(corrected, `SELECT r.word, e.sense_index, e.json_pointer, e.target_word, e.target_word_key, e.correction_id, e.evidence_url, e.base_evidence_url
                        FROM corrected_edge e JOIN source_record r ON r.record_id = e.record_id ORDER BY r.word, e.sense_index`),
      [
        { word: "aerei", sense_index: 0, json_pointer: "/senses/0/glosses/0", target_word: "aereo", target_word_key: "aereo", correction_id: `${RELEASE}:${corrections.find((one) => one.record.word === "aerei")?.record.lineNo}/senses/0`, evidence_url: page("aerei", 4016979), base_evidence_url: page("aereo", 3963800) },
        { word: "costruttori", sense_index: 0, json_pointer: "/senses/0/glosses/0", target_word: "costruttore", target_word_key: "costruttore", correction_id: `${RELEASE}:${corrections.find((one) => one.record.word === "costruttori")?.record.lineNo}/senses/0`, evidence_url: page("costruttori", 3635849), base_evidence_url: page("costruttore", 3782550) },
        { word: "parti", sense_index: 1, json_pointer: "/senses/1/glosses/0", target_word: "parto", target_word_key: "parto", correction_id: `${RELEASE}:${corrections.find((one) => one.record.word === "parti")?.record.lineNo}/senses/1`, evidence_url: page("parti", 3948893), base_evidence_url: page("parto", 3892725) },
        { word: "parti", sense_index: 2, json_pointer: "/senses/2/glosses/0", target_word: "parto", target_word_key: "parto", correction_id: `${RELEASE}:${corrections.find((one) => one.record.word === "parti")?.record.lineNo}/senses/2`, evidence_url: page("parti", 3948893), base_evidence_url: page("parto", 3892725) },
      ],
    );
  } finally {
    plain.close();
    corrected.close();
  }
});

test("a hidden record gets no edge, and the seed reports it (ADR 0023)", () => {
  const [correction] = edgeCorrections(HAND_CORRECTIONS);
  const written: unknown[][] = [];
  const statement = { run: (...values: unknown[]) => written.push(values) } as unknown as ImportStatement;
  const layer = new CorrectedLayer([correction], statement, statement, { corrected_claim: 0, corrected_edge: 0 });
  layer.add({ releaseId: correction.record.releaseId, recordId: 1, lineNo: correction.record.lineNo, lineSha256: correction.record.lineSha256 }, true);
  assert.deepEqual(written, []);
  assert.deepEqual(layer.summary, { keyed: 1, applied: 0, unapplied: [{ id: correctionId(correction), reason: "record-hidden" }] });
});

test("a lookup reads a corrected edge in place of the sense's own: aerei and costruttori name their base words, parti's two lines parto", async () => {
  const lines = await fixtureLines();
  const [plain, corrected] = [await seeded([]), await seeded(edgeCorrectionsAt(lines, RELEASE))];
  try {
    assert.deepEqual(await nounLinks(plain, "aerei"), []);
    assert.deepEqual(await nounLinks(corrected, "aerei"), ["aereo /senses/0/glosses/0"]);
    assert.deepEqual(await nounLinks(corrected, "costruttori"), ["costruttore /senses/0/glosses/0"]);
    assert.deepEqual(await nounLinks(plain, "parti"), ["parte /senses/0/form_of/0/word", "neonato /senses/1/form_of/0/word", "Parti /senses/2/form_of/0/word"]);
    assert.deepEqual(await nounLinks(corrected, "parti"), ["parte /senses/0/form_of/0/word", "parto /senses/1/glosses/0", "parto /senses/2/glosses/0"]);
    // The base word lists the form among the records declaring themselves its forms, at the gloss the edge was read from.
    const inflections = async (db: DatabaseSync, word: string) =>
      (await readingsOf(db, word)).filter((reading) => reading.pos === "noun").flatMap((reading) => reading.inflections.map((one) => `${one.word} ${one.pos} ${one.refs.map((ref) => ("jsonPointer" in ref ? ref.jsonPointer : "")).join(" ")}`));
    assert.deepEqual(await inflections(plain, "parto"), []);
    assert.deepEqual(await inflections(corrected, "parto"), ["parti noun /senses/1/glosses/0 /senses/2/glosses/0"]);
    assert.ok((await inflections(corrected, "aereo")).includes("aerei noun /senses/0/glosses/0"));
  } finally {
    plain.close();
    corrected.close();
  }
});

test("correct:records writes the edges into a master seeded before them, once, and reads them back", async () => {
  const lines = await fixtureLines();
  const corrections = edgeCorrectionsAt(lines, RELEASE);
  const [db, fresh] = [await seeded([]), await seeded(corrections)];
  try {
    const plan = planCorrections(readerOf(db), corrections);
    assert.deepEqual(plan.edges.map((entry) => entry.state), ["write", "write", "write", "write"]);
    assert.deepEqual(plan.counts.written, { corrected_edge: 4, correction_version: 1 });
    assert.deepEqual(plan.counts.records, { added: 0, changed: 3, removed: 0 });
    db.exec("BEGIN");
    db.exec(plan.sql);
    db.exec("COMMIT");
    assert.deepEqual(unwritten(readerOf(db), plan), []);
    const rows = (one: DatabaseSync) => all(one, "SELECT * FROM corrected_edge ORDER BY record_id, sense_index");
    assert.deepEqual(rows(db), rows(fresh), "the rows a seed writes");
    const again = planCorrections(readerOf(db), corrections);
    assert.equal(again.sql, "");
    assert.deepEqual(again.edges.map((entry) => entry.state), ["already", "already", "already", "already"]);
    assert.ok(again.edges.every((entry) => describeEntry(entry).endsWith(": already written")));
  } finally {
    db.close();
    fresh.close();
  }
});

test("correct:records reports an edge of a hidden record, and writes none", async () => {
  const lines = await fixtureLines();
  const corrections = edgeCorrectionsAt(lines, RELEASE).filter((correction) => correction.record.word === "aerei");
  const db = await seeded([]);
  try {
    const [{ record_id: recordId }] = db.prepare(`SELECT record_id FROM source_record WHERE line_no = ${corrections[0].record.lineNo}`).all() as { record_id: number }[];
    db.exec(`INSERT INTO hidden_record (record_id, release_id, rule, because, language, lemma_line) VALUES (${recordId}, '${RELEASE}', 'form-of-foreign-lemma/v1', 'lemma-lists-form', 'es', 1)`);
    const plan = planCorrections(readerOf(db), corrections);
    assert.deepEqual(plan.edges.map((entry) => entry.state), ["hidden"]);
    assert.equal(plan.sql, "");
    assert.match(describeEntry(plan.edges[0]), /not written; the record is hidden/);
  } finally {
    db.close();
  }
});
