// The `_headers` file a build leaves in dist/client (#265). Static assets are
// answered before the Worker runs (web/wrangler.jsonc, `assets`), so the
// headers on them are this file's alone: noindex on every Preview host (ADR
// 0018) and vinext's year-long cache on content-hashed assets.
//
// vinext writes its own `_headers` only when the build has none, so
// web/public/_headers repeats its cache rule. Each test here runs a real
// `vinext build` over a one-page app that takes web/public as its public
// directory, and reads the file that build wrote.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { PREVIEW_DOMAIN } from "@/worker/shared/hosts.ts";
import { robotsTagOf } from "@/worker/shared/stage.ts";

const WEB = fileURLToPath(new URL("..", import.meta.url));
const VINEXT = join(WEB, "node_modules", ".bin", "vinext");

/** vinext's rule for content-hashed assets, which production must keep. */
const HASHED_ASSETS = "/_next/static/*";
const IMMUTABLE = "public, max-age=31536000, immutable";

/**
 * The `_headers` a `vinext build` writes, with `publicDir` as the public
 * directory (`false` for none). The app lives under web/node_modules so it
 * resolves web's own vinext, Vite and React.
 */
function builtHeaders(publicDir: string | false): string {
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
    return readFileSync(join(root, "dist", "client", "_headers"), "utf8");
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
let ours: Rule[] | undefined;
const built = () => (ours ??= rulesOf(builtHeaders(join(WEB, "public"))));

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

test("the built _headers keeps every rule vinext would have written itself", () => {
  const vinexts = rulesOf(builtHeaders(false));
  assert.deepEqual(
    vinexts.map((rule) => [rule.pattern, [...rule.headers]]),
    [[HASHED_ASSETS, [["cache-control", IMMUTABLE]]]],
  );
  for (const rule of vinexts) {
    assert.deepEqual(built().find((candidate) => candidate.pattern === rule.pattern)?.headers, rule.headers, rule.pattern);
  }
});
