// The word page and `GET /v1/lookup` of `gaio` with its adjective sense 0,
// `Ultima_Sfaccim`, hidden by a curated correction (#857): the page lists
// `allegro` as the adjective's first definition, neither shows the stray
// link, and nothing marks the correction (ADR 0016). The record and page are
// it-0c432803's archive line 96753 and it.wiktionary revision 4057291,
// verbatim, in fixtures/sense-hide/.

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
import { CURATED_CORRECTIONS, senseHides, type CuratedCorrection } from "../../src/italian/curatedCorrections.js";
import { rawPageSource, readSavedPage } from "../../src/source/rawPage.js";
import { atFixtureLines } from "../../test/correctionFixture.js";
import { freshAppDatabase, readOnlyDictionary } from "../../test/databases.js";
import { Outcome, SearchPage } from "@/components/dictionary/SearchPage";
import { searchAttempt } from "@/lib/dictionary/searchAttempt.ts";
import { handleApi } from "@/worker/api/handler.ts";
import { TestMetering } from "./metering.ts";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const RELEASE = "it-sense-hide-page";
const NOW = Date.parse("2026-10-17T12:00:20Z");

let dir: string;
/** gaio seeded with the hide, and without it. */
const dictionaries = new Map<"hidden" | "source", DatabaseSync>();

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "lexema-sense-hide-page-"));
  const lines = (await readFile(join(REPO, "fixtures/sense-hide/gaio.jsonl"), "utf8")).trimEnd().split("\n");
  const page = readSavedPage(await readFile(join(REPO, "fixtures/sense-hide/gaio.wikitext"), "utf8"), "fixtures/sense-hide/gaio.wikitext");
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
      rawPages: rawPageSource([page]),
      corrections,
      onRejection: (rejection) => {
        throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
      },
    });
    const db = new DatabaseSync(":memory:");
    for (const part of parts) db.exec(await readFile(part, "utf8"));
    dictionaries.set(name, db);
  };
  await seed("hidden", atFixtureLines(lines, RELEASE, senseHides(CURATED_CORRECTIONS)));
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

/** The definitions the adjective reading lists, in order: each `<li data-definition>`'s text. */
function adjectiveDefinitions(html: string): string[] {
  const reading = /<article[^>]*>(?:(?!<\/article>).)*?<span lang="it">Aggettivo<\/span>(?:(?!<\/article>).)*<\/article>/s.exec(html);
  assert.ok(reading !== null, "the page has an Aggettivo reading");
  const list = /<ol [^>]*id="definition-list-\d+">(.*?)<\/ol>/s.exec(reading[0]);
  assert.ok(list !== null, "the reading lists definitions");
  return [...list[1].matchAll(/<li [^>]*data-definition="\d+">.*?<p [^>]*>(.*?)<\/p>/gs)].map((item) => item[1]);
}

test("gaio's word page lists allegro as its adjective's first definition, shows no Ultima_Sfaccim, and names no correction", async () => {
  const shown = await pageHtml(dictionary("source"), "gaio");
  const hidden = await pageHtml(dictionary("hidden"), "gaio");
  assert.deepEqual(adjectiveDefinitions(shown), ["Ultima_Sfaccim", "allegro"], "without the hide the page leads with the stray link");
  assert.deepEqual(adjectiveDefinitions(hidden), ["allegro"]);
  assert.ok(!hidden.includes("Ultima_Sfaccim"));
  assert.doesNotMatch(hidden, /issuecomment|senses\/0\/hidden|hidden_sense/);
});

test("GET /v1/lookup of gaio answers allegro and no Ultima_Sfaccim", async () => {
  const shown = await apiBody(dictionary("source"), "gaio");
  const hidden = await apiBody(dictionary("hidden"), "gaio");
  assert.ok(shown.includes("Ultima_Sfaccim"), "without the hide the API answers the stray link");
  assert.ok(!hidden.includes("Ultima_Sfaccim"));
  assert.ok(hidden.includes("allegro"));
  assert.doesNotMatch(hidden, /issuecomment|senses\/0\/hidden|hidden_sense/);
});
