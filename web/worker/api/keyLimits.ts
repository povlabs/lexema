// How a key's calls are counted and limited, by who holds it (#148, #161,
// #216, #261, #263). Both kinds count calls toward the minute, 1 per request
// and 1 per word of a batch, and only once a request has been read.
//
// An admin key is outside plans (#200 R1.2). It has its own per-minute limit,
// counted in a D1 row per minute, so its answers carry exact `RateLimit-Limit`,
// `RateLimit-Remaining` and `RateLimit-Reset`; its calls are charged to its D1
// day once answered.
//
// An owned key follows its account's plan, read with the key. With no serving
// plan it may not call at all (402). With one, it takes the plan's rate, shared
// by all the account's keys and counted by a Rate Limiting binding or the
// account meter; a binding says only yes or no, so its answers carry
// `RateLimit-Limit`, and a rate 429 `Retry-After: 60`, the binding's whole
// window (#200 R1.5). Its calls are counted against the plan's allowance for
// its billing period by the account meter, in the one call that admits them, so
// nothing about it is written to D1 per call; a call over the allowance is a
// 429 naming when the period resets.

import type { AdmissionOutcome } from "@lexema/api/accountMeter.ts";
import { accountRate, rateKey } from "@lexema/api/accountRate.ts";
import type { Charge } from "@lexema/api/calls.ts";
import type { ApiKey } from "@lexema/api/keys.ts";
import { chargeCalls, countMinute, peekMinute } from "@lexema/api/usage.ts";
import { serving, type Period, type PlanLimits } from "@lexema/billing/plans.ts";
import type { AppTables } from "@lexema/db/app/database.ts";
import { withinRate, type Metering } from "./metering.ts";

/** The headers a response to a key carries. */
export type LimitHeaders = Record<string, string>;

/** Which limit refused a read request's calls: the minute's rate, or the billing period's allowance. */
export type LimitRefusal = "rate_limited" | "allowance_exceeded";

/** A read request's calls, admitted or refused, and the headers its response carries. */
export type Admission =
  | { admitted: true; headers: LimitHeaders }
  | { admitted: false; refusal: LimitRefusal; headers: LimitHeaders; message: string };

/** One key's limits, for one request. */
export interface KeyLimits {
  /** The key's calls a minute, which is also the most words its batch takes (#216). */
  readonly perMinute: number;
  /** The headers of a response refused before any call was counted. */
  uncounted(): Promise<LimitHeaders>;
  /** Count a read request's calls toward the minute and the period, and admit or refuse them. */
  admit(calls: number): Promise<Admission>;
  /** Record the calls of a request that was answered. */
  answered(charge: Charge): Promise<void>;
}

/** What a key may do: call under its limits, or nothing, because its account has no serving plan. */
export type KeyStanding = { readonly outcome: "limited"; readonly limits: KeyLimits } | { readonly outcome: "plan-required" };

/** The window a Rate Limiting binding counts over, and so what a rate 429 tells an owned key to wait: web/wrangler.jsonc's `period`. */
export const RATE_WINDOW_SECONDS = 60;

/** Whole seconds from `now` to the moment a billing period's allowance resets, at least 1. */
export const secondsToReset = (period: Period, now: number): number => Math.max(1, Math.ceil((period.end - now) / 1000));

/** What a key's request may do at `now`: an admin key's own limits, or an owned key's plan's, or nothing. */
export function keyStanding(key: ApiKey, db: AppTables, metering: Metering, now: number): KeyStanding {
  if (key.holder.kind === "admin") return { outcome: "limited", limits: adminLimits(key, key.holder.perMinuteLimit, db, now) };
  const plan = serving(key.holder.plan, now);
  if (!plan.serving) return { outcome: "plan-required" };
  return { outcome: "limited", limits: ownedLimits(key.keyId, key.holder.accountId, plan.limits, plan.period, metering, now) };
}

function adminLimits(key: ApiKey, perMinute: number, db: AppTables, now: number): KeyLimits {
  return {
    perMinute,
    uncounted: async () => (await peekMinute(db, key.keyId, perMinute, now)).headers(),
    admit: async (calls) => {
      const window = await countMinute(db, key.keyId, perMinute, calls, now);
      return window.admitted
        ? { admitted: true, headers: window.headers() }
        : {
            admitted: false,
            refusal: "rate_limited",
            headers: window.headers(),
            message: `This key may make ${perMinute} calls a minute. Retry after ${window.resetSeconds} s.`,
          };
    },
    answered: async (charge) => void (await chargeCalls(db, key, charge, now)),
  };
}

function ownedLimits(keyId: number, accountId: number, limits: PlanLimits, period: Period, metering: Metering, now: number): KeyLimits {
  const rate = accountRate(limits.callsPerMinute);
  const headers = { "ratelimit-limit": String(rate.perMinute) };
  const overRate: Admission = {
    admitted: false,
    refusal: "rate_limited",
    headers: { ...headers, "retry-after": String(RATE_WINDOW_SECONDS) },
    message: `This key's account may make ${rate.perMinute} calls a minute. Retry after ${RATE_WINDOW_SECONDS} s.`,
  };
  const resetsAt = new Date(period.end).toISOString();
  const overAllowance: Admission = {
    admitted: false,
    refusal: "allowance_exceeded",
    headers: { ...headers, "retry-after": String(secondsToReset(period, now)) },
    message: `This key's account has used its ${limits.callsPerPeriod.toLocaleString("en-US")} calls for this billing period. They reset at ${resetsAt}.`,
  };
  return {
    perMinute: rate.perMinute,
    uncounted: async () => headers,
    admit: async (calls) => {
      if (rate.countedBy === "binding" && !(await withinRate(metering.binding(rate.binding), rateKey(accountId), calls))) return overRate;
      const answer = await metering.admit(accountId, {
        keyId,
        calls,
        periodStart: new Date(period.start).toISOString(),
        allowance: limits.callsPerPeriod,
        perMinute: rate.countedBy === "meter" ? rate.perMinute : null,
        now,
      });
      return outcomeOf(answer.outcome, headers, overRate, overAllowance);
    },
    // The meter counted the calls when it admitted them.
    answered: async () => {},
  };
}

function outcomeOf(outcome: AdmissionOutcome, headers: LimitHeaders, overRate: Admission, overAllowance: Admission): Admission {
  switch (outcome) {
    case "admitted":
      return { admitted: true, headers };
    case "over-rate":
      return overRate;
    case "over-allowance":
      return overAllowance;
  }
}
