// How a key's calls are counted and limited, by who holds it (#148, #161,
// #216, #261). Both kinds count calls toward the minute, 1 per request and 1
// per word of a batch, and only once a request has been read.
//
// An admin key has its own per-minute limit, counted in a D1 row per minute,
// so its answers carry exact `RateLimit-Limit`, `RateLimit-Remaining` and
// `RateLimit-Reset`; its calls are charged to its D1 day once answered.
//
// An owned key takes its account's rate, shared by all the account's keys and
// counted by a Rate Limiting binding or the account meter; a binding says only
// yes or no, so its answers carry `RateLimit-Limit`, and a rate 429
// `Retry-After: 60`, the binding's whole window (#200 R1.5). Its calls are
// counted by the account meter in the one call that admits them, so nothing
// about it is written to D1 per call.

import type { AdmissionOutcome } from "@lexema/api/accountMeter.ts";
import { accountRate, rateKey } from "@lexema/api/accountRate.ts";
import type { Charge } from "@lexema/api/calls.ts";
import { OWNED_KEY_PER_MINUTE, perMinuteLimit, type ApiKey } from "@lexema/api/keys.ts";
import { chargeCalls, countMinute, peekMinute } from "@lexema/api/usage.ts";
import type { AppTables } from "@lexema/db/app/database.ts";
import { withinRate, type Metering } from "./metering.ts";

/** The headers a response to a key carries. */
export type LimitHeaders = Record<string, string>;

/** A read request's calls, admitted or refused, and the headers its response carries. */
export type Admission = { admitted: true; headers: LimitHeaders } | { admitted: false; headers: LimitHeaders; message: string };

/** One key's limits, for one request. */
export interface KeyLimits {
  /** The key's calls a minute, which is also the most words its batch takes (#216). */
  readonly perMinute: number;
  /** The headers of a response refused before any call was counted. */
  uncounted(): Promise<LimitHeaders>;
  /** Count a read request's calls toward the minute, and admit or refuse them. */
  admit(calls: number): Promise<Admission>;
  /** Record the calls of a request that was answered. */
  answered(charge: Charge): Promise<void>;
}

/** The window a Rate Limiting binding counts over, and so what a rate 429 tells an owned key to wait: web/wrangler.jsonc's `period`. */
export const RATE_WINDOW_SECONDS = 60;

/**
 * The billing period an owned key's calls are counted in until plans set one:
 * the UTC calendar month. The enforcement slice (#263) passes the plan's.
 */
export function unplannedPeriodStart(now: number): string {
  const date = new Date(now);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString();
}

/** The limits a key's request is held to. */
export function keyLimits(key: ApiKey, db: AppTables, metering: Metering, now: number): KeyLimits {
  return key.holder.kind === "admin" ? adminLimits(key, db, now) : ownedLimits(key.keyId, key.holder.accountId, metering, now);
}

function adminLimits(key: ApiKey, db: AppTables, now: number): KeyLimits {
  const perMinute = perMinuteLimit(key);
  return {
    perMinute,
    uncounted: async () => (await peekMinute(db, key.keyId, perMinute, now)).headers(),
    admit: async (calls) => {
      const window = await countMinute(db, key.keyId, perMinute, calls, now);
      return window.admitted
        ? { admitted: true, headers: window.headers() }
        : {
            admitted: false,
            headers: window.headers(),
            message: `This key may make ${perMinute} calls a minute. Retry after ${window.resetSeconds} s.`,
          };
    },
    answered: async (charge) => void (await chargeCalls(db, key, charge, now)),
  };
}

function ownedLimits(keyId: number, accountId: number, metering: Metering, now: number): KeyLimits {
  // Every account is at the default rate until plans set one (#263).
  const rate = accountRate(OWNED_KEY_PER_MINUTE);
  const headers = { "ratelimit-limit": String(rate.perMinute) };
  const overRate: Admission = {
    admitted: false,
    headers: { ...headers, "retry-after": String(RATE_WINDOW_SECONDS) },
    message: `This key's account may make ${rate.perMinute} calls a minute. Retry after ${RATE_WINDOW_SECONDS} s.`,
  };
  return {
    perMinute: rate.perMinute,
    uncounted: async () => headers,
    admit: async (calls) => {
      if (rate.countedBy === "binding" && !(await withinRate(metering.binding(rate.binding), rateKey(accountId), calls))) return overRate;
      const answer = await metering.admit(accountId, {
        keyId,
        calls,
        periodStart: unplannedPeriodStart(now),
        allowance: null,
        perMinute: rate.countedBy === "meter" ? rate.perMinute : null,
        now,
      });
      return outcomeOf(answer.outcome, headers, overRate);
    },
    // The meter counted the calls when it admitted them.
    answered: async () => {},
  };
}

function outcomeOf(outcome: AdmissionOutcome, headers: LimitHeaders, overRate: Admission): Admission {
  switch (outcome) {
    case "admitted":
      return { admitted: true, headers };
    case "over-rate":
      return overRate;
    case "over-allowance":
      // No allowance is sent until plans are enforced (#263), so the meter cannot answer this.
      throw new Error("the account meter refused an allowance this Worker never set");
  }
}
