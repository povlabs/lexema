// SQL sent to D1 as one `--command=<sql>` argument (src/db/d1Command.ts, #513),
// and what a failed Wrangler run says (src/import/seedTarget.ts).

import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { commandArgument, D1SqlRefused, readD1, writeD1, type D1Executor } from "../src/db/d1Command.js";
import { webWrangler, WranglerFailed } from "../src/import/seedTarget.js";
import { masterReaderOf } from "../src/update/updateCli.js";
import { localD1 } from "./localD1.js";

const OVERLONG = "https://*.wiktionary.org/w/index.php?title=*&oldid=*";

test("a read whose SQL opens with a -- comment reaches the database whole and answers its rows", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lexema-d1-command-"));
  try {
    const seeded = new DatabaseSync(":memory:");
    seeded.exec("CREATE TABLE t (v TEXT NOT NULL); INSERT INTO t (v) VALUES ('a'), ('b');");
    const d1 = localD1(dir, seeded);
    const sql = "-- Opens with a comment, which Wrangler reads as a flag when --command is its own argument (#507).\nSELECT v FROM t ORDER BY v";
    assert.deepEqual(masterReaderOf(d1.target).query(sql), [{ v: "a" }, { v: "b" }]);
    assert.deepEqual(d1.calls, [["--json", commandArgument(sql)]]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a read or write holding a LIKE or GLOB pattern over 50 bytes is refused, naming it, before Wrangler runs", () => {
  const calls: string[][] = [];
  const target: D1Executor = { execute: (args) => (calls.push([...args]), "[]") };
  const named = (error: unknown) =>
    error instanceof D1SqlRefused && error.message.includes(`GLOB '${OVERLONG}' (52 bytes)`);
  assert.throws(() => readD1(target, `SELECT v FROM t WHERE v GLOB '${OVERLONG}'`), named);
  assert.throws(() => writeD1(target, `DELETE FROM t WHERE v GLOB '${OVERLONG}'`), named);
  assert.deepEqual(calls, []);
  readD1(target, "SELECT v FROM t WHERE v GLOB 'https://*'");
  assert.equal(calls.length, 1);
});

test("a write goes as the one argument --command=<sql>", () => {
  const calls: string[][] = [];
  writeD1({ execute: (args) => (calls.push([...args]), "") }, "-- a note\nUPDATE t SET v = 'x'");
  assert.deepEqual(calls, [["--command=-- a note\nUPDATE t SET v = 'x'"]]);
});

// Through the installed Wrangler, aimed `--local` at a probe database only a
// temporary config names, so nothing can reach a remote D1. With `--json`,
// Wrangler writes its error to stdout; the thrown error has to quote it.
test("a failed Wrangler run throws with what Wrangler said, its JSON error included", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lexema-wrangler-failed-"));
  try {
    const config = join(dir, "wrangler.jsonc");
    await writeFile(
      config,
      JSON.stringify({
        name: "lexema-argv-probe",
        compatibility_date: "2026-01-01",
        d1_databases: [{ binding: "DB", database_name: "lexema-argv-probe", database_id: "00000000-0000-0000-0000-000000000000" }],
      }),
    );
    const probe: D1Executor = {
      execute: (args, capture) =>
        webWrangler(["d1", "execute", "lexema-argv-probe", ...args, "--local", "--persist-to", join(dir, "state"), "--config", config, "--yes"], capture),
    };
    assert.throws(
      () => readD1(probe, "SELECT v FROM no_such_table"),
      (error: unknown) => {
        assert.ok(error instanceof WranglerFailed);
        assert.match(error.message, /^wrangler d1 execute lexema-argv-probe --json --command=SELECT v FROM no_such_table .* failed \(exit \d+\)/);
        assert.match(error.message, /no such table: no_such_table/);
        return true;
      },
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
