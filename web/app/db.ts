// Reaching D1 from server code in vinext: no framework helper, no
// getCloudflareContext(). You import the Workers runtime's own `env`, which
// @cloudflare/vite-plugin also provides in dev. The spike in #27 established
// this; the comment is here so nobody has to rediscover it.
import { env } from "cloudflare:workers";
import { fromD1 } from "@lexema/lookup/database.ts";
import { lookup } from "@lexema/lookup/lookup.ts";
import type { LookupResult } from "@lexema/lookup/types.ts";

/**
 * A lookup that reached the database, or the fact that it did not.
 *
 * The failure is a value rather than a thrown error so the page has to render
 * it. A missing release, a D1 outage and a normalizer mismatch all land here,
 * and a reader is told the request failed instead of meeting a blank 500.
 */
export type Attempt = LookupResult | { outcome: "failed"; reason: string };

export async function search(query: string): Promise<Attempt> {
  try {
    return await lookup({ db: fromD1(env.DB), releaseId: env.LEXEMA_RELEASE, query });
  } catch (error) {
    // Logged in full for the operator; the page shows only the message.
    console.error("lookup failed", error);
    return { outcome: "failed", reason: error instanceof Error ? error.message : String(error) };
  }
}
