// A key's per-minute count and its daily units, both in D1 (#150).
//
// Huey ruled on #148 that the limit is stored on the key and counted here, not
// with the Worker's rate-limit binding: the binding answers only `success`,
// holds one limit for every key, and cannot say how many requests are left or
// when its window ends. A D1 row per key per minute can: one upsert counts the
// request and returns the count, so `RateLimit-Remaining` and `RateLimit-Reset`
// are exact, and a 429 says how long to wait.

import type { LookupDatabase } from "../lookup/database.js";
import type { ApiKey } from "./keys.js";
import { unitCost, type Charge } from "./units.js";

const MINUTE_MS = 60_000;

/** The minute a moment falls in, as whole minutes since the epoch. */
export const minuteOf = (now: number): number => Math.floor(now / MINUTE_MS);

/** The day a moment falls in, UTC, `YYYY-MM-DD`. */
export const dayOf = (now: number): string => new Date(now).toISOString().slice(0, 10);

/**
 * One key's current minute: its limit, how many requests it has made in it,
 * this one included, and when it ends.
 */
export class MinuteWindow {
  constructor(
    readonly limit: number,
    readonly count: number,
    readonly minute: number,
    readonly now: number,
  ) {}

  /** Whether this request is within the limit. */
  get admitted(): boolean {
    return this.count <= this.limit;
  }

  /** Requests left in this minute after this one. */
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

/** Count one request in its key's minute and return the new count: one row per key per minute. */
export const COUNT_MINUTE_SQL = `INSERT INTO api_key_minute (key_id, minute, requests) VALUES (?, ?, 1)
     ON CONFLICT (key_id, minute) DO UPDATE SET requests = requests + 1
     RETURNING requests`;

/** Drop the key's finished minutes, so the table holds at most one row per key. */
export const SWEEP_MINUTES_SQL = `DELETE FROM api_key_minute WHERE key_id = ? AND minute < ?`;

/** Count a request against its key's current minute. */
export async function countRequest(db: LookupDatabase, key: ApiKey, now: number): Promise<MinuteWindow> {
  const minute = minuteOf(now);
  const [row] = await db.all<{ requests: number }>(COUNT_MINUTE_SQL, [key.keyId, minute]);
  if (row === undefined) throw new Error(`key ${key.keyId}'s minute was not counted`);
  // The first request of a minute is the one that finds the last minute over.
  if (row.requests === 1) await db.all(SWEEP_MINUTES_SQL, [key.keyId, minute]);
  return new MinuteWindow(key.perMinuteLimit, row.requests, minute, now);
}

/** Add a request's units to its key's row for the day. */
export const CHARGE_UNITS_SQL = `INSERT INTO api_key_usage (key_id, day, units) VALUES (?, ?, ?)
     ON CONFLICT (key_id, day) DO UPDATE SET units = units + excluded.units
     RETURNING units`;

/** Charge an answered request to its key's day, and return the day's total. */
export async function chargeUnits(db: LookupDatabase, key: ApiKey, charge: Charge, now: number): Promise<number> {
  const [row] = await db.all<{ units: number }>(CHARGE_UNITS_SQL, [key.keyId, dayOf(now), unitCost(charge)]);
  if (row === undefined) throw new Error(`key ${key.keyId}'s units were not recorded`);
  return row.units;
}
