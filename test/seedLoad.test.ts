import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getTableName } from "drizzle-orm";
import * as appSchema from "../src/db/app/schema.js";
import { loadSeed, SeedStopped } from "../src/import/seedLoad.js";
import { LocalSeedTarget, RemoteSeedTarget, seedTargetFrom, type Wrangler } from "../src/import/seedTarget.js";

// The command plan is built against a recording Wrangler: no process is spawned,
// so these tests need no network, no Cloudflare credential and no GitHub secret.

const appTables = Object.values(appSchema).map((table) => getTableName(table));
const rows = { source_record: 3, lookup_form: 5 };
const release = {
  status: "importing",
  lines_read: 4,
  admitted: 3,
  skipped_other_language: 1,
  malformed_lines: 0,
  malformed_members: 0,
  source_url: null,
  upstream_release: null,
  upstream_release_basis: null,
};

type Database = { uuid: string; name: string };

/**
 * Answers the reads the seed makes, records every call, and fails the part
 * named in `failPart`. `tables` is what `sqlite_schema` holds before any part.
 */
function recordingWrangler(
  options: { databases?: Database[]; tables?: string[]; failPart?: string; loaded?: Record<string, number> } = {},
) {
  const calls: string[][] = [];
  const databases = [...(options.databases ?? [])];
  let tables = [...(options.tables ?? [])];
  let status = "importing";
  const answer = (results: unknown[]): string => JSON.stringify([{ results }]);
  const wrangler: Wrangler = (args) => {
    calls.push([...args]);
    const [group, verb] = args;
    if (group !== "d1") throw new Error(`unexpected wrangler call: ${args.join(" ")}`);
    if (verb === "list") return JSON.stringify(databases);
    if (verb === "create") {
      databases.push({ uuid: "11111111-2222-4333-8444-555555555555", name: args[2] });
      return "";
    }
    if (verb === "migrations") return "";
    const file = args[args.indexOf("--file") + 1];
    if (args.includes("--file")) {
      if (file === options.failPart) throw new Error("import failed");
      tables = [...new Set([...tables, "source_record", "lookup_form", "source_release"])];
      return "";
    }
    const sql = args[args.indexOf("--command") + 1];
    if (sql.startsWith("SELECT name FROM sqlite_schema")) {
      return answer((args[2] === "lexema-app" ? appTables : tables).map((name) => ({ name })));
    }
    if (sql.startsWith("SELECT (SELECT count(*)")) return answer([options.loaded ?? rows]);
    if (sql.startsWith("SELECT status, lines_read")) return answer([release]);
    if (sql.startsWith("UPDATE source_release SET status = ")) {
      status = /status = '(\w+)'/.exec(sql)![1];
      return "";
    }
    if (sql.startsWith("SELECT status FROM source_release")) return answer([{ status }]);
    throw new Error(`unexpected command: ${sql}`);
  };
  return { wrangler, calls };
}

async function withParts(count: number, run: (parts: string[]) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "lexema-seed-load-"));
  try {
    const parts = Array.from({ length: count }, (_, index) => join(directory, `part-00${index + 1}.sql`));
    for (const part of parts) await writeFile(part, "SELECT 1;\n");
    await run(parts);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const reportFor = (parts: readonly string[]) => ({
  releaseId: "it-0c432803",
  rows,
  parts,
  status: "complete" as const,
  linesRead: release.lines_read,
  admitted: release.admitted,
  skippedOtherLanguage: release.skipped_other_language,
  malformed: release.malformed_lines,
  malformedMembers: release.malformed_members,
  archiveFacts: undefined,
});

const silent = () => {};
const isExecute = (call: readonly string[]) => call[1] === "execute";
const commandOf = (call: readonly string[]) => call[call.indexOf("--command") + 1];

test("a remote seed creates the named D1 when absent and aims every part and check at it with --remote", async () => {
  await withParts(3, async (parts) => {
    const { wrangler, calls } = recordingWrangler();
    const target = new RemoteSeedTarget(wrangler, "lexema-dictionary");
    await target.prepare();
    await loadSeed(target, reportFor(parts), silent);

    assert.deepEqual(calls.slice(0, 3), [
      ["d1", "list", "--json"],
      ["d1", "create", "lexema-dictionary", "--update-config=false"],
      ["d1", "list", "--json"],
    ]);
    const executes = calls.filter(isExecute);
    assert.ok(executes.length > parts.length);
    for (const call of executes) {
      assert.equal(call[2], "lexema-dictionary", call.join(" "));
      assert.ok(call.includes("--remote"), call.join(" "));
      assert.ok(!call.includes("--local") && !call.includes("--persist-to"), call.join(" "));
    }
    // No app migration and no delete, clear or drop reaches the remote database.
    assert.ok(calls.every((call) => call[1] !== "migrations" && call[1] !== "delete"));
    assert.ok(executes.every((call) => !/\b(DROP|DELETE)\b/i.test(commandOf(call) ?? "")));
    // The parts go in order, then the checks, and the final status is written last.
    assert.deepEqual(executes.filter((call) => call.includes("--file")).map((call) => call[call.indexOf("--file") + 1]), parts);
    const commands = executes.filter((call) => call.includes("--command")).map(commandOf);
    assert.ok(commands.some((sql) => sql.startsWith("SELECT (SELECT count(*) FROM source_record)")));
    assert.ok(commands.some((sql) => sql.startsWith("SELECT status, lines_read")));
    const promotion = commands.findIndex((sql) => sql === "UPDATE source_release SET status = 'complete' WHERE release_id = 'it-0c432803'");
    assert.equal(promotion, commands.length - 2);
    assert.deepEqual(target.reported, {
      remote: { database: "lexema-dictionary", databaseId: "11111111-2222-4333-8444-555555555555" },
    });
    const said: string[] = [];
    target.finished((line) => said.push(line));
    assert.deepEqual(said, ["remote D1 lexema-dictionary database id: 11111111-2222-4333-8444-555555555555"]);
  });
});

test("a remote seed uses an existing empty D1 without creating one; D1's own tables do not count", async () => {
  const { wrangler, calls } = recordingWrangler({
    databases: [{ uuid: "aaaaaaaa-0000-4000-8000-000000000001", name: "lexema-dictionary" }],
    tables: ["_cf_KV", "sqlite_sequence"],
  });
  const target = new RemoteSeedTarget(wrangler, "lexema-dictionary");
  await target.prepare();
  assert.equal(target.databaseId, "aaaaaaaa-0000-4000-8000-000000000001");
  assert.ok(calls.every((call) => call[1] !== "create"));
});

test("a remote seed refuses a D1 that already holds tables before any part is applied", async () => {
  const { wrangler, calls } = recordingWrangler({
    databases: [{ uuid: "aaaaaaaa-0000-4000-8000-000000000001", name: "lexema-dictionary" }],
    tables: ["_cf_KV", "source_record", "source_release"],
  });
  const target = new RemoteSeedTarget(wrangler, "lexema-dictionary");
  await assert.rejects(target.prepare(), /already holds 2 table\(s\): source_record, source_release.*never clears one/);
  assert.ok(calls.every((call) => !call.includes("--file")));
  assert.deepEqual(calls.at(-1), [
    "d1", "execute", "lexema-dictionary", "--json", "--command", "SELECT name FROM sqlite_schema WHERE type = 'table'", "--remote", "--yes",
  ]);
});

test("a remote seed that stops names the part and says to delete and recreate the database", async () => {
  await withParts(3, async (parts) => {
    const failing = recordingWrangler({ failPart: parts[1] });
    const stopping = new RemoteSeedTarget(failing.wrangler, "lexema-dictionary");
    await stopping.prepare();
    await assert.rejects(loadSeed(stopping, reportFor(parts), silent), (error: unknown) => {
      assert.ok(error instanceof SeedStopped);
      assert.match(error.message, new RegExp(`part 2 of 3 failed: ${parts[1]}`));
      assert.match(error.message, /applied before it: .*part-001\.sql/);
      assert.match(error.message, /remote D1 lexema-dictionary .* not usable.*delete and recreate it before retrying/s);
      return true;
    });
    // Nothing after the failed part, and no status is written.
    assert.ok(failing.calls.every((call) => !call.includes(parts[2]) && !(commandOf(call) ?? "").startsWith("UPDATE")));
  });
});

test("a remote seed whose loaded counts differ marks the release failed there and never promotes it", async () => {
  await withParts(1, async (parts) => {
    const { wrangler, calls } = recordingWrangler({ loaded: { ...rows, lookup_form: 4 } });
    const target = new RemoteSeedTarget(wrangler, "lexema-dictionary");
    await target.prepare();
    await assert.rejects(loadSeed(target, reportFor(parts), silent), (error: unknown) => {
      assert.ok(error instanceof SeedStopped);
      assert.match(error.message, /row counts differ from the generated SQL: lookup_form; release it-0c432803 marked failed/);
      assert.match(error.message, /delete and recreate it before retrying/);
      return true;
    });
    const updates = calls.filter(isExecute).map(commandOf).filter((sql) => sql?.startsWith("UPDATE"));
    assert.deepEqual(updates, ["UPDATE source_release SET status = 'failed' WHERE release_id = 'it-0c432803'"]);
    assert.ok(calls.filter(isExecute).every((call) => call.includes("--remote")));
  });
});

test("a remote target refuses a name web/wrangler.jsonc would resolve to a local id", () => {
  const { wrangler } = recordingWrangler();
  for (const name of ["lexema", "lexema-app", "DB", "APP_DB"]) {
    assert.throws(() => new RemoteSeedTarget(wrangler, name), /SEED_REMOTE/);
  }
  assert.throws(() => new RemoteSeedTarget(wrangler, ""), /D1 database name/);
});

test("without SEED_REMOTE the seed stays local; with it, SEED_STATE is refused", () => {
  const { wrangler } = recordingWrangler();
  const local = seedTargetFrom({}, wrangler, "/tmp/state");
  assert.ok(local instanceof LocalSeedTarget);
  assert.equal(local.persistTo, "/tmp/state");
  assert.ok(seedTargetFrom({ SEED_REMOTE: "lexema-dictionary" }, wrangler, "/tmp/state") instanceof RemoteSeedTarget);
  assert.throws(
    () => seedTargetFrom({ SEED_REMOTE: "lexema-dictionary", SEED_STATE: "/tmp/other" }, wrangler, "/tmp/state"),
    /SEED_REMOTE and SEED_STATE/,
  );
});

test("a local seed aims every command at the persist directory and migrates the app database there", async () => {
  await withParts(2, async (parts) => {
    const { wrangler, calls } = recordingWrangler();
    const target = new LocalSeedTarget(wrangler, join(parts[0], "..", "lexema-state"));
    await target.prepare();
    await loadSeed(target, reportFor(parts), silent);
    for (const call of calls) {
      assert.deepEqual(call.slice(-3), ["--local", "--persist-to", target.persistTo], call.join(" "));
      assert.ok(!call.includes("--remote"), call.join(" "));
    }
    assert.ok(calls.some((call) => call[1] === "migrations" && call[3] === "lexema-app"));
    assert.deepEqual(calls.filter((call) => call.includes("--file")).map((call) => call[call.indexOf("--file") + 1]), parts);
  });
});
