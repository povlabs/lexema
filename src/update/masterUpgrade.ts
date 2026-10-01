// The tables and views a master needs before a change can be applied to it
// (#18), for a dictionary seeded before they existed. They are read out of
// src/db/schema.sql rather than written a second time, so a fresh seed and an
// upgraded master cannot drift apart. The statements are safe to run again:
// the tables are created only when absent, and the views are replaced.

/** The tables #18 added, in the order their foreign keys need. */
export const UPDATE_TABLES = ["feed_release", "applied_change"] as const;

/** Every view that reads through them, each after the views it reads. */
export const SERVING_VIEWS = ["served_release", "served_record", "form_of_candidate", "surface_hit"] as const;

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
export function createStatement(schema: string, kind: "TABLE" | "VIEW", name: string): string {
  const pattern = new RegExp(`^CREATE ${kind} ${name}\\b`, "m");
  const found = pattern.exec(schema);
  if (found === null) throw new Error(`schema.sql has no CREATE ${kind} ${name}`);
  return statementFrom(schema, found.index);
}

/**
 * SQL that brings a master seeded from an older schema.sql to this one's
 * tables and views for applied changes, and leaves an up-to-date one as it is.
 * It adds no row and changes none.
 */
export function masterUpgradeSql(schema: string): string {
  const tables = UPDATE_TABLES.map((name) => createStatement(schema, "TABLE", name).replace(/^CREATE TABLE /, "CREATE TABLE IF NOT EXISTS "));
  const drops = [...SERVING_VIEWS].reverse().map((name) => `DROP VIEW IF EXISTS ${name};`);
  const views = SERVING_VIEWS.map((name) => createStatement(schema, "VIEW", name));
  return [
    "-- The tables and views for changes applied from a later release (src/update/masterUpgrade.ts).",
    ...tables,
    ...drops,
    ...views,
    "",
  ].join("\n");
}
