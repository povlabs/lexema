// Release operations against a local SQLite database.
//
//   pnpm run release -- list
//   pnpm run release -- check --release-id it-2026-09 --against it-2026-07
//   pnpm run release -- retire --release-id it-2026-07
//
// Activation is not here on purpose. The Worker serves whatever
// `LEXEMA_RELEASE` names, so activating and rolling back are that one variable,
// not a database write. docs/RELEASES.md has the steps.

import { DatabaseSync } from "node:sqlite";
import { validateLocalRelease } from "./validate.js";

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

const USAGE = `Usage: pnpm run release -- <command> [options]

Commands
  list                      every release in the database, with its row counts
  check                     judge a release against the gate before activating it
  retire                    mark a release superseded, hiding it from every read
  restore                   undo a retire, making a superseded release readable again

Options
  --database <path>         SQLite file          (default: .data/lexema.sqlite)
  --release-id <id>         the release to act on
  --against <id>            the live release to size a checked release against
  --probes <a,b,c>          override the words a checked release must answer
`;

function list(db: DatabaseSync): void {
  const rows = db
    .prepare(
      `SELECT r.release_id, r.status, r.normalizer, r.schema_version, r.archive_sha256,
              (SELECT count(*) FROM source_record s WHERE s.release_id = r.release_id) AS records
         FROM source_release r
        ORDER BY r.release_id`,
    )
    .all() as {
    release_id: string;
    status: string;
    normalizer: string;
    schema_version: number;
    archive_sha256: string;
    records: number;
  }[];

  if (rows.length === 0) {
    process.stdout.write("no releases in this database\n");
    return;
  }
  for (const row of rows) {
    process.stdout.write(
      `${row.release_id.padEnd(20)} ${row.status.padEnd(11)} ` +
        `${row.records.toLocaleString("en-US").padStart(9)} records  ` +
        `${row.normalizer} v${row.schema_version}  sha256:${row.archive_sha256.slice(0, 12)}\n`,
    );
  }
}

async function check(db: DatabaseSync, args: Map<string, string | true>): Promise<void> {
  const releaseId = str(args, "release-id");
  if (releaseId === undefined) throw new Error("check needs --release-id");
  const probesRaw = str(args, "probes");

  const verdict = await validateLocalRelease(db, {
    releaseId,
    against: str(args, "against"),
    probes: probesRaw === undefined ? undefined : probesRaw.split(",").map((p) => p.trim()),
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

function retire(db: DatabaseSync, args: Map<string, string | true>): void {
  const releaseId = str(args, "release-id");
  if (releaseId === undefined) throw new Error("retire needs --release-id");

  // Superseded is invisible to every canonical read, so retiring the release
  // that LEXEMA_RELEASE still names takes the site down. Retire after the flip,
  // and only once the new release has been live long enough to trust.
  const changed = db
    .prepare("UPDATE source_release SET status = 'superseded' WHERE release_id = ? AND status = 'complete'")
    .run(releaseId);
  if (changed.changes === 0) {
    throw new Error(`no complete release '${releaseId}' to retire`);
  }
  process.stdout.write(`${releaseId} is superseded. Rows stay; every read now hides it.\n`);
}

// The inverse of retire, because a retire made too early would otherwise leave
// nothing to roll back to. It only reaches rows that retire itself wrote.
function restore(db: DatabaseSync, args: Map<string, string | true>): void {
  const releaseId = str(args, "release-id");
  if (releaseId === undefined) throw new Error("restore needs --release-id");

  const changed = db
    .prepare("UPDATE source_release SET status = 'complete' WHERE release_id = ? AND status = 'superseded'")
    .run(releaseId);
  if (changed.changes === 0) {
    throw new Error(`no superseded release '${releaseId}' to restore`);
  }
  process.stdout.write(`${releaseId} is readable again. Check it before pointing LEXEMA_RELEASE back at it.\n`);
}

async function main(): Promise<void> {
  const command = process.argv[2];
  const args = parseArgs(process.argv.slice(3));
  if (command === undefined || args.has("help") || command === "help") {
    process.stdout.write(USAGE);
    return;
  }

  const database = str(args, "database") ?? ".data/lexema.sqlite";
  const db = new DatabaseSync(database);
  try {
    db.exec("PRAGMA foreign_keys = ON");
    switch (command) {
      case "list":
        return list(db);
      case "check":
        return await check(db, args);
      case "retire":
        return retire(db, args);
      case "restore":
        return restore(db, args);
      default:
        throw new Error(`unknown command '${command}'\n\n${USAGE}`);
    }
  } finally {
    db.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`\n${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
