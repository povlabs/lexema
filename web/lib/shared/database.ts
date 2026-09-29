// Reaching D1 from server code in vinext: no framework helper, no
// getCloudflareContext(). You import the Workers runtime's own `env`, which
// @cloudflare/vite-plugin also provides in dev. The spike in #27 established
// this; the comment is here so nobody has to rediscover it.
import { env } from "cloudflare:workers";
import { fromD1 } from "@lexema/lookup/database.ts";

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
