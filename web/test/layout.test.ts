// Where web/'s files live, and which of them may import which (#194).
//
// `web/app/` is routes only: vinext, like Next's App Router, needs nothing else
// there. The code behind the two sites lives beside it, by site:
// `components/` and `lib/` each hold `dictionary/`, `developers/` and `shared/`.
// A dictionary file never imports from `developers/`, nor the other way round;
// what both need goes in `shared/`, which imports from neither.
//
// It reads the source text: an import is a fact about the file, and a site
// that reaches into the other one would still render the same page.

import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = fileURLToPath(new URL("..", import.meta.url));

/** The folders a site's code is split across. */
const HOMES = ["components", "lib"] as const;

/** Which site a folder under `components/` or `lib/` belongs to. */
type Site = "dictionary" | "developers" | "shared";
const SITES: readonly Site[] = ["dictionary", "developers", "shared"];

/** What a site may import from: its own folders and `shared/`. */
const MAY_IMPORT: Readonly<Record<Site, readonly Site[]>> = {
  dictionary: ["dictionary", "shared"],
  developers: ["developers", "shared"],
  shared: ["shared"],
};

/** The files App Router gives a meaning to in `app/`, and the one stylesheet. */
const ROUTE_FILES = new Set(["page.tsx", "layout.tsx", "not-found.tsx", "route.ts", "globals.css"]);

/** Every file under a folder, as paths relative to web/. */
async function filesUnder(dir: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(join(WEB, dir), { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await filesUnder(path)));
    else found.push(path);
  }
  return found.sort();
}

/** The site a web/-relative path belongs to, or none when it is outside `components/` and `lib/`. */
function siteOf(path: string): Site | undefined {
  const [home, site] = path.split("/");
  if (!HOMES.includes(home as (typeof HOMES)[number])) return undefined;
  return SITES.find((s) => s === site);
}

/** Every module a source file names, in `import`, `export … from` and `import()`. */
function specifiers(source: string): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*["']([^"']+)["']/g)) found.push(match[1]);
  return found;
}

/** The web/-relative path a specifier names, or none when it leaves web/ or names a package. */
function targetOf(file: string, specifier: string): string | undefined {
  if (specifier.startsWith("@/")) return normalize(specifier.slice(2));
  if (!specifier.startsWith(".")) return undefined;
  const target = normalize(join(dirname(file), specifier));
  return target.startsWith("..") ? undefined : target;
}

test("web/app/ holds only route files and globals.css", async () => {
  const strays = (await filesUnder("app")).filter((path) => !ROUTE_FILES.has(path.split("/").at(-1)!));
  assert.deepEqual(strays, [], "a component or helper goes under web/components/ or web/lib/, not web/app/");
});

test("dictionary and developer code import each other only through shared/", async () => {
  const files = (await Promise.all(HOMES.map(filesUnder))).flat().filter((path) => /\.tsx?$/.test(path));
  assert.ok(files.length > 0, "found no sources under web/components/ or web/lib/");

  const offences: string[] = [];
  for (const file of files) {
    const site = siteOf(file);
    if (site === undefined) {
      offences.push(`${file} is in no site's folder: put it under dictionary/, developers/ or shared/`);
      continue;
    }
    for (const specifier of specifiers(await readFile(join(WEB, file), "utf8"))) {
      const target = targetOf(file, specifier);
      const targetSite = target === undefined ? undefined : siteOf(target);
      if (targetSite !== undefined && !MAY_IMPORT[site].includes(targetSite)) {
        offences.push(`${file} (${site}) imports ${specifier} (${targetSite})`);
      }
    }
  }
  assert.deepEqual(offences, []);
});

test("the site check reads every kind of import it guards", () => {
  const file = "components/dictionary/Word.tsx";
  const named = specifiers(
    [
      'import { A } from "@/components/developers/A";',
      'export { B } from "../../lib/developers/b.ts";',
      'import "@/lib/shared/c.ts";',
      'const d = await import("@/lib/developers/d.ts");',
    ].join("\n"),
  ).map((specifier) => siteOf(targetOf(file, specifier)!));
  assert.deepEqual(named, ["developers", "developers", "shared", "developers"]);
});
