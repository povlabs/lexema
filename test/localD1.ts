// A local D1 a test can hash: one SQLite file, reached through the same
// `wrangler d1 execute` arguments `LocalSeedTarget` sends (src/import/seedTarget.ts),
// so a command runs its real reads and writes with no Wrangler process. Each call
// opens the file and closes it again, so the file's bytes are what a run left.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { LocalSeedTarget, type Wrangler } from "../src/import/seedTarget.js";

export interface LocalD1 {
  /** The persist directory a `SEED_STATE` names. */
  readonly persistTo: string;
  readonly wrangler: Wrangler;
  readonly target: LocalSeedTarget;
  /** Every `wrangler` call, as its arguments after the database name. */
  readonly calls: string[][];
  /** The SHA-256 of the database file. */
  sha256(): string;
  /** Open the file for the test's own reads and writes; close it before the next call. */
  open(): DatabaseSync;
}

/** A local D1 whose dictionary is `seeded`, copied into a file under `dir`. */
export function localD1(dir: string, seeded: DatabaseSync): LocalD1 {
  const file = join(dir, "dictionary.sqlite");
  seeded.exec(`VACUUM INTO '${file.replaceAll("'", "''")}'`);
  const calls: string[][] = [];
  const wrangler: Wrangler = (args) => {
    const [group, verb, , ...rest] = args;
    if (group !== "d1" || verb !== "execute") throw new Error(`unexpected wrangler call: ${args.join(" ")}`);
    const own = rest.slice(0, rest.indexOf("--yes"));
    calls.push(own);
    const db = new DatabaseSync(file);
    // An import and a query-API batch are each one transaction on D1 (src/deploy/d1Batch.ts).
    const transaction = (sql: string): string => {
      db.exec("BEGIN");
      try {
        db.exec(sql);
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
      return "";
    };
    try {
      if (own[0] === "--file") return transaction(readFileSync(own[1], "utf8"));
      if (own.length === 1 && own[0].startsWith("--command=")) return transaction(own[0].slice("--command=".length));
      // A read is `--json` and the one argument `--command=<sql>`; a bare `--command` is the two-argument shape Wrangler misreads (#507, #513).
      if (own.length === 2 && own[0] === "--json" && own[1].startsWith("--command=")) {
        return JSON.stringify([{ results: db.prepare(own[1].slice("--command=".length)).all() }]);
      }
      throw new Error(`unexpected d1 execute: ${own.join(" ")}`);
    } finally {
      db.close();
    }
  };
  return {
    persistTo: dir,
    wrangler,
    target: new LocalSeedTarget(wrangler, dir),
    calls,
    sha256: () => createHash("sha256").update(readFileSync(file)).digest("hex"),
    open: () => new DatabaseSync(file),
  };
}
