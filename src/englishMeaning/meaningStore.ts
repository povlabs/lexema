// How English meanings are stored (#933): the `english_meaning` table of
// src/db/schema.sql, one row per headword and definition hash. It is written
// only here and read back only here; nothing writes `translations` or any
// imported row.

import { literal } from "../import/seedSql.js";
import { keyText, type GeneratedMeaning, type MeaningKey } from "./englishMeaning.js";

export const MEANING_TABLE = "english_meaning";

/** A meaning a model made, with the provenance its row carries (ADR 0035, rule 7). */
export interface StoredMeaning {
  readonly key: MeaningKey;
  readonly meaning: GeneratedMeaning;
  readonly model: string;
  readonly promptVersion: string;
  /** ISO-8601 in UTC: `2026-11-16T17:40:00.000Z`. */
  readonly generatedAt: string;
  readonly batchId: string;
}

/** A row as the table returns it. */
export interface MeaningRow {
  headword: string;
  definition_sha256: string;
  english: string;
  origin: "picked" | "written";
  model: string;
  prompt_version: string;
  generated_at: string;
  batch_id: string;
}

const COLUMNS = ["headword", "definition_sha256", "english", "origin", "model", "prompt_version", "generated_at", "batch_id"] as const;

/**
 * One transaction's SQL writing `meanings`. A key already held keeps its row:
 * collecting a batch twice writes nothing the second time, and a meaning is
 * replaced only by deleting it, never by a later run.
 */
export function insertSql(meanings: readonly StoredMeaning[]): string {
  if (meanings.length === 0) return "";
  const rows = meanings.map((stored) =>
    [stored.key.headword, stored.key.definitionSha256, stored.meaning.english, stored.meaning.origin, stored.model, stored.promptVersion, stored.generatedAt, stored.batchId]
      .map((value) => literal(value))
      .join(", "),
  );
  return `INSERT INTO ${MEANING_TABLE} (${COLUMNS.join(", ")}) VALUES\n  (${rows.join("),\n  (")})\nON CONFLICT (headword, definition_sha256) DO NOTHING;\n`;
}

/** The SELECT for the rows of `headwords`. */
export const rowsOfHeadwordsSql = (headwords: readonly string[]): string =>
  `SELECT ${COLUMNS.join(", ")} FROM ${MEANING_TABLE} WHERE headword IN (SELECT value FROM json_each(${literal(JSON.stringify([...headwords]))})) ORDER BY headword, definition_sha256`;

/** The rows by key, for finding the senses that already have a meaning. */
export const byKey = (rows: readonly MeaningRow[]): Map<string, MeaningRow> =>
  new Map(rows.map((row) => [keyText({ headword: row.headword, definitionSha256: row.definition_sha256 }), row]));
