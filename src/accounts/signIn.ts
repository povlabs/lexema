// One sign-in, from the button to the account (#165): the OAuth 2.0
// authorization-code flow with PKCE (RFC 7636, S256) and `state`.
//
// `beginSignIn` makes a `PendingSignIn` — a state and a code verifier the
// browser keeps in a short-lived cookie — and the provider URL to send it to.
// `finishSignIn` takes the provider's callback and that pending sign-in back,
// and answers the verified identity or why there is none. A callback whose
// `state` is not the pending one is refused before the provider is asked; one
// whose verifier does not match the challenge is refused by the provider.

import { verifiedIdentity, type VerifiedIdentity } from "./accounts.js";
import { isProviderId, type OAuthProvider, type ProviderId } from "./providers.js";
import { randomToken, sameString, sha256Base64Url, TOKEN_SHAPE } from "./secrets.js";

/** What the browser holds between leaving for the provider and coming back. */
export interface PendingSignIn {
  readonly provider: ProviderId;
  readonly state: string;
  readonly verifier: string;
}

/** Start a sign-in: the pending state to keep, and where to send the browser. */
export async function beginSignIn(provider: OAuthProvider, redirectUri: string): Promise<{ pending: PendingSignIn; location: URL }> {
  const pending: PendingSignIn = { provider: provider.id, state: randomToken(), verifier: randomToken() };
  const location = provider.authorizationUrl({
    state: pending.state,
    codeChallenge: await sha256Base64Url(pending.verifier),
    redirectUri,
  });
  return { pending, location };
}

/** A pending sign-in as one cookie value: `provider.state.verifier`. */
export function writePending(pending: PendingSignIn): string {
  return `${pending.provider}.${pending.state}.${pending.verifier}`;
}

/** A cookie value read back, or `undefined` when it is not one `writePending` wrote. */
export function readPending(value: string | undefined): PendingSignIn | undefined {
  const [provider, state, verifier, ...rest] = value?.split(".") ?? [];
  if (rest.length > 0 || provider === undefined || !isProviderId(provider)) return undefined;
  if (state === undefined || verifier === undefined || !TOKEN_SHAPE.test(state) || !TOKEN_SHAPE.test(verifier)) {
    return undefined;
  }
  return { provider, state, verifier };
}

/**
 * Why a callback signs nobody in.
 *
 * - `no-pending`: the browser holds no pending sign-in for this provider (it
 *   expired, or the callback was not started here).
 * - `state`: the callback's `state` is not the pending one.
 * - `cancelled`: the provider sent back an error, such as the person declining.
 * - `refused`: the provider would not redeem the code, as for a wrong verifier.
 * - `unverified-email`: the provider vouches for no verified email.
 */
export type SignInRefusal = "no-pending" | "state" | "cancelled" | "refused" | "unverified-email";

export type SignInOutcome = { outcome: "verified"; identity: VerifiedIdentity } | { outcome: "refused"; refusal: SignInRefusal };

/** Check a provider's callback against the pending sign-in and redeem its code. */
export async function finishSignIn(
  provider: OAuthProvider,
  pending: PendingSignIn | undefined,
  callback: URLSearchParams,
  redirectUri: string,
): Promise<SignInOutcome> {
  const refused = (refusal: SignInRefusal): SignInOutcome => ({ outcome: "refused", refusal });
  if (pending === undefined || pending.provider !== provider.id) return refused("no-pending");
  if (!sameString(callback.get("state") ?? "", pending.state)) return refused("state");
  const code = callback.get("code") ?? "";
  if (callback.has("error") || code === "") return refused("cancelled");

  const exchange = await provider.exchange({ code, codeVerifier: pending.verifier, redirectUri });
  if (exchange.outcome === "refused") return refused("refused");
  const identity = verifiedIdentity(provider.id, exchange.profile);
  return identity === undefined ? refused("unverified-email") : { outcome: "verified", identity };
}
