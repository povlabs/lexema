// The dictionary deploy run (#456), end to end against a local D1 file and a
// local Git remote: which declarations it takes, the order of its steps, what
// it writes, when it stops, what its summary says, and when it moves
// `production`. No network, no credential, no Wrangler process.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { gzipSync } from "node:zlib";
import { deployLog, main as deployMain } from "../src/deploy/deployCli.js";
import { type DataFetcher, DataRefused, fetchVerified, filesFor, lexemaDataFetcher } from "../src/deploy/dataFiles.js";
import { DEPLOY_STEPS, deployDictionary, deploySummary, type DeployDeps, type DeployStep, planOnly, restoreCommand } from "../src/deploy/dictionaryDeploy.js";
import { gitIn, PRODUCTION_BRANCH } from "../src/deploy/pending.js";
import { inlineParameters, lookupDatabaseOf, WORD_LIST } from "../src/deploy/wordCheck.js";
import { SOURCE_TEXT_UPDATE_RULES } from "../src/import/normalizeSourceText.js";
import { seedSql } from "../src/import/seedSql.js";
import { PLURAL_PLACEHOLDER_FORM } from "../src/italian/sourceTextNormalization.js";
import { fromNodeSqlite } from "../src/lookup/database.js";
import { lookup } from "../src/lookup/lookup.js";
import { parseChange } from "../src/update/declaration.js";
import { changedUpgrade, changedViews } from "../src/update/master.js";
import { createStatement, PAGE_ENTRY_CORRECTION_TABLES, PAGE_ENTRY_FACT_TABLES, PAGE_ENTRY_INDEXES, PAGE_ENTRY_TABLES } from "../src/update/masterUpgrade.js";
import { masterReaderOf } from "../src/update/updateCli.js";
import { correctedClaimValues } from "../src/import/correctedLayer.js";
import { atFixtureLines, correctionFixtureLines } from "./correctionFixture.js";
import { localD1, type LocalD1 } from "./localD1.js";

const RELEASE = "it-test";
const record = (fields: Record<string, unknown>): string => JSON.stringify({ lang_code: "it", ...fields });

const VADO_SOURCE = "vado ( approfondimento) 1ª persona singolare del presente indicativo di andare";
const VADO_STORED = "prima persona singolare del presente indicativo di andare";
const FATE_SOURCE = "2ª persona plurale dell'indicativo presente di fare";
const FATE_STORED = "seconda persona plurale dell'indicativo presente di fare";

// The words the run looks up, the records `normalize:source-text` changes, and
// enough others that changing three stays under the 5% limit.
const LINES = [
  record({ word: "casa", pos: "noun", pos_title: "Sostantivo", tags: ["feminine"], senses: [{ glosses: ["edificio adibito ad abitazione"] }] }),
  record({ word: "andare", pos: "verb", pos_title: "Verbo", senses: [{ glosses: ["muoversi"] }] }),
  record({ word: "raccontare", pos: "verb", pos_title: "Verbo", senses: [{ glosses: ["narrare"] }] }),
  record({ word: "bello", pos: "adj", pos_title: "Aggettivo", senses: [{ glosses: ["gradevole a vedersi"] }] }),
  record({ word: "studente", pos: "noun", pos_title: "Sostantivo", tags: ["masculine"], senses: [{ glosses: ["chi studia"] }] }),
  record({
    word: "andavano", pos: "verb", pos_title: "Voce verbale",
    senses: [{ glosses: ["terza persona plurale dell'indicativo imperfetto di andare"], tags: ["form-of"], form_of: [{ word: "andare" }] }],
  }),
  record({ word: "vado", pos: "verb", pos_title: "Voce verbale", tags: ["form-of"], senses: [{ glosses: [VADO_SOURCE] }] }),
  record({ word: "fate", pos: "verb", pos_title: "Voce verbale", tags: ["form-of"], senses: [{ glosses: [FATE_SOURCE] }] }),
  record({ word: "pittore", pos: "noun", pos_title: "Sostantivo", tags: ["masculine"], senses: [{ glosses: ["chi dipinge"] }] }),
];
const FILLERS = Array.from({ length: 60 }, (_, i) =>
  record({ word: `parola${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`, pos: "noun", pos_title: "Sostantivo", senses: [{ glosses: ["una parola"] }] }),
);

const NORMALIZE = { command: "normalize:source-text", inputs: { rules: [...SOURCE_TEXT_UPDATE_RULES] } };
/** What `normalize:source-text` plans on the dictionary `beforeTheRules` leaves (test/planOnly.test.ts). */
const NORMALIZE_COUNTS = { records: { added: 0, changed: 3, removed: 0 }, written: { sense_gloss: 2 }, deleted: { lookup_form: 1, grammar_claim: 1 } };

/** As a seed before the source text rules: the source's glosses, and a lookup row and a form claim for the plural template. */
function beforeTheRules(db: DatabaseSync): void {
  db.prepare("UPDATE sense_gloss SET text = ? WHERE text = ?").run(VADO_SOURCE, VADO_STORED);
  db.prepare("UPDATE sense_gloss SET text = ? WHERE text = ?").run(FATE_SOURCE, FATE_STORED);
  const { record_id: pittore } = db.prepare("SELECT record_id FROM source_record WHERE word = 'pittore'").get() as { record_id: number };
  db.prepare(`INSERT INTO lookup_form (record_id, release_id, origin, surface, surface_key, json_pointer, form_index, form_source)
              VALUES (?, ?, 'embedded-form', ?, ?, '/forms/0/form', 0, NULL)`).run(pittore, RELEASE, PLURAL_PLACEHOLDER_FORM, PLURAL_PLACEHOLDER_FORM);
  db.prepare(`INSERT INTO grammar_claim (record_id, scope, scope_index, json_pointer, status, dimension, value, source_text)
              VALUES (?, 'form', 0, '/forms/0/tags/0', 'stated', 'number', 'plural', 'plural')`).run(pittore);
}

/** The archive a world's dictionary is seeded from, gzipped as a released archive is. */
const archiveOf = (dir: string): string => join(dir, "fixture.jsonl.gz");

async function seeded(dir: string, lines: readonly string[]): Promise<DatabaseSync> {
  const input = archiveOf(dir);
  await writeFile(input, gzipSync(`${lines.join("\n")}\n`));
  const report = await seedSql({
    input, outputDir: join(dir, "sql"), schema: resolve("src/db/schema.sql"), releaseId: RELEASE,
    requiredWords: [], validateFixtureClosure: false,
  });
  const db = new DatabaseSync(":memory:");
  for (const part of report.parts) db.exec(await readFile(part, "utf8"));
  beforeTheRules(db);
  return db;
}

/** Git with a fixed author and no signing, so a commit never depends on the machine's config. */
function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", ...args], {
    cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

interface World {
  readonly dir: string;
  readonly d1: LocalD1;
  readonly work: string;
  readonly origin: string;
  /** Commit `files` to main and push it; returns the commit. */
  commit(files: Record<string, string>): Promise<string>;
  /** Where `production` is on the remote. */
  production(): string;
  /** `deployDictionary`'s dependencies for a run on `head`, recording every step and every bookmark. */
  deps(head: string, extra?: Partial<DeployDeps>): DeployDeps & { steps: DeployStep[]; bookmarks: number[] };
}

async function withWorld(run: (world: World) => Promise<void>, lines: readonly string[] = [...LINES, ...FILLERS]): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "lexema-deploy-"));
  const db = await seeded(dir, lines);
  try {
    const d1 = localD1(dir, db);
    const origin = join(dir, "origin.git");
    const work = join(dir, "work");
    git(dir, "init", "--bare", "--initial-branch=main", origin);
    git(dir, "clone", origin, work);
    git(work, "checkout", "-B", "main");
    const world: World = {
      dir, d1, work, origin,
      async commit(files) {
        for (const [path, text] of Object.entries(files)) {
          await mkdir(dirname(join(work, path)), { recursive: true });
          await writeFile(join(work, path), text);
        }
        git(work, "add", "--all");
        git(work, "commit", "--allow-empty", "-m", "change");
        git(work, "push", "origin", "main");
        return git(work, "rev-parse", "HEAD");
      },
      production: () => git(origin, "rev-parse", `refs/heads/${PRODUCTION_BRANCH}`),
      deps(head, extra = {}) {
        const steps: DeployStep[] = [];
        const bookmarks: number[] = [];
        return {
          git: gitIn(work),
          head,
          target: d1.target,
          reader: masterReaderOf(d1.target),
          bookmark: () => {
            bookmarks.push(writes(d1).length);
            return `bookmark-${bookmarks.length}`;
          },
          fetcher: async (path) => assert.fail(`nothing should be fetched, asked for ${path}`),
          workDir: join(dir, "run"),
          onStep: (step) => steps.push(step),
          steps,
          bookmarks,
          ...extra,
        };
      },
    };
    const base = await world.commit({ "dictionary-changes/README.md": "# Change declarations\n" });
    git(work, "push", "origin", `${base}:refs/heads/${PRODUCTION_BRANCH}`);
    await run(world);
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
}

/** The calls that write: an import, or a query-API batch (src/deploy/d1Batch.ts). Reads carry --json first. */
const writes = (d1: LocalD1): string[][] => d1.calls.filter((call) => call[0] === "--file" || call[0].startsWith("--command="));

/** The SQL of a query-API batch, sent as the one argument `--command=<sql>`; any other call fails the test. */
const commandSql = (call: readonly string[]): string => {
  assert.equal(call.length, 1, `a query-API batch is one argument, got ${JSON.stringify(call)}`);
  assert.ok(call[0].startsWith("--command="), `not a query-API batch: ${call[0].slice(0, 40)}`);
  return call[0].slice("--command=".length);
};

const glosses = (d1: LocalD1): string[] => {
  const db = d1.open();
  try {
    return (db.prepare("SELECT text FROM sense_gloss WHERE text LIKE '%persona%' ORDER BY gloss_id").all() as { text: string }[]).map(({ text }) => text);
  } finally {
    db.close();
  }
};

const declaration = (change: object, counts: object = NORMALIZE_COUNTS): string => `${JSON.stringify({ ...change, expected: counts }, null, 2)}\n`;

test("a push adding one declaration records a bookmark, plans, applies, reads back, looks up the words and then fast-forwards production", async () => {
  await withWorld(async (world) => {
    const head = await world.commit({ "dictionary-changes/2026-10-normalize.json": declaration(NORMALIZE) });
    const deps = world.deps(head);
    const outcome = await deployDictionary(deps);

    assert.equal(outcome.kind, "green", deploySummary(outcome, "lexema"));
    assert.deepEqual(deps.steps, [...DEPLOY_STEPS]);
    assert.deepEqual(deps.bookmarks, [0], "one bookmark, taken before any write");
    assert.equal(writes(world.d1).length, 1, "the change ran as one batch");
    const after = glosses(world.d1);
    assert.ok(after.includes(VADO_STORED) && after.includes(FATE_STORED), after.join("\n"));
    assert.ok(!after.includes(VADO_SOURCE) && !after.includes(FATE_SOURCE), after.join("\n"));
    assert.equal(world.production(), head);
    if (outcome.kind === "green") {
      assert.equal(outcome.bookmark, "bookmark-1");
      assert.deepEqual(outcome.changes.map(({ file, ran, counts }) => [file, ran, counts.toJSON()]), [["dictionary-changes/2026-10-normalize.json", true, NORMALIZE_COUNTS]]);
    }
    assert.match(deploySummary(outcome, "lexema-dictionary"), /`production` is now/);
  });
});

test("the run logs the bookmark and its restore command as soon as it is taken, before the first write", async () => {
  await withWorld(async (world) => {
    const head = await world.commit({ "dictionary-changes/2026-10-normalize.json": declaration(NORMALIZE) });
    const log: { line: string; writesBefore: number }[] = [];
    const deps = world.deps(head, deployLog((line) => log.push({ line, writesBefore: writes(world.d1).length }), "lexema-dictionary"));
    const outcome = await deployDictionary(deps);

    assert.equal(outcome.kind, "green", deploySummary(outcome, "lexema-dictionary"));
    const bookmarkLines = log.filter(({ line }) => line.startsWith("bookmark: bookmark-1 "));
    assert.equal(bookmarkLines.length, 1, log.map(({ line }) => line).join(""));
    assert.equal(bookmarkLines[0]?.writesBefore, 0, "logged before any write");
    assert.ok(bookmarkLines[0]?.line.includes(restoreCommand("lexema-dictionary", "bookmark-1")), bookmarkLines[0]?.line);
    assert.ok(log.findIndex(({ line }) => line.startsWith("bookmark: ")) < log.findIndex(({ line }) => line.startsWith("apply: ")), "logged before the apply step");
    assert.equal(writes(world.d1).length, 1);
  });
});

test("a push adding no declaration writes nothing to the dictionary and fast-forwards production", async () => {
  await withWorld(async (world) => {
    // A declaration that only changes, and a file beside the declarations, are not declarations added.
    await world.commit({ "dictionary-changes/2026-10-normalize.json": declaration(NORMALIZE) });
    git(world.work, "push", "origin", `HEAD:refs/heads/${PRODUCTION_BRANCH}`);
    const head = await world.commit({ "dictionary-changes/2026-10-normalize.json": declaration(NORMALIZE, { records: { added: 0, changed: 0, removed: 0 } }), "dictionary-changes/notes.md": "x\n", "README.md": "x\n" });
    const before = world.d1.sha256();
    const deps = world.deps(head);
    const outcome = await deployDictionary(deps);

    assert.equal(outcome.kind, "green", deploySummary(outcome, "lexema"));
    assert.deepEqual(deps.steps, ["pending", "production"]);
    assert.deepEqual(deps.bookmarks, []);
    assert.deepEqual(world.d1.calls, [], "the dictionary was not even read");
    assert.equal(world.d1.sha256(), before);
    assert.equal(world.production(), head);
    assert.match(deploySummary(outcome, "lexema-dictionary"), /No change declaration was added, so nothing was written/);

    // A second run on the same commit has nothing to do.
    assert.equal((await deployDictionary(world.deps(head))).kind, "deployed-already");
  });
});

test("a plan whose counts differ from the declaration stops red before any write and leaves production unmoved", async () => {
  await withWorld(async (world) => {
    const base = world.production();
    const head = await world.commit({ "dictionary-changes/2026-10-normalize.json": declaration(NORMALIZE, { ...NORMALIZE_COUNTS, written: { sense_gloss: 3 } }) });
    const before = world.d1.sha256();
    const deps = world.deps(head);
    const outcome = await deployDictionary(deps);

    assert.equal(outcome.kind, "red");
    assert.deepEqual(deps.steps, ["pending", "fetch", "bookmark", "upgrade", "plan"]);
    assert.deepEqual(writes(world.d1), []);
    assert.equal(world.d1.sha256(), before);
    assert.equal(world.production(), base);
    if (outcome.kind === "red") {
      assert.equal(outcome.written, false);
      assert.deepEqual(outcome.reasons, ["dictionary-changes/2026-10-normalize.json: written.sense_gloss is 2 in the plan, 3 declared"]);
    }
    const summary = deploySummary(outcome, "lexema-dictionary");
    assert.match(summary, /Nothing was written to `lexema-dictionary`/);
    assert.doesNotMatch(summary, /time-travel restore/);
  });
});

test("a plan that crosses a hard limit stops red before any write, even when its counts match the declaration", async () => {
  // Without the other records, changing three is more than 5% of the dictionary.
  await withWorld(async (world) => {
    const base = world.production();
    const head = await world.commit({ "dictionary-changes/2026-10-normalize.json": declaration(NORMALIZE) });
    const before = world.d1.sha256();
    const outcome = await deployDictionary(world.deps(head));

    assert.equal(outcome.kind, "red");
    if (outcome.kind === "red") assert.deepEqual(outcome.reasons, [`dictionary-changes/2026-10-normalize.json: the plan changes or removes 3 of ${LINES.length} records, more than 5%`]);
    assert.deepEqual(writes(world.d1), []);
    assert.equal(world.d1.sha256(), before);
    assert.equal(world.production(), base);
  }, LINES);
});

test("a read-back mismatch turns the run red, names the bookmark and the restore command, and restores nothing", async () => {
  await withWorld(async (world) => {
    const base = world.production();
    const head = await world.commit({ "dictionary-changes/2026-10-normalize.json": declaration(NORMALIZE) });
    // A file that is accepted and does not land: what a read-back is for.
    const lost: string[][] = [];
    const target = { dictionary: "lexema-dictionary", execute: (args: readonly string[], capture: boolean) => (args[0] === "--json" ? world.d1.target.execute(args, capture) : (lost.push([...args]), "")) };
    const deps = world.deps(head, { target });
    const outcome = await deployDictionary(deps);

    assert.equal(outcome.kind, "red");
    assert.deepEqual(deps.steps, ["pending", "fetch", "bookmark", "upgrade", "plan", "apply", "read-back"]);
    assert.equal(lost.length, 1);
    assert.deepEqual(deps.bookmarks, [0], "one bookmark, and no restore");
    assert.ok(world.d1.calls.every((call) => call[0] === "--json"), "after the read-back only reads reached the dictionary");
    assert.equal(world.production(), base);
    if (outcome.kind === "red") {
      assert.equal(outcome.written, true);
      assert.deepEqual(outcome.reasons, ["dictionary-changes/2026-10-normalize.json: 5 source text change(s) still pending after the file ran"]);
    }
    const summary = deploySummary(outcome, "lexema-dictionary");
    assert.ok(summary.includes("`bookmark-1`"), summary);
    assert.ok(summary.includes(restoreCommand("lexema-dictionary", "bookmark-1")), summary);
    assert.equal(restoreCommand("lexema-dictionary", "bookmark-1"), "pnpm --dir web exec wrangler d1 time-travel restore lexema-dictionary --bookmark=bookmark-1");
    assert.match(summary, /Nothing restores by itself/);
  });
});

test("a word-lookup mismatch turns the run red and names the bookmark and the restore command", async () => {
  await withWorld(async (world) => {
    const base = world.production();
    const head = await world.commit({ "dictionary-changes/2026-10-normalize.json": declaration(NORMALIZE) });
    const deps = world.deps(head, { words: [...WORD_LIST, "inesistentissimo"] });
    const outcome = await deployDictionary(deps);

    assert.equal(outcome.kind, "red");
    assert.deepEqual(deps.steps, ["pending", "fetch", "bookmark", "upgrade", "plan", "apply", "read-back", "word-lookup"]);
    assert.equal(world.production(), base);
    if (outcome.kind === "red") assert.deepEqual(outcome.reasons, ["word lookup: inesistentissimo: not-found, not found with a reading"]);
    assert.ok(deploySummary(outcome, "lexema-dictionary").includes(restoreCommand("lexema-dictionary", "bookmark-1")));
  });
});

/** The tables the upgrade creates for page-only entries, in the order a drop needs. */
const PAGE_ENTRY_UPGRADE_TABLES = [...PAGE_ENTRY_TABLES, ...PAGE_ENTRY_FACT_TABLES, ...PAGE_ENTRY_CORRECTION_TABLES];

/** Leave the dictionary as the live one was before #507: without the page-entry tables and `corrected_definition`. */
function withoutPageEntryTables(d1: LocalD1): void {
  const db = d1.open();
  try {
    for (const table of [...PAGE_ENTRY_UPGRADE_TABLES].reverse()) db.exec(`DROP TABLE ${table}`);
  } finally {
    db.close();
  }
}

test("a dictionary without the page-entry tables gets the upgrade as its own batch, before any data, and the run goes green", async () => {
  await withWorld(async (world) => {
    withoutPageEntryTables(world.d1);
    const head = await world.commit({ "dictionary-changes/2026-10-normalize.json": declaration(NORMALIZE) });
    const deps = world.deps(head);
    const outcome = await deployDictionary(deps);

    assert.equal(outcome.kind, "green", deploySummary(outcome, "lexema-dictionary"));
    assert.deepEqual(deps.steps, [...DEPLOY_STEPS]);
    const [ddl, data, ...rest] = writes(world.d1);
    assert.deepEqual(rest, []);
    // Both batches are small, so both go through the query API.
    const [ddlSql, dataSql] = [commandSql(ddl), commandSql(data)];
    assert.match(ddlSql, /CREATE TABLE IF NOT EXISTS recovered_entry\b/);
    assert.match(ddlSql, /CREATE TABLE IF NOT EXISTS corrected_definition\b/);
    assert.doesNotMatch(ddlSql, /^\s*(INSERT|UPDATE|DELETE)\b/m);
    assert.doesNotMatch(dataSql, /\bCREATE\b/);
    if (outcome.kind === "green") assert.deepEqual(outcome.upgraded, { added: [...PAGE_ENTRY_UPGRADE_TABLES, ...PAGE_ENTRY_INDEXES], changed: [], rebuilt: [], replaced: [] });
    assert.match(deploySummary(outcome, "lexema-dictionary"), /The upgrade ran first and added `recovered_entry`/);

    // The next run finds nothing missing and runs no DDL.
    const next = await world.commit({ "dictionary-changes/2026-10-normalize-again.json": declaration(NORMALIZE, { records: { added: 0, changed: 0, removed: 0 } }) });
    const again = await deployDictionary(world.deps(next));
    assert.equal(again.kind, "green", deploySummary(again, "lexema-dictionary"));
    if (again.kind === "green") assert.deepEqual(again.upgraded, { added: [], changed: [], rebuilt: [], replaced: [] });
    assert.equal(writes(world.d1).length, 2);
  });
});

/**
 * Give the dictionary older definitions of two page-entry tables, holding rows:
 * `recovered_entry` without its `page_line` CHECK, and `corrected_definition`
 * with the one 52-byte GLOB it had before #489.
 */
async function withOlderPageEntryTables(d1: LocalD1): Promise<void> {
  const schema = await readFile("src/db/schema.sql", "utf8");
  const older: Record<string, string> = {
    recovered_entry: createStatement(schema, "TABLE", "recovered_entry").replace("page_line INTEGER NOT NULL CHECK (page_line > 0)", "page_line INTEGER NOT NULL"),
    corrected_definition: createStatement(schema, "TABLE", "corrected_definition").replace(/GLOB 'https:\/\/\*'\s+AND evidence_url GLOB '\*/, "GLOB 'https://*"),
  };
  assert.match(older.corrected_definition, /GLOB 'https:\/\/\*\.wiktionary\.org\/w\/index\.php\?title=\*&oldid=\*'/);
  assert.doesNotMatch(older.recovered_entry, /CHECK \(page_line > 0\)/);
  const db = d1.open();
  try {
    for (const table of [...PAGE_ENTRY_UPGRADE_TABLES].reverse()) db.exec(`DROP TABLE ${table}`);
    for (const table of PAGE_ENTRY_UPGRADE_TABLES) db.exec(older[table] ?? createStatement(schema, "TABLE", table));
    db.exec(createStatement(schema, "INDEX", "recovered_entry_by_key"));
    db.prepare("INSERT INTO raw_page VALUES (900001, ?, 'it.wiktionary.org', 'scrivere', 4100, '2026-09-01T00:00:00Z')").run(RELEASE);
    db.prepare("INSERT INTO recovered_entry VALUES (1, ?, 900001, 'scrivere', 'scrivere', 'verb', 'Verbo', 'italian-page-entry/v1', 3, '{{-verb-|it}}')").run(RELEASE);
    db.exec("INSERT INTO entry_definition VALUES (1, 0, 'sense-line', NULL, 4, '# tracciare segni', 'tracciare segni', NULL)");
    db.exec("INSERT INTO entry_label VALUES (1, 0, 0, 'letteralmente')");
    db.exec("INSERT INTO entry_example VALUES (1, 0, 0, 5, '#* scrivo una lettera', 'scrivo una lettera')");
    db.exec("INSERT INTO corrected_definition VALUES (1, 0, 'tracciare lettere', 'page:4100:0', 'https://it.wiktionary.org/w/index.php?title=scrivere&oldid=4100')");
  } finally {
    db.close();
  }
}

/** Every row of every page-entry table, as JSON. */
function pageEntryRows(d1: LocalD1): string {
  const db = d1.open();
  try {
    return JSON.stringify(PAGE_ENTRY_UPGRADE_TABLES.map((table) => db.prepare(`SELECT * FROM ${table} ORDER BY 1, 2`).all()));
  } finally {
    db.close();
  }
}

test("a dictionary holding an older definition of a page-entry table gets schema.sql's from the deploy, with every row kept, before any data", async () => {
  await withWorld(async (world) => {
    await withOlderPageEntryTables(world.d1);
    const rows = pageEntryRows(world.d1);
    const schema = await readFile("src/db/schema.sql", "utf8");
    assert.deepEqual(changedUpgrade(masterReaderOf(world.d1.target), schema), ["recovered_entry", "corrected_definition"]);

    const head = await world.commit({ "dictionary-changes/2026-10-normalize.json": declaration(NORMALIZE) });
    const deps = world.deps(head);
    const outcome = await deployDictionary(deps);

    assert.equal(outcome.kind, "green", deploySummary(outcome, "lexema-dictionary"));
    assert.deepEqual(deps.steps, [...DEPLOY_STEPS]);
    if (outcome.kind === "green") assert.deepEqual(outcome.upgraded, { added: [], changed: ["recovered_entry", "corrected_definition"], rebuilt: PAGE_ENTRY_UPGRADE_TABLES, replaced: [] });
    assert.match(
      deploySummary(outcome, "lexema-dictionary"),
      /rebuilt `recovered_entry`, `entry_definition`, `entry_label`, `entry_example`, `entry_fact`, `corrected_definition`, keeping their rows, for the changed definition of `recovered_entry`, `corrected_definition`/,
    );
    const [ddl, data, ...rest] = writes(world.d1);
    assert.deepEqual(rest, []);
    assert.match(commandSql(ddl), /CREATE TABLE upgrade_kept_recovered_entry AS SELECT \* FROM recovered_entry;/);
    assert.doesNotMatch(commandSql(data), /\bCREATE\b/);

    // The stored definitions are schema.sql's now, the rows are the same, and every foreign key holds.
    assert.deepEqual(changedUpgrade(masterReaderOf(world.d1.target), schema), []);
    assert.equal(pageEntryRows(world.d1), rows);
    const db = world.d1.open();
    try {
      assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
      assert.deepEqual(db.prepare("SELECT name FROM sqlite_schema WHERE name LIKE 'upgrade_kept_%'").all(), []);
      assert.throws(
        () => db.exec("INSERT INTO recovered_entry VALUES (2, 'it-test', 900001, 'leggere', 'leggere', 'verb', 'Verbo', 'italian-page-entry/v1', 0, '')"),
        /CHECK constraint failed/,
        "the new definition's page_line CHECK holds",
      );
    } finally {
      db.close();
    }

    // The next run finds every definition current and rebuilds nothing.
    const next = await world.commit({ "dictionary-changes/2026-10-normalize-again.json": declaration(NORMALIZE, { records: { added: 0, changed: 0, removed: 0 } }) });
    const again = await deployDictionary(world.deps(next));
    assert.equal(again.kind, "green", deploySummary(again, "lexema-dictionary"));
    if (again.kind === "green") assert.deepEqual(again.upgraded, { added: [], changed: [], rebuilt: [], replaced: [] });
    assert.equal(writes(world.d1).length, 2);
  });
});

test("a dictionary holding only an older serving view gets it replaced by the upgrade batch, which rebuilds no table (#525)", async () => {
  await withWorld(async (world) => {
    const schema = await readFile("src/db/schema.sql", "utf8");
    const current = createStatement(schema, "VIEW", "surface_hit");
    const older = current.replace(/^\s*lf\.form_source,\n/m, "");
    assert.notEqual(older, current);
    const db = world.d1.open();
    try {
      db.exec("DROP VIEW surface_hit");
      db.exec(older);
    } finally {
      db.close();
    }
    assert.deepEqual(changedUpgrade(masterReaderOf(world.d1.target), schema), []);
    assert.deepEqual(changedViews(masterReaderOf(world.d1.target), schema), ["surface_hit"]);

    const head = await world.commit({ "dictionary-changes/2026-10-normalize.json": declaration(NORMALIZE) });
    const details: [DeployStep, string][] = [];
    const outcome = await deployDictionary(world.deps(head, { onStep: (step, detail) => details.push([step, detail]) }));

    assert.equal(outcome.kind, "green", deploySummary(outcome, "lexema-dictionary"));
    assert.deepEqual(details.find(([step]) => step === "upgrade"), ["upgrade", "replace view surface_hit"]);
    if (outcome.kind === "green") assert.deepEqual(outcome.upgraded, { added: [], changed: [], rebuilt: [], replaced: ["surface_hit"] });
    const summary = deploySummary(outcome, "lexema-dictionary");
    assert.match(summary, /The upgrade ran first and replaced the view\(s\) `surface_hit` with schema\.sql's definition\. A view holds no rows, so no table was rebuilt for it\./);
    assert.doesNotMatch(summary, /rebuilt `/);
    const [ddl, data, ...rest] = writes(world.d1);
    assert.deepEqual(rest, []);
    assert.match(commandSql(ddl), /DROP VIEW IF EXISTS surface_hit;/);
    assert.doesNotMatch(commandSql(ddl), /DROP TABLE|upgrade_kept_/);
    assert.doesNotMatch(commandSql(data), /\bCREATE\b/);
    assert.deepEqual(changedViews(masterReaderOf(world.d1.target), schema), []);

    // The next run finds the view current and runs no DDL.
    const next = await world.commit({ "dictionary-changes/2026-10-normalize-again.json": declaration(NORMALIZE, { records: { added: 0, changed: 0, removed: 0 } }) });
    const again = await deployDictionary(world.deps(next));
    assert.equal(again.kind, "green", deploySummary(again, "lexema-dictionary"));
    if (again.kind === "green") assert.deepEqual(again.upgraded, { added: [], changed: [], rebuilt: [], replaced: [] });
    assert.equal(writes(world.d1).length, 2);
  });
});

test("a first batch D1 refuses leaves the run red with nothing written, and the summary names no restore", async () => {
  await withWorld(async (world) => {
    const base = world.production();
    const head = await world.commit({ "dictionary-changes/2026-10-normalize.json": declaration(NORMALIZE) });
    const before = world.d1.sha256();
    // What the live run met (#507): D1 rolled the batch back and Wrangler exited non-zero.
    const refused: string[][] = [];
    const target = {
      dictionary: "lexema-dictionary",
      execute: (args: readonly string[], capture: boolean) => {
        if (args[0] === "--json") return world.d1.target.execute(args, capture);
        refused.push([...args]);
        throw new Error('{"D1_RESET_DO":true}');
      },
    };
    const deps = world.deps(head, { target });
    const outcome = await deployDictionary(deps);

    assert.equal(outcome.kind, "red");
    assert.deepEqual(deps.steps, ["pending", "fetch", "bookmark", "upgrade", "plan", "apply"]);
    assert.equal(refused.length, 1);
    assert.equal(world.d1.sha256(), before);
    assert.equal(world.production(), base);
    if (outcome.kind === "red") {
      assert.equal(outcome.written, false);
      assert.deepEqual(outcome.reasons, ['{"D1_RESET_DO":true}']);
    }
    const summary = deploySummary(outcome, "lexema-dictionary");
    assert.match(summary, /Nothing was written to `lexema-dictionary`/);
    assert.doesNotMatch(summary, /Something was written/);
    assert.doesNotMatch(summary, /time-travel restore/);
  });
});

test("a batch D1 refuses after an earlier batch landed still reports the write, with the restore command", async () => {
  await withWorld(async (world) => {
    withoutPageEntryTables(world.d1);
    const head = await world.commit({ "dictionary-changes/2026-10-normalize.json": declaration(NORMALIZE) });
    let sent = 0;
    const target = {
      dictionary: "lexema-dictionary",
      execute: (args: readonly string[], capture: boolean) => {
        if (args[0] !== "--json" && ++sent > 1) throw new Error('{"D1_RESET_DO":true}');
        return world.d1.target.execute(args, capture);
      },
    };
    const outcome = await deployDictionary(world.deps(head, { target }));

    assert.equal(outcome.kind, "red");
    if (outcome.kind === "red") {
      assert.equal(outcome.written, true);
      assert.deepEqual(outcome.upgraded, { added: [...PAGE_ENTRY_UPGRADE_TABLES, ...PAGE_ENTRY_INDEXES], changed: [], rebuilt: [], replaced: [] });
    }
    assert.equal(writes(world.d1).length, 1, "only the upgrade reached the dictionary");
    const summary = deploySummary(outcome, "lexema-dictionary");
    assert.match(summary, /Something was written to `lexema-dictionary`/);
    assert.ok(summary.includes(restoreCommand("lexema-dictionary", "bookmark-1")), summary);
  });
});

test("a correct:records declaration whose counts match is applied with no fetched file, reads back and goes green; one whose counts differ stops red before any write", async () => {
  const lines = [...LINES, ...FILLERS, ...(await correctionFixtureLines())];
  const corrections = atFixtureLines(lines, RELEASE).slice(0, 2);
  const rows = corrections.reduce((sum, correction) => sum + correctedClaimValues(correction).length, 0);
  const counts = { records: { added: 0, changed: 2, removed: 0 }, written: { corrected_claim: rows, correction_version: 1 }, deleted: {} };
  const CORRECT = { command: "correct:records" };

  await withWorld(async (world) => {
    const base = world.production();
    const wrong = await world.commit({ "dictionary-changes/2026-10-correct.json": declaration(CORRECT, { ...counts, written: { corrected_claim: rows + 1, correction_version: 1 } }) });
    const before = world.d1.sha256();
    const refused = await deployDictionary(world.deps(wrong, { corrections }));
    assert.equal(refused.kind, "red");
    if (refused.kind === "red") {
      assert.equal(refused.written, false);
      assert.deepEqual(refused.reasons, [`dictionary-changes/2026-10-correct.json: written.corrected_claim is ${rows} in the plan, ${rows + 1} declared`]);
    }
    assert.deepEqual(writes(world.d1), []);
    assert.equal(world.d1.sha256(), before);
    assert.equal(world.production(), base);
  }, lines);

  await withWorld(async (world) => {
    const head = await world.commit({ "dictionary-changes/2026-10-correct.json": declaration(CORRECT, counts) });
    const deps = world.deps(head, { corrections });
    const outcome = await deployDictionary(deps);

    assert.equal(outcome.kind, "green", deploySummary(outcome, "lexema-dictionary"));
    assert.deepEqual(deps.steps, [...DEPLOY_STEPS]);
    assert.equal(writes(world.d1).length, 1, "the corrections ran as one batch, and the read-back step's `unwritten` found them all");
    const db = world.d1.open();
    try {
      assert.equal((db.prepare("SELECT count(*) AS n FROM corrected_claim").get() as { n: number }).n, rows);
    } finally {
      db.close();
    }
    assert.equal(world.production(), head);
    if (outcome.kind === "green") assert.deepEqual(outcome.changes.map(({ command, ran, counts: planned }) => [command, ran, planned.toJSON()]), [["correct:records", true, counts]]);
  }, lines);
});

test("correct:records and hide:records declarations on a dictionary without their tables get them from the upgrade batch, and their data batches hold no DDL (#509)", async () => {
  const foreignLemma = (await readFile("fixtures/form-of-foreign-lemma/archive-lines.jsonl", "utf8")).trimEnd().split("\n");
  const lines = [...LINES, ...FILLERS, ...(await correctionFixtureLines()), ...foreignLemma];
  const corrections = atFixtureLines(lines, RELEASE).slice(0, 2);
  const created = ["correction_version", "corrected_claim", "hide_version", "hidden_record"];

  await withWorld(async (world) => {
    // A dictionary seeded before #382 and #420: none of the four tables.
    const db = world.d1.open();
    try {
      for (const table of created) db.exec(`DROP TABLE ${table}`);
    } finally {
      db.close();
    }
    // The master's archive and an empty dump, as povlabs/lexema-data would serve them.
    const archive = await readFile(archiveOf(world.dir));
    const sha256 = createHash("sha256").update(archive).digest("hex");
    const releaseId = `it-${sha256.slice(0, 8)}`;
    const dumpBytes = Buffer.from("<mediawiki>\n</mediawiki>\n");
    const source = join(world.dir, "lexema-data", "source");
    await mkdir(source, { recursive: true });
    await writeFile(join(source, `${releaseId}.jsonl.gz`), archive);
    await writeFile(join(source, "itwiktionary-20991001-pages-articles.xml"), dumpBytes);
    const sources = {
      catalog: { [sha256]: { sourceUrl: "https://example.invalid/fixture.jsonl.gz", retrievedAt: "2099-10-02T00:00:00Z", dump: { id: "itwiktionary-20991001", basis: "recorded" }, evidence: [] } } as unknown as Record<string, never>,
      dumps: { "itwiktionary-20991001": { file: "itwiktionary-20991001-pages-articles.xml", bytes: dumpBytes.length, sha1: createHash("sha1").update(dumpBytes).digest("hex") } },
      fetcher: (async (path, to) => {
        await mkdir(dirname(to), { recursive: true });
        await copyFile(join(world.dir, "lexema-data", path), to);
      }) satisfies DataFetcher,
      corrections,
    };
    const CORRECT = { command: "correct:records" };
    const HIDE = { command: "hide:records", inputs: { archive: releaseId, rules: ["section-language/v1", "form-of-foreign-lemma/v1"] } };
    // Planned before the upgrade, as the pull request plan check plans them against the live dictionary.
    const planned = async (change: object) =>
      (await planOnly(parseChange("test", JSON.stringify(change)), { reader: masterReaderOf(world.d1.target), workDir: join(world.dir, "plan"), ...sources })).counts.toJSON();
    const correctCounts = await planned(CORRECT);
    const hideCounts = await planned(HIDE);
    assert.equal(correctCounts.records.changed, 2);
    assert.equal(hideCounts.records.removed, 1, "zapateros, which form-of-foreign-lemma/v1 hides");
    assert.deepEqual(writes(world.d1), []);

    const head = await world.commit({
      "dictionary-changes/2026-10-a-correct.json": declaration(CORRECT, correctCounts),
      "dictionary-changes/2026-10-b-hide.json": declaration(HIDE, hideCounts),
    });
    const deps = world.deps(head, sources);
    const outcome = await deployDictionary(deps);

    assert.equal(outcome.kind, "green", deploySummary(outcome, "lexema-dictionary"));
    if (outcome.kind === "green") {
      assert.deepEqual(outcome.upgraded, { added: created, changed: [], rebuilt: [], replaced: [] });
      assert.deepEqual(outcome.changes.map(({ command, ran }) => [command, ran]), [["correct:records", true], ["hide:records", true]]);
    }
    const [ddl, ...data] = writes(world.d1).map(commandSql);
    for (const table of created) assert.match(ddl, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`), table);
    assert.doesNotMatch(ddl, /^\s*(INSERT|UPDATE|DELETE)\b/m);
    assert.equal(data.length, 2);
    assert.match(data[0], /INSERT INTO corrected_claim/);
    assert.match(data[1], /INSERT INTO hidden_record/);
    for (const sql of data) assert.doesNotMatch(sql, /\b(CREATE|DROP|ALTER)\b/);
  }, lines);
});

/** An archive and a dump, and the catalogs that name them, for a release made up for the test. */
async function madeUpRelease(dir: string): Promise<{ data: string; catalog: Record<string, never>; dumps: Record<string, { file: string; bytes: number; sha1: string }>; releaseId: `it-${string}`; fetcher: DataFetcher }> {
  const data = join(dir, "lexema-data");
  const archiveBytes = Buffer.from(`${LINES[0]}\n`);
  const dumpBytes = Buffer.from("<mediawiki></mediawiki>\n");
  const sha256 = createHash("sha256").update(archiveBytes).digest("hex");
  const releaseId = `it-${sha256.slice(0, 8)}` as const;
  await mkdir(join(data, "source"), { recursive: true });
  await writeFile(join(data, "source", `${releaseId}.jsonl.gz`), archiveBytes);
  await writeFile(join(data, "source", "itwiktionary-20991001-pages-articles.xml.bz2"), dumpBytes);
  const catalog = {
    [sha256]: { sourceUrl: "https://example.invalid/it-extract.jsonl.gz", retrievedAt: "2099-10-02T00:00:00Z", dump: { id: "itwiktionary-20991001", basis: "recorded" }, evidence: [] },
  } as unknown as Record<string, never>;
  const dumps = { "itwiktionary-20991001": { file: "itwiktionary-20991001-pages-articles.xml.bz2", bytes: dumpBytes.length, sha1: createHash("sha1").update(dumpBytes).digest("hex") } };
  const fetcher: DataFetcher = async (path, to) => {
    await mkdir(dirname(to), { recursive: true });
    await copyFile(join(data, path), to);
  };
  return { data, catalog, dumps, releaseId, fetcher };
}

test("an archive or a dump whose checksum does not match is refused before any write", async () => {
  await withWorld(async (world) => {
    const release = await madeUpRelease(world.dir);
    const change = { command: "update:auto", inputs: { feedRelease: release.releaseId } };
    const files = filesFor(parseChange("test", JSON.stringify(change)), release.catalog, release.dumps);
    assert.ok(files !== null);
    assert.equal(files.archive.path, `source/${release.releaseId}.jsonl.gz`);
    assert.equal(files.dump.path, "source/itwiktionary-20991001-pages-articles.xml.bz2");
    // The right bytes pass.
    await fetchVerified(files, release.fetcher, join(world.dir, "fetched"));

    const base = world.production();
    const head = await world.commit({ "dictionary-changes/2099-10-feed.json": declaration(change) });
    const before = world.d1.sha256();
    for (const [path, wrong] of [[files.archive.path, "not the archive\n"], [files.dump.path, "not the dump\n"]] as const) {
      const original = await readFile(join(release.data, path));
      await writeFile(join(release.data, path), wrong);
      const deps = world.deps(head, { fetcher: release.fetcher, catalog: release.catalog, dumps: release.dumps });
      const outcome = await deployDictionary(deps);
      await writeFile(join(release.data, path), original);

      assert.equal(outcome.kind, "red");
      assert.deepEqual(deps.steps, ["pending", "fetch"]);
      assert.deepEqual(deps.bookmarks, []);
      if (outcome.kind === "red") {
        assert.equal(outcome.written, false);
        assert.equal(outcome.reasons.length, 1);
        assert.ok(outcome.reasons[0].startsWith(path), outcome.reasons[0]);
      }
    }
    assert.deepEqual(world.d1.calls, []);
    assert.equal(world.d1.sha256(), before);
    assert.equal(world.production(), base);

    // A release no archive facts name has no checksum to be held to.
    assert.throws(() => filesFor(parseChange("test", JSON.stringify({ command: "update:auto", inputs: { feedRelease: "it-00000000" } }))), DataRefused);
  });
});

test("the master's archive is read from source/it-extract.jsonl.gz, and a feed's from source/<release id>.jsonl.gz", () => {
  const hide = filesFor(parseChange("test", JSON.stringify({ command: "hide:records", inputs: { archive: "it-0c432803", rules: ["section-language/v1", "form-of-foreign-lemma/v1"] } })));
  assert.deepEqual(hide?.archive.path, "source/it-extract.jsonl.gz");
  assert.deepEqual(hide?.dump.path, "source/itwiktionary-20260701-pages-articles.xml.bz2");
  const feed = filesFor(parseChange("test", JSON.stringify({ command: "update:auto", inputs: { feedRelease: "it-78385b62" } })));
  assert.deepEqual(feed?.archive.path, "source/it-78385b62.jsonl.gz");
  assert.deepEqual(feed?.dump.path, "source/itwiktionary-20260901-pages-articles.xml.bz2");
  assert.equal(filesFor(parseChange("test", JSON.stringify(NORMALIZE))), null);
});

test("a file is read from the public lexema-data on raw.githubusercontent.com, with no token", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lexema-fetch-"));
  try {
    const asked: { url: string; init: unknown }[] = [];
    const fake = (async (url: string, init?: unknown) => {
      asked.push({ url, init });
      return url.endsWith("missing.bz2") ? new Response("no", { status: 404 }) : new Response("the bytes");
    }) as unknown as typeof fetch;
    const fetcher = lexemaDataFetcher(fake);
    await fetcher("source/it-78385b62.jsonl.gz", join(dir, "a", "archive"));
    assert.equal(await readFile(join(dir, "a", "archive"), "utf8"), "the bytes");
    assert.deepEqual(asked[0], { url: "https://raw.githubusercontent.com/povlabs/lexema-data/main/source/it-78385b62.jsonl.gz", init: undefined });
    await assert.rejects(fetcher("source/missing.bz2", join(dir, "b")), (error: unknown) => error instanceof DataRefused && /answered 404/.test(error.message));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("the plan-only entry runs the plan and writes nothing", async () => {
  await withWorld(async (world) => {
    const before = world.d1.sha256();
    const answer = await planOnly(parseChange("test", JSON.stringify(NORMALIZE)), {
      reader: masterReaderOf(world.d1.target),
      fetcher: async (path) => assert.fail(`nothing should be fetched, asked for ${path}`),
      workDir: join(world.dir, "plan"),
    });
    assert.deepEqual(answer.counts.toJSON(), NORMALIZE_COUNTS);
    assert.equal(answer.dictionaryRecords, LINES.length + FILLERS.length);
    assert.deepEqual(answer.limitBreaches, []);

    // Through the command line, with the counts as a step output.
    const output = join(world.dir, "github-output");
    await writeFile(output, "");
    const result = await deployMain(["--plan-only", "--change", JSON.stringify(NORMALIZE)], { SEED_STATE: world.d1.persistTo, GITHUB_OUTPUT: output, RUNNER_TEMP: world.dir }, world.d1.wrangler);
    assert.equal(result.status, 0, result.out);
    assert.deepEqual(JSON.parse(result.out).counts, NORMALIZE_COUNTS);
    assert.equal(await readFile(output, "utf8"), `counts=${result.out}\n`);

    assert.deepEqual(writes(world.d1), []);
    assert.equal(world.d1.sha256(), before);
    assert.equal(world.production(), git(world.origin, "rev-parse", "refs/heads/main"));
  });
});

test("the pull request plan check plans an added declaration with the checkout's code, writes nothing, and passes only on matching counts", async () => {
  await withWorld(async (world) => {
    const before = world.d1.sha256();
    const base = git(world.work, "rev-parse", "HEAD");
    const env = { SEED_STATE: world.d1.persistTo, RUNNER_TEMP: world.dir };
    const check = () => deployMain(["--plan-only", "--added-since", base], env, world.d1.wrangler, gitIn(world.work));

    await world.commit({ "dictionary-changes/2026-10-normalize.json": `${JSON.stringify(NORMALIZE)}\n` });
    const missing = await check();
    assert.equal(missing.status, 1, missing.out);
    assert.match(missing.out, /It has no `expected` yet\./);
    const printed = /```json\n([\s\S]*?)\n```/.exec(missing.out)?.[1] ?? assert.fail(missing.out);
    assert.deepEqual(JSON.parse(printed), { ...NORMALIZE, expected: NORMALIZE_COUNTS });

    await world.commit({ "dictionary-changes/2026-10-normalize.json": `${printed}\n` });
    const matching = await check();
    assert.equal(matching.status, 0, matching.out);
    assert.match(matching.out, /The plan's counts match `expected`\./);

    assert.deepEqual(writes(world.d1), []);
    assert.equal(world.d1.sha256(), before);
    assert.match((await deployMain(["--plan-only", "--added-since", base, "--change", "{}"], env, () => assert.fail("no wrangler call"))).out, /takes no --change or --release/);
  });
});

test("the deploy itself runs only in GitHub Actions on main", async () => {
  for (const env of [{}, { GITHUB_ACTIONS: "true", GITHUB_REF: "refs/heads/build/456" }]) {
    const result = await deployMain([], env, () => assert.fail("no wrangler call"));
    assert.equal(result.status, 1);
    assert.match(result.out, /runs only in the dictionary deploy workflow on main/);
  }
  assert.match((await deployMain(["--plan-only", "--change", "{}"], {}, () => assert.fail("no wrangler call"))).out, /command must be one of/);
});

test("parameters are written into the SQL as literals, never inside a string or a comment", () => {
  assert.equal(inlineParameters("SELECT * FROM t WHERE a = ?2 AND b = ?1", ["x", 3]), "SELECT * FROM t WHERE a = 3 AND b = 'x'");
  assert.equal(inlineParameters("SELECT ? , ?, ?1", ["it's", null]), "SELECT 'it''s' , NULL, 'it''s'");
  assert.equal(inlineParameters("SELECT '?' -- what?\n, ? /* ? */", [1]), "SELECT '?' -- what?\n, 1 /* ? */");
  assert.throws(() => inlineParameters("SELECT ?3", [1]), /parameter \?3 has no value/);
});

test("a lookup through Wrangler's reads answers as the site's own database does", async () => {
  await withWorld(async (world) => {
    const db = world.d1.open();
    try {
      for (const word of WORD_LIST) {
        const viaWrangler = await lookup({ db: lookupDatabaseOf(masterReaderOf(world.d1.target)), releaseId: RELEASE, query: word });
        const direct = await lookup({ db: fromNodeSqlite(db), releaseId: RELEASE, query: word });
        assert.deepEqual(viaWrangler, direct, word);
        assert.equal(direct.outcome, "found", word);
      }
    } finally {
      db.close();
    }
  });
});

/** Each job of a workflow file by its id, as the text of its block under `jobs:`. */
function jobsOf(yaml: string): Map<string, string> {
  const lines = yaml.slice(yaml.indexOf("\njobs:\n") + "\njobs:\n".length).split("\n");
  const jobs = new Map<string, string>();
  let id: string | undefined;
  for (const line of lines) {
    const head = /^ {2}([\w-]+):\s*$/.exec(line);
    if (head !== null) id = head[1];
    else if (id !== undefined) jobs.set(id, `${jobs.get(id) ?? ""}${line}\n`);
  }
  return jobs;
}

test("the workflow reads the public lexema-data with no token, and every job given the Cloudflare token names the environment restricted to main", async () => {
  const workflows = resolve(".github/workflows");
  const yaml = await readFile(join(workflows, "dictionary-deploy.yml"), "utf8");
  // povlabs/lexema-data is public, so no lexema-data token is passed (#527).
  assert.deepEqual([...new Set(yaml.match(/secrets\.[A-Z0-9_]+/g))].sort(), ["secrets.CLOUDFLARE_D1_TOKEN"]);
  assert.doesNotMatch(yaml, /LEXEMA_DATA/);
  const jobs = jobsOf(yaml);
  assert.deepEqual([...jobs.keys()], ["gate", "deploy", "plan"]);
  for (const [id, block] of jobs) {
    if (block.includes("secrets.CLOUDFLARE_D1_TOKEN")) assert.match(block, /^ {4}environment: dictionary-deploy$/m, id);
  }
  // The gate only fast-forwards `production` when nothing is declared (#521):
  // no secret, no environment, no install, and the deploy waits on its answer.
  assert.doesNotMatch(jobs.get("gate") ?? "", /secrets\.|environment:|pnpm/);
  assert.match(jobs.get("deploy") ?? "", /^ {4}needs: gate$/m);
  assert.match(jobs.get("deploy") ?? "", /if: github\.event_name == 'push' && needs\.gate\.outputs\.deploy == 'true'/);
  assert.match(jobs.get("plan") ?? "", /--plan-only/);
  assert.doesNotMatch(jobs.get("plan") ?? "", /contents: write/);

  // No other workflow is given a Cloudflare credential but the pull request
  // plan check, which gets the D1 read-only token alone (ADR 0018, #494).
  for (const file of await readdir(workflows)) {
    if (file === "dictionary-deploy.yml" || file === "dictionary-plan.yml") continue;
    assert.doesNotMatch(await readFile(join(workflows, file), "utf8"), /CLOUDFLARE_(API_TOKEN|D1_TOKEN|D1_READ_TOKEN)/, file);
  }
});

test("the pull request plan check gets only the D1 read-only token, in its own environment, never on a fork, and only plans", async () => {
  const yaml = await readFile(resolve(".github/workflows/dictionary-plan.yml"), "utf8");
  const on = yaml.slice(yaml.indexOf("\non:\n"), yaml.indexOf("\njobs:\n"));
  assert.match(on, /^ {2}pull_request:$/m);
  const code = yaml.split("\n").filter((line) => !/^\s*#/.test(line)).join("\n");
  assert.doesNotMatch(code, /pull_request_target|workflow_run|LEXEMA_DATA_WRITE_TOKEN|CLOUDFLARE_D1_TOKEN/);
  assert.deepEqual([...new Set(yaml.match(/secrets\.[A-Z0-9_]+/g))].sort(), ["secrets.CLOUDFLARE_D1_READ_TOKEN"]);
  // povlabs/lexema-data is public, so the plan reads it with no token (#527).
  assert.doesNotMatch(code, /LEXEMA_DATA/);
  assert.match(code, /persist-credentials: false/);
  assert.match(yaml, /^permissions: \{\}$/m);
  const jobs = jobsOf(yaml);
  assert.deepEqual([...jobs.keys()], ["plan"]);
  const plan = jobs.get("plan") ?? "";
  assert.match(plan, /^ {4}if: github\.event\.pull_request\.head\.repo\.full_name == github\.repository$/m);
  assert.match(plan, /^ {4}environment: dictionary-plan$/m);
  // At least the deploy's own plan job's limit, since it may download an archive and a dump.
  assert.ok(Number(/^ {4}timeout-minutes: (\d+)$/m.exec(plan)?.[1]) >= 60, plan);
  // Two reads and nothing else: the tree, and the plan's own earlier runs that
  // decide a skip (#521). No write, no deployment, no pull request comment.
  assert.match(plan, /^ {4}permissions:\n {6}contents: read\n(?: {6}#.*\n)* {6}actions: read\n {4}env:/m);
  const runs = [...plan.matchAll(/- run: (.*)/g)].map(([, command]) => command);
  assert.deepEqual(runs.filter((command) => command.includes("deploy:dictionary")), ["pnpm run deploy:dictionary --plan-only --added-since HEAD^1"]);
});
