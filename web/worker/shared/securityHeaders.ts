// The browser security headers every Worker response carries (#620).
//
// They are set here and nowhere else, around every handler (worker/index.ts),
// on all three sites and on every stage. Static assets never reach the Worker,
// so web/public/_headers gives them the same `SECURITY_HEADERS`
// (web/test/assetHeaders.test.ts keeps the two in step).
//
// The dictionary and the developer site also get a Content Security Policy on
// every HTML page. Its script rule rests on a nonce, fresh for each request:
// vinext writes inline scripts into every page (the RSC payload and its
// bootstrap), and it stamps them with the nonce it reads from a
// `content-security-policy` header on the request, the way Next.js does
// (vinext/dist/server/csp.js, read by app-rsc-handler.js; app-ssr-entry.js and
// app-ssr-stream.js write `nonce="…"` on each script). So the policy goes on
// the request before vinext sees it, and on the response after.
//
// What the policy allows, and why:
// - scripts: this origin, the request's nonce, and Turnstile's origin, since
//   the report dialog injects Turnstile's script without a nonce
//   (components/dictionary/ReportDialog.tsx). No 'unsafe-inline' or
//   'unsafe-eval' for scripts, and no 'strict-dynamic', so the host list holds.
// - frames: Turnstile's widget only. No site may frame ours.
// - styles: this origin and inline, since React and Base UI set `style`
//   attributes, which no nonce can cover. Styles run no code.
// - everything else (images, fonts, fetches): this origin.
// - `form-action` is left out on purpose. It does not fall back to
//   `default-src`, and browsers check it across a form's redirects, so any
//   value would have to list Stripe Checkout, Stripe's billing portal and every
//   sign-in provider the 303s go to (worker/developers/billing.ts,
//   worker/developers/signIn.ts). Every form is our own, rendered by React.
//
// The API answers JSON only, so it gets a policy that allows nothing at all.

import { TURNSTILE_ORIGIN } from "@/lib/shared/turnstile.ts";
import type { FetchHandler } from "./fetchHandler.ts";
import { siteOf } from "./hosts.ts";

/** The headers every response carries, names lower-cased. HSTS has no `preload`: that list is hard to leave. */
export const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "DENY",
  "strict-transport-security": "max-age=31536000",
} as const satisfies Readonly<Record<string, string>>;

/** The header a Content Security Policy travels in, on the request to vinext and on the response. */
export const CSP_HEADER = "content-security-policy";

declare const scriptNonce: unique symbol;
/** One request's script nonce: 128 random bits, base64, so it holds no character HTML would escape. */
export type ScriptNonce = string & { readonly [scriptNonce]: true };

/** A fresh nonce, for one request only. */
export function newScriptNonce(): ScriptNonce {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes)) as ScriptNonce;
}

/** The policy of an HTML page on the dictionary or the developer site, for a request with `nonce`. */
export function pagePolicyOf(nonce: ScriptNonce): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' ${TURNSTILE_ORIGIN}`,
    "style-src 'self' 'unsafe-inline'",
    `frame-src ${TURNSTILE_ORIGIN}`,
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** The policy of every API response: JSON loads nothing and is framed by nothing. */
export const API_POLICY = "default-src 'none'; frame-ancestors 'none'";

const isHtml = (response: Response): boolean => response.headers.get("content-type")?.startsWith("text/html") ?? false;

/** Every response `handler` gives, with the security headers its site's responses carry. */
export function withSecurityHeaders<E>(handler: FetchHandler<E>): FetchHandler<E> {
  return async (request, env, ctx) => {
    if (siteOf(new URL(request.url)) === "api") return secured(await handler(request, env, ctx), API_POLICY);
    const policy = pagePolicyOf(newScriptNonce());
    // Whatever policy a client sent is replaced, so vinext stamps this request's nonce and no other.
    const headers = new Headers(request.headers);
    headers.set(CSP_HEADER, policy);
    const response = await handler(new Request(request, { headers }), env, ctx);
    return secured(response, isHtml(response) ? policy : undefined);
  };
}

/** `response` with the security headers, and `policy` when it has one. */
function secured(response: Response, policy: string | undefined): Response {
  // A fetched or asset response has immutable headers, so this is a copy.
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
  if (policy !== undefined) headers.set(CSP_HEADER, policy);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
