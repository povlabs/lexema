// The JSON API's core (#150): `/v1/lookup` behind a key, its per-key
// minute limit and its daily units, over the development fixture seeded the
// way `pnpm run seed:dev` seeds D1.
//
// `handleApi` is exercised as the Worker runs it, a Request in and a Response
// out; only the D1 binding is a local `node:sqlite` database.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { signInAccount, verifiedIdentity } from "../../src/accounts/accounts.js";
import { ALL_ENDPOINTS, onlyEndpoints, type KeyAccess } from "../../src/api/keyAccess.js";
import { ACCEPT_KEY_SQL, createKey, revokeKey } from "../../src/api/keys.js";
import { createAccountKey, keyName, listAccountKeys } from "../../src/api/ownedKeys.js";
import { UNIT_WEIGHT, type Endpoint } from "../../src/api/units.js";
import { accountUsage, COUNT_MINUTE_SQL, SWEEP_MINUTES_SQL, USAGE_WINDOW_DAYS } from "../../src/api/usage.js";
import { seedSql } from "../../src/import/seedSql.js";
import { fromNodeSqlite, type LookupDatabase } from "../../src/lookup/database.js";
import { lookup } from "../../src/lookup/lookup.js";
import { findNearby } from "../../src/lookup/nearby.js";
import { suggest } from "../../src/lookup/suggest.js";
import { loadFixturePages } from "../../src/source/rawPage.js";
import { answerApi, apiNotFound, handleApi, type ApiBindings } from "../worker/api/handler.ts";
import { byHost, DEVELOPERS_SEGMENT } from "../worker/hosts.ts";
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
    new Request(`https://api.lexema.fyi${path}`, { method, headers: key === undefined ? {} : { "x-api-key": key } }),
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
  const response = await call("/v1/lookup?q=andavano", key);
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
  const body: Json = await (await call("/v1/lookup?q=sale", key)).json();
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
    const body: Json = await (await call(`/v1/lookup?q=${encodeURIComponent(q)}`, key)).json();
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
    const response = await call(`/v1/lookup?q=${q}`, key);
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
    const response = await call(`/v1/lookup?q=${q}`, key);
    assert.equal(response.status, 400);
    const body: Json = await response.json();
    assert.equal(body.error.code, "invalid_query");
  }
  const wrongMethod = await call("/v1/lookup?q=casa", key, NOW, "POST");
  assert.equal(wrongMethod.status, 405);
  const overLimit = await call("/v1/lookup?q=casa", key);
  assert.equal(overLimit.status, 429);
  assert.deepEqual(unitsOf(keyId), []);
});

test("no key, an unknown key and a revoked key are each a 401; the key row holds a hash, never the key", async () => {
  const { keyId, key } = await newKey();
  assert.equal((await call("/v1/lookup?q=casa", key)).status, 200);
  await revokeKey(db, keyId, NOW);
  const refused = [
    [await call("/v1/lookup?q=casa", undefined), "missing_key"],
    [await call("/v1/lookup?q=casa", "lx_not-a-key"), "invalid_key"],
    [await call("/v1/lookup?q=casa", key), "revoked_key"],
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

  assert.deepEqual(headers(await call("/v1/lookup?q=casa", tight.key)), ["2", "1", "40", null]);
  // A 404 and a 400 carry the headers too.
  assert.deepEqual(headers(await call("/v1/lookup?q=qqqqqq", tight.key)), ["2", "0", "40", null]);
  const refused = await call("/v1/lookup?q=casa", tight.key);
  assert.equal(refused.status, 429);
  assert.deepEqual(headers(refused), ["2", "0", "40", "40"]);
  assert.equal(((await refused.json()) as Json).error.code, "rate_limited");

  const other = await call("/v1/lookup?q=", roomy.key);
  assert.equal(other.status, 400);
  assert.deepEqual(headers(other), ["5", "4", "40", null]);

  const nextMinute = await call("/v1/lookup?q=casa", tight.key, Date.parse("2026-09-27T12:01:05Z"));
  assert.equal(nextMinute.status, 200);
  assert.deepEqual(headers(nextMinute), ["2", "1", "55", null]);
});

test("a 405, an unknown endpoint and a failed answer carry the key's limit headers; a 401 carries none", async (t) => {
  const { key } = await newKey(10);
  const wrongMethod = await call("/v1/lookup?q=casa", key, NOW, "POST");
  assert.equal(wrongMethod.status, 405);
  assert.deepEqual(limitHeaders(wrongMethod), ["10", "9", "40", null]);

  const unknown = await call("/v1/nowhere", key);
  assert.equal(unknown.status, 404);
  assert.equal(((await unknown.json()) as Json).error.code, "not_found");
  assert.deepEqual(limitHeaders(unknown), ["10", "8", "40", null]);

  // The key is read and its minute counted; the lookup's own read then fails.
  const counting = new Set([ACCEPT_KEY_SQL, COUNT_MINUTE_SQL, SWEEP_MINUTES_SQL]);
  const failing: LookupDatabase = {
    all: (sql, params) => (counting.has(sql) ? db.all(sql, params) : Promise.reject(new Error("D1 is down"))),
  };
  t.mock.method(console, "error", () => {});
  const failed = await call("/v1/lookup?q=casa", key, NOW, "GET", failing);
  assert.equal(failed.status, 503);
  assert.equal(((await failed.json()) as Json).error.code, "unavailable");
  assert.deepEqual(limitHeaders(failed), ["10", "7", "40", null]);

  assert.deepEqual(limitHeaders(await call("/v1/lookup?q=casa", undefined)), [null, null, null, null]);
});

test("each /lookup a key makes adds 2 units to its row for the day", async () => {
  const { keyId, key } = await newKey();
  await call("/v1/lookup?q=casa", key);
  await call("/v1/lookup?q=qqqqqq", key);
  await call("/v1/lookup?q=casa", key, Date.parse("2026-09-28T00:00:01Z"));
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

test("each host reaches its own site: lexema.fyi the pages as before, api.lexema.fyi the API, developers.lexema.fyi its route group", async () => {
  const { key } = await newKey();
  const limits = {
    SEARCH_LIMIT: new CountingRateLimit(),
    SUGGEST_LIMIT: new CountingRateLimit(),
    REPORT_LIMIT: new CountingRateLimit(),
    REPORT_OPEN_LIMIT: new CountingRateLimit(),
    SIGN_IN_LIMIT: new CountingRateLimit(),
    KEY_CREATE_LIMIT: new CountingRateLimit(),
  };
  // D1's shape over the same database: prepare, bind, all.
  const d1 = {
    prepare: (sql: string) => ({
      bind: (...params: (string | number | null)[]) => ({ all: async () => ({ results: sqlite.prepare(sql).all(...params) }) }),
      all: async () => ({ results: sqlite.prepare(sql).all() }),
    }),
  };
  const env = { ...limits, DB: d1 as unknown as D1Database, LEXEMA_RELEASE: RELEASE } satisfies ApiBindings & LimitBindings;
  const appSaw: Request[] = [];
  const worker = byHost<typeof env>({
    app: withRateLimits<typeof env>(async (request) => {
      appSaw.push(request);
      // The site sets a cookie, so the API's no-cookie check fails if a request reaches it.
      return new Response("<p>page</p>", { headers: { "set-cookie": "visitor=1" } });
    }),
    api: answerApi,
    apiNotFound,
  });
  const send = (request: Request) => worker(request, env, {} as ExecutionContext);

  // The API's host answers the API, sets no cookie, and no per-visitor limit counts it.
  const answered = await send(new Request("https://api.lexema.fyi/v1/lookup?q=casa", { headers: { "x-api-key": key } }));
  assert.equal(answered.status, 200);
  assert.equal(((await answered.json()) as Json).query, "casa");
  assert.equal(answered.headers.get("set-cookie"), null);
  assert.equal((await send(new Request("https://api.lexema.fyi/v1/lookup?q=casa"))).status, 401);
  assert.equal(appSaw.length, 0);
  assert.deepEqual(Object.values(limits).map((limit) => limit.calls), [0, 0, 0, 0, 0, 0]);

  // lexema.fyi's pages get the very request that came, counted as before.
  const search = new Request("https://lexema.fyi/?q=casa");
  assert.equal(await (await send(search)).text(), "<p>page</p>");
  assert.equal(appSaw[0], search);
  assert.equal(limits.SEARCH_LIMIT.calls, 1);

  // developers.lexema.fyi/ is the developer route group's page, on its own host.
  await send(new Request("https://developers.lexema.fyi/"));
  const developers = new URL(appSaw[1].url);
  assert.equal(developers.host, "developers.lexema.fyi");
  assert.equal(developers.pathname, `/${DEVELOPERS_SEGMENT}`);
  assert.ok(existsSync(join(REPO, "web/app/(developers)", DEVELOPERS_SEGMENT, "page.tsx")));

  // The API's old path on lexema.fyi is gone: a 404 that points nowhere, and nothing behind it runs.
  const retired = await send(new Request("https://lexema.fyi/api/v1/lookup?q=sale", { headers: { "x-api-key": key } }));
  assert.equal(retired.status, 404);
  assert.equal(retired.headers.get("location"), null);
  assert.equal(appSaw.length, 2);
  assert.equal(limits.SEARCH_LIMIT.calls, 1);
});

test("api.lexema.fyi answers a JSON 503 when the Worker has no D1 binding", async (t) => {
  t.mock.method(console, "error", () => {});
  const response = await answerApi(new Request("https://api.lexema.fyi/v1/lookup?q=casa"), { LEXEMA_RELEASE: RELEASE });
  assert.equal(response.status, 503);
  assert.match(response.headers.get("content-type") ?? "", /^application\/json/);
  assert.equal(((await response.json()) as Json).error.code, "unavailable");
});

// The /lookup filters (#151).

let filterKey: string | undefined;

/** A /lookup with these parameters, on one roomy key the filter tests share. */
const lookupWith = async (query: string): Promise<Response> =>
  call(`/v1/lookup?${query}`, (filterKey ??= (await newKey(1_000, "filters")).key));

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
  const response = await call("/v1/lookup?q=sale&pos=noun&fields=definitions&limit_definitions=1&number=plurale", key);
  assert.equal(response.status, 200);
  assert.deepEqual(limitHeaders(response), ["10", "9", "40", null]);
  const body: Json = await response.json();
  assert.equal(body.release_id, RELEASE);
  assert.deepEqual(
    body.results.map((result: Json) => result.attribution.source_url),
    ["https://it.wiktionary.org/wiki/sale", "https://it.wiktionary.org/wiki/sala"],
  );

  const refused = await call("/v1/lookup?q=sale&pos=nouns", key);
  assert.equal(refused.status, 400);
  assert.equal(((await refused.json()) as Json).error.code, "invalid_parameter");
  assert.deepEqual(limitHeaders(refused), ["10", "8", "40", null]);
  assert.deepEqual(unitsOf(keyId), [{ day: "2026-09-27", units: 2 }]);
});

// The other endpoints (#152).

/** One request to an endpoint, a POST when it has a body. */
const send = (key: string, path: string, body?: string): Promise<Response> =>
  handleApi(
    new Request(`https://api.lexema.fyi/v1/${path}`, { method: body === undefined ? "GET" : "POST", body, headers: { "x-api-key": key } }),
    { db, releaseId: RELEASE, now: NOW },
  );

let endpointKey: string | undefined;

/** A request on one roomy key the endpoint tests share. */
const ask = async (path: string, body?: string): Promise<Response> =>
  send((endpointKey ??= (await newKey(1_000, "endpoints")).key), path, body);

/** A 200 answer's body. */
const okBody = async (path: string, body?: string): Promise<Json> => {
  const response = await ask(path, body);
  assert.equal(response.status, 200, path);
  return response.json();
};

/** The refusal a request that cannot be read gets: a 400 with this code. */
const assertBadRequest = async (path: string, code: string, body?: string) => {
  const response = await ask(path, body);
  assert.equal(response.status, 400, `${path} ${body ?? ""}`);
  assert.equal(((await response.json()) as Json).error.code, code, `${path} ${body ?? ""}`);
};

test("/lemmatize answers each /lookup candidate with only its lemma and the match's grammar", async () => {
  const body = await okBody("lemmatize?q=andavano");
  assert.deepEqual(
    body.results.map((result: Json) => [result.lemma, result.pos, result.pos_title, result.match]),
    [["andare", "verb", "Verbo", { surface: "andavano", via: "form_of", grammar: [{ mood: "indicativo", tense: "imperfetto", person: "loro" }] }]],
  );
  const lemmas = (await okBody("lemmatize?q=sale")).results;
  const full = (await lookupBody("q=sale")).results;
  assert.deepEqual(
    lemmas.map((result: Json) => [result.id, result.lemma, result.match]),
    full.map((result: Json) => [result.id, result.word, result.match]),
  );
  assert.deepEqual(Object.keys(lemmas[0]).sort(), ["attribution", "id", "lemma", "match", "pos", "pos_title"]);

  const missing = await ask("lemmatize?q=qqqqqq");
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { query: "qqqqqq", release_id: RELEASE, results: [] });
  await assertBadRequest("lemmatize?q=", "invalid_query");
});

test("/exists is true exactly when /lookup finds the word, and always a 200 for a well-formed q", async () => {
  for (const q of ["sale", "andavano", "bella", "Casa", "citta", "qqqqqq"]) {
    const found = (await ask(`lookup?q=${q}`)).status === 200;
    const body = await okBody(`exists?q=${q}`);
    assert.equal(body.exists, found, q);
    assert.equal(body.attribution === null, !found, q);
  }
  assert.deepEqual(await okBody("exists?q=qqqqqq"), { query: "qqqqqq", release_id: RELEASE, exists: false, attribution: null });
  await assertBadRequest("exists?q=%20", "invalid_query");
  await assertBadRequest(`exists?q=${"a".repeat(129)}`, "invalid_query");
});

test("/inflect finds andiamo for andare, congiuntivo presente noi, in Italian labels or English codes", async () => {
  const italian = await okBody("inflect?lemma=andare&mood=congiuntivo&tense=presente&person=noi");
  assert.deepEqual(
    italian.results.map((result: Json) => [result.word, result.pos, result.inflections]),
    [["andare", "verb", [{ grammar: { mood: "congiuntivo", tense: "presente", person: "noi" }, forms: ["andiamo"] }]]],
  );
  assert.deepEqual(await okBody("inflect?lemma=andare&mood=subjunctive&tense=present&person=1pl"), italian);
  assert.equal(italian.lemma, "andare");
  assert.equal(italian.release_id, RELEASE);
});

test("/inflect answers the cells /lookup's narrowed forms hold, and leaves out a record with none", async () => {
  const cells = (body: Json) => body.results.map((result: Json) => [result.word, result.pos, result.inflections]);
  assert.deepEqual(cells(await okBody("inflect?lemma=grande&gender=femminile&number=plurale")), [
    [
      "grande",
      "adj",
      [
        { grammar: { gender: "femminile", number: "plurale" }, forms: ["grandi"] },
        { grammar: { gender: "femminile", number: "plurale", degree: "superlativo" }, forms: ["grandissime\n massime"] },
      ],
    ],
  ]);

  // The same narrowing through /lookup holds the same forms, cell for cell.
  const narrowing = "tense=passato&person=noi";
  const [inflected] = (await okBody(`inflect?lemma=andare&${narrowing}`)).results;
  const [looked] = (await lookupBody(`q=andare&pos=verb&${narrowing}`)).results;
  assert.deepEqual(
    inflected.inflections.filter((cell: Json) => cell.grammar.person !== undefined),
    Object.entries(looked.forms.moods).flatMap(([mood, tenses]: [string, Json]) =>
      Object.entries(tenses).flatMap(([tense, persons]: [string, Json]) =>
        Object.entries(persons).map(([person, forms]) => ({ grammar: { mood, tense, person }, forms })),
      ),
    ),
  );

  // A verb's cells have no gender, so asking for one keeps only the noun.
  assert.deepEqual((await okBody("inflect?lemma=andare&gender=maschile")).results.map((result: Json) => result.pos), ["noun"]);
});

test("/inflect is a 404 for a word that heads no record, and a 400 for a lemma or grammar value it cannot read", async () => {
  for (const lemma of ["qqqqqq", "andavano"]) {
    const response = await ask(`inflect?lemma=${lemma}`);
    assert.equal(response.status, 404, lemma);
    assert.equal(((await response.json()) as Json).error.code, "unknown_lemma", lemma);
  }
  await assertBadRequest("inflect?lemma=andare&mood=indicativ", "invalid_parameter");
  await assertBadRequest("inflect?lemma=andare&person=noi&person=voi", "invalid_parameter");
  await assertBadRequest("inflect?mood=congiuntivo", "invalid_query");
});

test("/suggest answers suggest()'s spellings, in its order and within its limit", async () => {
  for (const q of ["sal", "a", "c", "qqq"]) {
    const answer = await suggest({ db, releaseId: RELEASE, prefix: q });
    assert.equal(answer.outcome, "suggested");
    const body = await okBody(`suggest?q=${q}`);
    assert.deepEqual(body.results.map((result: Json) => result.word), answer.suggestions, q);
  }
  await assertBadRequest("suggest?q=", "invalid_query");
});

test("/nearby answers findNearby()'s spellings in its ranking, typo called edit", async () => {
  const cases: [string, string[]][] = [
    ["citta", ["accent"]],
    ["mangare", ["edit"]],
    ["sal", ["prefix"]],
    ["qqqqqq", []],
  ];
  for (const [q, kinds] of cases) {
    const nearby = await findNearby({ db, releaseId: RELEASE, query: q });
    const offered = nearby.kind === "prefix" ? nearby.words : nearby.kind === "none" ? [] : [nearby.best, ...nearby.others];
    const body = await okBody(`nearby?q=${q}`);
    assert.deepEqual(body.results.map((result: Json) => result.word), offered, q);
    assert.deepEqual([...new Set(body.results.slice(0, 1).map((result: Json) => result.kind))], kinds, q);
  }
  await assertBadRequest("nearby?q=", "invalid_query");
});

test("/random?pos=noun answers a noun headword, and pos takes /lookup's values", async () => {
  for (let draw = 0; draw < 5; draw++) {
    const [headword] = (await okBody("random?pos=noun")).results;
    assert.equal(headword.pos, "noun");
    const record = sqlite
      .prepare("SELECT word, pos, pos_title FROM source_record WHERE release_id = ? AND line_no = ?")
      .get(RELEASE, Number(headword.id.split(":")[1]));
    assert.deepEqual({ ...record }, { word: headword.word, pos: "noun", pos_title: headword.pos_title });
  }
  assert.equal((await okBody("random?pos=adverb")).results[0].pos, "adv");
  assert.equal((await okBody("random")).results.length, 1);
  assert.deepEqual((await okBody("random?pos=affix")).results, []);
  await assertBadRequest("random?pos=nouns", "invalid_parameter");
});

test("POST /lookup/batch answers each word light: every candidate's lemma, or not found", async () => {
  const body = await okBody("lookup/batch", JSON.stringify({ q: ["sale", "andavano", "qqqqqq"] }));
  assert.equal(body.release_id, RELEASE);
  assert.deepEqual(
    body.results.map(({ attribution, id, ...light }: Json) => light),
    [
      { query: "sale", found: true, lemma: "sale", pos: "noun", pos_title: "Sostantivo" },
      { query: "sale", found: true, lemma: "sala", pos: "noun", pos_title: "Sostantivo" },
      { query: "sale", found: true, lemma: "salire", pos: "verb", pos_title: "Verbo" },
      { query: "andavano", found: true, lemma: "andare", pos: "verb", pos_title: "Verbo" },
      { query: "qqqqqq", found: false, lemma: null, pos: null, pos_title: null },
    ],
  );
});

test("POST /lookup/batch takes up to 200 words and refuses more, none, a non-string or a body that is not JSON", async () => {
  const words = (count: number) => JSON.stringify({ q: Array.from({ length: count }, (_, i) => (i % 2 === 0 ? "casa" : "qqqqqq")) });
  assert.equal((await okBody("lookup/batch", words(200))).results.filter((result: Json) => result.found === false).length, 100);
  await assertBadRequest("lookup/batch", "invalid_body", words(201));
  await assertBadRequest("lookup/batch", "invalid_body", words(0));
  await assertBadRequest("lookup/batch", "invalid_body", JSON.stringify({ q: ["casa", 3] }));
  await assertBadRequest("lookup/batch", "invalid_body", JSON.stringify({ q: ["casa", ""] }));
  await assertBadRequest("lookup/batch", "invalid_body", JSON.stringify(["casa"]));
  await assertBadRequest("lookup/batch", "invalid_body", "q=casa");
  const get = await ask("lookup/batch");
  assert.equal(get.status, 405);
  assert.equal(get.headers.get("allow"), "POST");
});

test("each endpoint charges its weight from the unit map and answers with release_id, attribution and the limit headers", async () => {
  const requests: [Endpoint, string, string?][] = [
    ["lemmatize", "lemmatize?q=sale"],
    ["exists", "exists?q=sale"],
    ["inflect", "inflect?lemma=andare&mood=congiuntivo"],
    ["suggest", "suggest?q=sal"],
    ["nearby", "nearby?q=mangare"],
    ["random", "random?pos=noun"],
    ["lookup/batch", "lookup/batch", JSON.stringify({ q: ["sale", "casa", "qqqqqq"] })],
  ];
  for (const [endpoint, path, body] of requests) {
    const { keyId, key } = await newKey(10, endpoint);
    const response = await send(key, path, body);
    assert.equal(response.status, 200, path);
    assert.deepEqual(limitHeaders(response), ["10", "9", "40", null], path);
    const json: Json = await response.json();
    assert.equal(json.release_id, RELEASE, path);
    const attributed = (json.results ?? [json]).filter((result: Json) => result.found !== false);
    assert.ok(attributed.length > 0, path);
    for (const result of attributed) {
      assert.equal(result.attribution.source, "Wikizionario", path);
      assert.equal(result.attribution.licence, "CC BY-SA 4.0", path);
      assert.match(result.attribution.source_url, /^https:\/\/it\.wiktionary\.org\/wiki\/./, path);
    }
    const weight = UNIT_WEIGHT[endpoint];
    assert.deepEqual(unitsOf(keyId), [{ day: "2026-09-27", units: weight.per === "word" ? weight.units * 3 : weight.units }], path);
  }
});

test("a request an endpoint refuses before answering costs no units", async () => {
  const { keyId, key } = await newKey(20, "refused");
  const refusedRequests: [string, string?][] = [
    ["lemmatize?q="],
    ["exists?q="],
    ["inflect?lemma=andare&tense=futuro%20remoto"],
    ["suggest?q=%20"],
    ["nearby?q="],
    ["random?pos=nouns"],
    ["lookup/batch", JSON.stringify({ q: Array.from({ length: 201 }, () => "casa") })],
  ];
  for (const [path, body] of refusedRequests) assert.equal((await send(key, path, body)).status, 400, path);
  assert.deepEqual(unitsOf(keyId), []);
});

test("an owned key's calls stamp its last use, and the account's 30-day usage reads back exactly the units the API charged", async () => {
  const identity = verifiedIdentity("github", { subject: "usage-reader", verifiedEmail: "usage@example.com" });
  assert.ok(identity !== undefined);
  const { accountId } = await signInAccount(db, identity, NOW);
  const name = keyName("dashboard");
  assert.ok(name !== undefined);
  const created = await createAccountKey(db, accountId, name, NOW);
  assert.equal(created.outcome, "created");
  const [before] = await listAccountKeys(db, accountId);
  assert.equal(before.lastUsedAt, null);

  const yesterday = NOW - 24 * 60 * 60 * 1000;
  const calls: [string, number, string?][] = [
    ["lookup?q=casa", yesterday],
    ["lookup?q=qqqqqq", NOW],
    ["nearby?q=mangare", NOW],
    ["lookup/batch", NOW, JSON.stringify({ q: ["sale", "casa"] })],
    ["lookup?q=", NOW], // a 400: accepted, so it stamps the key, but charged nothing
  ];
  for (const [path, at, body] of calls) {
    await handleApi(
      new Request(`https://api.lexema.fyi/v1/${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: { "x-api-key": created.key, ...(body === undefined ? {} : { "content-type": "application/json" }) },
        body,
      }),
      { db, releaseId: RELEASE, now: at },
    );
  }

  const [after] = await listAccountKeys(db, accountId);
  assert.equal(after.lastUsedAt, new Date(NOW).toISOString());

  const charged = sqlite.prepare("SELECT day, units FROM api_key_usage WHERE key_id = ? ORDER BY day").all(created.keyId);
  const lookup = UNIT_WEIGHT.lookup.units;
  const today = lookup + UNIT_WEIGHT.nearby.units + 2 * UNIT_WEIGHT["lookup/batch"].units;
  assert.deepEqual(charged.map((row) => ({ ...row })), [
    { day: "2026-09-26", units: lookup },
    { day: "2026-09-27", units: today },
  ]);

  const usage = await accountUsage(db, accountId, NOW);
  const expected = Array<number>(USAGE_WINDOW_DAYS).fill(0);
  expected[USAGE_WINDOW_DAYS - 2] = lookup;
  expected[USAGE_WINDOW_DAYS - 1] = today;
  assert.deepEqual(usage.keys, [{ keyId: created.keyId, units: expected }]);
  assert.deepEqual(usage.total, expected);
});

/** A key made in the dashboard with this access (#187), under its own account. */
async function keyWith(subject: string, access: KeyAccess): Promise<{ keyId: number; key: string }> {
  const identity = verifiedIdentity("github", { subject, verifiedEmail: `${subject}@example.com` });
  const name = keyName(subject);
  assert.ok(identity !== undefined && name !== undefined);
  const created = await createAccountKey(db, (await signInAccount(db, identity, NOW)).accountId, name, NOW, access);
  assert.ok(created.outcome === "created");
  return created;
}

test("a key limited to some endpoints answers them, and every other endpoint is a 403 with the JSON error, costing no units", async () => {
  const some = onlyEndpoints(["lookup", "exists"]);
  assert.ok(some !== undefined);
  const { keyId, key } = await keyWith("limited", { endpoints: some, expiresAt: null });

  for (const path of ["lookup?q=casa", "exists?q=casa"]) assert.equal((await send(key, path)).status, 200, path);
  const allowed = unitsOf(keyId);
  assert.deepEqual(allowed, [{ day: "2026-09-27", units: UNIT_WEIGHT.lookup.units + UNIT_WEIGHT.exists.units }]);

  const others: [Endpoint, string, string?][] = [
    ["lemmatize", "lemmatize?q=sale"],
    ["inflect", "inflect?lemma=andare"],
    ["suggest", "suggest?q=sal"],
    ["nearby", "nearby?q=mangare"],
    ["random", "random"],
    ["lookup/batch", "lookup/batch", JSON.stringify({ q: ["casa"] })],
  ];
  for (const [endpoint, path, body] of others) {
    const response = await send(key, path, body);
    assert.equal(response.status, 403, endpoint);
    assert.equal(response.headers.get("content-type"), "application/json", endpoint);
    assert.equal(response.headers.get("ratelimit-limit"), "60", endpoint);
    const json: Json = await response.json();
    assert.equal(json.error.code, "endpoint_not_allowed", endpoint);
    assert.equal(json.error.message, `This key may not call /v1/${endpoint}.`, endpoint);
  }
  // A wrong method on a forbidden endpoint is refused the same way, and none of it was charged.
  assert.equal((await send(key, "lemmatize?q=sale", "{}")).status, 403);
  assert.deepEqual(unitsOf(keyId), allowed);

  // Every endpoint is open to a key made with All endpoints.
  const open = await keyWith("open", { endpoints: ALL_ENDPOINTS, expiresAt: null });
  assert.equal((await send(open.key, "lemmatize?q=sale")).status, 200);
});

test("an expired key answers 401 expired_key from its expiry on, like a revoked key, and is not charged", async () => {
  const { keyId, key } = await keyWith("expiring", { endpoints: ALL_ENDPOINTS, expiresAt: new Date(NOW + 60_000).toISOString() });
  // A minute before its expiry it still answers.
  assert.equal((await call("/v1/lookup?q=casa", key)).status, 200);
  for (const later of [NOW + 60_000, NOW + 24 * 60 * 60 * 1000]) {
    const response = await call("/v1/lookup?q=casa", key, later);
    assert.equal(response.status, 401);
    // No limit headers: like any refused key, it never reached its minute.
    assert.equal(response.headers.get("ratelimit-limit"), null);
    const json: Json = await response.json();
    assert.deepEqual(json.error, { code: "expired_key", message: "This API key has expired." });
  }
  assert.deepEqual(unitsOf(keyId), [{ day: "2026-09-27", units: UNIT_WEIGHT.lookup.units }]);
});
