import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { importRelease } from "../src/import/importRelease.js";

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
];

async function importFixture(into?: { dir: string; releaseId: string }) {
  const dir = into?.dir ?? (await mkdtemp(join(tmpdir(), "lexema-import-")));
  const releaseId = into?.releaseId ?? "it-test";
  const archive = join(dir, "fixture.jsonl.gz");
  const database = join(dir, "fixture.sqlite");
  await writeFile(archive, gzipSync(Buffer.from(LINES.join("\n") + "\n", "utf8")));
  const report = await importRelease({
    input: archive,
    database,
    schema: "src/db/schema.sql",
    releaseId,
    archiveR2Key: `releases/${releaseId}.jsonl.gz`,
  });
  return { dir, database, report };
}

const hits = (db: DatabaseSync, key: string) =>
  db.prepare(
    "SELECT record_word, record_pos, origin FROM surface_hit WHERE surface_key = ? ORDER BY record_id, json_pointer",
  ).all(key) as { record_word: string; record_pos: string; origin: string }[];

test("imports only Italian records and locates every malformed line", async () => {
  const { dir, report } = await importFixture();
  try {
    assert.equal(report.linesRead, LINES.length);
    assert.equal(report.admitted, 9);
    assert.equal(report.skippedOtherLanguage, 2);
    assert.equal(report.malformed, 1);
    // A count alone would not tell anyone which line to go and look at.
    assert.deepEqual(report.malformedLineNumbers, [12]);
    assert.equal(report.rows.source_record, 9);
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

    const read = (path: string) => {
      const db = new DatabaseSync(path, { readOnly: true });
      try {
        return JSON.stringify(
          db.prepare("SELECT record_id, line_no, word, pos FROM source_record ORDER BY record_id").all(),
        );
      } finally {
        db.close();
      }
    };
    // record_id follows line order, so two runs agree row for row.
    assert.equal(read(first.database), read(second.database));
  } finally {
    await rm(first.dir, { recursive: true, force: true });
    await rm(second.dir, { recursive: true, force: true });
  }
});

test("a second release lands beside the first in one database", async () => {
  const first = await importFixture();
  try {
    const second = await importFixture({ dir: first.dir, releaseId: "it-test-staged" });
    assert.deepEqual(second.report.rows, first.report.rows);

    const db = new DatabaseSync(first.database, { readOnly: true });
    try {
      const releases = db
        .prepare("SELECT release_id, status FROM source_release ORDER BY release_id")
        .all() as { release_id: string; status: string }[];
      assert.deepEqual(
        releases.map((row) => `${row.release_id}:${row.status}`),
        ["it-test:complete", "it-test-staged:complete"],
      );
      // Every lookup row names its own release, so the two never mix.
      const perRelease = db
        .prepare("SELECT release_id, count(*) AS n FROM lookup_form GROUP BY release_id ORDER BY release_id")
        .all() as { release_id: string; n: number }[];
      assert.equal(perRelease.length, 2);
      assert.equal(perRelease[0].n, perRelease[1].n);
    } finally {
      db.close();
    }
  } finally {
    await rm(first.dir, { recursive: true, force: true });
  }
});

test("re-importing the same release id is refused", async () => {
  const first = await importFixture();
  try {
    await assert.rejects(
      importFixture({ dir: first.dir, releaseId: "it-test" }),
      /already in this database/,
    );
  } finally {
    await rm(first.dir, { recursive: true, force: true });
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
