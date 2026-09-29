// `pnpm run api-key`: create and revoke API keys in the local D1 (#150).
//
//   pnpm run api-key create --label "learning app" --per-minute 60
//   pnpm run api-key revoke 3
//
// `create` prints the key once; only its hash is stored, so it cannot be shown
// again. It also prints the key's id, which is what `revoke` takes. The
// database is the local D1 the dev seed writes (`SEED_STATE`, default
// `.data/seed-state`), reached through Wrangler as the seed reaches it. A key
// made here is an admin key: it has no owner, no developer account sees it, and
// its per-minute limit is its own.

import { finish, flags, isMain, positive, usageError, type CommandResult } from "../commandLine.js";
import { seededD1 } from "../db/localD1.js";
import type { LookupDatabase } from "../lookup/database.js";
import { createKey, revokeKey } from "./keys.js";

const USAGE = `usage:
  pnpm run api-key create --label <text> --per-minute <calls>
  pnpm run api-key revoke <key id>`;

const usage = (problem: string): CommandResult => usageError(problem, USAGE);

/** Run one command against a database. */
export async function runKeyCommand(args: readonly string[], db: LookupDatabase, now: number): Promise<CommandResult> {
  const [command, ...rest] = args;
  if (command === "create") {
    const given = flags(rest, ["label", "per-minute"]);
    if (typeof given === "string") return usage(given);
    const label = given.get("label")?.trim() ?? "";
    const perMinuteLimit = positive(given.get("per-minute"));
    if (label === "") return usage("create needs --label");
    if (perMinuteLimit === undefined) return usage("create needs --per-minute, a whole number above 0");
    const { keyId, key } = await createKey(db, { label, perMinuteLimit }, now);
    return {
      out: [
        `created key ${keyId} "${label}": ${perMinuteLimit} calls a minute`,
        "",
        `  ${key}`,
        "",
        "This is the only time the key is shown. Only its hash is stored.",
      ].join("\n"),
      status: 0,
    };
  }
  if (command === "revoke") {
    const keyId = positive(rest[0]);
    if (keyId === undefined || rest.length !== 1) return usage("revoke needs one key id");
    const outcome = await revokeKey(db, keyId, now);
    if (outcome === "unknown") return { out: `no key ${keyId}`, status: 1 };
    return { out: outcome === "revoked" ? `revoked key ${keyId}` : `key ${keyId} was already revoked`, status: 0 };
  }
  return usage(command === undefined ? "no command" : `unknown command ${command}`);
}

if (isMain(import.meta.url)) finish(await runKeyCommand(process.argv.slice(2), seededD1(), Date.now()));
