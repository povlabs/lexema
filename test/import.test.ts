import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { utimesSync } from "node:fs";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { importRelease, type Rejection } from "../src/import/importRelease.js";

// A hand-built archive, small enough to reason about and shaped to carry every
// case the real file forces on us. It runs without the 38 MB download, so CI
// covers the importer even though the dataset is gitignored.
const LINES: string[] = [
  // A lemma whose forms[] mention a word it is NOT the lemma of. Resolving a
  // match to its containing record would call `studentessa` the lemma of
  // `studenti`; nothing here may do that.
  JSON.stringify({
    word: "studente", pos: "noun", pos_title: "Sostantivo", lang_code: "it",
    tags: ["masculine", "singular"],
    forms: [
      { form: "studenti", tags: ["masculine", "plural"] },
      { form: "studenti", tags: ["plural"] },
    ],
    senses: [{ glosses: ["chi è iscritto a un corso di studi"], raw_tags: ["scuola"] }],
  }),
  // The inflected record that really does declare the lemma.
  JSON.stringify({
    word: "studenti", pos: "noun", pos_title: "Sostantivo, forma flessa", lang_code: "it",
    tags: ["form-of", "masculine", "plural"],
    senses: [{ glosses: ["plurale di studente"], tags: ["form-of"], form_of: [{ word: "studente" }] }],
  }),
  // Sparse: no gender tag at all, and a raw_tag that states the plural in prose.
  // Gender must land as 'missing', the raw_tag as 'unclassified'.
  JSON.stringify({
    word: "casa", pos: "noun", pos_title: "Sostantivo", lang_code: "it",
    senses: [{ glosses: ["casa ( approfondimento) f sing"], raw_tags: ["pl.: case"] }],
  }),
  JSON.stringify({
    word: "case", pos: "noun", pos_title: "Sostantivo, forma flessa", lang_code: "it",
    tags: ["feminine", "form-of", "plural"],
    senses: [{ glosses: ["plurale di casa"], tags: ["form-of"], form_of: [{ word: "casa" }] }],
  }),
  // An edge whose target word has two records of different pos. Both must
  // survive as candidates; picking one would be inventing a fact.
  JSON.stringify({ word: "sala", pos: "noun", pos_title: "Sostantivo", lang_code: "it", tags: ["feminine", "singular"] }),
  JSON.stringify({ word: "sala", pos: "verb", pos_title: "Voce verbale", lang_code: "it", tags: ["form-of"] }),
  JSON.stringify({
    word: "sale", pos: "noun", pos_title: "Sostantivo, forma flessa", lang_code: "it",
    tags: ["feminine", "form-of", "plural"],
    senses: [{ glosses: ["plurale di sala"], tags: ["form-of"], form_of: [{ word: "sala" }] }],
  }),
  // A verb form inflected for person/number/tense but carrying no mood — the
  // gap that makes 'missing' rows worth having.
  JSON.stringify({
    word: "andare", pos: "verb", pos_title: "Verbo", lang_code: "it",
    tags: ["intransitive"],
    forms: [
      { form: "essere", tags: ["auxiliary"], raw_tags: ["verbo di prima coniugazione (irregolare)"] },
      { form: "andavano", tags: ["plural", "third-person", "imperfect"], raw_tags: ["essi/esse"], source: "Appendice:Coniugazioni/Italiano/andare" },
    ],
    senses: [{ glosses: ["muoversi da un luogo verso un altro"] }],
  }),
  JSON.stringify({
    word: "andavano", pos: "verb", pos_title: "Voce verbale", lang_code: "it",
    tags: ["form-of"],
    senses: [{ glosses: ["terza persona plurale dell'imperfetto indicativo di andare"], tags: ["form-of"], form_of: [{ word: "andare" }] }],
  }),
  // Must be skipped: the file is not Italian-only despite its name.
  JSON.stringify({ word: "casa", pos: "noun", pos_title: "Sostantivo", lang_code: "la", senses: [{ glosses: ["capanna"] }] }),
  JSON.stringify({ word: "maison", pos: "noun", pos_title: "Nom", lang_code: "fr", senses: [{ glosses: ["casa"] }] }),
  // Must be counted and located, not silently dropped.
  "{ this is not json",
  // Neither of these carries a record, and neither may vanish under a reported
  // zero. Line 13 is empty, line 14 is whitespace.
  "",
  "   ",
];

async function writeFixture(lines: readonly string[] = LINES) {
  const dir = await mkdtemp(join(tmpdir(), "lexema-import-"));
  const archive = join(dir, "fixture.jsonl.gz");
  const database = join(dir, "fixture.sqlite");
  await writeFile(archive, gzipSync(Buffer.from(lines.join("\n") + "\n", "utf8")));
  return { dir, archive, database };
}

async function importFixture(
  options: { limit?: number; onProgress?: (admitted: number) => void; progressEvery?: number } = {},
  lines: readonly string[] = LINES,
) {
  const { dir, archive, database } = await writeFixture(lines);
  const rejections: Rejection[] = [];
  const report = await importRelease({
    input: archive,
    database,
    schema: "src/db/schema.sql",
    releaseId: "it-test",
    archiveR2Key: "releases/it-test.jsonl.gz",
    onRejection: (rejection) => rejections.push(rejection),
    ...options,
  });
  return { dir, archive, database, report, rejections };
}

/**
 * Every row of every table, in the order the importer wrote it. This is the
 * whole database, not a chosen subset: a comparison that looked at a few columns
 * would pass while lookup rows, claims or preserved JSON drifted.
 */
function dumpAllTables(path: string): string {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const tables = (
      db.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      ).all() as { name: string }[]
    ).map((t) => t.name);
    // A table appearing or disappearing has to change the dump too.
    assert.ok(tables.includes("source_record_json"), "expected the schema's tables");
    return JSON.stringify(tables.map((name) => [name, db.prepare(`SELECT * FROM ${name}`).all()]));
  } finally {
    db.close();
  }
}

/** Query results as plain objects: node:sqlite returns null-prototype rows,
 *  which deep-equal refuses against an object literal. */
const rows = (db: DatabaseSync, sql: string): Record<string, unknown>[] =>
  (db.prepare(sql).all() as Record<string, unknown>[]).map((row) => ({ ...row }));

const hits = (db: DatabaseSync, key: string) =>
  db.prepare(
    "SELECT record_word, record_pos, origin FROM surface_hit WHERE surface_key = ? ORDER BY record_id, json_pointer",
  ).all(key) as { record_word: string; record_pos: string; origin: string }[];

test("imports only Italian records and locates every rejected line", async () => {
  const { dir, report, rejections } = await importFixture();
  try {
    assert.equal(report.linesRead, LINES.length);
    assert.equal(report.admitted, 9);
    assert.equal(report.status, "complete");
    assert.equal(report.skippedOtherLanguage, 2);
    // Line 12 is not JSON; lines 13 and 14 are empty and whitespace. All three
    // are input that produced no record, so none may be dropped in silence.
    assert.equal(report.malformed, 3);
    assert.equal(report.malformedMembers, 0);
    assert.equal(report.rows.source_record, 9);
    // A count alone would not tell anyone which line to go and look at, and a
    // rejected record is as auditable as a malformed one.
    assert.deepEqual(rejections, [
      { kind: "other-language", lineNo: 10, reason: 'lang_code is "la"' },
      { kind: "other-language", lineNo: 11, reason: 'lang_code is "fr"' },
      { kind: "malformed", lineNo: 12, reason: "not valid JSON" },
      { kind: "malformed", lineNo: 13, reason: "blank line" },
      { kind: "malformed", lineNo: 14, reason: "blank line" },
    ]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("every rejection is located, however many there are", async () => {
  // Well past any sample size a report might once have kept. Each line is a
  // different language so the reasons prove each one came from its own line.
  const lines = Array.from({ length: 300 }, (_, i) =>
    JSON.stringify({ word: "x", pos: "noun", pos_title: "n", lang_code: `l${i}` }),
  );
  const { dir, report, rejections } = await importFixture({}, [...lines, LINES[0]]);
  try {
    assert.equal(report.admitted, 1);
    assert.equal(report.skippedOtherLanguage, 300);
    assert.deepEqual(
      rejections.map((r) => [r.lineNo, r.reason]),
      lines.map((_, i) => [i + 1, `lang_code is "l${i}"`]),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a malformed nested member is a located rejection, not an abort", async () => {
  // Valid JSON, valid headword, and a null where a form, sense or form_of
  // target should be. Each one used to reach an unchecked cast and take the
  // whole run down mid-transaction.
  const italian = { pos: "noun", pos_title: "Sostantivo", lang_code: "it" };
  const lines = [
    JSON.stringify({ ...italian, word: "a", forms: [null] }),
    JSON.stringify({ ...italian, word: "b", senses: [null] }),
    JSON.stringify({ ...italian, word: "c", senses: [{ glosses: ["c"], form_of: ["d"] }] }),
    JSON.stringify({ ...italian, word: "d", forms: {} }),
    JSON.stringify({ ...italian, word: "e", pos: 7 }),
    // A record after the bad ones, to prove the run went on.
    JSON.stringify({ ...italian, word: "f", forms: [{ form: "g" }], senses: [{ form_of: [{ word: "h" }] }] }),
  ];
  const { dir, database, report, rejections } = await importFixture({}, lines);
  const db = new DatabaseSync(database, { readOnly: true });
  try {
    assert.equal(report.status, "complete");
    assert.equal(report.admitted, 1);
    assert.equal(report.malformed, 5);
    assert.deepEqual(rejections, [
      { kind: "malformed", lineNo: 1, reason: "/forms/0 is not an object" },
      { kind: "malformed", lineNo: 2, reason: "/senses/0 is not an object" },
      { kind: "malformed", lineNo: 3, reason: "/senses/0/form_of/0 is not an object" },
      { kind: "malformed", lineNo: 4, reason: "/forms is not an array" },
      { kind: "malformed", lineNo: 5, reason: "word, pos and pos_title must be strings" },
    ]);
    // Nothing of a refused record reached any table: the refusal happens
    // before its first write, so a bad line leaves no half-written record.
    assert.deepEqual(
      (db.prepare("SELECT word, line_no FROM source_record").all() as { word: string; line_no: number }[])
        .map((row) => [row.word, row.line_no]),
      [["f", 6]],
    );
    assert.equal(hits(db, "g").length, 1);
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("a malformed leaf costs its own row and nothing else", async () => {
  // A record that is admissible — word, pos and pos_title are strings, every
  // nested member is an object — carrying a bad value at four leaves. Each one
  // used to disappear, taking its siblings' pointers with it.
  const lines = [
    JSON.stringify({
      word: "valido", pos: "noun", pos_title: "Sostantivo", lang_code: "it",
      tags: [7, "masculine"],
      forms: [{ form: 42, tags: ["plural"] }, { form: "validi", tags: "plural" }],
      senses: [{ glosses: [42, "valido"], form_of: [{ word: 9 }] }],
    }),
  ];
  const { dir, database, report, rejections } = await importFixture({}, lines);
  const db = new DatabaseSync(database, { readOnly: true });
  try {
    // The line still became a record: a bad leaf is not a bad line.
    assert.equal(report.admitted, 1);
    assert.equal(report.malformed, 0);
    assert.equal(report.malformedMembers, 5);
    assert.deepEqual(rejections, [
      { kind: "malformed-member", lineNo: 1, reason: "/forms/0/form is not a string" },
      { kind: "malformed-member", lineNo: 1, reason: "/tags/0 is not a string" },
      { kind: "malformed-member", lineNo: 1, reason: "/forms/1/tags is not an array" },
      { kind: "malformed-member", lineNo: 1, reason: "/senses/0/glosses/0 is not a string" },
      { kind: "malformed-member", lineNo: 1, reason: "/senses/0/form_of/0/word is not a string" },
    ]);

    // Every surviving sibling is stored at the index the archive gave it. The
    // gloss is /glosses/1, not /glosses/0 — a reader who opens the archive at
    // the stored pointer has to find this exact text there.
    assert.deepEqual(
      rows(db, "SELECT text, json_pointer FROM sense_gloss"),
      [{ text: "valido", json_pointer: "/senses/0/glosses/1" }],
    );
    assert.deepEqual(
      rows(db, "SELECT surface, json_pointer FROM lookup_form ORDER BY json_pointer"),
      [
        { surface: "validi", json_pointer: "/forms/1/form" },
        { surface: "valido", json_pointer: "/word" },
      ],
    );
    // Same for the record's own tags: 'masculine' is /tags/1.
    assert.deepEqual(
      rows(
        db,
        `SELECT value, json_pointer FROM grammar_claim
          WHERE scope = 'record' AND status = 'stated'`,
      ),
      [{ value: "masculine", json_pointer: "/tags/1" }],
    );
    // The refused leaves left no row behind at all.
    assert.equal((db.prepare("SELECT count(*) n FROM form_of_edge").get() as { n: number }).n, 0);
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("a form the import refused still reports its own refused leaves", async () => {
  // The form at /forms/0 is refused twice over: its surface is a number and so
  // is one of its tags. The surface costs the form its lookup and claim rows,
  // and that used to cost the tag its rejection too — the pass that reads the
  // members returned before reading them, so the leaf vanished from both the
  // rejection file and the count.
  const lines = [
    JSON.stringify({
      word: "valido", pos: "noun", pos_title: "Sostantivo", lang_code: "it",
      forms: [{ form: 42, tags: [9, "plural"], raw_tags: 8, source: 7 }],
      senses: [{ glosses: ["valido"] }],
    }),
  ];
  const { dir, database, report, rejections } = await importFixture({}, lines);
  const db = new DatabaseSync(database, { readOnly: true });
  try {
    assert.equal(report.admitted, 1);
    assert.equal(report.malformed, 0);
    assert.equal(report.malformedMembers, 4);
    assert.deepEqual(rejections, [
      { kind: "malformed-member", lineNo: 1, reason: "/forms/0/form is not a string" },
      { kind: "malformed-member", lineNo: 1, reason: "/forms/0/source is not a string" },
      { kind: "malformed-member", lineNo: 1, reason: "/forms/0/tags/0 is not a string" },
      { kind: "malformed-member", lineNo: 1, reason: "/forms/0/raw_tags is not an array" },
    ]);
    // The count on the release row says the same thing as the run did.
    assert.deepEqual(
      rows(db, "SELECT malformed_members FROM source_release"),
      [{ malformed_members: 4 }],
    );

    // Reporting the members is not admitting them: the refused form names no
    // surface, so it keeps its lookup row and every claim row off the database.
    assert.deepEqual(
      rows(db, "SELECT surface, json_pointer FROM lookup_form ORDER BY json_pointer"),
      [{ surface: "valido", json_pointer: "/word" }],
    );
    assert.deepEqual(rows(db, "SELECT value FROM grammar_claim WHERE scope = 'form'"), []);
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("the release row carries the counts the run reported", async () => {
  const { dir, database, report } = await importFixture();
  const db = new DatabaseSync(database, { readOnly: true });
  try {
    // The counts are import metadata, readable from the database alone — not
    // only from the console output of the run that made it.
    assert.deepEqual(
      rows(
        db,
        `SELECT status, lines_read, admitted, skipped_other_language,
                malformed_lines, malformed_members
           FROM source_release`,
      ),
      [{
        status: report.status,
        lines_read: report.linesRead,
        admitted: report.admitted,
        skipped_other_language: report.skippedOtherLanguage,
        malformed_lines: report.malformed,
        malformed_members: report.malformedMembers,
      }],
    );
    assert.deepEqual(
      Object.fromEntries(
        (rows(db, "SELECT table_name, rows FROM release_table_rows") as {
          table_name: string; rows: number;
        }[]).map((row) => [row.table_name, row.rows]),
      ),
      report.rows,
    );
    // Each stored row count is the table it names, counted.
    assert.equal(
      (db.prepare("SELECT count(*) n FROM lookup_form").get() as { n: number }).n,
      report.rows.lookup_form,
    );
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("the recorded checksum and byte count describe the whole imported file", async () => {
  const { dir, archive, report } = await importFixture();
  try {
    const bytes = await readFile(archive);
    // Both passes now read one open handle, so the digest still has to cover
    // the entire file rather than whatever the import stream happened to reach.
    assert.equal(report.archiveSha256, createHash("sha256").update(bytes).digest("hex"));
    assert.equal(report.archiveBytes, (await stat(archive)).size);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("an archive that changes mid-import commits nothing", async () => {
  const { dir, archive, database } = await writeFixture();
  try {
    // Stand in for the file being replaced between the hashing pass and the
    // import pass: while the loop is running, the file underneath it moves. The
    // checksum on the release would then describe bytes this run never read.
    await assert.rejects(
      importRelease({
        input: archive,
        database,
        schema: "src/db/schema.sql",
        releaseId: "it-test",
        archiveR2Key: "releases/it-test.jsonl.gz",
        onRejection: () => {},
        progressEvery: 1,
        onProgress: () => utimesSync(archive, new Date(0), new Date(0)),
      }),
      /changed while it was being imported/,
    );

    // Not a release hidden by its status — no release row at all, because the
    // guard runs before the transaction commits.
    const db = new DatabaseSync(database, { readOnly: true });
    try {
      const releases = db.prepare("SELECT release_id, status FROM source_release").all();
      assert.deepEqual(releases, []);
      assert.deepEqual(db.prepare("SELECT record_id FROM source_record").all(), []);
    } finally {
      db.close();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("the same archive imports to the same database twice", async () => {
  const first = await importFixture();
  const second = await importFixture();
  try {
    assert.equal(first.report.archiveSha256, second.report.archiveSha256);
    assert.deepEqual(first.report.rows, second.report.rows);

    // record_id follows line order and sense_id derives from it, so two runs
    // agree row for row across every table — records, preserved JSON, lookup
    // rows, edges, senses, glosses, labels and grammar claims alike.
    assert.equal(dumpAllTables(first.database), dumpAllTables(second.database));
  } finally {
    await rm(first.dir, { recursive: true, force: true });
    await rm(second.dir, { recursive: true, force: true });
  }
});

test("finds studenti, case, sale and andavano after import", async () => {
  const { dir, database } = await importFixture();
  const db = new DatabaseSync(database, { readOnly: true });
  try {
    // Reachable both as its own record and as a form another record mentions.
    const studenti = hits(db, "studenti");
    assert.equal(studenti.length, 3);
    assert.equal(studenti.filter((h) => h.origin === "headword").length, 1);
    assert.equal(studenti.filter((h) => h.origin === "embedded-form").length, 2);

    // `case` is findable even though the `casa` record carries no forms[].
    assert.deepEqual(hits(db, "case").map((h) => h.record_word), ["case"]);
    assert.deepEqual(hits(db, "andavano").map((h) => h.origin), ["embedded-form", "headword"]);
    assert.equal(hits(db, "sale").length, 1);
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("an embedded form never makes its container the lemma", async () => {
  const { dir, database } = await importFixture();
  const db = new DatabaseSync(database, { readOnly: true });
  try {
    // `studente` mentions `studenti` twice, at different pointers with different
    // tags. Both rows are kept — deduplicating would destroy evidence — and
    // neither is a lemma claim.
    const mentions = db.prepare(
      `SELECT json_pointer FROM lookup_form
        WHERE surface_key = 'studenti' AND origin = 'embedded-form'
        ORDER BY json_pointer`,
    ).all() as { json_pointer: string }[];
    assert.deepEqual(mentions.map((m) => m.json_pointer), ["/forms/0/form", "/forms/1/form"]);

    // The only lemma claim about `studenti` is the edge the inflected record declares.
    const edges = db.prepare(
      `SELECT target_word FROM form_of_edge
        WHERE record_id = (SELECT record_id FROM source_record WHERE word = 'studenti')`,
    ).all() as { target_word: string }[];
    assert.deepEqual(edges.map((e) => e.target_word), ["studente"]);
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("an ambiguous form_of edge keeps every candidate", async () => {
  const { dir, database } = await importFixture();
  const db = new DatabaseSync(database, { readOnly: true });
  try {
    // `sale` declares one edge to `sala`, and `sala` is two records. Both come
    // back; the schema has nowhere to record a winner.
    const candidates = db.prepare(
      `SELECT candidate_pos FROM form_of_candidate
        WHERE from_record_id = (SELECT record_id FROM source_record WHERE word = 'sale')
        ORDER BY candidate_pos`,
    ).all() as { candidate_pos: string }[];
    assert.deepEqual(candidates.map((c) => c.candidate_pos), ["noun", "verb"]);
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("keeps stated, unclassified and missing grammar apart", async () => {
  const { dir, database } = await importFixture();
  const db = new DatabaseSync(database, { readOnly: true });
  try {
    // scope = 'record' matters: `studente` also carries form-scoped claims from
    // its forms[], and those are claims about the forms, not about the headword.
    const claims = (word: string, status: string) =>
      db.prepare(
        `SELECT dimension, value, source_text FROM grammar_claim
          WHERE record_id = (SELECT record_id FROM source_record WHERE word = ? AND pos = 'noun')
            AND status = ? AND scope = 'record'
          ORDER BY dimension, source_text`,
      ).all(word, status) as { dimension: string | null; value: string | null; source_text: string | null }[];

    // `casa` states no gender and no number: both are looked for and missing,
    // which is a different fact from never having been expected.
    assert.deepEqual(
      claims("casa", "missing").map((c) => c.dimension).sort(),
      ["gender", "number"],
    );
    // Its plural lives in prose, on the sense. Recorded verbatim as unmapped
    // text rather than parsed into number=plural.
    const senseText = db.prepare(
        `SELECT source_text FROM grammar_claim
          WHERE record_id = (SELECT record_id FROM source_record WHERE word = 'casa')
            AND scope = 'sense' AND status = 'unclassified'`,
      ).all() as { source_text: string }[];
    assert.deepEqual(senseText.map((c) => c.source_text), ["pl.: case"]);
    assert.equal(claims("casa", "stated").length, 0);

    // `studente` states both, so nothing is missing.
    assert.deepEqual(
      claims("studente", "stated").map((c) => `${c.dimension}=${c.value}`).sort(),
      ["gender=masculine", "number=singular"],
    );
    assert.equal(claims("studente", "missing").length, 0);
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("a verb form inflected without a mood records the gap", async () => {
  const { dir, database } = await importFixture();
  const db = new DatabaseSync(database, { readOnly: true });
  try {
    const formClaims = (formIndex: number) =>
      db.prepare(
        `SELECT status, dimension, value, source_text FROM grammar_claim
          WHERE record_id = (SELECT record_id FROM source_record WHERE word = 'andare')
            AND scope = 'form' AND scope_index = ?
          ORDER BY status, dimension, source_text`,
      ).all(formIndex) as { status: string; dimension: string | null; value: string | null; source_text: string | null }[];

    // /forms/1 is `andavano`: person, number and tense are stated, mood is not.
    // That silence is the single most consequential gap in this dataset.
    const andavano = formClaims(1);
    assert.deepEqual(
      andavano.filter((c) => c.status === "stated").map((c) => c.value).sort(),
      ["imperfect", "plural", "third-person"],
    );
    assert.deepEqual(
      andavano.filter((c) => c.status === "missing").map((c) => c.dimension),
      ["mood"],
    );
    // 'essi/esse' plainly means third person to a reader. It is still kept as
    // unclassified: mapping raw tags is #4's job, with tests behind it.
    assert.deepEqual(
      andavano.filter((c) => c.status === "unclassified").map((c) => c.source_text),
      ["essi/esse"],
    );

    // /forms/0 is the auxiliary `essere`, not an inflected form, so it is owed
    // no mood and must not get a 'missing' row.
    assert.equal(formClaims(0).filter((c) => c.status === "missing").length, 0);
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("a run stopped by --limit is never marked complete", async () => {
  const { dir, database, report } = await importFixture({ limit: 3 });
  const db = new DatabaseSync(database, { readOnly: true });
  try {
    assert.equal(report.admitted, 3);
    // The checksum and byte count describe the whole archive while only three
    // of its records landed, so this release must never be servable.
    assert.equal(report.status, "partial");
    assert.equal(
      (db.prepare("SELECT status FROM source_release").get() as { status: string }).status,
      "partial",
    );
    assert.equal(hits(db, "studenti").length, 0);
    assert.equal(
      (db.prepare("SELECT count(*) n FROM form_of_candidate").get() as { n: number }).n,
      0,
    );
    // The rows are on disk for diagnosis; it is the canonical reads that hide them.
    assert.equal(
      (db.prepare("SELECT count(*) n FROM source_record").get() as { n: number }).n,
      3,
    );
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("nothing is readable until the release completes", async () => {
  const { dir, database } = await importFixture();
  const db = new DatabaseSync(database);
  try {
    assert.ok(hits(db, "studenti").length > 0);
    // Half-imported releases must be invisible to every canonical read, so that
    // a crashed import cannot be served as if it had finished.
    db.exec("UPDATE source_release SET status = 'importing'");
    assert.equal(hits(db, "studenti").length, 0);
    assert.equal(
      (db.prepare("SELECT count(*) n FROM form_of_candidate").get() as { n: number }).n,
      0,
    );
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
});
