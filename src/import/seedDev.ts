// Seed a small, repeatable local D1 from committed content fixtures.
//
// The fixtures are the same release-shaped files produced by the content
// converter. This command deliberately does not read it-extract.jsonl.gz or a
// SQLite working database: D1 is loaded with SQL generated directly from the
// files.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { contentFilePath } from "../content/converter.js";
import { normalizeItalianExact } from "../italian/normalize.js";

/** The fixture contract. Keep this list in step with fixtures/content/it. */
export const FIXTURE_WORDS = [
  "casa", "case", "studente", "studenti", "sale", "andare", "andavano",
  "parlare", "parlerei", "bello", "bella", "città", "fine", "grande",
  "vado", "finire", "studentessa", "casetta", "zaino", "sala", "salire",
  "studioso", "manuale", "canzone", "pianoforte", "partita", "informatica",
  "classico", "verde", "libro", "acqua", "pane", "tavolo", "scuola", "lavoro",
  "mangiare", "vedere", "dormire", "essere", "avere", "fare", "dire", "venire",
  "sapere", "potere", "volere", "buono", "buona", "piccolo", "piccola",
] as const;

const ROOT = resolve("fixtures/content");
const DEFAULT_RELEASE = "it-dev";
const DEFAULT_SQL = resolve(".data/dev.sql");
const DEFAULT_D1 = resolve(".data/dev-d1");

type JsonObject = Record<string, unknown>;
type Source = { line: number; pointer: string };
type Value = { value: string; source: Source };
type FixtureSense = {
  index: number;
  source: Source;
  glosses: Value[];
  labels: Array<Value & { kind: "tag" | "raw_tag" }>;
  formOf: Value[];
};
type FixtureForm = {
  index: number;
  source: Source;
  form: Value | null;
  tags: Value[];
  rawTags: Value[];
};
type FixtureClaim = {
  status: "stated" | "unclassified" | "missing";
  dimension?: string;
  value?: string;
  sourceText?: string;
  source: Source;
};
type FixtureEntry = {
  key: string;
  sourceLineSha256: string;
  word: Value;
  pos: Value;
  posTitle: Value;
  tags: Value[];
  rawTags: Value[];
  senses: FixtureSense[];
  forms: FixtureForm[];
  grammar: {
    record?: FixtureClaim[];
    senses?: Array<{ index: number; claim: FixtureClaim }>;
    forms?: Array<{ index: number; claim: FixtureClaim }>;
  };
};

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function asValue(value: unknown, name: string): Value {
  if (!isObject(value) || typeof value.value !== "string" || !isObject(value.source) ||
      typeof value.source.line !== "number" || typeof value.source.pointer !== "string") {
    throw new Error(`invalid ${name} value/source`);
  }
  return value as unknown as Value;
}

function values(value: unknown, name: string): Value[] {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`);
  return value.map((item, index) => asValue(item, `${name}[${index}]`));
}

function source(value: unknown, name: string): Source {
  if (!isObject(value) || typeof value.line !== "number" || typeof value.pointer !== "string") {
    throw new Error(`invalid ${name} source`);
  }
  return value as unknown as Source;
}

function claim(value: unknown, name: string): FixtureClaim {
  if (!isObject(value) || !["stated", "unclassified", "missing"].includes(String(value.status))) {
    throw new Error(`invalid ${name} status`);
  }
  return value as unknown as FixtureClaim;
}

function parseEntry(value: unknown, word: string, key: string): FixtureEntry {
  if (!isObject(value)) throw new Error(`fixture ${word} entry ${key} must be an object`);
  const entry = value as Record<string, unknown>;
  const parsed = {
    key,
    sourceLineSha256: entry.sourceLineSha256,
    word: asValue(entry.word, `${word}.${key}.word`),
    pos: asValue(entry.pos, `${word}.${key}.pos`),
    posTitle: asValue(entry.posTitle, `${word}.${key}.posTitle`),
    tags: values(entry.tags, `${word}.${key}.tags`),
    rawTags: values(entry.rawTags, `${word}.${key}.rawTags`),
    senses: (Array.isArray(entry.senses) ? entry.senses : []).map((item, index) => {
      if (!isObject(item)) throw new Error(`fixture ${word}.${key}.senses[${index}] must be an object`);
      return {
        index: typeof item.index === "number" ? item.index : index,
        source: source(item.source, `${word}.${key}.senses[${index}]`),
        glosses: values(item.glosses, `${word}.${key}.senses[${index}].glosses`),
        labels: (Array.isArray(item.labels) ? item.labels : []).map((label, labelIndex) => {
          if (!isObject(label) || (label.kind !== "tag" && label.kind !== "raw_tag")) {
            throw new Error(`invalid ${word}.${key}.senses[${index}].labels[${labelIndex}]`);
          }
          return { ...asValue(label, `${word}.${key}.labels[${labelIndex}]`), kind: label.kind } as Value & { kind: "tag" | "raw_tag" };
        }),
        formOf: values(item.formOf, `${word}.${key}.senses[${index}].formOf`),
      };
    }),
    forms: (Array.isArray(entry.forms) ? entry.forms : []).map((item, index) => {
      if (!isObject(item)) throw new Error(`fixture ${word}.${key}.forms[${index}] must be an object`);
      return {
        index: typeof item.index === "number" ? item.index : index,
        source: source(item.source, `${word}.${key}.forms[${index}]`),
        form: item.form === null ? null : asValue(item.form, `${word}.${key}.forms[${index}].form`),
        tags: values(item.tags, `${word}.${key}.forms[${index}].tags`),
        rawTags: values(item.rawTags, `${word}.${key}.forms[${index}].rawTags`),
      };
    }),
    grammar: { record: [], senses: [], forms: [] },
  } as unknown as FixtureEntry;
  if (typeof parsed.sourceLineSha256 !== "string") throw new Error(`fixture ${word}.${key} has no sourceLineSha256`);
  const grammar = isObject(entry.grammar) ? entry.grammar : {};
  parsed.grammar.record = Array.isArray(grammar.record)
    ? grammar.record.map((item, index) => claim(item, `${word}.${key}.grammar.record[${index}]`)) : [];
  parsed.grammar.senses = Array.isArray(grammar.senses) ? grammar.senses.map((item, index) => {
    if (!isObject(item) || typeof item.index !== "number") throw new Error(`invalid ${word}.${key}.grammar.senses[${index}]`);
    return { index: item.index, claim: claim(item.claim, `${word}.${key}.grammar.senses[${index}].claim`) };
  }) : [];
  parsed.grammar.forms = Array.isArray(grammar.forms) ? grammar.forms.map((item, index) => {
    if (!isObject(item) || typeof item.index !== "number") throw new Error(`invalid ${word}.${key}.grammar.forms[${index}]`);
    return { index: item.index, claim: claim(item.claim, `${word}.${key}.grammar.forms[${index}].claim`) };
  }) : [];
  if (parsed.word.value !== word) throw new Error(`fixture ${word} entry ${key} names ${parsed.word.value}`);
  return parsed;
}

interface FixtureFile { word: string; path: string; bytes: Buffer; entries: FixtureEntry[] }

async function jsonFiles(directory: string): Promise<string[]> {
  const result: string[] = [];
  const visit = async (dir: string): Promise<void> => {
    for (const item of await readdir(dir, { withFileTypes: true })) {
      const path = resolve(dir, item.name);
      if (item.isDirectory()) await visit(path);
      else if (item.isFile() && item.name.endsWith(".json")) result.push(path);
    }
  };
  try { await stat(directory); } catch { return []; }
  await visit(directory);
  return result;
}

/** Read and validate exactly the words in the development seed contract. */
export async function readContentFixtures(root = ROOT, words: readonly string[] = FIXTURE_WORDS): Promise<FixtureFile[]> {
  const expected = new Set(words.map((word) => resolve(contentFilePath(root, word))));
  const paths = new Set(await jsonFiles(resolve(root, "it")));
  for (const word of words) {
    const path = resolve(contentFilePath(root, word));
    if (!paths.has(path)) throw new Error(`missing content fixture for "${word}" (${path})`);
  }
  const extras = [...paths].filter((path) => !expected.has(path)).sort();
  if (extras.length > 0) throw new Error(`unexpected content fixture: ${extras[0]}`);
  const files: FixtureFile[] = [];
  for (const word of words) {
    const path = resolve(contentFilePath(root, word));
    const bytes = await readFile(path);
    let document: unknown;
    try { document = JSON.parse(bytes.toString("utf8")); } catch (error) {
      throw new Error(`invalid content fixture for "${word}": ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!isObject(document) || document.schema !== "lexema-content/v1" || !isObject(document.entries)) {
      throw new Error(`content fixture for "${word}" has no lexema-content/v1 entries`);
    }
    const entries = Object.entries(document.entries).map(([key, value]) => parseEntry(value, word, key));
    if (entries.length === 0) throw new Error(`content fixture for "${word}" has no entries`);
    files.push({ word, path, bytes, entries });
  }
  return files;
}

function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function insert(table: string, columns: readonly string[], values_: readonly unknown[]): string {
  return `INSERT INTO ${table} (${columns.join(",")}) VALUES (${values_.map(sqlLiteral).join(",")});\n`;
}

function rawRecord(entry: FixtureEntry): string {
  return JSON.stringify({
    word: entry.word.value, pos: entry.pos.value, pos_title: entry.posTitle.value, lang_code: "it",
    tags: entry.tags.map((item) => item.value), raw_tags: entry.rawTags.map((item) => item.value),
    forms: entry.forms.map((form) => ({
      ...(form.form === null ? {} : { form: form.form.value }),
      ...(form.tags.length === 0 ? {} : { tags: form.tags.map((item) => item.value) }),
      ...(form.rawTags.length === 0 ? {} : { raw_tags: form.rawTags.map((item) => item.value) }),
    })),
    senses: entry.senses.map((sense) => ({
      ...(sense.glosses.length === 0 ? {} : { glosses: sense.glosses.map((item) => item.value) }),
      ...(sense.labels.filter((item) => item.kind === "tag").length === 0 ? {} : { tags: sense.labels.filter((item) => item.kind === "tag").map((item) => item.value) }),
      ...(sense.labels.filter((item) => item.kind === "raw_tag").length === 0 ? {} : { raw_tags: sense.labels.filter((item) => item.kind === "raw_tag").map((item) => item.value) }),
      ...(sense.formOf.length === 0 ? {} : { form_of: sense.formOf.map((item) => ({ word: item.value })) }),
    })),
  });
}

function addClaimSql(lines: string[], recordId: number, claim_: FixtureClaim, scope: string, scopeIndex: number | null): void {
  lines.push(insert("grammar_claim", ["record_id", "scope", "scope_index", "json_pointer", "status", "dimension", "value", "source_text"], [
    recordId, scope, scopeIndex, claim_.source.pointer, claim_.status,
    claim_.dimension ?? null, claim_.value ?? null, claim_.sourceText ?? null,
  ]));
}

/** Build the complete schema-plus-data script consumed by wrangler D1. */
export async function buildSeedSql(options: { root?: string; schema?: string; releaseId?: string; words?: readonly string[]; sourceUrl?: string } = {}): Promise<{ sql: string; files: FixtureFile[] }> {
  const root = options.root ?? ROOT;
  const files = await readContentFixtures(root, options.words);
  const schema = await readFile(options.schema ?? resolve("src/db/schema.sql"), "utf8");
  const releaseId = options.releaseId ?? DEFAULT_RELEASE;
  const hash = createHash("sha256");
  let bytes = 0;
  for (const file of files) { hash.update(file.bytes); bytes += file.bytes.byteLength; }
  const archiveHash = hash.digest("hex");
  const lines: string[] = ["-- Generated by src/import/seedDev.ts. Do not edit.\n", schema, "\n"];
  const recordTotal = files.reduce((total, file) => total + file.entries.length, 0);
  lines.push(insert("source_release", ["release_id", "source_name", "source_url", "retrieved_at", "upstream_release", "archive_r2_key", "archive_sha256", "archive_bytes", "normalizer", "importer_version", "schema_version", "license", "attribution", "status", "lines_read", "admitted", "skipped_other_language", "malformed_lines", "malformed_members"], [
    releaseId, "lexema-content-fixtures", options.sourceUrl ?? null, null, null, "content/manifest.json", archiveHash, bytes,
    "it-normalize/v1", "content-seed/v1", 1, "CC-BY-SA-4.0", null, "complete", recordTotal, recordTotal, 0, 0, 0,
  ]));
  let recordId = 0;
  let lookupId = 0;
  let edgeId = 0;
  let senseId = 0;
  let glossId = 0;
  let labelId = 0;
  let claimId = 0;
  const counts = new Map<string, number>();
  const count = (table: string, amount = 1) => counts.set(table, (counts.get(table) ?? 0) + amount);
  for (const file of files) {
    for (const entry of file.entries) {
      recordId += 1;
      const lineNo = entry.word.source.line;
      lines.push(insert("source_record", ["record_id", "release_id", "line_no", "line_sha256", "word", "pos", "pos_title", "lang_code"], [recordId, releaseId, lineNo, entry.sourceLineSha256, entry.word.value, entry.pos.value, entry.posTitle.value, "it"])); count("source_record");
      lines.push(insert("source_record_json", ["record_id", "raw_json"], [recordId, rawRecord(entry)])); count("source_record_json");
      lines.push(insert("lookup_form", ["lookup_id", "record_id", "release_id", "origin", "surface", "surface_key", "json_pointer", "form_index", "form_source"], [lookupId += 1, recordId, releaseId, "headword", entry.word.value, normalizeItalianExact(entry.word.value), entry.word.source.pointer, null, null])); count("lookup_form");
      for (const form of entry.forms) if (form.form !== null) {
        lines.push(insert("lookup_form", ["lookup_id", "record_id", "release_id", "origin", "surface", "surface_key", "json_pointer", "form_index", "form_source"], [lookupId += 1, recordId, releaseId, "embedded-form", form.form.value, normalizeItalianExact(form.form.value), form.form.source.pointer, form.index, null])); count("lookup_form");
      }
      for (const [senseIndex, sense] of entry.senses.entries()) {
        const actualSenseId = ++senseId;
        lines.push(insert("sense", ["sense_id", "record_id", "sense_index", "json_pointer"], [actualSenseId, recordId, sense.index ?? senseIndex, sense.source.pointer])); count("sense");
        for (const gloss of sense.glosses) { lines.push(insert("sense_gloss", ["gloss_id", "sense_id", "gloss_index", "text", "json_pointer"], [++glossId, actualSenseId, Number(gloss.source.pointer.split("/").at(-1)), gloss.value, gloss.source.pointer])); count("sense_gloss"); }
        for (const [labelIndex, label] of sense.labels.entries()) { lines.push(insert("sense_label", ["label_id", "sense_id", "label_index", "kind", "label", "json_pointer"], [++labelId, actualSenseId, labelIndex, label.kind, label.value, label.source.pointer])); count("sense_label"); }
        for (const [formOfIndex, formOf] of sense.formOf.entries()) { lines.push(insert("form_of_edge", ["edge_id", "record_id", "release_id", "sense_index", "form_of_index", "json_pointer", "target_word", "target_word_key"], [++edgeId, recordId, releaseId, sense.index ?? senseIndex, formOfIndex, formOf.source.pointer, formOf.value, normalizeItalianExact(formOf.value)])); count("form_of_edge"); }
      }
      for (const item of entry.grammar.record ?? []) { addClaimSql(lines, recordId, item, "record", null); claimId += 1; count("grammar_claim"); }
      for (const item of entry.grammar.senses ?? []) { addClaimSql(lines, recordId, item.claim, "sense", item.index); claimId += 1; count("grammar_claim"); }
      for (const item of entry.grammar.forms ?? []) { addClaimSql(lines, recordId, item.claim, "form", item.index); claimId += 1; count("grammar_claim"); }
    }
  }
  // Keep IDs explicit and stable; grammar_claim is the only remaining table
  // whose primary key was not assigned above.
  if (claimId > 0) {
    // SQLite assigns INTEGER PRIMARY KEY values when omitted; no extra action.
  }
  for (const [table, rowCount] of counts) lines.push(insert("release_table_rows", ["release_id", "table_name", "rows"], [releaseId, table, rowCount]));
  lines[2] += "\n";
  return { sql: lines.join(""), files };
}

export async function main(): Promise<void> {
  const releaseId = process.env.SEED_RELEASE ?? DEFAULT_RELEASE;
  const output = resolve(process.env.SEED_SQL ?? DEFAULT_SQL);
  const persistTo = resolve(process.env.SEED_D1_PERSIST_TO ?? DEFAULT_D1);
  const { sql, files } = await buildSeedSql({ releaseId });
  await rm(persistTo, { recursive: true, force: true });
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, sql);
  process.stderr.write(`generated ${output} from ${files.length} content fixtures\n`);
  process.stderr.write(`clearing local D1 at ${persistTo}\n`);
  execFileSync("pnpm", ["exec", "wrangler", "d1", "execute", "lexema", "--local", "--persist-to", persistTo, "--file", output, "--yes"], {
    cwd: resolve("web"), stdio: "inherit", env: { ...process.env, CI: "1" },
  });
  process.stderr.write(`seeded ${releaseId} in ${persistTo}; port 8790 and web/.wrangler were not touched\n`);
}

if (process.argv[1]?.endsWith("/seedDev.ts") || process.argv[1]?.endsWith("/seedDev.js")) {
  await main();
}
