import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { admitsRecord } from "../src/import/importRelease.js";
import {
  assertFormsAgree,
  chooseProbes,
  FormsDisagree,
  LEMMA_LINK_VIA_VIEW_SQL,
  materialises,
  seedInto,
} from "../src/bench/lookupBench.js";
import { syntheticLines, writeSyntheticArchive } from "../src/bench/syntheticCorpus.js";

test("the synthetic corpus is seeded, admitted line by line, and a smaller one is a prefix", () => {
  const large = [...syntheticLines(37, 600)];
  assert.equal(large.length, 600);
  assert.deepEqual([...syntheticLines(37, 150)], large.slice(0, 150));
  assert.notDeepEqual([...syntheticLines(38, 150)], large.slice(0, 150));
  assert.ok(large.every(admitsRecord));
});

async function withBench(run: (db: DatabaseSync, releaseId: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-bench-test-"));
  const db = new DatabaseSync(":memory:");
  try {
    const archive = join(dir, "synthetic.jsonl.gz");
    await writeSyntheticArchive(archive, 37, 1500);
    const { releaseId } = await seedInto(db, archive, join(dir, "sql"), "bench-test");
    await run(db, releaseId);
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
}

test("probes come off the reading-count ranking, most readings first", async () => {
  await withBench(async (db, releaseId) => {
    const probes = chooseProbes(db, releaseId);
    const counts = db.prepare(
      "SELECT count(DISTINCT record_id) AS n FROM lookup_form WHERE release_id = ? GROUP BY surface_key ORDER BY n DESC",
    ).all(releaseId) as { n: number }[];
    assert.equal(probes[0].label, "most");
    assert.equal(probes[0].records.length, counts[0].n);
    const sizes = probes.map((probe) => probe.records.length);
    assert.deepEqual(sizes, [...sizes].sort((a, b) => b - a));
  });
});

test("the two forms agree on rows, and only the view form materialises", async () => {
  await withBench(async (db, releaseId) => {
    const probes = chooseProbes(db, releaseId);
    assert.ok(probes.some((probe) => probe.withEdges > 0), "no probe reading has a lemma link to resolve");
    assertFormsAgree(db, probes);
    assert.deepEqual(materialises(db), { view: true, inlined: false });
  });
});

test("a view form that returns other rows stops the run instead of timing it", async () => {
  await withBench(async (db, releaseId) => {
    const probes = chooseProbes(db, releaseId);
    const drifted = LEMMA_LINK_VIA_VIEW_SQL.replace("t.word        AS candidate_word", "upper(t.word) AS candidate_word");
    assert.throws(() => assertFormsAgree(db, probes, drifted), FormsDisagree);
  });
});
