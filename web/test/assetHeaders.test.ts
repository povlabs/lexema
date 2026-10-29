// The `_headers` and `_redirects` files a build leaves in dist/client (#265,
// #919). Static assets are answered before the Worker runs (web/wrangler.jsonc,
// `assets`), so the headers on them are this file's alone: noindex on every
// Preview host (ADR 0018), vinext's year-long cache on content-hashed assets,
// and the browser security headers the Worker sets on its own responses
// (#620). The same holds for the redirect from an old `/card/` address to the
// one share picture: no lookup and no drawing can run for it.
//
// vinext writes its own `_headers` only when the build has none, so
// web/public/_headers repeats its cache rule. Each test here runs a real
// `vinext build` over a one-page app that takes web/public as its public
// directory, and reads the file that build wrote.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { SHARE_IMAGE_PATH } from "@/lib/dictionary/card.ts";
import { PREVIEW_DOMAIN } from "@/worker/shared/hosts.ts";
import { SECURITY_HEADERS } from "@/worker/shared/securityHeaders.ts";
import { robotsTagOf } from "@/worker/shared/stage.ts";

const WEB = fileURLToPath(new URL("..", import.meta.url));
const VINEXT = join(WEB, "node_modules", ".bin", "vinext");

/** vinext's rule for content-hashed assets, which production must keep. */
const HASHED_ASSETS = "/_next/static/*";
const IMMUTABLE = "public, max-age=31536000, immutable";

/** What this test reads of a build's dist/client; `redirects` is absent when the build wrote none. */
type Built = { headers: string; redirects: string | undefined; shareImage: boolean };

/**
 * What a `vinext build` writes, with `publicDir` as the public directory
 * (`false` for none). The app lives under web/node_modules so it resolves
 * web's own vinext, Vite and React.
 */
function builtClient(publicDir: string | false): Built {
  const cache = join(WEB, "node_modules", ".cache");
  mkdirSync(cache, { recursive: true });
  const root = mkdtempSync(join(cache, "lexema-asset-headers-"));
  try {
    mkdirSync(join(root, "app"));
    writeFileSync(
      join(root, "app", "layout.tsx"),
      "export default function Layout({ children }: { children: React.ReactNode }) {\n  return <html><body>{children}</body></html>;\n}\n",
    );
    writeFileSync(join(root, "app", "page.tsx"), "export default function Page() {\n  return <p>page</p>;\n}\n");
    writeFileSync(
      join(root, "wrangler.jsonc"),
      JSON.stringify({
        name: "asset-headers",
        compatibility_date: "2026-09-18",
        compatibility_flags: ["nodejs_compat"],
        main: "vinext/server/app-router-entry",
        assets: { directory: "dist/client", not_found_handling: "none", binding: "ASSETS" },
      }),
    );
    // The same plugins as web/vite.config.ts, less Tailwind, which adds no file.
    writeFileSync(
      join(root, "vite.config.ts"),
      [
        `import { cloudflare } from "@cloudflare/vite-plugin";`,
        `import vinext from "vinext";`,
        `import { defineConfig } from "vite";`,
        `export default defineConfig({`,
        `  publicDir: ${JSON.stringify(publicDir)},`,
        `  plugins: [vinext(), cloudflare({ viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] } })],`,
        `});`,
        ``,
      ].join("\n"),
    );
    execFileSync(VINEXT, ["build"], { cwd: root, stdio: "pipe" });
    const client = join(root, "dist", "client");
    return {
      headers: readFileSync(join(client, "_headers"), "utf8"),
      redirects: existsSync(join(client, "_redirects")) ? readFileSync(join(client, "_redirects"), "utf8") : undefined,
      shareImage: existsSync(join(client, SHARE_IMAGE_PATH.slice(1))),
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** One `_headers` rule: a URL pattern and the headers it adds, names lower-cased. */
type Rule = { pattern: string; headers: ReadonlyMap<string, string> };

/** The rules of a `_headers` file: a pattern line, then its indented `Name: value` lines. */
function rulesOf(file: string): Rule[] {
  const rules: { pattern: string; headers: Map<string, string> }[] = [];
  for (const line of file.split("\n")) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      rules.push({ pattern: line.trim(), headers: new Map() });
      continue;
    }
    const rule = rules.at(-1);
    const colon = line.indexOf(":");
    assert.ok(rule && colon > 0, `a header line outside a rule, or with no colon: ${JSON.stringify(line)}`);
    rule.headers.set(line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim());
  }
  return rules;
}

const escape = (text: string) => text.replace(/[.+?^${}()|[\]\\]/g, "\\$&");

/**
 * Whether a rule's pattern matches `url`, as Cloudflare matches it: a `*`
 * matches anything, a `:placeholder` matches up to the next `.` or `/` in the
 * host and up to the next `/` in the path, and a pattern with no host matches
 * every host (https://developers.cloudflare.com/workers/static-assets/headers/).
 */
function matches(pattern: string, url: URL): boolean {
  const absolute = pattern.startsWith("https://");
  const rest = absolute ? pattern.slice("https://".length) : pattern;
  const slash = absolute ? rest.indexOf("/") : 0;
  const part = (text: string, placeholder: string) =>
    text
      .split(/(:[A-Za-z]\w*|\*)/)
      .map((token) => (token === "*" ? ".*" : /^:[A-Za-z]/.test(token) ? placeholder : escape(token)))
      .join("");
  const host = absolute ? part(rest.slice(0, slash), "[^./]+") : "[^/]+";
  return new RegExp(`^${host}${part(rest.slice(slash), "[^/]+")}$`).test(`${url.hostname}${url.pathname}`);
}

/** The headers a static asset at `url` gets: every matching rule's, joined with a comma when repeated. */
function headersFor(rules: readonly Rule[], url: string): Map<string, string> {
  const headers = new Map<string, string>();
  for (const rule of rules) {
    if (!matches(rule.pattern, new URL(url))) continue;
    for (const [name, value] of rule.headers) headers.set(name, headers.has(name) ? `${headers.get(name)}, ${value}` : value);
  }
  return headers;
}

/** The build with web/public, which the tests below share. */
let ours: Built | undefined;
const ourBuild = () => (ours ??= builtClient(join(WEB, "public")));
const built = () => rulesOf(ourBuild().headers);

const ASSET = "/_next/static/chunks/main-0a1b2c3d.js";
const OTHER_ASSET = "/fonts/lexend.woff2";

test("on every Preview host a static asset carries X-Robots-Tag: noindex, and a hashed one keeps its cache", () => {
  const rules = built();
  const preview = robotsTagOf("preview");
  assert.equal(preview, "noindex");
  for (const domain of Object.values(PREVIEW_DOMAIN)) {
    // A Preview answers at its name, and one deployment at `<deployment-id>-<name>`.
    for (const label of ["branch", "00000000-0000-4000-8000-000000000000-branch"]) {
      for (const path of [ASSET, OTHER_ASSET]) {
        assert.equal(headersFor(rules, `https://${label}.${domain}${path}`).get("x-robots-tag"), preview, `${label}.${domain}${path}`);
      }
      assert.equal(headersFor(rules, `https://${label}.${domain}${ASSET}`).get("cache-control"), IMMUTABLE);
    }
  }

  // Production keeps vinext's cache on hashed assets and carries no X-Robots-Tag.
  for (const host of ["lexema.fyi", "developers.lexema.fyi", "api.lexema.fyi"]) {
    const hashed = headersFor(rules, `https://${host}${ASSET}`);
    assert.equal(hashed.get("cache-control"), IMMUTABLE, host);
    assert.equal(hashed.get("x-robots-tag"), undefined, host);
    assert.equal(headersFor(rules, `https://${host}${OTHER_ASSET}`).get("x-robots-tag"), undefined, host);
  }
});

test("every static asset on every host carries the Worker's security headers, X-Content-Type-Options: nosniff among them", () => {
  const rules = built();
  assert.equal(SECURITY_HEADERS["x-content-type-options"], "nosniff");
  const hosts = ["lexema.fyi", "developers.lexema.fyi", "api.lexema.fyi", ...Object.values(PREVIEW_DOMAIN).map((domain) => `branch.${domain}`)];
  for (const host of hosts) {
    for (const path of [ASSET, OTHER_ASSET, "/favicon.ico"]) {
      const headers = headersFor(rules, `https://${host}${path}`);
      for (const [name, value] of Object.entries(SECURITY_HEADERS)) assert.equal(headers.get(name), value, `${name} on ${host}${path}`);
    }
  }
});

test("the built _headers keeps every rule vinext would have written itself, and vinext writes no _redirects", () => {
  const vinext = builtClient(false);
  assert.equal(vinext.redirects, undefined);
  const vinexts = rulesOf(vinext.headers);
  assert.deepEqual(
    vinexts.map((rule) => [rule.pattern, [...rule.headers]]),
    [[HASHED_ASSETS, [["cache-control", IMMUTABLE]]]],
  );
  for (const rule of vinexts) {
    assert.deepEqual(built().find((candidate) => candidate.pattern === rule.pattern)?.headers, rule.headers, rule.pattern);
  }
});

/** One `_redirects` rule: a path pattern, where it sends a match, and the status. */
type Redirect = { from: string; to: string; status: number };

/** The rules of a `_redirects` file: `from to [status]` per line, 302 when no status is given. */
function redirectsOf(file: string): Redirect[] {
  return file
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
    .map((line) => {
      const [from, to, status, ...rest] = line.split(/\s+/);
      assert.ok(from && to && rest.length === 0, `a _redirects line is \`from to [status]\`: ${JSON.stringify(line)}`);
      return { from, to, status: status === undefined ? 302 : Number(status) };
    });
}

/**
 * Where a request for `url` is sent, as Cloudflare matches a `_redirects`
 * file: the first rule whose path pattern matches, a `*` matching anything,
 * and the query never part of the match
 * (https://developers.cloudflare.com/workers/static-assets/redirects/).
 */
function redirectFor(rules: readonly Redirect[], url: string): Redirect | undefined {
  const { pathname } = new URL(url, "https://lexema.fyi");
  return rules.find((rule) => new RegExp(`^${rule.from.split("*").map(escape).join(".*")}$`).test(pathname));
}

test("an old /card/ address, with or without a word, is sent for good to the one share picture before the Worker runs (#919)", () => {
  const build = ourBuild();
  assert.ok(build.redirects !== undefined, "the build keeps web/public/_redirects");
  assert.ok(build.shareImage, "the build keeps the share picture the redirect names");
  const rules = redirectsOf(build.redirects);
  for (const old of [
    "/card/2/it-0c432803.chg-0123456789ab.code-abc.png?word=casa",
    "/card/2/it-0c432803.0.png",
    "/card/1/it-0c432803.png?word=vado%20via",
    "/card/0/anything.png?word=",
  ]) {
    assert.deepEqual(redirectFor(rules, old), { from: "/card/*", to: SHARE_IMAGE_PATH, status: 301 }, old);
  }
  // Nothing else is sent anywhere: not the picture itself, nor a page.
  for (const other of [SHARE_IMAGE_PATH, "/", "/?q=casa", "/cards/2/x.png", "/suggest?q=ca"]) {
    assert.equal(redirectFor(rules, other), undefined, other);
  }
});
