import assert from "node:assert/strict";
import { test } from "node:test";
import { archiveFactsForRelease, releaseSource, type ArchiveFacts } from "../src/source/archiveFacts.js";

const JULY_SHA = "0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf";

test("the July release id finds the July archive's facts", () => {
  assert.deepEqual(releaseSource("it-0c432803"), {
    dump: { date: "2026-07-01", url: "https://dumps.wikimedia.org/itwiktionary/20260701/" },
    sourceUrl: "https://kaikki.org/dictionary/downloads/it/it-extract.jsonl.gz",
  });
});

test("an id that names no archive has no facts", () => {
  for (const releaseId of ["it-dev", "it-0c432804", "it-0C432803", "0c432803", "it-0c4328", "production"]) {
    assert.equal(archiveFactsForRelease(releaseId), undefined, releaseId);
    assert.deepEqual(releaseSource(releaseId), { dump: null, sourceUrl: null }, releaseId);
  }
});

test("an id two archives share gets neither archive's facts", () => {
  const facts: ArchiveFacts = {
    sourceUrl: "https://example.org/a.jsonl.gz",
    retrievedAt: "2026-01-01T00:00:00Z",
    dump: { id: "itwiktionary-20260101", basis: "recorded" },
    evidence: [],
  };
  const catalog = { [JULY_SHA]: facts, [`0c432803${"f".repeat(56)}`]: facts };
  assert.equal(archiveFactsForRelease("it-0c432803", catalog), undefined);
});
