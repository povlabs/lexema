// The account meter (#161, #261): one per developer account, counting its
// calls without a D1 write per call.
//
// It runs inside a SQLite-backed Durable Object (web/worker/api/accountMeterObject.ts),
// one per account. A plain Durable Object hibernates 10 s after its last
// request and drops its memory (#200 R2.2), so nothing here is kept in memory:
// every admitted call is written to the object's own SQLite storage in the
// request that made it, and a meter built again over that storage, as after
// hibernation, holds every call. A call whose answer then fails is given back
// (#289). At most once a minute the key-day totals not yet sent are added to
// `api_key_usage` in D1, so the dashboard's 30-day chart stays a D1 read at
// most a minute behind.
//
// This class takes its storage as a plain SQL function, so it runs the same
// over a Durable Object's `ctx.storage.sql` and over `node:sqlite` in tests.

import { dayOf } from "./usage.js";

/** A value a statement binds. */
export type SqlValue = string | number | null;

/** Run one statement over the meter's storage and return its rows. Synchronous, as the object's SQLite is. */
export type MeterSql = <Row extends Record<string, SqlValue>>(query: string, ...bindings: SqlValue[]) => Row[];

/** How long after a call its day's total is sent to D1 at the latest, and the least time between two sends. */
export const FLUSH_EVERY_MS = 60_000;

const MINUTE_MS = 60_000;

/** One API request's calls, as the Worker asks the meter to admit them. */
export interface Admission {
  keyId: number;
  /** The request's calls: 1, or 1 per word of a batch (src/api/calls.ts). */
  calls: number;
  /** When the account's billing period began, ISO-8601. A later one than the meter holds starts the count again. */
  periodStart: string;
  /** The calls the period allows: the plan's allowance (#263). */
  allowance: number;
  /** The account's calls a minute when the meter counts its rate (an Enterprise rate), or null when a Rate Limiting binding does. */
  perMinute: number | null;
  now: number;
}

/**
 * An admitted request's calls, given back because its answer then failed
 * (#289): the key, calls, period start and time the admission named.
 */
export type GiveBack = Pick<Admission, "keyId" | "calls" | "periodStart" | "now">;

/** Whether the meter admitted a request's calls, or which limit refused them. */
export type AdmissionOutcome = "admitted" | "over-allowance" | "over-rate";

/** The meter's answer: the outcome, and the period's calls, the request's included when they were admitted. */
export interface MeterAnswer {
  outcome: AdmissionOutcome;
  periodCalls: number;
}

/** One key's calls on one UTC day not yet added to D1. */
export interface UnsentCalls {
  keyId: number;
  day: string;
  calls: number;
}

/** Where a flush sends the unsent calls: `api_key_usage` in D1 (src/api/usage.ts). */
export type UsageSink = (rows: readonly UnsentCalls[]) => Promise<void>;

interface StateRow extends Record<string, SqlValue> {
  period_start: string;
  period_calls: number;
  minute: number;
  minute_calls: number;
  flush_due: number | null;
}

interface KeyDayRow extends Record<string, SqlValue> {
  key_id: number;
  day: string;
  calls: number;
  sent: number;
}

const SCHEMA = [
  // Until plans were enforced (#263) every account was counted in a stand-in
  // period, the UTC calendar month, kept in `meter_state`. A real billing
  // period that began before that month's start would read as older and be
  // counted into it, so the stand-in count is dropped once, and the first call
  // in the plan's period starts it at 0. Unsent key-day calls are kept, and the
  // next call arms their send again.
  `DROP TABLE IF EXISTS meter_state`,
  // One row: the period's count, the current minute's count (used only when the
  // meter counts the rate), and when the pending send to D1 is due, if one is.
  `CREATE TABLE IF NOT EXISTS meter_period (
     id INTEGER PRIMARY KEY CHECK (id = 1),
     period_start TEXT NOT NULL,
     period_calls INTEGER NOT NULL CHECK (period_calls >= 0),
     minute INTEGER NOT NULL,
     minute_calls INTEGER NOT NULL CHECK (minute_calls >= 0),
     flush_due INTEGER
   ) STRICT`,
  // Each key's calls per UTC day, and how many of them D1 already has.
  `CREATE TABLE IF NOT EXISTS key_day (
     key_id INTEGER NOT NULL,
     day TEXT NOT NULL,
     calls INTEGER NOT NULL CHECK (calls > 0),
     sent INTEGER NOT NULL CHECK (sent >= 0 AND sent <= calls),
     PRIMARY KEY (key_id, day)
   ) STRICT`,
];

/** The admission, and the time a send to D1 must be scheduled for when this call is the first not yet due to be sent. */
export interface Admitted {
  answer: MeterAnswer;
  /** Set exactly when the caller must arm a flush for this time; no flush is pending otherwise. */
  flushAt: number | undefined;
}

/** One account's meter, over its own storage. */
export class AccountMeter {
  private constructor(private readonly sql: MeterSql) {}

  /** The meter over this storage, its tables made if they are not there yet. */
  static over(sql: MeterSql): AccountMeter {
    for (const statement of SCHEMA) sql(statement);
    return new AccountMeter(sql);
  }

  /**
   * Admit and count one request's calls, or refuse them and count nothing. An
   * admitted call is added to the period, to its key's day and, when the meter
   * counts the rate, to the minute, all in this one call.
   */
  admit(admission: Admission): Admitted {
    const { keyId, calls, periodStart, allowance, perMinute, now } = admission;
    if (!Number.isInteger(calls) || calls < 1) throw new Error(`a request counts at least 1 call, not ${calls}`);
    const state = this.state();
    const minute = Math.floor(now / MINUTE_MS);
    // A later period start begins a new count; an earlier one, from a request that raced a renewal, is counted in the current period.
    const newPeriod = state === undefined || periodStart > state.period_start;
    const period = newPeriod ? periodStart : state.period_start;
    const periodCalls = newPeriod ? 0 : state.period_calls;
    const minuteCalls = state === undefined || minute !== state.minute ? 0 : state.minute_calls;

    if (periodCalls + calls > allowance) return { answer: { outcome: "over-allowance", periodCalls }, flushAt: undefined };
    if (perMinute !== null && minuteCalls + calls > perMinute) return { answer: { outcome: "over-rate", periodCalls }, flushAt: undefined };

    const flushAt = state?.flush_due == null ? now + FLUSH_EVERY_MS : undefined;
    this.sql(
      `INSERT INTO meter_period (id, period_start, period_calls, minute, minute_calls, flush_due) VALUES (1, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET period_start = excluded.period_start, period_calls = excluded.period_calls,
         minute = excluded.minute, minute_calls = excluded.minute_calls, flush_due = excluded.flush_due`,
      period,
      periodCalls + calls,
      minute,
      // Counted only for a rate the meter keeps; left at 0 otherwise, so a rate it starts keeping later begins clean.
      perMinute === null ? 0 : minuteCalls + calls,
      flushAt ?? state?.flush_due ?? null,
    );
    this.sql(
      `INSERT INTO key_day (key_id, day, calls, sent) VALUES (?, ?, ?, 0)
       ON CONFLICT (key_id, day) DO UPDATE SET calls = calls + excluded.calls`,
      keyId,
      dayOf(now),
      calls,
    );
    return { answer: { outcome: "admitted", periodCalls: periodCalls + calls }, flushAt };
  }

  /**
   * Take back the calls of an admitted request whose answer failed (#289): off
   * the period, never below 0, and off its key's day. D1 keeps what it was
   * already sent, so only the day's unsent calls come back, and a day left with
   * none is removed. A give-back for any period but the one the meter holds,
   * as after a renewal, changes nothing. The minute keeps its calls, as a Rate
   * Limiting binding's does.
   */
  giveBack(given: GiveBack): void {
    const { keyId, calls, periodStart, now } = given;
    if (!Number.isInteger(calls) || calls < 1) throw new Error(`a request counts at least 1 call, not ${calls}`);
    if (this.state()?.period_start !== periodStart) return;
    this.sql(`UPDATE meter_period SET period_calls = max(0, period_calls - ?)`, calls);
    const day = dayOf(now);
    // Deleted first: a row brought to 0 calls would break `calls > 0`. Any row left keeps `sent <= calls`.
    this.sql(`DELETE FROM key_day WHERE key_id = ? AND day = ? AND sent = 0 AND calls <= ?`, keyId, day, calls);
    this.sql(`UPDATE key_day SET calls = calls - min(?, calls - sent) WHERE key_id = ? AND day = ?`, calls, keyId, day);
  }

  /**
   * Send every key-day's calls D1 does not have yet. They are marked sent
   * before the send goes out, so a give-back that lands while it is on its way
   * leaves them to D1 and takes back only calls no send carries (#289). Calls
   * admitted meanwhile stay unsent and go with the next send. A failed send
   * unmarks what it marked, and the failure is thrown for the caller to arm the
   * next try (`retryAt`).
   */
  async flush(sink: UsageSink, now: number): Promise<readonly UnsentCalls[]> {
    const unsent = this.sql<KeyDayRow>(`SELECT key_id, day, calls, sent FROM key_day WHERE calls > sent ORDER BY key_id, day`).map(
      (row): UnsentCalls => ({ keyId: row.key_id, day: row.day, calls: row.calls - row.sent }),
    );
    this.sql(`UPDATE meter_period SET flush_due = NULL`);
    // Marked rows keep `sent > 0` until the send settles, so no give-back removes them and the unmark below keeps `sent >= 0`.
    this.markSent(unsent, 1);
    if (unsent.length > 0) {
      try {
        await sink(unsent);
      } catch (failure) {
        this.markSent(unsent, -1);
        throw failure;
      }
    }
    // A day that is over and that D1 has in full is never added to again.
    this.sql(`DELETE FROM key_day WHERE calls = sent AND day < ?`, dayOf(now));
    return unsent;
  }

  /**
   * The calls counted in the period that began at `periodStart` (ISO-8601), as
   * the dashboard's meter shows them (#207). A meter still on an earlier period
   * has counted none of this one; a later start than `periodStart`, read before
   * a renewal reached the caller, is the period `admit` counts in.
   */
  periodCalls(periodStart: string): number {
    const state = this.state();
    return state === undefined || periodStart > state.period_start ? 0 : state.period_calls;
  }

  /** After a failed send: the time to try again, when no send is already due. */
  retryAt(now: number): number | undefined {
    const state = this.state();
    if (state === undefined || state.flush_due !== null) return undefined;
    const at = now + FLUSH_EVERY_MS;
    this.sql(`UPDATE meter_period SET flush_due = ?`, at);
    return at;
  }

  /** Add these calls to their rows' `sent` (`sign` 1), or take them off again (`sign` -1). */
  private markSent(rows: readonly UnsentCalls[], sign: 1 | -1): void {
    for (const { keyId, day, calls } of rows) {
      this.sql(`UPDATE key_day SET sent = sent + ? WHERE key_id = ? AND day = ?`, sign * calls, keyId, day);
    }
  }

  private state(): StateRow | undefined {
    return this.sql<StateRow>(`SELECT period_start, period_calls, minute, minute_calls, flush_due FROM meter_period WHERE id = 1`)[0];
  }
}
