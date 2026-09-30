// Multi-word search (#214): a query nothing spells, read word by word as its
// lemmas, finds the multi-word headwords those lemmas spell — over the
// development fixture seeded the way `pnpm run seed:dev` seeds D1; and a query
// that nearly spells one, offered in the "Did you mean" list. The page and
// `/v1/lookup` over the same fixture are tested in web/test.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import {
  lemmaSequences,
  MAX_CORRECTED_WORD_LENGTH,
  MAX_PHRASE_PROBES,
  oneEditSpellings,
  participleCandidates,
  phraseSlots,
  slotRuns,
  type WordLemmas,
} from "../src/italian/phrase.js";
import { seedSql } from "../src/import/seedSql.js";
import { fromNodeSqlite } from "../src/lookup/database.js";
import { exists, lookup } from "../src/lookup/lookup.js";
import { findNearby, withinOneEdit } from "../src/lookup/nearby.js";
import {
  HEADWORD_PREFIX_SQL,
  headwordKeySql,
  NEAR_LEMMA_SQL,
  PAST_PARTICIPLE_SQL,
  WORD_LEMMA_SQL,
} from "../src/lookup/phrase.js";
import type { FoundResult, LookupResult } from "../src/lookup/types.js";

const RELEASE = "it-phrase-test";

let dir: string;
let sqlite: DatabaseSync;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "lexema-phrase-"));
  const archive = join(dir, "dev-seed.jsonl.gz");
  await writeFile(archive, gzipSync(await readFile("fixtures/dev-seed.jsonl")));
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
  sqlite = new DatabaseSync(":memory:");
  for (const part of parts) sqlite.exec(await readFile(part, "utf8"));
});

after(async () => {
  sqlite.close();
  await rm(dir, { recursive: true, force: true });
});

const ask = (query: string): Promise<LookupResult> => lookup({ db: fromNodeSqlite(sqlite), releaseId: RELEASE, query });

async function found(query: string): Promise<FoundResult> {
  const result = await ask(query);
  assert.equal(result.outcome, "found", `${query} is found`);
  return result as FoundResult;
}

const words = (result: FoundResult): string[] => result.readings.map((reading) => reading.word);

test("an inflected expression finds the multi-word headword its lemmas spell", async () => {
  const vado = await found("vado via");
  assert.deepEqual(words(vado), ["andare via"]);
  assert.deepEqual(vado.route, {
    kind: "phrase",
    phrases: [{ key: "andare via", words: [{ typed: "vado", lemma: "andare" }, { typed: "via", lemma: "via" }] }],
  });

  const tiro = await found("tiro fuori");
  assert.deepEqual(words(tiro), ["tirare fuori"]);
  // `tiro` is also a noun headword, so `tiro fuori` was tried too and is no headword.
  assert.deepEqual(tiro.route.kind === "phrase" && tiro.route.phrases.map((phrase) => phrase.key), ["tirare fuori"]);
});

test("an auxiliary and a past participle stand for the participle's verb", async () => {
  const result = await found("sono andati via");
  assert.deepEqual(words(result), ["andare via"]);
  assert.deepEqual(result.route, {
    kind: "phrase",
    phrases: [{ key: "andare via", words: [{ typed: "sono andati", lemma: "andare" }, { typed: "via", lemma: "via" }] }],
  });
});

test("a word with several lemmas tries each, and every headword they spell is a reading", async () => {
  // `volto` is `voltare`'s first person and `volgere`'s past participle.
  const result = await found("volto le spalle");
  assert.deepEqual(words(result).sort(), ["volgere le spalle", "voltare le spalle"]);
  assert.ok(result.readings.every((reading) => reading.isAboutQuery));
});

test("a lemma sequence that is no headword is still not found", async () => {
  for (const query of ["vado fuori", "tiro via", "sono via", "vado"]) {
    const result = await ask(query);
    if (query === "vado") {
      // One word is the exact lookup's alone, unchanged.
      assert.equal(result.outcome === "found" && result.route.kind, "surface");
      continue;
    }
    assert.equal(result.outcome, "not-found", query);
  }
});

test("a query the index spells is answered as typed, never word by word", async () => {
  const result = await found("andare via");
  assert.deepEqual(result.route, { kind: "surface" });
  assert.deepEqual(words(result), ["andare via"]);
});

test("exists agrees with lookup on a phrase", async () => {
  const db = fromNodeSqlite(sqlite);
  const present = await exists({ db, releaseId: RELEASE, query: "vado via" });
  assert.equal(present.outcome === "present" && present.word, "andare via");
  const absent = await exists({ db, releaseId: RELEASE, query: "vado fuori" });
  assert.equal(absent.outcome, "absent");
});

test("the rule collapses only an auxiliary followed by a participle", () => {
  const sono: WordLemmas = { typed: "sono", lemmas: ["essere", "sono"] };
  const andati: WordLemmas = { typed: "andati", lemmas: ["andare", "andati", "andato"] };
  const via: WordLemmas = { typed: "via", lemmas: ["via"] };
  assert.deepEqual(participleCandidates([sono, andati, via]), [1]);
  assert.deepEqual(
    phraseSlots([sono, andati, via], (index) => (index === 1 ? ["andare"] : [])),
    [{ typed: "sono andati", lemmas: ["andare"] }, { typed: "via", lemmas: ["via"] }],
  );
  // No participle after the auxiliary: every word is its own slot, `essere` included.
  assert.deepEqual(
    phraseSlots([sono, via], () => []),
    [{ typed: "sono", lemmas: ["essere", "sono"] }, { typed: "via", lemmas: ["via"] }],
  );
  // A final auxiliary has nothing to join.
  assert.deepEqual(participleCandidates([via, sono]), []);
});

test("the lemma sequences are bounded", () => {
  const slot = (n: number) => ({ typed: "x", lemmas: Array.from({ length: n }, (_, i) => `l${i}`) });
  assert.equal(lemmaSequences([slot(16), slot(16)])?.length, MAX_PHRASE_PROBES);
  assert.equal(lemmaSequences([slot(16), slot(16), slot(2)]), undefined);
  assert.deepEqual(lemmaSequences([slot(2), slot(0)]), []);
});

test("every phrase query stays on indexes rather than scanning", () => {
  const plans = [
    [WORD_LEMMA_SQL, [RELEASE, "vado", RELEASE, "vado"]],
    [PAST_PARTICIPLE_SQL, [RELEASE, "andato"]],
    [headwordKeySql(2), [RELEASE, "andare via", "tirare fuori"]],
    [NEAR_LEMMA_SQL, [RELEASE, JSON.stringify(oneEditSpellings("vadp"))]],
    [HEADWORD_PREFIX_SQL, [RELEASE, "tirare fuo", "tirare fup", 8]],
  ] as const;
  for (const [sql, params] of plans) {
    const plan = (sqlite.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params) as { detail: string }[]).map((row) => row.detail);
    assert.ok(
      !plan.some((step) => /SCAN (lookup_form|form_of_edge|grammar_claim|source_record|lf|hw|e|g|r)\b/.test(step)),
      `phrase query degraded to a scan:\n${plan.join("\n")}`,
    );
  }
});

const nearby = (query: string) => findNearby({ db: fromNodeSqlite(sqlite), releaseId: RELEASE, query });

test("a phrase with one word misspelled is offered as Did you mean, not found", async () => {
  for (const [query, phrase] of [
    ["tiro fouri", "tirare fuori"],
    // `vadp` is one edit from `vado`, which is a form of `andare`.
    ["vadp via", "andare via"],
  ] as const) {
    assert.equal((await ask(query)).outcome, "not-found", query);
    assert.deepEqual(await nearby(query), { kind: "phrase", best: phrase, others: [] }, query);
  }
});

test("a phrase the whole query is one edit from is offered once, as the typo", async () => {
  // `tirre fuori` is one edit from `tirare fuori` itself, and `tirre` from `tirare`.
  assert.deepEqual(await nearby("tirre fuori"), { kind: "typo", best: "tirare fuori", others: [], phrases: [] });
});

test("a phrase whose last word is not finished is offered", async () => {
  assert.deepEqual(await nearby("tiro fuo"), { kind: "phrase", best: "tirare fuori", others: [] });
  const volto = await nearby("volto le");
  assert.equal(volto.kind, "phrase");
  assert.deepEqual(volto.kind === "phrase" && [volto.best, ...volto.others].sort(), ["volgere le spalle", "voltare le spalle"]);
});

test("a phrase that is only part of the query is offered", async () => {
  assert.deepEqual(await nearby("vado via adesso"), { kind: "phrase", best: "andare via", others: [] });
});

test("a query that nearly spells no headword offers no phrase", async () => {
  for (const query of ["vado fuori", "tiro via", "sono via"]) {
    const offer = await nearby(query);
    assert.ok(offer.kind !== "phrase" && !("phrases" in offer && offer.phrases.length > 0), `${query}: ${JSON.stringify(offer)}`);
  }
});

test("a word's one-edit spellings are every edit withinOneEdit counts, never the word", () => {
  const spellings = oneEditSpellings("vadp");
  assert.ok(spellings.includes("vado") && spellings.includes("vapd") && spellings.includes("vad") && spellings.includes("vadpo"));
  assert.ok(!spellings.includes("vadp"));
  assert.ok(spellings.every((spelling) => withinOneEdit("vadp", spelling)));
  assert.deepEqual(oneEditSpellings("a".repeat(MAX_CORRECTED_WORD_LENGTH + 1)), []);
});

test("a query's parts are its runs of two or more slots, not all of them", () => {
  const slot = (typed: string) => ({ typed, lemmas: [typed] });
  assert.deepEqual(slotRuns([slot("a"), slot("b")]), []);
  assert.deepEqual(
    slotRuns([slot("a"), slot("b"), slot("c")]).map((run) => run.map((s) => s.typed).join(" ")),
    ["a b", "b c"],
  );
});
