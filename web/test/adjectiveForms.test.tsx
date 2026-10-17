// The Forme table of a determiner and of an adjective whose table a curated
// correction sets right (#836): `quello`'s adjective holds quel, quell',
// quello, quei and quegli and no quelli, its pronoun keeps quelli, `bello`'s
// keeps belli beside bel, bell', bei and begli, and no cell of quello's or
// questo's table has an article line, while siffatto's and mio's keep theirs.
// Every record is a verbatim archive line of it-0c432803, from
// fixtures/curated-corrections.jsonl (test/correctionFixture.ts lists them).

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { renderToStaticMarkup } from "react-dom/server";
import { seedSql } from "../../src/import/seedSql.js";
import { adjectiveFormsCorrections, CURATED_CORRECTIONS } from "../../src/italian/curatedCorrections.js";
import { fromNodeSqlite } from "../../src/lookup/database.js";
import { lookup } from "../../src/lookup/lookup.js";
import type { Reading } from "../../src/lookup/types.js";
import { atFixtureLines, correctionFixtureLines } from "../../test/correctionFixture.js";
import { readOnlyDictionary } from "../../test/databases.js";
import { Outcome, SearchPage } from "@/components/dictionary/SearchPage";
import { agreementOf, type Grid } from "@/lib/dictionary/genderGrid.ts";
import { searchAttempt } from "@/lib/dictionary/searchAttempt.ts";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const RELEASE = "it-adjective-forms-page";

let dir: string;
let db: DatabaseSync;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "lexema-adjective-forms-page-"));
  const lines = await correctionFixtureLines();
  const archive = join(dir, "fixture.jsonl.gz");
  await writeFile(archive, gzipSync(Buffer.from(`${lines.join("\n")}\n`, "utf8")));
  const { parts } = await seedSql({
    input: archive,
    outputDir: join(dir, "sql"),
    schema: join(REPO, "src/db/schema.sql"),
    releaseId: RELEASE,
    license: "CC-BY-SA-4.0",
    corrections: atFixtureLines(lines, RELEASE, adjectiveFormsCorrections(CURATED_CORRECTIONS)),
    onRejection: (rejection) => {
      throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
    },
  });
  db = new DatabaseSync(":memory:");
  for (const part of parts) db.exec(await readFile(part, "utf8"));
});

after(async () => {
  db.close();
  await rm(dir, { recursive: true, force: true });
});

async function readingOf(word: string, pos: string): Promise<Reading> {
  const result = await lookup({ db: fromNodeSqlite(db), releaseId: RELEASE, query: word });
  assert.ok(result.outcome === "found", word);
  const reading = result.readings.find((candidate) => candidate.word === word && candidate.pos === pos);
  assert.ok(reading !== undefined, `${word} ${pos}`);
  return reading;
}

/** Each cell of the grid as `gender number`, mapped to its spellings, each with its article line. */
function cellsOf(grid: Grid | undefined): Record<string, [string, string[]][]> {
  assert.ok(grid !== undefined);
  const cells: Record<string, [string, string[]][]> = {};
  for (const row of grid.rows) {
    for (const [i, number] of (["singular", "plural"] as const).entries()) {
      cells[`${row.gender} ${number}`] = row.cells[i].spellings.map((spelling) => [spelling.surface, spelling.articles]);
    }
  }
  return cells;
}

const spellingsOf = (grid: Grid | undefined): Record<string, string[]> =>
  Object.fromEntries(Object.entries(cellsOf(grid)).map(([cell, spellings]) => [cell, spellings.map(([surface]) => surface)]));

const articlesOf = (grid: Grid | undefined): string[] => Object.values(cellsOf(grid)).flatMap((spellings) => spellings.flatMap(([, articles]) => articles));

test("quello's adjective table holds quel, quell', quello, quei and quegli, and no quelli, with no article line", async () => {
  const { grid } = agreementOf(await readingOf("quello", "adj"));
  assert.deepEqual(spellingsOf(grid), {
    "masculine singular": ["quello", "quel", "quell'"],
    "masculine plural": ["quei", "quegli"],
    "feminine singular": ["quella", "quell'"],
    "feminine plural": ["quelle"],
  });
  assert.deepEqual(articlesOf(grid), []);
});

test("quello's pronoun still lists quelli", async () => {
  const pronoun = await readingOf("quello", "pron");
  assert.ok(pronoun.forms.some((form) => form.surface === "quelli"));
});

test("bello's adjective table keeps belli and also holds bel, bell', bei and begli, each with its article line", async () => {
  const { grid } = agreementOf(await readingOf("bello", "adj"));
  assert.deepEqual(spellingsOf(grid), {
    "masculine singular": ["bello", "bel", "bell'"],
    "masculine plural": ["belli", "bei", "begli"],
    "feminine singular": ["bella", "bell'"],
    "feminine plural": ["belle"],
  });
  assert.deepEqual(cellsOf(grid)["masculine plural"][0], ["belli", ["i belli", "dei belli"]]);
});

test("questo's adjective table carries no articles; siffatto's and mio's keep their article lines", async () => {
  const questo = agreementOf(await readingOf("questo", "adj")).grid;
  assert.deepEqual(spellingsOf(questo)["masculine plural"], ["questi"]);
  assert.deepEqual(articlesOf(questo), []);

  // siffatto carries the source's `Aggettivo dimostrativo` label too, and takes an article.
  const siffatto = await readingOf("siffatto", "adj");
  assert.equal(siffatto.posTitle, "Aggettivo dimostrativo");
  assert.deepEqual(cellsOf(agreementOf(siffatto).grid)["masculine singular"], [["siffatto", ["il siffatto", "un siffatto"]]]);

  assert.deepEqual(cellsOf(agreementOf(await readingOf("mio", "adj")).grid)["feminine singular"], [["mia", ["la mia", "una mia"]]]);
});

test("quello's word page shows quei and quegli, and no article before a form of quello", async () => {
  const attempt = await searchAttempt(readOnlyDictionary(db), RELEASE, "quello");
  assert.equal(attempt.outcome, "found");
  const html = renderToStaticMarkup(
    <SearchPage raw="quello" version={`${RELEASE}.0`}>
      <Outcome raw="quello" attempt={attempt} />
    </SearchPage>,
  );
  for (const form of ["quel", "quell&#x27;", "quei", "quegli"]) assert.match(html, new RegExp(`>${form}</span>`), form);
  assert.doesNotMatch(html, /\b(il|lo|un|uno|la|una|i|gli|dei|degli|le|delle) quel/);
  assert.doesNotMatch(html, /corrected_adjective_form|issuecomment|:forms/);
});
