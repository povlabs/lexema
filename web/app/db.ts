// Reaching D1 from server code in vinext: no framework helper, no
// getCloudflareContext(). You import the Workers runtime's own `env`, which
// @cloudflare/vite-plugin also provides in dev. The spike in #27 established
// this; the comment is here so nobody has to rediscover it.
import { env } from "cloudflare:workers";
import { fromD1 } from "@lexema/lookup/database.ts";
import { lookup } from "@lexema/lookup/lookup.ts";
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
