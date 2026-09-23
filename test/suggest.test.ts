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
  SUGGEST_SQL,
  type SuggestResult,
  isAskablePrefix,
  prefixUpperBound,
  suggest,
} from "../src/lookup/suggest.js";

// Each line is here for one rule of the rank or one bound. The shapes are the
// release's: a verb with its own senses beside records that are only its
// forms, one spelling carried by several records, a capitalised proper noun,
// an accented word and its unaccented twin, and a typographic apostrophe.
const record = (word: string, senses: object[], extra: object = {}) =>
  JSON.stringify({ word, pos: "noun", pos_title: "Sostantivo", lang_code: "it", senses, ...extra });
const defines = (gloss: string) => ({ glosses: [gloss] });
const formOf = (lemma: string) => ({ glosses: [`forma di ${lemma}`], tags: ["form-of"], form_of: [{ word: lemma }] });

const LINES = [
  // `and`: alphabetical order puts `anda`, `andai` and `Andalusia` ahead of
  // `andare`; only `andare` and the proper noun define anything.
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

  // Twelve spellings under one prefix, for the limit.
  ...Array.from({ length: 12 }, (_, i) => record(`zeta${String.fromCharCode(97 + i)}`, [defines("lettera")])),
];

const RELEASE = "it-suggest-test";

async function withFixture(run: (db: DatabaseSync) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-suggest-"));
  const db = new DatabaseSync(":memory:");
  try {
    const archive = join(dir, "fixture.jsonl.gz");
    const output = join(dir, "seed.sql");
    await writeFile(archive, gzipSync(Buffer.from(LINES.join("\n") + "\n", "utf8")));
    await seedSql({
      input: archive,
      output,
      schema: "src/db/schema.sql",
      releaseId: RELEASE,
      archiveR2Key: "releases/it-suggest-test.jsonl.gz",
      sourceUrl: "https://example.invalid/it-extract.jsonl.gz",
      license: "CC-BY-SA-4.0",
      onRejection: (rejection) => {
        throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
      },
    });
    db.exec(await readFile(output, "utf8"));
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

test("a spelling with its own definition ranks above records that are only forms of another word", async () => {
  await withFixture(async (db) => {
    // Alphabetically this is anda, andai, Andalusia, andammo, andare.
    assert.deepEqual(await spellings(db, "and"), ["andare", "Andalusia", "anda", "andai", "andammo"]);
  });
});

test("the exact spelling comes first, even when it only names another word", async () => {
  await withFixture(async (db) => {
    assert.deepEqual(await spellings(db, "anda"), ["anda", "andare", "Andalusia", "andai", "andammo"]);
  });
});

test("among spellings that define something, the shorter comes first", async () => {
  await withFixture(async (db) => {
    assert.deepEqual(await spellings(db, "sal"), ["sala", "sale", "salacca"]);
  });
});

test("a spelling several records carry is suggested once, and counts as defined if any record defines it", async () => {
  await withFixture(async (db) => {
    const sale = await spellings(db, "sal");
    assert.equal(sale.filter((word) => word === "sale").length, 1);
    // `sale` has one defining record among three; it ranks with the defined.
    assert.ok(sale.indexOf("sale") < sale.indexOf("salacca"));
  });
});

test("a record with any sense of its own defines something, even beside a form-of sense", async () => {
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
    assert.deepEqual(await spellings(db, "citt"), ["città", "cittadino"]);
    // `città` does not start with `citta`, and is not offered as if it did.
    assert.deepEqual(await spellings(db, "citta"), ["cittadino"]);
    assert.deepEqual(await spellings(db, "città"), ["città"]);
    // A decomposed accent is the same letter after NFC.
    assert.deepEqual(await spellings(db, "citta\u0300"), ["città"]);
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
    for (const short of ["", " ", "a", " a ", "è"]) {
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
  assert.equal(MIN_PREFIX_LENGTH, 2);
  for (const short of ["", "a", " a ", "è"]) assert.equal(isAskablePrefix(short), false, short);
  for (const askable of ["io", "è?", " ca ", "città"]) assert.equal(isAskablePrefix(askable), true, askable);
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
      db.prepare(`EXPLAIN QUERY PLAN ${SUGGEST_SQL}`).all(RELEASE, "cas", "cat", 10) as { detail: string }[]
    ).map((row) => row.detail);
    assert.ok(!plan.some((step) => /SCAN (lookup_form|lf|sense|s|form_of_edge|e)\b/.test(step)), plan.join("\n"));
    assert.ok(
      plan.some((step) => step.includes("lookup_form_headword_by_key") && /surface_key>\? AND surface_key<\?/.test(step)),
      plan.join("\n"),
    );
  });
});
