import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { seedSql } from "../src/import/seedSql.js";
import { fromNodeSqlite } from "../src/lookup/database.js";
import { MAX_QUERY_LENGTH } from "../src/lookup/lookup.js";
import {
  MAX_PREFIX_LENGTH,
  MIN_PREFIX_LENGTH,
  SUGGESTION_LIMIT,
  FIRST_SCAN,
  type SuggestResult,
  isAskablePrefix,
  prefixUpperBound,
  suggest,
} from "../src/lookup/suggest.js";
import { HEADWORD_PREFIX_SQL } from "../src/lookup/keyRange.js";

// Each line is here for one rule of the order or one bound. The shapes are the
// release's: a verb beside records that are only its forms, one spelling
// carried by several records, a capitalised proper noun, an accented word and
// its unaccented twin, and a typographic apostrophe.
const record = (word: string, senses: object[], extra: object = {}) =>
  JSON.stringify({ word, pos: "noun", pos_title: "Sostantivo", lang_code: "it", senses, ...extra });
const defines = (gloss: string) => ({ glosses: [gloss] });
const formOf = (lemma: string) => ({ glosses: [`forma di ${lemma}`], tags: ["form-of"], form_of: [{ word: lemma }] });

const LINES = [
  // `and`: listed in key order, whatever each record defines.
  record("andai", [formOf("andare")]),
  record("anda", [formOf("andare")]),
  record("andammo", [formOf("andare")]),
  record("Andalusia", [defines("regione della Spagna")]),
  record("andare", [defines("muoversi")], { pos: "verb", pos_title: "Verbo", forms: [{ form: "andando", tags: ["gerund"] }] }),

  // One spelling, three records: listed once. One of them defines it.
  record("sale", [defines("cloruro di sodio")]),
  record("sale", [formOf("sala")]),
  record("sale", [formOf("salire")], { pos: "verb", pos_title: "Voce verbale" }),
  record("sala", [defines("stanza")]),
  record("salacca", [defines("pesce")]),

  // A record with one form-of sense and one of its own defines something.
  record("casetta", [formOf("casa"), defines("piccola casa di campagna")]),
  record("casette", [formOf("casetta")]),
  record("casa", [defines("edificio")]),
  record("casacca", [defines("giacca")]),

  // Accents are part of the spelling.
  record("città", [defines("centro abitato")]),
  record("cittadino", [defines("abitante")]),
  record("un’amica", [defines("una amica")]),

  // One spelling heading more records than the first read takes, then nine
  // more spellings: the first read sees only the repeated one.
  ...Array.from({ length: 250 }, () => record("qq", [defines("ripetuta")])),
  ...Array.from({ length: 9 }, (_, i) => record(`qq${String.fromCharCode(97 + i)}`, [defines("dopo")])),

  // Twelve spellings under one prefix, for the limit.
  ...Array.from({ length: 12 }, (_, i) => record(`zeta${String.fromCharCode(97 + i)}`, [defines("lettera")])),
];

const RELEASE = "it-suggest-test";

async function withFixture(run: (db: DatabaseSync) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-suggest-"));
  const db = new DatabaseSync(":memory:");
  try {
    const archive = join(dir, "fixture.jsonl.gz");
    const outputDir = join(dir, "sql");
    await writeFile(archive, gzipSync(Buffer.from(LINES.join("\n") + "\n", "utf8")));
    const { parts } = await seedSql({
      input: archive,
      outputDir,
      schema: "src/db/schema.sql",
      releaseId: RELEASE,
      archiveR2Key: "releases/it-suggest-test.jsonl.gz",
        license: "CC-BY-SA-4.0",
      onRejection: (rejection) => {
        throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
      },
    });
    for (const part of parts) db.exec(await readFile(part, "utf8"));
    await run(db);
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
}

const ask = (db: DatabaseSync, prefix: string): Promise<SuggestResult> =>
  suggest({ db: fromNodeSqlite(db), releaseId: RELEASE, prefix });

async function spellings(db: DatabaseSync, prefix: string): Promise<string[]> {
  const result = await ask(db, prefix);
  assert.ok(result.outcome === "suggested", `expected suggestions for ${prefix}, got ${result.outcome}`);
  return result.suggestions;
}

test("suggestions come in alphabetical order of the key", async () => {
  await withFixture(async (db) => {
    // Huey's ruling: "it should show alphabetical order like the first 10".
    assert.deepEqual(await spellings(db, "and"), ["anda", "andai", "Andalusia", "andammo", "andare"]);
    assert.deepEqual(await spellings(db, "sal"), ["sala", "salacca", "sale"]);
  });
});

test("a single letter lists the first words under it", async () => {
  await withFixture(async (db) => {
    assert.deepEqual(await spellings(db, "c"), ["casa", "casacca", "casetta", "casette", "cittadino", "città"]);
  });
});

test("a spelling several records carry is suggested once", async () => {
  await withFixture(async (db) => {
    assert.equal((await spellings(db, "sal")).filter((word) => word === "sale").length, 1);
  });
});

test("every headword under the prefix is offered, whatever its senses say", async () => {
  await withFixture(async (db) => {
    // casetta: one form-of sense and one of its own. casette: only a form.
    assert.deepEqual(await spellings(db, "case"), ["casetta", "casette"]);
  });
});

test("suggestions are headwords, never a spelling found only in another record's table", async () => {
  await withFixture(async (db) => {
    assert.deepEqual(await spellings(db, "andand"), []);
  });
});

test("the original spelling is shown, and the prefix goes through exact lookup's normalizer", async () => {
  await withFixture(async (db) => {
    // Case folds for matching and survives in what is shown.
    assert.deepEqual(await spellings(db, "ANDAL"), ["Andalusia"]);
    // A straight apostrophe finds the typographic one, which is what is shown.
    assert.deepEqual(await spellings(db, "un'a"), ["un’amica"]);
    assert.deepEqual(await spellings(db, "  cas  "), ["casa", "casacca", "casetta", "casette"]);
  });
});

test("accents are never dropped or folded away", async () => {
  await withFixture(async (db) => {
    // Keys compare by code point, so `à` (U+00E0) sorts after every unaccented
    // letter at the same position: `cittadino` before `città`. Recorded in
    // docs/LOOKUP.md; a reader-facing collation would need every match sorted.
    assert.deepEqual(await spellings(db, "citt"), ["cittadino", "città"]);
    // `città` does not start with `citta`, and is not offered as if it did.
    assert.deepEqual(await spellings(db, "citta"), ["cittadino"]);
    assert.deepEqual(await spellings(db, "città"), ["città"]);
    // A decomposed accent is the same letter after NFC.
    assert.deepEqual(await spellings(db, "citta\u0300"), ["città"]);
  });
});

test("ten distinct spellings are found when ten exist, however many records one spelling heads", async () => {
  await withFixture(async (db) => {
    // 250 records spell `qq`, more than the first read of FIRST_SCAN rows, so
    // that read holds one spelling and the next read must find the rest.
    assert.ok(250 > FIRST_SCAN);
    assert.deepEqual(await spellings(db, "qq"), ["qq", "qqa", "qqb", "qqc", "qqd", "qqe", "qqf", "qqg", "qqh", "qqi"]);
  });
});

test("an answer holds at most ten suggestions", async () => {
  await withFixture(async (db) => {
    const zeta = await spellings(db, "zeta");
    assert.equal(SUGGESTION_LIMIT, 10);
    assert.equal(zeta.length, SUGGESTION_LIMIT);
    assert.deepEqual(zeta, ["zetaa", "zetab", "zetac", "zetad", "zetae", "zetaf", "zetag", "zetah", "zetai", "zetaj"]);
  });
});

test("a prefix outside the bounds is refused without asking the index", async () => {
  await withFixture(async (db) => {
    for (const short of ["", " "]) {
      const result = await ask(db, short);
      assert.equal(result.outcome, "rejected", short);
      assert.equal(result.outcome === "rejected" && result.rejection.reason, "too-short", short);
    }
    assert.equal(MAX_PREFIX_LENGTH, MAX_QUERY_LENGTH);
    const long = await ask(db, "a".repeat(MAX_PREFIX_LENGTH + 1));
    assert.deepEqual(long.outcome === "rejected" && long.rejection, {
      reason: "too-long",
      length: MAX_PREFIX_LENGTH + 1,
      limit: MAX_PREFIX_LENGTH,
    });
    assert.equal((await ask(db, "a".repeat(MAX_PREFIX_LENGTH))).outcome, "suggested");
  });
});

test("the field and the server agree on which prefixes can be asked", () => {
  assert.equal(MIN_PREFIX_LENGTH, 1);
  for (const short of ["", " "]) assert.equal(isAskablePrefix(short), false, short);
  for (const askable of ["a", " a ", "è", "io", " ca ", "città"]) assert.equal(isAskablePrefix(askable), true, askable);
  assert.equal(isAskablePrefix("a".repeat(MAX_PREFIX_LENGTH + 1)), false);
});

test("a release that is not servable is refused, as exact lookup refuses it", async () => {
  await withFixture(async (db) => {
    await assert.rejects(suggest({ db: fromNodeSqlite(db), releaseId: "it-missing", prefix: "casa" }), /no complete release/);
  });
});

test("the upper bound is the least key past every key with the prefix", () => {
  assert.equal(prefixUpperBound("cas"), "cat");
  assert.equal(prefixUpperBound("citt"), "citu");
  assert.equal(prefixUpperBound("città"), "citt\u00e1");
  assert.equal(prefixUpperBound("a\u{d7ff}"), "a\u{e000}");
  assert.equal(prefixUpperBound("a\u{10ffff}"), "b");
  assert.throws(() => prefixUpperBound("\u{10ffff}"));
});

test("the prefix query is a range probe on the headword index, not a scan", async () => {
  await withFixture(async (db) => {
    const plan = (
      db.prepare(`EXPLAIN QUERY PLAN ${HEADWORD_PREFIX_SQL}`).all(RELEASE, "cas", "cat", 10) as { detail: string }[]
    ).map((row) => row.detail);
    assert.ok(!plan.some((step) => /SCAN (lookup_form|lf|sense|s|form_of_edge|e)\b/.test(step)), plan.join("\n"));
    assert.ok(
      plan.some((step) => step.includes("lookup_form_headword_by_key") && /surface_key>\? AND surface_key<\?/.test(step)),
      plan.join("\n"),
    );
    // Rows come back in index order, so nothing is sorted and LIMIT stops the
    // walk early: a one-letter prefix costs what a long one does.
    assert.ok(!plan.some((step) => /TEMP B-TREE/.test(step)), plan.join("\n"));
  });
});
