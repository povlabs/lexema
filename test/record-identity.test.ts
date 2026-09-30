import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { applyAppMigrations } from "../src/db/app/migrations.js";

const file = (name: string) => readFileSync(fileURLToPath(new URL(`../${name}`, import.meta.url)), "utf8");

/** The reference queries, stripped of comments and split back into statements. */
const referenceQueries = file("src/db/queries.sql")
  .split("\n")
  .filter((line) => !line.trimStart().startsWith("--"))
  .join("\n")
  .split(";")
  .filter((statement) => statement.includes("SELECT"));

/** Two records, one edge onto the second and one edge onto nothing. */
function seededDatabase(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(file("src/db/schema.sql"));
  applyAppMigrations(db);
  db.exec(`INSERT INTO source_release
    (release_id, source_name, archive_r2_key, archive_sha256, archive_bytes,
     normalizer, importer_version, schema_version)
    VALUES ('test', 'synthetic', 'test', 'test', 1, 'test', 'test', 1)`);
  for (const [lineNo, word] of [[1, "form"], [2, "target"]] as const) {
    db.prepare("INSERT INTO source_record VALUES (?, 'test', ?, 'test', ?, 'noun', 'noun', 'it')").run(lineNo, lineNo, word);
    db.prepare(
      `INSERT INTO lookup_form (record_id, release_id, origin, surface, surface_key, json_pointer)
       VALUES (?, 'test', 'headword', ?, ?, '/word')`,
    ).run(lineNo, word, word);
  }
  db.exec("INSERT INTO form_of_edge VALUES (1, 1, 'test', 0, 0, '/senses/0/form_of/0/word', 'target', 'target')");
  db.exec("INSERT INTO form_of_edge VALUES (2, 1, 'test', 0, 1, '/senses/0/form_of/1/word', 'dangling', 'dangling')");
  db.exec("INSERT INTO source_record_json VALUES (1, '{}')");
  db.exec("INSERT INTO sense VALUES (1, 1, 0, '/senses/0')");
  db.exec("INSERT INTO sense_gloss VALUES (1, 1, 0, 'test', '/senses/0/glosses/0')");
  db.exec("INSERT INTO sense_label VALUES (1, 1, 0, 'tag', 'test', '/senses/0/tags/0')");
  db.exec("INSERT INTO grammar_claim VALUES (1, 1, 'record', NULL, '', 'missing', 'gender', NULL, NULL)");
  db.exec("INSERT INTO claim_review VALUES (1, 1, '/word', 'disputed', 'test', 'https://example.org', 'test', 'test')");
  return db;
}

/** Bind only the parameters a given reference query actually names. */
function run(db: DatabaseSync, sql: string, recordId: number) {
  const available: Record<string, string | number> = { release: "test", key: "form", record_id: recordId };
  const bound = Object.fromEntries(
    Object.entries(available).filter(([name]) => sql.includes(`:${name}`)),
  );
  return db.prepare(sql).all(bound);
}

test("the schema loads clean with foreign keys on", () => {
  const db = seededDatabase();
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  assert.equal(db.prepare("PRAGMA integrity_check").get()?.integrity_check, "ok");
});

test("the grammar vocabulary is enforced on stated claims and only on them", () => {
  const db = seededDatabase();
  const insert = db.prepare(
    `INSERT INTO grammar_claim
       (record_id, scope, scope_index, json_pointer, status, dimension, value, source_text)
     VALUES (1, 'record', NULL, ?, ?, ?, ?, ?)`,
  );

  // A stated value the vocabulary does not know is refused by the composite
  // foreign key: the importer cannot invent 'common' as a gender.
  assert.throws(
    () => insert.run("/tags/0", "stated", "gender", "common", "common"),
    /FOREIGN KEY constraint failed/,
  );
  // The same shape with a known value loads, so the refusal is the value.
  insert.run("/tags/0", "stated", "gender", "feminine", "feminine");
  // An unclassified row keeps the literal text and names no value at all.
  insert.run("/tags/1", "unclassified", null, null, "pl.: case");

  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  assert.deepEqual(
    db
      .prepare("SELECT json_pointer, status, dimension, value, source_text FROM grammar_claim ORDER BY claim_id")
      .all()
      .map((row) => ({ ...row })),
    [
      { json_pointer: "", status: "missing", dimension: "gender", value: null, source_text: null },
      { json_pointer: "/tags/0", status: "stated", dimension: "gender", value: "feminine", source_text: "feminine" },
      { json_pointer: "/tags/1", status: "unclassified", dimension: null, value: null, source_text: "pl.: case" },
    ],
  );
});

test("every serving read hides a release that is not complete", () => {
  const db = seededDatabase();
  for (const status of ["importing", "partial", "failed", "superseded"]) {
    db.prepare("UPDATE source_release SET status = ?").run(status);
    assert.deepEqual(db.prepare("SELECT * FROM surface_hit").all(), [], status);
    assert.deepEqual(db.prepare("SELECT * FROM form_of_candidate").all(), [], status);
    for (const sql of referenceQueries) {
      for (const recordId of [1, 2]) {
        assert.deepEqual(run(db, sql, recordId), [], `${status}: ${sql}`);
      }
    }
  }
});

test("a complete release keeps every candidate and every dangling edge", () => {
  const db = seededDatabase();
  // A second record spelled `target` lands before promotion: the edge is now
  // ambiguous, and neither candidate may be silently dropped.
  db.exec("INSERT INTO source_record VALUES (3, 'test', 3, 'test', 'target', 'noun', 'noun', 'it')");
  db.exec(
    `INSERT INTO lookup_form (record_id, release_id, origin, surface, surface_key, json_pointer)
     VALUES (3, 'test', 'headword', 'target', 'target', '/word')`,
  );
  db.exec("UPDATE source_release SET status = 'complete'");

  assert.equal(db.prepare("SELECT * FROM form_of_candidate").all().length, 2);

  const publicContract = run(db, referenceQueries[2]!, 1) as Array<{ candidate_record_id: number | null }>;
  assert.equal(publicContract.length, 3);
  assert.equal(publicContract.at(-1)?.candidate_record_id, null);

  for (const sql of referenceQueries) {
    assert.ok([1, 2].some((recordId) => run(db, sql, recordId).length > 0), sql);
  }
});
