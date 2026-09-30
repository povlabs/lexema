// Usage in D1 (#150, #261): an admin key's per-minute count, and every key's
// calls per UTC day.
//
// An admin key's limit is stored on the key and counted here (Huey, #148): a
// D1 row per key per minute counts its calls and returns the count, so
// `RateLimit-Remaining` and `RateLimit-Reset` are exact, and a 429 says how
// long to wait. An owned key's rate is its account's, counted by a Rate
// Limiting binding or the account meter (src/api/accountMeter.ts), and its
// calls reach `api_key_usage` from that meter at most once a minute, so an
// owned key's call writes nothing here.

import { and, between, eq, lt, sql } from "drizzle-orm";
import type { AppDatabase, AppTables } from "../db/app/database.js";
import { apiKey, apiKeyMinute, apiKeyUsage } from "../db/app/schema.js";
import type { UnsentCalls } from "./accountMeter.js";
import type { ApiKey } from "./keys.js";
import { listAccountKeys } from "./ownedKeys.js";
import { callCost, type Charge } from "./calls.js";

const MINUTE_MS = 60_000;

/** The minute a moment falls in, as whole minutes since the epoch. */
export const minuteOf = (now: number): number => Math.floor(now / MINUTE_MS);

/** The day a moment falls in, UTC, `YYYY-MM-DD`. */
export const dayOf = (now: number): string => new Date(now).toISOString().slice(0, 10);

/**
 * An admin key's current minute: its limit, how many calls it has made in it,
 * this request's included once counted, and when it ends.
 */
export class MinuteWindow {
  constructor(
    readonly limit: number,
    readonly count: number,
    readonly minute: number,
    readonly now: number,
  ) {}

  /** Whether the calls counted so far are within the limit. */
  get admitted(): boolean {
    return this.count <= this.limit;
  }

  /** Calls left in this minute. */
  get remaining(): number {
    return Math.max(0, this.limit - this.count);
  }

  /** Whole seconds until the window ends and the count starts again; never 0. */
  get resetSeconds(): number {
    return Math.max(1, Math.ceil(((this.minute + 1) * MINUTE_MS - this.now) / 1000));
  }

  /** The headers every response to this request carries; a refused one also says when to retry. */
  headers(): Record<string, string> {
    const reset = String(this.resetSeconds);
    return {
      "ratelimit-limit": String(this.limit),
      "ratelimit-remaining": String(this.remaining),
      "ratelimit-reset": reset,
      ...(this.admitted ? {} : { "retry-after": reset }),
    };
  }
}

/**
 * Add a request's calls to its key's minute and return the new count: one row
 * per key per minute. `api_key_minute.requests` holds calls since #216.
 */
export const countMinuteQuery = (db: AppDatabase, keyId: number, minute: number, calls: number) =>
  db
    .insert(apiKeyMinute)
    .values({ keyId, minute, requests: calls })
    .onConflictDoUpdate({ target: [apiKeyMinute.keyId, apiKeyMinute.minute], set: { requests: sql`${apiKeyMinute.requests} + excluded.requests` } })
    .returning({ requests: apiKeyMinute.requests });

/** The calls a key has made in this minute so far, without counting any. */
export const minuteCallsQuery = (db: AppDatabase, keyId: number, minute: number) =>
  db
    .select({ requests: apiKeyMinute.requests })
    .from(apiKeyMinute)
    .where(and(eq(apiKeyMinute.keyId, keyId), eq(apiKeyMinute.minute, minute)));

/** Drop the key's finished minutes, so the table holds at most one row per key. */
export const sweepMinutesQuery = (db: AppDatabase, keyId: number, minute: number) =>
  db.delete(apiKeyMinute).where(and(eq(apiKeyMinute.keyId, keyId), lt(apiKeyMinute.minute, minute)));

/** Count a request's calls against an admin key's current minute. */
export async function countMinute(db: AppTables, keyId: number, limit: number, calls: number, now: number): Promise<MinuteWindow> {
  const minute = minuteOf(now);
  const [row] = await countMinuteQuery(db.app, keyId, minute, calls);
  if (row === undefined) throw new Error(`key ${keyId}'s minute was not counted`);
  // The first request of a minute is the one that finds the last minute over.
  if (row.requests === calls) await sweepMinutesQuery(db.app, keyId, minute);
  return new MinuteWindow(limit, row.requests, minute, now);
}

/** An admin key's current minute as it stands, for a request refused before it was counted. */
export async function peekMinute(db: AppTables, keyId: number, limit: number, now: number): Promise<MinuteWindow> {
  const minute = minuteOf(now);
  const [row] = await minuteCallsQuery(db.app, keyId, minute);
  return new MinuteWindow(limit, row?.requests ?? 0, minute, now);
}

/** Add a request's calls to its key's row for the day. */
export const chargeCallsQuery = (db: AppDatabase, keyId: number, day: string, calls: number) =>
  db
    .insert(apiKeyUsage)
    .values({ keyId, day, calls })
    .onConflictDoUpdate({ target: [apiKeyUsage.keyId, apiKeyUsage.day], set: { calls: sql`${apiKeyUsage.calls} + excluded.calls` } })
    .returning({ calls: apiKeyUsage.calls });

/** Charge an answered request's calls to its key's day in D1, and return the day's total: an admin key's, whose calls no meter counts. */
export async function chargeCalls(db: AppTables, key: ApiKey, charge: Charge, now: number): Promise<number> {
  const [row] = await chargeCallsQuery(db.app, key.keyId, dayOf(now), callCost(charge));
  if (row === undefined) throw new Error(`key ${key.keyId}'s calls were not recorded`);
  return row.calls;
}

/** The most rows one statement adds: 3 values each, under D1's 100 bound parameters a statement. */
const ROWS_PER_STATEMENT = 30;

/**
 * Add an account meter's unsent calls to `api_key_usage`, in one transaction:
 * the meter's flush (src/api/accountMeter.ts).
 */
export async function addUsage(db: AppTables, rows: readonly UnsentCalls[]): Promise<void> {
  const statements = [];
  for (let at = 0; at < rows.length; at += ROWS_PER_STATEMENT) {
    statements.push(
      db.app
        .insert(apiKeyUsage)
        .values(rows.slice(at, at + ROWS_PER_STATEMENT).map(({ keyId, day, calls }) => ({ keyId, day, calls })))
        .onConflictDoUpdate({ target: [apiKeyUsage.keyId, apiKeyUsage.day], set: { calls: sql`${apiKeyUsage.calls} + excluded.calls` } }),
    );
  }
  const [first, ...rest] = statements;
  if (first !== undefined) await db.app.batch([first, ...rest]);
}

/** How many UTC days the usage view covers, today included. */
export const USAGE_WINDOW_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The `USAGE_WINDOW_DAYS` UTC days ending with today, oldest first. */
export const usageDays = (now: number): string[] =>
  Array.from({ length: USAGE_WINDOW_DAYS }, (_, i) => dayOf(now - (USAGE_WINDOW_DAYS - 1 - i) * DAY_MS));

/** An account's recorded days in a window: each key's rows through `api_key_by_owner` and the usage primary key. */
export const accountUsageQuery = (db: AppDatabase, accountId: number, first: string, last: string) =>
  db
    .select({ key_id: apiKeyUsage.keyId, day: apiKeyUsage.day, calls: apiKeyUsage.calls })
    .from(apiKey)
    .innerJoin(apiKeyUsage, eq(apiKeyUsage.keyId, apiKey.keyId))
    .where(and(eq(apiKey.ownerAccountId, accountId), between(apiKeyUsage.day, first, last)));

/** One key's calls on each day of the window, in the window's order. */
export interface KeyUsage {
  keyId: number;
  calls: readonly number[];
}

/**
 * An account's calls per UTC day over the last `USAGE_WINDOW_DAYS` days: per
 * key, for every key it owns, live or revoked, and in total. A day with no row
 * is 0; nothing is charged for it.
 */
export class AccountUsage {
  private constructor(
    /** `YYYY-MM-DD`, oldest first, today last. */
    readonly days: readonly string[],
    readonly keys: readonly KeyUsage[],
  ) {}

  /** Place the recorded rows on the window, reading a missing day as 0. */
  static of(days: readonly string[], keyIds: readonly number[], rows: readonly { key_id: number; day: string; calls: number }[]): AccountUsage {
    const column = new Map(days.map((day, i) => [day, i]));
    const byKey = new Map(keyIds.map((keyId) => [keyId, days.map(() => 0)]));
    for (const row of rows) {
      const i = column.get(row.day);
      const calls = byKey.get(row.key_id);
      if (i !== undefined && calls !== undefined) calls[i] += row.calls;
    }
    return new AccountUsage(days, keyIds.map((keyId) => ({ keyId, calls: byKey.get(keyId) ?? [] })));
  }

  /** Every key's calls added up, day by day. */
  get total(): readonly number[] {
    return this.days.map((_, i) => this.keys.reduce((sum, key) => sum + key.calls[i], 0));
  }
}

/** The account's usage for the window ending today, its keys in `listAccountKeys` order. */
export async function accountUsage(db: AppTables, accountId: number, now: number): Promise<AccountUsage> {
  const days = usageDays(now);
  const keys = await listAccountKeys(db, accountId);
  const rows = await accountUsageQuery(db.app, accountId, days[0], days[days.length - 1]);
  return AccountUsage.of(
    days,
    keys.map((key) => key.keyId),
    rows,
  );
}
