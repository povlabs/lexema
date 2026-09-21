// Streaming importer: it-extract.jsonl.gz -> a local SQLite database shaped by
// src/db/schema.sql.
//
// Three properties it has to keep, because everything downstream leans on them:
//
//   1. Bounded memory. 799,600 lines and 391 MB of Italian JSON go past one line
//      at a time. Nothing accumulates across lines except counters.
//   2. Repeatable. Same input file, same database, byte for byte. record_id is
//      assigned in line order rather than by insertion race.
//   3. Honest. A record is admitted on `lang_code === 'it'` and nothing else.
//      Every line that does not become a record — malformed, empty, or another
//      language — is counted and located, never skipped in silence. Locations
//      are handed to the caller one at a time as they happen, so all of them
//      are reported without any of them being held.
//
// The release is written as 'importing' and only flipped to 'complete' after the
// last line of the archive lands, so a crash leaves a release that every
// canonical read hides. A run stopped early by --limit ends as 'partial', which
// those reads hide too.

import { createHash } from "node:crypto";
import type { ReadStream, Stats } from "node:fs";
import { open, readFile, type FileHandle } from "node:fs/promises";
import { createInterface } from "node:readline";
import { DatabaseSync } from "node:sqlite";
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
 * One input line that produced no record, and why.
 *
 * `other-language` is a well-formed record whose `lang_code` is not `it`.
 * `malformed` is anything else: not JSON, not an object, blank, an Italian
 * record missing `word`/`pos`/`pos_title`, or one whose `forms`, `senses` or
 * `form_of` members are not objects. The reason names the JSON pointer where
 * the shape broke.
 */
export interface Rejection {
  kind: "malformed" | "other-language";
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

export interface ImportOptions {
  /** Path to the .jsonl.gz source file. */
  input: string;
  /** Path to the SQLite database to write. Created if absent. */
  database: string;
  /** Path to src/db/schema.sql. */
  schema: string;
  releaseId: string;
  /** R2 object key for the untouched archive. Recorded, not uploaded here. */
  archiveR2Key: string;
  sourceName?: string;
  sourceUrl?: string;
  /** ISO-8601. Omit when unknown — it is never invented. */
  retrievedAt?: string;
  /** Upstream dump id. Omit when unknown; still unverified for the local file. */
  upstreamRelease?: string;
  license?: string;
  attribution?: string;
  /** Stop after this many admitted records. For tests only. */
  limit?: number;
  /**
   * Receives every rejected line as it is met, in line order. Required rather
   * than optional: keeping 239,243 locations in memory would break the
   * bounded-memory property, and dropping them would break the honesty one,
   * so the caller has to say where they go.
   */
  onRejection: (rejection: Rejection) => void;
  onProgress?: (admitted: number) => void;
  /** Admitted records between onProgress calls. */
  progressEvery?: number;
}

export interface ImportReport {
  releaseId: string;
  /**
   * 'complete' when the archive was read to its end, 'partial' when --limit
   * stopped it early. Matches the status written to source_release.
   */
  status: "complete" | "partial";
  archiveSha256: string;
  archiveBytes: number;
  linesRead: number;
  admitted: number;
  /** Exact counts. Every location behind them went through `onRejection`. */
  skippedOtherLanguage: number;
  malformed: number;
  rows: Record<string, number>;
  elapsedMs: number;
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
 * otherwise. Leaf fields stay `unknown`: a non-string form or gloss is dropped
 * per leaf, which is the same lenience the schema's nullable columns give.
 */
interface KaikkiRecord {
  word: string;
  pos: string;
  pos_title: string;
  tags?: unknown;
  raw_tags?: unknown;
  forms: readonly KaikkiForm[];
  senses: readonly KaikkiSense[];
}

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const asStrings = (value: unknown): string[] =>
  asArray(value).filter((item): item is string => typeof item === "string");

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

export async function importRelease(options: ImportOptions): Promise<ImportReport> {
  const startedAt = Date.now();
  const archive = await Archive.open(options.input);
  const [schemaSql, archiveSha256] = await Promise.all([
    readFile(options.schema, "utf8"),
    archive.sha256(),
  ]);
  const archiveBytes = archive.bytes;

  const db = new DatabaseSync(options.database);
  try {
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA foreign_keys = ON");
    db.exec(schemaSql);

    const statements = prepareStatements(db);
    const rows: Record<string, number> = {
      source_record: 0,
      source_record_json: 0,
      lookup_form: 0,
      form_of_edge: 0,
      sense: 0,
      sense_gloss: 0,
      sense_label: 0,
      grammar_claim: 0,
    };

    const source = archive.read();
    const lines = createInterface({
      input: source.pipe(createGunzip()),
      crlfDelay: Infinity,
    });

    let linesRead = 0;
    let admitted = 0;
    let truncated = false;
    let skipped = 0;
    let malformed = 0;

    db.exec("BEGIN");
    statements.insertRelease.run(
      options.releaseId,
      options.sourceName ?? "kaikki-it-wiktextract",
      options.sourceUrl ?? null,
      options.retrievedAt ?? null,
      options.upstreamRelease ?? null,
      options.archiveR2Key,
      archiveSha256,
      archiveBytes,
      IT_NORMALIZER_VERSION,
      IMPORTER_VERSION,
      SCHEMA_VERSION,
      options.license ?? null,
      options.attribution ?? null,
    );

    for await (const line of lines) {
      linesRead += 1;

      let record: KaikkiRecord;
      try {
        const parsed = parseLine(line);
        // The one admission test. Never the filename, never the spelling.
        if (parsed.lang_code !== "it") {
          skipped += 1;
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
      // record_id follows line order, which is what makes two runs over one file
      // produce identical databases.
      const recordId = admitted;
      writeRecord(statements, rows, {
        recordId,
        releaseId: options.releaseId,
        lineNo: linesRead,
        line,
        record,
        word: record.word,
        pos: record.pos,
        posTitle: record.pos_title,
      });

      if (admitted % (options.progressEvery ?? 25_000) === 0) options.onProgress?.(admitted);
      if (options.limit !== undefined && admitted >= options.limit) {
        truncated = true;
        break;
      }
    }

    lines.close();

    // Before destroying the reader, which releases the handle this asks about,
    // and before the status flip, so a release naming bytes this run did not
    // read is never committed at all.
    await archive.assertUnchanged(options.input);

    // `--limit` leaves the reader mid-file; close it so the process can exit.
    source.destroy();

    // Only a run that reached the end of the archive is complete. A truncated
    // one holds the checksum and byte count of the whole file but a prefix of
    // its records, so calling it complete would make a smoke run servable.
    const status = truncated ? "partial" : "complete";
    statements.finishRelease.run(status, options.releaseId);
    db.exec("COMMIT");

    return {
      releaseId: options.releaseId,
      status,
      archiveSha256,
      archiveBytes,
      linesRead,
      admitted,
      skippedOtherLanguage: skipped,
      malformed,
      rows,
      elapsedMs: Date.now() - startedAt,
    };
  } finally {
    db.close();
    await archive.close();
  }
}

function prepareStatements(db: DatabaseSync) {
  return {
    insertRelease: db.prepare(
      `INSERT INTO source_release
         (release_id, source_name, source_url, retrieved_at, upstream_release,
          archive_r2_key, archive_sha256, archive_bytes, normalizer,
          importer_version, schema_version, license, attribution, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'importing')`,
    ),
    // The status flip is the last write of the transaction: until it lands,
    // every canonical read hides this release. Canonical reads require
    // 'complete', so 'partial' stays hidden too.
    finishRelease: db.prepare(
      `UPDATE source_release SET status = ? WHERE release_id = ?`,
    ),
    insertRecord: db.prepare(
      `INSERT INTO source_record
         (record_id, release_id, line_no, line_sha256, word, pos, pos_title, lang_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'it')`,
    ),
    insertJson: db.prepare(
      `INSERT INTO source_record_json (record_id, raw_json) VALUES (?, ?)`,
    ),
    insertLookup: db.prepare(
      `INSERT INTO lookup_form
         (record_id, release_id, origin, surface, surface_key, json_pointer, form_index, form_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ),
    insertEdge: db.prepare(
      `INSERT INTO form_of_edge
         (record_id, release_id, sense_index, form_of_index, json_pointer, target_word, target_word_key)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ),
    insertSense: db.prepare(
      `INSERT INTO sense (sense_id, record_id, sense_index, json_pointer) VALUES (?, ?, ?, ?)`,
    ),
    insertGloss: db.prepare(
      `INSERT INTO sense_gloss (sense_id, gloss_index, text, json_pointer) VALUES (?, ?, ?, ?)`,
    ),
    insertLabel: db.prepare(
      `INSERT INTO sense_label (sense_id, label_index, kind, label, json_pointer) VALUES (?, ?, ?, ?, ?)`,
    ),
    insertClaim: db.prepare(
      `INSERT OR IGNORE INTO grammar_claim
         (record_id, scope, scope_index, json_pointer, status, dimension, value, source_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ),
  };
}

type Statements = ReturnType<typeof prepareStatements>;

interface RecordContext {
  recordId: number;
  releaseId: string;
  lineNo: number;
  line: string;
  record: KaikkiRecord;
  word: string;
  pos: string;
  posTitle: string;
}

function writeRecord(
  statements: Statements,
  rows: Record<string, number>,
  ctx: RecordContext,
): void {
  const { recordId, releaseId, record } = ctx;

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
    if (typeof form.form !== "string") return;
    statements.insertLookup.run(
      recordId,
      releaseId,
      "embedded-form",
      form.form,
      normalizeItalianExact(form.form),
      `/forms/${formIndex}/form`,
      formIndex,
      typeof form.source === "string" ? form.source : null,
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
    tags: asStrings(record.tags),
    rawTags: asStrings(record.raw_tags),
    expected: expectedRecordDimensions(ctx.pos),
  });

  record.forms.forEach((form, formIndex) => {
    if (typeof form.form !== "string") return;
    const tags = asStrings(form.tags);
    const stated = new Set<string>();
    for (const tag of tags) {
      const mapped = mapStructuralTag(tag);
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
      rawTags: asStrings(form.raw_tags),
      expected: expectedFormDimensions(ctx.pos, stated),
    });
  });

  record.senses.forEach((sense, senseIndex) => {
    // sense_id is derived, not auto-assigned, so it is stable across runs.
    const senseId = recordId * 1000 + senseIndex;
    statements.insertSense.run(senseId, recordId, senseIndex, `/senses/${senseIndex}`);
    rows.sense += 1;

    asStrings(sense.glosses).forEach((text, glossIndex) => {
      statements.insertGloss.run(
        senseId,
        glossIndex,
        text,
        `/senses/${senseIndex}/glosses/${glossIndex}`,
      );
      rows.sense_gloss += 1;
    });

    asStrings(sense.tags).forEach((label, labelIndex) => {
      statements.insertLabel.run(
        senseId,
        labelIndex,
        "tag",
        label,
        `/senses/${senseIndex}/tags/${labelIndex}`,
      );
      rows.sense_label += 1;
    });

    asStrings(sense.raw_tags).forEach((label, labelIndex) => {
      const pointer = `/senses/${senseIndex}/raw_tags/${labelIndex}`;
      statements.insertLabel.run(senseId, labelIndex, "raw_tag", label, pointer);
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
      const { word } = target;
      if (typeof word !== "string") return;
      statements.insertEdge.run(
        recordId,
        releaseId,
        senseIndex,
        formOfIndex,
        `/senses/${senseIndex}/form_of/${formOfIndex}/word`,
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
  tags: readonly string[];
  rawTags: readonly string[];
  expected: readonly string[];
}

function writeClaims(
  statements: Statements,
  rows: Record<string, number>,
  scope: ClaimScope,
): void {
  const stated = new Set<string>();

  scope.tags.forEach((tag, index) => {
    const mapped = mapStructuralTag(tag);
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

  scope.rawTags.forEach((rawTag, index) => {
    const mapped = mapRawTag(rawTag);
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
