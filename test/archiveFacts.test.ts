import assert from "node:assert/strict";
import { test } from "node:test";
import { PUBLISHED_ARCHIVE_SHA256, sourceOf } from "../src/source/archiveFacts.js";

test("the published archive's source is the 1 July 2026 dump and the kaikki download", () => {
  assert.deepEqual(sourceOf(PUBLISHED_ARCHIVE_SHA256), {
    dump: { date: "2026-07-01", url: "https://dumps.wikimedia.org/itwiktionary/20260701/" },
    sourceUrl: "https://kaikki.org/dictionary/downloads/it/it-extract.jsonl.gz",
  });
});

test("an archive with no recorded facts has no source", () => {
  assert.deepEqual(sourceOf("f".repeat(64)), { dump: null, sourceUrl: null });
});
