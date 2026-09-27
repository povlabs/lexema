// The JSON API's core (#150): `/api/v1/lookup` behind a key, its per-key
// minute limit and its daily units, over the development fixture seeded the
// way `pnpm run seed:dev` seeds D1.
//
// `handleApi` is exercised as the Worker runs it, a Request in and a Response
// out; only the D1 binding is a local `node:sqlite` database.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { createKey, KEY_BY_HASH_SQL, revokeKey } from "../../src/api/keys.js";
import { COUNT_MINUTE_SQL, SWEEP_MINUTES_SQL } from "../../src/api/usage.js";
import { seedSql } from "../../src/import/seedSql.js";
import { fromNodeSqlite, type LookupDatabase } from "../../src/lookup/database.js";
import { lookup } from "../../src/lookup/lookup.js";
import { findNearby } from "../../src/lookup/nearby.js";
import { loadFixturePages } from "../../src/source/rawPage.js";
import { handleApi, withApi, type ApiBindings } from "../worker/api/handler.ts";
import { withRateLimits, type LimitBindings } from "../worker/rateLimit.ts";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const RELEASE = "it-api-test";
/** 12:00:20 UTC: 40 seconds before the minute ends. */
const NOW = Date.parse("2026-09-27T12:00:20Z");

let dir: string;
let sqlite: DatabaseSync;
let db: LookupDatabase;

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "lexema-api-"));
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

/** A new key with these limits. */
const newKey = async (perMinuteLimit = 60, label = "test"): Promise<{ keyId: number; key: string }> =>
  createKey(db, { label, perMinuteLimit, dailyUnits: 10_000 }, NOW);

/** One API request, as the Worker hands it over. */
const call = (path: string, key: string | undefined, now = NOW, method = "GET", over = db): Promise<Response> =>
  handleApi(
    new Request(`https://lexema.fyi${path}`, { method, headers: key === undefined ? {} : { "x-api-key": key } }),
    { db: over, releaseId: RELEASE, now },
  );

/** The per-key limit headers, in a fixed order. */
const limitHeaders = (response: Response) =>
  ["ratelimit-limit", "ratelimit-remaining", "ratelimit-reset", "retry-after"].map((name) => response.headers.get(name));

/** Units the key has been charged, per day. */
const unitsOf = (keyId: number) =>
  sqlite.prepare("SELECT day, units FROM api_key_usage WHERE key_id = ? ORDER BY day").all(keyId).map((row) => ({ ...row }));

// Loose on purpose: each test reads the fields it asserts.
type Json = any;

test("a form answers with its lemma in one call: andavano is andare, at indicativo imperfetto loro", async () => {
  const { key } = await newKey();
  const response = await call("/api/v1/lookup?q=andavano", key);
  assert.equal(response.status, 200);
  const body: Json = await response.json();
  assert.deepEqual(
    body.results.map((result: Json) => [result.word, result.pos, result.match]),
    [["andare", "verb", { surface: "andavano", via: "form_of", grammar: [{ mood: "indicativo", tense: "imperfetto", person: "loro" }] }]],
  );
  const [andare] = body.results;
  assert.deepEqual(andare.forms.moods.indicativo.imperfetto.loro, ["andavano"]);
  assert.ok(andare.definitions.length > 0, "the lemma's own definitions are returned");
});

test("sale answers every candidate the lookup returns: the salt noun, sala and salire", async () => {
  const { key } = await newKey();
  const body: Json = await (await call("/api/v1/lookup?q=sale", key)).json();
  const found = await lookup({ db, releaseId: RELEASE, query: "sale" });
  assert.equal(found.outcome, "found");
  assert.equal(body.results.length, found.readings.length);
  assert.deepEqual(
    body.results.map((result: Json) => [result.word, result.pos_title, result.match.via]),
    [
      ["sale", "Sostantivo", "headword"],
      ["sala", "Sostantivo", "form_of"],
      ["salire", "Verbo", "form_of"],
    ],
  );
  assert.deepEqual(body.results[1].match.grammar, [{ gender: "femminile", number: "plurale" }]);
});

test("every found result carries the release and an attribution with the word's Wiktionary page", async () => {
  const { key } = await newKey();
  for (const q of ["sale", "andavano", "casa"]) {
    const body: Json = await (await call(`/api/v1/lookup?q=${encodeURIComponent(q)}`, key)).json();
    assert.equal(body.release_id, RELEASE);
    for (const result of body.results) {
      assert.deepEqual(result.attribution, {
        licence: "CC BY-SA 4.0",
        licence_url: "https://creativecommons.org/licenses/by-sa/4.0/",
        source: "Wikizionario",
        source_url: `https://it.wiktionary.org/wiki/${encodeURIComponent(result.word)}`,
      });
    }
  }
});

test("a word not in the release is a 404 offering findNearby's spellings in its order, typo called edit", async () => {
  const { key } = await newKey();
  const cases: [string, string[]][] = [
    ["citta", ["accent"]],
    ["mangare", ["edit"]],
    ["sal", ["prefix"]],
    ["qqqqqq", []],
  ];
  for (const [q, kinds] of cases) {
    const response = await call(`/api/v1/lookup?q=${q}`, key);
    assert.equal(response.status, 404, q);
    const body: Json = await response.json();
    const nearby = await findNearby({ db, releaseId: RELEASE, query: q });
    const offered =
      nearby.kind === "prefix" ? nearby.words : nearby.kind === "none" ? [] : [nearby.best, ...nearby.others];
    assert.deepEqual(body.results, []);
    assert.equal(body.release_id, RELEASE);
    assert.deepEqual(
      body.suggestions.map((suggestion: Json) => suggestion.word),
      offered,
      q,
    );
    assert.deepEqual([...new Set(body.suggestions.slice(0, 1).map((s: Json) => s.kind))], kinds, q);
  }
});

test("a /lookup refused before an answer costs no units: a bad q, a wrong method, a 429", async () => {
  const { keyId, key } = await newKey(4);
  for (const q of ["", "%20%20", "a".repeat(129)]) {
    const response = await call(`/api/v1/lookup?q=${q}`, key);
    assert.equal(response.status, 400);
    const body: Json = await response.json();
    assert.equal(body.error.code, "invalid_query");
  }
  const wrongMethod = await call("/api/v1/lookup?q=casa", key, NOW, "POST");
  assert.equal(wrongMethod.status, 405);
  const overLimit = await call("/api/v1/lookup?q=casa", key);
  assert.equal(overLimit.status, 429);
  assert.deepEqual(unitsOf(keyId), []);
});

test("no key, an unknown key and a revoked key are each a 401; the key row holds a hash, never the key", async () => {
  const { keyId, key } = await newKey();
  assert.equal((await call("/api/v1/lookup?q=casa", key)).status, 200);
  await revokeKey(db, keyId, NOW);
  const refused = [
    [await call("/api/v1/lookup?q=casa", undefined), "missing_key"],
    [await call("/api/v1/lookup?q=casa", "lx_not-a-key"), "invalid_key"],
    [await call("/api/v1/lookup?q=casa", key), "revoked_key"],
  ] as const;
  for (const [response, code] of refused) {
    assert.equal(response.status, 401);
    const body: Json = await response.json();
    assert.equal(body.error.code, code);
    assert.equal(typeof body.error.message, "string");
  }
  const row = sqlite.prepare("SELECT * FROM api_key WHERE key_id = ?").get(keyId) as Record<string, unknown>;
  assert.match(String(row.key_hash), /^[0-9a-f]{64}$/);
  assert.ok(!Object.values(row).some((value) => String(value).includes(key.slice(3))), "no column holds the key");
});

test("a key past its own minute limit gets a 429 until the minute ends; another key is counted apart", async () => {
  const tight = await newKey(2, "tight");
  const roomy = await newKey(5, "roomy");
  const headers = limitHeaders;

  assert.deepEqual(headers(await call("/api/v1/lookup?q=casa", tight.key)), ["2", "1", "40", null]);
  // A 404 and a 400 carry the headers too.
  assert.deepEqual(headers(await call("/api/v1/lookup?q=qqqqqq", tight.key)), ["2", "0", "40", null]);
  const refused = await call("/api/v1/lookup?q=casa", tight.key);
  assert.equal(refused.status, 429);
  assert.deepEqual(headers(refused), ["2", "0", "40", "40"]);
  assert.equal(((await refused.json()) as Json).error.code, "rate_limited");

  const other = await call("/api/v1/lookup?q=", roomy.key);
  assert.equal(other.status, 400);
  assert.deepEqual(headers(other), ["5", "4", "40", null]);

  const nextMinute = await call("/api/v1/lookup?q=casa", tight.key, Date.parse("2026-09-27T12:01:05Z"));
  assert.equal(nextMinute.status, 200);
  assert.deepEqual(headers(nextMinute), ["2", "1", "55", null]);
});

test("a 405, an unknown endpoint and a failed answer carry the key's limit headers; a 401 carries none", async (t) => {
  const { key } = await newKey(10);
  const wrongMethod = await call("/api/v1/lookup?q=casa", key, NOW, "POST");
  assert.equal(wrongMethod.status, 405);
  assert.deepEqual(limitHeaders(wrongMethod), ["10", "9", "40", null]);

  const unknown = await call("/api/v1/nowhere", key);
  assert.equal(unknown.status, 404);
  assert.equal(((await unknown.json()) as Json).error.code, "not_found");
  assert.deepEqual(limitHeaders(unknown), ["10", "8", "40", null]);

  // The key is read and its minute counted; the lookup's own read then fails.
  const counting = new Set([KEY_BY_HASH_SQL, COUNT_MINUTE_SQL, SWEEP_MINUTES_SQL]);
  const failing: LookupDatabase = {
    all: (sql, params) => (counting.has(sql) ? db.all(sql, params) : Promise.reject(new Error("D1 is down"))),
  };
  t.mock.method(console, "error", () => {});
  const failed = await call("/api/v1/lookup?q=casa", key, NOW, "GET", failing);
  assert.equal(failed.status, 503);
  assert.equal(((await failed.json()) as Json).error.code, "unavailable");
  assert.deepEqual(limitHeaders(failed), ["10", "7", "40", null]);

  assert.deepEqual(limitHeaders(await call("/api/v1/lookup?q=casa", undefined)), [null, null, null, null]);
});

test("each /lookup a key makes adds 2 units to its row for the day", async () => {
  const { keyId, key } = await newKey();
  await call("/api/v1/lookup?q=casa", key);
  await call("/api/v1/lookup?q=qqqqqq", key);
  await call("/api/v1/lookup?q=casa", key, Date.parse("2026-09-28T00:00:01Z"));
  assert.deepEqual(unitsOf(keyId), [
    { day: "2026-09-27", units: 4 },
    { day: "2026-09-28", units: 2 },
  ]);
});

/** The binding's contract, as web/test/rateLimit.test.ts fakes it: every call counted. */
class CountingRateLimit implements RateLimit {
  calls = 0;
  async limit(): Promise<RateLimitOutcome> {
    this.calls += 1;
    return { success: true };
  }
}

test("an API request is answered before the site, and no per-visitor limit counts it", async () => {
  const { key } = await newKey();
  const limits = {
    SEARCH_LIMIT: new CountingRateLimit(),
    SUGGEST_LIMIT: new CountingRateLimit(),
    REPORT_LIMIT: new CountingRateLimit(),
    REPORT_OPEN_LIMIT: new CountingRateLimit(),
  };
  // D1's shape over the same database: prepare, bind, all.
  const d1 = {
    prepare: (sql: string) => ({
      bind: (...params: (string | number | null)[]) => ({ all: async () => ({ results: sqlite.prepare(sql).all(...params) }) }),
      all: async () => ({ results: sqlite.prepare(sql).all() }),
    }),
  };
  const env = { ...limits, DB: d1 as unknown as D1Database, LEXEMA_RELEASE: RELEASE } satisfies ApiBindings & LimitBindings;
  const siteSaw: string[] = [];
  const worker = withApi(
    withRateLimits<typeof env>(async (request) => {
      siteSaw.push(new URL(request.url).pathname);
      return new Response("<p>page</p>");
    }),
  );
  const fetch = (path: string, headers: Record<string, string> = {}) =>
    worker(new Request(`https://lexema.fyi${path}`, { headers }), env, {} as ExecutionContext);

  assert.equal((await fetch("/api/v1/lookup?q=casa", { "x-api-key": key })).status, 200);
  assert.equal((await fetch("/api/v1/lookup?q=casa")).status, 401);
  assert.deepEqual(siteSaw, []);
  assert.deepEqual(Object.values(limits).map((limit) => limit.calls), [0, 0, 0, 0]);

  await fetch("/?q=casa");
  assert.deepEqual(siteSaw, ["/"]);
  assert.equal(limits.SEARCH_LIMIT.calls, 1);
});

// The /lookup filters (#151).

let filterKey: string | undefined;

/** A /lookup with these parameters, on one roomy key the filter tests share. */
const lookupWith = async (query: string): Promise<Response> =>
  call(`/api/v1/lookup?${query}`, (filterKey ??= (await newKey(1_000, "filters")).key));

/** A 200 /lookup answer's body. */
const lookupBody = async (query: string): Promise<Json> => {
  const response = await lookupWith(query);
  assert.equal(response.status, 200, query);
  return response.json();
};

/** Each result as `word pos via`, the lookup's order kept. */
const candidates = (body: Json): string[] => body.results.map((result: Json) => `${result.word} ${result.pos} ${result.match.via}`);

/** The refusal a bad filter value gets: a 400 whose error names the parameter. */
const assertRefused = async (query: string, parameter: string) => {
  const response = await lookupWith(query);
  assert.equal(response.status, 400, query);
  const body: Json = await response.json();
  assert.equal(body.error.code, "invalid_parameter", query);
  assert.ok(body.error.message.startsWith(`${parameter} `) || body.error.message.includes(` ${parameter} `), query);
};

test("pos keeps only the candidates of that part of speech, in the lookup's order", async () => {
  assert.deepEqual(candidates(await lookupBody("q=sale&pos=noun")), ["sale noun headword", "sala noun form_of"]);
  assert.deepEqual(candidates(await lookupBody("q=sale&pos=verb")), ["salire verb form_of"]);
  // The brief spells two of the source's codes out in full; both spellings are read.
  assert.deepEqual(candidates(await lookupBody("q=solo&pos=adv")), ["solo adv headword"]);
  assert.deepEqual(candidates(await lookupBody("q=solo&pos=adverb")), ["solo adv headword"]);
  await assertRefused("q=sale&pos=nouns", "pos");
  await assertRefused("q=sale&pos=noun&pos=verb", "pos");
});

test("match=exact keeps headword matches, match=form keeps form matches, and any, the default, keeps both", async () => {
  const exact = candidates(await lookupBody("q=solo&match=exact"));
  const form = candidates(await lookupBody("q=solo&match=form"));
  assert.deepEqual(exact, ["solo adj headword", "solo adv headword", "solo noun headword"]);
  assert.deepEqual(form, ["sola adj form", "sole adj form"]);
  const every = candidates(await lookupBody("q=solo"));
  assert.deepEqual(candidates(await lookupBody("q=solo&match=any")), every);
  assert.deepEqual([...every].sort(), [...exact, ...form].sort());
  assert.deepEqual(candidates(await lookupBody("q=andavano&match=form")), ["andare verb form_of"]);
  await assertRefused("q=solo&match=headword", "match");
});

test("fields returns the named sections and the always-returned fields, and refuses an unknown name", async () => {
  const [sale] = (await lookupBody("q=sale&fields=definitions,pronunciation")).results;
  assert.deepEqual(Object.keys(sale).sort(), [
    "attribution",
    "definitions",
    "id",
    "match",
    "pos",
    "pos_title",
    "pronunciations",
    "word",
  ]);
  const [full] = (await lookupBody("q=sale")).results;
  assert.deepEqual(sale.definitions, full.definitions);
  await assertRefused("q=sale&fields=definitions,meaning", "fields");
  await assertRefused("q=sale&fields=", "fields");
});

test("pos, match and fields refuse a name every object inherits", async () => {
  for (const inherited of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
    await assertRefused(`q=sale&pos=${inherited}`, "pos");
    await assertRefused(`q=sale&match=${inherited}`, "match");
    await assertRefused(`q=sale&fields=definitions,${inherited}`, "fields");
  }
});

test("limit_definitions caps each result's definitions, and refuses anything but a positive integer", async () => {
  const full = (await lookupBody("q=sale")).results;
  const capped = (await lookupBody("q=sale&limit_definitions=2")).results;
  assert.ok(full.some((result: Json) => result.definitions.length > 2), "the cap has something to cut");
  assert.deepEqual(
    capped.map((result: Json) => result.definitions),
    full.map((result: Json) => result.definitions.slice(0, 2)),
  );
  for (const bad of ["0", "-1", "1.5", "two", "1e2"]) await assertRefused(`q=sale&limit_definitions=${bad}`, "limit_definitions");
});

test("mood, tense and person narrow a verb's forms, in Italian labels or English codes", async () => {
  const formsOf = async (query: string) => (await lookupBody(`q=andare&pos=verb&${query}`)).results[0].forms;

  const noi = await formsOf("mood=congiuntivo&tense=presente&person=noi");
  assert.deepEqual(noi, { type: "conjugation", moods: { congiuntivo: { presente: { noi: ["andiamo"] } } } });
  assert.deepEqual(await formsOf("mood=subjunctive&tense=present&person=1pl"), noi);

  const imperativo = await formsOf("mood=imperativo");
  assert.deepEqual(Object.keys(imperativo.moods), ["imperativo"]);
  assert.equal(imperativo.infinito, undefined, "a non-finite form has no finite mood");

  const passato = await formsOf("tense=passato");
  assert.deepEqual(Object.keys(passato.moods), ["congiuntivo", "condizionale"]);
  assert.deepEqual(passato.participio, ["andato"]);

  const loro = await formsOf("person=loro");
  assert.ok(Object.values(loro.moods).every((tenses: Json) => Object.values(tenses).every((cells: Json) => Object.keys(cells).join() === "loro")));
  assert.equal(loro.gerundio, undefined, "a non-finite form has no person");

  await assertRefused("q=andare&mood=indicativ", "mood");
  await assertRefused("q=andare&tense=passato%20recente", "tense");
  await assertRefused("q=andare&person=egli", "person");
});

test("gender and number narrow a noun's or adjective's grid, in Italian labels or English codes", async () => {
  const grande = async (query: string) => (await lookupBody(`q=grande&pos=adj&${query}`)).results[0].forms;

  const femminilePlurale = await grande("gender=femminile&number=plurale");
  assert.deepEqual(femminilePlurale, {
    type: "gender_number",
    grid: { femminile: { plurale: ["grandi"] } },
    superlativo: { femminile: { plurale: ["grandissime\n massime"] } },
  });
  assert.deepEqual(await grande("gender=feminine&number=plural"), femminilePlurale);
  assert.deepEqual(Object.keys((await grande("gender=maschile")).grid.maschile), ["singolare", "plurale"]);
  assert.deepEqual(Object.keys((await grande("number=singular")).grid), ["maschile", "femminile"]);
  assert.deepEqual((await lookupBody("q=sale&pos=noun&number=plurale")).results[0].forms.grid, { maschile: { plurale: ["sali"] } });

  await assertRefused("q=grande&gender=neutro", "gender");
  await assertRefused("q=grande&number=duale", "number");
});

test("filters that keep no candidate of a word the release has answer 200 with no results", async () => {
  const body = await lookupBody("q=sale&pos=adv");
  assert.deepEqual(body.results, []);
  assert.equal(body.query, "sale");
  assert.equal(body.release_id, RELEASE);
});

test("every filter kind at once: each kept candidate is filtered, shaped and narrowed", async () => {
  const body = await lookupBody(
    "q=sale&pos=verb&match=form&fields=forms,definitions&limit_definitions=1" +
      "&mood=indicativo&tense=presente&person=3sg&gender=maschile&number=singolare",
  );
  assert.deepEqual(candidates(body), ["salire verb form_of"]);
  const [salire] = body.results;
  assert.deepEqual(Object.keys(salire).sort(), ["attribution", "definitions", "forms", "id", "match", "pos", "pos_title", "word"]);
  assert.equal(salire.definitions.length, 1);
  assert.deepEqual(salire.forms, { type: "conjugation", moods: { indicativo: { presente: { "lui, lei": ["sale"] } } } });
});

test("a filtered /lookup still costs 2 units and carries release_id, attribution and the limit headers; a refused one costs none", async () => {
  const { keyId, key } = await newKey(10);
  const response = await call("/api/v1/lookup?q=sale&pos=noun&fields=definitions&limit_definitions=1&number=plurale", key);
  assert.equal(response.status, 200);
  assert.deepEqual(limitHeaders(response), ["10", "9", "40", null]);
  const body: Json = await response.json();
  assert.equal(body.release_id, RELEASE);
  assert.deepEqual(
    body.results.map((result: Json) => result.attribution.source_url),
    ["https://it.wiktionary.org/wiki/sale", "https://it.wiktionary.org/wiki/sala"],
  );

  const refused = await call("/api/v1/lookup?q=sale&pos=nouns", key);
  assert.equal(refused.status, 400);
  assert.equal(((await refused.json()) as Json).error.code, "invalid_parameter");
  assert.deepEqual(limitHeaders(refused), ["10", "8", "40", null]);
  assert.deepEqual(unitsOf(keyId), [{ day: "2026-09-27", units: 2 }]);
});
