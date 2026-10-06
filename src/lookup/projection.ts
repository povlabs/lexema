// A record's archive line as a lookup reads it, cut down in SQL before it
// leaves the database (#646). D1 bills a Worker's CPU by the bytes it returns
// as well as by the calls, and a page reads only a few fields of each line:
// `sale`'s lines are mostly forms, translations and categories nobody reads.
//
// The cut has the meaning `readContent` gives a `ReadFields` (src/update/content.ts):
// an object keeps only the fields named, each list keeps every item, and a
// value not shaped as named is kept as it is. A reader that asks only for
// named fields reads the cut line exactly as it reads the whole line, every
// list index and so every JSON pointer included. The stored line is never
// touched; only what one statement returns is smaller.

import type { FieldRead, ReadFields } from "../update/content.js";

/** A field name the SQL can carry as a literal: what kaikki names its fields. */
const FIELD_NAME = /^[a-z_]+$/;

/**
 * The SQL of `json`, a JSON text expression, cut down to `fields`. `depth`
 * keeps each nested `json_each` alias its own.
 */
export function projectedJsonSql(json: string, fields: ReadFields, depth = 0): string {
  const names = Object.keys(fields);
  for (const name of names) if (!FIELD_NAME.test(name)) throw new Error(`not a field name: ${name}`);
  const field = `f${depth}`;
  // `json_quote` gives each member as JSON text, a string member included,
  // which `json_each` returns as plain SQL text.
  const member = `json_quote(${field}.value)`;
  const cases = Object.entries(fields)
    .filter(([, how]) => how !== "whole")
    .map(([name, how]) => `WHEN '${name}' THEN ${fieldReadSql(member, how, depth + 1)}`);
  const value = cases.length === 0 ? member : `CASE ${field}.key ${cases.join(" ")} ELSE ${member} END`;
  return `CASE json_type(${json}) WHEN 'object' THEN (SELECT json_group_object(${field}.key, json(${value})) FROM json_each(${json}) ${field} WHERE ${field}.key IN (${names.map((name) => `'${name}'`).join(", ")})) ELSE ${json} END`;
}

/** The SQL of one field's value cut down as `how` reads it: whole, or each item of a list. */
function fieldReadSql(json: string, how: FieldRead, depth: number): string {
  if (how === "whole") return json;
  const item = `i${depth}`;
  return `CASE json_type(${json}) WHEN 'array' THEN (SELECT json_group_array(json(${projectedJsonSql(`json_quote(${item}.value)`, how.each, depth + 1)})) FROM json_each(${json}) ${item}) ELSE ${json} END`;
}
