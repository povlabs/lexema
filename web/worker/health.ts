// `GET /health` on every host (#413): whether this Worker can reach its
// databases, for a monitor and for the smoke checks after a deploy
// (docs/RUN_THE_SITE.md, "Check it is healthy").
//
// It is answered in front of the host routing and the per-visitor limits
// (worker/index.ts), so a monitor polling it is never counted as a visitor,
// and a `q` on it is never read as a search. Each check is `SELECT 1`, which
// reads no table row, and D1 bills rows read.
//
// The dictionary site checks the dictionary, `DB`. The developer site and the
// API also read accounts and keys, so they check `APP_DB` too. The body names
// the release `LEXEMA_RELEASE` serves and each database's state, and nothing
// else: no binding id, no error text, no secret.

import { log } from "@lexema/log/requestLog.ts";
import { fromD1 } from "@lexema/lookup/database.ts";
import { siteOf, type Site } from "./hosts.ts";
import type { FetchHandler } from "./rateLimit.ts";

/** Where the health check answers, on every host. */
export const HEALTH_PATH = "/health";

/** What one database's check found: it answered, the Worker has no binding for it, or it failed. */
export type DatabaseState = "ok" | "unbound" | "failed";

/** The databases a site checks: the dictionary everywhere, and the app database where accounts are read. */
export type D1Health = { dictionary: DatabaseState } | { dictionary: DatabaseState; app: DatabaseState };

/** The answer `/health` gives. */
export interface Health {
  /** True exactly when every database checked answered. */
  ok: boolean;
  release: string;
  d1: D1Health;
}

/** What the check reads: the release var, and the two bindings, which production may not have yet. */
export interface HealthBindings {
  LEXEMA_RELEASE: string;
  DB?: D1Database;
  APP_DB?: D1Database;
}

/** The answer for these database states; `ok` is read off them, never set apart. */
export const healthOf = (release: string, d1: D1Health): Health => ({
  ok: Object.values(d1).every((state) => state === "ok"),
  release,
  d1,
});

/** The query each check runs. It reads no table. */
const PING = "SELECT 1";

/** One database's state, from running `ping`. A failure's message goes to the log; the body says only `failed`. */
async function stateOf(database: "dictionary" | "app", ping: (() => Promise<unknown>) | undefined): Promise<DatabaseState> {
  if (ping === undefined) return "unbound";
  try {
    await ping();
    return "ok";
  } catch (failure) {
    log.error("health check failed", { database }, failure);
    return "failed";
  }
}

/**
 * Check the databases `site` reads, at once. The dictionary is asked through
 * its read-only adapter, as every other read of it is (src/lookup/database.ts).
 */
export async function checkHealth(site: Site, env: HealthBindings): Promise<Health> {
  const reader = env.DB === undefined ? undefined : fromD1(env.DB);
  const dictionary = stateOf("dictionary", reader && (() => reader.all(PING, [])));
  if (site === "lexema") return healthOf(env.LEXEMA_RELEASE, { dictionary: await dictionary });
  const appDb = env.APP_DB;
  const app = stateOf("app", appDb && (() => appDb.prepare(PING).first()));
  return healthOf(env.LEXEMA_RELEASE, { dictionary: await dictionary, app: await app });
}

/**
 * Answer `/health` here, and hand every other request on. A healthy Worker
 * answers 200; one with a database unbound or failing answers 503 with the
 * same body, so a monitor that reads only the status still sees it.
 */
export function withHealth<E extends HealthBindings>(handler: FetchHandler<E>): FetchHandler<E> {
  return async (request, env, ctx) => {
    const url = new URL(request.url);
    if (url.pathname !== HEALTH_PATH) return handler(request, env, ctx);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(null, { status: 405, headers: { allow: "GET, HEAD", "cache-control": "no-store" } });
    }
    const health = await checkHealth(siteOf(url), env);
    return Response.json(health, { status: health.ok ? 200 : 503, headers: { "cache-control": "no-store" } });
  };
}
