// A sense's `form_of` edge, set right beside the record (ADR 0030, #722, #733):
// rule `it-form-of-gloss-edge`, v1 and v2, the hand entries for `parti`, what
// the seed and `correct:records` write, and what a lookup then reads. Every
// record is a verbatim line of it-0c432803, from fixtures/dev-seed.jsonl, or
// for the edges v2 replaces from fixtures/form-of-edge-replaced.jsonl: archive
// lines 543 `greco`, 1495 to 1497 `presente`, 8447 `melo`, 8449 `mela`, 33271
// `portare`, 34206 `svestito`, 38968 `Grecia`, 41348 `porta`, 42264 `mele`,
// 81297 `greci` and 460506 `svestire`.

import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { CURATED_CORRECTIONS, correctionId, edgeCorrections, evidenceUrl, HAND_CORRECTIONS, type EdgeCorrection } from "../src/italian/curatedCorrections.js";
import {
  edgeChange,
  FORM_OF_GLOSS_EDGE_RULE,
  FORM_OF_GLOSS_EDGE_RULES,
  type FormOfGlossEdgeRule,
  formOfGlossEdgeCorrections,
  glossBase,
  judgeSense,
  type PageRevisions,
  reflexiveOf,
  type RuleMadeEdgeCorrection,
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

/** The lines of fixtures/form-of-edge-replaced.jsonl, byte for byte. */
async function replacedLines(): Promise<string[]> {
  return (await readFile(new URL("../fixtures/form-of-edge-replaced.jsonl", import.meta.url), "utf8")).trimEnd().split("\n");
}

async function seeded(corrections: readonly EdgeCorrection[], lines?: readonly string[]): Promise<DatabaseSync> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-edges-"));
  try {
    const archive = join(dir, "fixture.jsonl.gz");
    await writeFile(archive, gzipSync(Buffer.from(`${(lines ?? (await fixtureLines())).join("\n")}\n`, "utf8")));
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
  // v1 leaves an edge that names another word to a ruling; v2 replaces it (below).
  const v1 = judgeSense(sense("plurale di aereo", ["aria"]), "it-x", listing, new Set(), PAGES, "it-form-of-gloss-edge/v1");
  assert.equal(v1?.kind === "left-alone" ? v1.reason : v1?.kind, "edge-names-another-word");
  // With no page to cite, either the word's or the base's, there is no correction.
  assert.equal(reason(sense("plurale di aereo"), listing, new Set(), new Map([["aerei", 4016979]])), "page-not-in-dump");
  assert.equal(reason(sense("plurale di aereo"), listing, new Set(), new Map([["aereo", 3963800]])), "page-not-in-dump");
  // A sense whose edge names the base word is right, and one with no "di" not the rule's at all.
  assert.equal(judgeSense(sense("plurale di aereo", ["aereo"]), "it-x", listing, new Set(), PAGES), undefined);
  assert.equal(judgeSense(sense("veicolo a motore"), "it-x", listing, new Set(), PAGES), undefined);
  // A gloss that is no form's, whose base word's table does not list the word, is not read either.
  assert.equal(judgeSense(sense("studioso di chimica"), "it-x", [lemma("chimica", [])], new Set(), PAGES), undefined);
});

// v2: an edge that names another word, replaced (#733) ------------------------------

/** A sense of `svestito` or `porta`, as the archive states it, and the record of its base word that lists it. */
const SVESTITO = { ...sense("participio passato di svestire, svestirsi", ["svestirsi"], "svestito"), pos: "verb", lineNo: 34206 };
const PORTA = { ...sense("terza persona singolare di portare dell'indicativo presente di portare", ["presente"], "porta"), pos: "verb", lineNo: 41348, senseIndex: 1 };
const V2_PAGES: PageRevisions = new Map([
  ["svestito", 3661196],
  ["svestire", 3888372],
  ["porta", 4056732],
  ["portare", 4044036],
]);
const judgeV2 = (scanned: ScannedSense, lemmas: readonly ScannedLemma[], hand = new Set<string>(), pages = V2_PAGES, rule: FormOfGlossEdgeRule = "it-form-of-gloss-edge/v2") =>
  judgeSense(scanned, "it-x", lemmas, hand, pages, rule);
const leftReason = (verdict: ReturnType<typeof judgeSense>) => (verdict?.kind === "left-alone" ? verdict.reason : verdict?.kind);

test("v2 replaces an edge to the reflexive form of the gloss's verb, keeping the source's edge verbatim", () => {
  const verdict = judgeV2(SVESTITO, [lemma("svestire", ["svestii", "svestito"], 460506)]);
  assert.equal(verdict?.kind, "edge");
  if (verdict?.kind !== "edge") return;
  assert.deepEqual(verdict.correction, {
    record: { releaseId: "it-x", lineNo: 34206, lineSha256: "a".repeat(64), word: "svestito", pos: "verb" },
    edge: {
      sense: 0,
      gloss: { pointer: "/senses/0/glosses/0", text: "participio passato di svestire, svestirsi" },
      replaces: { pointer: "/senses/0/form_of/0/word", text: "svestirsi" },
      target: "svestire",
    },
    evidence: {
      form: { wiki: "it.wiktionary.org", title: "svestito", revisionId: 3661196, shows: "participio passato di svestire, svestirsi" },
      base: { wiki: "it.wiktionary.org", title: "svestire", revisionId: 3888372, shows: "svestito" },
    },
    rule: "it-form-of-gloss-edge/v2",
  });
  assert.equal(edgeChange(verdict.correction.edge), "replaced-reflexive");
});

test("v2 replaces an edge to another word, keeping the source's edge verbatim", () => {
  const verdict = judgeV2(PORTA, [lemma("portare", ["porto", "porta"], 33271)]);
  assert.equal(verdict?.kind, "edge");
  if (verdict?.kind !== "edge") return;
  assert.deepEqual(verdict.correction.edge, {
    sense: 1,
    gloss: { pointer: "/senses/1/glosses/0", text: PORTA.gloss },
    replaces: { pointer: "/senses/1/form_of/0/word", text: "presente" },
    target: "portare",
  });
  assert.deepEqual([verdict.correction.evidence.form.title, verdict.correction.evidence.base.title], ["porta", "portare"]);
  assert.equal(edgeChange(verdict.correction.edge), "replaced-other-word");
});

test("v2 leaves an edge that names another word as the source states it when any condition fails", () => {
  const listing = [lemma("portare", ["porta"], 33271)];
  // The gloss names X after "di", but its opening says no form: not read at all, as in v1.
  assert.equal(judgeV2({ ...PORTA, gloss: "atto di portare" }, listing), undefined);
  // No Italian record of X lists the word: not read either.
  assert.equal(judgeV2(PORTA, [lemma("portare", ["porto"], 33271)]), undefined);
  assert.equal(judgeV2(PORTA, [lemma("portare", ["porta"], 33271, "fr")]), undefined);
  // The record is another language's.
  assert.equal(leftReason(judgeV2({ ...PORTA, langCode: "scn" }, listing)), "not-italian");
  // The gloss names the record's own word.
  assert.equal(leftReason(judgeV2({ ...PORTA, gloss: "plurale di porta" }, [lemma("porta", ["porta"])])), "names-itself");
  // Either page has no revision in the dump.
  assert.equal(leftReason(judgeV2(PORTA, listing, new Set(), new Map([["porta", 4056732]]))), "page-not-in-dump");
  assert.equal(leftReason(judgeV2(PORTA, listing, new Set(), new Map([["portare", 4044036]]))), "page-not-in-dump");
  // A hand entry sets the sense.
  assert.equal(leftReason(judgeV2(PORTA, listing, new Set(["41348:1"]))), "hand-entry");
  // Several edges, none to X: no one edge is the one replaced.
  assert.equal(leftReason(judgeV2({ ...PORTA, formOf: ["presente", "indicativo"] }, listing)), "several-edges");
  // An edge that already names X is right, and not the rule's.
  assert.equal(judgeV2({ ...PORTA, formOf: ["portare"] }, listing), undefined);
  // v1 left every such sense alone.
  assert.equal(leftReason(judgeV2(PORTA, listing, new Set(), V2_PAGES, "it-form-of-gloss-edge/v1")), "edge-names-another-word");
});

test("a reflexive infinitive is the verb's own, with -si for its final -e", () => {
  assert.deepEqual(["svestire", "lamentare", "porre", "tradurre", "rendere", "mela"].map(reflexiveOf), ["svestirsi", "lamentarsi", "porsi", "tradursi", "rendersi", undefined]);
});

/** A rule-made correction with its rule left out: what the seed stores of it. */
const withoutRule = ({ rule: _rule, ...correction }: RuleMadeEdgeCorrection) => correction;

test("v2 makes every correction v1 makes on the pinned scan, identically, and replaces 743 edges besides: 665 reflexive, 78 to another word", () => {
  assert.deepEqual(FORM_OF_GLOSS_EDGE_RULES, ["it-form-of-gloss-edge/v1", "it-form-of-gloss-edge/v2"]);
  assert.equal(FORM_OF_GLOSS_EDGE_RULE, "it-form-of-gloss-edge/v2");
  const hand = edgeCorrections(HAND_CORRECTIONS);
  const v1 = formOfGlossEdgeCorrections(FORM_OF_GLOSS_EDGE_EVIDENCE, hand, "it-form-of-gloss-edge/v1");
  const v2 = formOfGlossEdgeCorrections(FORM_OF_GLOSS_EDGE_EVIDENCE, hand, "it-form-of-gloss-edge/v2");
  const byId = new Map(v2.map((correction) => [correctionId(correction), correction]));
  for (const before of v1) {
    const after = byId.get(correctionId(before));
    assert.ok(after !== undefined, correctionId(before));
    assert.equal(before.rule, "it-form-of-gloss-edge/v1");
    assert.equal(after.rule, "it-form-of-gloss-edge/v2");
    assert.deepEqual(withoutRule(after), withoutRule(before), correctionId(before));
  }
  const changes = (corrections: readonly RuleMadeEdgeCorrection[]) =>
    Object.fromEntries(["added", "replaced-reflexive", "replaced-other-word"].map((change) => [change, corrections.filter((correction) => edgeChange(correction.edge) === change).length]));
  assert.deepEqual(changes(v1), { added: 1939, "replaced-reflexive": 0, "replaced-other-word": 0 });
  assert.deepEqual(changes(v2), { added: 1939, "replaced-reflexive": 665, "replaced-other-word": 78 });
  // The committed list is made with v2.
  assert.deepEqual(edgeCorrections(CURATED_CORRECTIONS).filter((correction) => "rule" in correction), v2);
});

// The committed list ---------------------------------------------------------------

test("the committed edges: aerei's and costruttori's from the rule, parti's two from a hand entry, each citing its two Wiktionary pages", () => {
  const edges = edgeCorrections(CURATED_CORRECTIONS);
  const cited = ({ evidence }: EdgeCorrection) => `${evidence.form.title}@${evidence.form.revisionId} ${evidence.base.title}@${evidence.base.revisionId}`;
  const at = (lineNo: number) => edges.filter((correction) => correction.record.lineNo === lineNo).map((correction) => `${correction.edge.sense} ${correction.edge.replaces?.text ?? "-"} -> ${correction.edge.target} (${cited(correction)})`);
  assert.deepEqual(at(69147), ["0 - -> aereo (aerei@4016979 aereo@3963800)"]);
  assert.deepEqual(at(449508), ["0 - -> costruttore (costruttori@3635849 costruttore@3782550)"]);
  assert.deepEqual(at(77162), ["1 neonato -> parto (parti@3948893 parto@3892725)", "2 Parti -> parto (parti@3948893 parto@3892725)"]);
  // v2 (#733): an edge to the reflexive form of the gloss's verb, and edges to another word.
  assert.deepEqual(at(34206), ["0 svestirsi -> svestire (svestito@3661196 svestire@3888372)"]);
  assert.deepEqual(at(41348), ["1 presente -> portare (porta@4056732 portare@4044036)", "2 presente -> portare (porta@4056732 portare@4044036)"]);
  assert.deepEqual(at(42264), ["0 melo -> mela (mele@3869166 mela@4023986)"]);
  assert.deepEqual(at(81297), ["0 Grecia -> greco (greci@3967967 greco@3958426)"]);
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
  const layer = new CorrectedLayer([correction], { claim: statement, form: statement, edge: statement }, { corrected_claim: 0, corrected_form: 0, corrected_edge: 0 });
  layer.add({ releaseId: correction.record.releaseId, recordId: 1, lineNo: correction.record.lineNo, line: "{}", lineSha256: correction.record.lineSha256 }, true);
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

test("a lookup reads a replaced edge in place of the source's: porta under portare, svestito under svestire, mele under mela, greci under greco (#733)", async () => {
  const lines = await replacedLines();
  const corrections = edgeCorrectionsAt(lines, RELEASE);
  assert.deepEqual(corrections.map((correction) => `${correction.record.word} ${correction.edge.sense} ${correction.edge.replaces?.text} -> ${correction.edge.target}`), [
    "svestito 0 svestirsi -> svestire",
    "porta 1 presente -> portare",
    "porta 2 presente -> portare",
    "mele 0 melo -> mela",
    "greci 0 Grecia -> greco",
  ]);
  const [plain, corrected] = [await seeded([], lines), await seeded(corrections, lines)];
  /** Each link of `word`'s `pos` reading: the word it names and where it was read. */
  const links = async (db: DatabaseSync, word: string, pos: string): Promise<string[]> =>
    (await readingsOf(db, word)).filter((reading) => reading.pos === pos).flatMap((reading) => reading.lemmaLinks.map((link) => `${link.targetWord} ${"jsonPointer" in link.ref ? link.ref.jsonPointer : ""}`));
  /** The forms `word`'s readings list as declaring themselves its forms. */
  const inflections = async (db: DatabaseSync, word: string): Promise<string[]> =>
    (await readingsOf(db, word)).flatMap((reading) => reading.inflections.map((one) => `${one.word} ${one.pos} ${one.refs.map((ref) => ("jsonPointer" in ref ? ref.jsonPointer : "")).join(" ")}`));
  try {
    for (const table of ["source_record", "source_record_json", "form_of_edge", "sense", "sense_gloss", "grammar_claim", "lookup_form"]) {
      assert.deepEqual(all(corrected, `SELECT * FROM ${table} ORDER BY 1, 2`), all(plain, `SELECT * FROM ${table} ORDER BY 1, 2`), table);
    }
    // Sense 0, a form of `porgere`, keeps its own edge.
    assert.deepEqual(await links(plain, "porta", "verb"), ["porgere /senses/0/form_of/0/word", "presente /senses/1/form_of/0/word", "presente /senses/2/form_of/0/word"]);
    assert.deepEqual(await links(corrected, "porta", "verb"), ["porgere /senses/0/form_of/0/word", "portare /senses/1/glosses/0", "portare /senses/2/glosses/0"]);
    assert.deepEqual(await links(plain, "svestito", "verb"), ["svestirsi /senses/0/form_of/0/word"]);
    assert.deepEqual(await links(corrected, "svestito", "verb"), ["svestire /senses/0/glosses/0"]);
    // Senses 1 to 3 gloss no form ("guance, soprattutto nei bambini:"), so their edges stay as the source states them.
    const sourceRest = ["bambini /senses/1/form_of/0/word", "tondeggianti /senses/2/form_of/0/word", "percosse /senses/3/form_of/0/word"];
    assert.deepEqual(await links(plain, "mele", "noun"), ["melo /senses/0/form_of/0/word", ...sourceRest]);
    assert.deepEqual(await links(corrected, "mele", "noun"), ["mela /senses/0/glosses/0", ...sourceRest]);
    assert.deepEqual(await links(plain, "greci", "noun"), ["Grecia /senses/0/form_of/0/word"]);
    assert.deepEqual(await links(corrected, "greci", "noun"), ["greco /senses/0/glosses/0"]);
    // The base word lists the form, and the word the source named no longer does.
    assert.ok((await inflections(corrected, "portare")).includes("porta verb /senses/1/glosses/0 /senses/2/glosses/0"));
    assert.ok(!(await inflections(corrected, "presente")).some((one) => one.startsWith("porta ")));
    assert.ok((await inflections(plain, "presente")).some((one) => one.startsWith("porta ")));
    assert.ok((await inflections(corrected, "svestire")).includes("svestito verb /senses/0/glosses/0"));
    assert.ok((await inflections(corrected, "mela")).includes("mele noun /senses/0/glosses/0"));
    assert.ok(!(await inflections(corrected, "melo")).some((one) => one.startsWith("mele ")));
    assert.ok((await inflections(corrected, "greco")).includes("greci noun /senses/0/glosses/0"));
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
