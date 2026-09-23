// Reaching D1 from server code in vinext: no framework helper, no
// getCloudflareContext(). You import the Workers runtime's own `env`, which
// @cloudflare/vite-plugin also provides in dev. The spike in #27 established
// this; the comment is here so nobody has to rediscover it.
import { env } from "cloudflare:workers";
import { fromD1 } from "@lexema/lookup/database.ts";
import { lookup, readRelease } from "@lexema/lookup/lookup.ts";
import { suggest, type SuggestResult } from "@lexema/lookup/suggest.ts";
import type { ReleaseInfo } from "@lexema/lookup/types.ts";
import type { Attempt } from "./attempt.ts";

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
    return await lookup({ db: fromD1(env.DB), releaseId: env.LEXEMA_RELEASE, query });
  } catch (error) {
    console.error("lookup failed", error);
    return { outcome: "failed" };
  }
}

/**
 * The identity of the release being served, or nothing when it cannot be read.
 *
 * The attribution page describes the release rather than any word, so it asks
 * for it directly. A failure lands the same way a failed lookup does: the
 * database's own message is the operator's business, and the page says it could
 * not read the release instead of guessing one.
 */
export async function release(): Promise<ReleaseInfo | undefined> {
  try {
    return await readRelease(fromD1(env.DB), env.LEXEMA_RELEASE);
  } catch (error) {
    console.error("release read failed", error);
    return undefined;
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
    return await suggest({ db: fromD1(env.DB), releaseId: env.LEXEMA_RELEASE, prefix });
  } catch (error) {
    console.error("suggest failed", error);
    return { outcome: "failed" };
  }
}
