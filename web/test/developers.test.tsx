// The developer site's public pages (#153, #166) against the API they document.
//
// Every example the docs print is sent to `handleApi` over the development
// fixture, seeded the way `pnpm run seed:dev` seeds D1 but under release
// it-0c432803, whose archive lines the fixture holds. The answer must be the
// printed one. Only an `id`'s line number differs: the fixture puts a record
// on its own line, and the page prints the record's line in the release's
// archive (andare's verb record is line 2345 of it-extract.jsonl.gz).

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { access, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { signInAccount, verifiedIdentity } from "../../src/accounts/accounts.js";
import { suspendAccount, suspensionReasonOf } from "../../src/accounts/suspension.js";
import { ALL_ENDPOINTS, onlyEndpoints, type KeyAccess } from "../../src/api/keyAccess.js";
import { createKey, revokeKey } from "../../src/api/keys.js";
import { createAccountKey, keyName } from "../../src/api/ownedKeys.js";
import { API_PREFIX, ENDPOINTS } from "../../src/api/calls.js";
import { seedSql } from "../../src/import/seedSql.js";
import { PageOnlyCandidates, readUnrecordedPageTitles, UNRECORDED_PAGE_TITLES_FILE } from "../../src/import/pageOnlyCandidates.js";
import type { AppTables } from "../../src/db/app/database.js";
import type { LookupDatabase } from "../../src/lookup/database.js";
import { freshAppDatabase, readOnlyDictionary, subscribe } from "../../test/databases.js";
import { runPlanCommand } from "../../src/billing/planCli.js";
import { PLAN_TERMS } from "../../src/billing/plans.js";
import { loadFixturePages } from "../../src/source/rawPage.js";
import {
  apiBaseOf,
  ENDPOINT_REFERENCE,
  ENDPOINTS_IN_ORDER,
  ERRORS,
  EXAMPLE_KEY,
  HEADERS,
  LANGUAGES,
  type Example,
} from "@/lib/developers/apiReference.ts";
import { DeveloperDocs } from "@/components/developers/DeveloperDocs";
import { DOCS_PAGES, endpointPath, pathOf } from "@/lib/developers/docsPages.ts";
import { DEV_FOOTER_LEGAL, DEV_NAME, DOCS_CODE, LEGAL_CONTENTS, LEGAL_LAYOUT } from "@/components/shared/styles.ts";
import { numberDigits } from "@/components/shared/LegalPage";
import { DeveloperLanding } from "@/components/developers/DeveloperLanding";
import { DeveloperFooter, developerFooterLinks } from "@/components/developers/DeveloperPage";
import { DeveloperPrivacy, DeveloperTerms, planTermsLine } from "@/components/developers/DeveloperLegal";
import { DeveloperPricing } from "@/components/developers/DeveloperPricing";
import { SiteFooter } from "@/components/dictionary/SiteFooter";
import { handleApi } from "@/worker/api/handler.ts";
import { TestMetering } from "./metering.ts";
import { destinationOf, ORIGIN, originsOf } from "@/worker/shared/hosts.ts";

const REPO = fileURLToPath(new URL("../..", import.meta.url));
const RELEASE = "it-0c432803";
const NOW = Date.parse("2026-09-27T12:00:20Z");
/** Where the docs, rendered for the live hosts, say every endpoint lives. */
const API_BASE = apiBaseOf(ORIGIN);

let dir: string;
/** The seeded dictionary, read-only as the Worker's `DB` is. */
let dictionarySqlite: DatabaseSync;
let dictionary: LookupDatabase;
/** The app database: accounts and keys. */
let sqlite: DatabaseSync;
let db: AppTables;

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

/** Owned keys' account meters and rate bindings. */
const metering = new TestMetering();

const newKey = (perMinuteLimit = 1_000) => createKey(db, { label: "developers", perMinuteLimit }, NOW);

/** An account's plan in these tests: an active Starter over the period NOW falls in, or none, or an Enterprise plan of this many calls. */
type DocsPlan = "starter" | "no plan" | { enterpriseCalls: number };

/** A key a developer made in the dashboard, with this access, under the account `subject` names, on this plan. */
async function ownedKey(access: KeyAccess, subject = "docs", plan: DocsPlan = "starter"): Promise<string> {
  const identity = verifiedIdentity("github", { subject, verifiedEmail: `${subject}@example.com`, name: undefined });
  const name = keyName(subject);
  assert.ok(identity !== undefined && name !== undefined);
  const { accountId } = await signInAccount(db, identity, NOW);
  if (plan === "starter") {
    await subscribe(db, accountId, { plan: "starter", status: "active", periodStart: new Date("2026-09-10"), periodEnd: new Date("2026-10-10") });
  } else if (plan !== "no plan") {
    const args = ["enterprise", String(accountId), "--calls", String(plan.enterpriseCalls), "--per-minute", "60", "--from", "2026-09-01", "--until", "2026-10-01"];
    assert.equal((await runPlanCommand(args, db, NOW)).status, 0);
  }
  const created = await createAccountKey(db, accountId, name, NOW, access);
  assert.ok(created.outcome === "created");
  return created.key;
}

/** One request as the Worker hands it to the API. */
function send(path: string, init: { key?: string; method?: string; body?: string } = {}, over = dictionary): Promise<Response> {
  const headers: Record<string, string> = init.key === undefined ? {} : { "x-api-key": init.key };
  return handleApi(new Request(`${API_BASE}/${path}`, { method: init.method ?? "GET", body: init.body, headers }), {
    db: over,
    appDb: db,
    releaseId: RELEASE,
    now: NOW,
    metering,
  });
}

/** A value with every record id's line number blanked, the only part the fixture cannot reproduce. */
const withoutLines = (value: unknown): unknown =>
  JSON.parse(JSON.stringify(value).replaceAll(new RegExp(`"${RELEASE}:\\d+"`, "g"), `"${RELEASE}:#"`));

/** Every example the docs print, with the method it is sent with: the endpoints', in their order. */
const EXAMPLES: [string, "GET" | "POST", Example][] = ENDPOINTS_IN_ORDER.flatMap((name) =>
  ENDPOINT_REFERENCE[name].examples.map((example): [string, "GET" | "POST", Example] => [
    `${name} ${example.status}`,
    ENDPOINT_REFERENCE[name].method,
    example,
  ]),
);

test("every example the docs print is what the API answers for its request", async (t) => {
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

test("every error the docs list is one the API answers, with that status and code", async (t) => {
  const { key } = await newKey();
  const revoked = await newKey();
  await revokeKey(db, revoked.keyId, NOW);
  const tight = await newKey(1);
  await send("exists?q=sale", { key: tight.key });
  const expired = await ownedKey({ endpoints: ALL_ENDPOINTS, expiresAt: new Date(NOW - 1_000).toISOString() });
  const lookup = onlyEndpoints(["lookup"]);
  assert.ok(lookup !== undefined);
  const lookupOnly = await ownedKey({ endpoints: lookup, expiresAt: null });
  const planless = await ownedKey({ endpoints: ALL_ENDPOINTS, expiresAt: null }, "planless", "no plan");
  const suspended = await ownedKey({ endpoints: ALL_ENDPOINTS, expiresAt: null }, "suspended");
  const suspendedIdentity = verifiedIdentity("github", { subject: "suspended", verifiedEmail: "suspended@example.com", name: undefined });
  const reason = suspensionReasonOf("Abuse.");
  assert.ok(suspendedIdentity !== undefined && reason !== undefined);
  const { accountId: suspendedAccount } = await signInAccount(db, suspendedIdentity, NOW);
  assert.equal((await suspendAccount(db, suspendedAccount, reason, NOW, { stripe: undefined, blockList: undefined })).outcome, "suspended");
  // A plan of 1 call a period, already spent.
  const spent = await ownedKey({ endpoints: ALL_ENDPOINTS, expiresAt: null }, "spent", { enterpriseCalls: 1 });
  assert.equal((await send("exists?q=sale", { key: spent })).status, 200);
  // The key is read and its minute counted; the lookup's own read then fails.
  const failing: LookupDatabase = { all: () => Promise.reject(new Error("D1 is down")) };
  t.mock.method(console, "error", () => {});

  const earned: Record<string, () => Promise<Response>> = {
    invalid_query: () => send("lookup?q=", { key }),
    invalid_parameter: () => send("lookup?q=sale&pos=nouns", { key }),
    invalid_body: () => send("lookup/batch", { key, method: "POST", body: JSON.stringify({ q: [] }) }),
    missing_key: () => send("lookup?q=sale"),
    invalid_key: () => send("lookup?q=sale", { key: "lx_not-a-key" }),
    revoked_key: () => send("lookup?q=sale", { key: revoked.key }),
    expired_key: () => send("lookup?q=sale", { key: expired }),
    plan_required: () => send("lookup?q=sale", { key: planless }),
    account_suspended: () => send("lookup?q=sale", { key: suspended }),
    allowance_exceeded: () => send("exists?q=sale", { key: spent }),
    endpoint_not_allowed: () => send("exists?q=sale", { key: lookupOnly }),
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
    // The Errors page says a body names its `error.code` and `error.message`.
    const body = (await response.json()) as { error: { code: string; message: string } };
    assert.equal(body.error.code, error.code);
    assert.equal(typeof body.error.message, "string", error.code);
  }
});

const unescape = (html: string): string => {
  const entities: Record<string, string> = { "&quot;": '"', "&#x27;": "'", "&amp;": "&", "&lt;": "<", "&gt;": ">" };
  return html.replace(/&(quot|#x27|amp|lt|gt);/g, (entity) => entities[entity]);
};

/** Every block of code a page prints whose `<pre>` carries `attribute`, with that attribute's value. */
function codeBlocks(html: string, attribute: string): { value: string; code: string }[] {
  return [...html.matchAll(new RegExp(`<pre[^>]*\\b${attribute}="([^"]*)"[^>]*><code>([\\s\\S]*?)</code></pre>`, "g"))].map(
    // A block's lines are coloured by spans; its text is what they hold.
    (match) => ({ value: match[1], code: unescape(match[2].replace(/<[^>]+>/g, "")) }),
  );
}

/** Every page of the docs, in the sidebar's order. */
const docs = () => DOCS_PAGES.map((page) => renderToStaticMarkup(<DeveloperDocs page={page} signUp="open" origins={ORIGIN} />)).join("\n");

test("the docs print each example's status and response as the reference states them", () => {
  const printed = codeBlocks(docs(), "data-response").map(({ value, code }) => ({
    status: Number(value),
    response: JSON.parse(code),
  }));
  assert.deepEqual(
    printed,
    EXAMPLES.map(([, , example]) => ({ status: example.status, response: example.response })),
  );
});

/** A page as a reader reads it: its text, tags dropped. */
const textOf = (html: string): string => unescape(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");

test("the docs name every endpoint of the call map with the calls it counts, every /lookup filter, error code and header", () => {
  const html = docs();
  const text = textOf(html);
  for (const endpoint of ENDPOINTS) {
    const calls = endpoint === "lookup/batch" ? "1 call per word" : "1 call";
    assert.ok(text.includes(` ${API_PREFIX}${endpoint} ${calls} `), `${endpoint}: ${calls}`);
  }
  // The filters #148 names for /lookup, each a parameter row of its topic.
  const lookup = textOf(renderToStaticMarkup(<DeveloperDocs page={{ kind: "endpoint", endpoint: "lookup" }} signUp="open" origins={ORIGIN} />));
  for (const filter of ["pos", "match", "fields", "limit_definitions", "lang", "mood", "tense", "person", "gender", "number"]) {
    assert.match(lookup, new RegExp(` ${filter} (string|integer) `), filter);
  }
  for (const error of ERRORS) assert.ok(text.includes(` ${error.status} ${error.code} `), error.code);
  for (const header of HEADERS) assert.ok(text.includes(` ${header.name} `), header.name);
});

/** The values the API accepts for a parameter, read from its refusal of one it does not. */
async function acceptedBy(path: string, parameter: string, key: string): Promise<string[]> {
  const response = await send(`${path}${path.includes("?") ? "&" : "?"}${parameter}=not-a-value`, { key });
  assert.equal(response.status, 400, `${path} ${parameter}`);
  const { message } = ((await response.json()) as { error: { message: string } }).error;
  const listed = /must be one of (.*); got /.exec(message);
  assert.ok(listed, message);
  return [...listed[1].matchAll(/"([^"]+)"/g)].map((value) => value[1]);
}

test("the Grammar values page lists every value the API takes for pos, match and fields, and each ... links there", async () => {
  const { key } = await newKey();
  const reference = renderToStaticMarkup(<DeveloperDocs page={{ kind: "guide", guide: "grammar-values" }} signUp="open" origins={ORIGIN} />);
  /** The values a section of the page names, as code or as a row's name, from its heading to the next. */
  const named = (id: string): Set<string> => {
    const start = reference.indexOf(`id="${id}"`);
    assert.ok(start >= 0, id);
    const end = reference.indexOf("<h2", start);
    const section = reference.slice(start, end < 0 ? undefined : end);
    return new Set([...section.matchAll(/<(code|span)\b[^>]*>([^<]+)<\/\1>/g)].map((match) => unescape(match[2])));
  };
  const asked: [string, string, string][] = [
    ["lookup?q=sale", "pos", "pos"],
    ["random", "pos", "pos"],
    ["lookup?q=sale", "match", "match"],
    ["lookup?q=sale", "fields", "fields"],
  ];
  for (const [path, parameter, id] of asked) {
    const accepted = await acceptedBy(path, parameter, key);
    assert.ok(accepted.length > 0, `${path} ${parameter}`);
    const listed = named(id);
    for (const value of accepted) assert.ok(listed.has(value), `${path} ${parameter}: ${value}`);
  }
  // `fields=pronunciation` returns `pronunciations`: the page says so.
  assert.ok(named("fields").has("pronunciations"));

  // Where a row names part of a list and then `...`, the `...` links to the whole list.
  for (const endpoint of ["lookup", "random"] as const) {
    const html = renderToStaticMarkup(<DeveloperDocs page={{ kind: "endpoint", endpoint }} signUp="open" origins={ORIGIN} />);
    for (const parameter of ENDPOINT_REFERENCE[endpoint].parameters.filter((each) => each.continued !== undefined)) {
      const href = `/docs/grammar-values#${parameter.continued}`;
      assert.ok(html.includes(`href="${href}"`), `${endpoint} ${parameter.name}`);
      assert.ok(reference.includes(`id="${parameter.continued}"`), href);
    }
  }
});

test("every request the docs print, in every language, is sent to https://api.lexema.fyi/v1", () => {
  const requests = codeBlocks(docs(), "data-request");
  // Each example's request, three ways.
  assert.equal(requests.length, EXAMPLES.length * 3);
  for (const { value, code } of requests) {
    assert.ok(["curl", "JavaScript", "Python"].includes(value), value);
    assert.match(code, /"https:\/\/api\.lexema\.fyi\/v1\/[^"?]+(\?[^"]*)?"|`https:\/\/api\.lexema\.fyi\/v1\/[^`]+`/, code);
  }
});

/** The printed requests of one language, in the order the examples are printed. */
const requestsIn = (language: string): string[] =>
  codeBlocks(docs(), "data-request")
    .filter(({ value }) => value === language)
    .map(({ code }) => code);

test("every JavaScript example, run, sends its example's request and gets its example's answer", async (t) => {
  t.mock.method(Math, "random", () => 0);
  const { key } = await newKey();
  const run = Object.getPrototypeOf(async () => {}).constructor as new (...args: string[]) => (
    fetch: typeof globalThis.fetch,
  ) => Promise<unknown>;
  const scripts = requestsIn("JavaScript");
  assert.equal(scripts.length, EXAMPLES.length);
  for (const [i, [name, , example]] of EXAMPLES.entries()) {
    let status = 0;
    const fetch = (async (input: string, init: RequestInit) => {
      const response = await handleApi(new Request(input, init), { db: dictionary, appDb: db, releaseId: RELEASE, now: NOW, metering });
      status = response.status;
      return response;
    }) as typeof globalThis.fetch;
    // The reader puts their own key where the example writes `lx_…`.
    const placeholder = JSON.stringify(EXAMPLE_KEY);
    assert.ok(scripts[i].includes(placeholder), name);
    const script = scripts[i].replaceAll(placeholder, JSON.stringify(key));
    const data = await new run("fetch", `${script}\nreturn data;`)(fetch);
    assert.equal(status, example.status, name);
    assert.deepEqual(withoutLines(data), withoutLines(example.response), name);
  }
});

test("every Python example sends its example's method, path, query and body", () => {
  const scripts = requestsIn("Python");
  assert.equal(scripts.length, EXAMPLES.length);
  for (const [i, [name, method, example]] of EXAMPLES.entries()) {
    const script = scripts[i];
    const call = script.match(/requests\.(get|post)\(\n {4}"([^"]+)",/);
    assert.ok(call, name);
    assert.equal(call[1].toUpperCase(), method, name);
    const params = script.match(/\n {4}params=(\{.*\}),\n/)?.[1];
    const body = script.match(/\n {4}json=(\{.*\}),\n/)?.[1];
    const sent = new URL(call[2]);
    for (const [param, value] of Object.entries(params === undefined ? {} : (JSON.parse(params) as Record<string, string>))) {
      sent.searchParams.append(param, value);
    }
    const printed = new URL(`${API_BASE}/${example.path}`);
    assert.equal(sent.pathname, printed.pathname, name);
    assert.deepEqual([...sent.searchParams], [...printed.searchParams], name);
    assert.deepEqual(body === undefined ? undefined : JSON.parse(body), example.body, name);
  }
});

/** A request as it goes on the wire: its method, its address with the query, and its JSON body if it has one. */
interface Sent {
  method: string;
  url: URL;
  body: unknown;
}

/** The words of a printed command, as a POSIX shell splits them: quotes kept out, `\` line ends joined. */
const wordsOf = (command: string): string[] =>
  [...command.replaceAll("\\\n", " ").matchAll(/'([^']*)'|"([^"]*)"|(\S+)/g)].map((match) => match[1] ?? match[2] ?? match[3]);

/** What curl sends for a printed command: `-d` makes a POST, unless `-G` moves its data into the query of a GET. */
function sentByCurl(command: string): Sent {
  const [program, ...words] = wordsOf(command);
  assert.equal(program, "curl", command);
  let get = false;
  const data: string[] = [];
  const encoded: string[] = [];
  let address: string | undefined;
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (word === "-G") get = true;
    else if (word === "-H") i++;
    else if (word === "-d") data.push(words[++i]);
    else if (word === "--data-urlencode") encoded.push(words[++i]);
    else if (word.startsWith("-")) assert.fail(`an option the test does not read: ${word}`);
    else address = word;
  }
  assert.ok(address !== undefined, command);
  const url = new URL(address);
  if (get || data.length === 0) {
    for (const each of [...data, ...encoded]) {
      const [name, ...value] = each.split("=");
      url.searchParams.append(name, value.join("="));
    }
    return { method: "GET", url, body: undefined };
  }
  assert.equal(encoded.length, 0, `--data-urlencode joins a POST's body: ${command}`);
  return { method: "POST", url, body: JSON.parse(data.join("&")) };
}

/** What a printed JavaScript example passes to `fetch`, read by running it. */
async function sentByJavaScript(script: string): Promise<Sent> {
  const run = Object.getPrototypeOf(async () => {}).constructor as new (...args: string[]) => (
    fetch: typeof globalThis.fetch,
  ) => Promise<unknown>;
  let sent: Sent | undefined;
  const fetch = (async (input: string, init: RequestInit = {}) => {
    sent = { method: init.method ?? "GET", url: new URL(input), body: init.body === undefined ? undefined : JSON.parse(String(init.body)) };
    return Response.json({});
  }) as typeof globalThis.fetch;
  await new run("fetch", script)(fetch);
  assert.ok(sent !== undefined, script);
  return sent;
}

/** What a printed Python example passes to `requests`. */
function sentByPython(script: string): Sent {
  const call = script.match(/requests\.(\w+)\(\n {4}"([^"]+)",/);
  assert.ok(call, script);
  const url = new URL(call[2]);
  const params = script.match(/\n {4}params=(\{.*\}),\n/)?.[1];
  for (const [name, value] of Object.entries(params === undefined ? {} : (JSON.parse(params) as Record<string, string>))) {
    url.searchParams.append(name, value);
  }
  const body = script.match(/\n {4}json=(\{.*\}),\n/)?.[1];
  return { method: call[1].toUpperCase(), url, body: body === undefined ? undefined : JSON.parse(body) };
}

test("every request the docs print, in every language, uses its endpoint's method and its example's query and body (#763)", async () => {
  const readers: Record<(typeof LANGUAGES)[number], (code: string) => Sent | Promise<Sent>> = {
    curl: sentByCurl,
    JavaScript: sentByJavaScript,
    Python: sentByPython,
  };
  for (const language of LANGUAGES) {
    const printed = requestsIn(language);
    assert.equal(printed.length, EXAMPLES.length, language);
    for (const [i, [name, method, example]] of EXAMPLES.entries()) {
      const expected = new URL(`${API_BASE}/${example.path}`);
      const sent = await readers[language](printed[i]);
      const at = `${name} ${language}`;
      assert.equal(sent.method, method, at);
      assert.equal(`${sent.url.origin}${sent.url.pathname}`, `${expected.origin}${expected.pathname}`, at);
      assert.deepEqual([...sent.url.searchParams], [...expected.searchParams], at);
      assert.deepEqual(sent.body, example.body, at);
    }
  }
});

test("a guide page renders no code column, and each endpoint page its request and response", () => {
  for (const page of DOCS_PAGES) {
    const html = renderToStaticMarkup(<DeveloperDocs page={page} signUp="open" origins={ORIGIN} />);
    const name = pathOf(page);
    const column = html.includes(`class="${DOCS_CODE}"`);
    if (page.kind === "guide") {
      assert.ok(!column, name);
      assert.equal(codeBlocks(html, "data-request").length + codeBlocks(html, "data-response").length, 0, name);
    } else {
      assert.ok(column, name);
      assert.equal(codeBlocks(html, "data-response").length, ENDPOINT_REFERENCE[page.endpoint].examples.length, name);
      assert.equal(codeBlocks(html, "data-request").length, ENDPOINT_REFERENCE[page.endpoint].examples.length * 3, name);
    }
  }
});

test("pricing's What counts as a call table is board 26's: any endpoint 1 call, lookup/batch 1 call per word", () => {
  const html = renderToStaticMarkup(<DeveloperPricing signUp="open" origins={ORIGIN} />);
  assert.match(html, /<h2[^>]*>What counts as a call<\/h2>/);
  const rows = [...html.matchAll(/<tr[^>]*data-call-row=""[^>]*><th[^>]*>([^<]+)<\/th><td[^>]*>([^<]+)<\/td><\/tr>/g)].map(
    (match) => [match[1], match[2]],
  );
  assert.deepEqual(rows, [
    ["Any endpoint", "1 call"],
    ["lookup/batch", "1 call per word"],
  ]);
});

test("pricing shows Starter, Pro and Enterprise with the plan table's numbers, and Pro alone is Most popular (#208)", () => {
  const cardsOf = (html: string) =>
    [...html.matchAll(/<section[^>]*data-plan="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g)].map(([, plan, body]) => ({
      plan,
      body,
      lines: [...body.matchAll(/<li[^>]*>(?:<svg[\s\S]*?<\/svg>)?([^<]+)<\/li>/g)].map((line) => line[1]),
    }));
  const lines = (plan: "starter" | "pro") => [
    `${PLAN_TERMS[plan].callsPerPeriod.toLocaleString("en-US")} calls a month`,
    `${PLAN_TERMS[plan].callsPerMinute.toLocaleString("en-US")} calls a minute`,
    "All endpoints",
  ];

  const signedOut = renderToStaticMarkup(<DeveloperPricing signUp="open" origins={ORIGIN} />);
  const cards = cardsOf(signedOut);
  assert.deepEqual(
    cards.map(({ plan, lines }) => [plan, lines]),
    [
      ["starter", lines("starter")],
      ["pro", lines("pro")],
      ["enterprise", ["Custom calls a month", "Custom calls a minute", "Invoicing"]],
    ],
  );
  assert.deepEqual(
    cards.filter((card) => card.body.includes("Most popular")).map((card) => card.plan),
    ["pro"],
  );
  // No free plan, no key cap and no rate per key (Huey, #161); no batch line (#216).
  assert.doesNotMatch(signedOut, /free|per key|API keys|Batch sizes/i);

  // Choose Pro posts plan=pro to Checkout; signed out, with no CSRF token, signed in with the session's.
  const choose = (html: string, plan: string) =>
    cardsOf(html)
      .find((card) => card.plan === plan)
      ?.body.match(/<form action="([^"]+)" method="post">([\s\S]*?)<\/form>/);
  const hidden = (form: string) => Object.fromEntries([...form.matchAll(/<input type="hidden" name="([^"]+)" value="([^"]*)"\/>/g)].map((m) => [m[1], m[2]]));
  const signedOutPro = choose(signedOut, "pro");
  assert.equal(signedOutPro?.[1], "/billing/checkout");
  assert.deepEqual(hidden(signedOutPro[2]), { plan: "pro" });
  assert.match(signedOutPro[2], /<button[^>]*type="submit"[^>]*>Choose Pro<\/button>/);
  const signedIn = renderToStaticMarkup(<DeveloperPricing visitor={{ signedIn: { email: "ada@example.com", name: undefined }, csrf: "the-token" }} signUp="open" origins={ORIGIN} />);
  assert.deepEqual(hidden(choose(signedIn, "pro")?.[2] ?? ""), { plan: "pro", csrf: "the-token" });

  // Enterprise has no form: Contact us writes to the contact address.
  const enterprise = cards.find((card) => card.plan === "enterprise")?.body ?? "";
  assert.doesNotMatch(enterprise, /<form/);
  assert.match(enterprise, /<a [^>]*href="mailto:contact@lexema.fyi">Contact us<\/a>/);
});

test("every developer page carries the footer: Lexema.fyi, Docs, Pricing, Terms, Privacy and Contact by mail (#162)", () => {
  assert.deepEqual(
    developerFooterLinks(ORIGIN).map(({ label, href }) => [label, href]),
    [
      ["Lexema.fyi", "https://lexema.fyi"],
      ["Docs", "/docs"],
      ["Pricing", "/pricing"],
      ["Terms", "/terms"],
      ["Privacy", "/privacy"],
      ["Contact", "mailto:contact@lexema.fyi"],
    ],
  );
  const footer = renderToStaticMarkup(<DeveloperFooter origins={ORIGIN} />);
  const links = [...footer.matchAll(/<li( class="([^"]*)")?><a class="[^"]*" href="([^"]+)">([^<]+)<\/a>/g)].map((match) => [match[4], match[3], match[2]]);
  // On a phone, Terms and Privacy take the second row (frames 35m and 36m).
  assert.deepEqual(links, [
    ["Lexema.fyi", "https://lexema.fyi", undefined],
    ["Docs", "/docs", undefined],
    ["Pricing", "/pricing", undefined],
    ["Terms", "/terms", DEV_FOOTER_LEGAL],
    ["Privacy", "/privacy", DEV_FOOTER_LEGAL],
    ["Contact", "mailto:contact@lexema.fyi", undefined],
  ]);
  const docsPages = DOCS_PAGES.map((page) => <DeveloperDocs page={page} signUp="open" origins={ORIGIN} />);
  for (const page of [<DeveloperLanding signUp="open" origins={ORIGIN} />, ...docsPages, <DeveloperPricing signUp="open" origins={ORIGIN} />]) {
    const html = renderToStaticMarkup(page);
    assert.ok(html.includes(renderToStaticMarkup(<DeveloperFooter wide={html.includes('aria-label="Docs"')} origins={ORIGIN} />)));
  }
});

test("the developer bar names the site with one serif wordmark, as the footer does (#614)", () => {
  for (const page of [<DeveloperLanding signUp="open" origins={ORIGIN} />, <DeveloperPricing signUp="closed" origins={ORIGIN} />]) {
    const header = renderToStaticMarkup(page).match(/<header [^>]*>.*?<\/header>/)?.[0] ?? "";
    assert.ok(header.includes(`<a class="${DEV_NAME}" href="/">Lexema Developers</a>`));
  }
});

/** The developer Terms and Privacy pages as their routes serve them, signed out. */
const terms = (): string => renderToStaticMarkup(<DeveloperTerms signUp="open" origins={ORIGIN} />);
const devPrivacy = (): string => renderToStaticMarkup(<DeveloperPrivacy signUp="open" origins={ORIGIN} />);

/** A legal page's text as a reader reads it: the tags taken out, the entities read. */
const readLegal = (html: string): string =>
  html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'");

/** Every section of a legal page, in order: its id, its numbered heading, and its paragraphs and items. */
function legalSections(html: string): { id: string; heading: string; blocks: string[] }[] {
  return [...html.matchAll(/<section [^>]*id="([^"]+)"[^>]*><h2[^>]*>(.*?)<\/h2>(.*?)<\/section>/g)].map((match) => ({
    id: match[1],
    heading: readLegal(match[2]),
    blocks: [...match[3].matchAll(/<(p|li)\b[^>]*>(.*?)<\/\1>/g)].map((block) => readLegal(block[2])),
  }));
}

test("/terms on the developer host reads, section by section, exactly as Huey approved it (#162)", () => {
  const html = terms();
  assert.match(html, /<p class="[^"]*">LEXEMA DEVELOPERS · LEGAL<\/p><h1 class="[^"]*">Terms of service<\/h1><p class="[^"]*">Effective 4 October 2026<\/p>/);
  assert.ok(
    html.includes(
      ">These terms govern your use of developers.lexema.fyi and the Lexema API at api.lexema.fyi. By creating an account or calling the API, you agree to them.</p>",
    ),
  );
  assert.deepEqual(legalSections(html), [
    {
      id: "accounts",
      heading: "1. Accounts",
      blocks: [
        "The service is offered for business and professional use only. By creating an account you confirm that you are not acting as a consumer. You sign in with a Google or GitHub account that has a verified email address. You are responsible for all activity under your account and for keeping your API keys secret. If a key is exposed, revoke it from your dashboard.",
      ],
    },
    {
      id: "plans",
      heading: "2. Plans and billing",
      blocks: [
        "Access to the API requires a paid plan:",
        "(a) Starter: US$15 per month, 1,000,000 calls per month and 60 per minute;",
        "(b) Pro: US$49 per month, 5,000,000 calls per month and 300 per minute;",
        "(c) Enterprise: terms agreed in writing.",
        "Plans are billed monthly in advance through Stripe. Receipts and invoices are issued by Stripe.",
      ],
    },
    {
      id: "cancellation",
      heading: "3. Cancellation and refunds",
      blocks: [
        "You may cancel at any time from the billing portal. Your keys keep working until the end of the paid period and you are not charged again. Fees are not refunded; we may refund a charge made in error, such as a duplicate payment. If a payment fails, your keys stop answering calls until the payment succeeds or you choose a plan again.",
      ],
    },
    {
      id: "limits",
      heading: "4. Use limits",
      blocks: [
        "Each plan sets a monthly and a per-minute limit on calls, shared by all keys on the account. Calls beyond a limit are answered with status 429. You may not:",
        "(a) circumvent the limits, for example by opening several accounts;",
        "(b) interfere with or disrupt the service or its infrastructure;",
        "(c) use the service in breach of applicable law.",
      ],
    },
    {
      id: "licence",
      heading: "5. Licence of the content",
      blocks: [
        "Content returned by the API is licensed under CC BY-SA 4.0. Every result carries an attribution field naming the source and the licence. When you reuse the content you must credit the source, link to the licence and share adaptations under the same licence. Nothing in these terms restricts the rights that licence grants you.",
      ],
    },
    {
      id: "availability",
      heading: "6. Availability",
      blocks: [
        "The service is provided “as is” and “as available”. We may change, suspend or discontinue features, and we do not guarantee any level of uptime unless agreed in an Enterprise agreement.",
      ],
    },
    {
      id: "liability",
      heading: "7. Liability",
      blocks: [
        "To the extent permitted by law, Lexema is not liable for indirect or consequential loss, and its total liability is limited to the fees you paid in the three months before the claim.",
      ],
    },
    {
      id: "suspension",
      heading: "8. Suspension and termination",
      blocks: [
        "We may suspend or close any account at any time, with or without notice, if we suspect a breach of these terms, abuse, fraud or a risk to the service. When an account is suspended, its keys stop answering calls, any subscription is cancelled and no new keys can be created. You can still sign in and delete your account at any time from the dashboard.",
      ],
    },
    {
      id: "changes",
      heading: "9. Changes",
      blocks: [
        "We may update these terms. The effective date at the top shows when they last changed. By continuing to use the service after a change, you accept the updated terms.",
      ],
    },
    {
      id: "law",
      heading: "10. Governing law",
      blocks: ["These terms are governed by the laws of Italy. Any dispute arising from them falls under the exclusive jurisdiction of the Italian courts."],
    },
    { id: "contact", heading: "11. Contact", blocks: ["For any question about these terms, write to:", "contact@lexema.fyi"] },
  ]);
});

test("/privacy on the developer host reads, section by section, exactly as Huey approved it (#162)", () => {
  const html = devPrivacy();
  assert.match(html, /<p class="[^"]*">LEXEMA DEVELOPERS · LEGAL<\/p><h1 class="[^"]*">Privacy policy<\/h1><p class="[^"]*">Effective 4 October 2026<\/p>/);
  assert.ok(
    html.includes(
      ">This policy explains what information Lexema processes when you use developers.lexema.fyi and the Lexema API, why, and for how long.</p>",
    ),
  );
  assert.deepEqual(legalSections(html), [
    {
      id: "information",
      heading: "1. Information we process",
      blocks: [
        "(a) Account: your name and email address, and the identifier of the Google or GitHub account you sign in with. We keep no profile picture and no sign-in tokens;",
        "(b) Sessions: a session token and its expiry. We do not record your IP address or browser;",
        "(c) API keys: a one-way hash of each key, its label, prefix and dates. The full key is shown to you once and never stored;",
        "(d) Usage: the number of calls each key makes per day;",
        "(e) Billing: your Stripe customer and subscription identifiers, plan and status. Card details are handled by Stripe and never reach us.",
      ],
    },
    {
      id: "cookies",
      heading: "2. Cookies",
      blocks: ["We use only the cookies needed to sign you in and keep you signed in, for up to 30 days. We use no analytics or advertising cookies."],
    },
    {
      id: "purpose",
      heading: "3. Purpose and legal basis",
      blocks: [
        "We process account, key, usage and billing information to provide the service you signed up for (Article 6(1)(b) GDPR), keep billing records as tax law requires (Article 6(1)(c)), and limit requests to protect the service (Article 6(1)(f)).",
      ],
    },
    {
      id: "providers",
      heading: "4. Service providers",
      blocks: [
        "Cloudflare, Inc. hosts the service and delivers our emails. Stripe, Inc. processes payments. Google and GitHub authenticate your sign-in. We do not sell or share your information with anyone else.",
      ],
    },
    {
      id: "retention",
      heading: "5. Retention",
      blocks: [
        "We keep your account information while your account exists. When you delete your account, your sessions and sign-in identities are deleted, your name and email address are erased, and your keys are revoked. Anonymous usage counts and billing records are kept, the latter for as long as tax law requires.",
      ],
    },
    {
      id: "rights",
      heading: "6. Your rights",
      blocks: [
        "You can delete your account at any time from the dashboard. You may also ask us for a copy of your information, or to correct it, by writing to us. You have the right to object to processing and to lodge a complaint with your data protection authority.",
      ],
    },
    { id: "changes", heading: "7. Changes", blocks: ["We may update this policy. The effective date at the top shows when it last changed."] },
    { id: "contact", heading: "8. Contact", blocks: ["For any question about this policy, write to:", "privacy@lexema.fyi"] },
  ]);
});

test("/terms section 2 states each Stripe plan's price and limits from PLAN_TERMS (#162)", () => {
  const plans = legalSections(terms()).find((section) => section.id === "plans");
  for (const [mark, plan] of [["a", "starter"], ["b", "pro"]] as const) {
    const { name, usdPerMonth, callsPerPeriod, callsPerMinute } = PLAN_TERMS[plan];
    const count = (n: number) => n.toLocaleString("en-US");
    const line = `(${mark}) ${name}: US$${usdPerMonth} per month, ${count(callsPerPeriod)} calls per month and ${count(callsPerMinute)} per minute;`;
    assert.ok(plans?.blocks.includes(line), line);
    assert.equal(`(${mark}) ${planTermsLine(plan)};`, line);
  }
});

test("a legal page sizes its section numbers' slot for its highest number: two digits on /terms, one on /privacy (#585, #596)", () => {
  assert.equal(legalSections(terms()).length, 11);
  assert.ok(terms().includes(`<div class="${LEGAL_LAYOUT[2]}">`), "/terms: as wide as 11.");
  assert.ok(legalSections(devPrivacy()).length <= 9);
  assert.ok(devPrivacy().includes(`<div class="${LEGAL_LAYOUT[1]}">`), "/privacy: frame 36's one-digit edge");
  assert.deepEqual([1, 9, 10, 11].map(numberDigits), [1, 1, 2, 2]);
});

test("the developer legal pages' contact and privacy addresses are mailto links to the lexema.fyi mailboxes (#162)", () => {
  assert.match(terms(), /<a class="[^"]*" href="mailto:contact@lexema\.fyi">contact@lexema\.fyi<\/a><\/p><\/section>/);
  assert.match(devPrivacy(), /<a class="[^"]*" href="mailto:privacy@lexema\.fyi">privacy@lexema\.fyi<\/a><\/p><\/section>/);
});

test("the developer legal pages: a Contents column on a wide screen only, read as \"1. Accounts\", and the footer marks the page (#162)", () => {
  for (const [html, first, legal] of [
    [terms(), "1. Accounts", "Terms"],
    [devPrivacy(), "1. Information we process", "Privacy"],
  ] as const) {
    const contents = html.slice(html.indexOf(`<nav class="${LEGAL_CONTENTS}"`), html.indexOf("</nav>", html.indexOf(`<nav class="${LEGAL_CONTENTS}"`)));
    assert.deepEqual(LEGAL_CONTENTS.split(" "), ["hidden", "sm:block"], "no Contents column on a phone");
    const entries = [...contents.matchAll(/<a class="[^"]*" href="#([^"]+)"( aria-current="location")?>(.*?)<\/a>/g)];
    // Contents lists every section, in order, each read as its heading is.
    assert.deepEqual(
      entries.map((match) => [match[1], readLegal(match[3])]),
      legalSections(html).map((section) => [section.id, section.heading]),
    );
    assert.equal(readLegal(entries[0][3]), first);
    assert.equal(legalSections(html)[0].heading, first);
    assert.deepEqual(
      entries.map((match) => match[2] !== undefined),
      entries.map((_, i) => i === 0),
    );
    // The footer marks the page being read, and nothing else.
    assert.deepEqual(
      [...html.matchAll(/aria-current="page">([^<]+)</g)].map((match) => match[1]),
      [legal],
    );
    assert.ok(html.includes(renderToStaticMarkup(<DeveloperFooter wide legal={legal === "Terms" ? "terms" : "privacy"} origins={ORIGIN} />)));
  }
});

test("lexema.fyi keeps no /developers route, and its footer links to the developer site", async () => {
  await assert.rejects(access(join(REPO, "web/app/(lexema)/developers")), { code: "ENOENT" });
  const footer = renderToStaticMarkup(<SiteFooter origins={ORIGIN} current="/" />);
  assert.match(footer, /<a class="[^"]*" href="https:\/\/developers\.lexema\.fyi">Developers<\/a>/);
});

test("rendered for a Preview, every link to another site and every API address names that Preview's sibling host (#266)", () => {
  const name = "huey-266-preview-links";
  const preview = originsOf(`${name}.developers-preview.lexema.fyi`);
  const pages = [
    <SiteFooter origins={preview} current="/" />,
    <DeveloperLanding signUp="open" origins={preview} />,
    <DeveloperPricing signUp="open" origins={preview} />,
    ...DOCS_PAGES.map((page) => <DeveloperDocs page={page} signUp="open" origins={preview} />),
  ];
  const html = pages.map((page) => renderToStaticMarkup(page)).join("\n");
  const hosts = new Set([...html.matchAll(/https?:\/\/([a-z0-9.-]*lexema\.fyi)/g)].map((match) => match[1]));
  assert.deepEqual([...hosts].sort(), [`${name}.api-preview.lexema.fyi`, `${name}.developers-preview.lexema.fyi`, `${name}.preview.lexema.fyi`]);

  assert.match(renderToStaticMarkup(<SiteFooter origins={preview} current="/" />), new RegExp(`href="https://${name}\\.developers-preview\\.lexema\\.fyi">Developers</a>`));
  assert.match(renderToStaticMarkup(<DeveloperFooter origins={preview} />), new RegExp(`href="https://${name}\\.preview\\.lexema\\.fyi">Lexema\\.fyi</a>`));
  const attribution = renderToStaticMarkup(<DeveloperDocs page={{ kind: "guide", guide: "attribution" }} signUp="open" origins={preview} />);
  assert.match(attribution, new RegExp(`href="https://${name}\\.preview\\.lexema\\.fyi/licence"`));
  const lookup = renderToStaticMarkup(<DeveloperDocs page={{ kind: "endpoint", endpoint: "lookup" }} signUp="open" origins={preview} />);
  assert.ok(lookup.includes(`https://${name}.api-preview.lexema.fyi/v1/lookup`), "the endpoint's address and its examples");
  assert.ok(renderToStaticMarkup(<DeveloperLanding signUp="open" origins={preview} />).includes(`GET https://${name}.api-preview.lexema.fyi/v1/lookup`));
});

test("rendered for the live and local hosts, every link to another site and every API address is the live one (#266)", () => {
  for (const hostname of ["developers.lexema.fyi", "developers.localhost"]) {
    const origins = originsOf(hostname);
    const pages = [
      <SiteFooter origins={origins} current="/" />,
      <DeveloperLanding signUp="open" origins={origins} />,
      <DeveloperPricing signUp="open" origins={origins} />,
      ...DOCS_PAGES.map((page) => <DeveloperDocs page={page} signUp="open" origins={origins} />),
    ];
    const html = pages.map((page) => renderToStaticMarkup(page)).join("\n");
    const hosts = new Set([...html.matchAll(/https?:\/\/([a-z0-9.-]*lexema\.fyi)/g)].map((match) => match[1]));
    assert.deepEqual([...hosts].sort(), ["api.lexema.fyi", "developers.lexema.fyi", "lexema.fyi"], hostname);
  }
});

/**
 * The App Router page file a developer-site link is served from, with the
 * params its dynamic segments take: the link goes through `destinationOf` as
 * the Worker routes it, then down `app/(developers)`, a literal folder before
 * a `[param]` one.
 */
async function routeOf(href: string): Promise<{ file: string; params: Record<string, string> }> {
  const destination = destinationOf(new URL(href, ORIGIN.developers));
  assert.equal(destination.to, "developers", href);
  if (destination.to !== "developers") throw new Error(href);
  let dir = join(REPO, "web/app/(developers)");
  const params: Record<string, string> = {};
  for (const segment of destination.path.split("/").filter(Boolean).map(decodeURIComponent)) {
    const entries = await readdir(dir, { withFileTypes: true });
    const literal = entries.find((entry) => entry.isDirectory() && entry.name === segment);
    const dynamic = entries.find((entry) => entry.isDirectory() && /^\[[^.\]]+\]$/.test(entry.name));
    const next = literal ?? dynamic;
    assert.ok(next, `${href}: no route for ${segment}`);
    if (next === dynamic) params[next.name.slice(1, -1)] = segment;
    dir = join(dir, next.name);
  }
  return { file: join(dir, "page.tsx"), params };
}

interface RouteModule {
  default: (props: { params: Promise<Record<string, string>> }) => ReactElement | Promise<ReactElement>;
  dynamicParams?: boolean;
  generateStaticParams?: () => Record<string, string>[];
}

test("every docs sidebar link resolves to a page that renders, with that link marked current", async () => {
  // Outside vinext, `next/navigation`'s notFound throws what vinext answers a 404 for. The pages read the
  // visitor's session for the account menu (#190); with no D1 binding they read none and render signed out.
  const STUBS: Record<string, string> = {
    "next/navigation": `export function notFound() { throw Object.assign(new Error("404"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" }); } export function redirect() { throw new Error("redirect"); }`,
    "next/headers": `export async function headers() { return new Headers(); }`,
    "cloudflare:workers": `export const env = { DEVELOPER_SIGN_UP: "open" };`,
  };
  const hooks = registerHooks({
    resolve: (specifier, context, nextResolve) =>
      specifier in STUBS ? { url: `data:text/javascript,${encodeURIComponent(STUBS[specifier])}`, shortCircuit: true } : nextResolve(specifier, context),
  });
  try {
    const links = new Set(
      DOCS_PAGES.flatMap((page) => {
        const html = renderToStaticMarkup(<DeveloperDocs page={page} signUp="open" origins={ORIGIN} />);
        const start = html.indexOf('<nav aria-label="Docs">');
        const sidebar = html.slice(start, html.indexOf("</nav>", start));
        return [...sidebar.matchAll(/<a [^>]*href="([^"]+)"/g)].map((match) => match[1]);
      }),
    );
    assert.equal(links.size, DOCS_PAGES.length);
    for (const href of links) {
      const { file, params } = await routeOf(href);
      await access(file);
      const route = (await import(file)) as RouteModule;
      if (route.dynamicParams === false) {
        assert.ok(
          route.generateStaticParams?.().some((each) => JSON.stringify(each) === JSON.stringify(params)),
          `${href}: not among the route's static params`,
        );
      }
      const html = renderToStaticMarkup(await route.default({ params: Promise.resolve(params) }));
      assert.match(html, new RegExp(`<a [^>]*href="${href}" aria-current="page"`), href);
    }
    // A slug that is no page's is a 404.
    const { file } = await routeOf("/docs/nowhere");
    const route = (await import(file)) as RouteModule;
    assert.equal(route.dynamicParams, false);
    await assert.rejects(Promise.resolve().then(() => route.default({ params: Promise.resolve({ page: "nowhere" }) })), {
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
  } finally {
    hooks.deregister();
  }
});

test("a developer-site 404 is framed like its other pages: the bar and footer, not the dictionary's footer (#171)", async () => {
  // Stubbed as in the sidebar test above: vinext's notFound, and no D1 binding, so no session is read.
  const STUBS: Record<string, string> = {
    "next/navigation": `export function notFound() { throw Object.assign(new Error("404"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" }); }`,
    "next/headers": `export async function headers() { return new Headers(); }`,
    "cloudflare:workers": `export const env = { DEVELOPER_SIGN_UP: "open" };`,
  };
  const hooks = registerHooks({
    resolve: (specifier, context, nextResolve) =>
      specifier in STUBS ? { url: `data:text/javascript,${encodeURIComponent(STUBS[specifier])}`, shortCircuit: true } : nextResolve(specifier, context),
  });
  try {
    const group = join(REPO, "web/app/(developers)/developer-site");
    // A path no page matches lands on the group's catch-all, which is a 404, so the miss stays in this layout.
    const missing = (await import(join(group, "[...missing]/page.tsx"))) as RouteModule;
    await assert.rejects(Promise.resolve().then(() => missing.default({ params: Promise.resolve({}) })), {
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
    const boundary = (await import(join(group, "not-found.tsx"))) as { default: () => Promise<ReactElement> };
    const html = renderToStaticMarkup(await boundary.default());
    assert.match(html, /<nav aria-label="Developer site">/, "the developer bar");
    assert.ok(html.includes(renderToStaticMarkup(<DeveloperFooter origins={ORIGIN} />)), "the developer footer");
    assert.ok(!html.includes(renderToStaticMarkup(<SiteFooter origins={ORIGIN} current="/" />)), "no dictionary footer");
    assert.match(html, /<h1[^>]*>Page not found<\/h1>/);
  } finally {
    hooks.deregister();
  }
});

test("the landing page links to the docs, and each endpoint to its own docs page", () => {
  const html = renderToStaticMarkup(<DeveloperLanding signUp="open" origins={ORIGIN} />);
  assert.match(html, /href="\/docs">Read the docs</);
  for (const endpoint of ENDPOINTS_IN_ORDER) assert.ok(html.includes(`href="${endpointPath(endpoint)}"`), endpoint);
});

test("an endpoint's code panels are Base UI tabs, the first of each selected, and the phone contents bar is a closed collapsible holding the pages (#189)", () => {
  const html = renderToStaticMarkup(<DeveloperDocs page={{ kind: "endpoint", endpoint: "lookup" }} signUp="open" origins={ORIGIN} />);
  const tabsIn = (label: string) => {
    const list = new RegExp(`<div[^>]*role="tablist" aria-label="${label}"[^>]*>(.*?)</div>`).exec(html)?.[1] ?? "";
    return [...list.matchAll(/<button[^>]*role="tab" aria-selected="(true|false)"[^>]*>([^<]+)<\/button>/g)].map((tab) => [tab[2], tab[1] === "true"]);
  };
  assert.deepEqual(tabsIn("Request language"), [["curl", true], ["JavaScript", false], ["Python", false]]);
  const statuses = tabsIn("Response");
  assert.equal(statuses.length, ENDPOINT_REFERENCE.lookup.examples.length);
  assert.deepEqual(statuses.map(([, selected]) => selected), statuses.map((_, i) => i === 0));
  assert.doesNotMatch(html, /aria-pressed/);
  // The contents bar is the trigger; the pages wait in its panel, in the HTML while closed.
  assert.match(html, /<div data-closed="" class="[^"]*"><button type="button"[^>]*aria-expanded="false"[^>]*>Endpoints<span aria-hidden="true">\/<\/span><span[^>]*>Look up a word<\/span>/);
  assert.match(html, /<div data-closed="" hidden=""[^>]*><nav aria-label="Docs contents">/);
  assert.doesNotMatch(html, /<details|<summary/);
});
