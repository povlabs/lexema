// The JSON API at https://api.lexema.fyi/v1 (#148, #150, #164).
//
// It sits at the Worker level for the reason worker/rateLimit.ts does: it has
// to decide each response's status, and a streamed page cannot. worker/hosts.ts
// sends it every request for its host, so an API request never reaches the
// per-visitor limits or the App Router, and the API never sets a cookie.
//
// A request goes: its `X-API-Key` (401 when missing, unknown or revoked), its
// key's minute counted in D1 (429 past the key's own limit), its endpoint and
// method, and then the endpoint's answer (./endpoints.ts), charged in units
// (src/api/units.ts). Every response to a known key carries `RateLimit-Limit`,
// `RateLimit-Remaining` and `RateLimit-Reset`, errors included.

import { authenticate, type ApiKey, type KeyRefusal } from "@lexema/api/keys.ts";
import { endpointOf } from "@lexema/api/units.ts";
import { chargeUnits, countRequest, type MinuteWindow } from "@lexema/api/usage.ts";
import { fromD1 } from "@lexema/lookup/database.ts";
import { error, type ApiContext, type ErrorJson } from "./answer.ts";
import { ROUTES } from "./endpoints.ts";

export type { ApiContext, ErrorJson } from "./answer.ts";

const REFUSAL: Record<KeyRefusal, ErrorJson> = {
  missing: error("missing_key", "Send your API key in the X-API-Key header."),
  unknown: error("invalid_key", "This API key is not valid."),
  revoked: error("revoked_key", "This API key has been revoked."),
};

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

/** Answer one API request. */
export async function handleApi(request: Request, context: ApiContext): Promise<Response> {
  const { db, now } = context;
  let window: MinuteWindow | undefined;
  try {
    const authentication = await authenticate(db, request.headers.get("x-api-key"));
    if (authentication.outcome === "refused") return json(401, REFUSAL[authentication.refusal]);
    const key: ApiKey = authentication.key;

    window = await countRequest(db, key, now);
    const limits = window.headers();
    if (!window.admitted) {
      return json(
        429,
        error("rate_limited", `This key may make ${key.perMinuteLimit} requests a minute. Retry after ${window.resetSeconds} s.`),
        limits,
      );
    }

    const url = new URL(request.url);
    const endpoint = endpointOf(url.pathname);
    if (endpoint === undefined) return json(404, error("not_found", `There is no endpoint at ${url.pathname}.`), limits);
    const route = ROUTES[endpoint];
    if (request.method !== route.method) {
      return json(405, error("method_not_allowed", `${url.pathname} answers ${route.method} only.`), {
        ...limits,
        allow: route.method,
      });
    }

    const answer = await route.answer(request, url, context);
    if (answer.charge !== undefined) await chargeUnits(db, key, answer.charge, now);
    return json(answer.status, answer.body, limits);
  } catch (failure) {
    // The database's message names tables and releases: it goes to the log.
    console.error("api request failed", failure);
    return json(503, error("unavailable", "The request could not be answered. Try again later."), window?.headers() ?? {});
  }
}

/** The bindings the API reads. */
export interface ApiBindings {
  DB?: D1Database;
  LEXEMA_RELEASE: string;
}

/**
 * Answer a request `api.lexema.fyi` routed to the API. A Worker with no D1
 * binding answers 503, as a failed read does.
 */
export function answerApi<E extends ApiBindings>(request: Request, env: E): Promise<Response> {
  if (env.DB === undefined) {
    console.error("api request failed", new Error("no D1 binding: this Worker has no DB"));
    return Promise.resolve(json(503, error("unavailable", "The request could not be answered. Try again later.")));
  }
  return handleApi(request, { db: fromD1(env.DB), releaseId: env.LEXEMA_RELEASE, now: Date.now() });
}

/** The API host's answer to a path outside `/v1/`: the error an unknown endpoint gets, without a key. */
export function apiNotFound(url: URL): Response {
  return json(404, error("not_found", `There is no endpoint at ${url.pathname}.`));
}
