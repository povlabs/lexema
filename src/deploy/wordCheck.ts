// After a deploy writes, a fixed list of words is looked up against the
// dictionary it wrote (#456), through the same `lookup` the site runs. Each
// word must be found with at least one reading; any other answer, or a lookup
// that throws, is a mismatch and turns the run red.

import { literal } from "../import/seedSql.js";
import { readOnly, type LookupDatabase, type SqlValue } from "../lookup/database.js";
import { lookup } from "../lookup/lookup.js";
import { readMasterRelease, type MasterReader } from "../update/master.js";

/**
 * Common words of each kind the dictionary serves: nouns, verbs, an
 * adjective, and an inflected form found through its lemma.
 */
export const WORD_LIST = ["casa", "andare", "raccontare", "bello", "studente", "andavano"] as const;

/**
 * `sql` with each parameter written in as a literal: `?NNN` takes the
 * NNN-th, and a bare `?` the one after the highest taken so far, as SQLite
 * numbers them. A `?` inside a quoted string is left as it is.
 */
export function inlineParameters(sql: string, params: readonly SqlValue[]): string {
  let out = "";
  let highest = 0;
  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    // A quoted string or identifier, or a comment, is copied whole: a `?` in it is no parameter.
    const close = char === "'" || char === '"' ? char : sql.startsWith("--", i) ? "\n" : sql.startsWith("/*", i) ? "*/" : undefined;
    if (close !== undefined) {
      const end = sql.indexOf(close, i + 1);
      const stop = end === -1 ? sql.length : end + close.length;
      if (end === -1 && close !== "\n") throw new Error(`an unclosed ${char} in ${sql.slice(0, 60)}`);
      out += sql.slice(i, stop);
      i = stop - 1;
      continue;
    }
    if (char !== "?") {
      out += char;
      continue;
    }
    const digits = /^\d+/.exec(sql.slice(i + 1))?.[0];
    const index = digits === undefined ? highest + 1 : Number(digits);
    if (index < 1 || index > params.length) throw new Error(`parameter ?${index} has no value: ${params.length} given`);
    highest = Math.max(highest, index);
    out += literal(params[index - 1]);
    i += digits?.length ?? 0;
  }
  return out;
}

/** The dictionary `reader` reads, as the lookup's read-only database: every statement one SELECT. */
export function lookupDatabaseOf(reader: MasterReader): LookupDatabase {
  return {
    all<T>(sql: string, params: readonly SqlValue[]): Promise<T[]> {
      try {
        // Checked as one SELECT before the values go in, so a value is never read as SQL.
        return Promise.resolve(reader.query<T>(inlineParameters(readOnly(sql), params)));
      } catch (failure) {
        return Promise.reject(failure);
      }
    },
  };
}

/** Look up `words` in the master `reader` reads; each word not found, or whose lookup failed, as a mismatch. */
export async function lookUpWords(reader: MasterReader, words: readonly string[] = WORD_LIST): Promise<string[]> {
  const { releaseId } = readMasterRelease(reader);
  const db = lookupDatabaseOf(reader);
  const mismatches: string[] = [];
  for (const word of words) {
    try {
      const result = await lookup({ db, releaseId, query: word });
      if (result.outcome !== "found" || result.readings.length === 0) mismatches.push(`${word}: ${result.outcome}, not found with a reading`);
    } catch (error: unknown) {
      mismatches.push(`${word}: the lookup failed (${error instanceof Error ? error.message : String(error)})`);
    }
  }
  return mismatches;
}
