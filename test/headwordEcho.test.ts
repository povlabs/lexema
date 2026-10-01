// A gloss that only repeats its headword is no gloss (#395). The matcher is
// checked on its own, then the lookup over the real archive lines in
// `fixtures/headword-echo.jsonl`: asciugatoio and presina (whose `m`/`f` stamp
// rule it-gloss-stamp/v1 takes off), `sci di fondo;`, dm's `DM`, and sci, whose
// gloss names the headword inside a meaning and stays.

import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { seedSql } from "../src/import/seedSql.js";
import { isHeadwordEcho, shownGloss } from "../src/italian/headwordEcho.js";
import { lookup } from "../src/lookup/lookup.js";
import type { LookupResult, Reading } from "../src/lookup/types.js";
import { readOnlyDictionary } from "./databases.js";

const RELEASE = "it-0c432803";
const FIXTURE = "fixtures/headword-echo.jsonl";

test("a gloss equal to the headword is an echo, across case, accents, apostrophes and the punctuation around it", () => {
  assert.equal(isHeadwordEcho("presina", "presina"), true);
  assert.equal(isHeadwordEcho("Presina", "presina"), true, "case");
  assert.equal(isHeadwordEcho("DM", "dm"), true, "case");
  assert.equal(isHeadwordEcho("citta", "città"), true, "accents");
  assert.equal(isHeadwordEcho("città", "città"), true, "decomposed accent");
  assert.equal(isHeadwordEcho("po’", "po'"), true, "apostrophe");
  assert.equal(isHeadwordEcho("sci di fondo;", "sci di fondo"), true, "trailing punctuation");
  assert.equal(isHeadwordEcho(" «presina». ", "presina"), true, "quotes and spaces around it");
});

test("a gloss that only contains the headword is a meaning", () => {
  assert.equal(isHeadwordEcho("sport associato all'attività di andare sugli sci", "sci"), false);
  assert.equal(isHeadwordEcho("presina elettrica", "presina"), false);
  assert.equal(isHeadwordEcho("casa ( approfondimento)", "casa"), false, "the headword line is furniture, not an echo");
  assert.equal(isHeadwordEcho("sci di", "sci di fondo"), false);
  assert.equal(isHeadwordEcho("…", "…"), false, "nothing to compare once the punctuation goes");
});

test("a shown gloss drops the placeholder and the echo, and keeps everything else as stored", () => {
  assert.equal(shownGloss("presina", "presina"), undefined);
  assert.equal(shownGloss("definizione mancante; se vuoi, aggiungila tu", "pescante"), undefined);
  assert.equal(shownGloss("domani", "dm"), "domani");
  assert.equal(shownGloss("sci di fondo;", "sci"), "sci di fondo;");
});

async function withEchoWords(run: (db: DatabaseSync) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-headword-echo-"));
  const archive = join(dir, "fixture.jsonl.gz");
  await writeFile(archive, gzipSync(await readFile(FIXTURE)));
  const { parts } = await seedSql({
    input: archive,
    outputDir: join(dir, "sql"),
    schema: "src/db/schema.sql",
    releaseId: RELEASE,
    archiveR2Key: `releases/${RELEASE}.jsonl.gz`,
    license: "CC-BY-SA-4.0",
    onRejection: (rejection) => {
      throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
    },
  });
  const db = new DatabaseSync(":memory:");
  try {
    for (const part of parts) db.exec(await readFile(part, "utf8"));
    await run(db);
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
}

async function reading(db: DatabaseSync, query: string): Promise<Reading> {
  // Read-only, so the filter provably writes nothing back.
  const result: LookupResult = await lookup({ db: readOnlyDictionary(db), releaseId: RELEASE, query });
  assert.ok(result.outcome === "found", `${query}: expected a found result, got ${result.outcome}`);
  const [only, ...rest] = result.readings;
  assert.deepEqual(rest, [], `${query}: one reading`);
  return only;
}

const glossTexts = (r: Reading): string[][] => r.senses.map((sense) => sense.glosses.map((gloss) => gloss.text));

test("presina and asciugatoio: once the stamp is off, the gloss repeats the headword, so their one sense says nothing", async () => {
  await withEchoWords(async (db) => {
    for (const word of ["presina", "asciugatoio"]) {
      const r = await reading(db, word);
      assert.deepEqual(glossTexts(r), [[]], word);
      assert.equal(r.senses[0]?.ref.jsonPointer, "/senses/0", `${word}: the sense itself stays`);
    }
  });
});

test("an echo behind punctuation or in capitals is no gloss; the record's other meanings stay", async () => {
  await withEchoWords(async (db) => {
    assert.deepEqual(glossTexts(await reading(db, "sci di fondo")), [[]]);
    const dm = await reading(db, "dm");
    assert.deepEqual(glossTexts(dm), [["domani"], []]);
    assert.equal(dm.senses[0]?.glosses[0]?.ref.jsonPointer, "/senses/0/glosses/0");
  });
});

test("sci: a gloss that names the headword inside a meaning stays", async () => {
  await withEchoWords(async (db) => {
    const sci = await reading(db, "sci");
    assert.equal(sci.senses.length, 2);
    assert.deepEqual(sci.senses[1]?.glosses.map((gloss) => gloss.text), ["sport associato all'attività di andare sugli sci"]);
  });
});

test("the stored rows and the record's line keep the echo as imported", async () => {
  await withEchoWords(async (db) => {
    const lines = (await readFile(FIXTURE, "utf8")).trim().split("\n");
    const raw = () => db.prepare("SELECT raw_json FROM source_record_json ORDER BY record_id").all().map((row) => row.raw_json);
    assert.deepEqual(raw(), lines, "source_record_json is the archive line, byte for byte");
    const stored = db.prepare("SELECT text FROM sense_gloss ORDER BY text").all().map((row) => row.text);
    for (const echo of ["presina", "asciugatoio", "sci di fondo;", "DM"]) assert.ok(stored.includes(echo), `sense_gloss still holds ${echo}`);
    await reading(db, "presina");
    assert.deepEqual(raw(), lines);
  });
});
