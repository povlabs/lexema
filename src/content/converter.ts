import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

export interface ConversionOptions {
  database?: string;
  output?: string;
}

export interface ConversionReport {
  files: number;
  words: number;
  records: number;
  bytes: number;
}

interface Ref {
  line: number;
  pointer: string;
}
interface Value<T> { value: T; source: Ref }
interface RawRecord { [key: string]: unknown; word: string; pos: string; pos_title: string }
interface Entry {
  key: string;
  word: Value<string>;
  pos: Value<string>;
  posTitle: Value<string>;
  tags: Value<string>[];
  rawTags: Value<string>[];
  senses: unknown[];
  forms: unknown[];
  grammar: unknown;
  [key: string]: unknown;
}

/**
 * Return the two directory components for a word. Punctuation, spaces, digits
 * and every other non-letter are `_`; a missing second letter is `_`. Thus the
 * rule is total: `a` is `a/a_`, while `/x` is `_/_x`.
 */
export function wordPrefix(word: string): [string, string, string, string] {
  const chars = [...word.toLocaleLowerCase("it-IT")];
  const letter = (char: string | undefined): string =>
    char !== undefined && /^\p{L}$/u.test(char) ? char : "_";
  const first = letter(chars[0]);
  const second = letter(chars[1]);
  const third = letter(chars[2]);
  const fourth = letter(chars[3]);
  return [first, `${first}${second}`, `${first}${second}${third}`, `${first}${second}${third}${fourth}`];
}

/** Filename encoding keeps lower-case words readable and makes `/` and case safe. */
export function wordFileName(word: string): string {
  const encoded = [...word].map((char) => {
    const code = char.codePointAt(0) as number;
    return code >= 0x41 && code <= 0x5a
      ? `%${code.toString(16).toUpperCase()}`
      : encodeURIComponent(char);
  }).join("");
  return `${encoded}.json`;
}

export function contentFilePath(root: string, word: string): string {
  const [first, firstTwo, firstThree, firstFour] = wordPrefix(word);
  return join(root, "it", first, firstTwo, firstThree, firstFour, wordFileName(word));
}

function ref(_releaseId: string, lineNo: number, _lineSha256: string, jsonPointer: string): Ref {
  // Release identity is at file level and line SHA is at entry level; every
  // value still carries its exact line and JSON pointer without repetition.
  return { line: lineNo, pointer: jsonPointer };
}

function value<T>(value_: T, source: Ref): Value<T> {
  return { value: value_, source };
}

function stringValues(
  input: unknown,
  pointer: string,
  source: (pointer: string) => Ref,
): Value<string>[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item, index) =>
    typeof item === "string" ? [value(item, source(`${pointer}/${index}`))] : [],
  );
}

function objectValues(
  input: unknown,
  pointer: string,
  source: (pointer: string) => Ref,
): Value<string>[] {
  return stringValues(input, pointer, source);
}

function rawEntry(
  raw: RawRecord,
  releaseId: string,
  lineNo: number,
  lineSha256: string,
  key: string,
  grammar: unknown,
): Entry {
  const source = (pointer: string) => ref(releaseId, lineNo, lineSha256, pointer);
  const senses = Array.isArray(raw.senses) ? raw.senses : [];
  const forms = Array.isArray(raw.forms) ? raw.forms : [];
  return {
    key,
    sourceLineSha256: lineSha256,
    word: value(raw.word, source("/word")),
    pos: value(raw.pos, source("/pos")),
    posTitle: value(raw.pos_title, source("/pos_title")),
    tags: stringValues(raw.tags, "/tags", source),
    rawTags: stringValues(raw.raw_tags, "/raw_tags", source),
    senses: senses.map((sense, index) => {
      const pointer = `/senses/${index}`;
      if (typeof sense !== "object" || sense === null) {
        return { index, source: source(pointer), glosses: [], labels: [], formOf: [] };
      }
      const s = sense as Record<string, unknown>;
      const labels = [
        ...objectValues(s.tags, `${pointer}/tags`, source).map((item) => ({ ...item, kind: "tag" as const })),
        ...objectValues(s.raw_tags, `${pointer}/raw_tags`, source).map((item) => ({ ...item, kind: "raw_tag" as const })),
      ];
      const formOf = Array.isArray(s.form_of)
        ? s.form_of.flatMap((target, targetIndex) => {
            if (typeof target !== "object" || target === null) return [];
            const word_ = (target as Record<string, unknown>).word;
            return typeof word_ === "string"
              ? [value(word_, source(`${pointer}/form_of/${targetIndex}/word`))]
              : [];
          })
        : [];
      return {
        index,
        source: source(pointer),
        glosses: stringValues(s.glosses, `${pointer}/glosses`, source),
        labels,
        formOf,
      };
    }),
    forms: forms.map((form, index) => {
      const pointer = `/forms/${index}`;
      const f = typeof form === "object" && form !== null ? form as Record<string, unknown> : {};
      return {
        index,
        source: source(pointer),
        form: typeof f.form === "string" ? value(f.form, source(`${pointer}/form`)) : null,
        tags: stringValues(f.tags, `${pointer}/tags`, source),
        rawTags: stringValues(f.raw_tags, `${pointer}/raw_tags`, source),
      };
    }),
    grammar,
  };
}

function grammarFor(
  db: DatabaseSync,
  recordId: number,
  releaseId: string,
  lineNo: number,
  lineSha256: string,
): unknown {
  const rows = db.prepare(
    `SELECT scope, scope_index, status, dimension, value, source_text, json_pointer
       FROM grammar_claim WHERE record_id = ? ORDER BY claim_id`,
  ).all(recordId) as Array<{
    scope: "record" | "sense" | "form"; scope_index: number | null;
    status: "stated" | "unclassified" | "missing"; dimension: string | null;
    value: string | null; source_text: string | null; json_pointer: string;
  }>;
  const claim = (row: (typeof rows)[number]) => ({
    status: row.status,
    ...(row.dimension === null ? {} : { dimension: row.dimension }),
    ...(row.value === null ? {} : { value: row.value }),
    ...(row.source_text === null ? {} : { sourceText: row.source_text }),
    source: ref(releaseId, lineNo, lineSha256, row.json_pointer),
  });
  return {
    record: rows.filter((row) => row.scope === "record").map(claim),
    senses: rows.filter((row) => row.scope === "sense").map((row) => ({ index: row.scope_index, claim: claim(row) })),
    forms: rows.filter((row) => row.scope === "form").map((row) => ({ index: row.scope_index, claim: claim(row) })),
  };
}

function keyFor(pos: string, posTitle: string, occurrence: number): string {
  const base = `${pos}:${posTitle}`;
  return occurrence === 1 ? base : `${base}#${occurrence}`;
}

function existingDocument(path: string): { [key: string]: unknown } | undefined {
  if (!existsSync(path)) return undefined;
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  return typeof parsed === "object" && parsed !== null ? parsed as { [key: string]: unknown } : undefined;
}

/** Convert the complete release in SQLite into deterministic, editable content files. */
export function convertRelease(options: ConversionOptions = {}): ConversionReport {
  const database = resolve(options.database ?? ".data/lexema.sqlite");
  const output = resolve(options.output ?? "content");
  const db = new DatabaseSync(database, { readOnly: true });
  try {
    const release = db.prepare(
      `SELECT release_id, archive_sha256, archive_bytes, status FROM source_release ORDER BY release_id LIMIT 1`,
    ).get() as { release_id: string; archive_sha256: string; archive_bytes: number; status: string } | undefined;
    if (release === undefined) throw new Error(`no release found in ${database}`);
    if (release.status !== "complete") throw new Error(`release ${release.release_id} is ${release.status}, not complete`);

    const records = db.prepare(
      `SELECT record_id, line_no, line_sha256, word, pos, pos_title
         FROM source_record WHERE release_id = ? ORDER BY word, pos, pos_title, line_no, record_id`,
    ).all(release.release_id) as Array<{
      record_id: number; line_no: number; line_sha256: string; word: string; pos: string; pos_title: string;
    }>;
    const rawQuery = db.prepare("SELECT raw_json FROM source_record_json WHERE record_id = ?");
    // Records are ordered by word, so only one word document is held in memory.
    let currentWord: string | undefined;
    let currentPath: string | undefined;
    let currentDoc: Record<string, unknown> | undefined;
    let entries: Record<string, unknown> | undefined;
    let occurrences = new Map<string, number>();
    let changedFiles = 0;
    let bytes = 0;
    let words = 0;
    const writeIfChanged = (path: string, doc: Record<string, unknown>): void => {
      const next = Buffer.from(`${JSON.stringify(doc)}\n`, "utf8");
      const previous = existsSync(path) ? readFileSync(path) : undefined;
      if (previous?.equals(next)) return;
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, next);
      changedFiles += 1;
      bytes += next.byteLength;
    };
    const releaseMeta = release.release_id;
    const flush = (): void => {
      if (currentPath === undefined || currentDoc === undefined) return;
      writeIfChanged(currentPath, currentDoc);
    };

    for (const record of records) {
      if (record.word !== currentWord) {
        flush();
        currentWord = record.word;
        currentPath = contentFilePath(output, record.word);
        const old = existingDocument(currentPath);
        currentDoc = old ?? { schema: "lexema-content/v1" };
        entries = typeof currentDoc.entries === "object" && currentDoc.entries !== null
          ? currentDoc.entries as Record<string, unknown> : {};
        occurrences = new Map<string, number>();
        words += 1;
      }
      const base = `${record.pos}:${record.pos_title}`;
      const occurrence = (occurrences.get(base) ?? 0) + 1;
      occurrences.set(base, occurrence);
      const key = keyFor(record.pos, record.pos_title, occurrence);
      const rawRow = rawQuery.get(record.record_id) as { raw_json: string } | undefined;
      if (rawRow === undefined) throw new Error(`record ${record.record_id} has no raw JSON`);
      const raw = JSON.parse(rawRow.raw_json) as RawRecord;
      const generated = rawEntry(
        raw, release.release_id, record.line_no, record.line_sha256, key,
        grammarFor(db, record.record_id, release.release_id, record.line_no, record.line_sha256),
      );
      const oldEntry = entries?.[key];
      // Spread first: source-derived fields below are refreshed, while fields
      // Lexema owns (and any future editorial fields) survive conversion.
      if (entries !== undefined) entries[key] = {
        ...(typeof oldEntry === "object" && oldEntry !== null ? oldEntry : {}),
        ...generated,
      };
      if (currentDoc !== undefined && entries !== undefined) {
        const { release: _oldRelease, ...withoutOldRelease } = currentDoc;
        currentDoc = {
          ...withoutOldRelease,
          schema: "lexema-content/v1",
          releaseId: releaseMeta,
          entries,
        };
      }
    }
    flush();
    writeIfChanged(join(output, "manifest.json"), {
      schema: "lexema-content-manifest/v1",
      release: {
        id: release.release_id,
        archiveSha256: release.archive_sha256,
        archiveBytes: release.archive_bytes,
      },
      layout: { language: "it", directoryDepth: 4 },
      words,
      records: records.length,
    });
    return { files: changedFiles, words, records: records.length, bytes };
  } finally {
    db.close();
  }
}
