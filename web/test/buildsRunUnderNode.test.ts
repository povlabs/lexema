// web/builds/ runs under plain `node`, never through tsx: Workers Builds runs
// `node builds/production.ts` and `node builds/preview.ts`, and the preview
// marker workflow runs `node web/builds/previewMarker.ts`. Node strips the
// types and refuses any TypeScript that is not only types, such as a
// parameter property, an enum or a namespace (ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX).
// The other tests load these files through tsx, which accepts all of that, so
// a parameter property in web/builds/appMigrations.ts passed them and failed
// every production deploy (#611). This test strips each file the way Node does.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { dirname, relative, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const BUILDS = fileURLToPath(new URL("../builds", import.meta.url));
const WEB = fileURLToPath(new URL("..", import.meta.url));

/** The relative modules a stripped file still imports at run time; type-only imports are gone once stripped. */
const runtimeImports = (stripped: string): string[] =>
  [...stripped.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g)].map((match) => match[1]);

/** Every file `node` loads from web/builds/: each file there and every relative module they import, followed. */
function filesNodeRuns(): Map<string, string> {
  const stripped = new Map<string, string>();
  const queue = readdirSync(BUILDS).filter((name) => name.endsWith(".ts")).map((name) => resolve(BUILDS, name));
  for (let path = queue.shift(); path !== undefined; path = queue.shift()) {
    if (stripped.has(path)) continue;
    let code: string;
    try {
      code = stripTypeScriptTypes(readFileSync(path, "utf8"), { mode: "strip" });
    } catch (error) {
      const { code: reason, message } = error as { code?: string; message: string };
      assert.fail(`${relative(WEB, path)} does not run under plain node: ${reason ?? ""} ${message}`);
    }
    stripped.set(path, code);
    queue.push(...runtimeImports(code).map((specifier) => resolve(dirname(path), specifier)));
  }
  return stripped;
}

test("every file web/builds/ runs under plain node is TypeScript that Node's type stripping accepts (#611)", () => {
  const files = filesNodeRuns();
  assert.ok(files.has(resolve(BUILDS, "production.ts")));
  assert.ok(files.has(resolve(BUILDS, "appMigrations.ts")));
});

test("the guard refuses a parameter property, the syntax that stopped production deploys (#611)", () => {
  assert.throws(
    () => stripTypeScriptTypes("class A { constructor(readonly x: number) {} }", { mode: "strip" }),
    (error: { code?: string }) => error.code === "ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX",
  );
});
