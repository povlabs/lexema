// The Preview configuration in web/wrangler.jsonc (ADR 0018), read the way
// Wrangler reads it, and as the build writes it.
//
// A Preview takes its bindings from the `previews` block alone, so each hold
// ADR 0018 names is checked there: the stage, the shared dictionary, a
// placeholder for the branch's own app database, rate limits apart from
// production's, and email that reaches Huey only.

import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import { createBuilder } from "vite";
import { unstable_readConfig } from "wrangler";
import { PREVIEW_DOMAIN } from "@/worker/hosts.ts";
import { parseStage } from "@/worker/stage.ts";

const WRANGLER = fileURLToPath(new URL("../wrangler.jsonc", import.meta.url));
const read = (env?: string) => unstable_readConfig({ config: WRANGLER, env }, { hideWarnings: true });

/** The shared dictionary D1, Huey's upload (#172). */
const DICTIONARY_ID = "b07d3441-91c6-4f94-8ae3-fe8c7088f21d";
/** The one address Preview email may reach, Huey's verified one (#172). */
const PREVIEW_EMAIL_TO = "hueypov@gmail.com";

type Previews = NonNullable<ReturnType<typeof read>["previews"]>;
/** The shapes this file reads, which Wrangler's exported config type leaves untyped. */
type D1Entry = { binding: string; database_name?: string; database_id?: string };
type LimitEntry = { name: string; namespace_id: string; simple: { limit: number; period: number } };
type RouteEntry = string | { pattern: string; custom_domain?: boolean; previews_enabled?: boolean; enabled?: boolean };

/** The `previews` block, which both configurations carry: Wrangler copies it into an environment. */
function previews(env?: string): Previews {
  const block = read(env).previews;
  assert.ok(block, `no previews block in ${env ?? "the top level"}`);
  return block;
}

test("each configuration names its own stage: local at the top level, preview for Previews, production in env.production", () => {
  assert.equal(parseStage(read().vars.LEXEMA_STAGE), "local");
  assert.equal(parseStage(read("production").vars.LEXEMA_STAGE), "production");
  assert.equal(parseStage(previews().vars?.LEXEMA_STAGE), "preview");
  assert.deepEqual(previews("production"), previews());
  // Version metadata is not inherited: a missing binding would leave this
  // environment unable to name deployment-specific cache identities.
  for (const config of [read(), read("production"), previews()]) {
    assert.deepEqual(config.version_metadata, { binding: "LEXEMA_VERSION" });
  }
});

test("a Preview has every var production has, serves the current release and signs in with no provider", () => {
  const vars = previews().vars ?? {};
  assert.deepEqual(Object.keys(vars).sort(), Object.keys(read("production").vars).sort());
  assert.equal(vars.LEXEMA_RELEASE, "it-0c432803");
  assert.equal(vars.GOOGLE_CLIENT_ID, "");
  assert.equal(vars.GITHUB_CLIENT_ID, "");
});

test("a Preview reads the shared dictionary and binds a placeholder app database that `wrangler preview` refuses", () => {
  const [dictionary, app, ...rest] = previews().d1_databases ?? [];
  assert.deepEqual(rest, []);
  assert.deepEqual(dictionary, { binding: "DB", database_name: "lexema-dictionary", database_id: DICTIONARY_ID });
  assert.equal(app.binding, "APP_DB");
  // Wrangler 4.135.0 refuses `wrangler preview` while this string is anywhere in the block.
  assert.equal(app.database_id, "<REPLACE_ME>");
  const local = read().d1_databases.map(({ database_id }: D1Entry) => database_id);
  assert.ok(!local.includes(DICTIONARY_ID) && !local.includes(app.database_id));
});

test("Preview rate limits are production's limits under namespace ids production never uses", () => {
  const production: LimitEntry[] = read("production").ratelimits;
  const preview: LimitEntry[] = previews().ratelimits ?? [];
  const limits = (list: LimitEntry[]) => list.map(({ name, simple }) => ({ name, simple }));
  assert.deepEqual(limits(preview), limits(production));
  const productionIds = new Set([...production, ...(read().ratelimits as LimitEntry[])].map(({ namespace_id }) => namespace_id));
  for (const { name, namespace_id } of preview) {
    assert.ok(!productionIds.has(namespace_id), `${name} shares namespace_id ${namespace_id} with production`);
  }
  assert.equal(new Set(preview.map(({ namespace_id }) => namespace_id)).size, preview.length);
});

test("Preview email is restricted to Huey's verified address, on every send_email binding", () => {
  const bindings = previews().send_email ?? [];
  assert.ok(bindings.length > 0);
  for (const binding of bindings) {
    // With no destination_address the binding can send to any verified address on the account.
    assert.equal(binding.destination_address, PREVIEW_EMAIL_TO, binding.name);
    assert.equal(binding.allowed_destination_addresses, undefined, binding.name);
  }
  // Account email is sent to that address, whoever it is about, since the test developer's is on example.com (#215).
  assert.equal(previews().vars?.EMAIL_ONLY_TO, PREVIEW_EMAIL_TO);
  // Local development and production send each account email to its own account.
  assert.equal(read().vars.EMAIL_ONLY_TO, "");
  assert.equal(read("production").vars.EMAIL_ONLY_TO, "");
});

test("production serves Previews on the three preview-only domains, and has no D1 of its own", () => {
  const production = read("production");
  const previewRoutes = production.routes?.filter((route: RouteEntry) => typeof route === "object" && "previews_enabled" in route);
  assert.deepEqual(
    previewRoutes,
    Object.values(PREVIEW_DOMAIN).map((pattern) => ({ pattern, custom_domain: true, previews_enabled: true, enabled: false })),
  );
  assert.deepEqual(production.d1_databases, []);
  // Production's own email binding sends account email to any address (#215): the Preview's one-recipient binding is not what it gets.
  assert.deepEqual(production.send_email, [{ name: "EMAIL" }]);
});

/**
 * The Worker config the build writes for `env` (none, or `production`), as
 * `vinext build` writes it into dist/server/wrangler.json: the Cloudflare Vite
 * plugin web/vite.config.ts runs owns that file. Built from a copy of
 * wrangler.jsonc beside a stand-in entry, in a directory of its own, so it
 * never touches web/dist or web/.dev.vars and needs no network.
 */
async function built(env: string | undefined): Promise<ReturnType<typeof read> & Record<string, unknown>> {
  const root = mkdtempSync(join(tmpdir(), "lexema-built-config-"));
  const cloudflareEnv = process.env.CLOUDFLARE_ENV;
  try {
    copyFileSync(WRANGLER, join(root, "wrangler.jsonc"));
    writeFileSync(join(root, "entry.ts"), "export default { fetch: () => new Response('ok') };\n");
    if (env === undefined) delete process.env.CLOUDFLARE_ENV;
    else process.env.CLOUDFLARE_ENV = env;
    const builder = await createBuilder({
      root,
      configFile: false,
      logLevel: "silent",
      plugins: [cloudflare({ configPath: join(root, "wrangler.jsonc"), config: { main: join(root, "entry.ts") } })],
      build: { outDir: join(root, "dist") },
    });
    await builder.buildApp();
    return JSON.parse(readFileSync(join(root, "dist", "lexema_web", "wrangler.json"), "utf8"));
  } finally {
    if (cloudflareEnv === undefined) delete process.env.CLOUDFLARE_ENV;
    else process.env.CLOUDFLARE_ENV = cloudflareEnv;
    rmSync(root, { recursive: true, force: true });
  }
}

test("the built config keeps the previews block, in the local build and the production build", async () => {
  const local = await built(undefined);
  assert.deepEqual(local.previews, previews());
  assert.equal(parseStage(local.vars.LEXEMA_STAGE), "local");

  const production = await built("production");
  assert.deepEqual(production.previews, previews());
  // What a production build deploys is the production stage, never a Preview's.
  assert.equal(parseStage(production.vars.LEXEMA_STAGE), "production");
  assert.deepEqual(production.routes, read("production").routes);
});
