// The tables and views a master needs before a change can be applied to it
// (#18), and the page-entry tables lookups read (ADR 0024, #403), for a
// dictionary seeded before they existed. They are read out of
// src/db/schema.sql rather than written a second time, so a fresh seed and an
// upgraded master cannot drift apart. The statements are safe to run again:
// the tables are created only when absent, and the views are replaced.

import { PAGE_ENTRY_TABLES } from "../lookup/served.js";

/** The tables #18 added, in the order their foreign keys need. */
export const UPDATE_TABLES = ["feed_release", "applied_change"] as const;

/**
 * The page-entry tables (ADR 0024), in the order their foreign keys need. The
 * upgrade creates them empty; lookups serve a master without them as one with
 * no page-only entries (src/lookup/served.ts), so the upgrade is not needed
 * to serve, only to load entries later.
 */
export { PAGE_ENTRY_TABLES };

/** The indexes on the page-entry tables. */
export const PAGE_ENTRY_INDEXES = ["recovered_entry_by_key"] as const;

/** Every view that reads through them, each after the views it reads. */
export const SERVING_VIEWS = ["served_release", "served_record", "form_of_candidate", "surface_hit"] as const;

/** Every table, index and view the upgrade creates, by its sqlite_schema name. */
export const UPGRADE_NAMES: readonly string[] = [...UPDATE_TABLES, ...PAGE_ENTRY_TABLES, ...PAGE_ENTRY_INDEXES, ...SERVING_VIEWS];

/** The text of a statement up to the semicolon that ends it, without trailing comments. */
function statementFrom(schema: string, start: number): string {
  const lines: string[] = [];
  for (const line of schema.slice(start).split("\n")) {
    lines.push(line);
    const code = line.replace(/--.*$/, "").trimEnd();
    if (code.endsWith(";")) return lines.join("\n");
  }
  throw new Error("a statement in schema.sql has no closing semicolon");
}

/** The `CREATE <kind> <name>` statement of schema.sql, exactly as written there. */
export function createStatement(schema: string, kind: "TABLE" | "VIEW" | "INDEX", name: string): string {
  const pattern = new RegExp(`^CREATE ${kind} ${name}\\b`, "m");
  const found = pattern.exec(schema);
  if (found === null) throw new Error(`schema.sql has no CREATE ${kind} ${name}`);
  return statementFrom(schema, found.index);
}

/**
 * SQL that brings a master seeded from an older schema.sql to this one's
 * tables and views for applied changes and its empty page-entry tables, and
 * leaves an up-to-date one as it is. It adds no row and changes none.
 */
export function masterUpgradeSql(schema: string): string {
  const tables = [...UPDATE_TABLES, ...PAGE_ENTRY_TABLES].map((name) =>
    createStatement(schema, "TABLE", name).replace(/^CREATE TABLE /, "CREATE TABLE IF NOT EXISTS "),
  );
  const indexes = PAGE_ENTRY_INDEXES.map((name) =>
    createStatement(schema, "INDEX", name).replace(/^CREATE INDEX /, "CREATE INDEX IF NOT EXISTS "),
  );
  const drops = [...SERVING_VIEWS].reverse().map((name) => `DROP VIEW IF EXISTS ${name};`);
  const views = SERVING_VIEWS.map((name) => createStatement(schema, "VIEW", name));
  return [
    "-- The tables and views for changes applied from a later release, and the empty page-entry tables (src/update/masterUpgrade.ts).",
    ...tables,
    ...indexes,
    ...drops,
    ...views,
    "",
  ].join("\n");
}
