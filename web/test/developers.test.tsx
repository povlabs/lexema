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
import { createKey, KEY_BY_HASH_SQL, revokeKey } from "../../src/api/keys.js";
import { API_PREFIX, ENDPOINTS, UNIT_WEIGHT } from "../../src/api/units.js";
import { COUNT_MINUTE_SQL, SWEEP_MINUTES_SQL } from "../../src/api/usage.js";
import { seedSql } from "../../src/import/seedSql.js";
import { fromNodeSqlite, type LookupDatabase } from "../../src/lookup/database.js";
import { loadFixturePages } from "../../src/source/rawPage.js";
import {
  API_BASE,
  ENDPOINT_REFERENCE,
  ENDPOINTS_IN_ORDER,
  ERROR_EXAMPLE,
  ERRORS,
  EXAMPLE_KEY,
  HEADERS,
  type Example,
} from "../app/apiReference.ts";
import { DeveloperDocs } from "../app/DeveloperDocs";
import { DOCS_PAGES, endpointPath } from "../app/docsPages.ts";
import { DeveloperLanding } from "../app/DeveloperLanding";
import { DeveloperFooter } from "../app/DeveloperPage";
import { DeveloperPricing } from "../app/DeveloperPricing";
import { SiteFooter } from "../app/SiteFooter";
import { handleApi } from "../worker/api/handler.ts";
import { destinationOf, ORIGIN } from "../worker/hosts.ts";

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
  return handleApi(new Request(`${API_BASE}/${path}`, { method: init.method ?? "GET", body: init.body, headers }), {
    db: over,
    releaseId: RELEASE,
    now: NOW,
  });
}

/** A value with every record id's line number blanked, the only part the fixture cannot reproduce. */
const withoutLines = (value: unknown): unknown =>
  JSON.parse(JSON.stringify(value).replaceAll(new RegExp(`"${RELEASE}:\\d+"`, "g"), `"${RELEASE}:#"`));

/** Every example the docs print, with the method it is sent with: the endpoints' in their order, then the error's. */
const EXAMPLES: [string, "GET" | "POST", Example][] = [
  ...ENDPOINTS_IN_ORDER.flatMap((name) =>
    ENDPOINT_REFERENCE[name].examples.map((example): [string, "GET" | "POST", Example] => [
      `${name} ${example.status}`,
      ENDPOINT_REFERENCE[name].method,
      example,
    ]),
  ),
  ["error", "GET", ERROR_EXAMPLE],
];

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
const docs = () => DOCS_PAGES.map((page) => renderToStaticMarkup(<DeveloperDocs page={page} />)).join("\n");

test("the docs print each example's status and response as the reference states them", () => {
  const printed = codeBlocks(docs(), "data-response").map(({ value, code }) => ({
    status: Number(value),
    response: JSON.parse(code),
  }));
  // The Errors topic comes before the endpoints.
  const inPageOrder = [EXAMPLES[EXAMPLES.length - 1], ...EXAMPLES.slice(0, -1)];
  assert.deepEqual(
    printed,
    inPageOrder.map(([, , example]) => ({ status: example.status, response: example.response })),
  );
});

/** A page as a reader reads it: its text, tags dropped. */
const textOf = (html: string): string => unescape(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");

test("the docs name every endpoint of the unit map with its weight, every /lookup filter, error code and header", () => {
  const html = docs();
  const text = textOf(html);
  for (const endpoint of ENDPOINTS) {
    const { units, per } = UNIT_WEIGHT[endpoint];
    const cost = `${units} unit${units === 1 ? "" : "s"}${per === "word" ? " per word" : ""}`;
    assert.ok(text.includes(` ${API_PREFIX}${endpoint} ${cost} `), `${endpoint}: ${cost}`);
  }
  // The filters #148 names for /lookup, each a parameter row of its topic.
  const lookup = textOf(renderToStaticMarkup(<DeveloperDocs page={{ kind: "endpoint", endpoint: "lookup" }} />));
  for (const filter of ["pos", "match", "fields", "limit_definitions", "mood", "tense", "person", "gender", "number"]) {
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
  const reference = renderToStaticMarkup(<DeveloperDocs page={{ kind: "guide", guide: "grammar-values" }} />);
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
    const html = renderToStaticMarkup(<DeveloperDocs page={{ kind: "endpoint", endpoint }} />);
    for (const parameter of ENDPOINT_REFERENCE[endpoint].parameters.filter((each) => each.continued !== undefined)) {
      const href = `/docs/grammar-values#${parameter.continued}`;
      assert.ok(html.includes(`href="${href}"`), `${endpoint} ${parameter.name}`);
      assert.ok(reference.includes(`id="${parameter.continued}"`), href);
    }
  }
});

test("every request the docs print, in every language, is sent to https://api.lexema.fyi/v1", () => {
  const requests = codeBlocks(docs(), "data-request");
  // Each example's request, and the one that shows the key header, three ways each.
  assert.equal(requests.length, (EXAMPLES.length + 1) * 3);
  for (const { value, code } of requests) {
    assert.ok(["curl", "JavaScript", "Python"].includes(value), value);
    assert.match(code, /"https:\/\/api\.lexema\.fyi\/v1\/[^"?]+(\?[^"]*)?"|`https:\/\/api\.lexema\.fyi\/v1\/[^`]+`/, code);
  }
});

/** The printed requests of one language, in the order the examples are printed. */
const requestsIn = (language: string): string[] =>
  codeBlocks(docs(), "data-request")
    .filter(({ value }) => value === language)
    .map(({ code }) => code)
    // The first is the Authentication topic's, the one that shows the key header.
    .slice(1);

test("every JavaScript example, run, sends its example's request and gets its example's answer", async (t) => {
  t.mock.method(Math, "random", () => 0);
  const { key } = await newKey();
  const run = Object.getPrototypeOf(async () => {}).constructor as new (...args: string[]) => (
    fetch: typeof globalThis.fetch,
  ) => Promise<unknown>;
  const scripts = requestsIn("JavaScript");
  const inPageOrder = [EXAMPLES[EXAMPLES.length - 1], ...EXAMPLES.slice(0, -1)];
  assert.equal(scripts.length, inPageOrder.length);
  for (const [i, [name, , example]] of inPageOrder.entries()) {
    let status = 0;
    const fetch = (async (input: string, init: RequestInit) => {
      const response = await handleApi(new Request(input, init), { db, releaseId: RELEASE, now: NOW });
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
  const inPageOrder = [EXAMPLES[EXAMPLES.length - 1], ...EXAMPLES.slice(0, -1)];
  assert.equal(scripts.length, inPageOrder.length);
  for (const [i, [name, method, example]] of inPageOrder.entries()) {
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

test("the pricing table states each endpoint's weight from the unit map, each endpoint once", () => {
  const html = renderToStaticMarkup(<DeveloperPricing />);
  const rows = [...html.matchAll(/<tr[^>]*data-cost-row=""[^>]*><th[^>]*>([^<]+)<\/th><td[^>]*>([^<]+)<\/td><\/tr>/g)].map(
    (match) => ({ endpoints: match[1].split(", "), cost: match[2] }),
  );
  assert.deepEqual(rows.flatMap((row) => row.endpoints).sort(), [...ENDPOINTS].sort());
  for (const row of rows) {
    for (const endpoint of row.endpoints) {
      const { units, per } = UNIT_WEIGHT[endpoint as keyof typeof UNIT_WEIGHT];
      assert.equal(row.cost, `${units} unit${units === 1 ? "" : "s"}${per === "word" ? " per word" : ""}`, endpoint);
    }
  }
  // No payment action (#161): no form, and the one plan button is disabled.
  assert.doesNotMatch(html, /<form/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>Coming soon<\/button>/);
});

test("every developer page carries the footer: lexema.fyi, Docs, Pricing and Contact by mail, and no Terms", () => {
  const footer = renderToStaticMarkup(<DeveloperFooter />);
  const links = [...footer.matchAll(/<a class="[^"]*" href="([^"]+)">([^<]+)<\/a>/g)].map((match) => [match[2], match[1]]);
  assert.deepEqual(links, [
    ["Lexema Developers", "/"],
    ["lexema.fyi", "https://lexema.fyi"],
    ["Docs", "/docs"],
    ["Pricing", "/pricing"],
    ["Contact", "mailto:contact@lexema.fyi"],
  ]);
  const docsPages = DOCS_PAGES.map((page) => <DeveloperDocs page={page} />);
  for (const page of [<DeveloperLanding />, ...docsPages, <DeveloperPricing />]) {
    const html = renderToStaticMarkup(page);
    assert.ok(html.includes(renderToStaticMarkup(<DeveloperFooter wide={html.includes('aria-label="Docs"')} />)));
    assert.doesNotMatch(html, /Terms/);
  }
});

test("lexema.fyi keeps no /developers route, and its footer links to the developer site", async () => {
  await assert.rejects(access(join(REPO, "web/app/(lexema)/developers")), { code: "ENOENT" });
  const footer = renderToStaticMarkup(<SiteFooter />);
  assert.match(footer, /<a class="[^"]*" href="https:\/\/developers\.lexema\.fyi">Developers<\/a>/);
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
  // Outside vinext, `next/navigation`'s notFound throws what vinext answers a 404 for.
  const hooks = registerHooks({
    resolve: (specifier, context, nextResolve) =>
      specifier === "next/navigation"
        ? {
            url: `data:text/javascript,export function notFound() { throw Object.assign(new Error("404"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" }); }`,
            shortCircuit: true,
          }
        : nextResolve(specifier, context),
  });
  try {
    const links = new Set(
      DOCS_PAGES.flatMap((page) => {
        const html = renderToStaticMarkup(<DeveloperDocs page={page} />);
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

test("the landing page links to the docs, and each endpoint to its own docs page", () => {
  const html = renderToStaticMarkup(<DeveloperLanding />);
  assert.match(html, /href="\/docs">Read the docs</);
  for (const endpoint of ENDPOINTS_IN_ORDER) assert.ok(html.includes(`href="${endpointPath(endpoint)}"`), endpoint);
});
