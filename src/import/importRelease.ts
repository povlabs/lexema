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
//      Malformed lines are counted and located, never skipped in silence.
//
// The release is written as 'importing' and only flipped to 'complete' after the
// last line lands, so a crash leaves a release that every canonical read hides.

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
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

/** How many malformed line numbers to keep. The count is always exact. */
const MALFORMED_SAMPLE_LIMIT = 50;

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
  onProgress?: (admitted: number) => void;
}

export interface ImportReport {
  releaseId: string;
  archiveSha256: string;
  archiveBytes: number;
  linesRead: number;
  admitted: number;
  skippedOtherLanguage: number;
  malformed: number;
  malformedLineNumbers: number[];
  rows: Record<string, number>;
  elapsedMs: number;
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
  form_of?: unknown;
}

interface KaikkiRecord {
  word?: unknown;
  pos?: unknown;
  pos_title?: unknown;
  lang_code?: unknown;
  tags?: unknown;
  raw_tags?: unknown;
  forms?: unknown;
  senses?: unknown;
}

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const asStrings = (value: unknown): string[] =>
  asArray(value).filter((item): item is string => typeof item === "string");

/**
 * sha256 of the compressed archive, in its own pass over the file.
 *
 * Folding this into the import stream looked cheaper and was wrong: `--limit`
 * stops the reader mid-file, and the digest would then cover a prefix while
 * claiming to describe the archive. A separate pass over 38 MB costs well under
 * a second and always describes the whole file.
 */
async function hashArchive(path: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = createReadStream(path);
  for await (const chunk of stream) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

/**
 * Put the schema in place, or check the one already there.
 *
 * A staged release lands next to the active one in the same database, so the
 * second import finds the tables already built. schema.sql is CREATE TABLE
 * without IF NOT EXISTS on purpose — sprinkling IF NOT EXISTS everywhere would
 * also swallow a real mismatch — so an existing database is verified instead of
 * rebuilt: same schema_version, and a release_id nobody has used yet.
 */
function applySchema(db: DatabaseSync, schemaSql: string, releaseId: string): void {
  const built = db
    .prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name = 'source_release'")
    .all();

  if (built.length === 0) {
    db.exec(schemaSql);
    return;
  }


  const existing = db
    .prepare("SELECT release_id, schema_version FROM source_release")
    .all() as { release_id: string; schema_version: number }[];

  const stale = existing.find((row) => row.schema_version !== SCHEMA_VERSION);
  if (stale) {
    throw new Error(
      `database holds release '${stale.release_id}' at schema_version ${stale.schema_version}, ` +
        `this importer writes ${SCHEMA_VERSION}`,
    );
  }

  if (existing.some((row) => row.release_id === releaseId)) {
    throw new Error(`release '${releaseId}' is already in this database`);
  }
}

/**
 * The record_id the next release starts counting from.
 *
 * record_id is one key space for the whole database, so a second release cannot
 * start at 1 again. It starts above every id already there and still counts up
 * in line order, which is what keeps one release's ids identical run to run.
 * sense_id is derived from record_id, so it moves with the base.
 */
function recordIdBase(db: DatabaseSync): number {
  const [row] = db
    .prepare("SELECT ifnull(max(record_id), 0) AS top FROM source_record")
    .all() as { top: number }[];
  return row.top;
}

export async function importRelease(options: ImportOptions): Promise<ImportReport> {
  const startedAt = Date.now();
  const [{ size: archiveBytes }, schemaSql, archiveSha256] = await Promise.all([
    stat(options.input),
    readFile(options.schema, "utf8"),
    hashArchive(options.input),
  ]);

  const db = new DatabaseSync(options.database);
  try {
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA foreign_keys = ON");
    applySchema(db, schemaSql, options.releaseId);

    const idBase = recordIdBase(db);
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

    const source = createReadStream(options.input);
    const lines = createInterface({
      input: source.pipe(createGunzip()),
      crlfDelay: Infinity,
    });

    let linesRead = 0;
    let admitted = 0;
    let skippedOtherLanguage = 0;
    let malformed = 0;
    const malformedLineNumbers: number[] = [];

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
      if (!line) continue;

      let record: KaikkiRecord;
      try {
        const parsed: unknown = JSON.parse(line);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          throw new Error("line is not a JSON object");
        }
        record = parsed as KaikkiRecord;
      } catch {
        malformed += 1;
        if (malformedLineNumbers.length < MALFORMED_SAMPLE_LIMIT) {
          malformedLineNumbers.push(linesRead);
        }
        continue;
      }

      // The one admission test. Never the filename, never the spelling.
      if (record.lang_code !== "it") {
        skippedOtherLanguage += 1;
        continue;
      }

      // Every Italian record in this file has all three, but a record missing
      // one would violate NOT NULL, so it is counted as malformed rather than
      // silently given an empty string.
      if (
        typeof record.word !== "string" ||
        typeof record.pos !== "string" ||
        typeof record.pos_title !== "string"
      ) {
        malformed += 1;
        if (malformedLineNumbers.length < MALFORMED_SAMPLE_LIMIT) {
          malformedLineNumbers.push(linesRead);
        }
        continue;
      }

      admitted += 1;
      // record_id follows line order, which is what makes two runs over one file
      // produce identical databases.
      const recordId = idBase + admitted;
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

      if (admitted % 25_000 === 0) options.onProgress?.(admitted);
      if (options.limit !== undefined && admitted >= options.limit) break;
    }

    // `--limit` leaves the reader mid-file; close it so the process can exit.
    lines.close();
    source.destroy();

    statements.finishRelease.run(options.releaseId);
    db.exec("COMMIT");

    return {
      releaseId: options.releaseId,
      archiveSha256,
      archiveBytes,
      linesRead,
      admitted,
      skippedOtherLanguage,
      malformed,
      malformedLineNumbers,
      rows,
      elapsedMs: Date.now() - startedAt,
    };
  } finally {
    db.close();
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
    // every canonical read hides this release.
    finishRelease: db.prepare(
      `UPDATE source_release SET status = 'complete' WHERE release_id = ?`,
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

  // --- lookup rows: the record's own word, then every embedded form ---------
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

  const forms = asArray(record.forms);
  forms.forEach((entry, formIndex) => {
    const form = entry as KaikkiForm;
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

  // --- grammar on the record itself ----------------------------------------
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

  // --- grammar on each embedded form ---------------------------------------
  forms.forEach((entry, formIndex) => {
    const form = entry as KaikkiForm;
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

  // --- senses, glosses, labels, form_of edges -------------------------------
  asArray(record.senses).forEach((entry, senseIndex) => {
    const sense = entry as KaikkiSense;
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

    asArray(sense.form_of).forEach((target, formOfIndex) => {
      const word = (target as { word?: unknown }).word;
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
