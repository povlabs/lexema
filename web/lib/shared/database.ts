// Reaching D1 from server code in vinext: no framework helper, no
// getCloudflareContext(). You import the Workers runtime's own `env`, which
// @cloudflare/vite-plugin also provides in dev. The spike in #27 established
// this; the comment is here so nobody has to rediscover it.
//
// Two databases, two bindings (ADR 0018): `DB` is the dictionary, which code
// only reads, and `APP_DB` holds accounts, keys, usage and reader reports.
import { env } from "cloudflare:workers";
import { appTablesOverD1, type AppTables } from "@lexema/db/app/database.ts";
import { fromD1, type LookupDatabase } from "@lexema/lookup/database.ts";

/**
 * The dictionary, read-only. Production has no D1 binding until #19
 * (web/wrangler.jsonc, `env.production`), so its absence is thrown here and
 * lands where any other database failure does: in the log, and as the
 * failed state on the page.
 */
export function database(): LookupDatabase {
  if (env.DB === undefined) throw new Error("no D1 binding: this Worker has no DB");
  return fromD1(env.DB);
}

/** The app database. Absent in production until #19, and thrown like `database`'s. */
export function appDatabase(): AppTables {
  if (env.APP_DB === undefined) throw new Error("no D1 binding: this Worker has no APP_DB");
  return appTablesOverD1(env.APP_DB);
}
