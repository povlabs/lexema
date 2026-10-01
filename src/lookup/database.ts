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

/** A statement waiting for the next call to D1, and who is waiting on its rows. */
interface Queued {
  statement: D1StatementLike;
  resolve: (rows: unknown[]) => void;
  reject: (failure: unknown) => void;
}

/**
 * Cloudflare D1, reached from a Worker as `env.DB`, read-only.
 *
 * Every statement sent before the caller next waits goes to D1 as one call
 * (#385). A lookup sends dozens of reads that need nothing from each other;
 * sent one call each, D1 answered `bello` slower than when they waited on each
 * other, and as one `batch()` they cost one round trip
 * (https://developers.cloudflare.com/d1/worker-api/d1-database/#batch). The
 * call goes out on the next macrotask, once the caller's promise chains have
 * queued all they can. A batch is one transaction, so a statement that fails
 * fails every statement sent with it; each is a read, so none is half-written.
 * One adapter is made per request (web/lib/shared/database.ts), so a batch
 * never mixes two requests' reads.
 *
 * `bind()` is skipped when there are no parameters: D1 rejects a `bind()` call
 * with zero arguments on some statements, and binding nothing is meaningless
 * anyway.
 */
export function fromD1(db: D1Like): LookupDatabase {
  let queued: Queued[] = [];

  const send = async (): Promise<void> => {
    const sent = queued;
    queued = [];
    try {
      const answers =
        sent.length === 1 ? [await sent[0].statement.all<unknown>()] : await db.batch(sent.map((entry) => entry.statement));
      sent.forEach((entry, index) => entry.resolve(answers[index].results));
    } catch (failure) {
      for (const entry of sent) entry.reject(failure);
    }
  };

  return {
    all<T>(sql: DictionaryRead, params: readonly SqlValue[]): Promise<T[]> {
      return new Promise<T[]>((resolve, reject) => {
        const prepared = db.prepare(readOnly(sql));
        const statement = params.length === 0 ? prepared : prepared.bind(...params);
        if (queued.length === 0) setTimeout(send, 0);
        queued.push({ statement, resolve: resolve as (rows: unknown[]) => void, reject });
      });
    },
  };
}
