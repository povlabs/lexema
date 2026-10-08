// Every LIKE and GLOB pattern in the dictionary schema stays within D1's limit
// (#489). CI's `db:check-d1` writes sample rows to the app tables only, and the
// tests run on node:sqlite, which takes any length, so this is the one check
// that keeps src/db/schema.sql seedable on D1.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { D1_PATTERN_LIMIT, overlongPatterns, sqlPatterns } from "../src/db/d1PatternLimit.js";

const schema = readFileSync(fileURLToPath(new URL("../src/db/schema.sql", import.meta.url)), "utf8");

const VALID = "https://it.wiktionary.org/w/index.php?title=casa&oldid=123";
const REFUSED = {
  "no &oldid=": "https://it.wiktionary.org/w/index.php?title=casa",
  "not on wiktionary.org": "https://it.example.org/w/index.php?title=casa&oldid=123",
  "not https://": "http://it.wiktionary.org/w/index.php?title=casa&oldid=123",
} as const;

/** The tables whose evidence link the CHECK guards, each with a row that fills every other column. */
const EVIDENCE_TABLES = {
  corrected_claim: (url: string) => [
    "INSERT INTO corrected_claim (record_id, release_id, dimension, value, correction_id, evidence_url) VALUES (1, 'it-a', 'gender', 'feminine', 'it-a:1', ?)",
    url,
  ],
  // An edge cites two pages, and each link is held to the same CHECK.
  corrected_edge: (url: string) => [
    `INSERT INTO corrected_edge (record_id, release_id, sense_index, json_pointer, target_word, target_word_key, correction_id, evidence_url, base_evidence_url)
       VALUES (1, 'it-a', 0, '/senses/0/glosses/0', 'casa', 'casa', 'it-a:1/senses/0', ?, '${VALID}')`,
    url,
  ],
  corrected_edge_base: (url: string) => [
    `INSERT INTO corrected_edge (record_id, release_id, sense_index, json_pointer, target_word, target_word_key, correction_id, evidence_url, base_evidence_url)
       VALUES (1, 'it-a', 0, '/senses/0/glosses/0', 'casa', 'casa', 'it-a:1/senses/0', '${VALID}', ?)`,
    url,
  ],
  corrected_definition: (url: string) => [
    "INSERT INTO corrected_definition (entry_id, definition_index, text, correction_id, evidence_url) VALUES (1, 0, 'casa', 'page:1:0', ?)",
    url,
  ],
} as const;

/** The dictionary schema with foreign keys off, so an insert meets the CHECK alone. */
function dictionary(): DatabaseSync {
  const db = new DatabaseSync(":memory:", { enableForeignKeyConstraints: false });
  db.exec(schema);
  return db;
}

test(`every LIKE and GLOB pattern in src/db/schema.sql is at most ${D1_PATTERN_LIMIT} bytes`, () => {
  assert.ok(sqlPatterns(schema).length > 0, "the reader found no pattern in schema.sql");
  assert.deepEqual(
    overlongPatterns(schema).map(({ operator, pattern, bytes }) => `${operator} '${pattern}' (${bytes} bytes)`),
    [],
  );
});

test("an overlong pattern is named, with its operator and length", () => {
  const sql = `CREATE TABLE t (
    a TEXT CHECK (a GLOB 'https://*.wiktionary.org/w/index.php?title=*&oldid=*'),
    b TEXT CHECK (b NOT LIKE '${"x".repeat(D1_PATTERN_LIMIT)}'),
    c TEXT CHECK (c glob 'it''s ${"é".repeat(24)}')
  )`;
  assert.deepEqual(overlongPatterns(sql), [
    { operator: "GLOB", pattern: "https://*.wiktionary.org/w/index.php?title=*&oldid=*", bytes: 52 },
    { operator: "GLOB", pattern: `it's ${"é".repeat(24)}`, bytes: 53 },
  ]);
});

for (const [table, row] of Object.entries(EVIDENCE_TABLES)) {
  test(`${table} takes a permanent Wiktionary link as evidence`, () => {
    const db = dictionary();
    const [sql, url] = row(VALID);
    db.prepare(sql).run(url);
    const into = /INSERT INTO (\w+)/.exec(sql)?.[1];
    assert.deepEqual(db.prepare(`SELECT evidence_url FROM ${into}`).all().map((r) => ({ ...r })), [{ evidence_url: VALID }]);
  });

  for (const [why, refused] of Object.entries(REFUSED)) {
    test(`${table} refuses an evidence link ${why}`, () => {
      const [sql, url] = row(refused);
      assert.throws(() => dictionary().prepare(sql).run(url), /CHECK constraint failed/);
    });
  }
}

test("the split CHECK accepts exactly the links the one long GLOB did", () => {
  // node:sqlite runs the 52-byte pattern D1 refuses, so the two can be compared here.
  const db = new DatabaseSync(":memory:");
  const urls = [
    VALID,
    ...Object.values(REFUSED),
    "https://en.wiktionary.org/w/index.php?title=casa&oldid=1",
    "https://it.wiktionary.org/w/index.php?title=casa&action=raw&oldid=1",
    "https://it.wiktionary.org/w/index.phpXtitle=casa&oldid=1",
    "https://.wiktionary.org/w/index.php?title=&oldid=",
    "https://it.wiktionary.org/w/index.php?oldid=1&title=casa",
    "https://evil.example/.wiktionary.org/w/index.php?title=x&oldid=1",
    "HTTPS://it.wiktionary.org/w/index.php?title=casa&oldid=1",
    "https://wiktionary.org/w/index.php?title=casa&oldid=1",
    "",
  ];
  const verdict = db.prepare(`SELECT
      :url GLOB 'https://*.wiktionary.org/w/index.php?title=*&oldid=*' AS long,
      (:url GLOB 'https://*' AND :url GLOB '*.wiktionary.org/w/index.php?title=*&oldid=*') AS split`);
  const rows = urls.map((url) => ({ url, ...(verdict.get({ url }) as { long: number; split: number }) }));
  for (const { url, long, split } of rows) assert.equal(split, long, url);
  assert.ok(rows.some(({ long }) => long === 1) && rows.some(({ long }) => long === 0));
});
