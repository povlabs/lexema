// The D1 adapter sends the statements of one turn as one call (#385): on D1
// each call is a network round trip, and a lookup's independent reads are
// dozens of statements.

import assert from "node:assert/strict";
import test from "node:test";
import { fromD1, type D1Like, type D1StatementLike, type SqlValue } from "../src/lookup/database.js";

/** A D1 that answers each statement with its own SQL and parameters, and records every call made to it. */
function recordingD1(fail?: string): { db: D1Like; calls: string[][] } {
  const calls: string[][] = [];
  const statement = (sql: string, params: SqlValue[]): D1StatementLike & { text: string } => ({
    text: [sql, ...params].join(" "),
    bind: (...bound) => statement(sql, bound),
    all: async <T>() => {
      calls.push([[sql, ...params].join(" ")]);
      return { results: [{ text: [sql, ...params].join(" ") }] as T[] };
    },
  });
  const db: D1Like = {
    prepare: (sql) => statement(sql, []),
    batch: async (statements) => {
      const texts = statements.map((one) => (one as ReturnType<typeof statement>).text);
      calls.push(texts);
      if (fail !== undefined && texts.includes(fail)) throw new Error(`D1 refused ${fail}`);
      return texts.map((text) => ({ results: [{ text }] }));
    },
  };
  return { db, calls };
}

test("statements sent before the caller waits go to D1 as one batch, each answered with its own rows", async () => {
  const { db, calls } = recordingD1();
  const reader = fromD1(db);
  const answers = await Promise.all([
    reader.all<{ text: string }>("SELECT 1", []),
    reader.all<{ text: string }>("SELECT ?", ["a"]),
    reader.all<{ text: string }>("SELECT ?", ["b"]),
  ]);
  assert.deepEqual(answers, [[{ text: "SELECT 1" }], [{ text: "SELECT ? a" }], [{ text: "SELECT ? b" }]]);
  assert.deepEqual(calls, [["SELECT 1", "SELECT ? a", "SELECT ? b"]]);
});

test("a statement that needs another's rows goes in a later call, and a lone statement is sent without a batch", async () => {
  const { db, calls } = recordingD1();
  const reader = fromD1(db);
  const [first] = await reader.all<{ text: string }>("SELECT ?", ["first"]);
  await Promise.all([reader.all("SELECT ?", [first.text]), reader.all("SELECT 2", [])]);
  assert.deepEqual(calls, [["SELECT ? first"], ["SELECT ? SELECT ? first", "SELECT 2"]]);
});

test("a batch D1 refuses fails every statement sent with it, and the next call is its own", async () => {
  const { db, calls } = recordingD1("SELECT 2");
  const reader = fromD1(db);
  const sent = [reader.all("SELECT 1", []), reader.all("SELECT 2", [])];
  for (const one of sent) await assert.rejects(one, /D1 refused SELECT 2/);
  assert.deepEqual(await reader.all("SELECT 3", []), [{ text: "SELECT 3" }]);
  assert.deepEqual(calls, [["SELECT 1", "SELECT 2"], ["SELECT 3"]]);
});
