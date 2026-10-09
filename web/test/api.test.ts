// The JSON API's core (#150): `/v1/lookup` behind a key, its per-key
// minute limit and its daily calls, over the development fixture seeded the
// way `pnpm run seed:dev` seeds D1.
//
// `handleApi` is exercised as the Worker runs it, a Request in and a Response
// out; only the two D1 bindings, the dictionary and the app database, are
// local `node:sqlite` databases.

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
import { liftSuspension, suspendAccount, suspensionReasonOf } from "../../src/accounts/suspension.js";
import { ALL_ENDPOINTS, onlyEndpoints, type KeyAccess } from "../../src/api/keyAccess.js";
import { runKeyCommand } from "../../src/api/keyCli.js";
import { createKey, hashApiKey, revokeKey } from "../../src/api/keys.js";
import { createAccountKey, keyName, listAccountKeys } from "../../src/api/ownedKeys.js";
import type { Endpoint } from "../../src/api/calls.js";
import { accountUsage, USAGE_WINDOW_DAYS } from "../../src/api/usage.js";
import { seedSql } from "../../src/import/seedSql.js";
import { PageOnlyCandidates, readUnrecordedPageTitles, UNRECORDED_PAGE_TITLES_FILE } from "../../src/import/pageOnlyCandidates.js";
import type { AppTables } from "../../src/db/app/database.js";
import type { LookupDatabase } from "../../src/lookup/database.js";
import { freshAppDatabase, readOnlyDictionary, subscribe, type SeededSubscription } from "../../test/databases.js";
import { runPlanCommand } from "../../src/billing/planCli.js";
import { PLAN_TERMS } from "../../src/billing/plans.js";
import { subscription } from "../../src/db/app/schema.js";
import { eq } from "drizzle-orm";
import { drizzleOverNodeSqlite } from "../../src/db/app/nodeSqlite.js";
import { lookup } from "../../src/lookup/lookup.js";
import { findNearby, type Nearby } from "../../src/lookup/nearby.js";
import { offered, suggest } from "../../src/lookup/suggest.js";
import { loadFixturePages } from "../../src/source/rawPage.js";
import { answerApi, apiNotFound, handleApi, lookedUpWord, type ApiBindings } from "@/worker/api/handler.ts";
import { PreviewSlice } from "../../src/deploy/previewSlice.js";
import { byHost, DEVELOPERS_SEGMENT } from "@/worker/shared/hosts.ts";
import { withRateLimits, type LimitBindings } from "@/worker/shared/rateLimit.ts";
import { SITE_LIMITS } from "./siteLimits.ts";
import { RATE_WINDOW_SECONDS } from "@/worker/api/keyLimits.ts";
import { FakeRateLimit, TestMetering } from "./metering.ts";
import { SURFACE_ROUTE, wordPage } from "@/lib/dictionary/wordPage.ts";
import { suggestionsOf } from "@/worker/api/lookupAnswer.ts";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const RELEASE = "it-api-test";
/** 12:00:20 UTC: 40 seconds before the minute ends. */
const NOW = Date.parse("2026-09-27T12:00:20Z");
/** The billing period NOW falls in, as a Stripe subscription item holds it. */
const PERIOD_START = new Date("2026-09-10T00:00:00Z");
const PERIOD_END = new Date("2026-10-10T00:00:00Z");
/** An active Starter plan over that period: what an owned key's account has unless a test says otherwise. */
const STARTER: SeededSubscription = { plan: "starter", status: "active", periodStart: PERIOD_START, periodEnd: PERIOD_END };

let dir: string;
/** The seeded dictionary, read-only as the Worker's `DB` is. */
let dictionarySqlite: DatabaseSync;
let dictionary: LookupDatabase;
/** The app database: keys and usage. */
let sqlite: DatabaseSync;
let db: AppTables;
/** Every owned key's account meter and rate binding. */
const metering = new TestMetering();

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
    // As `pnpm run seed:dev` offers them for the fixture (#499).
    pageOnly: PageOnlyCandidates.listed(await readUnrecordedPageTitles(join(REPO, UNRECORDED_PAGE_TITLES_FILE))),
    onRejection: (rejection) => {
      throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
    },
  });
  dictionarySqlite = new DatabaseSync(":memory:");
  for (const part of parts) dictionarySqlite.exec(await readFile(part, "utf8"));
  dictionary = readOnlyDictionary(dictionarySqlite);
  ({ sqlite, appDb: db } = freshAppDatabase());
});

after(async () => {
  sqlite.close();
  dictionarySqlite.close();
  await rm(dir, { recursive: true, force: true });
});

/** A new admin key with this per-minute limit. */
const newKey = async (perMinuteLimit = 60, label = "test"): Promise<{ keyId: number; key: string }> =>
  createKey(db, { label, perMinuteLimit }, NOW);

/** One API request, as the Worker hands it over. */
const call = (path: string, key: string | undefined, now = NOW, method = "GET", over = dictionary): Promise<Response> =>
  handleApi(
    new Request(`https://api.lexema.fyi${path}`, { method, headers: key === undefined ? {} : { "x-api-key": key } }),
    { db: over, appDb: db, releaseId: RELEASE, now, metering },
  );

/** The per-key limit headers, in a fixed order. */
const limitHeaders = (response: Response) =>
  ["ratelimit-limit", "ratelimit-remaining", "ratelimit-reset", "retry-after"].map((name) => response.headers.get(name));

/** Calls the key has been charged, per day. */
const callsOf = (keyId: number) =>
  sqlite.prepare("SELECT day, calls FROM api_key_usage WHERE key_id = ? ORDER BY day").all(keyId).map((row) => ({ ...row }));

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
  const found = await lookup({ db: dictionary, releaseId: RELEASE, query: "sale" });
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

/** Every spelling `findNearby` offers, in the order the answer lists them. */
function offeredBy(nearby: Nearby): string[] {
  switch (nearby.kind) {
    case "prefix":
      return nearby.words;
    case "none":
      return [];
    case "phrase":
      return [nearby.best, ...nearby.others].map((offer) => offer.phrase);
    default:
      return [nearby.best, ...nearby.others, ...nearby.phrases.map((offer) => offer.phrase)];
  }
}

test("a word not in the release is a 404 offering findNearby's spellings in its order, typo called edit", async () => {
  const { key } = await newKey();
  const cases: [string, string[]][] = [
    ["citta", ["accent"]],
    ["mangare", ["edit"]],
    ["sal", ["prefix"]],
    ["qqqqqq", []],
    ["tiro%20fouri", ["phrase"]],
  ];
  for (const [q, kinds] of cases) {
    const response = await call(`/v1/lookup?q=${q}`, key);
    assert.equal(response.status, 404, q);
    const body: Json = await response.json();
    const offered = offeredBy(await findNearby({ db: dictionary, releaseId: RELEASE, query: decodeURIComponent(q) }));
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

test("a spelling with a final apostrophe the query left off is an accent suggestion, and a longer word is a prefix one (#468)", () => {
  const nearby: Nearby = { kind: "accent", best: "dall'", others: ["dalla"], phrases: [] };
  assert.deepEqual(
    suggestionsOf(nearby, "dall").map(({ word, kind }) => [word, kind]),
    [
      ["dall'", "accent"],
      ["dalla", "prefix"],
    ],
  );
});

test("a /lookup refused before an answer counts no calls, toward the day or the minute: a bad q, a wrong method, a 429", async () => {
  const { keyId, key } = await newKey(1);
  for (const q of ["", "%20%20", "a".repeat(129)]) {
    const response = await call(`/v1/lookup?q=${q}`, key);
    assert.equal(response.status, 400);
    const body: Json = await response.json();
    assert.equal(body.error.code, "invalid_query");
  }
  const wrongMethod = await call("/v1/lookup?q=casa", key, NOW, "POST");
  assert.equal(wrongMethod.status, 405);
  // None of those spent the key's one call a minute.
  assert.equal((await call("/v1/lookup?q=casa", key)).status, 200);
  const overLimit = await call("/v1/lookup?q=casa", key);
  assert.equal(overLimit.status, 429);
  assert.deepEqual(callsOf(keyId), [{ day: "2026-09-27", calls: 1 }]);
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

test("an admin key stored before #201, and one made by the CLI, both answer 200", async () => {
  // The row an earlier CLI left, as it stands once seeded under this schema: no owner, its own limit, no access columns.
  const earlier = "lx_" + "e".repeat(64);
  sqlite
    .prepare(
      `INSERT INTO api_key (key_hash, label, per_minute_limit, created_at, display_prefix)
       VALUES (?, 'earlier', 60, '2026-09-01T00:00:00.000Z', ?)`,
    )
    .run(await hashApiKey(earlier), earlier.slice(0, 11));

  const created = await runKeyCommand(["create", "--label", "x", "--per-minute", "60"], db, NOW);
  assert.equal(created.status, 0, created.out);
  const cli = created.out.match(/lx_[0-9a-f]{64}/)?.[0];
  assert.ok(cli !== undefined, created.out);

  for (const key of [earlier, cli]) {
    const response = await call("/v1/lookup?q=casa", key);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("ratelimit-limit"), "60");
  }
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
  assert.deepEqual(((await refused.json()) as Json).error, {
    code: "rate_limited",
    message: "This key may make 2 calls a minute. Retry after 40 s.",
  });

  // A 400 counts nothing, and says so exactly.
  const other = await call("/v1/lookup?q=", roomy.key);
  assert.equal(other.status, 400);
  assert.deepEqual(headers(other), ["5", "5", "40", null]);

  const nextMinute = await call("/v1/lookup?q=casa", tight.key, Date.parse("2026-09-27T12:01:05Z"));
  assert.equal(nextMinute.status, 200);
  assert.deepEqual(headers(nextMinute), ["2", "1", "55", null]);
});

test("an admin key's minute counts calls, a batch's words each one (#216), and a batch takes no more words than that minute", async () => {
  const { key } = await newKey(5, "batches");
  const batch = (words: string[]) => send(key, "lookup/batch", JSON.stringify({ q: words }));
  const answered = await batch(["casa", "sale", "bello"]);
  assert.equal(answered.status, 200);
  assert.deepEqual(limitHeaders(answered), ["5", "2", "40", null]);
  const refused = await batch(["casa", "sale", "bello"]);
  assert.equal(refused.status, 429);
  assert.deepEqual(limitHeaders(refused), ["5", "0", "40", "40"]);
  // Six words could never fit a minute of five: unreadable, not a wait.
  const tooMany = await send((await newKey(5, "wide")).key, "lookup/batch", JSON.stringify({ q: Array(6).fill("casa") }));
  assert.equal(tooMany.status, 400);
  assert.deepEqual(((await tooMany.json()) as Json).error, {
    code: "invalid_body",
    message: "q has 6 words; this key's limit is 5, its calls a minute.",
  });
});

test("a 405, an unknown endpoint and a failed answer carry the key's limit headers; a 401 carries none", async (t) => {
  const { keyId, key } = await newKey(10);
  const wrongMethod = await call("/v1/lookup?q=casa", key, NOW, "POST");
  assert.equal(wrongMethod.status, 405);
  assert.deepEqual(limitHeaders(wrongMethod), ["10", "10", "40", null]);

  const unknown = await call("/v1/nowhere", key);
  assert.equal(unknown.status, 404);
  assert.equal(((await unknown.json()) as Json).error.code, "not_found");
  assert.deepEqual(limitHeaders(unknown), ["10", "10", "40", null]);

  // The key is read and its call counted; the lookup's own read then fails.
  const failing: LookupDatabase = { all: () => Promise.reject(new Error("D1 is down")) };
  t.mock.method(console, "error", () => {});
  const failed = await call("/v1/lookup?q=casa", key, NOW, "GET", failing);
  assert.equal(failed.status, 503);
  assert.equal(((await failed.json()) as Json).error.code, "unavailable");
  assert.deepEqual(limitHeaders(failed), ["10", "9", "40", null]);
  // An admin key is charged to its D1 day only once answered: the failed answer cost it nothing (#289).
  assert.deepEqual(callsOf(keyId), []);

  assert.deepEqual(limitHeaders(await call("/v1/lookup?q=casa", undefined)), [null, null, null, null]);
});

test("each /lookup a key makes adds 1 call to its row for the day", async () => {
  const { keyId, key } = await newKey();
  await call("/v1/lookup?q=casa", key);
  await call("/v1/lookup?q=qqqqqq", key);
  await call("/v1/lookup?q=casa", key, Date.parse("2026-09-28T00:00:01Z"));
  assert.deepEqual(callsOf(keyId), [
    { day: "2026-09-27", calls: 2 },
    { day: "2026-09-28", calls: 1 },
  ]);
});

/**
 * The metering bindings of a Worker whose requests here never reach an owned
 * key's meter: an admin key's or a refused one's. Any use of the namespace fails.
 */
const unmetered = () => ({
  ACCOUNT_METER: {} as ApiBindings["ACCOUNT_METER"],
  CALLS_60: new FakeRateLimit(60),
  CALLS_300: new FakeRateLimit(300),
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
    BILLING_LIMIT: new CountingRateLimit(),
  };
  // D1's shape over each database: prepare, bind, and all, raw or run, which
  // is how lookup and Drizzle reach it, and batch, which is how lookup sends
  // the reads of one turn together (src/lookup/database.ts).
  const d1Over = (over: DatabaseSync) => {
    const bound = (sql: string, params: (string | number | null)[]) => ({
      all: async () => ({ results: over.prepare(sql).all(...params) }),
      raw: async () => {
        const statement = over.prepare(sql);
        statement.setReturnArrays(true);
        return statement.all(...params);
      },
      run: async () => (over.prepare(sql).run(...params), { success: true }),
    });
    return {
      prepare: (sql: string) => ({ ...bound(sql, []), bind: (...params: (string | number | null)[]) => bound(sql, params) }),
      batch: (statements: { all: () => Promise<unknown> }[]) => Promise.all(statements.map((statement) => statement.all())),
    } as unknown as D1Database;
  };
  const env = {
    ...limits,
    ...unmetered(),
    DB: d1Over(dictionarySqlite),
    APP_DB: d1Over(sqlite),
    LEXEMA_RELEASE: RELEASE,
  } satisfies ApiBindings & LimitBindings;
  const appSaw: Request[] = [];
  const worker = byHost<typeof env>({
    app: withRateLimits<typeof env>(SITE_LIMITS, async (request) => {
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
  assert.deepEqual(Object.values(limits).map((limit) => limit.calls), [0, 0, 0, 0, 0, 0, 0]);

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
  const response = await answerApi(new Request("https://api.lexema.fyi/v1/lookup?q=casa"), { LEXEMA_RELEASE: RELEASE, ...unmetered() });
  assert.equal(response.status, 503);
  assert.match(response.headers.get("content-type") ?? "", /^application\/json/);
  assert.equal(((await response.json()) as Json).error.code, "unavailable");
});

test("on a Preview with a dictionary slice, the API reads the slice for a word it serves and the shared dictionary for any other (#447)", async () => {
  const { key } = await newKey(1_000, "slice");
  // A slice serving `casa`, built from the shared dictionary with a change that takes `casa` out of search, as a hide does.
  const slice = PreviewSlice.build({
    reader: { query: <Row>(sql: string) => dictionarySqlite.prepare(sql).all() as Row[] },
    words: ["casa"],
    schema: await readFile(join(REPO, "src/db/schema.sql"), "utf8"),
    changes: [{ file: "dictionary-changes/hide-casa.json", sql: "DELETE FROM lookup_form WHERE record_id IN (SELECT record_id FROM source_record WHERE word = 'casa');" }],
    fingerprint: "f".repeat(64),
  });
  const d1Over = (over: DatabaseSync) => {
    const bound = (sql: string, params: (string | number | null)[]) => ({
      all: async () => ({ results: over.prepare(sql).all(...params) }),
      raw: async () => {
        const statement = over.prepare(sql);
        statement.setReturnArrays(true);
        return statement.all(...params);
      },
      run: async () => (over.prepare(sql).run(...params), { success: true }),
    });
    return {
      prepare: (sql: string) => ({ ...bound(sql, []), bind: (...params: (string | number | null)[]) => bound(sql, params) }),
      batch: (statements: { all: () => Promise<unknown> }[]) => Promise.all(statements.map((statement) => statement.all())),
    } as unknown as D1Database;
  };
  try {
    const env = { ...unmetered(), DB: d1Over(dictionarySqlite), APP_DB: d1Over(sqlite), DICTIONARY_SLICE: d1Over(slice.db), LEXEMA_RELEASE: RELEASE } satisfies ApiBindings;
    const send = (path: string) => answerApi(new Request(`https://api.lexema.fyi${path}`, { headers: { "x-api-key": key } }), env);
    // `casa` is the slice's: there, the change took it out of search.
    assert.equal((await send("/v1/lookup?q=casa")).status, 404);
    assert.equal(((await (await send("/v1/exists?q=casa")).json()) as Json).exists, false);
    // Any other word is the shared dictionary's.
    assert.equal((await send("/v1/lookup?q=bello")).status, 200);
    // Without the slice, `casa` is the shared dictionary's, where it is found.
    const { DICTIONARY_SLICE: _slice, ...shared } = env;
    assert.equal((await answerApi(new Request("https://api.lexema.fyi/v1/lookup?q=casa", { headers: { "x-api-key": key } }), shared)).status, 200);
  } finally {
    slice.close();
  }
  assert.equal(lookedUpWord(new URL("https://api.lexema.fyi/v1/inflect?lemma=andare")), "andare");
  assert.equal(lookedUpWord(new URL("https://api.lexema.fyi/v1/suggest?q=cas")), undefined);
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

test("an inflected expression answers its multi-word headword via phrase, which match=form keeps and match=exact does not", async () => {
  assert.deepEqual(candidates(await lookupBody("q=vado%20via")), ["andare via phrase phrase"]);
  assert.deepEqual(candidates(await lookupBody("q=tiro%20fuori")), ["tirare fuori phrase phrase"]);
  assert.deepEqual(candidates(await lookupBody("q=sono%20andati%20via")), ["andare via phrase phrase"]);
  assert.deepEqual(candidates(await lookupBody("q=volto%20le%20spalle")).sort(), [
    "volgere le spalle phrase phrase",
    "voltare le spalle phrase phrase",
  ]);
  const [result] = (await lookupBody("q=sono%20andati%20via")).results;
  assert.deepEqual(result.match, { surface: "sono andati via", via: "phrase", grammar: [] });
  assert.deepEqual(candidates(await lookupBody("q=vado%20via&match=form")), ["andare via phrase phrase"]);
  assert.deepEqual(candidates(await lookupBody("q=vado%20via&match=exact")), []);
  // `vada` is a real form of `andare`, so `vada via` is a result too.
  assert.deepEqual(candidates(await lookupBody("q=vada%20via")), ["andare via phrase phrase"]);
  const missing = await lookupWith("q=vado%20fuori");
  assert.equal(missing.status, 404);
  // A typo in one word is no result, and the query corrected as typed is a
  // `phrase` suggestion (Huey's hand check of 2026-09-30).
  for (const [q, word] of [
    ["vadoo%20via", "vado via"],
    ["vado%20vja", "vado via"],
    ["tiro%20fuory", "tiro fuori"],
  ]) {
    const typo = await lookupWith(`q=${q}`);
    assert.equal(typo.status, 404, q);
    assert.deepEqual((await typo.json() as Json).suggestions, [{ word, kind: "phrase" }], q);
  }
  // `vado via` is no headword of its own, so it has no forms to inflect.
  assert.equal((await ask("inflect?lemma=vado%20via")).status, 404);
  assert.equal((await okBody("exists?q=vado%20via")).exists, true);
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

test("every result carries its record's expressions as the page lists them, and fields=expressions selects them (#213)", async () => {
  const { results } = await lookupBody("q=fare");
  const [noun, verb] = results as { word: string; expressions: { phrase: string; meaning: string | null; has_entry: boolean }[] }[];
  assert.ok(noun !== undefined && verb !== undefined);
  // The source lists one list on both records, and each result carries it.
  assert.deepEqual(noun.expressions, verb.expressions);
  assert.deepEqual(noun.expressions[0], {
    phrase: "andare a fare in culo",
    meaning: "mandare al diavolo, mandare a quel paese",
    has_entry: false,
  });
  // has_entry: the phrase heads a record, the same test the page's link uses.
  assert.equal(noun.expressions.find((row) => row.phrase === "fare l'amore")?.has_entry, true);
  // No meaning is null, as the API's other absent values are.
  assert.ok(noun.expressions.some((row) => row.meaning === null));
  // The order is the page's.
  const found = await lookup({ db: dictionary, releaseId: RELEASE, query: "fare" });
  assert.ok(found.outcome === "found");
  const page = wordPage("fare", found.readings, [], SURFACE_ROUTE);
  assert.deepEqual(
    noun.expressions.map((row) => row.phrase),
    page.expressions?.expressions.map((row) => row.phrase),
  );

  const [only] = (await lookupBody("q=fare&fields=expressions")).results;
  assert.deepEqual(Object.keys(only).sort(), ["attribution", "expressions", "id", "match", "pos", "pos_title", "word"]);
});

// `casa` is archive line 1 of it-0c432803: 110 translations, three English
// and three Spanish among them, at /translations/30, 45, 74, 88, 106 and 109.
const CASA_EN = [
  { lang: "en", word: "house", sense: "edificio destinato all'abitazione" },
  { lang: "en", word: "home", sense: "domicilio" },
  { lang: "en", word: "house", sense: "(astrologia) ognuna delle dodici suddivisioni del cielo" },
];
const CASA_EN_ES = [
  { lang: "en", word: "house", sense: "edificio destinato all'abitazione" },
  { lang: "es", word: "casa", sense: "edificio destinato all'abitazione" },
  { lang: "en", word: "home", sense: "domicilio" },
  { lang: "es", word: "hogar", sense: "domicilio" },
  { lang: "en", word: "house", sense: "(astrologia) ognuna delle dodici suddivisioni del cielo" },
  { lang: "es", word: "casa", sense: "(astrologia) ognuna delle dodici suddivisioni del cielo" },
];

test("fields=translations returns each result's own translations as { lang, word, sense }, and an empty list for a record with none (#739)", async () => {
  const [casa] = (await lookupBody("q=casa&fields=translations")).results;
  assert.deepEqual(Object.keys(casa).sort(), ["attribution", "id", "match", "pos", "pos_title", "translations", "word"]);
  assert.equal(casa.translations.length, 110);
  assert.deepEqual(casa.translations[0], { lang: "af", word: "huis", sense: "edificio destinato all'abitazione" });
  for (const item of casa.translations) assert.deepEqual(Object.keys(item), ["lang", "word", "sense"]);
  // Unfiltered, every result carries them too.
  const [full] = (await lookupBody("q=casa")).results;
  assert.deepEqual(full.translations, casa.translations);
  // sbucciapatate's record lists none.
  const [none] = (await lookupBody("q=sbucciapatate&fields=translations")).results;
  assert.equal(none.word, "sbucciapatate");
  assert.deepEqual(none.translations, []);
});

test("lang keeps only those languages' translations, a code no record carries keeps none, and a malformed lang is a 400 naming it (#739)", async () => {
  assert.deepEqual((await lookupBody("q=casa&fields=translations&lang=en")).results[0].translations, CASA_EN);
  assert.deepEqual((await lookupBody("q=casa&fields=translations&lang=en,es")).results[0].translations, CASA_EN_ES);
  // Well-formed, and casa lists no Klingon: kept to nothing, not refused.
  assert.deepEqual((await lookupBody("q=casa&fields=translations&lang=tlh")).results[0].translations, []);
  // The source's own odd codes are well-formed: one is asked for as written.
  assert.deepEqual((await lookupBody("q=casa&fields=translations&lang=zh-min-nan")).results[0].translations, []);
  // lang narrows translations and nothing else.
  const [narrowed] = (await lookupBody("q=casa&lang=en")).results;
  const [full] = (await lookupBody("q=casa")).results;
  assert.deepEqual(narrowed.translations, CASA_EN);
  assert.deepEqual({ ...narrowed, translations: [] }, { ...full, translations: [] });
  for (const malformed of ["e n", "en,,es", "en,", "en_US", "en;es", "a".repeat(21)]) {
    await assertRefused(`q=casa&fields=translations&lang=${encodeURIComponent(malformed)}`, "lang");
  }
  await assertRefused("q=casa&lang=", "lang");
  await assertRefused("q=casa&lang=en&lang=es", "lang");
});

test("POST /lookup/batch?fields=translations adds each candidate's translations, kept to lang; without fields it stays light (#739)", async () => {
  const body = await okBody("lookup/batch?fields=translations&lang=en", JSON.stringify({ q: ["casa", "sbucciapatate", "qqqqqq"] }));
  assert.deepEqual(
    body.results.map(({ query, found, translations }: Json) => ({ query, found, translations })),
    [
      { query: "casa", found: true, translations: CASA_EN },
      { query: "sbucciapatate", found: true, translations: [] },
      { query: "qqqqqq", found: false, translations: undefined },
    ],
  );
  const all = await okBody("lookup/batch?fields=translations", JSON.stringify({ q: ["casa"] }));
  assert.equal(all.results[0].translations.length, 110);
  const light = await okBody("lookup/batch", JSON.stringify({ q: ["casa"] }));
  assert.equal("translations" in light.results[0], false);
  // A batch carries no other section, and lang alone would filter nothing.
  await assertBadRequest("lookup/batch?fields=definitions", "invalid_parameter", JSON.stringify({ q: ["casa"] }));
  await assertBadRequest("lookup/batch?lang=en", "invalid_parameter", JSON.stringify({ q: ["casa"] }));
  await assertBadRequest("lookup/batch?fields=translations&lang=e%20n", "invalid_parameter", JSON.stringify({ q: ["casa"] }));
});

// The lookup's reads may change order and grouping (#385); the answer they
// build may not. Regenerate only for a change that means to alter it:
// `--test-update-snapshots` on this file.
test("bello's whole /lookup answer is the one the snapshot holds (#385)", async (t) => {
  t.assert.snapshot(await lookupBody("q=bello"));
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

test("a filtered /lookup still counts 1 call and carries release_id, attribution and the limit headers; a refused one counts none", async () => {
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
  assert.deepEqual(limitHeaders(refused), ["10", "9", "40", null]);
  assert.deepEqual(callsOf(keyId), [{ day: "2026-09-27", calls: 1 }]);
});

// The other endpoints (#152).

/** One request to an endpoint, a POST when it has a body. */
const send = (key: string, path: string, body?: string): Promise<Response> =>
  handleApi(
    new Request(`https://api.lexema.fyi/v1/${path}`, { method: body === undefined ? "GET" : "POST", body, headers: { "x-api-key": key } }),
    { db: dictionary, appDb: db, releaseId: RELEASE, now: NOW, metering },
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
    // grande the noun lists no form; it takes `grandi` from grandi's own noun
    // record, "plurale di grande" (it-plural-gloss/v1, #145), in the seed since #695.
    ["grande", "noun", [{ grammar: { gender: "femminile", number: "plurale" }, forms: ["grandi"] }]],
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
  for (const q of ["sal", "an", "ca", "qqq", "vado%20v"]) {
    const answer = await suggest({ db: dictionary, releaseId: RELEASE, prefix: decodeURIComponent(q) });
    assert.ok(answer.outcome === "suggested");
    const body = await okBody(`suggest?q=${q}`);
    assert.deepEqual(body.results.map((result: Json) => result.word), offered(answer), q);
  }
  // A phrase's words have no page of their own: its attribution is the headword it reaches.
  const [vado] = (await okBody("suggest?q=vado%20v")).results;
  assert.equal(vado.word, "vado via");
  assert.equal(vado.attribution.source_url, "https://it.wiktionary.org/wiki/andare_via");
  const [nearby] = (await okBody("nearby?q=vadoo%20via")).results;
  assert.deepEqual([nearby.word, nearby.kind, nearby.attribution.source_url], ["vado via", "phrase", "https://it.wiktionary.org/wiki/andare_via"]);
  await assertBadRequest("suggest?q=", "invalid_query");
  // One letter is under the minimum (#387), refused as an empty q is.
  await assertBadRequest("suggest?q=a", "invalid_query");
});

test("/nearby answers findNearby()'s spellings in its ranking, typo called edit", async () => {
  const cases: [string, string[]][] = [
    ["citta", ["accent"]],
    ["mangare", ["edit"]],
    ["sal", ["prefix"]],
    ["qqqqqq", []],
    ["tiro%20fouri", ["phrase"]],
  ];
  for (const [q, kinds] of cases) {
    const offered = offeredBy(await findNearby({ db: dictionary, releaseId: RELEASE, query: decodeURIComponent(q) }));
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
    const record = dictionarySqlite
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

test("each page-only entry of a page with several part-of-speech sections has its own id, in /lookup and /lookup/batch alike", async () => {
  // Archive line 93815: `lunga`, a form of `lungo`, which has no Italian record.
  // `lungo` (revision 4038855) states Aggettivo at line 2 and Preposizione at line 11.
  const lungoDir = await mkdtemp(join(tmpdir(), "lexema-api-lungo-"));
  const { parts } = await seedSql({
    input: join(REPO, "fixtures/page-entry-v2-forms.jsonl"),
    outputDir: join(lungoDir, "sql"),
    schema: join(REPO, "src/db/schema.sql"),
    releaseId: RELEASE,
    rawPages: await loadFixturePages(join(REPO, "fixtures")),
  });
  const lungoSqlite = new DatabaseSync(":memory:");
  try {
    for (const part of parts) lungoSqlite.exec(await readFile(part, "utf8"));
    const over = readOnlyDictionary(lungoSqlite);
    const { key } = await newKey(1_000, "lungo");
    // The `lunga` record itself may answer too; these are the page-only entries' ids.
    const pageIds = async (path: string, body?: string): Promise<string[]> => {
      const response = await handleApi(
        new Request(`https://api.lexema.fyi/v1/${path}`, { method: body === undefined ? "GET" : "POST", body, headers: { "x-api-key": key } }),
        { db: over, appDb: db, releaseId: RELEASE, now: NOW, metering },
      );
      assert.equal(response.status, 200, path);
      return ((await response.json()) as Json).results.map((result: Json) => result.id).filter((id: string) => id.includes(":page:"));
    };
    const expected = [`${RELEASE}:page:4038855:2`, `${RELEASE}:page:4038855:11`];
    assert.deepEqual(await pageIds("lookup?q=lungo"), expected);
    assert.deepEqual(await pageIds("lemmatize?q=lungo"), expected);
    assert.deepEqual(await pageIds("lookup/batch", JSON.stringify({ q: ["lungo"] })), expected);
  } finally {
    lungoSqlite.close();
    await rm(lungoDir, { recursive: true, force: true });
  }
});

test("POST /lookup/batch takes up to the key's calls a minute in words and refuses more, none, a non-string or a body that is not JSON", async () => {
  const words = (count: number) => JSON.stringify({ q: Array.from({ length: count }, (_, i) => (i % 2 === 0 ? "casa" : "qqqqqq")) });
  const { key } = await newKey(200, "batch-cap");
  const full = await send(key, "lookup/batch", words(200));
  assert.equal(full.status, 200);
  assert.equal(((await full.json()) as Json).results.filter((result: Json) => result.found === false).length, 100);
  assert.equal((await send((await newKey(200, "batch-over")).key, "lookup/batch", words(201))).status, 400);
  await assertBadRequest("lookup/batch", "invalid_body", words(0));
  await assertBadRequest("lookup/batch", "invalid_body", JSON.stringify({ q: ["casa", 3] }));
  await assertBadRequest("lookup/batch", "invalid_body", JSON.stringify({ q: ["casa", ""] }));
  await assertBadRequest("lookup/batch", "invalid_body", JSON.stringify(["casa"]));
  await assertBadRequest("lookup/batch", "invalid_body", "q=casa");
  const get = await ask("lookup/batch");
  assert.equal(get.status, 405);
  assert.equal(get.headers.get("allow"), "POST");
});

test("each endpoint counts 1 call and lookup/batch 1 per word, and each answers with release_id, attribution and the limit headers", async () => {
  const requests: [Endpoint, string, string?][] = [
    ["lookup", "lookup?q=sale"],
    ["lemmatize", "lemmatize?q=sale"],
    ["exists", "exists?q=sale"],
    ["inflect", "inflect?lemma=andare&mood=congiuntivo"],
    ["suggest", "suggest?q=sal"],
    ["nearby", "nearby?q=mangare"],
    ["random", "random?pos=noun"],
    ["lookup/batch", "lookup/batch", JSON.stringify({ q: ["sale", "casa", "qqqqqq", "andare", "bello", "sala", "mangare"] })],
  ];
  for (const [endpoint, path, body] of requests) {
    const { keyId, key } = await newKey(10, endpoint);
    const response = await send(key, path, body);
    assert.equal(response.status, 200, path);
    assert.deepEqual(limitHeaders(response), ["10", endpoint === "lookup/batch" ? "3" : "9", "40", null], path);
    const json: Json = await response.json();
    assert.equal(json.release_id, RELEASE, path);
    const attributed = (json.results ?? [json]).filter((result: Json) => result.found !== false);
    assert.ok(attributed.length > 0, path);
    for (const result of attributed) {
      assert.equal(result.attribution.source, "Wikizionario", path);
      assert.equal(result.attribution.licence, "CC BY-SA 4.0", path);
      assert.match(result.attribution.source_url, /^https:\/\/it\.wiktionary\.org\/wiki\/./, path);
    }
    assert.deepEqual(callsOf(keyId), [{ day: "2026-09-27", calls: endpoint === "lookup/batch" ? 7 : 1 }], path);
  }
});

test("a request an endpoint refuses before answering counts no calls", async () => {
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
  assert.deepEqual(callsOf(keyId), []);
});

/** A developer account with one key made in the dashboard, in `appDb`. */
async function accountWithKey(
  appDb: AppTables,
  subject: string,
  plan: SeededSubscription | "no plan" = STARTER,
  access?: KeyAccess,
): Promise<{ accountId: number; keyId: number; key: string }> {
  const identity = verifiedIdentity("github", { subject, verifiedEmail: `${subject}@example.com`, name: undefined });
  const name = keyName(subject);
  assert.ok(identity !== undefined && name !== undefined);
  const { accountId } = await signInAccount(appDb, identity, NOW);
  if (plan !== "no plan") await subscribe(appDb, accountId, plan);
  const created = await createAccountKey(appDb, accountId, name, NOW, access);
  assert.ok(created.outcome === "created");
  return { accountId, keyId: created.keyId, key: created.key };
}

test("an owned key's call makes one meter call and writes to D1 only its last use, once a minute; the flush brings its calls to the 30-day usage", async () => {
  const { sqlite: own } = freshAppDatabase();
  // Every statement Drizzle sends to this app database.
  const sent: string[] = [];
  const watched = new Proxy(own, {
    get: (target, property) => {
      if (property === "prepare") return (sql: string) => (sent.push(sql), target.prepare(sql));
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const appDb: AppTables = { app: drizzleOverNodeSqlite(watched) };
  const { accountId, keyId, key } = await accountWithKey(appDb, "usage-reader");
  const meters = new TestMetering();
  sent.length = 0;

  const yesterday = NOW - 24 * 60 * 60 * 1000;
  const requests: [string, number, string?][] = [
    ["lookup?q=casa", yesterday],
    ["lookup?q=qqqqqq", NOW],
    ["nearby?q=mangare", NOW + 1_000],
    ["lookup/batch", NOW + 2_000, JSON.stringify({ q: ["sale", "casa"] })],
    ["lookup?q=", NOW + 3_000], // a 400: read before any call is counted
  ];
  const meterCalls: number[] = [];
  for (const [path, at, body] of requests) {
    const before = meters.calls.length;
    const response = await handleApi(
      new Request(`https://api.lexema.fyi/v1/${path}`, { method: body === undefined ? "GET" : "POST", headers: { "x-api-key": key }, body }),
      { db: dictionary, appDb, releaseId: RELEASE, now: at, metering: meters },
    );
    assert.equal(response.headers.get("ratelimit-limit"), "60", path);
    meterCalls.push(meters.calls.length - before);
  }
  assert.deepEqual(meterCalls, [1, 1, 1, 1, 0]);

  // Yesterday's call and the first today each stamp the key's last use; nothing else is written.
  const writes = sent.filter((sql) => !/^select /i.test(sql));
  assert.deepEqual(
    writes.map((sql) => sql.slice(0, 36)),
    Array(2).fill('update "api_key" set "last_used_at" '),
  );
  const [listed] = await listAccountKeys(appDb, accountId);
  assert.equal(listed.lastUsedAt, new Date(NOW).toISOString());
  assert.deepEqual((await accountUsage(appDb, accountId, NOW)).total, Array(USAGE_WINDOW_DAYS).fill(0));

  // The meter's alarm: 1 call yesterday; today 1 for the lookup, 1 for nearby and 2 for the batch's two words.
  sent.length = 0;
  await meters.flush(appDb, NOW + 60_000);
  assert.equal(sent.filter((sql) => /^insert into "api_key_usage"/.test(sql)).length, 1);
  const expected = Array<number>(USAGE_WINDOW_DAYS).fill(0);
  expected[USAGE_WINDOW_DAYS - 2] = 1;
  expected[USAGE_WINDOW_DAYS - 1] = 4;
  const usage = await accountUsage(appDb, accountId, NOW);
  assert.deepEqual(usage.keys, [{ keyId, calls: expected }]);
  own.close();
});

test("an account's keys share its 60 calls a minute, a batch's words each one: the call past it on either key is a 429 with Retry-After", async () => {
  const meters = new TestMetering();
  const ask = (key: string, path: string, body?: string, now = NOW) =>
    handleApi(
      new Request(`https://api.lexema.fyi/v1/${path}`, { method: body === undefined ? "GET" : "POST", headers: { "x-api-key": key }, body }),
      { db: dictionary, appDb: db, releaseId: RELEASE, now, metering: meters },
    );
  const ada = await accountWithKey(db, "shared-rate");
  const name = keyName("second");
  assert.ok(name !== undefined);
  const second = await createAccountKey(db, ada.accountId, name, NOW);
  assert.ok(second.outcome === "created");
  const other = await accountWithKey(db, "other-rate");

  for (let i = 0; i < 30; i++) assert.equal((await ask(ada.key, "exists?q=casa")).status, 200);
  const batch = await ask(second.key, "lookup/batch", JSON.stringify({ q: Array(30).fill("casa") }));
  assert.equal(batch.status, 200);
  const meterCallsBefore = meters.calls.length;

  for (const key of [ada.key, second.key]) {
    const refused = await ask(key, "exists?q=casa");
    assert.equal(refused.status, 429);
    assert.equal(refused.headers.get("retry-after"), String(RATE_WINDOW_SECONDS));
    assert.equal(refused.headers.get("ratelimit-limit"), "60");
    assert.equal(refused.headers.get("ratelimit-remaining"), null);
    assert.deepEqual(((await refused.json()) as Json).error, {
      code: "rate_limited",
      message: "This key's account may make 60 calls a minute. Retry after 60 s.",
    });
  }
  // A refused call never reached the meter, so it counted nothing there.
  assert.equal(meters.calls.length, meterCallsBefore);
  assert.equal(meters.calls.at(-1)?.admission.calls, 30);
  // The binding counts by account id, so another account is not held back.
  assert.equal((await ask(other.key, "exists?q=casa")).status, 200);
  assert.deepEqual([...meters.bindings.CALLS_60.counts.keys()], [String(ada.accountId), String(other.accountId)]);
  // A batch longer than the account's minute is unreadable, not a wait.
  const wide = await ask(other.key, "lookup/batch", JSON.stringify({ q: Array(61).fill("casa") }));
  assert.equal(wide.status, 400);
});

// Plans (#161, #263): each account's plan is a seeded row, as the Stripe
// plugin's webhook or the Enterprise CLI writes it. No Stripe call is made.

/** An Enterprise plan set with the CLI, as Huey sets one. */
async function enterprise(appDb: AppTables, accountId: number, calls: number, perMinute: number, from: string, until: string) {
  const args = ["enterprise", String(accountId), "--calls", String(calls), "--per-minute", String(perMinute), "--from", from, "--until", until];
  const set = await runPlanCommand(args, appDb, NOW);
  assert.equal(set.status, 0, set.out);
}

/** One request to an endpoint with its own metering and app database. */
const requestOf =
  (appDb: AppTables, meters: TestMetering) =>
  (key: string, path: string, body?: string, now = NOW): Promise<Response> =>
    handleApi(
      new Request(`https://api.lexema.fyi/v1/${path}`, { method: body === undefined ? "GET" : "POST", headers: { "x-api-key": key }, body }),
      { db: dictionary, appDb, releaseId: RELEASE, now, metering: meters },
    );

test("an owned key with no serving plan, past due included, is a 402 plan_required, counting nothing; cancelling before its end serves, and an admin key needs no plan", async () => {
  const { sqlite: own, appDb } = freshAppDatabase();
  const meters = new TestMetering();
  const ask = requestOf(appDb, meters);
  const day = 24 * 60 * 60 * 1000;
  const admin = await createKey(appDb, { label: "admin", perMinuteLimit: 60 }, NOW);
  // No plan row exists anywhere yet: the admin key is outside plans (#200 R1.2).
  assert.equal((await ask(admin.key, "exists?q=casa")).status, 200);

  const accounts: [string, SeededSubscription | "no plan", number][] = [
    ["no plan", "no plan", 402],
    ["ended", { ...STARTER, status: "canceled" }, 402],
    ["unpaid", { ...STARTER, status: "unpaid" }, 402],
    ["cancelled, past its end", { ...STARTER, cancelAt: new Date(NOW - 1_000) }, 402],
    // A failed payment stops the keys until it goes through (Huey, #571).
    ["past due", { ...STARTER, status: "past_due" }, 402],
    ["cancelled, before its end", { ...STARTER, cancelAt: new Date(NOW + day) }, 200],
  ];
  for (const [label, plan, status] of accounts) {
    const { key } = await accountWithKey(appDb, label.replaceAll(/[^a-z]/g, "-"), plan);
    const response = await ask(key, "exists?q=casa");
    assert.equal(response.status, status, label);
    if (status !== 402) continue;
    assert.deepEqual(((await response.json()) as Json).error, {
      code: "plan_required",
      message: "This key's account has no active plan. Choose one at https://developers.lexema.fyi/pricing.",
    });
    assert.equal(response.headers.get("ratelimit-limit"), null, label);
  }
  // Only the one serving account reached its meter; a 402 counts nothing.
  assert.equal(meters.calls.length, 1);

  // Enterprise stops serving at its --until date (Huey, #222) until the next period is set.
  const lapsing = await accountWithKey(appDb, "lapsing", "no plan");
  await enterprise(appDb, lapsing.accountId, 1_000, 10, "2026-09-01", "2026-09-28");
  assert.equal((await ask(lapsing.key, "exists?q=casa")).status, 200);
  const lapsed = await ask(lapsing.key, "exists?q=casa", undefined, Date.parse("2026-09-28T00:00:00Z"));
  assert.equal(lapsed.status, 402);
  assert.equal(((await lapsed.json()) as Json).error.code, "plan_required");
  await enterprise(appDb, lapsing.accountId, 1_000, 10, "2026-09-28", "2026-10-28");
  assert.equal((await ask(lapsing.key, "exists?q=casa", undefined, Date.parse("2026-09-28T00:00:00Z"))).status, 200);
  own.close();
});

test("an owned key whose payment failed answers 402 and meters nothing, then 200 once Stripe marks the subscription active again (#571)", async () => {
  const { sqlite: own, appDb } = freshAppDatabase();
  const meters = new TestMetering();
  const ask = requestOf(appDb, meters);
  const { accountId, key } = await accountWithKey(appDb, "renewing", { ...STARTER, status: "past_due" });
  const refused = await ask(key, "exists?q=casa");
  assert.equal(refused.status, 402);
  assert.equal(((await refused.json()) as Json).error.code, "plan_required");
  assert.equal(meters.calls.length, 0);

  await appDb.app.update(subscription).set({ status: "active" }).where(eq(subscription.referenceId, String(accountId)));
  assert.equal((await ask(key, "exists?q=casa")).status, 200);
  assert.equal(meters.calls.length, 1);
  own.close();
});

test("a suspended account whose payment also failed answers 403 account_suspended; lifted it answers 402, and 200 once paid (#573, #571)", async () => {
  const { sqlite: own, appDb } = freshAppDatabase();
  const meters = new TestMetering();
  const ask = requestOf(appDb, meters);
  const { accountId, key } = await accountWithKey(appDb, "both", { ...STARTER, status: "past_due" });
  const reason = suspensionReasonOf("Abuse.");
  assert.ok(reason);
  // No Stripe client: the past-due row stays as it is, so both refusals stand at once.
  assert.equal((await suspendAccount(appDb, accountId, reason, NOW, { stripe: undefined, blockList: undefined })).outcome, "suspended");
  const suspended = await ask(key, "exists?q=casa");
  assert.equal(suspended.status, 403);
  assert.equal(((await suspended.json()) as Json).error.code, "account_suspended");

  assert.equal((await liftSuspension(appDb, accountId, undefined)).outcome, "lifted");
  const unpaid = await ask(key, "exists?q=casa");
  assert.equal(unpaid.status, 402);
  assert.equal(((await unpaid.json()) as Json).error.code, "plan_required");
  assert.equal(meters.calls.length, 0);

  await appDb.app.update(subscription).set({ status: "active" }).where(eq(subscription.referenceId, String(accountId)));
  assert.equal((await ask(key, "exists?q=casa")).status, 200);
  assert.equal(meters.calls.length, 1);
  own.close();
});

test("plan_required names the pricing page beside the API host asked: a Preview's own, and the live one live and locally (#266)", async () => {
  const { sqlite: own, appDb } = freshAppDatabase();
  const { key } = await accountWithKey(appDb, "planless", "no plan");
  const messageOn = async (origin: string): Promise<string> => {
    const response = await handleApi(new Request(`${origin}/v1/exists?q=casa`, { headers: { "x-api-key": key } }), {
      db: dictionary,
      appDb,
      releaseId: RELEASE,
      now: NOW,
      metering: new TestMetering(),
    });
    assert.equal(response.status, 402, origin);
    return ((await response.json()) as Json).error.message;
  };
  const choose = (developers: string) => `This key's account has no active plan. Choose one at ${developers}/pricing.`;
  assert.equal(await messageOn("https://huey-266.api-preview.lexema.fyi"), choose("https://huey-266.developers-preview.lexema.fyi"));
  assert.equal(await messageOn("https://api.lexema.fyi"), choose("https://developers.lexema.fyi"));
  assert.equal(await messageOn("http://api.localhost:8787"), choose("https://developers.lexema.fyi"));
  own.close();
});

test("with Starter's allowance lowered to 3, the call past it is a 429 allowance_exceeded naming the period's end, counting nothing, and the next period's first call answers 200", async (t) => {
  // The table is a constant; lowering it here stands in for the million a real test cannot spend.
  t.mock.property(PLAN_TERMS.starter as { callsPerPeriod: number }, "callsPerPeriod", 3);
  const meters = new TestMetering();
  const ask = requestOf(db, meters);
  const { accountId, key } = await accountWithKey(db, "allowance");
  assert.equal((await ask(key, "exists?q=casa")).status, 200);
  assert.equal((await ask(key, "exists?q=casa")).status, 200);

  const expected = {
    code: "allowance_exceeded",
    message: "This key's account has used its 3 calls for this billing period. They reset at 2026-10-10T00:00:00.000Z.",
  };
  // Seconds from 2026-09-27T12:00:20Z to 2026-10-10T00:00:00Z.
  const retryAfter = String((PERIOD_END.getTime() - NOW) / 1000);
  const batch = await ask(key, "lookup/batch", JSON.stringify({ q: ["casa", "sale"] }));
  assert.equal(batch.status, 429);
  assert.deepEqual(((await batch.json()) as Json).error, expected);
  assert.equal(batch.headers.get("retry-after"), retryAfter);
  // The refused batch counted nothing: the third call still fits, and the fourth does not.
  assert.equal((await ask(key, "exists?q=casa")).status, 200);
  const over = await ask(key, "exists?q=casa");
  assert.equal(over.status, 429);
  assert.deepEqual(((await over.json()) as Json).error, expected);
  assert.equal(over.headers.get("retry-after"), retryAfter);
  assert.equal(over.headers.get("ratelimit-limit"), "60");

  // Stripe renews the plan: the row's period moves on, and the new period starts at 0.
  await db.app
    .update(subscription)
    .set({ periodStart: PERIOD_END, periodEnd: new Date("2026-11-10T00:00:00Z") })
    .where(eq(subscription.referenceId, String(accountId)));
  assert.equal((await ask(key, "exists?q=casa", undefined, PERIOD_END.getTime() + 5_000)).status, 200);
  assert.deepEqual(meters.calls.at(-1)?.admission.periodStart, PERIOD_END.toISOString());
});

/** The same key's request, answered over a dictionary whose every read fails. */
const failingRequestOf =
  (appDb: AppTables, meters: TestMetering) =>
  (key: string, path: string, body?: string): Promise<Response> =>
    handleApi(
      new Request(`https://api.lexema.fyi/v1/${path}`, { method: body === undefined ? "GET" : "POST", headers: { "x-api-key": key }, body }),
      { db: { all: () => Promise.reject(new Error("D1 is down")) }, appDb, releaseId: RELEASE, now: NOW, metering: meters },
    );

test("an owned key's request whose answer fails is a 503 that gives its calls back to the period, so the rest of the allowance still fits (#289)", async (t) => {
  t.mock.property(PLAN_TERMS.starter as { callsPerPeriod: number }, "callsPerPeriod", 3);
  t.mock.method(console, "error", () => {});
  const meters = new TestMetering();
  const ask = requestOf(db, meters);
  const { accountId, key } = await accountWithKey(db, "gives-back");
  const period = PERIOD_START.toISOString();
  const pair = JSON.stringify({ q: ["casa", "sale"] });

  // An answered request makes its one meter call, as before, and gives nothing back.
  const answered = await ask(key, "exists?q=casa");
  assert.equal(answered.status, 200);
  assert.deepEqual([meters.calls.length, meters.givenBack.length], [1, 0]);
  const before = meters.periodCalls(accountId, period);
  assert.equal(before, 1);

  const failed = await failingRequestOf(db, meters)(key, "lookup/batch", pair);
  assert.equal(failed.status, 503);
  assert.deepEqual(((await failed.json()) as Json).error, { code: "unavailable", message: "The request could not be answered. Try again later." });
  assert.deepEqual(limitHeaders(failed), limitHeaders(answered));
  assert.equal(meters.periodCalls(accountId, period), before);
  assert.deepEqual(
    meters.givenBack.map(({ given }) => given.calls),
    [2],
  );

  // The two calls left are exactly the batch's; the call after them is over the allowance.
  assert.equal((await ask(key, "lookup/batch", pair)).status, 200);
  const over = await ask(key, "exists?q=casa");
  assert.equal(over.status, 429);
  assert.equal(((await over.json()) as Json).error.code, "allowance_exceeded");
});

test("when the give-back itself fails, the answer is the same 503 and the failure is logged (#289)", async (t) => {
  const errors = t.mock.method(console, "error", () => {});
  class UnreachableGiveBack extends TestMetering {
    override async giveBack(): Promise<void> {
      throw new Error("the meter is unreachable");
    }
  }
  const meters = new UnreachableGiveBack();
  const { key } = await accountWithKey(db, "give-back-fails");
  const failed = await failingRequestOf(db, meters)(key, "exists?q=casa");
  assert.equal(failed.status, 503);
  assert.deepEqual(((await failed.json()) as Json).error, { code: "unavailable", message: "The request could not be answered. Try again later." });
  assert.equal(failed.headers.get("ratelimit-limit"), "60");
  assert.deepEqual(
    errors.mock.calls.map((call) => call.arguments[0]),
    ["api give-back failed", "api request failed"],
  );
});

test("the rate follows the plan: Pro 300 a minute on CALLS_300, Enterprise its own rate in the meter, each also its batch cap", async () => {
  const meters = new TestMetering();
  const ask = requestOf(db, meters);
  const words = (count: number) => JSON.stringify({ q: Array(count).fill("casa") });

  const pro = await accountWithKey(db, "pro-rate", { ...STARTER, plan: "pro" });
  assert.equal((await ask(pro.key, "lookup/batch", words(301))).status, 400);
  const full = await ask(pro.key, "lookup/batch", words(300));
  assert.equal(full.status, 200);
  assert.equal(full.headers.get("ratelimit-limit"), "300");
  const refused = await ask(pro.key, "exists?q=casa");
  assert.equal(refused.status, 429);
  assert.equal(((await refused.json()) as Json).error.code, "rate_limited");
  assert.deepEqual([...meters.bindings.CALLS_300.counts.keys()], [String(pro.accountId)]);

  const custom = await accountWithKey(db, "enterprise-rate", "no plan");
  await enterprise(db, custom.accountId, 1_000, 5, "2026-09-01", "2026-10-01");
  assert.equal((await ask(custom.key, "lookup/batch", words(6))).status, 400);
  for (let i = 0; i < 5; i++) assert.equal((await ask(custom.key, "exists?q=casa")).status, 200);
  const sixth = await ask(custom.key, "exists?q=casa");
  assert.equal(sixth.status, 429);
  assert.equal(sixth.headers.get("ratelimit-limit"), "5");
  assert.deepEqual(((await sixth.json()) as Json).error, {
    code: "rate_limited",
    message: "This key's account may make 5 calls a minute. Retry after 60 s.",
  });
  // Counted by the meter, which no binding stands in for; the next minute admits again.
  assert.ok(!meters.bindings.CALLS_60.counts.has(String(custom.accountId)) && !meters.bindings.CALLS_300.counts.has(String(custom.accountId)));
  assert.equal((await ask(custom.key, "exists?q=casa", undefined, NOW + 60_000)).status, 200);
});

/** A key made in the dashboard with this access (#187), under its own account. */
const keyWith = (subject: string, access: KeyAccess): Promise<{ keyId: number; key: string }> => accountWithKey(db, subject, STARTER, access);

test("a key limited to some endpoints answers them, and every other endpoint is a 403 with the JSON error, counting no calls", async () => {
  const some = onlyEndpoints(["lookup", "exists"]);
  assert.ok(some !== undefined);
  const { keyId, key } = await keyWith("limited", { endpoints: some, expiresAt: null });

  const metered = () => metering.calls.filter(({ admission }) => admission.keyId === keyId).length;
  for (const path of ["lookup?q=casa", "exists?q=casa"]) assert.equal((await send(key, path)).status, 200, path);
  assert.equal(metered(), 2);

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
  assert.equal(metered(), 2);

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
  assert.equal(metering.calls.filter(({ admission }) => admission.keyId === keyId).length, 1);
});

test("/v1/lookup leaves out Wikizionario's missing-field placeholders, as the page does (#255)", async () => {
  // The real archive lines in fixtures/placeholders.jsonl, seeded apart so the
  // shared development dictionary above stays as every other test reads it.
  const placeholderDir = await mkdtemp(join(tmpdir(), "lexema-api-placeholder-"));
  const archive = join(placeholderDir, "placeholders.jsonl.gz");
  await writeFile(archive, gzipSync(await readFile(join(REPO, "fixtures/placeholders.jsonl"))));
  const { parts } = await seedSql({
    input: archive,
    outputDir: join(placeholderDir, "sql"),
    schema: join(REPO, "src/db/schema.sql"),
    releaseId: RELEASE,
    archiveR2Key: `releases/${RELEASE}.jsonl.gz`,
    license: "CC-BY-SA-4.0",
    onRejection: (rejection) => {
      throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
    },
  });
  const placeholderSqlite = new DatabaseSync(":memory:");
  try {
    for (const part of parts) placeholderSqlite.exec(await readFile(part, "utf8"));
    const over = readOnlyDictionary(placeholderSqlite);
    const { key } = await newKey();
    const results = async (word: string): Promise<Json[]> => {
      const response = await call(`/v1/lookup?q=${encodeURIComponent(word)}`, key, NOW, "GET", over);
      assert.equal(response.status, 200, word);
      const body: Json = await response.json();
      return body.results;
    };
    const one = async (word: string, pos: string): Promise<Json> => {
      const result = (await results(word)).find((candidate: Json) => candidate.pos === pos);
      assert.ok(result, `${word}: no ${pos} result`);
      return result;
    };

    // Etymology: only the placeholder is none; beside real text, the real text.
    assert.equal((await one("andare via", "phrase")).etymology, null);
    assert.equal((await one("addì", "adv")).etymology, "(voce verbale) vedi addire");
    assert.equal((await one("Plutone", "name")).etymology, "dal greco vagabondo");
    assert.equal((await one("sbrisolona", "name")).etymology, "da sbrisola");

    // Definitions: a placeholder-only gloss is no definition, its example still returned.
    const bianca = await one("bianca", "noun");
    assert.deepEqual(bianca.definitions.map((definition: Json) => definition.definition), ["sonno iniziale dei bachi da seta"]);
    const piratato = await one("piratato", "adj");
    assert.deepEqual(piratato.definitions, []);
    assert.deepEqual(piratato.examples, ["è un cd pirataro"]);
    assert.deepEqual((await one("rapitore", "adj")).definitions.map((definition: Json) => definition.definition), ["colui che rapisce o ha già rapito"]);
    assert.deepEqual((await one("poco", "noun")).definitions.map((definition: Json) => definition.definition), ["mancante"]);

    for (const word of ["andare via", "addì", "Plutone", "sbrisolona", "bianca", "piratato", "rapitore", "gendo"]) {
      assert.doesNotMatch(JSON.stringify(await results(word)), /se vuoi, aggiungil/i, word);
    }
  } finally {
    placeholderSqlite.close();
    await rm(placeholderDir, { recursive: true, force: true });
  }
});

test("/v1/lookup leaves out a meaning that only repeats the headword, as the page does (#395)", async () => {
  const echoDir = await mkdtemp(join(tmpdir(), "lexema-api-headword-echo-"));
  const archive = join(echoDir, "headword-echo.jsonl.gz");
  await writeFile(archive, gzipSync(await readFile(join(REPO, "fixtures/headword-echo.jsonl"))));
  const { parts } = await seedSql({
    input: archive,
    outputDir: join(echoDir, "sql"),
    schema: join(REPO, "src/db/schema.sql"),
    releaseId: RELEASE,
    archiveR2Key: `releases/${RELEASE}.jsonl.gz`,
    license: "CC-BY-SA-4.0",
    onRejection: (rejection) => {
      throw new Error(`fixture line rejected: ${JSON.stringify(rejection)}`);
    },
  });
  const echoSqlite = new DatabaseSync(":memory:");
  try {
    for (const part of parts) echoSqlite.exec(await readFile(part, "utf8"));
    const over = readOnlyDictionary(echoSqlite);
    const { key } = await newKey();
    const definitions = async (word: string): Promise<string[]> => {
      const response = await call(`/v1/lookup?q=${encodeURIComponent(word)}`, key, NOW, "GET", over);
      assert.equal(response.status, 200, word);
      const body: Json = await response.json();
      assert.equal(body.results.length, 1, word);
      return body.results[0].definitions.map((definition: Json) => definition.definition);
    };

    assert.deepEqual(await definitions("presina"), []);
    assert.deepEqual(await definitions("asciugatoio"), []);
    assert.deepEqual(await definitions("sci di fondo"), []);
    assert.deepEqual(await definitions("dm"), ["domani"]);
    // A meaning that names the headword is still a meaning.
    assert.deepEqual(await definitions("sci"), [
      "lunga lamina, un tempo di legno e oggigiorno di metallo e plastica: agganciandone uno a ciascuno dei piedi mediante appositi scarponi e attacchi, viene adoperato come pattino per scivolare sulla neve",
      "sport associato all'attività di andare sugli sci",
    ]);
  } finally {
    echoSqlite.close();
    await rm(echoDir, { recursive: true, force: true });
  }
});
