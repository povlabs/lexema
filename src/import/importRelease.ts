// Streaming archive parser: it-extract.jsonl.gz -> destination-specific rows.
//
// The parser is intentionally destination-free. It keeps bounded memory,
// reports every rejected line and leaf with its source location, and hands
// admitted records to the D1 seeder. Record identity, form-of edges and grammar
// derivation are defined here and shared by every destination.

import { createHash } from "node:crypto";
import type { ReadStream, Stats } from "node:fs";
import { open, type FileHandle } from "node:fs/promises";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import { IT_NORMALIZER_VERSION, normalizeItalianExact } from "../italian/normalize.js";
import {
  expectedFormDimensions,
  expectedRecordDimensions,
  mapRawTag,
  mapStructuralTag,
} from "./grammarPolicy.js";

export const IMPORTER_VERSION = "it-import/v1" as const;
export const SCHEMA_VERSION = 1;

/**
 * One piece of input that produced no row, and why.
 *
 * `other-language` is a well-formed record whose `lang_code` is not `it`.
 * `malformed` is a whole line that produced no record: not JSON, not an object,
 * blank, an Italian record missing `word`/`pos`/`pos_title`, or one whose
 * `forms`, `senses` or `form_of` members are not objects.
 * `malformed-member` is one leaf value inside a record that did land — a gloss
 * that is not a string, a `tags` that is not an array. The record keeps every
 * leaf that is well formed; only the bad leaf is refused, and it is refused out
 * loud. The reason names the JSON pointer where the shape broke.
 */
export interface Rejection {
  kind: "malformed" | "malformed-member" | "other-language";
  /** 1-based physical line number in the archive. */
  lineNo: number;
  reason: string;
}

/**
 * A line that cannot become a record. Thrown while reading a line and turned
 * into a located rejection by the loop; anything else thrown there is a bug
 * and still aborts the run.
 */
class MalformedLine extends Error {}

/** One admitted archive record, before any destination-specific write. */
export interface ArchiveRecord {
  releaseId: string;
  recordId: number;
  lineNo: number;
  line: string;
  lineSha256: string;
  record: KaikkiRecord;
}

export interface ArchiveParseOptions {
  input: string;
  releaseId?: string;
  onRejection: (rejection: Rejection) => void;
  /** Called after the complete archive checksum is known and before records flow. */
  onStart?: (metadata: {
    releaseId: string;
    archiveSha256: string;
    archiveBytes: number;
  }) => void | Promise<void>;
  onRecord: (record: ArchiveRecord, reportMember: ReportMember) => void | Promise<void>;
  /** Stop after this many admitted records. For tests only. */
  limit?: number;
  onProgress?: (admitted: number) => void;
  progressEvery?: number;
}

export interface ArchiveParseReport {
  archiveSha256: string;
  archiveBytes: number;
  linesRead: number;
  admitted: number;
  skippedOtherLanguage: number;
  malformed: number;
  malformedMembers: number;
  status: "complete" | "partial";
}

type JsonObject = Record<string, unknown>;

interface KaikkiFormOf {
  word?: unknown;
}

interface KaikkiForm {
  form?: unknown;
  tags?: unknown;
  raw_tags?: unknown;
  source?: unknown;
}

interface KaikkiSense {
  glosses?: unknown;
  tags?: unknown;
  raw_tags?: unknown;
  form_of: readonly KaikkiFormOf[];
}

/**
 * An admitted Italian record. The three NOT NULL columns are strings and every
 * nested member is an object, because `readItalianRecord` refused the line
 * otherwise. Leaf fields stay `unknown`: a non-string form or gloss costs that
 * one leaf its row rather than the whole record, and is reported at its own
 * pointer on the way out.
 */
interface KaikkiRecord {
  word: string;
  pos: string;
  pos_title: string;
  tags?: unknown;
  raw_tags?: unknown;
  forms: readonly KaikkiForm[];
  senses: readonly KaikkiSense[];
  /** Kept as parsed; only the seed's suggestion ranking reads it (seedSql.ts). */
  translations?: unknown;
}

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A string leaf with the index the source gave it. The index is kept separate
 * from the position in this list because it becomes the JSON pointer a reader
 * checks the claim at: in `glosses: [42, "valido"]` the surviving gloss is
 * `/glosses/1`, and calling it `/glosses/0` would point a reader at the wrong
 * value in the archive.
 */
interface StringMember {
  index: number;
  text: string;
}

/** Where a refused leaf goes: one located rejection, one count. */
export type ReportMember = (reason: string) => void;

/**
 * `value` as its string members, each keeping its source index. A member that
 * is not a string, and a `value` that is present but not an array, are counted
 * and reported at their own pointer instead of vanishing.
 */
function stringMembers(value: unknown, pointer: string, report: ReportMember): StringMember[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    report(`${pointer} is not an array`);
    return [];
  }
  const members: StringMember[] = [];
  value.forEach((item, index) => {
    if (typeof item === "string") members.push({ index, text: item });
    else report(`${pointer}/${index} is not a string`);
  });
  return members;
}

/**
 * A leaf whose row only means something when it is a string. An absent leaf is
 * nothing to lose and yields null quietly; a present one of the wrong type is a
 * value the source stated and this import refuses, so it is counted and located.
 */
function stringLeaf(value: unknown, pointer: string, report: ReportMember): string | null {
  if (value === undefined) return null;
  if (typeof value === "string") return value;
  report(`${pointer} is not a string`);
  return null;
}

/** Apply the importer's leaf rejection rules without choosing a storage format. */
export function validateArchiveRecord(record: ArchiveRecord["record"], report: ReportMember): void {
  record.forms.forEach((form, formIndex) => {
    stringLeaf(form.form, `/forms/${formIndex}/form`, report);
    stringLeaf(form.source, `/forms/${formIndex}/source`, report);
    stringMembers(form.tags, `/forms/${formIndex}/tags`, report);
    stringMembers(form.raw_tags, `/forms/${formIndex}/raw_tags`, report);
  });
  stringMembers(record.tags, "/tags", report);
  stringMembers(record.raw_tags, "/raw_tags", report);
  record.senses.forEach((sense, senseIndex) => {
    const pointer = `/senses/${senseIndex}`;
    stringMembers(sense.glosses, `${pointer}/glosses`, report);
    stringMembers(sense.tags, `${pointer}/tags`, report);
    stringMembers(sense.raw_tags, `${pointer}/raw_tags`, report);
    sense.form_of.forEach((target, targetIndex) => {
      stringLeaf(target.word, `${pointer}/form_of/${targetIndex}/word`, report);
    });
  });
}

/** The line as a JSON object, or a `MalformedLine` saying why it is not one. */
function parseLine(line: string): JsonObject {
  // A blank line carries no record and is not valid JSONL, so it is malformed.
  // Skipping it quietly would let input vanish under a reported zero.
  if (line.trim() === "") throw new MalformedLine("blank line");
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    throw new MalformedLine("not valid JSON");
  }
  if (!isObject(parsed)) throw new MalformedLine("line is not a JSON object");
  return parsed;
}

/**
 * `container[key]` as a list of objects. Absent means empty; present means an
 * array whose every member is an object. Anything else is malformed and named
 * by pointer, so `forms: [null]` is a located rejection rather than a crash
 * in the middle of a transaction.
 */
function objectList(container: JsonObject, key: string, pointer: string): JsonObject[] {
  const value = container[key];
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new MalformedLine(`${pointer} is not an array`);
  return value.map((item, index) => {
    if (!isObject(item)) throw new MalformedLine(`${pointer}/${index} is not an object`);
    return item;
  });
}

/**
 * The shape an Italian record has to have before anything is written for it.
 * Every Italian record in this file passes, but a record that does not would
 * violate NOT NULL or hit a nested cast, so it is refused here as malformed —
 * never silently given an empty string, never allowed to abort the run.
 */
function readItalianRecord(parsed: JsonObject): KaikkiRecord {
  const { word, pos, pos_title } = parsed;
  if (typeof word !== "string" || typeof pos !== "string" || typeof pos_title !== "string") {
    throw new MalformedLine("word, pos and pos_title must be strings");
  }
  const forms = objectList(parsed, "forms", "/forms");
  const senses = objectList(parsed, "senses", "/senses").map((sense, senseIndex) => ({
    ...sense,
    form_of: objectList(sense, "form_of", `/senses/${senseIndex}/form_of`),
  }));
  return { ...parsed, word, pos, pos_title, forms, senses };
}

/**
 * Whether one source line becomes a record — the same admission test the import
 * loop runs, exported so nothing has to restate it.
 *
 * A prefix cut has to count records the way the importer counts them, and an
 * `lang_code === 'it'` check written a second time would drift from this one:
 * an Italian line missing `pos_title` is admitted by that check and refused
 * here, so the two would disagree about how long a prefix is.
 */
export function admitsRecord(line: string): boolean {
  try {
    const parsed = parseLine(line);
    if (parsed.lang_code !== "it") return false;
    readItalianRecord(parsed);
    return true;
  } catch (error) {
    if (error instanceof MalformedLine) return false;
    throw error;
  }
}

/** What an open file would have to keep for two reads of it to be the same bytes. */
const identityOf = (stats: Stats): string =>
  `${stats.dev}:${stats.ino}:${stats.size}:${stats.mtimeMs}`;

/**
 * The archive, opened once and read twice.
 *
 * The digest recorded on the release has to describe the bytes that were
 * actually imported. Hashing a path and then re-opening that path for the
 * import reads the *name* twice, so a file swapped in between would be imported
 * under another file's checksum. Both passes therefore read from one open
 * handle, and `assertUnchanged` re-checks that handle after the import — an
 * in-place rewrite moves size or mtime even though the handle stays valid.
 *
 * Two passes rather than one because `--limit` stops the import reader
 * mid-file; a digest folded into that stream would cover a prefix while
 * claiming to describe the archive. A pass over 38 MB costs well under a second.
 */
class Archive {
  private constructor(
    private readonly handle: FileHandle,
    private readonly identity: string,
    readonly bytes: number,
  ) {}

  static async open(path: string): Promise<Archive> {
    const handle = await open(path, "r");
    try {
      const stats = await handle.stat();
      return new Archive(handle, identityOf(stats), stats.size);
    } catch (error) {
      await handle.close();
      throw error;
    }
  }

  /** A fresh stream over the whole file. `start` makes it positioned reads, so
   *  the handle's own offset is never shared between passes. */
  read(): ReadStream {
    return this.handle.createReadStream({ start: 0, autoClose: false });
  }

  async sha256(): Promise<string> {
    const hash = createHash("sha256");
    for await (const chunk of this.read()) hash.update(chunk as Buffer);
    return hash.digest("hex");
  }

  async assertUnchanged(path: string): Promise<void> {
    const stats = await this.handle.stat();
    if (identityOf(stats) === this.identity) return;
    throw new Error(
      `${path} changed while it was being imported; the recorded checksum would ` +
        `describe bytes this run did not read. Nothing was committed — re-run it.`,
    );
  }

  async close(): Promise<void> {
    // Destroying a stream this handed out already closes the handle, so by here
    // the file is often shut. Cleanup either way.
    await this.handle.close().catch(() => {});
  }
}

export async function parseArchive(options: ArchiveParseOptions): Promise<ArchiveParseReport> {
  const archive = await Archive.open(options.input);
  const archiveSha256 = await archive.sha256();
  const releaseId = options.releaseId ?? `it-${archiveSha256.slice(0, 8)}`;
  let linesRead = 0;
  let admitted = 0;
  let skippedOtherLanguage = 0;
  let malformed = 0;
  let malformedMembers = 0;
  let truncated = false;
  const reportMember: ReportMember = (reason) => {
    malformedMembers += 1;
    options.onRejection({ kind: "malformed-member", lineNo: linesRead, reason });
  };
  try {
    await options.onStart?.({ releaseId, archiveSha256, archiveBytes: archive.bytes });
    const source = archive.read();
    const decompressed = options.input.endsWith(".gz") ? source.pipe(createGunzip()) : source;
    const lines = createInterface({
      input: decompressed,
      crlfDelay: Infinity,
    });
    for await (const line of lines) {
      linesRead += 1;
      let record: KaikkiRecord;
      try {
        const parsed = parseLine(line);
        if (parsed.lang_code !== "it") {
          skippedOtherLanguage += 1;
          options.onRejection({
            kind: "other-language",
            lineNo: linesRead,
            reason: `lang_code is ${JSON.stringify(parsed.lang_code ?? null)}`,
          });
          continue;
        }
        record = readItalianRecord(parsed);
      } catch (error) {
        if (!(error instanceof MalformedLine)) throw error;
        malformed += 1;
        options.onRejection({ kind: "malformed", lineNo: linesRead, reason: error.message });
        continue;
      }
      admitted += 1;
      const recordId = admitted;
      await options.onRecord({
        releaseId,
        recordId,
        lineNo: linesRead,
        line,
        lineSha256: createHash("sha256").update(line, "utf8").digest("hex"),
        record,
      }, reportMember);
      if (admitted % (options.progressEvery ?? 25_000) === 0) options.onProgress?.(admitted);
      if (options.limit !== undefined && admitted >= options.limit) {
        truncated = true;
        break;
      }
    }
    lines.close();
    await archive.assertUnchanged(options.input);
    source.destroy();
    return {
      archiveSha256,
      archiveBytes: archive.bytes,
      linesRead,
      admitted,
      skippedOtherLanguage,
      malformed,
      malformedMembers,
      status: truncated ? "partial" : "complete",
    };
  } finally {
    await archive.close();
  }
}

export interface ImportStatement {
  run(...values: unknown[]): unknown;
}

export interface ImportStatements {
  insertRelease: ImportStatement;
  finishRelease: ImportStatement;
  insertTableRows: ImportStatement;
  insertRecord: ImportStatement;
  insertJson: ImportStatement;
  insertLookup: ImportStatement;
  insertEdge: ImportStatement;
  insertSense: ImportStatement;
  insertGloss: ImportStatement;
  insertLabel: ImportStatement;
  insertClaim: ImportStatement;
}

type Statements = ImportStatements;

interface RecordContext {
  recordId: number;
  releaseId: string;
  lineNo: number;
  line: string;
  record: KaikkiRecord;
  word: string;
  pos: string;
  posTitle: string;
  /** Where a leaf of this record that is not a string goes. */
  reportMember: ReportMember;
}

export function writeRecord(
  statements: Statements,
  rows: Record<string, number>,
  ctx: RecordContext,
): void {
  const { recordId, releaseId, record, reportMember } = ctx;

  // Read once, before either pass over forms[], so a form whose surface is not
  // a string is reported exactly once however many passes look at it.
  const formSurfaces = record.forms.map((form, formIndex) =>
    stringLeaf(form.form, `/forms/${formIndex}/form`, reportMember),
  );

  statements.insertRecord.run(
    recordId,
    releaseId,
    ctx.lineNo,
    createHash("sha256").update(ctx.line, "utf8").digest("hex"),
    ctx.word,
    ctx.pos,
    ctx.posTitle,
  );
  rows.source_record += 1;

  // Verbatim, unparsed, unreordered. This is the copy every claim is auditable
  // against, so it must never be a re-serialisation of the parsed object.
  statements.insertJson.run(recordId, ctx.line);
  rows.source_record_json += 1;

  statements.insertLookup.run(
    recordId,
    releaseId,
    "headword",
    ctx.word,
    normalizeItalianExact(ctx.word),
    "/word",
    null,
    null,
  );
  rows.lookup_form += 1;

  record.forms.forEach((form, formIndex) => {
    // Read the leaf before deciding whether to write the row. A form whose
    // surface the import refused still states a `source`, and a leaf nobody
    // reads is a refusal nobody can count or locate.
    const source = stringLeaf(form.source, `/forms/${formIndex}/source`, reportMember);
    const surface = formSurfaces[formIndex];
    if (surface === null) return;
    statements.insertLookup.run(
      recordId,
      releaseId,
      "embedded-form",
      surface,
      normalizeItalianExact(surface),
      `/forms/${formIndex}/form`,
      formIndex,
      source,
    );
    rows.lookup_form += 1;
  });

  writeClaims(statements, rows, {
    recordId,
    scope: "record",
    scopeIndex: null,
    container: "",
    tagsPointer: "/tags",
    rawTagsPointer: "/raw_tags",
    tags: stringMembers(record.tags, "/tags", reportMember),
    rawTags: stringMembers(record.raw_tags, "/raw_tags", reportMember),
    expected: expectedRecordDimensions(ctx.pos),
  });

  record.forms.forEach((form, formIndex) => {
    // Same rule as the lookup pass: both member lists are read whatever the
    // surface turned out to be, so their refusals reach the report. Only the
    // claim rows wait on a surface, because a form the import refused has no
    // surface for a claim to be about.
    const tags = stringMembers(form.tags, `/forms/${formIndex}/tags`, reportMember);
    const rawTags = stringMembers(form.raw_tags, `/forms/${formIndex}/raw_tags`, reportMember);
    if (formSurfaces[formIndex] === null) return;
    const stated = new Set<string>();
    for (const { text } of tags) {
      const mapped = mapStructuralTag(text);
      if (mapped.status === "stated") stated.add(mapped.dimension);
    }
    writeClaims(statements, rows, {
      recordId,
      scope: "form",
      scopeIndex: formIndex,
      container: `/forms/${formIndex}`,
      tagsPointer: `/forms/${formIndex}/tags`,
      rawTagsPointer: `/forms/${formIndex}/raw_tags`,
      tags,
      rawTags,
      expected: expectedFormDimensions(ctx.pos, stated),
    });
  });

  record.senses.forEach((sense, senseIndex) => {
    // sense_id is derived, not auto-assigned, so it is stable across runs.
    const senseId = recordId * 1000 + senseIndex;
    statements.insertSense.run(senseId, recordId, senseIndex, `/senses/${senseIndex}`);
    rows.sense += 1;

    const sensePointer = `/senses/${senseIndex}`;

    stringMembers(sense.glosses, `${sensePointer}/glosses`, reportMember).forEach(
      ({ index, text }) => {
        statements.insertGloss.run(senseId, index, text, `${sensePointer}/glosses/${index}`);
        rows.sense_gloss += 1;
      },
    );

    stringMembers(sense.tags, `${sensePointer}/tags`, reportMember).forEach(({ index, text }) => {
      statements.insertLabel.run(
        senseId,
        index,
        "tag",
        text,
        `${sensePointer}/tags/${index}`,
      );
      rows.sense_label += 1;
    });

    const senseRawTags = stringMembers(sense.raw_tags, `${sensePointer}/raw_tags`, reportMember);
    senseRawTags.forEach(({ index, text: label }) => {
      const pointer = `${sensePointer}/raw_tags/${index}`;
      statements.insertLabel.run(senseId, index, "raw_tag", label, pointer);
      rows.sense_label += 1;

      // Also recorded as an unclassified grammar claim, on purpose, even though
      // the text is already in sense_label. A sense raw_tag is free prose and
      // the importer cannot tell a topic label ('scuola') from grammar stated in
      // words ('pl.: case' on `casa`, which is the plural and the only place the
      // source gives it). Keeping it in both tables means neither a reader
      // asking "what labels does this sense carry" nor one asking "what unmapped
      // text might be grammar" has to know about the other.
      statements.insertClaim.run(
        recordId, "sense", senseIndex, pointer,
        "unclassified", null, null, label,
      );
      rows.grammar_claim += 1;
    });

    sense.form_of.forEach((target, formOfIndex) => {
      const pointer = `${sensePointer}/form_of/${formOfIndex}/word`;
      const word = stringLeaf(target.word, pointer, reportMember);
      if (word === null) return;
      statements.insertEdge.run(
        recordId,
        releaseId,
        senseIndex,
        formOfIndex,
        pointer,
        word,
        normalizeItalianExact(word),
      );
      rows.form_of_edge += 1;
    });
  });
}

interface ClaimScope {
  recordId: number;
  scope: "record" | "form";
  scopeIndex: number | null;
  /** Pointer to the container, used by 'missing' rows. '' for the record. */
  container: string;
  tagsPointer: string;
  rawTagsPointer: string;
  /** String members only, each still carrying its source index. */
  tags: readonly StringMember[];
  rawTags: readonly StringMember[];
  expected: readonly string[];
}

function writeClaims(
  statements: Statements,
  rows: Record<string, number>,
  scope: ClaimScope,
): void {
  const stated = new Set<string>();

  scope.tags.forEach(({ index, text }) => {
    const mapped = mapStructuralTag(text);
    const pointer = `${scope.tagsPointer}/${index}`;
    if (mapped.status === "stated") {
      stated.add(mapped.dimension);
      statements.insertClaim.run(
        scope.recordId, scope.scope, scope.scopeIndex, pointer,
        "stated", mapped.dimension, mapped.value, mapped.sourceText,
      );
    } else {
      statements.insertClaim.run(
        scope.recordId, scope.scope, scope.scopeIndex, pointer,
        "unclassified", null, null, mapped.sourceText,
      );
    }
    rows.grammar_claim += 1;
  });

  scope.rawTags.forEach(({ index, text }) => {
    const mapped = mapRawTag(text);
    statements.insertClaim.run(
      scope.recordId, scope.scope, scope.scopeIndex,
      `${scope.rawTagsPointer}/${index}`,
      "unclassified", null, null, mapped.sourceText,
    );
    rows.grammar_claim += 1;
  });

  // A dimension we looked for and did not find. This is what separates `casa`,
  // whose gender the source simply never states, from a record nobody expected
  // a gender from.
  for (const dimension of scope.expected) {
    if (stated.has(dimension)) continue;
    statements.insertClaim.run(
      scope.recordId, scope.scope, scope.scopeIndex, scope.container,
      "missing", dimension, null, null,
    );
    rows.grammar_claim += 1;
  }
}
