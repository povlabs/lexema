// The dictionary database, read-only, and the two adapters that provide it: a
// Worker's D1 (async) and a local `node:sqlite` file (sync). One query layer
// instead of two — see docs/LOOKUP_DESIGN.md.
//
// Production and every Preview share one dictionary D1, so code never writes
// through it (ADR 0018). The app tables live in their own database, `APP_DB`,
// reached through Drizzle (src/db/app/database.ts).

import type { DatabaseSync } from "node:sqlite";

/** A value bound to a `?`; `null` is SQL NULL. */
export type SqlValue = string | number | null;

/**
 * The one kind of statement the dictionary runs: a single SELECT. A write
 * (`INSERT`, `UPDATE`, `DELETE`) or DDL does not type-check as one, and
 * `readOnly` refuses it again at run time, for a string built on the fly.
 */
export type DictionaryRead = `SELECT${string}`;

/**
 * The dictionary binding: every statement lookup performs, and nothing that
 * writes. Deliberately the smallest surface that works.
 */
export interface LookupDatabase {
  all<T>(sql: DictionaryRead, params: readonly SqlValue[]): Promise<T[]>;
  /**
   * The rows `read` answers for `keys`, grouped as `rowsOfKeys` groups them.
   * An adapter that has it may answer the keys of many callers with one
   * statement (`fromD1`); one without it is reached through `all`, one
   * statement per call (`readKeys`).
   */
  allOfKeys?<T>(read: KeyedRead, keys: readonly SqlValue[], params: readonly SqlValue[]): Promise<T[]>;
}

/**
 * A read of any number of keys in one statement (#393): `?1` binds the keys
 * as one JSON array, read as `IN (SELECT value FROM json_each(?1))`, the other
 * parameters follow it, and every row names the key it answers as `set_key`.
 * A lookup asks it about one record at a time, and on D1 the records asked
 * about in one wait go out as one statement instead of one each.
 */
export type KeyedRead = DictionaryRead & { readonly [keyedBrand]: true };
declare const keyedBrand: unique symbol;

/** A row of a `KeyedRead`: the key it answers, beside the columns the read names. */
interface KeyedRow {
  set_key: SqlValue;
}

/** `sql` as a `KeyedRead`, or a refusal when it is not shaped as one. */
export function keyedRead(sql: string): KeyedRead {
  const read = readOnly(sql);
  if (!read.includes("json_each(?1)") || !/\bAS set_key\b/.test(read)) {
    throw new Error(`a keyed read binds its keys as json_each(?1) and names each row's key as set_key: ${read.slice(0, 60)}`);
  }
  return read as KeyedRead;
}

/**
 * The rows of `keys` among `rows`, grouped by key in the order the keys are
 * given, each key's rows in the statement's own order. Grouped the same way
 * whichever adapter answered, so one caller's rows never depend on which
 * other callers' keys shared its statement.
 */
export function rowsOfKeys<T>(rows: readonly unknown[], keys: readonly SqlValue[]): T[] {
  const byKey = new Map<SqlValue, T[]>();
  for (const row of rows as (T & KeyedRow)[]) {
    const same = byKey.get(row.set_key);
    if (same === undefined) byKey.set(row.set_key, [row]);
    else same.push(row);
  }
  return keys.flatMap((key) => byKey.get(key) ?? []);
}

/** The rows `read` answers for `keys`: no statement for no keys, and each key asked once. */
export async function readKeys<T>(
  db: LookupDatabase,
  read: KeyedRead,
  keys: readonly SqlValue[],
  params: readonly SqlValue[] = [],
): Promise<T[]> {
  if (keys.length === 0) return [];
  const distinct = [...new Set(keys)];
  if (db.allOfKeys !== undefined) return db.allOfKeys<T>(read, distinct, params);
  return rowsOfKeys<T>(await db.all<unknown>(read, [JSON.stringify(distinct), ...params]), distinct);
}

/** Why a statement was refused before it reached the dictionary. */
export class DictionaryWriteRefused extends Error {
  constructor(sql: string) {
    super(`the dictionary database is read-only; refused: ${sql.trim().slice(0, 60)}`);
    this.name = "DictionaryWriteRefused";
  }
}

/**
 * The statement, when it is one SELECT; otherwise a refusal. A SELECT cannot
 * change a row in SQLite, and a second statement after a `;` is refused
 * outright, so nothing past this check writes.
 */
export function readOnly(sql: string): DictionaryRead {
  const body = sql.trimEnd().replace(/;$/, "");
  if (!/^SELECT\s/i.test(body) || body.includes(";")) throw new DictionaryWriteRefused(sql);
  return body as DictionaryRead;
}

/** Local SQLite, for the importer's output and for tests. */
export function fromNodeSqlite(db: DatabaseSync): LookupDatabase {
  return {
    all<T>(sql: DictionaryRead, params: readonly SqlValue[]): Promise<T[]> {
      try {
        return Promise.resolve(db.prepare(readOnly(sql)).all(...(params as SqlValue[])) as T[]);
      } catch (failure) {
        return Promise.reject(failure);
      }
    },
  };
}

/** The slice of Cloudflare's D1Database this adapter uses. */
export interface D1Like {
  prepare(sql: string): D1StatementLike;
  batch(statements: D1StatementLike[]): Promise<{ results: unknown[] }[]>;
}
export interface D1StatementLike {
  bind(...params: SqlValue[]): D1StatementLike;
  all<T>(): Promise<{ results: T[] }>;
}

/** A read waiting for the next call to D1, and who is waiting on its rows. */
type Queued = (
  | { kind: "all"; sql: DictionaryRead; params: readonly SqlValue[] }
  | { kind: "keys"; sql: KeyedRead; keys: readonly SqlValue[]; params: readonly SqlValue[] }
) & {
  resolve: (rows: unknown[]) => void;
  reject: (failure: unknown) => void;
};

/** One statement of a call to D1, and the reads it answers. */
interface Sent {
  sql: DictionaryRead;
  params: readonly SqlValue[];
  /** The keys of a keyed read, every waiter's, each once. */
  keys?: Set<SqlValue>;
  waiting: Queued[];
}

/**
 * The statements one call sends for `queued`. Reads of the same statement
 * with the same parameters are one statement, and keyed reads of the same
 * statement with the same other parameters are one statement over all their
 * keys (#393): a page that reads twenty records' forms sends one forms read.
 */
function statementsOf(queued: readonly Queued[]): Sent[] {
  const bySame = new Map<string, Sent>();
  for (const entry of queued) {
    const same = `${entry.kind}\u0000${entry.sql}\u0000${JSON.stringify(entry.params)}`;
    let sent = bySame.get(same);
    if (sent === undefined) {
      sent = { sql: entry.sql, params: entry.params, keys: entry.kind === "keys" ? new Set() : undefined, waiting: [] };
      bySame.set(same, sent);
    }
    sent.waiting.push(entry);
    if (entry.kind === "keys" && sent.keys !== undefined) {
      for (const key of entry.keys) sent.keys.add(key);
    }
  }
  return [...bySame.values()];
}

/** Each waiter's own rows: its keys' rows of a keyed read, else a copy of the statement's rows. */
function answer(sent: Sent, rows: unknown[]): void {
  for (const entry of sent.waiting) entry.resolve(entry.kind === "keys" ? rowsOfKeys(rows, entry.keys) : rows.slice());
}

/**
 * Cloudflare D1, reached from a Worker as `env.DB`, read-only.
 *
 * Every statement sent before the caller next waits goes to D1 as one call
 * (#385). A lookup sends dozens of reads that need nothing from each other;
 * sent one call each, D1 answered `bello` slower than when they waited on each
 * other, and as one `batch()` they cost one round trip
 * (https://developers.cloudflare.com/d1/worker-api/d1-database/#batch). The
 * call goes out on the next macrotask, once the caller's promises have
 * queued all they can. A batch is one transaction, so a statement that fails
 * fails every statement sent with it; each is a read, so none is half-written.
 * One adapter is made per request (web/lib/shared/database.ts), so a batch
 * never mixes two requests' reads.
 *
 * Within a call, the same read asked twice is sent once, and a keyed read is
 * sent once for every key asked of it (#393): D1 bills and times each
 * statement, and a page asks most of its reads once per record.
 *
 * `bind()` is skipped when there are no parameters: D1 rejects a `bind()` call
 * with zero arguments on some statements, and binding nothing is meaningless
 * anyway.
 */
export function fromD1(db: D1Like): LookupDatabase {
  let queued: Queued[] = [];

  const send = async (): Promise<void> => {
    const sent = statementsOf(queued);
    queued = [];
    try {
      const statements = sent.map(({ sql, params, keys }) => {
        const bound = keys === undefined ? params : [JSON.stringify([...keys]), ...params];
        const prepared = db.prepare(sql);
        return bound.length === 0 ? prepared : prepared.bind(...bound);
      });
      const answers = statements.length === 1 ? [await statements[0].all<unknown>()] : await db.batch(statements);
      sent.forEach((one, index) => answer(one, answers[index].results));
    } catch (failure) {
      for (const one of sent) for (const entry of one.waiting) entry.reject(failure);
    }
  };

  // The read is built inside the promise, so a statement `readOnly` refuses
  // is a rejection, never a throw.
  const enqueue = <T>(read: () => Omit<Queued, "resolve" | "reject">): Promise<T[]> =>
    new Promise<T[]>((resolve, reject) => {
      const entry = { ...read(), resolve: resolve as (rows: unknown[]) => void, reject } as Queued;
      if (queued.length === 0) setTimeout(send, 0);
      queued.push(entry);
    });

  return {
    all<T>(sql: DictionaryRead, params: readonly SqlValue[]): Promise<T[]> {
      return enqueue<T>(() => ({ kind: "all", sql: readOnly(sql), params }));
    },
    allOfKeys<T>(read: KeyedRead, keys: readonly SqlValue[], params: readonly SqlValue[]): Promise<T[]> {
      return enqueue<T>(() => ({ kind: "keys", sql: read, keys, params }));
    },
  };
}
