// What a source line says, apart from how its bytes are laid out (#18). Two
// kaikki builds can write the same record with its keys in another order; the
// diff compares records by content, so that is no change, while a gloss that
// reads differently is.

import { createHash } from "node:crypto";

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

/** The digest of a line's content: equal for two lines that say the same, whatever their key order. */
export function contentSha256(line: string): string {
  return sha256(canonicalJson(JSON.parse(line)));
}

/** The top-level fields whose content differs between two lines of one record, in name order. */
export function changedFields(before: string, after: string): string[] {
  const left = JSON.parse(before) as Record<string, unknown>;
  const right = JSON.parse(after) as Record<string, unknown>;
  return [...new Set([...Object.keys(left), ...Object.keys(right)])]
    .filter((field) => canonicalJson(left[field]) !== canonicalJson(right[field]))
    .sort();
}
