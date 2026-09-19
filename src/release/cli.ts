// Release operations, against a local SQLite file or against the deployed D1.
//
//   pnpm run release -- list
//   pnpm run release -- check --release-id it-2026-09 --against it-2026-07
//   pnpm run release -- check --release-id it-2026-09 --against it-2026-07 --d1
//   pnpm run release -- retire --release-id it-2026-07
//   pnpm run release -- discard --release-id it-2026-09
//
// Every command goes through LookupDatabase, so `--d1` runs the same code
// against the database the Worker actually reads. Checking a local copy and
// activating the deployed one would be checking a different database.
//
// Activation is not here on purpose. The Worker serves whatever
// `LEXEMA_RELEASE` names, so activating and rolling back are that one variable,
// not a database write. docs/RELEASES.md has the steps.

import { DatabaseSync } from "node:sqlite";
import { fromNodeSqlite, type LookupDatabase } from "../lookup/database.js";
import { fromD1Http } from "./d1Http.js";
import { discardRelease, restoreRelease, retireRelease } from "./lifecycle.js";
import { validateRelease, type SizeBaseline } from "./validate.js";

function parseArgs(argv: string[]): Map<string, string | true> {
  const args = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      args.set(token.slice(2), true);
    } else {
      args.set(token.slice(2), next);
      i += 1;
    }
  }
  return args;
}

const str = (args: Map<string, string | true>, key: string): string | undefined => {
  const value = args.get(key);
  return typeof value === "string" ? value : undefined;
};

const required = (args: Map<string, string | true>, key: string, command: string): string => {
  const value = str(args, key);
  if (value === undefined) throw new Error(`${command} needs --${key} <value>`);
  return value;
};

const USAGE = `Usage: pnpm run release -- <command> [options]

Commands
  list                      every release in the database, with its row counts
  check                     judge a release against the gate before activating it
  retire                    mark a release superseded, hiding it from every read
  restore                   undo a retire, making a superseded release readable again
  discard                   delete a release whose import never finished

Where to run
  --database <path>         SQLite file          (default: .data/lexema.sqlite)
  --d1                      the deployed D1 instead, over the Cloudflare API.
                            Needs CLOUDFLARE_API_TOKEN, and account and database
                            ids from --account-id / --database-id or from
                            CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_D1_DATABASE_ID.

Options
  --release-id <id>         the release to act on
  --against <id>            the live release to size a checked release against
  --first-release           check a release with nothing to size against. Only
                            valid when the database holds no other release.
  --verify-projection       re-hash every derived row and compare it with the
                            digest the import recorded. A full scan.
  --probes <a,b,c>          override the words a checked release must answer.
                            Each is only required to return one reading, so this
                            is a weaker gate than the default probes.
`;

/**
 * Reads and writes both go through `all`. D1's HTTP API and node:sqlite both
 * run an UPDATE that way; the row a write meant to touch is then read back, so
 * "nothing was retired" is reported as such on either database.
 */
type ReleaseDatabase = LookupDatabase;

interface ReleaseRow {
  release_id: string;
  status: string;
  normalizer: string;
  schema_version: number;
  archive_sha256: string;
  projection_sha256: string | null;
  records: number;
}

async function list(db: ReleaseDatabase): Promise<void> {
  const rows = await db.all<ReleaseRow>(
    `SELECT r.release_id, r.status, r.normalizer, r.schema_version, r.archive_sha256,
            r.projection_sha256,
            (SELECT count(*) FROM source_record s WHERE s.release_id = r.release_id) AS records
       FROM source_release r
      ORDER BY r.release_id`,
    [],
  );

  if (rows.length === 0) {
    process.stdout.write("no releases in this database\n");
    return;
  }
  for (const row of rows) {
    process.stdout.write(
      `${row.release_id.padEnd(20)} ${row.status.padEnd(11)} ` +
        `${row.records.toLocaleString("en-US").padStart(9)} records  ` +
        `${row.normalizer} v${row.schema_version}  ` +
        `archive:${row.archive_sha256.slice(0, 12)}  ` +
        `derived:${(row.projection_sha256 ?? "none").slice(0, 12)}\n`,
    );
  }
}

/**
 * What the staged release is sized against. There is no default: an omitted
 * baseline used to skip the 90% floor in silence, so a typo in `--against` was
 * indistinguishable from a release that passed.
 */
function baselineFrom(args: Map<string, string | true>): SizeBaseline {
  const against = str(args, "against");
  const first = args.has("first-release");
  if (against !== undefined && first) {
    throw new Error("pass either --against <id> or --first-release, not both");
  }
  if (against !== undefined) return { kind: "against", releaseId: against };
  if (first) return { kind: "first-release" };
  throw new Error(
    "check needs --against <live-release-id>, or --first-release if this is the only release",
  );
}

async function check(db: ReleaseDatabase, args: Map<string, string | true>): Promise<void> {
  const releaseId = required(args, "release-id", "check");
  const probesRaw = str(args, "probes");

  const verdict = await validateRelease({
    db,
    releaseId,
    baseline: baselineFrom(args),
    verifyProjection: args.has("verify-projection"),
    probes:
      probesRaw === undefined
        ? undefined
        : probesRaw
            .split(",")
            .map((query) => ({ query: query.trim(), minReadings: 1, expects: [] as const })),
  });

  for (const item of verdict.checks) {
    process.stdout.write(`${item.ok ? "ok  " : "FAIL"}  ${item.name.padEnd(18)} ${item.detail}\n`);
  }
  process.stdout.write(
    verdict.ok
      ? `\n${verdict.releaseId} passes. Activate by setting LEXEMA_RELEASE to it.\n`
      : `\n${verdict.releaseId} is not activatable.\n`,
  );
  if (!verdict.ok) process.exitCode = 1;
}

async function retire(db: ReleaseDatabase, args: Map<string, string | true>): Promise<void> {
  const releaseId = required(args, "release-id", "retire");
  await retireRelease(db, releaseId);
  process.stdout.write(`${releaseId} is superseded. Rows stay; every read now hides it.\n`);
}

async function restore(db: ReleaseDatabase, args: Map<string, string | true>): Promise<void> {
  const releaseId = required(args, "release-id", "restore");
  await restoreRelease(db, releaseId);
  process.stdout.write(
    `${releaseId} is readable again. Check it before pointing LEXEMA_RELEASE back at it.\n`,
  );
}

async function discard(db: ReleaseDatabase, args: Map<string, string | true>): Promise<void> {
  const releaseId = required(args, "release-id", "discard");
  await discardRelease(db, releaseId);
  process.stdout.write(`${releaseId} is gone, children and all. Re-import it.\n`);
}

/** The deployed database, from flags or the usual Cloudflare environment. */
function openD1(args: Map<string, string | true>): LookupDatabase {
  const accountId = str(args, "account-id") ?? process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = str(args, "database-id") ?? process.env.CLOUDFLARE_D1_DATABASE_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  const missing = [
    accountId === undefined ? "--account-id or CLOUDFLARE_ACCOUNT_ID" : undefined,
    databaseId === undefined ? "--database-id or CLOUDFLARE_D1_DATABASE_ID" : undefined,
    apiToken === undefined ? "CLOUDFLARE_API_TOKEN" : undefined,
  ].filter((item): item is string => item !== undefined);
  if (accountId === undefined || databaseId === undefined || apiToken === undefined) {
    throw new Error(`--d1 needs ${missing.join(", ")}`);
  }

  return fromD1Http({ accountId, databaseId, apiToken });
}

async function run(
  command: string,
  db: ReleaseDatabase,
  args: Map<string, string | true>,
): Promise<void> {
  switch (command) {
    case "list":
      return list(db);
    case "check":
      return check(db, args);
    case "retire":
      return retire(db, args);
    case "restore":
      return restore(db, args);
    case "discard":
      return discard(db, args);
    default:
      throw new Error(`unknown command '${command}'\n\n${USAGE}`);
  }
}

async function main(): Promise<void> {
  const command = process.argv[2];
  const args = parseArgs(process.argv.slice(3));
  if (command === undefined || args.has("help") || command === "help") {
    process.stdout.write(USAGE);
    return;
  }

  if (args.has("d1")) {
    return run(command, openD1(args), args);
  }

  const local = new DatabaseSync(str(args, "database") ?? ".data/lexema.sqlite");
  try {
    local.exec("PRAGMA foreign_keys = ON");
    await run(command, fromNodeSqlite(local), args);
  } finally {
    local.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`\n${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
