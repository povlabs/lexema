// Updates from a later kaikki release (#18): the diff against the master, and
// the apply of the changes a person chose. Each test seeds a master from one
// small archive through the seed's own SQL, writes beside it the rows a person
// or the recovered layer writes by hand, and compares a later archive with it.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { gzipSync } from "node:zlib";
import { seedSql } from "../src/import/seedSql.js";
import type { ArchiveFactsCatalog } from "../src/source/archiveFacts.js";
import { LanguageHeadings } from "../src/italian/sectionLanguage.js";
import { automaticPlan } from "../src/update/automatic.js";
import { servedVersion, lineagesOf } from "../src/lookup/served.js";
import { fromNodeSqlite } from "../src/lookup/database.js";
import { lookup } from "../src/lookup/lookup.js";
import { findNearby } from "../src/lookup/nearby.js";
import { randomHeadword } from "../src/lookup/random.js";
import { suggest } from "../src/lookup/suggest.js";
import { everyRecovered, type FoundResult, type LookupResult, type Reading } from "../src/lookup/types.js";
import { ApplyRefused, checkApplied, chooseChanges, missingForApply, planApply, type ApplyPlan } from "../src/update/apply.js";
import type { Change } from "../src/update/changes.js";
import { diffAgainstMaster, reportMarkdown, reportOf, type MasterDiff } from "../src/update/diff.js";
import { changedUpgrade, changedViews, missingUpgrade, planUpgrade, rebuildsOf, upgradeShortfall, type MasterReader } from "../src/update/master.js";
import { overlongPatterns, sqlPatterns } from "../src/db/d1PatternLimit.js";
import {
  columnsOf,
  CORRECTION_TABLES,
  createStatement,
  definitionOf,
  HAND_KEPT_TABLES,
  HIDE_TABLES,
  masterUpgradeSql,
  rebuildSql,
  PAGE_ENTRY_CORRECTION_TABLES,
  PAGE_ENTRY_FACT_TABLES,
  PAGE_ENTRY_INDEXES,
  PAGE_ENTRY_TABLES,
  REBUILT_GROUPS,
  REBUILT_TABLES,
  SERVING_VIEWS,
  UPDATE_TABLES,
  UPGRADE_NAMES,
} from "../src/update/masterUpgrade.js";
import { COUNTED_TABLES } from "../src/update/planCounts.js";
import { planOnlyRun } from "../src/update/planOnly.js";
import { executeApply, main as updateMain, masterReaderOf } from "../src/update/updateCli.js";
import { localD1 } from "./localD1.js";
import { planCorrections } from "../src/import/correctRecords.js";
import type { CuratedCorrection } from "../src/italian/curatedCorrections.js";

const MASTER = "it-master";
const SCHEMA = "src/db/schema.sql";

const record = (fields: Record<string, unknown>): string => JSON.stringify({ lang_code: "it", ...fields });

// The master's file. `casa` lost its definitions to the extraction, as the real
// July file did, and `andare` says little; the later file fixes both.
const CASA_JULY = record({
  word: "casa", pos: "noun", pos_title: "Sostantivo", tags: ["feminine", "singular"],
  forms: [{ form: "case", tags: ["feminine", "plural"] }],
  senses: [{ glosses: ["casa ( approfondimento) f sing"] }],
});
const CANE = record({ word: "cane", pos: "noun", pos_title: "Sostantivo", tags: ["masculine", "singular"], senses: [{ glosses: ["mammifero domestico"] }] });
const GATTO = { word: "gatto", pos: "noun", pos_title: "Sostantivo", lang_code: "it", senses: [{ glosses: ["felino domestico"] }] };
const SALA = record({ word: "sala", pos: "noun", pos_title: "Sostantivo", senses: [{ glosses: ["stanza ampia"] }] });
const SALE_SALT = record({ word: "sale", pos: "noun", pos_title: "Sostantivo", senses: [{ glosses: ["cloruro di sodio"] }] });
const SALE_PLURAL = record({
  word: "sale", pos: "noun", pos_title: "Sostantivo, forma flessa",
  senses: [{ glosses: ["plurale di sala"], tags: ["form-of"], form_of: [{ word: "sala" }] }],
});
const BELLO = record({ word: "bello", pos: "adj", pos_title: "Aggettivo", senses: [{ glosses: ["gradevole a vedersi"] }] });
const ANDARE_JULY = record({ word: "andare", pos: "verb", pos_title: "Verbo", senses: [{ glosses: ["muoversi"] }] });
const VADO = record({
  word: "vado", pos: "verb", pos_title: "Voce verbale",
  senses: [{ glosses: ["prima persona singolare del presente indicativo di andare"], tags: ["form-of"], form_of: [{ word: "andare" }] }],
});

const MASTER_LINES = [CASA_JULY, CANE, JSON.stringify(GATTO), SALA, SALE_SALT, SALE_PLURAL, BELLO, ANDARE_JULY, VADO];

// The later file, in another order, so no line number agrees with the master's.
const CASA_FIXED = record({
  word: "casa", pos: "noun", pos_title: "Sostantivo", tags: ["feminine", "singular"],
  forms: [{ form: "case", tags: ["feminine", "plural"] }],
  senses: [{ glosses: ["edificio adibito ad abitazione"] }, { glosses: ["famiglia"] }],
});
const ANDARE_FIXED = record({ word: "andare", pos: "verb", pos_title: "Verbo", senses: [{ glosses: ["muoversi"] }, { glosses: ["funzionare"] }] });
// The same content as the master's `gatto`, its keys in another order.
const GATTO_REORDERED = JSON.stringify({ senses: GATTO.senses, lang_code: "it", pos_title: GATTO.pos_title, pos: GATTO.pos, word: GATTO.word });
const BELLO_TRANSLATED = record({ word: "bello", pos: "adj", pos_title: "Aggettivo", senses: [{ glosses: ["gradevole a vedersi"] }], translations: [{ lang_code: "en", word: "beautiful" }] });
const CITTA = record({ word: "città", pos: "noun", pos_title: "Sostantivo", tags: ["feminine", "invariable"], senses: [{ glosses: ["centro abitato"] }] });
const ZAINO = record({ word: "zaino", pos: "noun", pos_title: "Sostantivo", senses: [{ glosses: ["sacca da portare sulle spalle"] }] });
// A gloss ADR 0019's first rule rewrites: the stored row reads "prima", the line keeps "1ª".
const VENGO = record({
  word: "vengo", pos: "verb", pos_title: "Voce verbale",
  senses: [{ glosses: ["1ª persona singolare del presente indicativo di venire"], tags: ["form-of"], form_of: [{ word: "venire" }] }],
});
// Both `sale` records changed: two against two, which the diff will not pair.
const SALE_SALT_LATER = record({ word: "sale", pos: "noun", pos_title: "Sostantivo", senses: [{ glosses: ["cloruro di sodio"], tags: ["uncountable"] }] });
const SALE_PLURAL_LATER = record({
  word: "sale", pos: "noun", pos_title: "Sostantivo, forma flessa",
  senses: [{ glosses: ["plurale di sala"], tags: ["form-of", "plural"], form_of: [{ word: "sala" }] }],
});

const LATER_LINES = [ZAINO, VADO, CITTA, BELLO_TRANSLATED, SALE_PLURAL_LATER, GATTO_REORDERED, ANDARE_FIXED, CANE, CASA_FIXED, SALE_SALT_LATER, VENGO];

const LATER_SHA = createHash("sha256").update(gzipSync(Buffer.from(`${LATER_LINES.join("\n")}\n`, "utf8"))).digest("hex");

interface Desk {
  dir: string;
  db: DatabaseSync;
  later: string;
}

/** What a desk is seeded from: the master's lines, the rows written by hand beside them, and the later lines. */
interface DeskFiles {
  master: readonly string[];
  hand: string;
  later: readonly string[];
}

// What the recovered layer and a review write: a definition read off the raw
// page, listed under the record's first sense, and a note on its gloss.
const CASA_HAND = `
    INSERT INTO raw_page (page_id, release_id, wiki, title, revision_id, revision_timestamp)
      VALUES (1, '${MASTER}', 'it.wiktionary.org', 'casa', 123, '2026-07-01T00:00:00Z');
    INSERT INTO recovered_definition (recovered_id, record_id, release_id, page_id, definition_index, route, term, page_line, wikitext, text, held_as_example, lead_in_sense_index, lead_in_recovered_id)
      VALUES (1, 1, '${MASTER}', 1, 0, 'below-page-control', NULL, 7, '#* edificio', 'edificio', NULL, 0, NULL);
    INSERT INTO recovered_label (recovered_id, label_index, label) VALUES (1, 0, 'architettura');
    INSERT INTO recovered_example (recovered_id, example_index, page_line, wikitext, text) VALUES (1, 0, 8, '#*: una casa', 'una casa');
    INSERT INTO claim_review (record_id, json_pointer, status, note, evidence_url, reviewed_at, reviewed_by)
      VALUES (1, '/senses/0/glosses/0', 'disputed', 'furniture, not a definition', 'https://it.wiktionary.org/wiki/casa', '2026-09-30T00:00:00Z', 'huey');
  `;

const CASA_DESK: DeskFiles = { master: MASTER_LINES, hand: CASA_HAND, later: LATER_LINES };

/** A master seeded from `files.master`, with `files.hand` written beside it, and the later archive on disk. */
async function desk(files: DeskFiles): Promise<Desk> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-update-"));
  const archive = join(dir, "master.jsonl.gz");
  await writeFile(archive, gzipSync(Buffer.from(`${files.master.join("\n")}\n`, "utf8")));
  const { parts } = await seedSql({
    input: archive,
    outputDir: join(dir, "sql"),
    schema: SCHEMA,
    releaseId: MASTER,
    license: "CC-BY-SA-4.0",
    onRejection: (rejection) => {
      throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
    },
  });
  const db = new DatabaseSync(":memory:");
  for (const part of parts) db.exec(await readFile(part, "utf8"));
  db.exec(files.hand);
  const later = join(dir, "later.jsonl.gz");
  await writeFile(later, gzipSync(Buffer.from(`${files.later.join("\n")}\n`, "utf8")));
  return { dir, db, later };
}

async function withDesk(run: (desk: Desk) => Promise<void>, files: DeskFiles = CASA_DESK): Promise<void> {
  const held = await desk(files);
  try {
    await run(held);
  } finally {
    held.db.close();
    await rm(held.dir, { recursive: true, force: true });
  }
}

const readerOf = (db: DatabaseSync): MasterReader => ({ query: <Row>(sql: string) => db.prepare(sql).all() as Row[] });

/**
 * Run an apply's SQL the way `wrangler d1 execute --file` does: as one
 * transaction, D1 batch or D1 import, so a statement that fails undoes the
 * statements before it.
 */
function execute(db: DatabaseSync, sql: string): void {
  db.exec("BEGIN");
  try {
    db.exec(sql);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/** Every row of every table, and the schema: what "the master as it was" means. */
function dump(db: DatabaseSync): string {
  const tables = db.prepare("SELECT name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string; sql: string | null }[];
  return JSON.stringify(
    tables.map(({ name, sql }) => ({
      name,
      sql,
      rows: sql?.startsWith("CREATE TABLE")
        ? (db.prepare(`SELECT * FROM ${name}`).all() as object[]).map((row) => JSON.stringify(row)).sort()
        : [],
    })),
  );
}

/** The rows written by hand beside the records. */
function handRows(db: DatabaseSync): string {
  return JSON.stringify(
    ["raw_page", "recovered_definition", "recovered_label", "recovered_example", "claim_review"].map((table) =>
      (db.prepare(`SELECT * FROM ${table}`).all() as object[]).map((row) => ({ ...row })),
    ),
  );
}

async function diffed(db: DatabaseSync, later: string): Promise<MasterDiff> {
  return diffAgainstMaster(readerOf(db), later);
}

// Synthetic dated catalogs describe these fixture archives, not real releases.
function fixtureCatalog(found: MasterDiff): ArchiveFactsCatalog {
  const fact = (id: `itwiktionary-${string}`) => ({ sourceUrl: "https://example.org/fixture", retrievedAt: "2026-10-01T00:00:00Z", dump: { id, basis: "recorded" as const }, evidence: ["synthetic update fixture"] });
  return { [found.master.archiveSha256]: fact("itwiktionary-20260701"), [found.feed.archiveSha256]: fact("itwiktionary-20260901") };
}

const changeOf = (found: MasterDiff, kind: Change["kind"], word: string): Change => {
  const change = found.diff.changes.find((candidate) => candidate.kind === kind && candidate.word === word);
  assert.ok(change !== undefined, `no ${kind} change for ${word}`);
  return change;
};

async function applied(db: DatabaseSync, later: string, words: readonly [Change["kind"], string][]): Promise<ApplyPlan> {
  const found = await diffed(db, later);
  const plan = await planApply(readerOf(db), found, chooseChanges(found, words.map(([kind, word]) => changeOf(found, kind, word).id)), {
    appliedAt: "2026-10-01T12:00:00Z",
    catalog: fixtureCatalog(found),
  });
  execute(db, plan.sql);
  return plan;
}

const ask = (db: DatabaseSync, query: string): Promise<LookupResult> => lookup({ db: fromNodeSqlite(db), releaseId: MASTER, query });

function readings(result: LookupResult): Reading[] {
  assert.equal(result.outcome, "found", JSON.stringify(result).slice(0, 200));
  return (result as FoundResult).readings;
}

const glosses = (reading: Reading): string[] => reading.senses.flatMap((sense) => sense.glosses.map((gloss) => gloss.text));

test("the diff groups what a later release would change, by word and part of speech, and writes nothing", async () => {
  await withDesk(async ({ db, later }) => {
    const before = dump(db);
    db.exec("PRAGMA query_only = ON");
    const found = await diffed(db, later);
    const report = await reportOf(found);
    db.exec("PRAGMA query_only = OFF");
    assert.equal(dump(db), before);

    const words = (changes: readonly { word: string; pos: string }[]) => changes.map(({ word, pos }) => `${word} ${pos}`);
    assert.deepEqual(words(report.new), ["città noun", "vengo verb", "zaino noun"]);
    assert.deepEqual(words(report.changedSenses), ["andare verb", "casa noun"]);
    assert.deepEqual(words(report.changedElsewhere), ["bello adj"]);
    assert.deepEqual(report.changedElsewhere[0].fields, ["translations"]);
    assert.deepEqual(words(report.lost), ["sala noun"]);
    assert.deepEqual(words(report.ambiguous), ["sale noun"]);
    // `cane` is byte for byte the same, `gatto` the same content in another
    // key order, and `vado` unchanged.
    assert.deepEqual(report.counts, { new: 3, changedSenses: 2, changedElsewhere: 1, lost: 1, ambiguous: 1, unchanged: 3 });
    assert.equal(report.feed.releaseId, `it-${LATER_SHA.slice(0, 8)}`);
    assert.equal(report.feed.archiveSha256, LATER_SHA);

    const markdown = reportMarkdown(report);
    for (const heading of ["## New words", "## Changed or fixed senses", "## Lost words", "## Ambiguous groups", "## Other changes, senses the same"]) {
      assert.ok(markdown.includes(heading), heading);
    }
    for (const change of found.diff.changes) assert.ok(markdown.includes(change.id), change.id);
  });
});

test("records are matched by content, never by line number, and a change keeps its id from run to run", async () => {
  await withDesk(async ({ db, dir, later }) => {
    const first = await diffed(db, later);
    const again = await diffed(db, later);
    const ids = (found: MasterDiff) => found.diff.changes.map((change) => change.id).sort();
    assert.deepEqual(ids(again), ids(first));
    // The same records in yet another order: every line number moves, no id does.
    const shuffled = join(dir, "shuffled.jsonl.gz");
    await writeFile(shuffled, gzipSync(Buffer.from(`${[...LATER_LINES].reverse().join("\n")}\n`, "utf8")));
    const moved = await diffed(db, shuffled);
    assert.deepEqual(ids(moved), ids(first));
    assert.notDeepEqual(
      moved.diff.changes.map((change) => change.kind === "lost" ? 0 : change.feed.lineNo),
      first.diff.changes.map((change) => change.kind === "lost" ? 0 : change.feed.lineNo),
    );
    for (const id of ids(first)) assert.match(id, /^(new|chg|lost)-[0-9a-f]{12}$/);
  });
});

test("an apply writes only the chosen changes, each row naming the release it came from", async () => {
  await withDesk(async ({ db, later }) => {
    const untouched = () =>
      JSON.stringify(
        db.prepare(`SELECT r.*, j.raw_json FROM source_record r JOIN source_record_json j USING (record_id) WHERE r.word IN ('bello', 'sala', 'sale', 'cane', 'gatto', 'vado') ORDER BY record_id`).all(),
      );
    const before = untouched();
    const plan = await applied(db, later, [["changed", "casa"], ["new", "città"]]);
    assert.equal(untouched(), before);
    assert.deepEqual(checkApplied(readerOf(db), plan), { missing: [], differing: [] });

    const feed = `it-${LATER_SHA.slice(0, 8)}`;
    assert.deepEqual(
      { ...db.prepare("SELECT release_id, archive_sha256, status, lines_read, admitted FROM source_release WHERE release_id = ?").get(feed) },
      { release_id: feed, archive_sha256: LATER_SHA, status: "partial", lines_read: LATER_LINES.length, admitted: LATER_LINES.length },
    );
    // The two new records are the later release's, and every row of theirs says so.
    const written = db.prepare("SELECT record_id, release_id, word FROM source_record WHERE record_id > ? ORDER BY record_id").all(MASTER_LINES.length) as { record_id: number; release_id: string; word: string }[];
    // In the later file's line order: città is its line 3, casa its line 9.
    assert.deepEqual(written.map(({ release_id, word }) => `${release_id} ${word}`), [`${feed} città`, `${feed} casa`]);
    for (const table of ["lookup_form", "form_of_edge"]) {
      const releases = db.prepare(`SELECT DISTINCT release_id FROM ${table} WHERE record_id > ?`).all(MASTER_LINES.length) as { release_id: string }[];
      for (const { release_id } of releases) assert.equal(release_id, feed, table);
    }
    // The rows of the records not chosen keep their old release.
    const kept = db.prepare("SELECT DISTINCT release_id FROM lookup_form WHERE record_id <= ?").all(MASTER_LINES.length) as { release_id: string }[];
    assert.deepEqual(kept.map(({ release_id }) => release_id), [MASTER]);
    // The changes are recorded under their ids, the casa change with the record it took over from.
    const changes = db.prepare("SELECT kind, replaced_record_id FROM applied_change ORDER BY kind").all().map((row) => ({ ...row }));
    assert.deepEqual(changes, [{ kind: "changed", replaced_record_id: 1 }, { kind: "new", replaced_record_id: null }]);
    // The changes not chosen are not there: zaino is still unknown, bello still the master's.
    assert.equal((await ask(db, "zaino")).outcome, "not-found");
    const [bello] = readings(await ask(db, "bello"));
    assert.equal(bello.ref.releaseId, MASTER);
  });
});

test("an applied record is the later release's line byte for byte, built by the seed's import path", async () => {
  await withDesk(async ({ db, later }) => {
    await applied(db, later, [["new", "vengo"], ["changed", "casa"]]);
    const stored = (word: string) =>
      (db.prepare("SELECT j.raw_json FROM source_record r JOIN source_record_json j USING (record_id) WHERE r.word = ? AND r.release_id <> ?").get(word, MASTER) as { raw_json: string }).raw_json;
    assert.equal(stored("vengo"), VENGO);
    assert.equal(stored("casa"), CASA_FIXED);
    // ADR 0019's rewrite reaches the stored gloss, never the line.
    const [gloss] = db.prepare("SELECT g.text FROM sense_gloss g JOIN sense s USING (sense_id) JOIN source_record r USING (record_id) WHERE r.word = 'vengo'").all() as { text: string }[];
    assert.equal(gloss.text, "prima persona singolare del presente indicativo di venire");
    // The same rows a seed of the later file writes for the line, but for the record id.
    const line = createHash("sha256").update(VENGO, "utf8").digest("hex");
    assert.deepEqual({ ...db.prepare("SELECT line_sha256, pos_title FROM source_record WHERE word = 'vengo'").get() }, { line_sha256: line, pos_title: "Voce verbale" });
    assert.equal((db.prepare("SELECT count(*) AS n FROM form_of_edge e JOIN source_record r USING (record_id) WHERE r.word = 'vengo'").get() as { n: number }).n, 1);
  });
});

test("an apply never deletes or changes a row written by hand, and the record that replaced it still reads them", async () => {
  await withDesk(async ({ db, later }) => {
    const before = handRows(db);
    await applied(db, later, [["changed", "casa"]]);
    assert.equal(handRows(db), before);
    // Still attached to the record they were written for, which is still there.
    assert.equal((db.prepare("SELECT word FROM source_record WHERE record_id = 1").get() as { word: string }).word, "casa");
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);

    const [casa] = readings(await ask(db, "casa"));
    assert.deepEqual(glosses(casa), ["edificio adibito ad abitazione", "famiglia"]);
    assert.notEqual(casa.ref.releaseId, MASTER);
    // The recovered definition is still read. The sense it was listed under,
    // `casa ( approfondimento) f sing`, is not a sense of the record now, so it
    // moves to the top of the list (#370).
    assert.deepEqual(casa.senses.map((sense) => sense.recoveredItems.length), [0, 0]);
    assert.deepEqual(casa.recovered.map((item) => item.text), ["edificio"]);
    assert.deepEqual(casa.recovered[0].labels, ["architettura"]);
    // The review names the line it was written about: the master's.
    assert.equal(casa.reviews.length, 1);
    assert.deepEqual({ releaseId: casa.reviews[0].ref.releaseId, lineNo: casa.reviews[0].ref.lineNo }, { releaseId: MASTER, lineNo: 1 });
  });
});

// `corona` as a master holds it: two senses, and four definitions recovered
// from its page. The later release carries one of them as a sense of its own,
// and lists the old two in the other order: old sense 1 first, then the new
// sense, then old sense 0.
const CORONA_JULY = record({
  word: "corona", pos: "noun", pos_title: "Sostantivo",
  senses: [{ glosses: ["insieme di persone o cose disposte in cerchio intorno a:"] }, { glosses: ["ornamento circolare che si porta sul capo"] }],
});
const CORONA_FIXED = record({
  word: "corona", pos: "noun", pos_title: "Sostantivo",
  senses: [
    { glosses: ["ornamento circolare che si porta sul capo"] },
    { glosses: ["dinastia regnante di uno stato"] },
    { glosses: ["insieme di persone o cose disposte in cerchio intorno a:"] },
  ],
});
const CORONA_HAND = `
    INSERT INTO raw_page (page_id, release_id, wiki, title, revision_id, revision_timestamp)
      VALUES (1, '${MASTER}', 'it.wiktionary.org', 'corona', 456, '2026-07-01T00:00:00Z');
    INSERT INTO recovered_definition (recovered_id, record_id, release_id, page_id, definition_index, route, term, page_line, wikitext, text, held_as_example, lead_in_sense_index, lead_in_recovered_id) VALUES
      (1, 1, '${MASTER}', 1, 0, 'below-page-control', NULL, 5, '#* dinastia regnante di uno stato:', 'dinastia regnante di uno stato', NULL, NULL, NULL),
      (2, 1, '${MASTER}', 1, 1, 'lead-in-item', NULL, 6, '#*# la corona dei Savoia', 'la corona dei Savoia', NULL, NULL, 1),
      (3, 1, '${MASTER}', 1, 2, 'lead-in-item', NULL, 8, '#* un oggetto posto al centro', 'un oggetto posto al centro', NULL, 0, NULL),
      (4, 1, '${MASTER}', 1, 3, 'below-page-control', NULL, 10, '#* premio dato al vincitore di una gara', 'premio dato al vincitore di una gara', NULL, NULL, NULL);
  `;
const CORONA_DESK: DeskFiles = { master: [CORONA_JULY, CANE], hand: CORONA_HAND, later: [CORONA_FIXED, CANE] };

test("a recovered definition the replacing record carries is shown once, and the rest follow its senses by text", async () => {
  await withDesk(async ({ db, later }) => {
    const recoveredOf = (reading: Reading) => ({
      underSense: reading.senses.map((sense) => sense.recoveredItems.map((item) => item.text)),
      topLevel: reading.recovered.map((item) => item.text),
    });
    // The master's own record reads its rows as they were stored.
    const [before] = readings(await ask(db, "corona"));
    assert.deepEqual(recoveredOf(before), {
      underSense: [["un oggetto posto al centro"], []],
      topLevel: ["dinastia regnante di uno stato", "premio dato al vincitore di una gara"],
    });
    assert.deepEqual(before.recovered[0].items.map((item) => item.text), ["la corona dei Savoia"]);

    await applied(db, later, [["changed", "corona"]]);
    const [corona] = readings(await ask(db, "corona"));
    assert.notEqual(corona.ref.releaseId, MASTER);
    assert.deepEqual(glosses(corona), [
      "ornamento circolare che si porta sul capo",
      "dinastia regnante di uno stato",
      "insieme di persone o cose disposte in cerchio intorno a:",
    ]);
    // `dinastia regnante di uno stato` is a sense now, and is not recovered again.
    const shown = [...glosses(corona), ...everyRecovered(corona).map((item) => item.text)];
    assert.equal(shown.filter((text) => text === "dinastia regnante di uno stato").length, 1);
    // Its item follows it to the sense that carries it, the second; the item
    // of the old first sense follows that sense to its new place, the third;
    // the rest stays at the top of the list.
    assert.deepEqual(recoveredOf(corona), {
      underSense: [[], ["la corona dei Savoia"], ["un oggetto posto al centro"]],
      topLevel: ["premio dato al vincitore di una gara"],
    });
  }, CORONA_DESK);
});

test("a lost word and an id the diff does not find are refused, and nothing is written", async () => {
  await withDesk(async ({ db, later }) => {
    const found = await diffed(db, later);
    const lost = changeOf(found, "lost", "sala").id;
    assert.throws(() => chooseChanges(found, [lost]), (error: unknown) => error instanceof ApplyRefused && /lost word/.test(error.message));
    assert.throws(() => chooseChanges(found, ["chg-000000000000"]), (error: unknown) => error instanceof ApplyRefused && /not a change this diff finds/.test(error.message));
    assert.throws(() => chooseChanges(found, ["casa"]), (error: unknown) => error instanceof ApplyRefused && /not a change id/.test(error.message));
    assert.throws(() => chooseChanges(found, []), ApplyRefused);
    // An ambiguous group has no id to choose.
    assert.ok(!found.diff.changes.some((change) => change.word === "sale"));
    assert.equal((await ask(db, "sala")).outcome, "found");
  });
});

test("lookups serve the master as a whole: a fixed word from the later release beside words still from the first", async () => {
  await withDesk(async ({ db, later }) => {
    await applied(db, later, [["changed", "andare"], ["new", "città"]]);
    const feed = `it-${LATER_SHA.slice(0, 8)}`;
    const [andare] = readings(await ask(db, "andare"));
    assert.deepEqual(glosses(andare), ["muoversi", "funzionare"]);
    assert.equal(andare.ref.releaseId, feed);
    // `vado` is still the master's, and its lemma is the later release's `andare`.
    const [vado] = readings(await ask(db, "vado"));
    assert.equal(vado.ref.releaseId, MASTER);
    const [link] = vado.lemmaLinks;
    assert.ok(link.kind === "candidates");
    assert.deepEqual(link.candidates.map((candidate) => candidate.ref.releaseId), [feed]);
    // And `andare` lists `vado` as its form, from the master's line.
    assert.deepEqual(andare.inflections.map((inflection) => [inflection.word, inflection.refs[0].releaseId]), [["vado", MASTER]]);
    // Its candidate set is the later release's `andare`, found from the master's edge.
    assert.deepEqual(andare.inflections[0].targetCandidates.map((candidate) => candidate.ref.releaseId), [feed]);
    // One record per reading: the retired `andare` is not found beside its successor.
    assert.equal(readings(await ask(db, "andare")).length, 1);

    // The other reads see the new word too: suggestions in key order across both releases, the accent index, a random pick.
    // A prefix is two letters at least (#387), so the master's `ca` and the later release's `ci` are two asks.
    for (const [prefix, words] of [["ca", ["cane", "casa"]], ["ci", ["città"]]] as const) {
      const typed = await suggest({ db: fromNodeSqlite(db), releaseId: MASTER, prefix });
      assert.ok(typed.outcome === "suggested");
      assert.deepEqual(typed.suggestions, words);
    }
    assert.deepEqual(await findNearby({ db: fromNodeSqlite(db), releaseId: MASTER, query: "citta" }), { kind: "accent", best: "città", others: [], phrases: [] });
    const lines = (db.prepare("SELECT min(line_no) AS low, max(line_no) AS high FROM source_record WHERE release_id = ?").get(MASTER) as { low: number; high: number });
    const andareLine = MASTER_LINES.indexOf(ANDARE_JULY) + 1;
    const picked = await randomHeadword({ db: fromNodeSqlite(db), releaseId: MASTER, pos: undefined, random: () => (andareLine - lines.low + 0.5) / (lines.high - lines.low + 1) });
    assert.deepEqual({ word: picked?.word, releaseId: picked?.releaseId }, { word: "andare", releaseId: feed });
  });
});

test("an apply that stops partway leaves the master as it was before it started", async () => {
  await withDesk(async ({ db, later }) => {
    const found = await diffed(db, later);
    const before = dump(db);
    const plan = await planApply(readerOf(db), found, chooseChanges(found, [changeOf(found, "changed", "casa").id, changeOf(found, "new", "città").id]), {
      appliedAt: "2026-10-01T12:00:00Z",
      catalog: fixtureCatalog(found),
    });
    // Planning reads; it writes nothing.
    assert.equal(dump(db), before);
    // A statement that fails after the records, the retirement and the index
    // rows were written: the transaction takes every one of them back.
    const cut = plan.sql.indexOf("INSERT INTO release_table_rows");
    assert.ok(cut > plan.sql.indexOf("INSERT INTO source_record ") && cut > plan.sql.indexOf("DELETE FROM lookup_form"));
    const broken = `${plan.sql.slice(0, cut)}INSERT INTO no_such_table VALUES (1);\n${plan.sql.slice(cut)}`;
    assert.throws(() => execute(db, broken), /no such table/);
    assert.equal(dump(db), before);
    // The whole plan is one file, run once: there is no second statement to stop between.
    execute(db, plan.sql);
    assert.deepEqual(checkApplied(readerOf(db), plan), { missing: [], differing: [] });
  });
});

test("a second apply from the same release adds to it, and the diff then reads the master as changed", async () => {
  await withDesk(async ({ db, later }) => {
    await applied(db, later, [["changed", "casa"]]);
    const again = await diffed(db, later);
    // casa now matches its line; what was not chosen is still on offer.
    assert.ok(!again.diff.changes.some((change) => change.word === "casa"));
    assert.ok(again.diff.changes.some((change) => change.word === "città"));
    await applied(db, later, [["new", "zaino"]]);
    const feed = `it-${LATER_SHA.slice(0, 8)}`;
    assert.equal((db.prepare("SELECT count(*) AS n FROM source_release WHERE release_id = ?").get(feed) as { n: number }).n, 1);
    assert.equal((db.prepare("SELECT rows FROM release_table_rows WHERE release_id = ? AND table_name = 'source_record'").get(feed) as { rows: number }).rows, 2);
    assert.equal(readings(await ask(db, "zaino"))[0].ref.releaseId, feed);
  });
});

test("the upgrade brings a master seeded before #18 up to the schema and is safe to run twice, and an apply waits for it", async () => {
  const fresh = new DatabaseSync(":memory:");
  fresh.exec(await readFile(SCHEMA, "utf8"));
  const schemaOf = (db: DatabaseSync) => JSON.stringify(db.prepare("SELECT type, name, sql FROM sqlite_schema ORDER BY name").all());
  const old = new DatabaseSync(":memory:");
  old.exec(await readFile(SCHEMA, "utf8"));
  for (const view of [...SERVING_VIEWS].reverse()) old.exec(`DROP VIEW ${view}`);
  for (const table of [...UPDATE_TABLES, ...PAGE_ENTRY_TABLES, ...PAGE_ENTRY_FACT_TABLES, ...PAGE_ENTRY_CORRECTION_TABLES, ...CORRECTION_TABLES, ...HAND_KEPT_TABLES, ...HIDE_TABLES].reverse()) old.exec(`DROP TABLE ${table}`);
  assert.deepEqual(missingUpgrade(readerOf(old)), [...UPGRADE_NAMES]);
  assert.deepEqual(
    UPGRADE_NAMES.filter((name) => [...CORRECTION_TABLES, ...HIDE_TABLES].includes(name as never)),
    ["correction_version", "corrected_claim", "corrected_edge", "corrected_form", "hidden_recovered_definition", "hide_version", "hidden_record"],
  );
  const upgrade = masterUpgradeSql(await readFile(SCHEMA, "utf8"));
  const asFresh = (db: DatabaseSync) => schemaOf(db).replaceAll("CREATE TABLE IF NOT EXISTS", "CREATE TABLE").replaceAll("CREATE INDEX IF NOT EXISTS", "CREATE INDEX");
  old.exec(upgrade);
  assert.equal(asFresh(old), schemaOf(fresh));
  assert.deepEqual(missingUpgrade(readerOf(old)), []);
  old.exec(upgrade);
  assert.equal(asFresh(old), schemaOf(fresh));

  // A seeded master without them: the diff reads it and the apply plans, but
  // the apply carries no DDL (#509), so it refuses to write until the upgrade ran.
  await withDesk(async ({ db, later, dir }) => {
    for (const view of [...SERVING_VIEWS].reverse()) db.exec(`DROP VIEW ${view}`);
    for (const table of [...UPDATE_TABLES].reverse()) db.exec(`DROP TABLE ${table}`);
    const d1 = localD1(dir, db);
    const reader = masterReaderOf(d1.target);
    const found = await diffAgainstMaster(reader, later);
    const plan = await planApply(reader, found, chooseChanges(found, [changeOf(found, "changed", "casa").id]), {
      appliedAt: "2026-10-01T12:00:00Z",
      catalog: fixtureCatalog(found),
    });
    assert.doesNotMatch(plan.sql, /\b(CREATE|DROP|ALTER)\b/);
    assert.deepEqual(missingForApply(reader), [...UPDATE_TABLES, ...SERVING_VIEWS]);
    const before = d1.sha256();
    const refused = await executeApply(d1.target, reader, plan, join(dir, "out"), false);
    assert.deepEqual(refused, {
      out: `${d1.target.dictionary} needs pnpm run update:upgrade first, for ${[...UPDATE_TABLES, ...SERVING_VIEWS].join(", ")}. Nothing was written.`,
      status: 1,
    });
    assert.equal(d1.sha256(), before);
    assert.ok(d1.calls.every((call) => call[0] === "--json"), "every call reads");

    assert.equal((await updateMain(["upgrade", "--out", join(dir, "out")], d1.wrangler, { SEED_STATE: d1.persistTo })).status, 0);
    assert.deepEqual(missingForApply(reader), []);
    const written = await executeApply(d1.target, reader, plan, join(dir, "out"), false);
    assert.equal(written.status, 0, written.out);
    const upgraded = d1.open();
    try {
      assert.equal(readings(await ask(upgraded, "casa"))[0].senses.length, 2);
    } finally {
      upgraded.close();
    }
  });
});

test("the upgrade gives a master seeded before #403 its page-entry tables, empty, and lookups answer the same", async () => {
  await withDesk(async ({ db }) => {
    for (const table of [...PAGE_ENTRY_TABLES, ...PAGE_ENTRY_FACT_TABLES, ...PAGE_ENTRY_CORRECTION_TABLES].reverse()) db.exec(`DROP TABLE ${table}`);
    assert.deepEqual(missingUpgrade(readerOf(db)), [...PAGE_ENTRY_TABLES, ...PAGE_ENTRY_FACT_TABLES, ...PAGE_ENTRY_CORRECTION_TABLES, ...PAGE_ENTRY_INDEXES]);
    const casa = await ask(db, "casa");
    assert.equal(casa.outcome, "found");
    const written = () => (db.prepare("SELECT total_changes() AS n").get() as { n: number }).n;
    const before = written();
    execute(db, masterUpgradeSql(await readFile(SCHEMA, "utf8")));
    assert.equal(written(), before, "the upgrade writes no row");
    assert.deepEqual(missingUpgrade(readerOf(db)), []);
    for (const table of [...PAGE_ENTRY_TABLES, ...PAGE_ENTRY_FACT_TABLES, ...PAGE_ENTRY_CORRECTION_TABLES]) assert.equal((db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n, 0);
    assert.deepEqual(await ask(db, "casa"), casa);
  });
});

test("a definition compares the same through comments, spacing, IF NOT EXISTS and a quoted name, and differs on any change to what it defines", async () => {
  const schema = await readFile(SCHEMA, "utf8");
  const stated = createStatement(schema, "TABLE", "corrected_definition");
  const stored = stated.replace(/^CREATE TABLE corrected_definition/, 'CREATE TABLE IF NOT EXISTS "corrected_definition"').replaceAll(/--[^\n]*\n/g, "\n").replaceAll(/\s+/g, "  ");
  assert.equal(definitionOf(stored), definitionOf(stated));
  assert.notEqual(definitionOf(stated.replace("CHECK (text <> '')", "CHECK (text <> ' ')")), definitionOf(stated), "a string literal is compared exactly");
  assert.notEqual(definitionOf(stated.replace("PRIMARY KEY (entry_id, definition_index)", "UNIQUE (entry_id, definition_index)")), definitionOf(stated));
  assert.equal(definitionOf("CREATE INDEX IF NOT EXISTS recovered_entry_by_key ON recovered_entry (release_id, word_key)"), definitionOf(createStatement(schema, "INDEX", "recovered_entry_by_key")));

  // A fresh seed and an upgraded master store schema.sql's definitions, so the upgrade rebuilds neither.
  const fresh = new DatabaseSync(":memory:");
  fresh.exec(schema);
  assert.deepEqual(changedUpgrade(readerOf(fresh), schema), []);
  for (const table of [...PAGE_ENTRY_TABLES, ...PAGE_ENTRY_FACT_TABLES, ...PAGE_ENTRY_CORRECTION_TABLES].reverse()) fresh.exec(`DROP TABLE ${table}`);
  fresh.exec(masterUpgradeSql(schema));
  assert.deepEqual(changedUpgrade(readerOf(fresh), schema), []);
  assert.equal(planUpgrade(readerOf(fresh), schema).sql, "");
});

test("no table outside the rebuilt tables, or outside a rebuilt group, points at one, so the upgrade can rebuild each group alone", async () => {
  const db = new DatabaseSync(":memory:");
  const schema = await readFile(SCHEMA, "utf8");
  db.exec(schema);
  const tables = db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table'").all().map((row) => String(row.name));
  const pointingInto = (rebuilt: ReadonlySet<string>): string[] =>
    tables
      .filter((table) => !rebuilt.has(table))
      .flatMap((table) => db.prepare("SELECT \"table\" AS parent FROM pragma_foreign_key_list(?)").all(table).map((row) => `${table} -> ${String(row.parent)}`))
      .filter((edge) => rebuilt.has(edge.split(" -> ")[1]));
  assert.deepEqual(REBUILT_TABLES, [...PAGE_ENTRY_TABLES, ...PAGE_ENTRY_FACT_TABLES, ...PAGE_ENTRY_CORRECTION_TABLES, "recovered_definition", "recovered_label", "recovered_example", "hidden_record", "corrected_form", "corrected_edge"]);
  assert.deepEqual(pointingInto(new Set<string>(REBUILT_TABLES)), []);
  for (const group of REBUILT_GROUPS) {
    assert.deepEqual(pointingInto(new Set<string>(group.tables)), [], group.tables.join(", "));
    // Every index on a group's tables is one the group creates again, since a drop takes it.
    const indexes = db.prepare(`SELECT name FROM sqlite_schema WHERE type = 'index' AND sql IS NOT NULL AND tbl_name IN (SELECT value FROM json_each(?))`).all(JSON.stringify(group.tables));
    assert.deepEqual(indexes.map((row) => String(row.name)).sort(), [...group.indexes].sort(), group.tables.join(", "));
    for (const name of group.indexes) createStatement(schema, "INDEX", name);
  }
});

/** The rows of each table, by the columns `columns` names for it, in key order. */
function rowsOf(db: DatabaseSync, columns: Readonly<Record<string, readonly string[]>>): string {
  return JSON.stringify(Object.entries(columns).map(([table, names]) => db.prepare(`SELECT ${names.join(", ")} FROM ${table} ORDER BY 1, 2`).all()));
}

test("a master storing the older hidden_record and recovered_definition the live dictionary has is rebuilt to schema.sql's, with every row kept (#511)", async () => {
  await withDesk(async ({ db }) => {
    const schema = await readFile(SCHEMA, "utf8");
    // Give the master the live definitions, keeping the rows the desk wrote by hand.
    const recovered = ["recovered_definition", "recovered_label", "recovered_example"];
    const saved = recovered.map((table) => [table, db.prepare(`SELECT * FROM ${table}`).all()] as const);
    for (const table of ["recovered_label", "recovered_example", "recovered_definition", "hidden_record"]) db.exec(`DROP TABLE ${table}`);
    db.exec(await readFile("fixtures/upgrade-older-tables.sql", "utf8"));
    db.exec(createStatement(schema, "TABLE", "recovered_label"));
    db.exec(createStatement(schema, "TABLE", "recovered_example"));
    for (const [table, rows] of saved) {
      for (const row of rows) {
        const names = Object.keys(row);
        db.prepare(`INSERT INTO ${table} (${names.join(", ")}) VALUES (${names.map(() => "?").join(", ")})`).run(...(Object.values(row) as (string | number | null)[]));
      }
    }
    // A second definition, an item of the first's list, and a hidden record.
    db.exec(`INSERT INTO recovered_definition VALUES (2, 1, '${MASTER}', 1, 1, 'lead-in-item', NULL, 9, '#*: in muratura', 'in muratura', '/senses/0/examples/0/text', NULL, 1)`);
    db.exec(`INSERT INTO hidden_record VALUES (2, '${MASTER}', 1, 'section-language/v1', 'language-line', 'en', 3)`);
    const newer = {
      hidden: `INSERT INTO hidden_record (record_id, release_id, page_id, rule, because, language, page_line, lemma_line) VALUES (3, '${MASTER}', NULL, 'form-of-foreign-lemma/v1', 'lemma-lists-form', 'es', NULL, 42)`,
      recovered: `INSERT INTO recovered_definition (recovered_id, record_id, release_id, page_id, definition_index, route, page_line, wikitext, text) VALUES (3, 1, '${MASTER}', 1, 2, 'wrapped-prose', 11, 'dimora', 'dimora')`,
    };
    assert.throws(() => db.exec(newer.hidden), /no column named lemma_line/);
    assert.throws(() => db.exec(newer.recovered), /CHECK constraint failed/);

    const columns: Record<string, readonly string[]> = Object.fromEntries(
      ["recovered_definition", "recovered_label", "recovered_example", "hidden_record"].map((table) => [
        table,
        db.prepare("SELECT name FROM pragma_table_info(?)").all(table).map((row) => String(row.name)),
      ]),
    );
    const before = rowsOf(db, columns);
    const plan = planUpgrade(readerOf(db), schema);
    assert.deepEqual(plan.missing, []);
    assert.deepEqual(plan.changed, ["recovered_definition", "hidden_record"]);
    // The two groups that hold them, and not the page-entry tables.
    assert.deepEqual(rebuildsOf(plan), [
      { table: "recovered_definition", rows: 2 },
      { table: "recovered_label", rows: 1 },
      { table: "recovered_example", rows: 1 },
      { table: "hidden_record", rows: 1 },
    ]);
    assert.doesNotMatch(plan.sql, /DROP TABLE (recovered_entry|entry_definition|corrected_definition)\b/);
    // D1 refuses a LIKE or GLOB pattern over 50 bytes (#489); every one this SQL holds, the rebuilt GLOB included, is shorter.
    assert.ok(sqlPatterns(plan.sql).some(({ pattern, bytes }) => pattern === "/senses/[0-9]*/examples/[0-9]*/text" && bytes === 35));
    assert.deepEqual(overlongPatterns(plan.sql), []);
    const everyGroup = rebuildSql(schema, REBUILT_TABLES.map((name) => ({ name, columns: columnsOf(createStatement(schema, "TABLE", name)) })));
    assert.deepEqual(overlongPatterns(everyGroup), [], "a rebuild of every group stays within D1's pattern limit");

    execute(db, plan.sql);
    assert.deepEqual(changedUpgrade(readerOf(db), schema), []);
    assert.deepEqual(upgradeShortfall(readerOf(db), schema, plan), []);
    assert.equal(rowsOf(db, columns), before);
    assert.deepEqual(db.prepare("SELECT lemma_line FROM hidden_record").all().map((row) => row.lemma_line), [null]);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);

    // A second run has nothing to do.
    const settled = dump(db);
    assert.equal(planUpgrade(readerOf(db), schema).sql, "");
    assert.equal(dump(db), settled);

    // The values the older CHECKs refused are accepted now.
    db.exec(newer.hidden);
    db.exec(newer.recovered);
    assert.deepEqual(db.prepare("SELECT rule FROM hidden_record ORDER BY record_id").all().map((row) => row.rule), ["section-language/v1", "form-of-foreign-lemma/v1"]);
    assert.deepEqual(db.prepare("SELECT route FROM recovered_definition ORDER BY recovered_id").all().map((row) => row.route), ["below-page-control", "lead-in-item", "wrapped-prose"]);
  });
});

test("a rebuild whose rows the new definition refuses stops whole, and the dictionary keeps its tables and rows", async () => {
  await withDesk(async ({ db }) => {
    const schema = await readFile(SCHEMA, "utf8");
    db.exec("DROP TABLE recovered_entry");
    // Without rule v1's verb-only CHECK (ADR 0028), the old table takes a noun read by rule v1.
    const stated = createStatement(schema, "TABLE", "recovered_entry");
    const without = stated.replace("  CHECK (rule <> 'italian-page-entry/v1' OR (pos = 'verb' AND pos_title = 'Verbo')),\n", "");
    assert.notEqual(without, stated);
    db.exec(without);
    db.exec(createStatement(schema, "INDEX", "recovered_entry_by_key"));
    const [{ release_id: release }] = db.prepare("SELECT release_id FROM source_release").all() as { release_id: string }[];
    db.prepare("INSERT INTO raw_page VALUES (900001, ?, 'it.wiktionary.org', 'scrivania', 4100, '2026-09-01T00:00:00Z')").run(release);
    db.prepare("INSERT INTO recovered_entry VALUES (1, ?, 900001, 'scrivania', 'scrivania', 'noun', 'Verbo', 'italian-page-entry/v1', 3, '')").run(release);
    const plan = planUpgrade(readerOf(db), schema);
    assert.deepEqual(plan.changed, ["recovered_entry"]);
    assert.deepEqual(plan.kept.map(({ name, rows }) => [name, rows]), [["recovered_entry", 1], ["entry_definition", 0], ["entry_label", 0], ["entry_example", 0], ["entry_fact", 0], ["corrected_definition", 0]]);
    const before = JSON.stringify(db.prepare("SELECT name, sql FROM sqlite_schema ORDER BY name").all());
    assert.throws(() => execute(db, plan.sql), /CHECK constraint failed/);
    assert.equal(JSON.stringify(db.prepare("SELECT name, sql FROM sqlite_schema ORDER BY name").all()), before);
    assert.equal((db.prepare("SELECT count(*) AS n FROM recovered_entry").get() as { n: number }).n, 1);
    assert.deepEqual(upgradeShortfall(readerOf(db), schema, plan), ["the upgrade left recovered_entry unlike schema.sql's definition"]);
  });
});

/** Every row of every table, by table name: what a view-only upgrade must leave as it was. */
function tableRows(db: DatabaseSync): string {
  const tables = db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((row) => String(row.name));
  return JSON.stringify(tables.map((table) => [table, (db.prepare(`SELECT * FROM ${table}`).all() as object[]).map((row) => JSON.stringify(row)).sort()]));
}

/** The `sql` sqlite_schema stores for `name`. */
const storedSqlOf = (db: DatabaseSync, name: string): string => String((db.prepare("SELECT sql FROM sqlite_schema WHERE name = ?").get(name) as { sql: string }).sql);

test("a master storing an older serving view gets schema.sql's from the upgrade, which replaces the views and rebuilds no table (#525)", async () => {
  await withDesk(async ({ db }) => {
    const schema = await readFile(SCHEMA, "utf8");
    const current = createStatement(schema, "VIEW", "surface_hit");
    const older = current.replace(/^\s*lf\.form_source,\n/m, "");
    assert.notEqual(older, current);
    db.exec("DROP VIEW surface_hit");
    db.exec(older);
    const before = tableRows(db);

    const plan = planUpgrade(readerOf(db), schema);
    assert.deepEqual(plan.missing, []);
    assert.deepEqual(plan.changed, []);
    assert.deepEqual(plan.replaced, ["surface_hit"]);
    assert.deepEqual(plan.kept, []);
    assert.match(plan.sql, /DROP VIEW IF EXISTS surface_hit;/);
    assert.match(plan.sql, /CREATE VIEW surface_hit AS/);
    assert.doesNotMatch(plan.sql, /DROP TABLE/);
    assert.doesNotMatch(plan.sql, /upgrade_kept_/);
    // Before the SQL runs, the read-back names the view it left unlike schema.sql's.
    assert.deepEqual(upgradeShortfall(readerOf(db), schema, plan), ["the upgrade left the view surface_hit unlike schema.sql's definition"]);

    execute(db, plan.sql);
    assert.equal(definitionOf(storedSqlOf(db, "surface_hit")), definitionOf(current));
    assert.deepEqual(changedViews(readerOf(db), schema), []);
    assert.deepEqual(upgradeShortfall(readerOf(db), schema, plan), []);
    assert.equal(planUpgrade(readerOf(db), schema).sql, "");
    assert.equal(tableRows(db), before);
  });
});

test("a fresh seed, and serving views that differ from schema.sql's only in comments and spacing, get no upgrade (#525)", async () => {
  const schema = await readFile(SCHEMA, "utf8");
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(schema);
    assert.deepEqual(changedViews(readerOf(db), schema), []);
    assert.equal(planUpgrade(readerOf(db), schema).sql, "");

    for (const view of [...SERVING_VIEWS].reverse()) db.exec(`DROP VIEW ${view}`);
    for (const view of SERVING_VIEWS) {
      const stated = createStatement(schema, "VIEW", view);
      const respaced = stated
        .replaceAll(/--[^\n]*\n/g, "\n")
        .replaceAll(/\s+/g, "   ")
        .replace(/\bAS\b/, "AS -- written by an older schema.sql\n /* with other spacing */");
      db.exec(respaced);
      assert.notEqual(storedSqlOf(db, view), stated.replace(/;\s*$/, ""), view);
    }
    assert.deepEqual(changedViews(readerOf(db), schema), []);
    assert.equal(planUpgrade(readerOf(db), schema).sql, "");
  } finally {
    db.close();
  }
});

// Synthetic releases exercise sequential corrections/removal, not upstream extraction.
test("automatic updates follow A→B→C, retain source and hand rows, move indexes/caches, and repeat without writes", async () => {
  const corrected = record({ word: "casa", pos: "noun", pos_title: "Sostantivo", forms: [{ form: "casette", tags: ["plural"] }], senses: [{ glosses: ["abitazione corretta"] }, { glosses: ["nucleo familiare"] }] });
  // A removal with no blank in its place: an emptied record would keep B serving (#442).
  const removed = record({ word: "casa", pos: "noun", pos_title: "Sostantivo", forms: [], senses: [{ glosses: ["nucleo familiare"] }] });
  await withDesk(async ({ db, later, dir }) => {
    const reader = readerOf(db);
    const schema = await readFile(SCHEMA, "utf8");
    const pages = { dump: "itwiktionary-20260901", pages: [], languages: LanguageHeadings.fromList(["it", "en"]) };
    const foundB = await diffed(db, later);
    const catalog: Record<string, ArchiveFactsCatalog[string]> = { ...fixtureCatalog(foundB) };
    const beforeHand = handRows(db);
    const versionA = await servedVersion(fromNodeSqlite(db), MASTER);
    const planB = await automaticPlan(reader, foundB, pages, { appliedAt: "2026-10-01T12:00:00Z", catalog });
    assert.ok(planB);
    assert.deepEqual(planB.changes.map(({ change }) => change.word).sort(), ["casa", "città"]);
    // A partial prior application may leave eligible records from this same feed.
    const casaChange = chooseChanges(foundB, [changeOf(foundB, "changed", "casa").id]);
    const partial = await planApply(reader, foundB, casaChange, { appliedAt: "2026-10-01T12:00:00Z", catalog });
    execute(db, partial.sql);
    const casaB = readings(await ask(db, "casa"))[0];
    assert.deepEqual(glosses(casaB), ["abitazione corretta", "nucleo familiare"]);
    assert.equal((await ask(db, "casette")).outcome, "found");
    const versionB = await servedVersion(fromNodeSqlite(db), MASTER);
    assert.notDeepEqual(versionB, versionA);
    const remaining = await automaticPlan(reader, await diffed(db, later), pages, { appliedAt: "2026-10-01T13:00:00Z", catalog });
    assert.ok(remaining);
    assert.deepEqual(remaining.changes.map(({ change }) => change.word), ["città"]);
    execute(db, remaining.sql);
    assert.deepEqual(checkApplied(reader, remaining), { missing: [], differing: [] });

    const versionBeforeC = await servedVersion(fromNodeSqlite(db), MASTER);
    const next = join(dir, "next.jsonl.gz");
    await writeFile(next, gzipSync(Buffer.from(`${[removed, CANE, CITTA, SALE_SALT, SALE_PLURAL].join("\n")}\n`)));
    const foundC = await diffed(db, next);
    catalog[foundC.feed.archiveSha256] = { ...catalog[foundB.feed.archiveSha256], dump: { id: "itwiktionary-20261001", basis: "recorded" } };
    const planC = await automaticPlan(reader, foundC, { ...pages, dump: "itwiktionary-20261001" }, { appliedAt: "2026-10-02T12:00:00Z", catalog });
    assert.ok(planC);
    assert.deepEqual(planC.changes.map(({ change }) => change.word), ["casa"]);
    execute(db, planC.sql);
    assert.deepEqual(checkApplied(reader, planC), { missing: [], differing: [] });
    const casaC = readings(await ask(db, "casa"))[0];
    assert.deepEqual(glosses(casaC), ["nucleo familiare"]);
    assert.equal(casaC.ref.releaseId, foundC.feed.releaseId);
    assert.equal(casaC.ref.lineNo, 1);
    assert.deepEqual({ ...db.prepare("SELECT upstream_release, upstream_release_basis, archive_sha256 FROM source_release WHERE release_id = ?").get(foundC.feed.releaseId) }, { upstream_release: "itwiktionary-20261001", upstream_release_basis: "recorded", archive_sha256: foundC.feed.archiveSha256 });
    assert.deepEqual(casaC.recovered.map((item) => item.text), ["edificio"]);
    assert.equal(casaC.reviews[0].ref.releaseId, MASTER);
    assert.equal(handRows(db), beforeHand);
    const raw = db.prepare("SELECT raw_json FROM source_record_json j JOIN source_record r USING (record_id) WHERE r.word = 'casa' ORDER BY record_id").all().map((row) => row.raw_json);
    assert.deepEqual(raw, [CASA_FIXED, corrected, removed]);
    assert.ok(casaC.recordId !== undefined);
    const ids = db.prepare(`SELECT record_id FROM ${lineagesOf("?1")} ORDER BY record_id`).all(JSON.stringify([casaC.recordId])).map((row) => row.record_id);
    assert.deepEqual(ids, [1, partial.changes[0].recordId, planC.changes[0].recordId]);
    assert.equal(db.prepare("SELECT count(*) AS n FROM sense WHERE record_id IN (?,?)").get(1, partial.changes[0].recordId)?.n, 4);
    assert.equal(db.prepare("SELECT count(*) AS n FROM lookup_form WHERE surface_key = 'casette'").get()?.n, 0);
    assert.equal(db.prepare("SELECT count(*) AS n FROM accent_fold WHERE surface_key = 'casette'").get()?.n, 0);
    assert.equal(db.prepare("SELECT count(*) AS n FROM typo_key WHERE surface_key = 'casette'").get()?.n, 0);
    assert.equal(db.prepare("SELECT count(*) AS n FROM lookup_form WHERE record_id IN (?,?)").get(1, partial.changes[0].recordId)?.n, 0);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    const versionC = await servedVersion(fromNodeSqlite(db), MASTER);
    assert.notDeepEqual(versionC, versionBeforeC);
    const stable = dump(db);
    assert.equal(await automaticPlan(reader, await diffed(db, next), { ...pages, dump: "itwiktionary-20261001" }, { appliedAt: "2026-10-02T13:00:00Z", catalog }), null);
    assert.equal(dump(db), stable);
    assert.throws(() => execute(db, planC.sql));
    assert.equal(dump(db), stable, "replaying stale SQL fails atomically, not a supported no-op");
    assert.throws(() => chooseChanges(foundC, ["chg-000000000000"]), /not a change/);
    const refreshed = await diffed(db, next);
    assert.throws(() => chooseChanges(refreshed, planC.changes.map(({ change }) => change.id)), /not a change/);
    assert.equal(dump(db), stable);
    await assert.rejects(planApply(reader, foundC, [planC.changes[0].change, planC.changes[0].change], { appliedAt: "2026-10-02T13:00:00Z", catalog }), /duplicate changes/);
    await assert.rejects(automaticPlan(reader, await diffed(db, later), pages, { appliedAt: "2026-10-02T13:00:00Z", catalog }), /not a newer dump/);
    assert.equal(dump(db), stable);
  }, { master: [CASA_FIXED, CANE, SALA, SALE_SALT, SALE_PLURAL], hand: CASA_HAND, later: [corrected, CANE, CITTA, SALE_SALT_LATER, SALE_PLURAL_LATER, VENGO] });
});

test("selection refuses unknown, invalid, same-dump and regressive source ordering before writes", async () => {
  await withDesk(async ({ db, later }) => {
    const found = await diffed(db, later);
    const catalog = fixtureCatalog(found);
    const pages = { dump: "itwiktionary-20260901", pages: [], languages: LanguageHeadings.fromList(["it"]) };
    const schema = await readFile(SCHEMA, "utf8");
    const before = dump(db);
    for (const [dumpId, expected] of [["itwiktionary-20260701", /not a newer dump/], ["itwiktionary-20260601", /not a newer dump/], ["itwiktionary-20260230", /invalid dump date/]] as const) {
      const altered: ArchiveFactsCatalog = { ...catalog, [found.feed.archiveSha256]: { ...catalog[found.feed.archiveSha256], dump: { id: dumpId, basis: "recorded" } } };
      await assert.rejects(automaticPlan(readerOf(db), found, pages, { appliedAt: "2026-10-01T12:00:00Z", catalog: altered }), expected);
    }
    await assert.rejects(automaticPlan(readerOf(db), found, pages, { appliedAt: "2026-10-01T12:00:00Z", catalog: {} }), /no dated dump facts/);
    assert.equal(dump(db), before);
  });
});

test("update:auto's plan-only run returns its counts and leaves a local D1 byte-identical", async () => {
  await withDesk(async ({ db, later, dir }) => {
    const d1 = localD1(dir, db);
    const reader = masterReaderOf(d1.target);
    const before = d1.sha256();
    const found = await diffAgainstMaster(reader, later);
    const pages = { dump: "itwiktionary-20260901", pages: [], languages: LanguageHeadings.fromList(["it", "en"]) };
    const plan = await automaticPlan(reader, found, pages, { appliedAt: "2026-10-01T12:00:00Z", catalog: fixtureCatalog(found) });
    assert.ok(plan);
    const run = planOnlyRun("update:auto", plan.counts, reader);
    assert.deepEqual(run.counts.records, { added: 2, changed: 2, removed: 0 });
    assert.equal(run.dictionaryRecords, MASTER_LINES.length);
    assert.equal(d1.sha256(), before);
    assert.ok(d1.calls.every((call) => call[0] === "--json"), "every call reads");

    // The counts are what the file does: each table moves by its rows written less its rows deleted.
    const rows = () => Object.fromEntries(COUNTED_TABLES.map((table) => [table, (db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n]));
    const held = rows();
    execute(db, plan.sql);
    const moved = rows();
    for (const table of COUNTED_TABLES.filter((name) => name !== "release_table_rows")) {
      assert.equal(moved[table] - held[table], (plan.counts.written[table] ?? 0) - (plan.counts.deleted[table] ?? 0), table);
    }
  });
});

test("an update:auto apply holds no DDL and leaves the schema, the serving views' stored SQL included, as it was (#509)", async () => {
  await withDesk(async ({ db, later }) => {
    const reader = readerOf(db);
    const found = await diffAgainstMaster(reader, later);
    const pages = { dump: "itwiktionary-20260901", pages: [], languages: LanguageHeadings.fromList(["it", "en"]) };
    const plan = await automaticPlan(reader, found, pages, { appliedAt: "2026-10-01T12:00:00Z", catalog: fixtureCatalog(found) });
    assert.ok(plan);
    assert.deepEqual(missingForApply(reader), []);
    assert.doesNotMatch(plan.sql, /\b(CREATE|DROP|ALTER)\b/);
    const views = () => db.prepare("SELECT name, sql FROM sqlite_schema WHERE type = 'view' ORDER BY name").all().map((row) => ({ ...row }));
    // SQLite moves schema_version on every schema change, a view dropped and created again included.
    const schemaVersion = () => (db.prepare("PRAGMA schema_version").get() as { schema_version: number }).schema_version;
    const [heldViews, heldVersion] = [views(), schemaVersion()];
    assert.deepEqual(heldViews.map(({ name }) => name), [...SERVING_VIEWS].sort());
    execute(db, plan.sql);
    assert.deepEqual(checkApplied(reader, plan), { missing: [], differing: [] });
    assert.deepEqual(views(), heldViews);
    assert.equal(schemaVersion(), heldVersion);
  });
});

test("a curated correction stays on the record a change retires, and the apply reports it rather than carry it over (#420)", async () => {
  await withDesk(async ({ db, later }) => {
    const [{ record_id: casaId }] = db.prepare(`SELECT record_id FROM source_record WHERE release_id = '${MASTER}' AND line_no = 1`).all() as { record_id: number }[];
    // A synthetic entry on the master's `casa`, to test the mechanism; no ruling says casa is masculine.
    const casa: CuratedCorrection = {
      record: { releaseId: MASTER, lineNo: 1, lineSha256: createHash("sha256").update(CASA_JULY, "utf8").digest("hex"), word: "casa", pos: "noun" },
      facts: { gender: { overrides: { pointer: "/tags/0", text: "feminine" }, value: "masculine" } },
      evidence: [{ wiki: "it.wiktionary.org", title: "casa", revisionId: 1, shows: "synthetic" }],
    };
    const schema = await readFile(SCHEMA, "utf8");
    execute(db, planCorrections(readerOf(db), [casa]).sql);
    const genders = async (): Promise<string[]> =>
      readings(await ask(db, "casa")).flatMap((reading) =>
        reading.grammar.record.flatMap((claim) => (claim.status !== "unclassified" && claim.status !== "missing" && claim.dimension === "gender" ? [`${claim.status} ${claim.value}`] : [])),
      );
    assert.deepEqual(await genders(), ["corrected masculine"]);

    const plan = await applied(db, later, [["changed", "casa"]]);
    const [change] = plan.changes;
    assert.deepEqual(plan.retiredCorrections, [{ correctionId: `${MASTER}:1`, recordId: casaId, replacedBy: change.recordId, changeId: change.change.id }]);
    // The newer record states its own gender, which the correction does not reach.
    assert.deepEqual(await genders(), ["stated feminine"]);
    // The correction stays on the retired record, and a later run reports it instead of writing it.
    assert.deepEqual(db.prepare("SELECT record_id FROM corrected_claim").all().map((row) => ({ ...row })), [{ record_id: casaId }]);
    const again = planCorrections(readerOf(db), [casa]);
    assert.equal(again.sql, "");
    assert.deepEqual(again.entries.map((entry) => entry.state), ["retired"]);
  });
});

test("a corrected edge stays on the record a change retires, no lookup lists that record as a form through it, and the apply reports it (#722)", async () => {
  await withDesk(async ({ db, later }) => {
    const [{ record_id: casaId }] = db.prepare(`SELECT record_id FROM source_record WHERE release_id = '${MASTER}' AND line_no = 1`).all() as { record_id: number }[];
    // A synthetic entry on the master's `casa`, to test the mechanism; no ruling says casa is a form of cane.
    const casa: CuratedCorrection = {
      record: { releaseId: MASTER, lineNo: 1, lineSha256: createHash("sha256").update(CASA_JULY, "utf8").digest("hex"), word: "casa", pos: "noun" },
      edge: { sense: 0, gloss: { pointer: "/senses/0/glosses/0", text: "synthetic" }, target: "cane" },
      evidence: {
        form: { wiki: "it.wiktionary.org", title: "casa", revisionId: 1, shows: "synthetic" },
        base: { wiki: "it.wiktionary.org", title: "cane", revisionId: 2, shows: "casa" },
      },
    };
    execute(db, planCorrections(readerOf(db), [casa]).sql);
    const held = () => db.prepare("SELECT record_id, correction_id, evidence_url, base_evidence_url FROM corrected_edge").all().map((row) => ({ ...row }));
    const before = held();
    assert.deepEqual(before.map((row) => row.record_id), [casaId]);
    const formsOfCane = async (): Promise<number[]> =>
      readings(await ask(db, "cane")).flatMap((reading) => reading.inflections.map((link) => link.recordId));
    assert.deepEqual(await formsOfCane(), [casaId]);

    const plan = await applied(db, later, [["changed", "casa"]]);
    const [change] = plan.changes;
    assert.deepEqual(plan.retiredCorrections, [{ correctionId: `${MASTER}:1/senses/0`, recordId: casaId, replacedBy: change.recordId, changeId: change.change.id }]);
    assert.doesNotMatch(plan.sql, /corrected_edge/);
    // The row and its evidence stay beside the retired record (ADR 0025, ADR 0027), and no lookup lists that record as a form through it.
    assert.deepEqual(held(), before);
    assert.deepEqual(await formsOfCane(), []);
    // A later run reports the entry instead of writing it.
    const again = planCorrections(readerOf(db), [casa]);
    assert.equal(again.sql, "");
    assert.deepEqual(again.edges.map((entry) => entry.state), ["retired"]);
  });
});
