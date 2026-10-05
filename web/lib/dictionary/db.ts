// The dictionary's reads of D1: the lookup, the suggestions, the served
// version and the report box's keys. How server code reaches D1 at all is
// lib/shared/database.ts.
import { env } from "cloudflare:workers";
import { cache } from "react";
import { servedVersion as readServedVersion, versionToken } from "@lexema/lookup/served.ts";
import { suggest, type SuggestResult } from "@lexema/lookup/suggest.ts";
import { log } from "@lexema/log/requestLog.ts";
import { database, lookupDatabase } from "@/lib/shared/database.ts";
import type { Attempt } from "./attempt.ts";
import { searchAttempt } from "./searchAttempt.ts";
import { parseStage } from "@/worker/shared/stage.ts";
import { reportKeys, turnstileConfig, VisitorCodeKey, type ReportKeys, type TurnstileConfig } from "./report.ts";

/**
 * Run the lookup, or report that it did not run.
 *
 * A missing release, a D1 outage and a normalizer mismatch all land in the
 * `failed` value, and a reader is told the request failed instead of meeting a
 * blank 500. The error itself stays here: a database message names tables,
 * releases and binding state, which is the operator's business and not the
 * reader's, so it is logged and nothing of it reaches the page.
 *
 * On a Preview with a dictionary slice, a word the pull request changes is
 * read from the slice (#447, src/lookup/slice.ts).
 *
 * Unmemoised, as a shared link's card runs it outside any page (worker/dictionary/card.ts).
 */
export async function searchOnce(query: string): Promise<Attempt> {
  try {
    return await searchAttempt(await lookupDatabase(query), env.LEXEMA_RELEASE, query);
  } catch (error) {
    log.error("lookup failed", {}, error);
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
    log.error("suggest failed", {}, error);
    return { outcome: "failed" };
  }
}

/** The Worker secrets the report box reads, set with `wrangler secret put` and so not in the generated `Env`. */
type ReportSecrets = { TURNSTILE_SECRET_KEY?: string; REPORT_VISITOR_KEY?: string };

/**
 * The report box's Turnstile keys (#51): the site key is a var, the secret is
 * set with `wrangler secret put`. On only when both are set; off without them
 * on a local or Preview Worker, with a warning in the log when one alone is
 * set; `unset` on production, where the report routes close the box (#621).
 */
export function turnstile(): TurnstileConfig {
  return turnstileConfig(
    parseStage(env.LEXEMA_STAGE),
    env.TURNSTILE_SITE_KEY,
    (env as ReportSecrets).TURNSTILE_SECRET_KEY,
    (message) => log.warn(message),
  );
}

/** What `POST /report` needs from the Worker's secrets, or every one it lacks (#621). */
export async function reportKeysOfWorker(): Promise<ReportKeys> {
  return reportKeys(turnstile(), await VisitorCodeKey.of((env as ReportSecrets).REPORT_VISITOR_KEY));
}

/** The release this Worker serves. */
export const servedRelease = (): string => env.LEXEMA_RELEASE;

/**
 * The served version's token (src/lookup/served.ts), or undefined when it
 * could not be read. Includes the Worker's version metadata id, so serving
 * code changes invalidate cards and suggestions without a data write.
 * Unmemoised, for the card route
 * (worker/dictionary/card.ts), which must tell an unread version from a read one.
 */
export async function servedVersionOnce(): Promise<string | undefined> {
  try {
    return versionToken(await readServedVersion(database(), env.LEXEMA_RELEASE), env.LEXEMA_VERSION.id);
  } catch (error) {
    log.error("served version failed", {}, error);
    return undefined;
  }
}

/**
 * The token a page names its card and its suggestions by, memoised for the
 * request. When the version cannot be read the page still renders, naming the
 * release and Worker version: no read data version ever matches that token, so the card route
 * sends its card on to the current address, and a suggestion answer kept
 * under it is newer than anything kept before.
 */
export const servedVersion = cache(async (): Promise<string> => (await servedVersionOnce()) ?? `${env.LEXEMA_RELEASE}.unread.code-${encodeURIComponent(env.LEXEMA_VERSION.id)}`);
