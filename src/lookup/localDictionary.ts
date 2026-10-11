// The local D1 a full seed leaves (docs/RUN_AN_IMPORT.md), as the hand-run
// measurements read it: `pnpm run measure:bare-spellings` and
// `pnpm run measure:missing-words`.

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

/** The local D1 file under a Wrangler state directory that holds the dictionary. */
export async function dictionaryFile(state: string): Promise<string> {
  const dir = join(state, "v3", "d1", "miniflare-D1DatabaseObject");
  const files = (await readdir(dir)).filter((name) => name.endsWith(".sqlite") && name !== "metadata.sqlite");
  for (const name of files) {
    const db = new DatabaseSync(join(dir, name), { readOnly: true });
    const holds = db.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'lookup_form'").get() !== undefined;
    db.close();
    if (holds) return join(dir, name);
  }
  throw new Error(`no dictionary database under ${dir}; seed one first (docs/RUN_AN_IMPORT.md)`);
}

/** The master `named` names, else the one master the database serves. */
export function masterOf(db: DatabaseSync, named: string | undefined): string {
  if (named !== undefined) return named;
  const masters = db.prepare("SELECT DISTINCT master_release_id AS id FROM served_release").all() as { id: string }[];
  if (masters.length !== 1) throw new Error(`the database serves ${masters.length} masters; name one with LEXEMA_RELEASE`);
  return masters[0].id;
}
