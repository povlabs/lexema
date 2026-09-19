import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { importRelease } from "../src/import/importRelease.js";
import {
  INFLECTION_CANDIDATE_SQL,
  INFLECTION_SQL,
  LEMMA_LINK_SQL,
  MAX_QUERY_LENGTH,
  lookup,
} from "../src/lookup/lookup.js";
import { fromNodeSqlite } from "../src/lookup/database.js";
import type { LookupResult, Reading, RejectedResult, SearchResult } from "../src/lookup/types.js";

// A fixture carrying the shapes the real file forces on a lookup: one surface
// meaning several unrelated things, one word mentioned by records that are not
// its lemma, an edge whose target is several records, a word with no grammar at
// all, and an accented word.
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

const ask = (db: DatabaseSync, query: string): Promise<LookupResult> =>
  lookup({ db: fromNodeSqlite(db), releaseId: RELEASE, query });

function found(result: LookupResult): Reading[] {
  assert.equal(result.outcome, "found");
  return (result as SearchResult).readings;
}

async function withFixture(run: (db: DatabaseSync) => Promise<void>): Promise<void> {
  const { dir, db } = await fixture();
  try {
    await run(db);
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
}

test("rejects an empty query rather than searching for nothing", async () => {
  await withFixture(async (db) => {
    for (const blank of ["", "   ", "\t\n"]) {
      const result = await ask(db, blank);
      assert.equal(result.outcome, "rejected");
      assert.deepEqual(
        (result as RejectedResult).rejection,
        { reason: "empty" },
      );
    }
  });
});

test("rejects an over-long query and says what the limit was", async () => {
  await withFixture(async (db) => {
    const result = await ask(db, "a".repeat(MAX_QUERY_LENGTH + 1));
    assert.equal(result.outcome, "rejected");
    assert.deepEqual(
      (result as RejectedResult).rejection,
      { reason: "too-long", length: MAX_QUERY_LENGTH + 1, limit: MAX_QUERY_LENGTH },
    );
    // The boundary itself is allowed.
    assert.equal((await ask(db, "a".repeat(MAX_QUERY_LENGTH))).outcome, "not-found");
  });
});

test("an unknown word is not-found, not an error and not empty-handed", async () => {
  await withFixture(async (db) => {
    const result = await ask(db, "qwertyuiop");
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
  await withFixture(async (db) => {
    // Accents are meaning, not decoration: stripping them would merge distinct words.
    assert.equal(found(await ask(db, "città")).length, 1);
    assert.equal((await ask(db, "citta")).outcome, "not-found");

    // Case and surrounding whitespace do not change which word was asked for.
    for (const variant of ["CITTÀ", "  Città  ", "cIttÀ"]) {
      assert.equal(found(await ask(db, variant))[0].word, "città");
    }

    // A typed straight quote finds a source spelling with a typographic one.
    const apostrophe = found(await ask(db, "un'amica"));
    assert.equal(apostrophe.length, 1);
    assert.equal(apostrophe[0].word, "un’amica");
  });
});

test("keeps the typed spelling and the source spelling both available", async () => {
  await withFixture(async (db) => {
    const result = await ask(db, "  CITTÀ ");
    const body = result as SearchResult;
    // What the user typed, verbatim — a page has to be able to echo it back.
    assert.equal(body.query.raw, "  CITTÀ ");
    assert.equal(body.query.key, "città");
    // What the source wrote, verbatim.
    assert.equal(body.readings[0].evidence[0].surface, "città");
  });
});

test("returns every reading of an ambiguous surface, unranked", async () => {
  await withFixture(async (db) => {
    // Salt, the plural of `sala`, and a form of `salire`: all three, in source
    // order, with nothing chosen for the reader.
    const readings = found(await ask(db, "sale"));
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
  await withFixture(async (db) => {
    // `studenti` sits on four records across five lookup rows: twice inside
    // `studente`, once inside `studentessa`, and once as its own headword.
    const readings = found(await ask(db, "studenti"));
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
  await withFixture(async (db) => {
    const readings = found(await ask(db, "studenti"));
    const mentions = readings.filter((r) => !r.isAboutQuery);
    const about = readings.filter((r) => r.isAboutQuery);

    // Both list `studenti` in their tables, and neither is a claim about the
    // word. `studentessa` especially: it is the feminine, not the lemma.
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
  await withFixture(async (db) => {
    // Noun `bella` says "femminile di bello". `bello` is three records — one
    // adjective and two nouns — and the source does not say which.
    const [bella] = found(await ask(db, "bella"));
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
  await withFixture(async (db) => {
    // `andare` is in no record here. Dropping the edge would turn "points
    // somewhere we cannot follow" into "points nowhere".
    const [andavano] = found(await ask(db, "andavano"));
    assert.equal(andavano.lemmaLinks.length, 1);
    assert.equal(andavano.lemmaLinks[0].kind, "dangling");
    assert.equal(andavano.lemmaLinks[0].targetWord, "andare");
  });
});

test("lists the inflections that declare themselves forms of a reading", async () => {
  await withFixture(async (db) => {
    const [studente] = found(await ask(db, "studente")).filter((r) => r.pos === "noun");
    assert.deepEqual(
      studente.inflections.map((i) => i.word).sort(),
      ["studentessa", "studenti"],
    );
    // Each link says which word the edge actually named, verbatim.
    assert.ok(studente.inflections.every((i) => i.targetWord === "studente"));
  });
});

test("an incoming inflection edge stays as ambiguous as the source left it", async () => {
  await withFixture(async (db) => {
    // The edge lands on all three `bello` records at once, and the source
    // picked none. Handing it to each as an established relationship would
    // invent three facts out of one unresolved edge.
    const bello = found(await ask(db, "bello"));
    assert.equal(bello.length, 3);

    for (const reading of bello) {
      assert.deepEqual(reading.inflections.map((i) => i.word), ["bella"]);
      const [link] = reading.inflections;
      assert.equal(link.targetWord, "bello");
      // Every candidate travels with the link, this reading included, so no
      // caller can read it as "bella is a form of me".
      assert.deepEqual(
        link.targetCandidates.map((c) => `${c.word}/${c.pos}`),
        ["bello/adj", "bello/noun", "bello/noun"],
      );
      assert.ok(link.targetCandidates.some((c) => c.recordId === reading.recordId));
    }

    // The same edge, seen from the other end, is already ambiguous there. The
    // two directions now agree about how many records `bello` could be.
    const [bella] = found(await ask(db, "bella"));
    const forward = bella.lemmaLinks[0];
    assert.equal(forward.kind, "candidates");
    assert.deepEqual(
      forward.kind === "candidates" ? forward.candidates.map((c) => c.recordId).sort() : [],
      bello[0].inflections[0].targetCandidates.map((c) => c.recordId).sort(),
    );
  });
});

test("a single-candidate inflection edge carries its one candidate too", async () => {
  await withFixture(async (db) => {
    // `sala` is one record, so `sale`'s edge to it is unambiguous — and says so
    // by carrying exactly one candidate rather than by omitting the set.
    const [sala] = found(await ask(db, "sala"));
    assert.deepEqual(sala.inflections.map((i) => i.word), ["sale"]);
    assert.deepEqual(
      sala.inflections[0].targetCandidates.map((c) => c.recordId),
      [sala.recordId],
    );
  });
});

test("keeps stated, unclassified and missing grammar apart in the result", async () => {
  await withFixture(async (db) => {
    const [casa] = found(await ask(db, "casa"));
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
    const [citta] = found(await ask(db, "città"));
    assert.deepEqual(
      citta.grammar.record.filter((c) => c.status === "stated").map((c) => c.status === "stated" && c.value).sort(),
      ["feminine", "invariable"],
    );
  });
});

test("carries definitions, labels and a source reference for each", async () => {
  await withFixture(async (db) => {
    const [citta] = found(await ask(db, "città"));
    assert.equal(citta.senses.length, 1);
    assert.equal(citta.senses[0].glosses[0].text, "centro abitato di grandi dimensioni");
    // Every value points at the exact line and field it was read from, so a
    // reader can check it against the archive.
    assert.equal(citta.senses[0].glosses[0].ref.pointer, "/senses/0/glosses/0");
    assert.equal(citta.senses[0].glosses[0].ref.lineNo, citta.lineNo);

    const [studente] = found(await ask(db, "studente")).filter((r) => r.pos === "noun");
    assert.deepEqual(
      studente.senses[0].labels.map((l) => `${l.kind}:${l.label}`),
      ["raw_tag:scuola"],
    );
  });
});

test("surfaces a disputed claim instead of hiding or correcting it", async () => {
  await withFixture(async (db) => {
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

    const verb = found(await ask(db, "studente")).find((r) => r.pos === "verb");
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
  await withFixture(async (db) => {
    db.exec("UPDATE source_release SET status = 'importing'");
    // Answering "no results" would be a different, false claim from "this
    // release is not servable".
    await assert.rejects(() => ask(db, "sale"), /no complete release/);
  });
});

test("resolving lemma links never materialises the candidate view", async () => {
  await withFixture(async (db) => {
    // Rows-only tests cannot see this: LEFT JOINing `form_of_candidate` returns
    // exactly the same answer, four orders of magnitude slower at release
    // scale. docs/LOOKUP_DESIGN.md explains why; #37 measures it.
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

test("both inflection queries stay on indexes rather than scanning", async () => {
  await withFixture(async (db) => {
    // The candidate set costs one extra read per reading, so it has to stay an
    // index probe — a scan here reintroduces the cost the lemma-link query was
    // rewritten to avoid.
    for (const [name, sql] of [
      ["inflection", INFLECTION_SQL],
      ["inflection candidate", INFLECTION_CANDIDATE_SQL],
    ] as const) {
      const plan = (
        db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(1) as { detail: string }[]
      ).map((row) => row.detail);

      assert.ok(
        !plan.some((step) => /MATERIALIZE|SCAN lookup_form|SCAN form_of_edge/.test(step)),
        `${name} query degraded to a scan:\n${plan.join("\n")}`,
      );
    }
  });
});
