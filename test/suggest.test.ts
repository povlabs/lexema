import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { seedSql } from "../src/import/seedSql.js";
import { fromNodeSqlite, type LookupDatabase } from "../src/lookup/database.js";
import { MAX_QUERY_LENGTH, servableRelease } from "../src/lookup/lookup.js";
import {
  MAX_PREFIX_LENGTH,
  MIN_PREFIX_LENGTH,
  SUGGESTION_LIMIT,
  FIRST_SCAN,
  CompleteSuggestions,
  offered,
  type SuggestResult,
  isAskablePrefix,
  prefixUpperBound,
  suggest,
} from "../src/lookup/suggest.js";
import { HEADWORD_PREFIX_SQL } from "../src/lookup/keyRange.js";
import { normalizeItalianExact } from "../src/italian/normalize.js";

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

test("two letters list the first words under them, and one letter is refused", async () => {
  await withFixture(async (db) => {
    assert.deepEqual(await spellings(db, "ca"), ["casa", "casacca", "casetta", "casette"]);
    // Huey's call of 2026-10-01 (#387): a single letter is not worth a request.
    assert.deepEqual(await ask(db, "c"), { outcome: "rejected", prefix: { raw: "c" }, rejection: { reason: "too-short", length: 1, limit: 2 } });
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

/**
 * Every prefix of every headword in the fixture that the server answers, each
 * also as a reader might type it: in capitals, with its accents decomposed,
 * with a typographic apostrophe, with a trailing space, and run on past every
 * headword.
 */
function typedPrefixes(): string[] {
  const keys = new Set(LINES.map((line) => normalizeItalianExact((JSON.parse(line) as { word: string }).word)));
  const prefixes = new Set<string>();
  for (const key of keys) {
    const points = [...key];
    for (let end = MIN_PREFIX_LENGTH; end <= points.length; end++) prefixes.add(points.slice(0, end).join(""));
  }
  const typed = [...prefixes].flatMap((prefix) => [
    prefix,
    prefix.toLocaleUpperCase("it-IT"),
    prefix.normalize("NFD"),
    prefix.replace(/'/g, "’"),
    `${prefix} `,
    `${prefix}x`,
  ]);
  return [...new Set(typed)].filter(isAskablePrefix);
}

test("a complete answer narrowed in the browser is what the server answers for the longer prefix", async () => {
  await withFixture(async (db) => {
    const typed = typedPrefixes();
    const server = new Map<string, string[]>();
    for (const prefix of typed) {
      const answer = await ask(db, prefix);
      assert.ok(answer.outcome === "suggested", prefix);
      server.set(prefix, offered(answer));
    }
    let narrowed = 0;
    for (const shorter of typed) {
      const complete = CompleteSuggestions.of(shorter, server.get(shorter)!);
      // A full answer may be missing words, so it never answers for the server.
      assert.equal(complete === undefined, server.get(shorter)!.length === SUGGESTION_LIMIT, shorter);
      if (complete === undefined) continue;
      for (const longer of typed) {
        const local = complete.narrow(longer);
        const startsWithShorter = normalizeItalianExact(longer).startsWith(normalizeItalianExact(shorter));
        assert.equal(local !== undefined, startsWithShorter, `${shorter} → ${longer}`);
        if (local === undefined) continue;
        assert.deepEqual(local, server.get(longer), `${shorter} → ${longer}`);
        narrowed += 1;
      }
    }
    // Not vacuous: thousands of pairs are compared, `ca` → `CASETT` and `un'a` → `UN’AM` among them.
    assert.ok(narrowed > 1000, String(narrowed));
    assert.deepEqual(CompleteSuggestions.of("ca", server.get("ca")!)?.narrow("CASETT"), ["casetta", "casette"]);
    assert.deepEqual(CompleteSuggestions.of("un'a", server.get("un'a")!)?.narrow("UN’AM"), ["un’amica"]);
    assert.deepEqual(CompleteSuggestions.of("cit", server.get("cit")!)?.narrow("città"), ["città"]);
  });
});

test("a complete answer never answers a prefix of several words, a refused one, or another prefix", () => {
  const and = CompleteSuggestions.of("and", ["anda", "andai", "Andalusia", "andammo", "andare"])!;
  // Several words may also be offered phrases (`vado v` → `vado via`), which only the server reads.
  assert.equal(and.narrow("andare v"), undefined);
  assert.equal(and.narrow("a"), undefined);
  assert.equal(and.narrow(`and${"a".repeat(MAX_PREFIX_LENGTH)}`), undefined);
  assert.equal(and.narrow("an"), undefined);
  assert.equal(and.narrow("sal"), undefined);
  assert.deepEqual(and.narrow("and"), ["anda", "andai", "Andalusia", "andammo", "andare"]);
  // A prefix of several words, or a full list, is never kept as complete.
  assert.equal(CompleteSuggestions.of("vado v", ["vado via"]), undefined);
  assert.equal(CompleteSuggestions.of("zeta", Array.from({ length: SUGGESTION_LIMIT }, (_, i) => `zeta${i}`)), undefined);
  assert.equal(CompleteSuggestions.of("a", ["a"]), undefined);
});

test("a prefix outside the bounds is refused without asking the index", async () => {
  await withFixture(async (db) => {
    for (const short of ["", " ", "a", " c ", "è"]) {
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
  // Counted in characters of the normalized key: a decomposed `è` is one, and a trailing space is none.
  for (const short of ["", " ", "a", " a ", "è ", "è"]) assert.equal(isAskablePrefix(short), false, short);
  for (const askable of ["io", " ca ", "èr", "èr", "un'", "città"]) assert.equal(isAskablePrefix(askable), true, askable);
  assert.equal(isAskablePrefix("a".repeat(MAX_PREFIX_LENGTH + 1)), false);
});

test("a release that is not servable is refused, as exact lookup refuses it", async () => {
  await withFixture(async (db) => {
    await assert.rejects(suggest({ db: fromNodeSqlite(db), releaseId: "it-missing", prefix: "casa" }), /no complete release/);
  });
});

test("a release a lookup already found servable is not read again, and its normalizer is still checked (#665)", async () => {
  await withFixture(async (db) => {
    const release = await servableRelease(fromNodeSqlite(db), RELEASE);
    const sent: string[] = [];
    const recorded: LookupDatabase = {
      all: (sql, params) => {
        sent.push(sql);
        return fromNodeSqlite(db).all(sql, params);
      },
    };
    assert.deepEqual(await suggest({ db: recorded, release, prefix: "ca" }), await ask(db, "ca"));
    assert.ok(sent.length > 0);
    assert.ok(!sent.some((sql) => sql.includes("FROM source_release")), sent.join("\n"));
    await assert.rejects(suggest({ db: fromNodeSqlite(db), release: { ...release, normalizer: "it-other" }, prefix: "ca" }), /normalizer/);
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
