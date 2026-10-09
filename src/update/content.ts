// What a source line says to Lexema, apart from how its bytes are laid out and
// apart from the fields Lexema never reads (#18, #369). Two kaikki builds can
// write the same record with its keys in another order, or add a field to
// every record (`etymology_links`, September 2026); the diff compares records
// by content, so neither is a change, while a gloss that reads differently is.

import { createHash } from "node:crypto";

/**
 * How Lexema reads one field: the whole value, or, for a list of objects, the
 * named fields of each item. Every item is kept, read field or none, because a
 * reader counts them (`forms.length`, `examples.length`).
 */
export type FieldRead = "whole" | { readonly each: ReadFields };

/** The fields of one object Lexema reads, by name. */
export type ReadFields = { readonly [field: string]: FieldRead };

/**
 * Every field of a kaikki record Lexema reads, and nothing else. The importer
 * (`writeRecord`, src/import/importRelease.ts), the seed's suggestion ranking
 * (`addLemmaRecord`, src/import/seedSql.ts), the selection rule
 * (src/update/selection.ts) and a lookup's read of the archive line
 * (src/lookup/sourceRecord.ts) read these; the admission test reads
 * `lang_code`. test/readFields.test.ts runs every one of those readers and
 * fails when one reads a field this list leaves out, or this list names a
 * field none of them reads. Huey's ruling on #369 sets the rule: a field
 * Lexema never reads is no change, whether or not a release changes it.
 */
export const READ_FIELDS = {
  lang_code: "whole",
  word: "whole",
  pos: "whole",
  pos_title: "whole",
  tags: "whole",
  raw_tags: "whole",
  forms: { each: { form: "whole", tags: "whole", raw_tags: "whole", source: "whole" } },
  senses: {
    each: {
      glosses: "whole",
      tags: "whole",
      raw_tags: "whole",
      form_of: { each: { word: "whole" } },
      examples: { each: { text: "whole" } },
    },
  },
  sounds: { each: { ipa: "whole", sense: "whole" } },
  hyphenations: { each: { parts: "whole" } },
  etymology_texts: "whole",
  synonyms: { each: { word: "whole", raw_tags: "whole" } },
  antonyms: { each: { word: "whole" } },
  derived: { each: { word: "whole" } },
  proverbs: { each: { word: "whole", sense: "whole" } },
  translations: { each: { lang_code: "whole", lang: "whole", word: "whole", sense: "whole" } },
} as const satisfies ReadFields;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * `value` with only the fields `fields` names. A value not shaped the way a
 * reader expects is kept as it is, so a change to it is still a change: a
 * `forms` that is not a list, an item that is not an object.
 */
function readOf(value: unknown, fields: ReadFields): unknown {
  if (!isObject(value)) return value;
  const read: Record<string, unknown> = {};
  for (const [field, how] of Object.entries(fields)) {
    if (!Object.hasOwn(value, field)) continue;
    const member = value[field];
    read[field] = how === "whole" || !Array.isArray(member) ? member : member.map((item) => readOf(item, how.each));
  }
  return read;
}

/** A record's parsed line as Lexema reads it: only the fields `READ_FIELDS` names. */
export function readContent(record: unknown): unknown {
  return readOf(record, READ_FIELDS);
}

/** Every field `READ_FIELDS` names, as a path: `senses[].form_of[].word`. */
export function readFieldPaths(fields: ReadFields = READ_FIELDS, prefix = ""): string[] {
  return Object.entries(fields).flatMap(([field, how]) =>
    how === "whole" ? [`${prefix}${field}`] : readFieldPaths(how.each, `${prefix}${field}[].`),
  );
}

/** A JSON value's text with every object's keys sorted, arrays kept in order. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, member]) => `${JSON.stringify(key)}:${canonicalJson(member)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

const sha256 = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");

/**
 * The digest of a line's content: equal for two lines that say the same to
 * Lexema, whatever their key order and whatever fields it never reads.
 */
export function contentSha256(line: string): string {
  return sha256(canonicalJson(readContent(JSON.parse(line))));
}

/** The top-level read fields whose content differs between two lines of one record, in name order. */
export function changedFields(before: string, after: string): string[] {
  const left = readContent(JSON.parse(before)) as Record<string, unknown>;
  const right = readContent(JSON.parse(after)) as Record<string, unknown>;
  return [...new Set([...Object.keys(left), ...Object.keys(right)])]
    .filter((field) => canonicalJson(left[field]) !== canonicalJson(right[field]))
    .sort();
}
