// Reaching D1 from server code in vinext: no framework helper, no
// getCloudflareContext(). You import the Workers runtime's own `env`, which
// @cloudflare/vite-plugin also provides in dev. The spike in #27 established
// this; the comment is here so nobody has to rediscover it.
import { env } from "cloudflare:workers";
import { fromD1 } from "@lexema/lookup/database.ts";
import { lookup } from "@lexema/lookup/lookup.ts";
import type { LookupResult } from "@lexema/lookup/types.ts";

export function search(query: string): Promise<LookupResult> {
  return lookup({ db: fromD1(env.DB), releaseId: env.LEXEMA_RELEASE, query });
}
