// Stream the archive parser into foreign-key-safe D1 SQL without a SQLite staging file.
// The SQL lands as numbered parts (sqlParts.ts) so no single file outgrows Node's string limit.
// The parser remains the source of admission, identity, rejection, and grammar rules;
// this module only changes the destination of those rows.

import { appendFile, mkdir, mkdtemp, open, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  parseArchive,
  writeRecord,
  type ArchiveParseReport,
  type ImportStatement,
  type ImportStatements,
  type Rejection,
} from "./importRelease.js";
import type { RawPageSource } from "../source/rawPage.js";
import { RecoveredLayer, type RecoverySummary } from "./recoveredLayer.js";
import { clearParts, SqlPartWriter } from "./sqlParts.js";

const TABLE_ORDER = [
  "source_record",
  "source_record_json",
  "lookup_form",
  "form_of_edge",
  "sense",
  "sense_gloss",
  "sense_label",
  "grammar_claim",
  "raw_page",
  "recovered_definition",
  "recovered_label",
  "recovered_example",
  "release_table_rows",
] as const;

type TableName = (typeof TABLE_ORDER)[number];

type RowCounts = Record<TableName, number>;

const COLUMNS: Record<TableName, string> = {
  source_record: "record_id,release_id,line_no,line_sha256,word,pos,pos_title,lang_code",
  source_record_json: "record_id,raw_json",
  lookup_form: "record_id,release_id,origin,surface,surface_key,json_pointer,form_index,form_source",
  form_of_edge: "record_id,release_id,sense_index,form_of_index,json_pointer,target_word,target_word_key",
  sense: "sense_id,record_id,sense_index,json_pointer",
  sense_gloss: "sense_id,gloss_index,text,json_pointer",
  sense_label: "sense_id,label_index,kind,label,json_pointer",
  grammar_claim: "record_id,scope,scope_index,json_pointer,status,dimension,value,source_text",
  raw_page: "page_id,release_id,wiki,title,revision_id,revision_timestamp",
  recovered_definition: "recovered_id,record_id,release_id,page_id,definition_index,route,term,page_line,wikitext,text,held_as_example",
  recovered_label: "recovered_id,label_index,label",
  recovered_example: "recovered_id,example_index,page_line,wikitext,text",
  release_table_rows: "release_id,table_name,rows",
};

const literal = (value: unknown): string => {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "bigint") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
};

class SqlBatchWriter {
  private readonly rows = new Map<TableName, string[]>();
  private readonly bytes = new Map<TableName, number>();
  // The byte length of every INSERT written to each table's file, in order, so
  // copyTo can hand the part writer whole statements without parsing SQL.
  private readonly statementBytes = new Map<TableName, number[]>();
  readonly counts: RowCounts = {
    source_record: 0,
    source_record_json: 0,
    lookup_form: 0,
    form_of_edge: 0,
    sense: 0,
    sense_gloss: 0,
    sense_label: 0,
    grammar_claim: 0,
    raw_page: 0,
    recovered_definition: 0,
    recovered_label: 0,
    recovered_example: 0,
    release_table_rows: 0,
  };

  constructor(private readonly directory: string, private readonly maxStatementBytes = 64 * 1024) {}

  statement(table: Exclude<TableName, "release_table_rows">): ImportStatement {
    return {
      run: (...values: unknown[]) => {
        const rowValues = table === "source_record" ? [...values, "it"] : values;
        const tuple = `(${rowValues.map(literal).join(",")})`;
        const pending = this.rows.get(table) ?? [];
        const used = this.bytes.get(table) ?? 0;
        pending.push(tuple);
        this.rows.set(table, pending);
        this.bytes.set(table, used + tuple.length + 4);
      },
    };
  }

  hasFullBatch(): boolean {
    return [...this.bytes.values()].some((bytes) => bytes >= this.maxStatementBytes);
  }

  async flush(): Promise<void> {
    for (const table of TABLE_ORDER.slice(0, -1)) {
      const pending = this.rows.get(table);
      if (!pending?.length) continue;
      const batches: string[][] = [];
      let batch: string[] = [];
      let bytes = 0;
      for (const tuple of pending) {
        if (batch.length > 0 && bytes + tuple.length + 4 > this.maxStatementBytes) {
          batches.push(batch);
          batch = [];
          bytes = 0;
        }
        batch.push(tuple);
        bytes += tuple.length + 4;
      }
      if (batch.length > 0) batches.push(batch);
      const texts = batches.map((values) =>
        `-- ${table}: batch\nINSERT INTO ${table} (${COLUMNS[table]}) VALUES\n  ${values.join(",\n  ")};\n`,
      );
      const sizes = this.statementBytes.get(table) ?? [];
      for (const text of texts) sizes.push(Buffer.byteLength(text, "utf8"));
      this.statementBytes.set(table, sizes);
      await appendFile(join(this.directory, `${table}.sql`), texts.join(""), "utf8");
      this.rows.set(table, []);
      this.bytes.set(table, 0);
    }
  }

  async finish(): Promise<void> {
    await this.flush();
  }

  /** Copy every table's statements, in table order, one statement per unit. */
  async copyTo(parts: SqlPartWriter): Promise<void> {
    for (const table of TABLE_ORDER.slice(0, -1)) {
      const sizes = this.statementBytes.get(table);
      if (!sizes?.length) continue;
      const file = await open(join(this.directory, `${table}.sql`), "r");
      try {
        for (const size of sizes) {
          const statement = Buffer.allocUnsafe(size);
          const { bytesRead } = await file.read(statement, 0, size);
          if (bytesRead !== size) throw new Error(`${table}.sql ended inside a statement`);
          await parts.write(statement);
        }
      } finally {
        await file.close();
      }
    }
  }
}

function statementsFor(writer: SqlBatchWriter): ImportStatements {
  return {
    // These release statements are not emitted per record; seedSql writes them
    // around the streamed table batches once the parser has finished.
    insertRelease: { run: () => undefined },
    finishRelease: { run: () => undefined },
    insertTableRows: { run: () => undefined },
    insertRecord: writer.statement("source_record"),
    insertJson: writer.statement("source_record_json"),
    insertLookup: writer.statement("lookup_form"),
    insertEdge: writer.statement("form_of_edge"),
    insertSense: writer.statement("sense"),
    insertGloss: writer.statement("sense_gloss"),
    insertLabel: writer.statement("sense_label"),
    insertClaim: writer.statement("grammar_claim"),
  };
}

export interface SeedSqlOptions {
  input: string;
  /** Directory the numbered SQL parts are written to; earlier parts in it are replaced. */
  outputDir: string;
  schema: string;
  releaseId?: string;
  archiveR2Key?: string;
  sourceName?: string;
  sourceUrl?: string;
  retrievedAt?: string;
  upstreamRelease?: string;
  license?: string;
  attribution?: string;
  /** Development fixtures use this to make list/fixture drift fail by name. */
  requiredWords?: readonly string[];
  /** Check every declared edge in a bounded fixture, not a full release. */
  validateFixtureClosure?: boolean;
  onRejection?: (rejection: Rejection) => void;
  maxStatementBytes?: number;
  /** Byte ceiling for one SQL part; see DEFAULT_PART_CEILING_BYTES. */
  partCeilingBytes?: number;
  /**
   * Raw Wiktionary pages to recover dropped definitions from (#28). Without
   * them the recovered layer is empty and the records are seeded as before.
   */
  rawPages?: RawPageSource;
  /**
   * Leave the release `importing` at the end of the SQL instead of writing its
   * final status. The counters are still written. A caller that verifies the
   * loaded database sets the final status itself once every check passes, so
   * nothing short of a verified load is ever marked servable.
   */
  leaveImporting?: boolean;
}

export interface SeedSqlReport extends ArchiveParseReport {
  releaseId: string;
  rows: RowCounts;
  statements: number;
  /** Part paths in the order they must be executed. */
  parts: readonly string[];
  /** What the recovered layer took from the raw pages. */
  recovery: RecoverySummary;
}

export async function seedSql(options: SeedSqlOptions): Promise<SeedSqlReport> {
  const outputDir = resolve(options.outputDir);
  // Constructed before the parse so a bad ceiling fails before any work.
  const parts = new SqlPartWriter(outputDir, options.partCeilingBytes);
  await mkdir(outputDir, { recursive: true });
  await clearParts(outputDir);
  const work = await mkdtemp(join(outputDir, ".seed-sql-"));
  const writer = new SqlBatchWriter(work, options.maxStatementBytes);
  const statements = statementsFor(writer);
  const recovered = new RecoveredLayer(
    options.rawPages ?? { page: () => undefined, size: 0 },
    {
      insertPage: writer.statement("raw_page"),
      insertDefinition: writer.statement("recovered_definition"),
      insertLabel: writer.statement("recovered_label"),
      insertExample: writer.statement("recovered_example"),
    },
    writer.counts,
  );
  const required = new Set(options.requiredWords ?? []);
  const seenWords = new Set<string>();
  const targets = new Set<string>();
  let start: { releaseId: string; archiveSha256: string; archiveBytes: number } | undefined;

  try {
    const report = await parseArchive({
      input: options.input,
      releaseId: options.releaseId,
      onRejection: (rejection) => options.onRejection?.(rejection),
      onStart: (metadata) => {
        start = metadata;
      },
      onRecord: async (archiveRecord, reportMember) => {
        seenWords.add(archiveRecord.record.word);
        archiveRecord.record.senses.forEach((sense) =>
          sense.form_of.forEach((target) => {
            if (typeof target.word === "string") targets.add(target.word);
          }),
        );
        writeRecord(statements, writer.counts, {
          recordId: archiveRecord.recordId,
          releaseId: archiveRecord.releaseId,
          lineNo: archiveRecord.lineNo,
          line: archiveRecord.line,
          record: archiveRecord.record,
          word: archiveRecord.record.word,
          pos: archiveRecord.record.pos,
          posTitle: archiveRecord.record.pos_title,
          reportMember,
        });
        recovered.add(archiveRecord.releaseId, archiveRecord.recordId, archiveRecord.record);
        if (writer.hasFullBatch()) await writer.flush();
      },
    });
    await writer.finish();
    if (!start) throw new Error("archive parser did not provide seed metadata");

    for (const word of required) {
      if (!seenWords.has(word)) throw new Error(`fixture is missing required word: ${word}`);
    }
    if (options.validateFixtureClosure) {
      for (const target of targets) {
        if (!seenWords.has(target)) throw new Error(`fixture is missing form_of target word: ${target}`);
      }
    }

    const schemaSql = await readFile(options.schema, "utf8");
    const releaseId = start.releaseId;
    const release = `INSERT INTO source_release\n` +
      `  (release_id,source_name,source_url,retrieved_at,upstream_release,archive_r2_key,archive_sha256,archive_bytes,normalizer,importer_version,schema_version,license,attribution,status)\n` +
      `VALUES (${[releaseId, options.sourceName ?? "kaikki-it-wiktextract", options.sourceUrl ?? null, options.retrievedAt ?? null, options.upstreamRelease ?? null, options.archiveR2Key ?? `releases/${releaseId}.jsonl.gz`, start.archiveSha256, start.archiveBytes, "it-normalize/v1", "it-import/v1", 1, options.license ?? null, options.attribution ?? null, "importing"].map(literal).join(",")});\n`;
    const finalStatus = options.leaveImporting ? "importing" : report.status;
    const finish = `UPDATE source_release SET status='${finalStatus}', lines_read=${report.linesRead}, admitted=${report.admitted}, skipped_other_language=${report.skippedOtherLanguage}, malformed_lines=${report.malformed}, malformed_members=${report.malformedMembers} WHERE release_id=${literal(releaseId)};\n`;
    const tableRows = TABLE_ORDER.slice(0, -1).map((table) =>
      `INSERT INTO release_table_rows (release_id,table_name,rows) VALUES (${literal(releaseId)},${literal(table)},${writer.counts[table]});\n`,
    ).join("");

    let partPaths: readonly string[];
    try {
      await parts.write(`${schemaSql}\n\n-- Generated by src/import/seedSql.ts.\n${release}`);
      await writer.copyTo(parts);
      await parts.write(`\n${finish}${tableRows}`);
    } finally {
      partPaths = await parts.close();
    }
    writer.counts.release_table_rows = TABLE_ORDER.length - 1;

    return {
      ...report,
      releaseId,
      rows: writer.counts,
      statements: TABLE_ORDER.slice(0, -1).reduce((sum, table) => sum + writer.counts[table], 0),
      parts: partPaths,
      recovery: recovered.summary,
    };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
