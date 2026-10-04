// Where web/'s files live, and which of them may import which (#194, #199).
//
// `web/app/` is routes only: vinext, like Next's App Router, needs nothing else
// there. The code behind the sites lives beside it, by site:
// `components/` and `lib/` each hold `dictionary/`, `developers/` and `shared/`,
// and `worker/` holds those three and `api/`, the JSON API's own site.
// A dictionary file never imports from `developers/`, nor the other way round;
// what both need goes in `shared/`, which imports from no site. The API reads
// the dictionary on purpose, since it is the dictionary in another format, so
// it may import dictionary code but not developer-site code. The developer
// site documents and meters the API, so it may import API code. The one file
// outside every site is the Worker's entry, `worker/index.ts`, which wires all
// of them together.
//
// It reads the source text: an import is a fact about the file, and a site
// that reaches into the other one would still render the same page.

import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = fileURLToPath(new URL("..", import.meta.url));

/** Which site a folder under one of the homes belongs to. */
type Site = "dictionary" | "developers" | "api" | "shared";

/** The folders a site's code is split across, and the sites each one holds. */
const HOMES = {
  components: ["dictionary", "developers", "shared"],
  lib: ["dictionary", "developers", "shared"],
  worker: ["dictionary", "developers", "api", "shared"],
} as const satisfies Record<string, readonly Site[]>;
type Home = keyof typeof HOMES;

/** The Worker's entry: the one file in no site's folder, which may import every site. */
const ENTRY = "worker/index.ts";

/** What a site may import from: its own folders, `shared/`, and for the API the dictionary. */
const MAY_IMPORT: Readonly<Record<Site, readonly Site[]>> = {
  dictionary: ["dictionary", "shared"],
  developers: ["developers", "api", "shared"],
  api: ["api", "dictionary", "shared"],
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

/** The site a web/-relative path belongs to, or none when it is in no site's folder. */
function siteOf(path: string): Site | undefined {
  const [home, site] = path.split("/");
  if (!Object.hasOwn(HOMES, home)) return undefined;
  return HOMES[home as Home].find((s) => s === site);
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

/** What is wrong with where a file under a home sits and what it imports; nothing for the entry. */
function offencesOf(file: string, source: string): string[] {
  if (file === ENTRY) return [];
  const site = siteOf(file);
  if (site === undefined) {
    const sites = HOMES[file.split("/")[0] as Home].map((s) => `${s}/`).join(", ");
    return [`${file} is in no site's folder: put it under ${sites}`];
  }
  const offences: string[] = [];
  for (const specifier of specifiers(source)) {
    const target = targetOf(file, specifier);
    const targetSite = target === undefined ? undefined : siteOf(target);
    if (targetSite !== undefined && !MAY_IMPORT[site].includes(targetSite)) {
      offences.push(`${file} (${site}) imports ${specifier} (${targetSite})`);
    }
  }
  return offences;
}

test("web/app/ holds only route files and globals.css", async () => {
  const strays = (await filesUnder("app")).filter((path) => !ROUTE_FILES.has(path.split("/").at(-1)!));
  assert.deepEqual(strays, [], "a component or helper goes under web/components/ or web/lib/, not web/app/");
});

test("each site imports only the sites it may, under components/, lib/ and worker/", async () => {
  const homes = Object.keys(HOMES) as Home[];
  const files = (await Promise.all(homes.map(filesUnder))).flat().filter((path) => /\.tsx?$/.test(path));
  for (const home of homes) assert.ok(files.some((path) => path.startsWith(`${home}/`)), `found no sources under web/${home}/`);
  assert.ok(files.includes(ENTRY), `the Worker's entry ${ENTRY} is missing`);

  const offences: string[] = [];
  for (const file of files) offences.push(...offencesOf(file, await readFile(join(WEB, file), "utf8")));
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

test("the site check catches a Worker file that crosses sites or sits in none", () => {
  assert.deepEqual(offencesOf("worker/developers/billing.ts", 'import { card } from "../dictionary/card.ts";'), [
    "worker/developers/billing.ts (developers) imports ../dictionary/card.ts (dictionary)",
  ]);
  assert.deepEqual(offencesOf("worker/dictionary/card.ts", 'import { DASHBOARD } from "@/worker/developers/dashboard.ts";'), [
    "worker/dictionary/card.ts (dictionary) imports @/worker/developers/dashboard.ts (developers)",
  ]);
  assert.deepEqual(offencesOf("worker/api/handler.ts", 'import { signedInAccount } from "../developers/signIn.ts";'), [
    "worker/api/handler.ts (api) imports ../developers/signIn.ts (developers)",
  ]);
  assert.deepEqual(offencesOf("worker/shared/hosts.ts", 'import { withCards } from "../dictionary/card.ts";'), [
    "worker/shared/hosts.ts (shared) imports ../dictionary/card.ts (dictionary)",
  ]);
  assert.deepEqual(offencesOf("worker/rateLimit.ts", ""), [
    "worker/rateLimit.ts is in no site's folder: put it under dictionary/, developers/, api/, shared/",
  ]);
  // What the rule allows: the API reading the dictionary, and the entry reading every site.
  assert.deepEqual(offencesOf("worker/api/lookupAnswer.ts", 'import { conjugationOf } from "@/lib/dictionary/conjugation.ts";'), []);
  assert.deepEqual(
    offencesOf(ENTRY, ['import { withCards } from "./dictionary/card.ts";', 'import { withBilling } from "./developers/billing.ts";'].join("\n")),
    [],
  );
});
