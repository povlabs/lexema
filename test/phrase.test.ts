// Multi-word search (#214): a query nothing spells, read word by word as its
// lemmas, is offered the multi-word headwords those lemmas spell — over the
// development fixture seeded the way `pnpm run seed:dev` seeds D1. It is still
// not found: the headwords are suggestions (Huey's ruling, 2026-09-30). The
// page and `/v1/lookup` over the same fixture are tested in web/test.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import {
  lemmaSequences,
  MAX_PHRASE_PROBES,
  participleCandidates,
  phraseSlots,
  type WordLemmas,
} from "../src/italian/phrase.js";
import { seedSql } from "../src/import/seedSql.js";
import { fromNodeSqlite } from "../src/lookup/database.js";
import { exists, lookup } from "../src/lookup/lookup.js";
import { findNearby, type Nearby } from "../src/lookup/nearby.js";
import { headwordKeySql, PAST_PARTICIPLE_SQL, phraseHeadwords, WORD_LEMMA_SQL } from "../src/lookup/phrase.js";

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

const nearby = (query: string): Promise<Nearby> => findNearby({ db: fromNodeSqlite(sqlite), releaseId: RELEASE, query });
const headwords = (key: string): Promise<string[]> => phraseHeadwords(fromNodeSqlite(sqlite), RELEASE, key);

test("an inflected expression is still not found, and is offered the headword its lemmas spell", async () => {
  for (const [query, headword] of [
    ["vado via", "andare via"],
    // `tiro` is also a noun headword, so `tiro fuori` was tried too and is no headword.
    ["tiro fuori", "tirare fuori"],
    // An auxiliary and a past participle stand for the participle's verb.
    ["sono andati via", "andare via"],
  ]) {
    const db = fromNodeSqlite(sqlite);
    assert.equal((await lookup({ db, releaseId: RELEASE, query })).outcome, "not-found", query);
    assert.equal((await exists({ db, releaseId: RELEASE, query })).outcome, "absent", query);
    assert.deepEqual(await nearby(query), { kind: "phrase", best: headword, others: [] }, query);
  }
});

test("a word with several lemmas tries each, and every headword they spell is offered", async () => {
  // `volto` is `voltare`'s first person and `volgere`'s past participle.
  const offer = await nearby("volto le spalle");
  assert.equal(offer.kind, "phrase");
  assert.deepEqual(offer.kind === "phrase" && [offer.best, ...offer.others].sort(), ["volgere le spalle", "voltare le spalle"]);
});

test("a lemma sequence that is no headword offers no expression", async () => {
  for (const query of ["vado fuori", "tiro via", "sono via"]) {
    assert.notEqual((await nearby(query)).kind, "phrase", query);
    assert.deepEqual(await headwords(query), [], query);
  }
  // One word is never read this way.
  assert.deepEqual(await headwords("vado"), []);
});

test("a headword is never offered as an expression of itself", async () => {
  assert.deepEqual(await headwords("andare via"), []);
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
  ] as const;
  for (const [sql, params] of plans) {
    const plan = (sqlite.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params) as { detail: string }[]).map((row) => row.detail);
    assert.ok(
      !plan.some((step) => /SCAN (lookup_form|form_of_edge|grammar_claim|source_record|lf|hw|e|g|r)\b/.test(step)),
      `phrase query degraded to a scan:\n${plan.join("\n")}`,
    );
  }
});
