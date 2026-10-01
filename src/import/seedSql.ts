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
  type ArchiveRecord,
  type ImportStatement,
  type ImportStatements,
  type Rejection,
} from "./importRelease.js";
import { archiveFactsFor, type ArchiveFacts, type ArchiveFactsCatalog } from "../source/archiveFacts.js";
import type { RawPageSource } from "../source/rawPage.js";
import type { LanguageHeadings } from "../italian/sectionLanguage.js";
import { HiddenLayer, readTitles, type HiddenSummary } from "./hiddenLayer.js";
import { RawPageRows } from "./rawPageRows.js";
import { RecoveredLayer, type RecoverySummary } from "./recoveredLayer.js";
import { normalizeItalianExact } from "../italian/normalize.js";
import { SOURCE_TEXT_RULES, type SourceTextRuleId } from "../italian/sourceTextNormalization.js";
import { deletionKeys, foldKey } from "../lookup/nearby.js";
import { clearParts, SqlPartWriter } from "./sqlParts.js";

const TABLE_ORDER = [
  "source_record",
  "source_record_json",
  "lookup_form",
  "accent_fold",
  "typo_key",
  "form_of_edge",
  "sense",
  "sense_gloss",
  "sense_label",
  "grammar_claim",
  "raw_page",
  "recovered_definition",
  "recovered_label",
  "recovered_example",
  "hidden_record",
  "release_table_rows",
] as const;

export type TableName = (typeof TABLE_ORDER)[number];

type RowCounts = Record<TableName, number>;

/** The columns each table's INSERT names, in the order its statement binds them. */
export const COLUMNS: Record<TableName, string> = {
  source_record: "record_id,release_id,line_no,line_sha256,word,pos,pos_title,lang_code",
  source_record_json: "record_id,raw_json",
  lookup_form: "record_id,release_id,origin,surface,surface_key,json_pointer,form_index,form_source",
  accent_fold: "release_id,fold_key,surface_key,headword,languages,richness",
  typo_key: "release_id,deletion_key,surface_key,languages,richness",
  form_of_edge: "record_id,release_id,sense_index,form_of_index,json_pointer,target_word,target_word_key",
  sense: "sense_id,record_id,sense_index,json_pointer",
  sense_gloss: "sense_id,gloss_index,text,json_pointer",
  sense_label: "sense_id,label_index,kind,label,json_pointer",
  grammar_claim: "record_id,scope,scope_index,json_pointer,status,dimension,value,source_text",
  raw_page: "page_id,release_id,wiki,title,revision_id,revision_timestamp",
  recovered_definition: "recovered_id,record_id,release_id,page_id,definition_index,route,term,page_line,wikitext,text,held_as_example,lead_in_sense_index,lead_in_recovered_id",
  recovered_label: "recovered_id,label_index,label",
  recovered_example: "recovered_id,example_index,page_line,wikitext,text",
  hidden_record: "record_id,release_id,page_id,rule,because,language,page_line",
  release_table_rows: "release_id,table_name,rows",
};

/** A value as an SQL literal: the seed SQL binds nothing, so every value is written out. */
export const literal = (value: unknown): string => {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "bigint") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
};

/**
 * One row of `table` as the VALUES tuple its INSERT takes, in `COLUMNS`
 * order. `writeRecord` binds a record without its `lang_code`, which the
 * import admits only as `it`, so that column is added here.
 */
export function tupleOf(table: TableName, values: readonly unknown[]): string {
  const row = table === "source_record" ? [...values, "it"] : values;
  return `(${row.map(literal).join(",")})`;
}

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
    accent_fold: 0,
    typo_key: 0,
    form_of_edge: 0,
    sense: 0,
    sense_gloss: 0,
    sense_label: 0,
    grammar_claim: 0,
    raw_page: 0,
    recovered_definition: 0,
    recovered_label: 0,
    recovered_example: 0,
    hidden_record: 0,
    release_table_rows: 0,
  };

  constructor(private readonly directory: string, private readonly maxStatementBytes = 64 * 1024) {}

  statement(table: Exclude<TableName, "release_table_rows">): ImportStatement {
    return {
      run: (...values: unknown[]) => {
        const tuple = tupleOf(table, values);
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

/** The distinct language codes a record's `translations` list, ignoring anything malformed. */
function translationLanguages(translations: unknown): string[] {
  if (!Array.isArray(translations)) return [];
  return translations.flatMap((entry) =>
    typeof entry === "object" && entry !== null && typeof (entry as { lang_code?: unknown }).lang_code === "string"
      ? [(entry as { lang_code: string }).lang_code]
      : [],
  );
}

/**
 * How common a spelling is, as far as the source can say: the distinct
 * languages its lemma records translate into, and their senses plus forms.
 * `accent_fold` and `typo_key` carry it, and src/lookup/nearby.ts ranks by it.
 */
export interface LemmaScore {
  languages: Set<string>;
  richness: number;
}

/**
 * Add one record to the score of the key its headword spells, when it is a
 * lemma record: one that declares itself a form of nothing. A form-of record
 * adds nothing, so an inflected spelling never leads to itself.
 */
export function addLemmaRecord(scores: Map<string, LemmaScore>, record: ArchiveRecord["record"]): void {
  if (!record.senses.every((sense) => sense.form_of.length === 0)) return;
  const key = normalizeItalianExact(record.word);
  const score = scores.get(key) ?? { languages: new Set<string>(), richness: 0 };
  for (const language of translationLanguages(record.translations)) score.languages.add(language);
  score.richness += record.senses.length + record.forms.length;
  scores.set(key, score);
}

/** One `accent_fold` row, without its release. */
export interface AccentFoldRow {
  foldKey: string;
  surfaceKey: string;
  headword: 0 | 1;
  languages: number;
  richness: number;
}

/** One `typo_key` row, without its release. */
export interface TypoKeyRow {
  deletionKey: string;
  surfaceKey: string;
  languages: number;
  richness: number;
}

/**
 * The `accent_fold` row of a searchable key, or none when folding its accents
 * changes nothing: the exact lookup already finds an unaccented key.
 * `headword` is whether some record heads the key.
 */
export function accentFoldRowOf(key: string, headword: boolean, score: LemmaScore | undefined): AccentFoldRow | undefined {
  const folded = foldKey(key);
  if (folded === key) return undefined;
  return { foldKey: folded, surfaceKey: key, headword: headword ? 1 : 0, languages: score?.languages.size ?? 0, richness: score?.richness ?? 0 };
}

/** The `typo_key` rows of a lemma headword key: itself and each spelling of it one character short. */
export function typoKeyRowsOf(key: string, score: LemmaScore): TypoKeyRow[] {
  return deletionKeys(key).map((deletion) => ({ deletionKey: deletion, surfaceKey: key, languages: score.languages.size, richness: score.richness }));
}

/**
 * The two indexes a search that found nothing reads (src/lookup/nearby.ts):
 * accent-folded keys, and the lemma headwords' single-deletion keys.
 */
async function writeNearbyIndexes(
  writer: SqlBatchWriter,
  releaseId: string,
  keys: ReadonlyMap<string, boolean>,
  lemmaKeys: ReadonlyMap<string, LemmaScore>,
): Promise<void> {
  const fold = writer.statement("accent_fold");
  for (const [key, headword] of keys) {
    const row = accentFoldRowOf(key, headword, lemmaKeys.get(key));
    if (row === undefined) continue;
    fold.run(releaseId, row.foldKey, row.surfaceKey, row.headword, row.languages, row.richness);
    writer.counts.accent_fold += 1;
    if (writer.hasFullBatch()) await writer.flush();
  }
  const typo = writer.statement("typo_key");
  for (const [key, score] of lemmaKeys) {
    for (const row of typoKeyRowsOf(key, score)) {
      typo.run(releaseId, row.deletionKey, row.surfaceKey, row.languages, row.richness);
      writer.counts.typo_key += 1;
    }
    if (writer.hasFullBatch()) await writer.flush();
  }
}

export interface SeedSqlOptions {
  input: string;
  /** Directory the numbered SQL parts are written to; earlier parts in it are replaced. */
  outputDir: string;
  schema: string;
  releaseId?: string;
  archiveR2Key?: string;
  sourceName?: string;
  /**
   * Where the download URL, download time and source dump come from, keyed by
   * archive SHA-256. There is no option to pass those facts directly: they are
   * read from here for the archive's own checksum, so they never land on a
   * file they were not read from. Tests pass their own catalog.
   */
  archiveFacts?: ArchiveFactsCatalog;
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
   * The language codes the dump heads sections with
   * (`fixtures/section-language/regressions.json`). With `rawPages`, the seed
   * hides every record the section-language rule finds in another language
   * (src/import/hiddenLayer.ts, ADR 0023); without either, it hides none.
   */
  languageHeadings?: LanguageHeadings;
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
  /** What the section-language rule hid. */
  hidden: HiddenSummary;
  /** The facts recorded for this archive's checksum, or none. */
  archiveFacts: ArchiveFacts | undefined;
  /** The source text normalization rules (ADR 0019) the structured rows were written under. */
  sourceTextRules: readonly SourceTextRuleId[];
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
  // Every searchable key, and whether some record heads it; and the lemma
  // headword keys. They become accent_fold and typo_key once the parse ends.
  const keys = new Map<string, boolean>();
  // A lemma headword key, and how common it is: the distinct languages its
  // lemma records translate into, and their senses plus forms.
  const lemmaKeys = new Map<string, LemmaScore>();
  const lookupRow = statements.insertLookup;
  statements.insertLookup = {
    run: (...values: unknown[]) => {
      const key = values[4] as string;
      keys.set(key, keys.get(key) === true || values[2] === "headword");
      lookupRow.run(...values);
    },
  };
  const pageRows = new RawPageRows(writer.statement("raw_page"), writer.counts);
  const recovered = new RecoveredLayer(
    options.rawPages ?? { page: () => undefined, size: 0 },
    pageRows,
    {
      insertDefinition: writer.statement("recovered_definition"),
      insertLabel: writer.statement("recovered_label"),
      insertExample: writer.statement("recovered_example"),
    },
    writer.counts,
  );
  // The rule needs every record of a title before it judges one, so the titles
  // are read in a pass of their own first.
  const judge = options.rawPages !== undefined && options.languageHeadings !== undefined
    ? { pages: options.rawPages, languages: options.languageHeadings, titles: (await readTitles(options.input)).titles }
    : undefined;
  const hidden = new HiddenLayer(judge, pageRows, writer.statement("hidden_record"), writer.counts);
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
        // A hidden record leads no search to its spelling and declares no
        // edge, so it adds nothing to the nearby indexes or the closure.
        const isHidden = hidden.hides(archiveRecord.releaseId, archiveRecord.recordId, archiveRecord.lineNo, archiveRecord.record.word);
        if (!isHidden) {
          addLemmaRecord(lemmaKeys, archiveRecord.record);
          archiveRecord.record.senses.forEach((sense) =>
            sense.form_of.forEach((target) => {
              if (typeof target.word === "string") targets.add(target.word);
            }),
          );
        }
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
          hidden: isHidden,
        });
        recovered.add(archiveRecord.releaseId, archiveRecord.recordId, archiveRecord.record);
        if (writer.hasFullBatch()) await writer.flush();
      },
    });
    if (!start) throw new Error("archive parser did not provide seed metadata");
    await writeNearbyIndexes(writer, start.releaseId, keys, lemmaKeys);
    await writer.finish();

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
    const facts = archiveFactsFor(start.archiveSha256, options.archiveFacts);
    const dump = facts?.dump;
    const release = `INSERT INTO source_release\n` +
      `  (release_id,source_name,source_url,retrieved_at,upstream_release,upstream_release_basis,archive_r2_key,archive_sha256,archive_bytes,normalizer,importer_version,schema_version,license,attribution,status)\n` +
      `VALUES (${[releaseId, options.sourceName ?? "kaikki-it-wiktextract", facts?.sourceUrl ?? null, facts?.retrievedAt ?? null, dump?.id ?? null, dump?.basis ?? null, options.archiveR2Key ?? `releases/${releaseId}.jsonl.gz`, start.archiveSha256, start.archiveBytes, "it-normalize/v1", "it-import/v1", 1, options.license ?? null, options.attribution ?? null, "importing"].map(literal).join(",")});\n`;
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
      hidden: hidden.summary,
      archiveFacts: facts,
      sourceTextRules: Object.values(SOURCE_TEXT_RULES),
    };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
