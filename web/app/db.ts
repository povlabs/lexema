// Reaching D1 from server code in vinext: no framework helper, no
// getCloudflareContext(). You import the Workers runtime's own `env`, which
// @cloudflare/vite-plugin also provides in dev. The spike in #27 established
// this; the comment is here so nobody has to rediscover it.
import { env } from "cloudflare:workers";
import { fromD1 } from "@lexema/lookup/database.ts";
import { lookup } from "@lexema/lookup/lookup.ts";
import { suggest, type SuggestResult } from "@lexema/lookup/suggest.ts";
import type { Attempt } from "./attempt.ts";

/**
 * The lookup database. Production has no D1 binding until #19
 * (web/wrangler.jsonc, `env.production`), so its absence is thrown here and
 * lands where any other database failure does: in the log, and as the
 * failed state on the page.
 */
export function database() {
  if (env.DB === undefined) throw new Error("no D1 binding: this Worker has no DB");
  return fromD1(env.DB);
}

/**
 * Run the lookup, or report that it did not run.
 *
 * A missing release, a D1 outage and a normalizer mismatch all land in the
 * `failed` value, and a reader is told the request failed instead of meeting a
 * blank 500. The error itself stays here: a database message names tables,
 * releases and binding state, which is the operator's business and not the
 * reader's, so it is logged and nothing of it reaches the page.
 */
export async function search(query: string): Promise<Attempt> {
  try {
    return await lookup({ db: database(), releaseId: env.LEXEMA_RELEASE, query });
  } catch (error) {
    console.error("lookup failed", error);
    return { outcome: "failed" };
  }
}

/**
 * Suggestions for a prefix, or the fact that they could not be read.
 *
 * Failure is kept apart from an empty answer for the reason `search` keeps it
 * apart from "not found": the field has to be able to say "no suggestions"
 * only when the index was asked and held none. The database's message is
 * logged, not returned.
 */
export async function suggestions(prefix: string): Promise<SuggestResult | { outcome: "failed" }> {
  try {
    return await suggest({ db: database(), releaseId: env.LEXEMA_RELEASE, prefix });
  } catch (error) {
    console.error("suggest failed", error);
    return { outcome: "failed" };
  }
}

/** The report box's Turnstile site key, or undefined when none is configured (#51). */
export function turnstileSiteKey(): string | undefined {
  return env.TURNSTILE_SITE_KEY === "" ? undefined : env.TURNSTILE_SITE_KEY;
}

/** The Turnstile secret, set with `wrangler secret put`; undefined skips the check. */
export function turnstileSecretKey(): string | undefined {
  const secret = (env as { TURNSTILE_SECRET_KEY?: string }).TURNSTILE_SECRET_KEY;
  return secret === undefined || secret === "" ? undefined : secret;
}

/** The release this Worker serves. */
export const servedRelease = (): string => env.LEXEMA_RELEASE;
