// Updating the dictionary (#18): a replacement release is seeded beside the
// served one, checked, and only then servable; the served one keeps answering
// throughout and is what a rollback returns to. Each case seeds real SQL into
// a real SQLite database through the seed's own targets and load, with
// Wrangler stood in by a function that runs each command on that database.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { getTableName } from "drizzle-orm";
import * as appSchema from "../src/db/app/schema.js";
import { moveOutcome, ReleaseMoveRefused, servedReleases, type ReleaseMove, type ReleaseStatus } from "../src/import/releaseLifecycle.js";
import { Releases } from "../src/import/releases.js";
import { loadSeed, SeedStopped } from "../src/import/seedLoad.js";
import { readPlacement, schemaTables } from "../src/import/seedPlacement.js";
import { SEEDED_TABLES, seedSql } from "../src/import/seedSql.js";
import { dictionarySql, LOCAL_APP, LocalSeedTarget, type Wrangler } from "../src/import/seedTarget.js";
import { fromNodeSqlite } from "../src/lookup/database.js";
import { lookup } from "../src/lookup/lookup.js";
import type { FoundResult } from "../src/lookup/types.js";

const SCHEMA = resolve("src/db/schema.sql");
const appTables = Object.values(appSchema).map((table) => getTableName(table));

const casa = (gloss: string) => JSON.stringify({
  word: "casa", pos: "noun", pos_title: "Sostantivo", lang_code: "it", tags: ["feminine", "singular"],
  forms: [{ form: "case", tags: ["plural"] }],
  senses: [{ glosses: [gloss], raw_tags: ["edilizia"] }],
});
const word = (spelling: string) => JSON.stringify({
  word: spelling, pos: "noun", pos_title: "Sostantivo", lang_code: "it",
  senses: [{ glosses: [`voce ${spelling}`] }],
});
const OLD = [casa("edificio, nella versione vecchia"), word("albero")];
const NEW = [casa("edificio, nella versione nuova"), word("albero"), word("zaino")];

interface Hooks {
  /** Fail this part, as Wrangler does when a part's SQL is refused or the run is cut. */
  failPart?: (index: number) => boolean;
  /** Runs after each part lands, before the load reads anything back. */
  afterPart?: () => void;
}

/** `wrangler d1 ...` against `db`, the way the local target calls it. */
function sqliteWrangler(db: DatabaseSync, hooks: Hooks = {}): Wrangler {
  let part = 0;
  return (args) => {
    if (args[1] === "migrations") return "";
    if (args[2] === LOCAL_APP) return JSON.stringify([{ results: appTables.map((name) => ({ name })) }]);
    const at = (flag: string) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
    const file = at("--file");
    if (file !== undefined) {
      part += 1;
      if (hooks.failPart?.(part)) throw new Error(`part ${part} refused`);
      db.exec(readFileSync(file, "utf8"));
      hooks.afterPart?.();
      return "";
    }
    const sql = at("--command");
    if (sql === undefined) throw new Error(`unexpected wrangler call: ${args.join(" ")}`);
    if (/^\s*SELECT/i.test(sql)) return JSON.stringify([{ results: db.prepare(sql).all() }]);
    db.exec(sql);
    return JSON.stringify([{ results: [] }]);
  };
}

interface Desk {
  db: DatabaseSync;
  dir: string;
  /** Seed `lines` as `releaseId`; the first seed into the database is fresh, every later one beside. */
  seed(releaseId: string, lines: readonly string[], hooks?: Hooks): Promise<void>;
  status(releaseId: string): ReleaseStatus | undefined;
  /** The release's `casa` glosses, through the lookup the site runs. */
  casa(releaseId: string): Promise<string[]>;
  releases(served: readonly string[]): Releases;
}

async function withDesk(run: (desk: Desk) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-release-update-"));
  const db = new DatabaseSync(":memory:");
  let seeds = 0;
  const desk: Desk = {
    db,
    dir,
    async seed(releaseId, lines, hooks) {
      const input = join(dir, `${releaseId}-${seeds}.jsonl`);
      await writeFile(input, `${lines.join("\n")}\n`);
      const wrangler = sqliteWrangler(db, hooks);
      const target = new LocalSeedTarget(wrangler, join(dir, "state"), seeds > 0);
      seeds += 1;
      const placement = await target.prepare();
      const report = await seedSql({
        input, outputDir: join(dir, `sql-${seeds}`), schema: SCHEMA, releaseId, leaveImporting: true,
        beside: placement.kind === "beside" ? placement.bases : undefined,
        // Small parts beside, so a replacement can be cut between them; the
        // first seed's schema is one unit larger than that.
        partCeilingBytes: placement.kind === "beside" ? 2048 : undefined, maxStatementBytes: 256,
      });
      await loadSeed(target, report, () => {});
    },
    status: (releaseId) =>
      (db.prepare("SELECT status FROM source_release WHERE release_id = ?").get(releaseId) as { status: ReleaseStatus } | undefined)?.status,
    async casa(releaseId) {
      const result = await lookup({ db: fromNodeSqlite(db), releaseId, query: "casa" });
      assert.equal(result.outcome, "found");
      const { readings } = result as FoundResult;
      // A single lookup is served from one release: every ref it carries names it.
      for (const reading of readings) {
        assert.equal(reading.ref.releaseId, releaseId);
        for (const sense of reading.senses) for (const gloss of sense.glosses) assert.equal(gloss.ref.releaseId, releaseId);
      }
      return readings.flatMap((reading) => reading.senses.flatMap((sense) => sense.glosses.map(({ text }) => text)));
    },
    releases: (served) => new Releases(dictionarySql(new LocalSeedTarget(sqliteWrangler(db), join(dir, "state"))), new Set(served)),
  };
  try {
    await run(desk);
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
}

const rowsOf = (db: DatabaseSync, table: string): number => (db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;

test("a good activation: the replacement is seeded beside the served release, checked, and both answer, each from its own rows", async () => {
  await withDesk(async (desk) => {
    await desk.seed("it-old", OLD);
    await desk.seed("it-new", NEW);

    assert.equal(desk.status("it-old"), "complete");
    assert.equal(desk.status("it-new"), "complete");
    assert.deepEqual(await desk.casa("it-old"), ["edificio, nella versione vecchia"]);
    assert.deepEqual(await desk.casa("it-new"), ["edificio, nella versione nuova"]);
    // The replacement's ids follow the served release's, so neither release's rows moved.
    const ids = desk.db.prepare("SELECT release_id, min(record_id) AS low, max(record_id) AS high FROM source_record GROUP BY release_id ORDER BY low").all();
    assert.deepEqual(ids.map((row) => ({ ...row })), [
      { release_id: "it-old", low: 1, high: 2 },
      { release_id: "it-new", low: 3, high: 5 },
    ]);
    // Each release's counts are its own.
    const counted = desk.db.prepare("SELECT release_id, rows FROM release_table_rows WHERE table_name = 'source_record' ORDER BY release_id").all();
    assert.deepEqual(counted.map((row) => ({ ...row })), [{ release_id: "it-new", rows: 3 }, { release_id: "it-old", rows: 2 }]);
  });
});

test("a rejected activation: a replacement whose load does not check out is marked failed and never served; the served release is untouched", async () => {
  await withDesk(async (desk) => {
    await desk.seed("it-old", OLD);
    await assert.rejects(
      desk.seed("it-new", NEW, {
        // Rows of the replacement go missing between load and check.
        afterPart: () => desk.db.exec("DELETE FROM lookup_form WHERE lookup_id = (SELECT max(lookup_id) FROM lookup_form WHERE release_id = 'it-new')"),
      }),
      (error: unknown) => {
        assert.ok(error instanceof SeedStopped);
        assert.match(error.message, /row counts differ from the generated SQL: lookup_form; release it-new marked failed/);
        assert.match(error.message, /every other release in it is untouched/);
        assert.match(error.message, /pnpm run release discard it-new/);
        assert.doesNotMatch(error.message, /Reseed into a fresh SEED_STATE|delete and recreate/);
        return true;
      },
    );
    assert.equal(desk.status("it-new"), "failed");
    await assert.rejects(desk.casa("it-new"), /no complete release 'it-new'/);
    assert.equal(desk.status("it-old"), "complete");
    assert.deepEqual(await desk.casa("it-old"), ["edificio, nella versione vecchia"]);
  });
});

test("an interrupted seed leaves the replacement importing and unserved, blocks the next seed, and is cleared by abandon and discard", async () => {
  await withDesk(async (desk) => {
    await desk.seed("it-old", OLD);
    const before = Object.fromEntries(SEEDED_TABLES.map((table) => [table, rowsOf(desk.db, table)]));
    await assert.rejects(desk.seed("it-new", NEW, { failPart: (index) => index === 3 }), (error: unknown) => {
      assert.ok(error instanceof SeedStopped);
      assert.match(error.message, /part 3 of \d+ failed/);
      assert.match(error.message, /SEED_STATE=\S+ pnpm run release abandon it-new; SEED_STATE=\S+ pnpm run release discard it-new/);
      return true;
    });
    assert.equal(desk.status("it-new"), "importing");
    await assert.rejects(desk.casa("it-new"), /no complete release 'it-new'/);
    assert.deepEqual(await desk.casa("it-old"), ["edificio, nella versione vecchia"]);

    // No second writer starts beside a release still importing.
    await assert.rejects(desk.seed("it-new", NEW), /holds release it-new still importing/);

    const releases = desk.releases(["it-old"]);
    assert.throws(() => releases.apply("it-new", "discard"), /cannot discard release it-new: it is importing/);
    assert.equal((releases.apply("it-new", "abandon") as { status: string }).status, "failed");
    // One record a batch, so the discard runs its loop more than once.
    assert.equal(releases.apply("it-new", "discard", 1), "gone");
    assert.equal(desk.status("it-new"), undefined);
    for (const table of SEEDED_TABLES) assert.equal(rowsOf(desk.db, table), before[table], table);

    // The same archive seeds again, cleanly.
    await desk.seed("it-new", NEW);
    assert.deepEqual(await desk.casa("it-new"), ["edificio, nella versione nuova"]);
    assert.deepEqual(await desk.casa("it-old"), ["edificio, nella versione vecchia"]);
  });
});

test("a rollback: the previous release stays complete and answers; retired, it is restored before it is served again", async () => {
  await withDesk(async (desk) => {
    await desk.seed("it-old", OLD);
    await desk.seed("it-new", NEW);

    // The deployment now names it-new. Rolling back is naming it-old again,
    // which still answers, because nothing moved it.
    assert.deepEqual(await desk.casa("it-old"), ["edificio, nella versione vecchia"]);

    // Once it-new has held, it-old is retired, and stops being servable.
    const afterActivation = desk.releases(["it-new"]);
    assert.equal((afterActivation.apply("it-old", "retire") as { status: string }).status, "superseded");
    await assert.rejects(desk.casa("it-old"), /no complete release 'it-old'/);
    assert.throws(() => afterActivation.apply("it-new", "retire"), /web\/wrangler\.jsonc serves it as LEXEMA_RELEASE/);
    assert.throws(() => afterActivation.apply("it-old", "discard"), /it is superseded, and discard moves only a failed or partial release/);

    // A rollback past the retire restores it first; its rows were never touched.
    assert.equal((afterActivation.apply("it-old", "restore") as { status: string }).status, "complete");
    assert.deepEqual(await desk.casa("it-old"), ["edificio, nella versione vecchia"]);
    assert.deepEqual(await desk.casa("it-new"), ["edificio, nella versione nuova"]);
  });
});

test("a release id already in the database is refused before anything is written", async () => {
  await withDesk(async (desk) => {
    await desk.seed("it-old", OLD);
    const before = Object.fromEntries(SEEDED_TABLES.map((table) => [table, rowsOf(desk.db, table)]));
    await assert.rejects(desk.seed("it-old", NEW), (error: unknown) => {
      assert.ok(error instanceof SeedStopped);
      assert.match(error.message, /release it-old is already in .*Nothing was written/s);
      return true;
    });
    assert.equal(desk.status("it-old"), "complete");
    for (const table of SEEDED_TABLES) assert.equal(rowsOf(desk.db, table), before[table], table);
  });
});

test("a seed beside refuses a database whose tables are not the dictionary schema", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("CREATE TABLE source_release (release_id TEXT PRIMARY KEY, status TEXT)");
    const sql = { query: <Row>(text: string) => db.prepare(text).all() as Row[], run: (text: string) => db.exec(text) };
    assert.throws(
      () => readPlacement(sql, "local D1 lexema", readFileSync(SCHEMA, "utf8"), SEEDED_TABLES),
      /local D1 lexema holds tables that are not the dictionary schema; missing: release_table_rows, source_record/,
    );
    db.exec("DROP TABLE source_release");
    assert.deepEqual(readPlacement(sql, "local D1 lexema", readFileSync(SCHEMA, "utf8"), SEEDED_TABLES), { kind: "fresh" });
  } finally {
    db.close();
  }
  assert.ok(schemaTables(readFileSync(SCHEMA, "utf8")).includes("source_release"));
});

test("each move starts only from its own status, and never takes a served release away", () => {
  const cases: [ReleaseStatus, ReleaseMove, string][] = [
    ["complete", "retire", "superseded"],
    ["superseded", "restore", "complete"],
    ["importing", "abandon", "failed"],
    ["failed", "discard", "gone"],
    ["partial", "discard", "gone"],
  ];
  for (const [status, move, outcome] of cases) {
    assert.equal(moveOutcome({ releaseId: "it-x", status }, move, new Set()), outcome, `${move} from ${status}`);
  }
  const refused: [ReleaseStatus, ReleaseMove][] = [
    ["importing", "retire"], ["failed", "restore"], ["complete", "restore"], ["complete", "abandon"],
    ["complete", "discard"], ["superseded", "discard"], ["importing", "discard"],
  ];
  for (const [status, move] of refused) {
    assert.throws(() => moveOutcome({ releaseId: "it-x", status }, move, new Set()), ReleaseMoveRefused, `${move} from ${status}`);
  }
  const served = new Set(["it-x"]);
  assert.throws(() => moveOutcome({ releaseId: "it-x", status: "complete" }, "retire", served), /serves it as LEXEMA_RELEASE/);
  assert.equal(moveOutcome({ releaseId: "it-x", status: "superseded" }, "restore", served), "complete");
});

test("the served releases are every LEXEMA_RELEASE web/wrangler.jsonc names", () => {
  const served = servedReleases(readFileSync(resolve("web/wrangler.jsonc"), "utf8"));
  assert.ok(served.has("it-0c432803"));
  assert.ok(served.has("it-dev"));
  assert.deepEqual([...servedReleases('"vars": { "LEXEMA_RELEASE": "it-a" }, "x": { "LEXEMA_RELEASE" : "it-b" }')], ["it-a", "it-b"]);
});
