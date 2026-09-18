import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { importRelease } from "../src/import/importRelease.js";
import { LEMMA_LINK_SQL, MAX_QUERY_LENGTH, lookup } from "../src/lookup/lookup.js";
import type { LookupResult, Reading, RejectedResult, SearchResult } from "../src/lookup/types.js";

// A fixture built to carry the shapes the real file forces on a lookup: one
// surface meaning several unrelated things, one word mentioned by records that
// are not its lemma, an edge whose target is several records, a word with no
// grammar at all, and an accented word.
const LINES = [
  JSON.stringify({
    word: "studente", pos: "noun", pos_title: "Sostantivo", lang_code: "it",
    tags: ["masculine", "singular"],
    forms: [{ form: "studenti", tags: ["masculine", "plural"] }, { form: "studenti", tags: ["plural"] }],
    senses: [{ glosses: ["chi è iscritto a un corso di studi"], raw_tags: ["scuola"] }],
  }),
  // The disputed one: the source calls this a present participle of `studiare`,
  // but Wiktionary's own conjugation table and Treccani both give `studiante`.
  JSON.stringify({
    word: "studente", pos: "verb", pos_title: "Voce verbale", lang_code: "it",
    tags: ["form-of"],
    senses: [{ glosses: ["participio presente singolare maschile di studiare"], tags: ["form-of"], form_of: [{ word: "studiare" }] }],
  }),
  JSON.stringify({
    word: "studenti", pos: "noun", pos_title: "Sostantivo, forma flessa", lang_code: "it",
    tags: ["form-of", "masculine", "plural"],
    senses: [{ glosses: ["plurale di studente"], tags: ["form-of"], form_of: [{ word: "studente" }] }],
  }),
  JSON.stringify({
    word: "studentessa", pos: "noun", pos_title: "Sostantivo", lang_code: "it",
    tags: ["feminine", "singular"],
    forms: [{ form: "studenti", tags: ["masculine", "plural"] }],
    senses: [{ glosses: ["femminile di studente"], tags: ["form-of"], form_of: [{ word: "studente" }] }],
  }),

  // `sale` is three unrelated things. None may be dropped or merged.
  JSON.stringify({
    word: "sale", pos: "noun", pos_title: "Sostantivo", lang_code: "it",
    tags: ["masculine", "singular"],
    senses: [{ glosses: ["cloruro di sodio"] }],
  }),
  JSON.stringify({
    word: "sale", pos: "noun", pos_title: "Sostantivo, forma flessa", lang_code: "it",
    tags: ["feminine", "form-of", "plural"],
    senses: [{ glosses: ["plurale di sala"], tags: ["form-of"], form_of: [{ word: "sala" }] }],
  }),
  JSON.stringify({
    word: "sale", pos: "verb", pos_title: "Voce verbale", lang_code: "it",
    tags: ["form-of"],
    senses: [{ glosses: ["terza persona singolare di salire"], tags: ["form-of"], form_of: [{ word: "salire" }] }],
  }),
  JSON.stringify({ word: "sala", pos: "noun", pos_title: "Sostantivo", lang_code: "it", tags: ["feminine", "singular"] }),

  // `bella` points at `bello`, which is three records. Nothing chooses.
  JSON.stringify({
    word: "bella", pos: "noun", pos_title: "Sostantivo, forma flessa", lang_code: "it",
    tags: ["feminine", "form-of", "singular"],
    senses: [{ glosses: ["femminile di bello"], tags: ["form-of"], form_of: [{ word: "bello" }] }],
  }),
  JSON.stringify({ word: "bello", pos: "adj", pos_title: "Aggettivo", lang_code: "it", tags: ["masculine", "singular"] }),
  JSON.stringify({ word: "bello", pos: "noun", pos_title: "Sostantivo", lang_code: "it", tags: ["invariable", "masculine"] }),
  JSON.stringify({ word: "bello", pos: "noun", pos_title: "Sostantivo", lang_code: "it", tags: ["masculine", "singular"] }),

  // No gender, no number, definitions that define nothing.
  JSON.stringify({
    word: "casa", pos: "noun", pos_title: "Sostantivo", lang_code: "it",
    senses: [{ glosses: ["casa ( approfondimento) f sing"], raw_tags: ["pl.: case"] }],
  }),
  // Accented, and feminine/invariable.
  JSON.stringify({
    word: "città", pos: "noun", pos_title: "Sostantivo", lang_code: "it",
    tags: ["feminine", "invariable"],
    senses: [{ glosses: ["centro abitato di grandi dimensioni"] }],
  }),
  // Carries a typographic apostrophe, which a keyboard rarely produces.
  JSON.stringify({
    word: "un’amica", pos: "noun", pos_title: "Sostantivo", lang_code: "it",
    tags: ["feminine", "singular"],
    senses: [{ glosses: ["una amica"] }],
  }),
  // An edge whose target is in no record at all: it must stay visible.
  JSON.stringify({
    word: "andavano", pos: "verb", pos_title: "Voce verbale", lang_code: "it",
    tags: ["form-of"],
    senses: [{ glosses: ["terza persona plurale dell'imperfetto di andare"], tags: ["form-of"], form_of: [{ word: "andare" }] }],
  }),
];

const RELEASE = "it-test";

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "lexema-lookup-"));
  const archive = join(dir, "fixture.jsonl.gz");
  const database = join(dir, "fixture.sqlite");
  await writeFile(archive, gzipSync(Buffer.from(LINES.join("\n") + "\n", "utf8")));
  await importRelease({
    input: archive,
    database,
    schema: "src/db/schema.sql",
    releaseId: RELEASE,
    archiveR2Key: "releases/it-test.jsonl.gz",
    sourceUrl: "https://example.invalid/it-extract.jsonl.gz",
    license: "CC-BY-SA-4.0",
  });
  const db = new DatabaseSync(database);
  return { dir, db };
}

const ask = (db: DatabaseSync, query: string): LookupResult =>
  lookup({ db, releaseId: RELEASE, query });

function found(result: LookupResult): Reading[] {
  assert.equal(result.outcome, "found");
  return (result as SearchResult).readings;
}

async function withFixture(run: (db: DatabaseSync) => void): Promise<void> {
  const { dir, db } = await fixture();
  try {
    run(db);
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
}

test("rejects an empty query rather than searching for nothing", async () => {
  await withFixture((db) => {
    for (const blank of ["", "   ", "\t\n"]) {
      const result = ask(db, blank);
      assert.equal(result.outcome, "rejected");
      assert.deepEqual(
        (result as RejectedResult).rejection,
        { reason: "empty" },
      );
    }
  });
});

test("rejects an over-long query and says what the limit was", async () => {
  await withFixture((db) => {
    const result = ask(db, "a".repeat(MAX_QUERY_LENGTH + 1));
    assert.equal(result.outcome, "rejected");
    assert.deepEqual(
      (result as RejectedResult).rejection,
      { reason: "too-long", length: MAX_QUERY_LENGTH + 1, limit: MAX_QUERY_LENGTH },
    );
    // The boundary itself is allowed.
    assert.equal(ask(db, "a".repeat(MAX_QUERY_LENGTH)).outcome, "not-found");
  });
});

test("an unknown word is not-found, not an error and not empty-handed", async () => {
  await withFixture((db) => {
    const result = ask(db, "qwertyuiop");
    assert.equal(result.outcome, "not-found");
    const body = result as SearchResult;
    assert.deepEqual(body.readings, []);
    // The release still comes back, so a page can attribute the source even
    // when it has nothing to show.
    assert.equal(body.release.releaseId, RELEASE);
    assert.equal(body.release.license, "CC-BY-SA-4.0");
  });
});

test("normalizes case, whitespace and apostrophes while keeping accents", async () => {
  await withFixture((db) => {
    // Accents are meaning, not decoration: stripping them would merge distinct words.
    assert.equal(found(ask(db, "città")).length, 1);
    assert.equal(ask(db, "citta").outcome, "not-found");

    // Case and surrounding whitespace do not change which word was asked for.
    for (const variant of ["CITTÀ", "  Città  ", "cIttÀ"]) {
      assert.equal(found(ask(db, variant))[0].word, "città");
    }

    // A typed straight quote finds a source spelling with a typographic one.
    const apostrophe = found(ask(db, "un'amica"));
    assert.equal(apostrophe.length, 1);
    assert.equal(apostrophe[0].word, "un’amica");
  });
});

test("keeps the typed spelling and the source spelling both available", async () => {
  await withFixture((db) => {
    const result = ask(db, "  CITTÀ ");
    const body = result as SearchResult;
    // What the user typed, verbatim — a page has to be able to echo it back.
    assert.equal(body.query.raw, "  CITTÀ ");
    assert.equal(body.query.key, "città");
    // What the source wrote, verbatim.
    assert.equal(body.readings[0].evidence[0].surface, "città");
  });
});

test("returns every reading of an ambiguous surface, unranked", async () => {
  await withFixture((db) => {
    // `sale` is salt, the plural of `sala`, and a form of `salire`. All three,
    // in source order, with nothing chosen for the reader.
    const readings = found(ask(db, "sale"));
    assert.equal(readings.length, 3);
    assert.deepEqual(
      readings.map((r) => `${r.word}/${r.pos}`),
      ["sale/noun", "sale/noun", "sale/verb"],
    );
    assert.ok(readings.every((r) => r.isAboutQuery));
    assert.deepEqual(
      readings.map((r) => r.lineNo),
      [...readings.map((r) => r.lineNo)].sort((a, b) => a - b),
    );
  });
});

test("repeated evidence does not become repeated readings", async () => {
  await withFixture((db) => {
    // `studenti` sits on four records across five lookup rows: twice inside
    // `studente`, once inside `studentessa`, and once as its own headword.
    const readings = found(ask(db, "studenti"));
    assert.equal(readings.length, 3);

    const byWord = new Map(readings.map((r) => [`${r.word}/${r.pos}`, r]));
    const studente = byWord.get("studente/noun");
    assert.ok(studente);
    // Both mentions survive as separate evidence — they carry different tags,
    // so collapsing them would lose a fact.
    assert.equal(studente.evidence.length, 2);
    assert.deepEqual(
      studente.evidence.map((e) => e.pointer),
      ["/forms/0/form", "/forms/1/form"],
    );
  });
});

test("a record that merely mentions a form is not called its lemma", async () => {
  await withFixture((db) => {
    const readings = found(ask(db, "studenti"));
    const mentions = readings.filter((r) => !r.isAboutQuery);
    const about = readings.filter((r) => r.isAboutQuery);

    // `studente` and `studentessa` both list `studenti` in their tables, and
    // neither is a claim about the word. `studentessa` especially: it is the
    // feminine, not the lemma.
    assert.deepEqual(mentions.map((r) => r.word).sort(), ["studente", "studentessa"]);
    assert.ok(mentions.every((r) => r.evidence.every((e) => e.origin === "embedded-form")));

    // The one record that IS about `studenti` is the inflected entry, and its
    // lemma claim comes from the edge it declares, not from anyone's table.
    assert.deepEqual(about.map((r) => r.word), ["studenti"]);
    const link = about[0].lemmaLinks[0];
    assert.equal(link.kind, "candidates");
    assert.equal(link.targetWord, "studente");
  });
});

test("an ambiguous lemma link keeps every candidate", async () => {
  await withFixture((db) => {
    // Noun `bella` says "femminile di bello". `bello` is three records — one
    // adjective and two nouns — and the source does not say which.
    const [bella] = found(ask(db, "bella"));
    assert.equal(bella.lemmaLinks.length, 1);
    const link = bella.lemmaLinks[0];
    assert.equal(link.kind, "candidates");
    assert.equal(link.kind === "candidates" && link.candidates.length, 3);
    assert.deepEqual(
      link.kind === "candidates" ? link.candidates.map((c) => c.pos) : [],
      ["adj", "noun", "noun"],
    );
  });
});

test("a lemma link that resolves to nothing stays visible", async () => {
  await withFixture((db) => {
    // `andavano` points at `andare`, which is in no record here. Dropping the
    // edge would turn "points somewhere we cannot follow" into "points nowhere".
    const [andavano] = found(ask(db, "andavano"));
    assert.equal(andavano.lemmaLinks.length, 1);
    assert.equal(andavano.lemmaLinks[0].kind, "dangling");
    assert.equal(andavano.lemmaLinks[0].targetWord, "andare");
  });
});

test("lists the inflections that declare themselves forms of a reading", async () => {
  await withFixture((db) => {
    const [studente] = found(ask(db, "studente")).filter((r) => r.pos === "noun");
    assert.deepEqual(
      studente.inflections.map((i) => i.word).sort(),
      ["studentessa", "studenti"],
    );
  });
});

test("keeps stated, unclassified and missing grammar apart in the result", async () => {
  await withFixture((db) => {
    const [casa] = found(ask(db, "casa"));
    const record = casa.grammar.record;
    // The source states nothing about `casa`'s gender or number, and we looked.
    assert.deepEqual(
      record.filter((c) => c.status === "missing").map((c) => c.status === "missing" && c.dimension).sort(),
      ["gender", "number"],
    );
    assert.equal(record.filter((c) => c.status === "stated").length, 0);

    // Its plural is written in prose on the sense, kept verbatim rather than
    // parsed into number=plural.
    const senseClaims = [...casa.grammar.bySense.values()].flat();
    assert.deepEqual(
      senseClaims.filter((c) => c.status === "unclassified").map((c) => c.status === "unclassified" && c.sourceText),
      ["pl.: case"],
    );

    // A word that does state them has no 'missing' rows at all.
    const [citta] = found(ask(db, "città"));
    assert.deepEqual(
      citta.grammar.record.filter((c) => c.status === "stated").map((c) => c.status === "stated" && c.value).sort(),
      ["feminine", "invariable"],
    );
  });
});

test("carries definitions, labels and a source reference for each", async () => {
  await withFixture((db) => {
    const [citta] = found(ask(db, "città"));
    assert.equal(citta.senses.length, 1);
    assert.equal(citta.senses[0].glosses[0].text, "centro abitato di grandi dimensioni");
    // Every value points at the exact line and field it was read from, so a
    // reader can check it against the archive.
    assert.equal(citta.senses[0].glosses[0].ref.pointer, "/senses/0/glosses/0");
    assert.equal(citta.senses[0].glosses[0].ref.lineNo, citta.lineNo);

    const [studente] = found(ask(db, "studente")).filter((r) => r.pos === "noun");
    assert.deepEqual(
      studente.senses[0].labels.map((l) => `${l.kind}:${l.label}`),
      ["raw_tag:scuola"],
    );
  });
});

test("surfaces a disputed claim instead of hiding or correcting it", async () => {
  await withFixture((db) => {
    // The verb reading of `studente` is contradicted by Wiktionary's own
    // `studiare` table and by Treccani, which both give `studiante`.
    const verbId = (
      db.prepare("SELECT record_id FROM source_record WHERE word = 'studente' AND pos = 'verb'")
        .get() as { record_id: number }
    ).record_id;
    db.prepare(
      `INSERT INTO claim_review
         (record_id, json_pointer, status, note, evidence_url, reviewed_at, reviewed_by)
       VALUES (?, '/senses/0/glosses/0', 'disputed',
               'Wiktionary''s studiare table and Treccani both give studiante.',
               'https://www.treccani.it/vocabolario/studiare/', '2026-09-19', 'test')`,
    ).run(verbId);

    const verb = found(ask(db, "studente")).find((r) => r.pos === "verb");
    assert.ok(verb);
    assert.equal(verb.reviews.length, 1);
    assert.equal(verb.reviews[0].status, "disputed");
    assert.equal(verb.reviews[0].pointer, "/senses/0/glosses/0");

    // The claim itself is untouched. A dispute annotates; it never rewrites.
    assert.equal(
      verb.senses[0].glosses[0].text,
      "participio presente singolare maschile di studiare",
    );
  });
});

test("refuses to serve a release that is not complete", async () => {
  await withFixture((db) => {
    db.exec("UPDATE source_release SET status = 'importing'");
    // Answering "no results" would be a different, false claim from "this
    // release is not servable".
    assert.throws(() => ask(db, "sale"), /no complete release/);
  });
});

test("resolving lemma links never materialises the candidate view", async () => {
  await withFixture((db) => {
    // Rows-only tests cannot see this. LEFT JOINing `form_of_candidate` returns
    // exactly the same answer and, on the real release, takes 2,686 ms instead
    // of 0.1 ms: SQLite cannot push `record_id = ?` through a LEFT JOIN onto a
    // view, so it builds all 608,726 edges against 1,273,490 lookup rows first.
    const plan = (
      db.prepare(`EXPLAIN QUERY PLAN ${LEMMA_LINK_SQL}`).all(1) as { detail: string }[]
    ).map((row) => row.detail);

    assert.ok(
      !plan.some((step) => /MATERIALIZE|SCAN lookup_form|SCAN form_of_edge/.test(step)),
      `lemma-link query degraded to a scan:\n${plan.join("\n")}`,
    );
    // It must still be driven by the edge's own record index.
    assert.ok(
      plan.some((step) => step.includes("form_of_edge_by_record")),
      `lemma-link query stopped using form_of_edge_by_record:\n${plan.join("\n")}`,
    );
  });
});
