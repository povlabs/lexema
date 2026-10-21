// What the Worker must not load, because loading it costs startup CPU (#911).
//
// Cloudflare refuses a Worker whose global scope runs too long (error 10021,
// https://developers.cloudflare.com/workers/observability/errors/#validation-errors-10021).
// src/italian/curatedCorrections.ts builds every curated correction from its
// evidence tables when it loads: on 2026-10-21 that was about 280 ms of the
// built Worker's 354 ms local startup, and every Preview deploy failed on it.
// The Worker needs none of that list, only a revision's permanent link, which
// src/italian/evidence.ts holds. A bundler keeps a module whose top level calls
// functions, so any value import of curatedCorrections.ts, however small,
// brings the whole build back into startup.
//
// It reads the source text and follows every import the bundle keeps, from
// web/'s runtime folders into src/. A type-only import is erased before
// bundling, so it is not followed.

import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../..", import.meta.url));

/** The folders and files under web/ the built Worker is made from. */
const RUNTIME_ROOTS = ["web/app", "web/components", "web/lib", "web/worker", "web/instrumentation.ts"];

/** The modules no runtime file may load, each with why. */
const NEVER_LOADED: Readonly<Record<string, string>> = {
  "src/italian/curatedCorrections.ts": "builds every curated correction at load; import evidenceUrl from src/italian/evidence.ts",
};

/** web/tsconfig.json's `@lexema/<folder>/*` paths, each naming ../src/<folder>/*, and `@/*`, naming web/. */
function aliased(specifier: string): string | undefined {
  const lexema = /^@lexema\/([^/]+)\/(.+)$/.exec(specifier);
  if (lexema !== null) return `src/${lexema[1]}/${lexema[2]}`;
  if (specifier.startsWith("@/")) return `web/${specifier.slice(2)}`;
  return undefined;
}

/** The repo-relative source file a specifier names, or none for a package or a non-source file. */
function resolve(file: string, specifier: string): string | undefined {
  const base = aliased(specifier) ?? (specifier.startsWith(".") ? normalize(join(dirname(file), specifier)) : undefined);
  if (base === undefined) return undefined;
  const stem = base.replace(/\.(js|jsx|ts|tsx|mjs)$/, "");
  return [`${stem}.ts`, `${stem}.tsx`, `${stem}/index.ts`, base].find((path) => /\.tsx?$/.test(path) && existsSync(join(REPO, path)));
}

/** The modules a file loads at run time: every import and re-export but those written `type` throughout. */
export function loadedSpecifiers(source: string): string[] {
  const found: string[] = [];
  const statement = /\b(import|export)\s+(type\s+)?([^;"']*?)\s*\bfrom\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)|^\s*import\s*["']([^"']+)["']/gm;
  for (const match of source.matchAll(statement)) {
    const [, , typeOnly, clause, from, dynamic, bare] = match;
    if (dynamic !== undefined || bare !== undefined) {
      found.push(dynamic ?? bare);
      continue;
    }
    if (typeOnly !== undefined) continue;
    const named = /^\{([\s\S]*)\}$/.exec(clause.trim());
    const allTypes = named !== null && named[1].split(",").map((part) => part.trim()).filter(Boolean).every((part) => part.startsWith("type "));
    if (!allTypes) found.push(from);
  }
  return found;
}

async function filesUnder(path: string): Promise<string[]> {
  if (/\.tsx?$/.test(path)) return [path];
  const found: string[] = [];
  for (const entry of await readdir(join(REPO, path), { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) found.push(...(await filesUnder(child)));
    else if (/\.tsx?$/.test(entry.name)) found.push(child);
  }
  return found;
}

/** Every source file the runtime roots load, each with the file that first loaded it. */
async function runtimeGraph(): Promise<Map<string, string | undefined>> {
  const loadedBy = new Map<string, string | undefined>();
  const queue = (await Promise.all(RUNTIME_ROOTS.map(filesUnder))).flat();
  for (const root of queue) loadedBy.set(root, undefined);
  while (queue.length > 0) {
    const file = queue.shift()!;
    for (const specifier of loadedSpecifiers(await readFile(join(REPO, file), "utf8"))) {
      const target = resolve(file, specifier);
      if (target === undefined || loadedBy.has(target)) continue;
      loadedBy.set(target, file);
      queue.push(target);
    }
  }
  return loadedBy;
}

/** The import chain from a runtime root down to a file. */
function chainTo(file: string, loadedBy: ReadonlyMap<string, string | undefined>): string {
  const chain = [file];
  for (let at = loadedBy.get(file); at !== undefined; at = loadedBy.get(at)) chain.unshift(at);
  return chain.join(" -> ");
}

test("the Worker loads no module that builds data at startup", async () => {
  const loadedBy = await runtimeGraph();
  // The walk crosses into src/: the lookup and the link helper the Worker does need.
  assert.ok(loadedBy.has("src/lookup/handKept.ts"), "the walk never reached src/lookup/handKept.ts");
  assert.ok(loadedBy.has("src/italian/evidence.ts"), "the walk never reached src/italian/evidence.ts");
  const offences = Object.entries(NEVER_LOADED)
    .filter(([module]) => loadedBy.has(module))
    .map(([module, why]) => `${chainTo(module, loadedBy)}: ${why}`);
  assert.deepEqual(offences, []);
});

test("the walk follows value imports and skips imports erased as types", () => {
  const source = [
    'import { evidenceUrl } from "./a.js";',
    'import type { Evidence } from "./b.js";',
    'import { type C, type D } from "./c.js";',
    'import { type E, f } from "./e.js";',
    'export type { G } from "./g.js";',
    'export { h } from "./h.js";',
    'export * from "./i.js";',
    'import "./j.js";',
    'const k = await import("./k.js");',
    "import {\n  type L,\n  m,\n} from \"./l.js\";",
  ].join("\n");
  assert.deepEqual(loadedSpecifiers(source), ["./a.js", "./e.js", "./h.js", "./i.js", "./j.js", "./k.js", "./l.js"]);
});
