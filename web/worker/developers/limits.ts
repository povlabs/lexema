// Which of the developer site's requests the per-visitor limits count, and
// what each says once its count is spent (#163, #296).
// worker/shared/rateLimit.ts counts.

import type { Counted, Counter, DeveloperLimit } from "../shared/rateLimit.ts";
import { billingRouteOf } from "./billing.ts";
import { dashboardRouteOf } from "./dashboard.ts";
import { signInRouteOf } from "./signIn.ts";
import { isTestSignIn } from "./testSignIn.ts";

const SIGN_IN: Counted<DeveloperLimit> = {
  limit: "sign-in",
  blocked: { by: "text", sentence: "Too many sign-in attempts. Try again in a minute." },
};
const KEY_CREATE: Counted<DeveloperLimit> = {
  limit: "key-create",
  blocked: { by: "text", sentence: "Too many keys made. Try again in a minute." },
};
const BILLING: Counted<DeveloperLimit> = {
  limit: "billing",
  blocked: { by: "text", sentence: "Too many billing requests. Try again in a minute." },
};

/**
 * Which limit a developer-site request counts against, or none. Every route
 * here sits under the developer site's segment, so no dictionary path is one.
 *
 * Only a POST to the keys path makes a key, so only a POST counts against the
 * key limit; any other method is a 405 that makes nothing (worker/developers/dashboard.ts).
 */
export const developerLimitOf: Counter<DeveloperLimit> = (url, method) => {
  // Starting a sign-in (Huey, #163 R1.2). Its path exists on the developer
  // site's host only (worker/developers/signIn.ts); the callback is not counted.
  if (signInRouteOf(url)?.kind === "start") return SIGN_IN;
  // The test sign-in, on a Preview's developer host only (worker/developers/testSignIn.ts).
  if (isTestSignIn(url)) return SIGN_IN;
  // Making a key (Huey, #163 R1.2).
  if (method === "POST" && dashboardRouteOf(url)?.kind === "create-key") return KEY_CREATE;
  // Every billing route, Checkout, the portal and Checkout's return, each of
  // which can call Stripe (Huey, #296; worker/developers/billing.ts).
  if (billingRouteOf(url) !== undefined) return BILLING;
  return undefined;
};
