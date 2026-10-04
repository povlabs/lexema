// A fact read off an archive record points into the archive; one a page-only
// entry carries points at a raw page line (ADR 0026). A test that reads an
// archive record's fact narrows its ref here, and fails if it is not one.

import assert from "node:assert/strict";
import { isSourceRef, type FactRef, type SourceRef } from "../src/lookup/types.js";

export function archiveRef(ref: FactRef): SourceRef {
  assert.ok(isSourceRef(ref), "an archive record's fact points into the archive");
  return ref;
}
