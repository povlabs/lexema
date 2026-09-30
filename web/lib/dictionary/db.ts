// The dictionary's reads of D1: the lookup, the suggestions and the report
// box's keys. How server code reaches D1 at all is lib/shared/database.ts.
import { env } from "cloudflare:workers";
import { cache } from "react";
import { suggest, type SuggestResult } from "@lexema/lookup/suggest.ts";
import { database } from "@/lib/shared/database.ts";
import type { Attempt } from "./attempt.ts";
import { searchAttempt } from "./searchAttempt.ts";
import { turnstileConfig, type TurnstileConfig } from "./report.ts";

/**
 * Run the lookup, or report that it did not run.
 *
 * A missing release, a D1 outage and a normalizer mismatch all land in the
 * `failed` value, and a reader is told the request failed instead of meeting a
 * blank 500. The error itself stays here: a database message names tables,
 * releases and binding state, which is the operator's business and not the
 * reader's, so it is logged and nothing of it reaches the page.
 *
 * Unmemoised, as a shared link's card runs it outside any page (worker/card.ts).
 */
export async function searchOnce(query: string): Promise<Attempt> {
  try {
    return await searchAttempt(database(), env.LEXEMA_RELEASE, query);
  } catch (error) {
    console.error("lookup failed", error);
    return { outcome: "failed" };
  }
}

/**
 * `searchOnce`, memoised for the request with React's `cache`, so the tab
 * title, the link preview's tags and the result read one lookup, not two.
 */
export const search = cache(searchOnce);

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

/**
 * The report box's Turnstile keys (#51): the site key is a var, the secret is
 * set with `wrangler secret put`. On only when both are set; one alone is off,
 * with a warning in the log.
 */
export function turnstile(): TurnstileConfig | undefined {
  return turnstileConfig(
    env.TURNSTILE_SITE_KEY,
    (env as { TURNSTILE_SECRET_KEY?: string }).TURNSTILE_SECRET_KEY,
    (message) => console.warn(message),
  );
}

/** The release this Worker serves. */
export const servedRelease = (): string => env.LEXEMA_RELEASE;
