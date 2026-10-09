// The word page and `GET /v1/lookup` of `diplomatizzare` with its recovered
// line 3 hidden by a curated correction (#773): neither shows the keyboard
// test text `hhhhhhhh` nor its `transitivo` label, and nothing marks the
// correction (ADR 0016). The record and page are it-0c432803's archive line
// 573791 and it.wiktionary revision 3978915, verbatim, in
// fixtures/recovered-hide/; `urgere`'s recovered line 3, from
// fixtures/unlisted-definitions/, is the control.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { renderToStaticMarkup } from "react-dom/server";
import { createKey } from "../../src/api/keys.js";
import { seedSql } from "../../src/import/seedSql.js";
import { CURATED_CORRECTIONS, recoveredHides, type CuratedCorrection } from "../../src/italian/curatedCorrections.js";
import { rawPageSource, readSavedPage } from "../../src/source/rawPage.js";
import { atFixtureLines } from "../../test/correctionFixture.js";
import { freshAppDatabase, readOnlyDictionary } from "../../test/databases.js";
import { Outcome, SearchPage } from "@/components/dictionary/SearchPage";
import { searchAttempt } from "@/lib/dictionary/searchAttempt.ts";
import { handleApi } from "@/worker/api/handler.ts";
import { TestMetering } from "./metering.ts";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const RELEASE = "it-recovered-hide-page";
const NOW = Date.parse("2026-10-09T12:00:20Z");

const linesOf = async (file: string): Promise<string[]> => (await readFile(join(REPO, file), "utf8")).trimEnd().split("\n");

let dir: string;
/** The two words seeded with the hide, and without it. */
const dictionaries = new Map<"hidden" | "source", DatabaseSync>();

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "lexema-recovered-hide-page-"));
  const lines = [
    ...(await linesOf("fixtures/recovered-hide/diplomatizzare.jsonl")),
    ...(await linesOf("fixtures/unlisted-definitions/archive-lines.jsonl")).filter((line) => (JSON.parse(line) as { word: string }).word === "urgere"),
  ];
  const pages = await Promise.all(
    ["fixtures/recovered-hide/diplomatizzare.wikitext", "fixtures/unlisted-definitions/urgere.wikitext"].map(async (file) => readSavedPage(await readFile(join(REPO, file), "utf8"), file)),
  );
  const archive = join(dir, "fixture.jsonl.gz");
  await writeFile(archive, gzipSync(Buffer.from(`${lines.join("\n")}\n`, "utf8")));
  const seed = async (name: "hidden" | "source", corrections: readonly CuratedCorrection[]) => {
    const { parts } = await seedSql({
      input: archive,
      outputDir: join(dir, name),
      schema: join(REPO, "src/db/schema.sql"),
      releaseId: RELEASE,
      archiveR2Key: `releases/${RELEASE}.jsonl.gz`,
      license: "CC-BY-SA-4.0",
      rawPages: rawPageSource(pages),
      corrections,
      onRejection: (rejection) => {
        throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
      },
    });
    const db = new DatabaseSync(":memory:");
    for (const part of parts) db.exec(await readFile(part, "utf8"));
    dictionaries.set(name, db);
  };
  await seed("hidden", atFixtureLines(lines, RELEASE, recoveredHides(CURATED_CORRECTIONS)));
  await seed("source", []);
});

after(async () => {
  for (const db of dictionaries.values()) db.close();
  await rm(dir, { recursive: true, force: true });
});

const dictionary = (name: "hidden" | "source"): DatabaseSync => {
  const db = dictionaries.get(name);
  assert.ok(db !== undefined);
  return db;
};

/** The word page of `word`, as HTML. */
async function pageHtml(db: DatabaseSync, word: string): Promise<string> {
  const attempt = await searchAttempt(readOnlyDictionary(db), RELEASE, word);
  assert.equal(attempt.outcome, "found", word);
  return renderToStaticMarkup(
    <SearchPage raw={word} version={`${RELEASE}.0`}>
      <Outcome raw={word} attempt={attempt} />
    </SearchPage>,
  );
}

/** The body `GET /v1/lookup?q=<word>` answers, through the Worker's own handler. */
async function apiBody(db: DatabaseSync, word: string): Promise<string> {
  const { sqlite, appDb } = freshAppDatabase();
  try {
    const { key } = await createKey(appDb, { label: "test", perMinuteLimit: 60 }, NOW);
    const response = await handleApi(
      new Request(`https://api.lexema.fyi/v1/lookup?q=${encodeURIComponent(word)}`, { headers: { "x-api-key": key } }),
      { db: readOnlyDictionary(db), appDb, releaseId: RELEASE, now: NOW, metering: new TestMetering() },
    );
    assert.equal(response.status, 200, word);
    return await response.text();
  } finally {
    sqlite.close();
  }
}

const count = (text: string, part: string): number => text.split(part).length - 1;

test("diplomatizzare's word page shows neither hhhhhhhh nor its transitivo label, and names no correction", async () => {
  const shown = await pageHtml(dictionary("source"), "diplomatizzare");
  const hidden = await pageHtml(dictionary("hidden"), "diplomatizzare");
  assert.ok(shown.includes("hhhhhhhh"), "without the hide the page shows the line");
  assert.ok(!hidden.includes("hhhhhhhh"));
  // The line's label goes with it; any other `transitivo` the page shows is the record's own.
  assert.equal(count(hidden, "transitivo"), count(shown, "transitivo") - 1);
  assert.doesNotMatch(hidden, /issuecomment|page-line|hidden_recovered/);
});

test("GET /v1/lookup of diplomatizzare answers neither hhhhhhhh nor its transitivo label", async () => {
  const shown = await apiBody(dictionary("source"), "diplomatizzare");
  const hidden = await apiBody(dictionary("hidden"), "diplomatizzare");
  assert.ok(shown.includes("hhhhhhhh"), "without the hide the API answers the line");
  assert.ok(!hidden.includes("hhhhhhhh"));
  assert.equal(count(hidden, "transitivo"), count(shown, "transitivo") - 1);
  assert.doesNotMatch(hidden, /issuecomment|page-line|hidden_recovered/);
});

test("urgere's recovered line 3 is on its word page and in its API answer, as without the hide", async () => {
  for (const read of [pageHtml, apiBody]) {
    const hidden = await read(dictionary("hidden"), "urgere");
    assert.equal(hidden, await read(dictionary("source"), "urgere"));
    assert.ok(hidden.includes("occorrere nell&#x27;immediato") || hidden.includes("occorrere nell'immediato"));
  }
});
