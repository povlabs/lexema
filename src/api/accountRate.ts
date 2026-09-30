// An account's per-minute rate (#161, #216, #261): what counts it.
//
// Huey ruled on #161 (2026-09-29) that the rate is per account, shared by all
// its keys, and on #216 (2026-09-30) that it counts calls: every word of a
// `lookup/batch` counts once toward the minute, as toward the month. The two
// plan rates, 60 and 300 calls a minute, are Cloudflare Rate Limiting bindings
// keyed by account id (`CALLS_60` and `CALLS_300` in web/wrangler.jsonc); a
// binding holds one fixed limit, so any other rate, an Enterprise one, is
// counted in the account meter (src/api/accountMeter.ts).

/** The Rate Limiting bindings, by the calls a minute each allows. web/test/rateLimit.test.ts holds wrangler.jsonc to them. */
export const RATE_BINDINGS = { 60: "CALLS_60", 300: "CALLS_300" } as const;

/** The name of a binding that counts a plan rate. */
export type RateBinding = (typeof RATE_BINDINGS)[keyof typeof RATE_BINDINGS];

/** An account's calls a minute, and what counts them. */
export type AccountRate =
  | { perMinute: keyof typeof RATE_BINDINGS; countedBy: "binding"; binding: RateBinding }
  | { perMinute: number; countedBy: "meter" };

/** The rate of an account allowed `perMinute` calls a minute. */
export function accountRate(perMinute: number): AccountRate {
  if (!Number.isInteger(perMinute) || perMinute < 1) throw new Error(`an account's rate is a whole number of calls a minute, not ${perMinute}`);
  if (perMinute === 60 || perMinute === 300) return { perMinute, countedBy: "binding", binding: RATE_BINDINGS[perMinute] };
  return { perMinute, countedBy: "meter" };
}

/** The key a binding counts an account's calls under: its id, so all its keys share one count. */
export const rateKey = (accountId: number): string => String(accountId);
