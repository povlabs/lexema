// What the preview command changes in the built Worker config before
// `wrangler preview` reads it (ADR 0018).
//
// `vinext build` writes web/dist/server/wrangler.json with the `previews` block
// of web/wrangler.jsonc copied in (web/test/preview.test.ts). There `APP_DB` is
// a `<REPLACE_ME>` placeholder, which Wrangler 4.135.0 refuses to preview
// (`ensurePreviewsConfig` in wrangler-dist/cli.js). The preview command binds
// it to the branch's own app database, and nothing else in the file changes:
// `DB` stays on the shared dictionary.

import type { PreviewName } from "./previewName.ts";

/** The shared dictionary D1 production and every Preview read (web/wrangler.jsonc). */
export const DICTIONARY = { name: "lexema-dictionary", id: "b07d3441-91c6-4f94-8ae3-fe8c7088f21d" } as const;

/** The binding each Preview's own app database is bound as. */
const APP_BINDING = "APP_DB";

/** One branch's app database, found or created on the account. */
export interface AppDatabase {
  readonly preview: PreviewName;
  readonly id: string;
}

/** A D1 entry as Wrangler's config carries it. */
interface D1Entry {
  binding: string;
  database_name?: string;
  database_id?: string;
  migrations_dir?: string;
}

/** The part of the built config this reads; the rest passes through untouched. */
export interface BuiltConfig {
  previews?: { d1_databases?: D1Entry[]; [key: string]: unknown };
  [key: string]: unknown;
}

/** Refuse any id that is the dictionary's: a Preview never writes there. */
function assertNotDictionary(database: AppDatabase): void {
  if (database.id === DICTIONARY.id || database.preview.appDatabase === DICTIONARY.name) {
    throw new Error(`refusing to bind APP_DB to the shared dictionary ${DICTIONARY.name} (${DICTIONARY.id})`);
  }
}

/**
 * The built config with its Preview `APP_DB` bound to `database`. Refuses a
 * config whose `previews` block has no `APP_DB`, so a changed wrangler.jsonc
 * stops the build instead of previewing with no app database.
 */
export function withAppDatabase(config: BuiltConfig, database: AppDatabase): BuiltConfig {
  assertNotDictionary(database);
  const entries = config.previews?.d1_databases ?? [];
  if (entries.filter(({ binding }) => binding === APP_BINDING).length !== 1) {
    throw new Error(`the built config's previews block must bind ${APP_BINDING} exactly once`);
  }
  const d1_databases = entries.map((entry) =>
    entry.binding === APP_BINDING
      ? { ...entry, database_name: database.preview.appDatabase, database_id: database.id }
      : entry,
  );
  return { ...config, previews: { ...config.previews, d1_databases } };
}

/**
 * A Wrangler config that names only this app database, with the app
 * migrations (src/db/app/migrations) as its `migrations_dir`, for
 * `wrangler d1 migrations apply --remote`. The `previews` block cannot carry
 * one: the build does not rebase paths inside it (web/wrangler.jsonc).
 * `migrationsDir` is absolute, so the file works wherever it is written.
 */
export function migrationsConfig(database: AppDatabase, migrationsDir: string): Record<string, unknown> {
  assertNotDictionary(database);
  return {
    name: "lexema-web",
    d1_databases: [
      {
        binding: APP_BINDING,
        database_name: database.preview.appDatabase,
        database_id: database.id,
        migrations_dir: migrationsDir,
      },
    ],
  };
}
