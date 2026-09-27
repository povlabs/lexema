// The `/developers` reference (#153) against the API it documents.
//
// Every example the page prints is sent to `handleApi` over the development
// fixture, seeded the way `pnpm run seed:dev` seeds D1 but under release
// it-0c432803, whose archive lines the fixture holds. The answer must be the
// printed one. Only an `id`'s line number differs: the fixture puts a record
// on its own line, and the page prints the record's line in the release's
// archive (andare's verb record is line 2345 of it-extract.jsonl.gz).

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { renderToStaticMarkup } from "react-dom/server";
import { createKey, KEY_BY_HASH_SQL, revokeKey } from "../../src/api/keys.js";
import { ENDPOINTS, UNIT_WEIGHT } from "../../src/api/units.js";
import { COUNT_MINUTE_SQL, SWEEP_MINUTES_SQL } from "../../src/api/usage.js";
import { seedSql } from "../../src/import/seedSql.js";
import { fromNodeSqlite, type LookupDatabase } from "../../src/lookup/database.js";
import { loadFixturePages } from "../../src/source/rawPage.js";
import {
  ENDPOINT_REFERENCE,
  ERROR_EXAMPLE,
  ERRORS,
  HEADERS,
  NOT_FOUND_EXAMPLE,
  type Example,
} from "../app/apiReference.ts";
import { Developers } from "../app/Developers";
import { handleApi } from "../worker/api/handler.ts";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const RELEASE = "it-0c432803";
const NOW = Date.parse("2026-09-27T12:00:20Z");

let dir: string;
let sqlite: DatabaseSync;
let db: LookupDatabase;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "lexema-developers-"));
  const archive = join(dir, "dev-seed.jsonl.gz");
  await writeFile(archive, gzipSync(await readFile(join(REPO, "fixtures/dev-seed.jsonl"))));
  const { parts } = await seedSql({
    input: archive,
    outputDir: join(dir, "sql"),
    schema: join(REPO, "src/db/schema.sql"),
    releaseId: RELEASE,
    archiveR2Key: `releases/${RELEASE}.jsonl.gz`,
    license: "CC-BY-SA-4.0",
    rawPages: await loadFixturePages(join(REPO, "fixtures")),
    onRejection: (rejection) => {
      throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
    },
  });
  sqlite = new DatabaseSync(":memory:");
  for (const part of parts) sqlite.exec(await readFile(part, "utf8"));
  db = fromNodeSqlite(sqlite);
});

after(async () => {
  sqlite.close();
  await rm(dir, { recursive: true, force: true });
});

const newKey = (perMinuteLimit = 1_000) => createKey(db, { label: "developers", perMinuteLimit, dailyUnits: 10_000 }, NOW);

/** One request as the Worker hands it to the API. */
function send(path: string, init: { key?: string; method?: string; body?: string } = {}, over = db): Promise<Response> {
  const headers: Record<string, string> = init.key === undefined ? {} : { "x-api-key": init.key };
  return handleApi(new Request(`https://lexema.fyi/api/v1/${path}`, { method: init.method ?? "GET", body: init.body, headers }), {
    db: over,
    releaseId: RELEASE,
    now: NOW,
  });
}

/** A value with every record id's line number blanked, the only part the fixture cannot reproduce. */
const withoutLines = (value: unknown): unknown =>
  JSON.parse(JSON.stringify(value).replaceAll(new RegExp(`"${RELEASE}:\\d+"`, "g"), `"${RELEASE}:#"`));

/** Every example the page prints, in its order, with the method it is sent with. */
const EXAMPLES: [string, "GET" | "POST", Example][] = [
  ...Object.entries(ENDPOINT_REFERENCE).map(([name, reference]): [string, "GET" | "POST", Example] => [name, reference.method, reference.example]),
  ["error", "GET", ERROR_EXAMPLE],
  ["lookup not found", "GET", NOT_FOUND_EXAMPLE],
];

test("every example the page prints is what the API answers for its request", async (t) => {
  // `/random`'s draw, fixed at the start of the range: the release's first noun.
  t.mock.method(Math, "random", () => 0);
  const { key } = await newKey();
  for (const [name, method, example] of EXAMPLES) {
    const body = example.body === undefined ? undefined : JSON.stringify(example.body);
    const response = await send(example.path, { key, method, body });
    assert.equal(response.status, example.status, name);
    assert.deepEqual(withoutLines(await response.json()), withoutLines(example.response), name);
  }
});

test("every error the page lists is one the API answers, with that status and code", async (t) => {
  const { key } = await newKey();
  const revoked = await newKey();
  await revokeKey(db, revoked.keyId, NOW);
  const tight = await newKey(1);
  await send("exists?q=sale", { key: tight.key });
  // The key is read and its minute counted; the lookup's own read then fails.
  const counting = new Set([KEY_BY_HASH_SQL, COUNT_MINUTE_SQL, SWEEP_MINUTES_SQL]);
  const failing: LookupDatabase = {
    all: (sql, params) => (counting.has(sql) ? db.all(sql, params) : Promise.reject(new Error("D1 is down"))),
  };
  t.mock.method(console, "error", () => {});

  const earned: Record<string, () => Promise<Response>> = {
    invalid_query: () => send("lookup?q=", { key }),
    invalid_parameter: () => send("lookup?q=sale&pos=nouns", { key }),
    invalid_body: () => send("lookup/batch", { key, method: "POST", body: JSON.stringify({ q: [] }) }),
    missing_key: () => send("lookup?q=sale"),
    invalid_key: () => send("lookup?q=sale", { key: "lx_not-a-key" }),
    revoked_key: () => send("lookup?q=sale", { key: revoked.key }),
    unknown_lemma: () => send("inflect?lemma=qqqqqq", { key }),
    not_found: () => send("nowhere", { key }),
    method_not_allowed: () => send("lookup?q=sale", { key, method: "POST" }),
    rate_limited: () => send("exists?q=sale", { key: tight.key }),
    unavailable: () => send("lookup?q=sale", { key }, failing),
  };
  assert.deepEqual(ERRORS.map((error) => error.code).sort(), Object.keys(earned).sort());
  for (const error of ERRORS) {
    const response = await earned[error.code]();
    assert.equal(response.status, error.status, error.code);
    assert.equal(((await response.json()) as { error: { code: string } }).error.code, error.code);
  }
});

/** Every block of code the page prints, as text. */
function codeBlocks(html: string): string[] {
  const entities: Record<string, string> = { "&quot;": '"', "&#x27;": "'", "&amp;": "&", "&lt;": "<", "&gt;": ">" };
  return [...html.matchAll(/<pre[^>]*><code>([\s\S]*?)<\/code><\/pre>/g)].map((match) =>
    match[1].replace(/&(quot|#x27|amp|lt|gt);/g, (entity) => entities[entity]),
  );
}

test("the page prints each example's status and response as the reference states them", () => {
  const printed = codeBlocks(renderToStaticMarkup(<Developers />))
    .filter((block) => block.startsWith("HTTP "))
    .map((block) => {
      const [status, json] = block.split("\n\n");
      return { status: Number(status.slice("HTTP ".length)), response: JSON.parse(json) };
    });
  assert.deepEqual(
    printed,
    EXAMPLES.map(([, , example]) => ({ status: example.status, response: example.response })),
  );
});

/** The page as a reader reads it: its text, tags dropped. */
const pageText = (): string =>
  renderToStaticMarkup(<Developers />)
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");

test("the page names every endpoint of the unit map with its weight, every /lookup filter, error code and header", () => {
  const text = pageText();
  for (const endpoint of ENDPOINTS) {
    const { units, per } = UNIT_WEIGHT[endpoint];
    const cost = `${units} unit${units === 1 ? "" : "s"}${per === "word" ? " per word" : ""}`;
    assert.ok(text.includes(`/api/v1/${endpoint} · ${cost}`), `${endpoint}: ${cost}`);
  }
  // The filters #148 names for /lookup, each a parameter row of its section.
  const lookup = text.slice(text.indexOf("/api/v1/lookup · "), text.indexOf("/api/v1/lemmatize · "));
  for (const filter of ["pos", "match", "fields", "limit_definitions", "mood", "tense", "person", "gender", "number"]) {
    assert.match(lookup, new RegExp(` ${filter} (required )?[A-Z\`]`), filter);
  }
  for (const error of ERRORS) assert.ok(text.includes(` ${error.status} ${error.code} `), error.code);
  for (const header of HEADERS) assert.ok(text.includes(` ${header.name} `), header.name);
});
