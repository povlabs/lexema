// `pnpm run measure:bare-spellings` — for every served one-word headword that
// ends in an accented vowel or an apostrophe, search its spelling without that
// last mark and sort what the search answers (#468): found as a word of its
// own, the headword offered first, offered later, or not offered
// (src/lookup/bareSpelling.ts). The search is the page's: `lookup()`, then
// `findNearby()` when it finds nothing.
//
// Reads the local D1 a full seed leaves (docs/RUN_AN_IMPORT.md):
//
//   SEED_INPUT=it-extract.jsonl.gz SEED_SQL=.data/full-sql SEED_STATE=.data/full-state pnpm run seed:dev
//   SEED_STATE=.data/full-state pnpm run measure:bare-spellings
//
// `SEED_STATE` defaults to `.data/full-state`; `LEXEMA_RELEASE` names the
// master, else the one master the database serves. The database is opened
// read-only. Prints Markdown, so a run can be pasted into a report.

import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { isMain } from "../commandLine.js";
import { bareSpelling,bareSpellingOutcome, type BareSpellingOutcome } from "./bareSpelling.js";
import { fromNodeSqlite } from "./database.js";
import { lookup } from "./lookup.js";
import { findNearby, type Nearby } from "./nearby.js";

/** How many headwords each group lists by name. */
const EXAMPLES = 40;

const OUTCOMES: readonly { outcome: BareSpellingOutcome; heading: string }[] = [
  { outcome: "found", heading: "Found: the bare spelling is a word of its own (ambiguous)" },
  { outcome: "best", heading: "Not found, and the headword is the best offer" },
  { outcome: "offered", heading: "Not found, and the headword is offered but not first" },
  { outcome: "missed", heading: "Not found, and the headword is not offered" },
];

/** The local D1 file under a Wrangler state directory that holds the dictionary. */
async function dictionaryFile(state: string): Promise<string> {
  const dir = join(state, "v3", "d1", "miniflare-D1DatabaseObject");
  const files = (await readdir(dir)).filter((name) => name.endsWith(".sqlite") && name !== "metadata.sqlite");
  for (const name of files) {
    const db = new DatabaseSync(join(dir, name), { readOnly: true });
    const holds = db.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'lookup_form'").get() !== undefined;
    db.close();
    if (holds) return join(dir, name);
  }
  throw new Error(`no dictionary database under ${dir}; seed one first (docs/RUN_AN_IMPORT.md)`);
}

function masterOf(db: DatabaseSync, named: string | undefined): string {
  if (named !== undefined) return named;
  const masters = db.prepare("SELECT DISTINCT master_release_id AS id FROM served_release").all() as { id: string }[];
  if (masters.length !== 1) throw new Error(`the database serves ${masters.length} masters; name one with LEXEMA_RELEASE`);
  return masters[0].id;
}

interface Row {
  /** The headword's key, apostrophes made straight. */
  key: string;
  headword: string;
  bare: string;
  outcome: BareSpellingOutcome;
  /** What the search led with, for a headword that was not the best offer. */
  led: string | undefined;
}

const ledWith = (nearby: Nearby): string | undefined => {
  switch (nearby.kind) {
    case "accent":
    case "typo":
      return nearby.best;
    case "phrase":
      return nearby.best.phrase;
    case "prefix":
      return nearby.words[0];
    case "none":
      return undefined;
  }
};

async function measure(file: string, named: string | undefined, log: (line: string) => void): Promise<string> {
  const raw = new DatabaseSync(file, { readOnly: true });
  const releaseId = masterOf(raw, named);
  const db = fromNodeSqlite(raw);
  const headwords = raw
    .prepare(
      `SELECT surface_key AS key, MIN(surface) AS surface FROM lookup_form
        WHERE release_id IN (SELECT release_id FROM served_release WHERE master_release_id = ?1) AND origin = 'headword'
        GROUP BY surface_key ORDER BY surface_key`,
    )
    .all(releaseId) as { key: string; surface: string }[];
  const measured = headwords.flatMap(({ key, surface }) => {
    const bare = bareSpelling(key);
    return bare === undefined ? [] : [{ key, surface, bare }];
  });
  log(`${measured.length} of ${headwords.length} headword keys end in an accented vowel or an apostrophe`);

  // Several headwords can share a bare spelling (`più`, `piú`): search each once.
  const answers = new Map<string, { found: true } | { found: false; nearby: Nearby }>();
  const rows: Row[] = [];
  for (const { key, surface, bare } of measured) {
    let answer = answers.get(bare);
    if (answer === undefined) {
      const result = await lookup({ db, releaseId, query: bare });
      answer = result.outcome === "not-found" ? { found: false, nearby: await findNearby({ db, releaseId, query: bare }) } : { found: true };
      answers.set(bare, answer);
      if (answers.size % 2000 === 0) log(`${answers.size} spellings searched`);
    }
    const outcome = bareSpellingOutcome(surface, answer);
    rows.push({ key, headword: surface, bare, outcome, led: answer.found || outcome === "best" ? undefined : ledWith(answer.nearby) });
  }
  raw.close();

  const apostrophe = (row: Row) => row.key.endsWith("'");
  const count = (rows: readonly Row[], outcome: BareSpellingOutcome) => rows.filter((row) => row.outcome === outcome).length;
  const accentRows = rows.filter((row) => !apostrophe(row));
  const apostropheRows = rows.filter(apostrophe);
  const out = [
    `Release \`${releaseId}\`: ${rows.length} served one-word headwords end in an accented vowel or an apostrophe, ${answers.size} distinct bare spellings.`,
    "",
    "| Outcome | Final accent | Final apostrophe | All |",
    "|---|---:|---:|---:|",
    ...OUTCOMES.map(
      ({ outcome, heading }) =>
        `| ${heading} | ${count(accentRows, outcome)} | ${count(apostropheRows, outcome)} | ${count(rows, outcome)} |`,
    ),
    `| Total | ${accentRows.length} | ${apostropheRows.length} | ${rows.length} |`,
  ];
  const example = (row: Row) => `\`${row.bare}\` → \`${row.headword}\`${row.led === undefined ? "" : ` (led with \`${row.led}\`)`}`;
  for (const { outcome, heading } of OUTCOMES) {
    for (const [mark, group] of [["final accent", accentRows], ["final apostrophe", apostropheRows]] as const) {
      const matching = group.filter((row) => row.outcome === outcome);
      if (matching.length === 0) continue;
      out.push("", `### ${heading}, ${mark} (${matching.length})`, "");
      out.push(matching.slice(0, EXAMPLES).map(example).join(", ") + (matching.length > EXAMPLES ? `, and ${matching.length - EXAMPLES} more.` : "."));
    }
  }
  return out.join("\n");
}

if (isMain(import.meta.url)) {
  const file = await dictionaryFile(resolve(process.env.SEED_STATE ?? ".data/full-state"));
  process.stdout.write(`${await measure(file, process.env.LEXEMA_RELEASE, (line) => process.stderr.write(`${line}\n`))}\n`);
}
