import assert from "node:assert/strict";
import { test } from "node:test";
import { archiveFactsFor, dumpPage, PUBLISHED_ARCHIVE_SHA256 } from "../src/source/archiveFacts.js";
import { servedRelease } from "../src/source/servedRelease.js";

test("the published archive's source is the 1 July 2026 dump and the kaikki download", () => {
  const facts = archiveFactsFor(PUBLISHED_ARCHIVE_SHA256);
  assert.ok(facts);
  assert.deepEqual(dumpPage(facts.dump.id), { date: "2026-07-01", url: "https://dumps.wikimedia.org/itwiktionary/20260701/" });
  assert.equal(facts.sourceUrl, "https://kaikki.org/dictionary/downloads/it/it-extract.jsonl.gz");
  // With no feed declared, it is the release the dictionary serves.
  assert.deepEqual(servedRelease([]), { release: "it-0c432803", dump: { date: "2026-07-01", url: "https://dumps.wikimedia.org/itwiktionary/20260701/" } });
});

test("an archive with no recorded facts has no source", () => {
  assert.equal(archiveFactsFor("f".repeat(64)), undefined);
});
