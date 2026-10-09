// A meaning sense's `form_of` edge, removed or pointed at its record's base
// word beside the record (#755, ADR 0030's 2026-10-09 amendment): rule
// `it-form-of-meaning-edge/v1`, the committed list it makes, what the seed and
// `correct:records` write, what a lookup then reads, and the upgrade of a
// `corrected_edge` from before a row could name no word. Every record is a
// verbatim line of it-0c432803, from fixtures/form-of-meaning-edge.jsonl:
// archive lines 8449 `mela`, 21653 `sale`, 42264 `mele`, 59611 `mattutini`,
// 447743 `scandinava`, 447745 `scandinave` and 586759 `disabitate`.

import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import {
  CURATED_CORRECTIONS,
  correctionId,
  edgeCorrections,
  edgeRemovals,
  evidenceUrl,
  HAND_CORRECTIONS,
  isEdgeRemoval,
  senseEdgeCorrections,
  type CuratedCorrection,
  type SenseEdgeCorrection,
} from "../src/italian/curatedCorrections.js";
import { formOfGlossEdgeCorrections, glossBase, type PageRevisions, type ScannedLemma } from "../src/italian/formOfGlossEdge.js";
import { FORM_OF_GLOSS_EDGE_EVIDENCE } from "../src/italian/formOfGlossEdgeEvidence.js";
import {
  editDistance,
  FORM_OF_MEANING_EDGE_RULE,
  FORM_OF_MEANING_EDGE_RULES,
  formOfMeaningEdgeCorrections,
  formTerm,
  isMeaningGloss,
  judgeRecord,
  type MeaningVerdict,
  type RecordSense,
  type ScannedRecord,
} from "../src/italian/formOfMeaningEdge.js";
import { FORM_OF_MEANING_EDGE_EVIDENCE } from "../src/italian/formOfMeaningEdgeEvidence.js";
import { describeEntry, missingForCorrections, planCorrections, unwritten } from "../src/import/correctRecords.js";
import { seedSql } from "../src/import/seedSql.js";
import { fromNodeSqlite } from "../src/lookup/database.js";
import { lookup } from "../src/lookup/lookup.js";
import { planUpgrade, rebuildsOf, upgradeShortfall, type MasterReader } from "../src/update/master.js";
import { createStatement } from "../src/update/masterUpgrade.js";
import { senseEdgeCorrectionsAt } from "./correctionFixture.js";

const RELEASE = "it-meaning-edges";
const SCHEMA = "src/db/schema.sql";
const LINES = (await readFile(new URL("../fixtures/form-of-meaning-edge.jsonl", import.meta.url), "utf8")).trimEnd().split("\n");

const readerOf = (db: DatabaseSync): MasterReader => ({ query: <Row>(sql: string) => db.prepare(sql).all() as Row[] });
const all = (db: DatabaseSync, sql: string): unknown[] => db.prepare(sql).all().map((row) => ({ ...row }));

/** A fixture line read as the rule reads it, at its archive line. */
function scanned(word: string, lineNo: number): ScannedRecord {
  const line = LINES.find((one) => (JSON.parse(one) as { word: string }).word === word) ?? assert.fail(word);
  const record = JSON.parse(line) as { word: string; pos: string; lang_code: string; senses: { glosses: string[]; form_of?: { word: string }[] }[] };
  return {
    lineNo,
    lineSha256: "a".repeat(64),
    word: record.word,
    pos: record.pos,
    langCode: record.lang_code,
    senses: record.senses.map((sense, senseIndex): RecordSense => ({ senseIndex, gloss: sense.glosses[0], formOf: (sense.form_of ?? []).map((edge) => edge.word) })),
  };
}

/** `mela`'s record, whose forms table lists `mele`. */
const MELA: ScannedLemma = { lineNo: 8449, lineSha256: "b".repeat(64), word: "mela", pos: "noun", langCode: "it", forms: ["mele"] };
const PAGES: PageRevisions = new Map([
  ["mele", 3869166],
  ["mela", 4023986],
  ["scandinava", 3710732],
  ["sale", 1],
  ["mattutini", 1],
  ["disabitate", 1],
]);
/** Rule `it-form-of-gloss-edge/v2` sets `mele`'s sense 0 to `mela`, in place of the source's `melo` (#733). */
const MELE_SET = new Map([[0, "mela"]]);

const summary = (verdicts: readonly MeaningVerdict[]): string[] =>
  verdicts.map((verdict) =>
    verdict.kind === "redirected"
      ? `${verdict.sense.senseIndex} ${verdict.sense.formOf[0]} -> ${verdict.correction.edge.target}`
      : verdict.kind === "removed"
        ? `${verdict.sense.senseIndex} ${verdict.sense.formOf[0]} removed: ${verdict.because}`
        : `${verdict.sense.senseIndex} left alone: ${verdict.reason}${verdict.term === undefined ? "" : ` (${verdict.term})`}`,
  );

// The rule ------------------------------------------------------------------------

test("a meaning's gloss names no form; a form's gloss the v1/v2 test misses still names one", () => {
  assert.deepEqual(FORM_OF_MEANING_EDGE_RULES, ["it-form-of-meaning-edge/v1"]);
  for (const meaning of ["guance, soprattutto nei bambini:", "percosse", "relativa alla Scandinavia", "natiche o mammelle tondeggianti, soprattutto riferito a ragazza o giovane donna"]) {
    assert.equal(formTerm(meaning), undefined, meaning);
    assert.ok(isMeaningGloss(meaning), meaning);
  }
  // Glosses of archive lines 21653 `sale`, 59611 `mattutini` and 586759 `disabitate`: no form opening, yet a form's.
  for (const [gloss, term] of [
    ["terza persona singolare, modo indicativo, tempo presente del verbo salire", "singolare"],
    ["Plural form of mattutino", "plural"],
    ["femminile pluraledi disabitato", "femminile"],
    ["pliurale di manganello", "pliurale"],
    ["3ᵃ pers sing indicativo presente di dissolvere", "pers"],
    ["part. passato di alluminare", "part"],
    ["vedi obbligazione", "vedi"],
  ] as const) {
    assert.notEqual(glossBase(gloss)?.formOpening, true, gloss);
    assert.equal(formTerm(gloss), term, gloss);
    assert.equal(isMeaningGloss(gloss), false, gloss);
  }
  // A gloss v1/v2 reads as a form's is no meaning's, whatever its words.
  assert.equal(isMeaningGloss("plurale di mela nel senso di frutto del melo o di frutto in generale; vedi mela"), false);
  assert.deepEqual([editDistance("pliurale", "plurale"), editDistance("fmminile", "femminile"), editDistance("accrescitvo", "accrescitivo"), editDistance("ab", "ba")], [1, 1, 1, 1]);
});

test("mele's meaning senses point at mela, the base word its form sense names, citing mele's page and mela's", () => {
  const verdicts = judgeRecord(scanned("mele", 42264), "it-x", MELE_SET, [MELA], PAGES);
  assert.deepEqual(summary(verdicts), ["1 bambini -> mela", "2 tondeggianti -> mela", "3 percosse -> mela"]);
  const [first] = verdicts;
  assert.equal(first.kind, "redirected");
  if (first.kind !== "redirected") return;
  const formGloss = "plurale di mela nel senso di frutto del melo o di frutto in generale; vedi mela";
  assert.deepEqual(first.correction, {
    record: { releaseId: "it-x", lineNo: 42264, lineSha256: "a".repeat(64), word: "mele", pos: "noun" },
    // The edge reads from the form sense's gloss, which names mela after "di", and keeps the source's edge verbatim.
    edge: { sense: 1, gloss: { pointer: "/senses/0/glosses/0", text: formGloss }, replaces: { pointer: "/senses/1/form_of/0/word", text: "bambini" }, target: "mela" },
    evidence: {
      form: { wiki: "it.wiktionary.org", title: "mele", revisionId: 3869166, shows: formGloss },
      base: { wiki: "it.wiktionary.org", title: "mela", revisionId: 4023986, shows: "mele" },
    },
    rule: FORM_OF_MEANING_EDGE_RULE,
  });
  assert.deepEqual([first.correction.evidence.form, first.correction.evidence.base].map(evidenceUrl), [
    "https://it.wiktionary.org/w/index.php?title=mele&oldid=3869166",
    "https://it.wiktionary.org/w/index.php?title=mela&oldid=4023986",
  ]);
});

test("scandinava's only sense is a meaning, and with no form sense its edge is removed, keeping the source's edge and citing scandinava's page", () => {
  const verdicts = judgeRecord(scanned("scandinava", 447743), "it-x", new Map(), [], PAGES);
  assert.deepEqual(summary(verdicts), ["0 Scandinavia removed: no-form-sense"]);
  const [verdict] = verdicts;
  assert.equal(verdict.kind, "removed");
  if (verdict.kind !== "removed") return;
  assert.deepEqual(verdict.correction, {
    record: { releaseId: "it-x", lineNo: 447743, lineSha256: "a".repeat(64), word: "scandinava", pos: "adj" },
    edge: { sense: 0, gloss: { pointer: "/senses/0/glosses/0", text: "relativa alla Scandinavia" }, removes: { pointer: "/senses/0/form_of/0/word", text: "Scandinavia" } },
    evidence: { form: { wiki: "it.wiktionary.org", title: "scandinava", revisionId: 3710732, shows: "relativa alla Scandinavia" } },
    rule: FORM_OF_MEANING_EDGE_RULE,
  });
});

test("a form's gloss the v1/v2 test misses keeps its edge: sale, mattutini, disabitate", () => {
  assert.deepEqual(summary(judgeRecord(scanned("sale", 21653), "it-x", new Map(), [], PAGES)), ["0 left alone: form-gloss (singolare)"]);
  assert.deepEqual(summary(judgeRecord(scanned("mattutini", 59611), "it-x", new Map(), [], PAGES)), ["0 left alone: form-gloss (plural)"]);
  assert.deepEqual(summary(judgeRecord(scanned("disabitate", 586759), "it-x", new Map(), [], PAGES)), ["0 left alone: form-gloss (femminile)"]);
});

test("every other meaning sense is removed or left alone with its reason", () => {
  const mele = scanned("mele", 42264);
  const judge = (record: ScannedRecord, set = MELE_SET, lemmas: readonly ScannedLemma[] = [MELA], pages = PAGES) => summary(judgeRecord(record, "it-x", set, lemmas, pages));
  // Form senses naming two base words: the ruling does not say which, so the edge is removed.
  const two = { ...mele, senses: [...mele.senses, { senseIndex: 4, gloss: "plurale di melo", formOf: ["melo"] }] };
  assert.deepEqual(judge(two, MELE_SET, [MELA, { ...MELA, word: "melo" }]).slice(0, 1), ["1 bambini removed: several-bases"]);
  // One base word whose table does not list the word, or whose page is not in the dump.
  assert.deepEqual(judge(mele, MELE_SET, [{ ...MELA, forms: ["meli"] }]).slice(0, 1), ["1 bambini removed: base-not-confirmed"]);
  assert.deepEqual(judge(mele, MELE_SET, [{ ...MELA, langCode: "fr" }]).slice(0, 1), ["1 bambini removed: base-not-confirmed"]);
  assert.deepEqual(judge(mele, MELE_SET, [MELA], new Map([["mele", 3869166]])).slice(0, 1), ["1 bambini removed: base-not-confirmed"]);
  // Without v2's correction sense 0's edge names melo, not the mela its gloss names: no real form sense.
  assert.deepEqual(judge(mele, new Map()).slice(0, 1), ["1 bambini removed: no-form-sense"]);
  // Another correction already sets the sense.
  assert.deepEqual(judge(mele, new Map([...MELE_SET, [1, "mela"]])).slice(0, 1), ["1 left alone: already-corrected"]);
  // Several edges, or an edge that already names the base word.
  const several = { ...mele, senses: mele.senses.map((sense) => (sense.senseIndex === 1 ? { ...sense, formOf: ["bambini", "guance"] } : sense)) };
  assert.deepEqual(judge(several).slice(0, 1), ["1 left alone: several-edges"]);
  const named = { ...mele, senses: mele.senses.map((sense) => (sense.senseIndex === 1 ? { ...sense, formOf: ["mela"] } : sense)) };
  assert.deepEqual(judge(named).slice(0, 1), ["1 left alone: names-base"]);
  // No page of the record to cite.
  assert.deepEqual(judge(mele, MELE_SET, [MELA], new Map([["mela", 4023986]])).slice(0, 1), ["1 left alone: page-not-in-dump"]);
  // Another language's record is not read.
  assert.deepEqual(judge({ ...mele, langCode: "scn" }), []);
});

// The committed list ---------------------------------------------------------------

const MEANING = CURATED_CORRECTIONS.filter((correction) => "rule" in correction && correction.rule === FORM_OF_MEANING_EDGE_RULE) as SenseEdgeCorrection[];

test("the committed list removes 342 meaning senses' edges and points 258 at the record's base word, from the pinned scan of it-0c432803", () => {
  const hand = edgeCorrections(HAND_CORRECTIONS);
  const made = formOfMeaningEdgeCorrections(FORM_OF_MEANING_EDGE_EVIDENCE, [...hand, ...formOfGlossEdgeCorrections(FORM_OF_GLOSS_EDGE_EVIDENCE, hand)]);
  assert.deepEqual(MEANING, made);
  assert.equal(edgeRemovals(MEANING).length, 342);
  assert.equal(edgeCorrections(MEANING).length, 258);
  assert.equal(new Set(MEANING.map((correction) => correction.record.lineNo)).size, 468);
  // Every sense a correction sets or removes is one sense, set or removed once.
  const ids = senseEdgeCorrections(CURATED_CORRECTIONS).map(correctionId);
  assert.equal(new Set(ids).size, ids.length);

  const at = (word: string) =>
    MEANING.filter((correction) => correction.record.word === word).map((correction) =>
      correction.edge.removes === undefined ? `${correction.edge.sense} ${correction.edge.replaces?.text} -> ${correction.edge.target}` : `${correction.edge.sense} ${correction.edge.removes.text} removed`,
    );
  assert.deepEqual(at("mele"), ["1 bambini -> mela", "2 tondeggianti -> mela", "3 percosse -> mela"]);
  assert.deepEqual(at("scandinava"), ["0 Scandinavia removed"]);
  assert.deepEqual(at("scandinave"), ["1 Scandinavia -> scandinava"]);
  assert.deepEqual(at("andarsene"), ["0 sovrappensiero removed", "1 morire removed", "2 lasciare removed", "3 occasione removed"]);
  for (const word of ["sale", "mattutini", "disabitate"]) assert.deepEqual(at(word), [], word);

  for (const correction of MEANING) {
    const id = correctionId(correction);
    const { form } = correction.evidence;
    assert.deepEqual([form.wiki, form.title], ["it.wiktionary.org", correction.record.word], id);
    assert.ok(Number.isInteger(form.revisionId) && form.revisionId > 0, id);
    assert.equal(correction.edge.gloss.pointer.startsWith("/senses/"), true, id);
    if (isEdgeRemoval(correction)) {
      // The record's page shows the meaning gloss, and the source's edge is kept verbatim.
      assert.equal(form.shows, correction.edge.gloss.text, id);
      assert.equal(correction.edge.gloss.pointer, `/senses/${correction.edge.sense}/glosses/0`, id);
      assert.equal(correction.edge.removes.pointer, `/senses/${correction.edge.sense}/form_of/0/word`, id);
      assert.ok(isMeaningGloss(correction.edge.gloss.text), id);
    } else {
      // The record's page shows the form sense's gloss naming the base word, and the base word's page lists the word.
      assert.equal(form.shows, correction.edge.gloss.text, id);
      assert.notEqual(correction.edge.gloss.pointer, `/senses/${correction.edge.sense}/glosses/0`, id);
      assert.equal(glossBase(correction.edge.gloss.text)?.base, correction.edge.target, id);
      assert.deepEqual([correction.evidence.base.title, correction.evidence.base.shows], [correction.edge.target, correction.record.word], id);
      assert.equal(correction.edge.replaces?.pointer, `/senses/${correction.edge.sense}/form_of/0/word`, id);
    }
  }
});

// The seed, correct:records, the lookup and the upgrade ----------------------------

async function seeded(corrections: readonly CuratedCorrection[]): Promise<DatabaseSync> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-meaning-edges-"));
  try {
    const archive = join(dir, "fixture.jsonl.gz");
    await writeFile(archive, gzipSync(Buffer.from(`${LINES.join("\n")}\n`, "utf8")));
    const { parts } = await seedSql({
      input: archive,
      outputDir: join(dir, "sql"),
      schema: SCHEMA,
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

/** Each link of `word`'s `pos` reading: the word it names and where it was read. */
async function links(db: DatabaseSync, word: string, pos: string): Promise<string[]> {
  const result = await lookup({ db: fromNodeSqlite(db), releaseId: RELEASE, query: word });
  assert.equal(result.outcome, "found", word);
  if (result.outcome !== "found") return [];
  return result.readings
    .filter((reading) => reading.word === word && reading.pos === pos)
    .flatMap((reading) => reading.lemmaLinks.map((link) => `${link.targetWord} ${"jsonPointer" in link.ref ? link.ref.jsonPointer : ""}`));
}

const CORRECTIONS = senseEdgeCorrectionsAt(LINES, RELEASE);

test("the fixture holds v2's edge of mele's sense 0 and the rule's corrections of mele, scandinava and scandinave", () => {
  assert.deepEqual(
    CORRECTIONS.map((correction) => `${correction.record.word} ${correction.edge.sense} ${correction.edge.removes === undefined ? `-> ${correction.edge.target}` : "removed"}`),
    ["mele 0 -> mela", "mele 1 -> mela", "mele 2 -> mela", "mele 3 -> mela", "scandinava 0 removed", "scandinave 1 -> scandinava"],
  );
});

test("the seed writes a removed edge as a row naming no word, and leaves the record's own rows, its line and its form_of_edge rows least of all, as imported", async () => {
  const [plain, corrected] = [await seeded([]), await seeded(CORRECTIONS)];
  try {
    for (const table of ["source_record", "source_record_json", "form_of_edge", "sense", "sense_gloss", "grammar_claim", "lookup_form"]) {
      assert.deepEqual(all(corrected, `SELECT * FROM ${table} ORDER BY 1, 2`), all(plain, `SELECT * FROM ${table} ORDER BY 1, 2`), table);
    }
    // Each line is the archive's, byte for byte.
    assert.deepEqual(all(corrected, "SELECT raw_json FROM source_record_json ORDER BY record_id").map((row) => (row as { raw_json: string }).raw_json), LINES);
    const scandinava = CORRECTIONS.find((correction) => correction.record.word === "scandinava") ?? assert.fail("scandinava");
    assert.deepEqual(
      all(corrected, `SELECT e.sense_index, e.json_pointer, e.target_word, e.target_word_key, e.correction_id, e.evidence_url, e.base_evidence_url
                        FROM corrected_edge e JOIN source_record r ON r.record_id = e.record_id WHERE r.word = 'scandinava'`),
      [
        {
          sense_index: 0,
          json_pointer: "/senses/0/glosses/0",
          target_word: null,
          target_word_key: null,
          correction_id: correctionId(scandinava),
          evidence_url: "https://it.wiktionary.org/w/index.php?title=scandinava&oldid=3710732",
          base_evidence_url: null,
        },
      ],
    );
    // The table refuses a row that is half a removal.
    assert.throws(() =>
      corrected.exec(`INSERT INTO corrected_edge (record_id, release_id, sense_index, json_pointer, target_word, target_word_key, correction_id, evidence_url, base_evidence_url)
                      SELECT record_id, release_id, 9, '/senses/0/glosses/0', 'x', 'x', 'c', 'https://it.wiktionary.org/w/index.php?title=x&oldid=1', NULL FROM source_record LIMIT 1`),
    );
  } finally {
    plain.close();
    corrected.close();
  }
});

test("a lookup reads mele as a form of mela in every sense, scandinava with no lemma link, and scandinave under scandinava", async () => {
  const [plain, corrected] = [await seeded([]), await seeded(CORRECTIONS)];
  try {
    assert.deepEqual(await links(plain, "mele", "noun"), ["melo /senses/0/form_of/0/word", "bambini /senses/1/form_of/0/word", "tondeggianti /senses/2/form_of/0/word", "percosse /senses/3/form_of/0/word"]);
    assert.deepEqual(await links(corrected, "mele", "noun"), ["mela /senses/0/glosses/0", "mela /senses/0/glosses/0", "mela /senses/0/glosses/0", "mela /senses/0/glosses/0"]);
    assert.deepEqual(await links(plain, "scandinava", "adj"), ["Scandinavia /senses/0/form_of/0/word"]);
    assert.deepEqual(await links(corrected, "scandinava", "adj"), []);
    assert.deepEqual(await links(plain, "scandinave", "adj"), ["scandinava /senses/0/form_of/0/word", "Scandinavia /senses/1/form_of/0/word"]);
    assert.deepEqual(await links(corrected, "scandinave", "adj"), ["scandinava /senses/0/form_of/0/word", "scandinava /senses/0/glosses/0"]);
    // A form's gloss the rule leaves alone keeps the source's edge.
    assert.deepEqual(await links(corrected, "sale", "verb"), ["salire /senses/0/form_of/0/word"]);
    assert.deepEqual(await links(corrected, "disabitate", "adj"), ["disabitato /senses/0/form_of/0/word"]);
  } finally {
    plain.close();
    corrected.close();
  }
});

test("correct:records writes the removals and redirects into a master seeded before them, once, and reads them back", async () => {
  const [db, fresh] = [await seeded([]), await seeded(CORRECTIONS)];
  try {
    const plan = planCorrections(readerOf(db), CORRECTIONS);
    assert.deepEqual(plan.edges.map((entry) => entry.state), ["write", "write", "write", "write", "write", "write"]);
    assert.deepEqual(plan.counts.written, { corrected_edge: 6, correction_version: 1 });
    assert.deepEqual(plan.counts.records, { added: 0, changed: 3, removed: 0 });
    db.exec("BEGIN");
    db.exec(plan.sql);
    db.exec("COMMIT");
    assert.deepEqual(unwritten(readerOf(db), plan), []);
    const rows = (one: DatabaseSync) => all(one, "SELECT * FROM corrected_edge ORDER BY record_id, sense_index");
    assert.deepEqual(rows(db), rows(fresh), "the rows a seed writes");
    const again = planCorrections(readerOf(db), CORRECTIONS);
    assert.equal(again.sql, "");
    assert.ok(again.edges.every((entry) => entry.state === "already" && describeEntry(entry).endsWith(": already written")));
  } finally {
    db.close();
    fresh.close();
  }
});

test("update:upgrade rebuilds a corrected_edge from before #755 with every row, and correct:records waits for it", async () => {
  const schema = await readFile(SCHEMA, "utf8");
  const v2Only = CORRECTIONS.filter((correction) => !("rule" in correction && correction.rule === FORM_OF_MEANING_EDGE_RULE));
  const [db, fresh] = [await seeded(v2Only), await seeded(CORRECTIONS)];
  try {
    // The table as #722 created it: every row names a word.
    const rows = all(db, "SELECT * FROM corrected_edge") as Record<string, string | number>[];
    assert.equal(rows.length, 1);
    const stated = createStatement(schema, "TABLE", "corrected_edge");
    const before = stated
      .replace(/target_word {7}TEXT,/, "target_word       TEXT    NOT NULL,")
      .replace(/target_word_key {3}TEXT,/, "target_word_key   TEXT    NOT NULL,")
      .replace(/base_evidence_url TEXT {13}CHECK/, "base_evidence_url TEXT    NOT NULL CHECK")
      .replace(/ {2}-- A row sets an edge[^\n]*\n {2}CHECK \(\(target_word IS NULL\)[^\n]*\n/, "");
    assert.notEqual(before, stated);
    db.exec("DROP TABLE corrected_edge");
    db.exec(before);
    db.exec(createStatement(schema, "INDEX", "corrected_edge_by_target"));
    const names = Object.keys(rows[0]);
    for (const row of rows) db.prepare(`INSERT INTO corrected_edge (${names.join(", ")}) VALUES (${names.map(() => "?").join(", ")})`).run(...names.map((name) => row[name]));
    const reader = readerOf(db);
    assert.deepEqual(missingForCorrections(reader), ["corrected_edge"]);

    const upgrade = planUpgrade(reader, schema);
    assert.deepEqual(upgrade.changed, ["corrected_edge"]);
    assert.deepEqual(rebuildsOf(upgrade), [{ table: "corrected_edge", rows: 1 }]);
    db.exec(upgrade.sql);
    assert.deepEqual(upgradeShortfall(reader, schema, upgrade), []);
    assert.deepEqual(missingForCorrections(reader), []);
    assert.equal(planUpgrade(reader, schema).sql, "");
    const plan = planCorrections(reader, CORRECTIONS);
    db.exec(plan.sql);
    assert.deepEqual(all(db, "SELECT * FROM corrected_edge ORDER BY record_id, sense_index"), all(fresh, "SELECT * FROM corrected_edge ORDER BY record_id, sense_index"));
  } finally {
    db.close();
    fresh.close();
  }
});
