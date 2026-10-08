// `pnpm run api-key --remote` and `pnpm run plan --remote` (#737) against a
// fake Wrangler over the real app migrations: the account check, the typed
// confirmation, the arguments each statement goes out with, and what a run
// prints. No Wrangler process and no network.

import assert from "node:assert/strict";
import test from "node:test";
import type { DatabaseSync } from "node:sqlite";
import { DICTIONARY } from "../web/builds/previewConfig.ts";
import { PRODUCTION_APP_DATABASE } from "../web/builds/productionAppDatabase.ts";
import type { D1Target } from "../web/builds/appMigrations.ts";
import { hashApiKey } from "../src/api/keys.js";
import { runKeyCommand } from "../src/api/keyCli.js";
import { runPlanCommand } from "../src/billing/planCli.js";
import type { CommandResult } from "../src/commandLine.js";
import type { AppTables } from "../src/db/app/database.js";
import { appTablesOverNodeSqlite } from "../src/db/app/nodeSqlite.js";
import { localD1 } from "../src/db/localD1.js";
import { ProductionAppDatabase, runHandCommand, type QuietWrangler, type WranglerAnswer } from "../src/db/productionD1.js";
import { freshAppDatabase } from "./databases.js";

const NOW = Date.parse("2026-10-08T12:00:00Z");
const CONFIG = "/fake/lexema-app/wrangler.json";
const ENTERPRISE = ["enterprise", "1", "--calls", "20000000", "--per-minute", "1000", "--from", "2026-10-01", "--until", "2026-11-01"];
const keyCommand = (args: readonly string[], db: AppTables) => runKeyCommand(args, db, NOW);
const planCommand = (args: readonly string[], db: AppTables) => runPlanCommand(args, db, NOW);

/** An app database with one developer account, id 1. */
function appWithAccount(): DatabaseSync {
  const { sqlite } = freshAppDatabase();
  const at = new Date(NOW).toISOString();
  sqlite
    .prepare("INSERT INTO developer_account (account_id, name, email, email_verified, created_at, updated_at) VALUES (1, 'dev', 'dev@example.com', 1, ?, ?)")
    .run(at, at);
  return sqlite;
}

/** The SQL of one `--json --command=<sql>` read, the shape every statement is sent in (src/db/d1Command.ts). */
function statementOf(own: readonly string[]): string {
  assert.equal(own.length, 2, own.join(" "));
  assert.equal(own[0], "--json");
  assert.ok(own[1].startsWith("--command="), own[1]);
  return own[1].slice("--command=".length);
}

const runOn = (sqlite: DatabaseSync, sql: string): string => JSON.stringify([{ results: sqlite.prepare(sql).all() }]);

/** A fake account holding `databases`, its `lexema-app` statements run on `sqlite`. */
function fakeAccount(sqlite: DatabaseSync, databases: { name: string; uuid: string }[], fail?: (sql: string) => WranglerAnswer | undefined) {
  const calls: string[][] = [];
  const configs: Record<string, unknown>[] = [];
  const wrangler: QuietWrangler = (args) => {
    calls.push([...args]);
    if (args.join(" ") === "d1 list --json") return { status: 0, stdout: JSON.stringify(databases), stderr: "" };
    const [group, verb, name, remote, configFlag, config, ...own] = args;
    assert.deepEqual([group, verb, name, remote, configFlag, config], ["d1", "execute", "lexema-app", "--remote", "--config", CONFIG]);
    const sql = statementOf(own);
    return fail?.(sql) ?? { status: 0, stdout: runOn(sqlite, sql), stderr: "" };
  };
  const writeConfig = (config: Record<string, unknown>): string => {
    configs.push(config);
    return CONFIG;
  };
  const open = (target: D1Target = PRODUCTION_APP_DATABASE) => () => ProductionAppDatabase.open(wrangler, target, writeConfig);
  /** The SQL of every statement sent to `lexema-app`, in order. */
  const statements = () => calls.filter((args) => args[1] === "execute").map((args) => statementOf(args.slice(6)));
  return { calls, configs, open, statements };
}

const PRODUCTION_ACCOUNT = [
  { name: DICTIONARY.name, uuid: DICTIONARY.id },
  { name: PRODUCTION_APP_DATABASE.name, uuid: PRODUCTION_APP_DATABASE.id },
];

/** An `ask` that answers `answer` and keeps every question it was asked. */
function asking(answer: string) {
  const asked: string[] = [];
  return { asked, ask: async (question: string) => (asked.push(question), answer) };
}

const isWrite = (sql: string): boolean => !/^\s*select\s/i.test(sql);

test("without --remote, both commands run on the local database and never reach production or ask", async () => {
  const sqlite = appWithAccount();
  const local = (): AppTables => appTablesOverNodeSqlite(sqlite);
  const never = () => assert.fail("production was opened");
  const { asked, ask } = asking("lexema-app");
  const created = await runHandCommand("api-key", ["create", "--label", "local", "--per-minute", "5"], keyCommand, local, { ask, open: never });
  assert.equal(created.status, 0, created.out);
  const planned = await runHandCommand("plan", ENTERPRISE, planCommand, local, { ask, open: never });
  assert.equal(planned.status, 0, planned.out);
  assert.deepEqual(asked, []);
  assert.equal((sqlite.prepare("SELECT count(*) AS n FROM api_key").get() as { n: number }).n, 1);
  assert.equal((sqlite.prepare("SELECT count(*) AS n FROM enterprise_plan").get() as { n: number }).n, 1);
});

test("a missing lexema-app, another id, or the dictionary by name or id is refused before any statement or config", async () => {
  const cases: { why: string; databases: { name: string; uuid: string }[]; target?: D1Target; refusal: RegExp }[] = [
    { why: "missing", databases: [{ name: DICTIONARY.name, uuid: DICTIONARY.id }], refusal: /refusing to write lexema-app: it is not on the account/ },
    {
      why: "another id",
      databases: [{ name: "lexema-app", uuid: "00000000-0000-0000-0000-000000000000" }],
      refusal: /the account holds it as 00000000-0000-0000-0000-000000000000, not e77ba8e9/,
    },
    { why: "dictionary by name", databases: PRODUCTION_ACCOUNT, target: { name: DICTIONARY.name, id: PRODUCTION_APP_DATABASE.id }, refusal: /shared dictionary/ },
    { why: "dictionary by id", databases: PRODUCTION_ACCOUNT, target: { name: PRODUCTION_APP_DATABASE.name, id: DICTIONARY.id }, refusal: /shared dictionary/ },
  ];
  for (const { why, databases, target, refusal } of cases) {
    for (const [name, args, command] of [
      ["api-key", ["--remote", "create", "--label", "Lisvo", "--per-minute", "60"], keyCommand],
      ["plan", ["--remote", ...ENTERPRISE], planCommand],
    ] as const) {
      const sqlite = appWithAccount();
      const account = fakeAccount(sqlite, databases);
      const { asked, ask } = asking("lexema-app");
      const result = await runHandCommand(name, args, command, () => assert.fail("local"), { ask, open: account.open(target) });
      assert.equal(result.status, 1, `${why}: ${result.out}`);
      assert.match(result.out, refusal, why);
      assert.deepEqual(account.statements(), [], why);
      assert.deepEqual(account.configs, [], why);
      assert.deepEqual(asked, [], why);
    }
  }
});

test("an unconfirmed run names the database and the change, sends no write, and exits 1", async () => {
  for (const answer of ["", "yes", "lexema"]) {
    for (const [name, args, command, change] of [
      ["api-key", ["--remote", "create", "--label", "Lisvo app", "--per-minute", "60"], keyCommand, 'api-key create --label "Lisvo app" --per-minute 60'],
      ["plan", ["--remote", ...ENTERPRISE], planCommand, `plan ${ENTERPRISE.join(" ")}`],
      ["api-key", ["--remote", "revoke", "1"], keyCommand, "api-key revoke 1"],
    ] as const) {
      const sqlite = appWithAccount();
      const account = fakeAccount(sqlite, PRODUCTION_ACCOUNT);
      const { asked, ask } = asking(answer);
      const result = await runHandCommand(name, args, command, () => assert.fail("local"), { ask, open: account.open() });
      assert.equal(result.status, 1, result.out);
      assert.equal(result.out, `not confirmed: nothing was written to production's lexema-app (${PRODUCTION_APP_DATABASE.id})`);
      assert.equal(asked.length, 1);
      assert.ok(asked[0].includes(`production's lexema-app (${PRODUCTION_APP_DATABASE.id})`), asked[0]);
      assert.ok(asked[0].includes(change), asked[0]);
      assert.deepEqual(account.statements().filter(isWrite), [], `${name} ${answer}`);
      assert.equal((sqlite.prepare("SELECT count(*) AS n FROM api_key").get() as { n: number }).n, 0);
      assert.equal((sqlite.prepare("SELECT count(*) AS n FROM enterprise_plan").get() as { n: number }).n, 0);
    }
  }
});

test("a confirmed run sends each statement alone with --remote and lexema-app's real id, the same SQL the local target sends", async () => {
  const commands = [
    ["plan", ENTERPRISE, planCommand],
    ["plan", ["end", "1"], planCommand],
  ] as const;

  // Local: the same commands through localD1, its Wrangler faked over its own database.
  const localSqlite = appWithAccount();
  const localSql: string[] = [];
  const local = localD1("/fake/seed-state", (args) => {
    assert.deepEqual(args.slice(0, 6), ["d1", "execute", "lexema-app", "--local", "--persist-to", "/fake/seed-state"]);
    const sql = statementOf(args.slice(6));
    localSql.push(sql);
    return runOn(localSqlite, sql);
  });
  for (const [, args, command] of commands) assert.equal((await command(args, local)).status, 0);

  const sqlite = appWithAccount();
  const account = fakeAccount(sqlite, PRODUCTION_ACCOUNT);
  const { asked, ask } = asking("lexema-app\n");
  for (const [name, args, command] of commands) {
    const result = await runHandCommand(name, ["--remote", ...args], command, () => assert.fail("local"), { ask, open: account.open() });
    assert.equal(result.status, 0, result.out);
  }
  assert.equal(asked.length, 2, "one confirmation a run");
  assert.deepEqual(account.statements(), localSql);
  assert.ok(account.statements().some(isWrite));
  // fakeAccount checked every execute's `--remote --config <CONFIG>`; that config names the real id, never the placeholder.
  assert.deepEqual(
    account.configs.map((config) => (config.d1_databases as { database_name: string; database_id: string }[]).map(({ database_name, database_id }) => [database_name, database_id])),
    [[["lexema-app", PRODUCTION_APP_DATABASE.id]], [["lexema-app", PRODUCTION_APP_DATABASE.id]]],
  );
  for (const sql of account.statements()) assert.ok(!sql.trimEnd().replace(/;$/, "").includes(";"), `one statement a call: ${sql}`);
  assert.deepEqual(
    sqlite.prepare("SELECT account_id, calls_per_period, calls_per_minute FROM enterprise_plan").all().map((row) => ({ ...row })),
    [{ account_id: 1, calls_per_period: 20000000, calls_per_minute: 1000 }],
  );
});

/** Every key the output shows: `lx_` and its hex. */
const keysIn = (out: string): string[] => out.match(/lx_[0-9a-f]{64}/g) ?? [];

test("a remote create prints the new key once and never its hash, even when Wrangler fails quoting the INSERT", async () => {
  const sqlite = appWithAccount();
  const account = fakeAccount(sqlite, PRODUCTION_ACCOUNT);
  const { ask } = asking("lexema-app");
  const created: CommandResult = await runHandCommand("api-key", ["--remote", "create", "--label", "Lisvo", "--per-minute", "60"], keyCommand, () => assert.fail("local"), {
    ask,
    open: account.open(),
  });
  assert.equal(created.status, 0, created.out);
  const [key, ...more] = keysIn(created.out);
  assert.ok(key !== undefined && more.length === 0, created.out);
  assert.equal(created.out.split(key).length, 2, "the key is shown once");
  const hash = await hashApiKey(key);
  assert.ok(!created.out.includes(hash));
  assert.equal((sqlite.prepare("SELECT key_hash FROM api_key").get() as { key_hash: string }).key_hash, hash);

  // A failed INSERT whose Wrangler answer echoes the statement, hash and all.
  const failing = fakeAccount(appWithAccount(), PRODUCTION_ACCOUNT, (sql) =>
    isWrite(sql) ? { status: 1, stdout: JSON.stringify({ error: { text: `D1_ERROR: ${sql}` } }), stderr: `✘ could not run ${sql}` } : undefined,
  );
  const stopped = await runHandCommand("api-key", ["--remote", "create", "--label", "Lisvo", "--per-minute", "60"], keyCommand, () => assert.fail("local"), {
    ask,
    open: failing.open(),
  });
  assert.equal(stopped.status, 1);
  const [insert] = failing.statements().filter(isWrite);
  const sentHash = insert?.match(/'([0-9a-f]{64})'/)?.[1];
  assert.ok(sentHash !== undefined, insert);
  assert.ok(!stopped.out.includes(sentHash), stopped.out);
  assert.match(stopped.out, /wrangler d1 execute on production's lexema-app \(e77ba8e9-f4da-45fe-9b8c-322904054edc\) failed \(exit 1\)/);
  assert.match(stopped.out, /<hash>/);
  assert.deepEqual(keysIn(stopped.out), []);
});

test("--remote counts only as the first argument; anywhere else each command refuses it as before", async () => {
  const sqlite = appWithAccount();
  const local = () => appTablesOverNodeSqlite(sqlite);
  const never = () => assert.fail("production was opened");
  const key = await runHandCommand("api-key", ["create", "--label", "x", "--per-minute", "5", "--remote"], keyCommand, local, { open: never });
  assert.equal(key.status, 1);
  assert.match(key.out, /^unknown argument --remote/);
  const plan = await runHandCommand("plan", ["end", "1", "--remote"], planCommand, local, { open: never });
  assert.equal(plan.status, 1);
  assert.match(plan.out, /^end needs one account id/);
});
