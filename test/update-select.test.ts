// The selection of a later release's changes over a real master (#377): a
// small master seeded through the seed's own SQL, a later archive, and the
// later archive's pages for #29's language rule. Every change lands in one
// bucket, and the ids taken are the ones `update:apply --ids` accepts.

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { gzipSync } from "node:zlib";
import { seedSql } from "../src/import/seedSql.js";
import { LanguageHeadings } from "../src/italian/sectionLanguage.js";
import { RAW_PAGE_WIKI, type RawPage } from "../src/source/rawPage.js";
import { boundedInserts, chooseChanges } from "../src/update/apply.js";
import { diffAgainstMaster } from "../src/update/diff.js";
import type { MasterReader } from "../src/update/master.js";
import { selectChanges, selectionIds, selectionMarkdown } from "../src/update/select.js";
import { idsInFile } from "../src/update/updateCli.js";

const record = (fields: Record<string, unknown>): string => JSON.stringify({ lang_code: "it", pos: "noun", pos_title: "Sostantivo", ...fields });

const MASTER_LINES = [
  record({ word: "casa", senses: [{ glosses: ["casa ( approfondimento) f sing"] }] }),
  record({ word: "cane", senses: [{ glosses: ["mammifero domestico"] }] }),
  record({ word: "sala", senses: [{ glosses: ["stanza ampia"] }] }),
];

const LATER_LINES = [
  // Fixed: ours shows only the headword line.
  record({ word: "casa", senses: [{ glosses: ["edificio adibito ad abitazione"] }] }),
  // Reworded.
  record({ word: "cane", senses: [{ glosses: ["animale domestico"] }] }),
  // New, and a form-of of it: taken together.
  record({ word: "antifurto", senses: [{ glosses: ["dispositivo contro i furti"] }] }),
  record({ word: "antifurti", pos_title: "Sostantivo, forma flessa", senses: [{ glosses: ["plurale di antifurto"], form_of: [{ word: "antifurto" }] }] }),
  // New, a form-of a word nobody has.
  record({ word: "sali", pos_title: "Sostantivo, forma flessa", senses: [{ glosses: ["plurale di salo"], form_of: [{ word: "salo" }] }] }),
  // New, under a bare English line on its page.
  record({ word: "skirmish", senses: [{ glosses: ["scaramuccia"] }] }),
  // New, the placeholder only.
  record({ word: "zufolo", senses: [{ glosses: ["definizione mancante; se vuoi, aggiungila tu"] }] }),
];

const page = (title: string, wikitext: string): RawPage => ({ wiki: RAW_PAGE_WIKI, title, revisionId: 1, timestamp: "2026-09-01T00:00:00Z", wikitext });

const PAGES: RawPage[] = [
  page("casa", "== {{-it-}} ==\n{{-sost-|it}}\n# edificio adibito ad abitazione"),
  page("skirmish", "== {{-it-}} ==\n{{-en-}}\n{{-sost-}}\n# scaramuccia"),
];

const readerOf = (db: DatabaseSync): MasterReader => ({ query: <Row>(sql: string) => db.prepare(sql).all() as Row[] });

test("every change lands in one bucket, and the taken ids are ones the apply accepts", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lexema-select-"));
  const db = new DatabaseSync(":memory:");
  try {
    const master = join(dir, "master.jsonl.gz");
    await writeFile(master, gzipSync(Buffer.from(`${MASTER_LINES.join("\n")}\n`, "utf8")));
    const { parts } = await seedSql({ input: master, outputDir: join(dir, "sql"), schema: "src/db/schema.sql", releaseId: "it-master", license: "CC-BY-SA-4.0", onRejection: () => {} });
    for (const part of parts) db.exec(await readFile(part, "utf8"));
    const later = join(dir, "later.jsonl.gz");
    await writeFile(later, gzipSync(Buffer.from(`${LATER_LINES.join("\n")}\n`, "utf8")));

    const found = await diffAgainstMaster(readerOf(db), later);
    const selection = await selectChanges(readerOf(db), found, { dump: "itwiktionary-test", pages: PAGES, languages: LanguageHeadings.fromList(["it", "en"]) });

    const verdicts = Object.fromEntries([...selection.taken, ...selection.skipped].map((entry) => [entry.word, entry.reason]));
    assert.deepEqual(verdicts, {
      antifurti: "new-word",
      antifurto: "new-word",
      casa: "fills-gloss",
      cane: "rewording",
      sali: "form-of-target-missing",
      skirmish: "not-italian",
      zufolo: "no-real-gloss",
    });
    assert.deepEqual(selection.taken.map((entry) => entry.word), ["antifurti", "antifurto", "casa"]);
    assert.deepEqual(selection.lost.map((entry) => entry.word), ["sala"]);
    assert.equal(selection.counts.taken["new-word"], 2);
    assert.equal(selection.counts.skipped.rewording, 1);

    // The ids file reads back to the taken ids, and the apply chooses every one of them.
    const ids = idsInFile(selectionIds(selection));
    assert.deepEqual(ids, selection.taken.map((entry) => entry.id));
    assert.equal(chooseChanges(found, ids).length, 3);

    const markdown = selectionMarkdown(selection);
    assert.match(markdown, /\| Applied \| new-word \| 2 \|/);
    assert.match(markdown, /### fills-gloss \(1\)/);
    assert.match(markdown, /\| lost-[0-9a-f]{12} \| sala \| noun \| it-master:3 \|/);
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("an apply of many records writes no statement D1 refuses as too long", () => {
  // A stored line can be tens of kilobytes; two hundred of them made one
  // INSERT of megabytes, which D1 refuses with SQLITE_TOOBIG over 100 KB.
  const tuples = Array.from({ length: 300 }, (_, index) => `(${index},'${"x".repeat(20_000)}')`);
  const statements = boundedInserts("source_record_json", tuples);
  assert.ok(statements.length > 1);
  for (const statement of statements) assert.ok(Buffer.byteLength(statement) < 100 * 1024, `${Buffer.byteLength(statement)} bytes`);
  assert.equal(statements.join("").match(/\(\d+,'x+'\)/g)?.length, 300);
  // A tuple over the bound still goes, alone.
  assert.equal(boundedInserts("source_record_json", [`(1,'${"y".repeat(70_000)}')`, "(2,'z')"]).length, 2);
});
