// A record's *Expressions* (#213). The four rules Huey ruled on #213
// (2026-10-01) are checked on their own, each on what it changes and what it
// leaves alone, then the lookup is checked over the real archive lines in
// `fixtures/expressions.jsonl`: pancia, battaglia, piano, colore, bello,
// stato (noun and verb), stare, and three multi-word headwords.

import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { seedSql } from "../src/import/seedSql.js";
import { expressionPhrase, hasLetters, withoutLeadingDots, withoutWrappingBrackets } from "../src/italian/expressions.js";
import { expressionMeaning, expressionsOf, mergeExpressions } from "../src/lookup/expressions.js";
import { lookup } from "../src/lookup/lookup.js";
import type { Expression, ExpressionItem, LookupResult, Reading, SourceRef } from "../src/lookup/types.js";
import { readOnlyDictionary } from "./databases.js";

const ref = (i: number, lineNo = 1): SourceRef => ({ releaseId: "r", lineNo, jsonPointer: `/proverbs/${i}`, lineSha256: "x" });

test("rule 1: a phrase opening with ... or … loses the dots, and only there", () => {
  assert.equal(withoutLeadingDots("...in bello"), "in bello");
  assert.equal(withoutLeadingDots("... lo stato delle cose è questo!"), "lo stato delle cose è questo!");
  assert.equal(withoutLeadingDots("…come se nulla fosse"), "come se nulla fosse");
  for (const kept of ["in bello", "il mio progetto di una vita...", "a lungo andare", "..", ".in bello"]) {
    assert.equal(withoutLeadingDots(kept), kept, kept);
  }
});

test("rule 2: a phrase with no letter at all gives no row; one with a letter does", () => {
  assert.equal(hasLetters(":"), false);
  assert.equal(expressionPhrase(":"), undefined);
  assert.equal(expressionPhrase("..."), undefined);
  assert.equal(expressionPhrase("!?"), undefined);
  for (const kept of ["dare battaglia", "è", "a", "...in bello"]) assert.ok(hasLetters(kept), kept);
});

test("rule 3: a phrase wrapped in brackets loses them; brackets that do not wrap it stay", () => {
  assert.equal(withoutWrappingBrackets("(di secondo piano)"), "di secondo piano");
  assert.equal(withoutWrappingBrackets("(di colore)"), "di colore");
  assert.equal(withoutWrappingBrackets("( di qualcosa )"), "di qualcosa");
  for (const kept of [
    "(di) colore (vivo)",
    "fare (qualcosa)",
    "(senso figurato) vantarsi",
    "[essere] amici per sempre",
    "(di secondo piano",
    "di colore",
  ]) {
    assert.equal(withoutWrappingBrackets(kept), kept, kept);
  }
  assert.equal(expressionPhrase("...(di colore)"), "di colore", "the two rules compose");
});

test("rule 4: one phrase is one row, its distinct meanings in source order; an exact repeat adds only its pointer", () => {
  const items: ExpressionItem[] = [
    { phrase: "a pancia in su", meaning: "supino", ref: ref(0) },
    { phrase: "mettere su pancia", meaning: "oziare", ref: ref(2) },
    { phrase: "mettere su pancia", meaning: "ingrassare", ref: ref(3) },
    { phrase: "mettere su pancia", meaning: "oziare", ref: ref(4) },
    { phrase: "Scoppi la pancia piuttosto che la roba avanza", meaning: null, ref: ref(5) },
  ];
  const rows = expressionsOf(items, () => false);
  assert.deepEqual(
    rows.map((row) => [row.phrase, expressionMeaning(row), row.refs.map((each) => each.jsonPointer)]),
    [
      ["a pancia in su", "supino", ["/proverbs/0"]],
      ["mettere su pancia", "oziare; ingrassare", ["/proverbs/2", "/proverbs/3", "/proverbs/4"]],
      ["Scoppi la pancia piuttosto che la roba avanza", null, ["/proverbs/5"]],
    ],
  );
  // A phrase that differs only in case is another phrase.
  assert.equal(expressionsOf([...items, { phrase: "A pancia in su", meaning: "supino", ref: ref(6) }], () => false).length, 4);
});

test("the same list on two records merges into each phrase once, in the first list's order", () => {
  const row = (phrase: string, meanings: string[], lineNo: number): Expression => ({
    phrase,
    meanings,
    hasEntry: false,
    refs: [ref(0, lineNo)],
  });
  const merged = mergeExpressions([
    [row("stato d'animo", [], 1), row("stato civile", [], 1)],
    [row("stato d'animo", [], 2), row("stato civile", ["anagrafe"], 2), row("affare di stato", [], 2)],
  ]);
  assert.deepEqual(
    merged.map((each) => [each.phrase, each.meanings, each.refs.length]),
    [
      ["stato d'animo", [], 2],
      ["stato civile", ["anagrafe"], 2],
      ["affare di stato", [], 1],
    ],
  );
});

// --- The lookup, over real archive lines -------------------------------------

const RELEASE = "it-expressions-test";
const FIXTURE = "fixtures/expressions.jsonl";

async function withExpressionWords(run: (db: DatabaseSync) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-expressions-"));
  const archive = join(dir, "fixture.jsonl.gz");
  await writeFile(archive, gzipSync(await readFile(FIXTURE)));
  const { parts } = await seedSql({
    input: archive,
    outputDir: join(dir, "sql"),
    schema: "src/db/schema.sql",
    releaseId: RELEASE,
    archiveR2Key: `releases/${RELEASE}.jsonl.gz`,
    license: "CC-BY-SA-4.0",
    onRejection: (rejection) => {
      throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
    },
  });
  const db = new DatabaseSync(":memory:");
  try {
    for (const part of parts) db.exec(await readFile(part, "utf8"));
    await run(db);
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
}

async function readings(db: DatabaseSync, query: string): Promise<[Reading, ...Reading[]]> {
  const result: LookupResult = await lookup({ db: readOnlyDictionary(db), releaseId: RELEASE, query });
  assert.ok(result.outcome === "found", `${query}: expected a found result, got ${result.outcome}`);
  return result.readings;
}

const rows = (reading: Reading) =>
  reading.wordFacts.expressions.map((row) => [row.phrase, expressionMeaning(row), row.refs.map((each) => each.jsonPointer)]);

test("each proverbs item gives one row with its phrase, its sense and its pointer; the four rules are the only rewrites", async () => {
  await withExpressionWords(async (db) => {
    const [pancia] = await readings(db, "pancia");
    assert.deepEqual(rows(pancia), [
      ["a pancia in su", "supino", ["/proverbs/0"]],
      ["stare a pancia all'aria", "non fare niente", ["/proverbs/1"]],
      ["mettere su pancia", "oziare; ingrassare", ["/proverbs/2", "/proverbs/3"]],
      ["Pancia piena, piede addormentato", "chi mangia poco ha poca voglia di muoversi", ["/proverbs/4"]],
      ["Scoppi la pancia piuttosto che la roba avanza", null, ["/proverbs/5"]],
      ["pancia a terra", "con tutte le proprie forze", ["/proverbs/6"]],
    ]);

    // battaglia's lone ":" gives no row; its other three stay, meanings verbatim.
    const [battaglia] = await readings(db, "battaglia");
    assert.deepEqual(
      battaglia.wordFacts.expressions.map((row) => row.phrase),
      ["cavallo di battaglia", "dare battaglia", "nome di battaglia"],
    );

    const [bello] = await readings(db, "bello");
    assert.ok(bello.wordFacts.expressions.some((row) => row.phrase === "in bello" && expressionMeaning(row) === "migliore"));
    const piano = (await readings(db, "piano")).find((reading) => reading.pos === "noun");
    assert.deepEqual(piano?.wordFacts.expressions.map((row) => row.phrase), ["di primo piano", "di secondo piano"]);
    const [colore] = await readings(db, "colore");
    assert.deepEqual(colore.wordFacts.expressions.map((row) => row.phrase), ["di colore"]);
  });
});

test("a phrase is marked as having an entry exactly when it is a headword", async () => {
  await withExpressionWords(async (db) => {
    const [battaglia] = await readings(db, "battaglia");
    assert.deepEqual(
      battaglia.wordFacts.expressions.map((row) => [row.phrase, row.hasEntry]),
      [
        ["cavallo di battaglia", true],
        ["dare battaglia", false],
        ["nome di battaglia", true],
      ],
    );
  });
});

test("a form's lemma carries its own expressions: stato the verb names stare", async () => {
  await withExpressionWords(async (db) => {
    const verb = (await readings(db, "stato")).find((reading) => reading.posTitle === "Voce verbale");
    assert.ok(verb);
    const stare = verb.lemmaLinks.flatMap((link) => (link.kind === "candidates" ? link.candidates : []));
    assert.deepEqual(stare.map((lemma) => lemma.word), ["stare"]);
    const phrases = stare[0]?.expressions.map((row) => row.phrase) ?? [];
    assert.ok(phrases.includes("di argomentazione"), "the bracket rule applies to a lemma's list too");
    assert.ok(phrases.every((phrase) => phrase !== ""));
  });
});

test("source_record_json stays byte-for-byte as imported", async () => {
  const lines = (await readFile(FIXTURE, "utf8")).trim().split("\n");
  await withExpressionWords(async (db) => {
    for (const word of ["pancia", "battaglia", "bello", "piano", "colore", "stato"]) await readings(db, word);
    const stored = db.prepare("SELECT j.raw_json FROM source_record_json j JOIN source_record r USING (record_id) ORDER BY r.line_no").all() as { raw_json: string }[];
    assert.deepEqual(stored.map((row) => row.raw_json), lines);
  });
});
