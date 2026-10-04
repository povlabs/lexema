// A branch's dictionary slice on the account (#447, ADR 0018): the preview
// command's step that gives a Preview of a pull request that changes
// dictionary data its own small D1, `lexema-preview-dict-<name>`, holding the
// words the pull request touches with its changes applied. The Worker reads
// it, read-only, for those words and the shared dictionary for every other
// (src/lookup/slice.ts).
//
// What the slice holds is the root's `pnpm run preview:slice`
// (src/deploy/sliceCli.ts): it reads the declarations the branch adds past
// `main`, plans them against the shared dictionary, which it only reads, and
// writes the slice's SQL and how many rows that SQL writes. This step decides
// what reaches D1:
//
// 1. No declaration, or none that could be read: no slice, and the Preview is
//    today's.
// 2. A slice whose fingerprint (the declarations, schema.sql and the slice's
//    format) matches what the build asks for is reused, and nothing is written.
// 3. Otherwise the slice is built; over `SLICE_ROWS_WRITTEN_CAP` rows written,
//    nothing is written and no slice is bound. Under it, the old slice is
//    deleted, a new one created, and the SQL run on it.
//
// Each step logs a `dictionary slice:` line saying what it did and why. A
// slice is housekeeping for review: whatever fails here, the Preview still
// deploys on the shared dictionary. Every step that touches a D1 refuses the
// shared dictionary, by name or id, first.

import { refuseDictionary, type SliceDatabase } from "./previewConfig.ts";
import type { PreviewName } from "./previewName.ts";
import { listDatabases, required, type Wrangler } from "./wrangler.ts";

/**
 * The most rows one slice write may write, index entries included: 0.2% of
 * the 50 million rows a month Workers Paid includes
 * (https://developers.cloudflare.com/d1/platform/pricing/).
 */
export const SLICE_ROWS_WRITTEN_CAP = 100_000;

/** What `preview:slice declared` answers: no slice and why, or the fingerprint the branch's slice must have. */
export type SliceDeclared =
  | { readonly state: "none"; readonly reason: string }
  | { readonly state: "declared"; readonly fingerprint: string; readonly files: readonly string[] };

/** What `preview:slice build` answers: no slice and why, or the slice's SQL file and what it writes. */
export type SliceBuilt =
  | { readonly state: "none"; readonly reason: string }
  | { readonly state: "built"; readonly fingerprint: string; readonly words: number; readonly rowsWritten: number; readonly sql: string };

/** The root's `preview:slice`, which reads Git and the shared dictionary and writes no database. */
export interface SlicePlanner {
  declared(): SliceDeclared;
  build(): SliceBuilt;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === "string" && value !== "";
const isCount = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;

/** `preview:slice declared`'s answer, or a throw naming what is wrong with it. */
export function readDeclared(text: string): SliceDeclared {
  const value: unknown = JSON.parse(text);
  if (isRecord(value) && value.state === "none" && isText(value.reason)) return { state: "none", reason: value.reason };
  if (isRecord(value) && value.state === "declared" && isText(value.fingerprint) && Array.isArray(value.files) && value.files.every(isText)) {
    return { state: "declared", fingerprint: value.fingerprint, files: value.files };
  }
  throw new Error(`preview:slice declared answered ${text.slice(0, 200)}`);
}

/** `preview:slice build`'s answer, or a throw naming what is wrong with it. */
export function readBuilt(text: string): SliceBuilt {
  const value: unknown = JSON.parse(text);
  if (isRecord(value) && value.state === "none" && isText(value.reason)) return { state: "none", reason: value.reason };
  if (isRecord(value) && value.state === "built" && isText(value.fingerprint) && isCount(value.words) && isCount(value.rowsWritten) && isText(value.sql)) {
    return { state: "built", fingerprint: value.fingerprint, words: value.words, rowsWritten: value.rowsWritten, sql: value.sql };
  }
  throw new Error(`preview:slice build answered ${text.slice(0, 200)}`);
}

/** The branch's slice D1 on the account, or none. Refuses a D1 of that name that is the dictionary. */
function findSlice(wrangler: Wrangler, preview: PreviewName): SliceDatabase | undefined {
  const found = listDatabases(wrangler).find(({ name }) => name === preview.sliceDatabase);
  if (found === undefined) return undefined;
  refuseDictionary({ name: found.name, id: found.uuid }, "use as a slice");
  return { preview, id: found.uuid };
}

/** The fingerprint the slice was written with, or none when it has none to read: a slice whose write stopped part way. */
function fingerprintOf(wrangler: Wrangler, slice: SliceDatabase): string | undefined {
  const name = slice.preview.sliceDatabase;
  refuseDictionary({ name, id: slice.id }, "read a slice's fingerprint from");
  const read = wrangler(["d1", "execute", name, "--remote", "--json", "--command=SELECT fingerprint FROM preview_slice"]);
  if (!read.ok) return undefined;
  const answer: unknown = JSON.parse(read.stdout);
  const fingerprint = Array.isArray(answer) && isRecord(answer[0]) && Array.isArray(answer[0].results) && isRecord(answer[0].results[0]) ? answer[0].results[0].fingerprint : undefined;
  return isText(fingerprint) ? fingerprint : undefined;
}

/** Delete the branch's slice D1. Never the dictionary. */
function deleteSlice(wrangler: Wrangler, slice: SliceDatabase): void {
  refuseDictionary({ name: slice.preview.sliceDatabase, id: slice.id }, "delete");
  required(wrangler(["d1", "delete", slice.preview.sliceDatabase, "--skip-confirmation"]), "wrangler d1 delete");
}

/** Create the branch's slice D1 and run `sql` on it, the slice's whole SQL file. Never the dictionary. */
function writeSlice(wrangler: Wrangler, preview: PreviewName, sql: string): SliceDatabase {
  refuseDictionary({ name: preview.sliceDatabase }, "create");
  required(wrangler(["d1", "create", preview.sliceDatabase, "--update-config=false"]), "wrangler d1 create");
  const created = findSlice(wrangler, preview);
  if (created === undefined) throw new Error(`could not create the slice ${preview.sliceDatabase}`);
  refuseDictionary({ name: preview.sliceDatabase, id: created.id }, "seed");
  required(wrangler(["d1", "execute", preview.sliceDatabase, "--remote", "--yes", "--file", sql]), "wrangler d1 execute");
  return created;
}

/** The slice the Preview binds, or none, with the line that says why logged. */
function slice(wrangler: Wrangler, preview: PreviewName, planner: SlicePlanner, log: (line: string) => void): SliceDatabase | undefined {
  const declared = planner.declared();
  if (declared.state === "none") {
    log(`dictionary slice: none, ${declared.reason}`);
    return undefined;
  }
  const existing = findSlice(wrangler, preview);
  if (existing !== undefined && fingerprintOf(wrangler, existing) === declared.fingerprint) {
    log(`dictionary slice: reusing ${preview.sliceDatabase} (${existing.id}); ${declared.files.join(", ")} and schema.sql are unchanged, so nothing is written`);
    return existing;
  }
  const built = planner.build();
  if (built.state === "none") {
    log(`dictionary slice: none, ${built.reason}`);
    return undefined;
  }
  if (built.fingerprint !== declared.fingerprint) throw new Error(`preview:slice built ${built.fingerprint}, but the branch declares ${declared.fingerprint}`);
  if (built.rowsWritten > SLICE_ROWS_WRITTEN_CAP) {
    log(`dictionary slice: none, writing it would write ${built.rowsWritten} rows, over the cap of ${SLICE_ROWS_WRITTEN_CAP}; nothing was written`);
    return undefined;
  }
  if (existing !== undefined) deleteSlice(wrangler, existing);
  const written = writeSlice(wrangler, preview, built.sql);
  if (fingerprintOf(wrangler, written) !== built.fingerprint) throw new Error(`${preview.sliceDatabase} does not read back the fingerprint it was written with`);
  log(`dictionary slice: wrote ${preview.sliceDatabase} (${written.id}): ${built.words} word(s), ${built.rowsWritten} rows written, under the cap of ${SLICE_ROWS_WRITTEN_CAP}`);
  return written;
}

/**
 * The branch's dictionary slice, found, reused or written, or none. However
 * it ends, the Preview deploys: a failure is logged, and the Preview reads
 * the shared dictionary alone.
 */
export function prepareSlice(wrangler: Wrangler, preview: PreviewName, planner: SlicePlanner, log: (line: string) => void): SliceDatabase | undefined {
  try {
    return slice(wrangler, preview, planner, log);
  } catch (error: unknown) {
    log(`dictionary slice: none, ${error instanceof Error ? error.message : String(error)}; the Preview reads the shared dictionary`);
    return undefined;
  }
}
