import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  parseArchive,
  validateArchiveRecord,
  type ArchiveRecord,
  type ArchiveParseReport,
  type Rejection,
} from "../import/importRelease.js";
import {
  expectedFormDimensions,
  expectedRecordDimensions,
  mapRawTag,
  mapStructuralTag,
} from "../import/grammarPolicy.js";

export interface ConversionOptions {
  input?: string;
  output?: string;
  releaseId?: string;
  onRejection?: (rejection: Rejection) => void;
}

export interface ConversionReport {
  files: number;
  words: number;
  records: number;
  bytes: number;
  linesRead: number;
  skippedOtherLanguage: number;
  malformed: number;
  malformedMembers: number;
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
  const letter = (char: string | undefined): string => {
    if (char === undefined || !/^\p{L}$/u.test(char)) return "_";
    // Some filesystems case-fold letters that are distinct Unicode code points
    // (for example `ſ` and `s`). Encode those directory components so word
    // paths remain injective there too; ordinary letters stay readable.
    const folded = char.toLocaleUpperCase("it-IT").toLocaleLowerCase("it-IT");
    return folded === char ? char : encodeURIComponent(char);
  };
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

function grammarFor(record: ArchiveRecord["record"], releaseId: string, lineNo: number, lineSha256: string): unknown {
  const source = (pointer: string) => ref(releaseId, lineNo, lineSha256, pointer);
  const claims: Array<Record<string, unknown>> = [];
  const addClaims = (
    scope: "record" | "form" | "sense",
    scopeIndex: number | null,
    container: string,
    tags: unknown,
    rawTags: unknown,
    tagsPointer: string,
    rawTagsPointer: string,
    expected: readonly string[],
  ): void => {
    const stated = new Set<string>();
    stringValues(tags, tagsPointer, source).forEach((item) => {
      const mapped = mapStructuralTag(item.value);
      claims.push({
        scope, scopeIndex, jsonPointer: item.source.pointer,
        status: mapped.status, ...(mapped.status === "stated" ? { dimension: mapped.dimension, value: mapped.value } : {}),
        ...(mapped.status === "stated" ? { sourceText: mapped.sourceText } : { sourceText: mapped.sourceText }),
        source: item.source,
      });
      if (mapped.status === "stated") stated.add(mapped.dimension);
    });
    stringValues(rawTags, rawTagsPointer, source).forEach((item) => {
      const mapped = mapRawTag(item.value);
      claims.push({ scope, scopeIndex, jsonPointer: item.source.pointer, status: "unclassified", sourceText: mapped.sourceText, source: item.source });
    });
    for (const dimension of expected) {
      if (!stated.has(dimension)) claims.push({ scope, scopeIndex, jsonPointer: container, status: "missing", dimension, source: source(container) });
    }
  };
  addClaims("record", null, "", record.tags, record.raw_tags, "/tags", "/raw_tags", expectedRecordDimensions(record.pos));
  record.forms.forEach((form, index) => {
    const tags = stringValues(form.tags, `/forms/${index}/tags`, source);
    const stated = new Set(tags.flatMap((item) => {
      const mapped = mapStructuralTag(item.value);
      return mapped.status === "stated" ? [mapped.dimension] : [];
    }));
    addClaims("form", index, `/forms/${index}`, form.tags, form.raw_tags, `/forms/${index}/tags`, `/forms/${index}/raw_tags`, expectedFormDimensions(record.pos, stated));
  });
  record.senses.forEach((sense, index) => {
    stringValues(sense.raw_tags, `/senses/${index}/raw_tags`, source).forEach((item) => {
      const mapped = mapRawTag(item.value);
      claims.push({ scope: "sense", scopeIndex: index, jsonPointer: item.source.pointer, status: "unclassified", sourceText: mapped.sourceText, source: item.source });
    });
  });
  const clean = ({ scope: _scope, scopeIndex: _scopeIndex, jsonPointer: _jsonPointer, ...claim }: Record<string, unknown>) => claim;
  return {
    record: claims.filter((claim) => claim.scope === "record").map(clean),
    senses: claims.filter((claim) => claim.scope === "sense").map((claim) => ({ index: claim.scopeIndex, claim: clean(claim) })),
    forms: claims.filter((claim) => claim.scope === "form").map((claim) => ({ index: claim.scopeIndex, claim: clean(claim) })),
  };
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

function keyPart(value_: string): string {
  // Keep ordinary keys readable while escaping every delimiter and escape byte.
  // This makes a literal title such as `X#2` distinct from a generated suffix.
  return value_.replaceAll("%", "%25").replaceAll(":", "%3A").replaceAll("#", "%23");
}

export function contentKey(pos: string, posTitle: string, occurrence: number): string {
  const base = `${keyPart(pos)}:${keyPart(posTitle)}`;
  return occurrence === 1 ? base : `${base}#${occurrence}`;
}

export function assertUniqueContentKeys(keys: readonly string[], word: string): void {
  const seen = new Set<string>();
  for (const key of keys) {
    if (seen.has(key)) throw new Error(`duplicate content key ${key} for ${word}`);
    seen.add(key);
  }
}

const generatedEntryFields = new Set([
  "key", "sourceLineSha256", "word", "pos", "posTitle", "tags", "rawTags",
  "senses", "forms", "grammar",
]);

function editorialPart(entry: unknown): Record<string, unknown> | undefined {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return undefined;
  const fields = Object.fromEntries(Object.entries(entry).filter(([name]) => !generatedEntryFields.has(name)));
  return Object.keys(fields).length === 0 ? undefined : fields;
}

function entriesOf(document: Record<string, unknown>, name: "entries" | "orphanedEntries"): Record<string, unknown> {
  const entries = document[name];
  if (entries === undefined) return {};
  if (typeof entries === "object" && entries !== null && !Array.isArray(entries)) {
    return entries as Record<string, unknown>;
  }
  throw new Error(`${name} must be an object`);
}

function existingDocument(path: string): { [key: string]: unknown } | undefined {
  if (!existsSync(path)) return undefined;
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
    return parsed as { [key: string]: unknown };
  }
  throw new Error(`content file ${path} is not a JSON object`);
}

function contentFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const item of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, item.name);
      if (item.isDirectory()) visit(path);
      else if (item.isFile() && item.name.endsWith(".json")) files.push(path);
    }
  };
  visit(root);
  return files;
}

/** Convert the archive directly into deterministic, editable content files. */
export async function convertRelease(options: ConversionOptions = {}): Promise<ConversionReport> {
  const input = resolve(options.input ?? "it-extract.jsonl.gz");
  const output = resolve(options.output ?? "content");
  let releaseId = options.releaseId;
  let archive: ArchiveParseReport | undefined;
  // The parser emits records in archive order; one word's records are buffered
  // only long enough to apply the established stable ordering.

  let currentWord: string | undefined;
    let currentPath: string | undefined;
    let currentDoc: Record<string, unknown> | undefined;
    let entries: Record<string, unknown> | undefined;
    let oldEntries: Record<string, unknown> = {};
    let occurrences = new Map<string, number>();
    let changedFiles = 0;
    let bytes = 0;
    let words = 0;
    const previousFiles = contentFiles(join(output, "it"));
    const currentPaths = new Set<string>();
    const writeIfChanged = (path: string, doc: Record<string, unknown>): void => {
      const next = Buffer.from(`${JSON.stringify(doc)}\n`, "utf8");
      const previous = existsSync(path) ? readFileSync(path) : undefined;
      if (previous?.equals(next)) return;
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, next);
      changedFiles += 1;
      bytes += next.byteLength;
    };
    let releaseMeta = releaseId ?? "";
    const flush = (): void => {
      if (currentPath === undefined || currentDoc === undefined || entries === undefined) return;
      const orphanedEntries: Record<string, unknown> = {};
      for (const [key, oldEntry] of Object.entries(oldEntries)) {
        if (Object.prototype.hasOwnProperty.call(entries, key)) continue;
        const editorial = editorialPart(oldEntry);
        if (editorial !== undefined) orphanedEntries[key] = editorial;
      }
      const {
        release: _oldRelease,
        status: _oldStatus,
        orphanedFromReleaseId: _oldOrphanedRelease,
        orphanedEntries: _oldOrphanedEntries,
        ...withoutConversionState
      } = currentDoc;
      currentDoc = {
        ...withoutConversionState,
        schema: "lexema-content/v1",
        releaseId: releaseMeta,
        entries,
        ...(Object.keys(orphanedEntries).length === 0 ? {} : { orphanedEntries }),
      };
      writeIfChanged(currentPath, currentDoc);
    };

    const pending: ArchiveRecord[] = [];
    let pendingWord: string | undefined;
    // A word is written once, when its run of records ends, so every record for a
    // word must arrive in one run. The database this replaced sorted by word and
    // guaranteed that; an archive only happens to. A second run would reopen the
    // finished file and drop what the first run wrote, so refuse instead.
    const closedWords = new Set<string>();
    const convertRecord = (record: ArchiveRecord): void => {
      const word = record.record.word;
      if (pendingWord !== undefined && pendingWord !== word) {
        closedWords.add(pendingWord);
        flushPending();
      }
      if (closedWords.has(word)) {
        throw new Error(
          `${word} appears in more than one run of records at line ${record.lineNo}; ` +
            "the archive must keep each word's records together",
        );
      }
      pendingWord = word;
      pending.push(record);
    };
    const flushPending = (): void => {
      const compare = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
      pending.sort((a, b) => compare(a.record.pos, b.record.pos) ||
        compare(a.record.pos_title, b.record.pos_title) ||
        compare(a.lineSha256, b.lineSha256) || a.recordId - b.recordId);
      for (const record of pending.splice(0)) {
        releaseMeta = record.releaseId;
        if (record.record.word !== currentWord) {
          flush();
          currentWord = record.record.word;
          currentPath = contentFilePath(output, record.record.word);
          currentPaths.add(currentPath);
          const old = existingDocument(currentPath);
          currentDoc = old ?? { schema: "lexema-content/v1" };
          oldEntries = { ...entriesOf(currentDoc, "orphanedEntries"), ...entriesOf(currentDoc, "entries") };
          entries = {};
          occurrences = new Map<string, number>();
          words += 1;
        }
        const base = `${record.record.pos}:${record.record.pos_title}`;
        const occurrence = (occurrences.get(base) ?? 0) + 1;
        occurrences.set(base, occurrence);
        const key = contentKey(record.record.pos, record.record.pos_title, occurrence);
        const generated = rawEntry(
          record.record as unknown as RawRecord, record.releaseId, record.lineNo, record.lineSha256, key,
          grammarFor(record.record, record.releaseId, record.lineNo, record.lineSha256),
        );
        const oldEntry = oldEntries[key];
        if (entries === undefined) throw new Error(`entries missing while converting ${record.record.word}`);
        assertUniqueContentKeys([...Object.keys(entries), key], record.record.word);
        entries[key] = {
          ...(typeof oldEntry === "object" && oldEntry !== null ? oldEntry : {}),
          ...generated,
        };
      }
    };
    archive = await parseArchive({
      input,
      releaseId,
      onRejection: options.onRejection ?? (() => {}),
      onRecord: (record, reportMember) => {
        validateArchiveRecord(record.record, reportMember);
        convertRecord(record);
      },
    });
    flushPending();
    flush();

    // Files from the previous release are part of the conversion input too.
    // Remove files whose word disappeared unless they contain editorial text;
    // in that case keep only that text in an explicitly orphaned document.
    for (const path of previousFiles) {
      if (currentPaths.has(path)) continue;
      const old = existingDocument(path);
      if (old === undefined) throw new Error(`content file ${path} is not a JSON object`);
      const orphanedEntries: Record<string, unknown> = {};
      const priorEntries = { ...entriesOf(old, "orphanedEntries"), ...entriesOf(old, "entries") };
      for (const [key, entry] of Object.entries(priorEntries)) {
        const editorial = editorialPart(entry);
        if (editorial !== undefined) orphanedEntries[key] = editorial;
      }
      const rootEditorial = Object.fromEntries(Object.entries(old).filter(([name]) =>
        !["schema", "releaseId", "status", "entries", "orphanedEntries", "orphanedFromReleaseId"].includes(name),
      ));
      if (Object.keys(orphanedEntries).length === 0 && Object.keys(rootEditorial).length === 0) {
        unlinkSync(path);
        changedFiles += 1;
        continue;
      }
      const orphaned: Record<string, unknown> = {
        schema: "lexema-content/v1",
        status: "orphaned",
        ...(typeof old.releaseId === "string" ? { orphanedFromReleaseId: old.releaseId } : {}),
        ...(Object.keys(orphanedEntries).length === 0 ? {} : { orphanedEntries }),
        ...(Object.keys(rootEditorial).length === 0 ? {} : { orphanedFields: rootEditorial }),
      };
      writeIfChanged(path, orphaned);
    }

    if (archive === undefined) throw new Error("archive parser did not return a report");
    writeIfChanged(join(output, "manifest.json"), {
      schema: "lexema-content-manifest/v1",
      release: {
        id: releaseMeta,
        archiveSha256: archive.archiveSha256,
        archiveBytes: archive.archiveBytes,
      },
      layout: { language: "it", directoryDepth: 4 },
      words,
      records: archive.admitted,
    });
    return {
      files: changedFiles,
      words,
      records: archive.admitted,
      bytes,
      linesRead: archive.linesRead,
      skippedOtherLanguage: archive.skippedOtherLanguage,
      malformed: archive.malformed,
      malformedMembers: archive.malformedMembers,
    };
}
