// The JSON API at https://api.lexema.fyi/v1 (#148, #150, #164).
//
// It sits at the Worker level for the reason worker/shared/rateLimit.ts does: it has
// to decide each response's status, and a streamed page cannot. worker/shared/hosts.ts
// sends it every request for its host, so an API request never reaches the
// per-visitor limits or the App Router, and the API never sets a cookie.
//
// A request goes: its `X-API-Key` (401 when missing, unknown, revoked or
// expired), its account's plan (402 when an owned key's account has none
// serving, #263), its endpoint (404 when there is none, 403 when the key may
// not call it, #187) and method (405), the endpoint's reading of it (400 when
// it cannot be read), then its calls counted toward the minute and the billing
// period (429 past either, ./keyLimits.ts), and then the endpoint's answer. A
// request refused before its calls are counted costs nothing. A request whose
// answer then fails with 503 does not count toward the billing period: its
// calls are given back, though the minute keeps them (#289). Every response to
// a key under limits carries its limit headers, errors included.

import { allows } from "@lexema/api/keyAccess.ts";
import { authenticate, type KeyRefusal } from "@lexema/api/keys.ts";
import { callCost, endpointOf } from "@lexema/api/calls.ts";
import { appTablesOverD1 } from "@lexema/db/app/database.ts";
import { fromD1 } from "@lexema/lookup/database.ts";
import { dictionaryFor } from "@lexema/lookup/slice.ts";
import { log } from "@lexema/log/requestLog.ts";
import { originsOf, type SiteOrigins } from "../shared/hosts.ts";
import { error, type ApiContext, type ErrorJson } from "./answer.ts";
import { ROUTES } from "./endpoints.ts";
import { keyStanding, type LimitHeaders } from "./keyLimits.ts";
import { meteringOver, type MeteringBindings } from "./metering.ts";

export type { ApiContext, ErrorJson } from "./answer.ts";

const REFUSAL: Record<KeyRefusal, ErrorJson> = {
  missing: error("missing_key", "Send your API key in the X-API-Key header."),
  unknown: error("invalid_key", "This API key is not valid."),
  revoked: error("revoked_key", "This API key has been revoked."),
  expired: error("expired_key", "This API key has expired."),
};

/**
 * An owned key whose account has no serving plan: none, ended, or cancelled
 * past its end (#161, #263). It names the pricing page on the developer site
 * beside the API host it was asked on (#266).
 */
const planRequired = (origins: SiteOrigins): ErrorJson =>
  error("plan_required", `This key's account has no active plan. Choose one at ${origins.developers}/pricing.`);

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

/** Answer one API request. */
export async function handleApi(request: Request, context: ApiContext): Promise<Response> {
  const { appDb, now, metering } = context;
  let headers: LimitHeaders = {};
  const url = new URL(request.url);
  try {
    const authentication = await authenticate(appDb, request.headers.get("x-api-key"), now);
    if (authentication.outcome === "refused") return json(401, REFUSAL[authentication.refusal]);
    const standing = keyStanding(authentication.key, appDb, metering, now);
    if (standing.outcome === "plan-required") return json(402, planRequired(originsOf(url.hostname)));
    const { limits } = standing;
    // Refused before its calls are counted: the headers say where the key stands, and nothing is spent.
    const refuse = async (status: number, body: ErrorJson, extra: Record<string, string> = {}) => {
      headers = await limits.uncounted();
      return json(status, body, { ...headers, ...extra });
    };

    const endpoint = endpointOf(url.pathname);
    if (endpoint === undefined) return refuse(404, error("not_found", `There is no endpoint at ${url.pathname}.`));
    if (!allows(authentication.key.endpoints, endpoint)) {
      return refuse(403, error("endpoint_not_allowed", `This key may not call ${url.pathname}.`));
    }
    const route = ROUTES[endpoint];
    if (request.method !== route.method) {
      return refuse(405, error("method_not_allowed", `${url.pathname} answers ${route.method} only.`), { allow: route.method });
    }
    const reading = await route.read(request, url, { batchWords: limits.perMinute });
    if (reading.outcome === "refused") return refuse(400, reading.body);

    const admission = await limits.admit(callCost(reading.charge));
    headers = admission.headers;
    if (!admission.admitted) return json(429, error(admission.refusal, admission.message), headers);

    const answer = await reading.answer(context).catch(async (failure: unknown) => {
      // Counted, and not answered: its calls go back to the period (#289). A failed give-back is logged, and the answer is the same 503.
      await admission.giveBack().catch((lost: unknown) => log.error("api give-back failed", {}, lost));
      throw failure;
    });
    await limits.answered(reading.charge);
    return json(answer.status, answer.body, headers);
  } catch (failure) {
    // The database's message names tables and releases: it goes to the log.
    log.error("api request failed", {}, failure);
    return json(503, error("unavailable", "The request could not be answered. Try again later."), headers);
  }
}

/**
 * The bindings the API reads: the dictionary, the app database its keys and
 * usage live in, and what meters owned keys. `DICTIONARY_SLICE` is a
 * Preview's dictionary slice (#447), which only the preview build binds.
 */
export interface ApiBindings extends MeteringBindings {
  DB?: D1Database;
  APP_DB?: D1Database;
  DICTIONARY_SLICE?: D1Database;
  LEXEMA_RELEASE: string;
}

/**
 * The word a request looks up, for the endpoints that read one word's entry,
 * or none. On a Preview with a dictionary slice, those read the slice for a
 * word it serves (src/lookup/slice.ts); the others read the shared dictionary.
 */
export function lookedUpWord(url: URL): string | undefined {
  switch (endpointOf(url.pathname)) {
    case "lookup":
    case "lemmatize":
    case "exists":
      return url.searchParams.get("q") ?? undefined;
    case "inflect":
      return url.searchParams.get("lemma") ?? undefined;
    default:
      return undefined;
  }
}

const unavailable = (): Response => json(503, error("unavailable", "The request could not be answered. Try again later."));

/**
 * Answer a request `api.lexema.fyi` routed to the API. A Worker missing either
 * D1 binding answers 503, as a failed read does.
 */
export async function answerApi<E extends ApiBindings>(request: Request, env: E): Promise<Response> {
  if (env.DB === undefined || env.APP_DB === undefined) {
    const missing = env.DB === undefined ? "DB" : "APP_DB";
    log.error("api request failed", {}, new Error(`no D1 binding: this Worker has no ${missing}`));
    return unavailable();
  }
  const shared = fromD1(env.DB);
  const word = lookedUpWord(new URL(request.url));
  let db = shared;
  try {
    if (word !== undefined) db = await dictionaryFor(word, shared, env.DICTIONARY_SLICE === undefined ? undefined : fromD1(env.DICTIONARY_SLICE));
  } catch (failure) {
    log.error("api request failed", {}, failure);
    return unavailable();
  }
  return handleApi(request, {
    db,
    appDb: appTablesOverD1(env.APP_DB),
    releaseId: env.LEXEMA_RELEASE,
    now: Date.now(),
    metering: meteringOver(env),
  });
}

/** The API host's answer to a path outside `/v1/`: the error an unknown endpoint gets, without a key. */
export function apiNotFound(url: URL): Response {
  return json(404, error("not_found", `There is no endpoint at ${url.pathname}.`));
}
