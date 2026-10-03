// One seeded test dictionary per archive, shared by every test of a file
// (#521). A file that seeds the same archive for many tests runs `seedSql`
// once, keeps the SQL it wrote, and loads that SQL into a fresh in-memory
// database for each test, so no test ever sees another test's writes.

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

/** Write the seed's SQL into `outputDir`, returning the part files in load order. */
export type Seed = (outputDir: string) => Promise<{ readonly parts: readonly string[] }>;

const seeded = new Map<string, Promise<readonly string[]>>();

async function sqlOf(seed: Seed): Promise<readonly string[]> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-seeded-"));
  try {
    const { parts } = await seed(join(dir, "sql"));
    return await Promise.all(parts.map((part) => readFile(part, "utf8")));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * A fresh in-memory dictionary holding what `seed` writes. `key` names the
 * archive and options: the first call under a key seeds, and every later one
 * reloads that SQL. The caller closes the database.
 */
export async function seededDictionary(key: string, seed: Seed): Promise<DatabaseSync> {
  let sql = seeded.get(key);
  if (sql === undefined) {
    sql = sqlOf(seed);
    seeded.set(key, sql);
  }
  const db = new DatabaseSync(":memory:");
  for (const part of await sql) db.exec(part);
  return db;
}
