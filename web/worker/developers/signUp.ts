// Whether developers.lexema.fyi takes new developers (#610).
//
// Lexema cannot sell yet, so on production and on Previews nobody may sign in,
// make an account or start a Checkout; the docs and pricing stay readable.
// `DEVELOPER_SIGN_UP` names the state in web/wrangler.jsonc: `open` at the top
// level (local development), `closed` in `previews` and `env.production`. It
// is read once, when the Worker starts (worker/index.ts), and any other value
// throws there, as `LEXEMA_STAGE` does (worker/shared/stage.ts). Code reads the
// parsed state, never the string.
//
// Closed, `withSignUp` answers the routes that would make an account or start a
// Checkout before they run: a 303 to the sign-in page, which says sign-up opens
// soon, with no cookie. Sign-out, the billing portal, Stripe's return and
// webhook, and a Preview's test sign-in are not among them. Open, it adds
// nothing, so the flow is the one it was.

import { billingRouteOf } from "./billing.ts";
import { SIGN_IN_PAGE } from "./dashboard.ts";
import { redirect, signInRouteOf } from "./signIn.ts";
import type { FetchHandler } from "../shared/fetchHandler.ts";

/** Every state sign-up can be in. */
const SIGN_UP_STATES = ["open", "closed"] as const;

export type SignUp = (typeof SIGN_UP_STATES)[number];

/** The state `DEVELOPER_SIGN_UP` names, or a throw for any value that names none. */
export function parseSignUp(value: unknown): SignUp {
  const state = SIGN_UP_STATES.find((candidate) => candidate === value);
  if (state === undefined) {
    throw new Error(`DEVELOPER_SIGN_UP must be one of ${SIGN_UP_STATES.join(", ")}; got ${JSON.stringify(value)}`);
  }
  return state;
}

/** Whether a URL, as the App Router would see it, would start a sign-in, finish one, or start a Checkout. */
export function opensAccount(url: URL): boolean {
  const signIn = signInRouteOf(url);
  if (signIn !== undefined) return signIn.kind === "start" || signIn.kind === "callback";
  return billingRouteOf(url)?.kind === "checkout";
}

/** Closed, answer every route that opens an account with a 303 to the sign-in page. Open, the app as it is. */
export function withSignUp<E>(signUp: SignUp, app: FetchHandler<E>): FetchHandler<E> {
  if (signUp === "open") return app;
  return async (request, env, ctx) => (opensAccount(new URL(request.url)) ? redirect(SIGN_IN_PAGE, []) : app(request, env, ctx));
}
