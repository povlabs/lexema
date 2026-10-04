// After a deploy writes, a fixed list of words is looked up against the
// dictionary it wrote (#456), through the same `lookup` the site runs. Each
// word must be found with at least one reading; any other answer, or a lookup
// that throws, is a mismatch and turns the run red. Each declaration's own
// `lookups` are looked up the same way and held to what it asks (#554).

import { literal } from "../import/seedSql.js";
import { readOnly, type LookupDatabase, type SqlValue } from "../lookup/database.js";
import { lookup } from "../lookup/lookup.js";
import { everyRecovered, type LookupResult } from "../lookup/types.js";
import type { ChangeDeclaration, DeclaredLookup } from "../update/declaration.js";
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

/**
 * Why `result` is not what `declared` asks, or undefined when it is. A gloss
 * is held to every sense's glosses and every recovered definition, since a
 * page-only entry (ADR 0024) has no senses and states its definitions there.
 */
export function declaredMiss(declared: DeclaredLookup, result: LookupResult): string | undefined {
  if (declared.expect === "not-found") return result.outcome === "found" ? "found, declared not found" : undefined;
  if (result.outcome !== "found" || result.readings.length === 0) return `${result.outcome}, not found with a reading`;
  const { gloss } = declared;
  if (gloss === null) return undefined;
  const texts = result.readings.flatMap((reading) => [...reading.senses.flatMap((sense) => sense.glosses.map(({ text }) => text)), ...everyRecovered(reading).map(({ text }) => text)]);
  return texts.some((text) => text.includes(gloss)) ? undefined : `found, but no definition holds ${JSON.stringify(gloss)}`;
}

/** Look up each of `queries` in the master `reader` reads, through the site's `lookup`; each answer `miss` names, or a lookup that failed, as a mismatch. */
async function lookUpEach<Query>(
  reader: MasterReader,
  queries: readonly Query[],
  wordOf: (query: Query) => string,
  miss: (query: Query, result: LookupResult) => string | undefined,
  named: (query: Query) => string,
): Promise<string[]> {
  const { releaseId } = readMasterRelease(reader);
  const db = lookupDatabaseOf(reader);
  const mismatches: string[] = [];
  for (const query of queries) {
    try {
      const why = miss(query, await lookup({ db, releaseId, query: wordOf(query) }));
      if (why !== undefined) mismatches.push(`${named(query)}: ${why}`);
    } catch (error: unknown) {
      mismatches.push(`${named(query)}: the lookup failed (${error instanceof Error ? error.message : String(error)})`);
    }
  }
  return mismatches;
}

/** Look up `words` in the master `reader` reads; each word not found, or whose lookup failed, as a mismatch. */
export function lookUpWords(reader: MasterReader, words: readonly string[] = WORD_LIST): Promise<string[]> {
  return lookUpEach(reader, words, (word) => word, (word, result) => declaredMiss({ word, expect: "found", gloss: null }, result), (word) => word);
}

/** Look up every word `declarations` name in their `lookups`; each answer that is not what its declaration asks, or whose lookup failed, as a mismatch naming the file and the word. */
export function lookUpDeclaredWords(reader: MasterReader, declarations: readonly Pick<ChangeDeclaration, "file" | "lookups">[]): Promise<string[]> {
  const declared = declarations.flatMap(({ file, lookups = [] }) => lookups.map((lookup) => ({ file, lookup })));
  if (declared.length === 0) return Promise.resolve([]);
  return lookUpEach(reader, declared, ({ lookup }) => lookup.word, ({ lookup }, result) => declaredMiss(lookup, result), ({ file, lookup }) => `${file}: ${lookup.word}`);
}
