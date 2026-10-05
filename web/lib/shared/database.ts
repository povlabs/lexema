// Reaching D1 from server code in vinext: no framework helper, no
// getCloudflareContext(). You import the Workers runtime's own `env`, which
// @cloudflare/vite-plugin also provides in dev. The spike in #27 established
// this; the comment is here so nobody has to rediscover it.
//
// Two databases, two bindings (ADR 0018): `DB` is the dictionary, which code
// only reads, and `APP_DB` holds accounts, keys, usage and reader reports. A
// Preview of a pull request that changes dictionary data may also bind
// `DICTIONARY_SLICE`, read-only like `DB`, for the words it changes (#447).
import { env } from "cloudflare:workers";
import { appTablesOverD1, type AppTables } from "@lexema/db/app/database.ts";
import { fromD1, type LookupDatabase } from "@lexema/lookup/database.ts";
import { dictionaryFor } from "@lexema/lookup/slice.ts";

/**
 * The dictionary, read-only. A Worker without the binding throws here, and
 * that lands where any other database failure does: in the log, and as the
 * failed state on the page.
 */
export function database(): LookupDatabase {
  if (env.DB === undefined) throw new Error("no D1 binding: this Worker has no DB");
  return fromD1(env.DB);
}

/**
 * The Preview's dictionary slice, read-only, or none. Only the preview build
 * binds it (web/builds/previewSlice.ts), so it is not in web/wrangler.jsonc
 * or its generated types.
 */
export function dictionarySlice(): LookupDatabase | undefined {
  const preview = env as { DICTIONARY_SLICE?: D1Database };
  return preview.DICTIONARY_SLICE === undefined ? undefined : fromD1(preview.DICTIONARY_SLICE);
}

/** The dictionary a lookup of `query` reads: the slice for a word it serves, else `DB` (src/lookup/slice.ts). */
export function lookupDatabase(query: string): Promise<LookupDatabase> {
  return dictionaryFor(query, database(), dictionarySlice());
}

/** The app database. Its absence is thrown like `database`'s. */
export function appDatabase(): AppTables {
  if (env.APP_DB === undefined) throw new Error("no D1 binding: this Worker has no APP_DB");
  return appTablesOverD1(env.APP_DB);
}
