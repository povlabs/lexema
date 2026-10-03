// The two Workers Builds commands (ADR 0018, web/builds/): the Preview name
// they derive from a branch, the built config the preview command rewrites,
// the order it runs Wrangler in, and what the sweep selects and deletes. Every
// test drives a fake account and a fake GitHub, so none needs the network or a
// credential.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { unstable_readConfig } from "wrangler";
import {
  BUILT_CONFIG,
  NO_PREVIEW_BRANCH,
  PREVIEW_COMMAND,
  PREVIEW_NAME_FILE,
  PREVIEW_SECRETS_FILE,
  type PreviewPrepareSteps,
  preparePreview,
} from "@/builds/previewCommand.ts";
import { type BuiltConfig, DICTIONARY, migrationsConfig, withAppDatabase } from "@/builds/previewConfig.ts";
import { APP_DATABASE_PREFIX, PREVIEW_NAME_MAX, PreviewName } from "@/builds/previewName.ts";
import { runProductionCommand } from "@/builds/productionCommand.ts";
import { type OpenBranches, readOpenBranches, selectForSweep, sweep } from "@/builds/sweep.ts";
import type { D1Database, Wrangler, WranglerRun } from "@/builds/wrangler.ts";

const WRANGLER = fileURLToPath(new URL("../wrangler.jsonc", import.meta.url));
const PACKAGE = fileURLToPath(new URL("../package.json", import.meta.url));
const DEPLOY = fileURLToPath(new URL("../../docs/DEPLOY.md", import.meta.url));

/** One DNS label, as RFC 1035 allows it. */
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
/** A deployment URL's label with the longest deployment id, a UUID. */
const deploymentLabel = (name: PreviewName) => `00000000-0000-4000-8000-000000000000-${name.value}`;

// --- The Preview name -------------------------------------------------------

test("a branch's Preview name is one DNS label, even behind a UUID deployment id, and the same every time", () => {
  const branches = [
    "build/251-preview-adr-f7d91140",
    "build/252-workers-builds-commands-2c423422",
    "huey/foo_bar",
    "huey/Some-Very_Long.Branch/Name-With-Many-Parts-Beyond-Any-Label-Limit-At-All",
    "Feature/ÜBER-ñame",
    "---",
    "UPPER",
    "a".repeat(300),
  ];
  for (const branch of branches) {
    const name = PreviewName.ofBranch(branch);
    assert.match(name.value, LABEL, branch);
    assert.ok(name.value.length <= PREVIEW_NAME_MAX, `${branch} -> ${name.value}`);
    assert.match(deploymentLabel(name), LABEL, branch);
    assert.ok(deploymentLabel(name).length <= 63, branch);
    assert.equal(PreviewName.ofBranch(branch).value, name.value, branch);
  }
  assert.equal(PREVIEW_NAME_MAX, 26);
});

test("a short, valid branch name is its own Preview name; any other keeps a readable prefix and ends in its hash", () => {
  assert.equal(PreviewName.ofBranch("huey-242-preview").value, "huey-242-preview");
  assert.match(PreviewName.ofBranch("build/251-preview-adr-f7d91140").value, /^build-251-preview[a-z0-9-]*-[0-9a-f]{8}$/);
  assert.match(PreviewName.ofBranch("huey/foo_bar").value, /^huey-foo-bar-[0-9a-f]{8}$/);
  assert.match(PreviewName.ofBranch("___").value, /^[0-9a-f]{8}$/);
  assert.throws(() => PreviewName.ofBranch(""), /WORKERS_CI_BRANCH/);
});

test("branches that clean up to the same text get different Preview names", () => {
  const colliding = [
    ["huey/foo_bar", "huey-foo-bar", "huey/foo-bar", "HUEY/foo_bar", "huey//foo__bar"],
    ["build/251-preview-adr-f7d91140-and-a-long-tail", "build/251-preview-adr-f7d91140-and-a-long-tail-2"],
  ];
  for (const group of colliding) {
    const names = group.map((branch) => PreviewName.ofBranch(branch).value);
    assert.equal(new Set(names).size, group.length, names.join(", "));
  }
});

test("a Preview's app database is a valid D1 name, and reads back to the same Preview", () => {
  for (const branch of ["huey/foo_bar", "build/252-workers-builds-commands-2c423422", "main", "a".repeat(80)]) {
    const name = PreviewName.ofBranch(branch);
    assert.match(name.appDatabase, /^lexema-preview-app-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/);
    assert.ok(name.appDatabase.length <= APP_DATABASE_PREFIX.length + PREVIEW_NAME_MAX);
    assert.equal(PreviewName.ofAppDatabase(name.appDatabase)?.value, name.value);
  }
  for (const other of ["lexema-dictionary", "lexema-app", "lexema", "lexema-preview-app-", "lexema-preview-app-Bad_Name", "x-lexema-preview-app-a"]) {
    assert.equal(PreviewName.ofAppDatabase(other), undefined, other);
  }
});

// --- The built config -------------------------------------------------------

/** The `previews` block as web/wrangler.jsonc has it, and so as the build copies it. */
function builtConfig(): BuiltConfig {
  const read = unstable_readConfig({ config: WRANGLER, env: "production" }, { hideWarnings: true });
  return { name: "lexema-web", vars: { LEXEMA_STAGE: "production" }, previews: structuredClone(read.previews) } as BuiltConfig;
}

test("the rewritten config binds APP_DB to the branch's database and leaves DB on the shared dictionary", () => {
  const before = builtConfig();
  const preview = PreviewName.ofBranch("huey/foo_bar");
  const after = withAppDatabase(before, { preview, id: "11111111-2222-4333-8444-555555555555" });

  const byBinding = Object.fromEntries((after.previews?.d1_databases ?? []).map((entry) => [entry.binding, entry]));
  assert.deepEqual(byBinding.APP_DB, {
    binding: "APP_DB",
    database_name: preview.appDatabase,
    database_id: "11111111-2222-4333-8444-555555555555",
  });
  assert.deepEqual(byBinding.DB, { binding: "DB", database_name: DICTIONARY.name, database_id: DICTIONARY.id });
  assert.equal(JSON.stringify(after).includes("<REPLACE_ME>"), false);
  // Nothing else changes, and the input is left as it was.
  const { d1_databases: _after, ...restAfter } = after.previews ?? {};
  const { d1_databases: _before, ...restBefore } = before.previews ?? {};
  assert.deepEqual(restAfter, restBefore);
  assert.equal(after.vars, before.vars);
  assert.equal(builtConfig().previews?.d1_databases?.[1].database_id, before.previews?.d1_databases?.[1].database_id);
});

test("the config rewrite refuses the dictionary as an app database and a config with no APP_DB", () => {
  const preview = PreviewName.ofBranch("huey/foo_bar");
  assert.throws(() => withAppDatabase(builtConfig(), { preview, id: DICTIONARY.id }), /dictionary/);
  assert.throws(() => migrationsConfig({ preview, id: DICTIONARY.id }, "/m"), /dictionary/);
  assert.throws(() => withAppDatabase({ previews: { d1_databases: [] } }, { preview, id: "x" }), /APP_DB/);
});

test("the migrations config names only the branch's app database and the app migrations", () => {
  const preview = PreviewName.ofBranch("huey/foo_bar");
  assert.deepEqual(migrationsConfig({ preview, id: "abc" }, "/repo/src/db/app/migrations"), {
    name: "lexema-web",
    d1_databases: [{ binding: "APP_DB", database_name: preview.appDatabase, database_id: "abc", migrations_dir: "/repo/src/db/app/migrations" }],
  });
});

// --- A fake account ---------------------------------------------------------

/** A Cloudflare account as the commands see it through Wrangler, with every call kept. */
class FakeAccount {
  readonly calls: string[][] = [];
  readonly databases: D1Database[];
  readonly previews = new Set<string>();
  readonly secrets = new Map<string, string>();
  readonly failing: RegExp[] = [];
  private next = 1;

  constructor(databases: D1Database[] = []) {
    this.databases = [...databases];
  }

  readonly wrangler: Wrangler = (args) => {
    this.calls.push([...args]);
    const line = args.join(" ");
    const ok = (stdout = ""): WranglerRun => ({ ok: true, stdout, stderr: "" });
    const fail = (stderr: string): WranglerRun => ({ ok: false, stdout: "", stderr });
    if (this.failing.some((pattern) => pattern.test(line))) return fail("✘ [ERROR] A request to the Cloudflare API failed. [code: 10000]");
    const name = args[args.indexOf("--name") + 1];
    switch (`${args[0]} ${args[1]}`) {
      case "d1 list":
        return ok(JSON.stringify(this.databases.map((db) => ({ ...db, created_at: "2026-09-30", num_tables: 0 }))));
      case "d1 create":
        if (this.databases.some((db) => db.name === args[2])) return fail("A database with that name already exists");
        this.databases.push({ name: args[2], uuid: `00000000-0000-4000-8000-${String(this.next++).padStart(12, "0")}` });
        return ok();
      case "d1 delete": {
        const at = this.databases.findIndex((db) => db.name === args[2]);
        if (at < 0) return fail("Couldn't find a D1 DB");
        this.databases.splice(at, 1);
        return ok();
      }
      case "d1 migrations":
        return ok();
      case "preview delete":
        if (!this.previews.delete(name)) return fail(`✘ [ERROR] A request to the Cloudflare API failed.\n  Preview not found [code: 10025]`);
        return ok();
      default:
        throw new Error(`the fake account has no answer for wrangler ${line}`);
    }
  };

  /**
   * `npx wrangler preview --name <name> --secrets-file <file>`: a deployment
   * carrying `secrets`, and only those. Wrangler 4.135.0 sends no keep flag, so
   * a secret the file leaves out is gone from the new deployment.
   */
  deployPreview(name: string, secrets: Record<string, string>): void {
    this.previews.add(name);
    const secret = secrets.BETTER_AUTH_SECRET;
    if (secret === undefined) this.secrets.delete(name);
    else this.secrets.set(name, secret);
  }

  /** The calls, each as one line. */
  get lines(): string[] {
    return this.calls.map((call) => call.join(" "));
  }
}

/** The prepare step's inputs against `account`, keeping every file it writes and every step it runs, in order. */
function prepareSteps(account: FakeAccount, branch: string | undefined, newSecret = () => "random-secret") {
  const files = new Map<string, string>();
  const migrationConfigs: Record<string, unknown>[] = [];
  const order: string[] = [];
  const wrangler: Wrangler = (args, input) => {
    order.push(`wrangler ${args.slice(0, 2).join(" ")}`);
    return account.wrangler(args, input);
  };
  const steps: PreviewPrepareSteps = {
    branch,
    wrangler,
    build: () => order.push("build"),
    readBuiltConfig: builtConfig,
    writeFile: (path, content) => {
      order.push(`write ${path}`);
      files.set(path, content);
    },
    writeMigrationsConfig: (config) => {
      migrationConfigs.push(config);
      return "/tmp/migrations/wrangler.json";
    },
    migrationsDir: "/repo/src/db/app/migrations",
    newSecret,
    log: () => {},
  };
  return { steps, files, migrationConfigs, order };
}

/** The prepare step against `account` on a branch that gets a Preview, keeping every file it wrote. */
function prepare(account: FakeAccount, branch: string | undefined, newSecret = () => "random-secret") {
  const { steps, files, migrationConfigs, order } = prepareSteps(account, branch, newSecret);
  const prepared = preparePreview(steps);
  if (prepared.kind !== "prepared") throw new Error(`no Preview for ${branch}`);
  const name = prepared.preview;
  const config = JSON.parse(files.get(BUILT_CONFIG) ?? "null") as BuiltConfig;
  const secrets = JSON.parse(files.get(PREVIEW_SECRETS_FILE) ?? "null") as Record<string, string>;
  const appDatabaseId = config.previews?.d1_databases?.find((entry) => entry.binding === "APP_DB")?.database_id;
  return { name, files, config, secrets, appDatabaseId, migrationConfigs, order };
}

/** The whole Preview command: the prepare step, then `wrangler preview` over what it wrote. */
function previewCommand(account: FakeAccount, branch: string, newSecret?: () => string) {
  const prepared = prepare(account, branch, newSecret);
  account.deployPreview(prepared.files.get(PREVIEW_NAME_FILE) ?? "", prepared.secrets);
  return prepared;
}

// --- The preview command ----------------------------------------------------

test("the Preview command runs the prepare step, then invokes npx wrangler preview over the files it writes, if it wrote a name", () => {
  assert.equal(
    PREVIEW_COMMAND,
    'pnpm run preview:prepare && if [ -f dist/preview/name ]; then npx wrangler preview --config dist/server/wrangler.json --name "$(cat dist/preview/name)" --secrets-file dist/preview/secrets.json; fi',
  );
  // Workers Builds refuses a Preview command that does not invoke `npx wrangler preview` itself.
  const [first, guarded, ...rest] = PREVIEW_COMMAND.split(" && ");
  assert.equal(first, "pnpm run preview:prepare");
  assert.deepEqual(rest, []);
  const guard = guarded.match(/^if \[ -f (\S+) \]; then (npx wrangler preview .+); fi$/);
  assert.ok(guard, guarded);
  const [, guardFile, wranglerCall] = guard;
  // The name file is the last thing the prepare step writes, and only for a branch that gets a Preview.
  assert.equal(guardFile, PREVIEW_NAME_FILE);
  for (const path of [BUILT_CONFIG, PREVIEW_NAME_FILE, PREVIEW_SECRETS_FILE]) assert.ok(wranglerCall.includes(path), path);
  // Neither the Worker (dist/server) nor its assets (dist/client) upload the name or the secrets.
  for (const path of [PREVIEW_NAME_FILE, PREVIEW_SECRETS_FILE]) assert.match(path, /^dist\/preview\//);
  // docs/DEPLOY.md gives Huey this exact string to paste.
  assert.ok(readFileSync(DEPLOY, "utf8").includes(`\`${PREVIEW_COMMAND}\``));
});

test("the prepare step creates the app database, binds it, migrates it, and writes the Preview's name and first secret", () => {
  const account = new FakeAccount([{ name: DICTIONARY.name, uuid: DICTIONARY.id }]);
  const { name, files, config, secrets, appDatabaseId, migrationConfigs, order } = prepare(account, "huey/foo_bar");
  const created = account.databases.find((db) => db.name === name.appDatabase);
  assert.ok(created);

  assert.deepEqual(order, [
    "build",
    "wrangler d1 list",
    "wrangler d1 create",
    "wrangler d1 list",
    `write ${BUILT_CONFIG}`,
    "wrangler d1 migrations",
    `write ${PREVIEW_SECRETS_FILE}`,
    `write ${PREVIEW_NAME_FILE}`,
  ]);
  assert.deepEqual(account.lines.filter((line) => /migrations|^preview/.test(line)), [
    `d1 migrations apply ${name.appDatabase} --remote --config /tmp/migrations/wrangler.json`,
  ]);

  // APP_DB on the branch's own database, DB left on the shared dictionary.
  const byBinding = Object.fromEntries((config.previews?.d1_databases ?? []).map((entry) => [entry.binding, entry]));
  assert.equal(appDatabaseId, created.uuid);
  assert.equal(byBinding.APP_DB.database_name, name.appDatabase);
  assert.deepEqual(byBinding.DB, { binding: "DB", database_name: DICTIONARY.name, database_id: DICTIONARY.id });
  assert.deepEqual(migrationConfigs, [migrationsConfig({ preview: name, id: created.uuid }, "/repo/src/db/app/migrations")]);

  // The Preview is named by the slug, never the raw branch.
  assert.equal(files.get(PREVIEW_NAME_FILE), name.value);
  assert.equal(name.value, PreviewName.ofBranch("huey/foo_bar").value);
  assert.notEqual(name.value, "huey/foo_bar");
  assert.deepEqual(secrets, { BETTER_AUTH_SECRET: "random-secret" });
});

test("a second push to the same branch reuses the same app database and sends the Preview a fresh secret", () => {
  const account = new FakeAccount([{ name: DICTIONARY.name, uuid: DICTIONARY.id }]);
  const first = previewCommand(account, "huey/foo_bar");
  assert.equal(account.secrets.get(first.name.value), "random-secret");
  account.calls.length = 0;

  let asked = 0;
  const second = previewCommand(account, "huey/foo_bar", () => `secret-${++asked}`);
  assert.equal(second.name.value, first.name.value);
  assert.equal(second.appDatabaseId, first.appDatabaseId);
  assert.equal(account.lines.some((line) => line.startsWith("d1 create")), false);
  assert.equal(account.databases.filter((db) => db.name.startsWith(APP_DATABASE_PREFIX)).length, 1);
  assert.ok(account.lines.includes(`d1 migrations apply ${first.name.appDatabase} --remote --config /tmp/migrations/wrangler.json`));
  // A deployment keeps only the secrets it is sent, so every push sends one.
  assert.deepEqual(second.secrets, { BETTER_AUTH_SECRET: "secret-1" });
  assert.equal(account.secrets.get(first.name.value), "secret-1");
  const third = previewCommand(account, "huey/foo_bar", () => `secret-${++asked}`);
  assert.deepEqual(third.secrets, { BETTER_AUTH_SECRET: "secret-2" });
  assert.equal(account.secrets.get(first.name.value), "secret-2");
  assert.equal(account.lines.some((line) => line.startsWith("preview")), false);
});

test("the prepare step on main builds nothing, makes no app database, migrates nothing and writes no name", () => {
  const account = new FakeAccount([{ name: DICTIONARY.name, uuid: DICTIONARY.id }]);
  const { steps, files, migrationConfigs, order } = prepareSteps(account, "main");
  assert.deepEqual(preparePreview(steps), { kind: "skipped", branch: NO_PREVIEW_BRANCH });
  assert.equal(NO_PREVIEW_BRANCH, "main");
  assert.deepEqual(order, []);
  assert.deepEqual(account.calls, []);
  assert.deepEqual([...files.keys()], []);
  assert.deepEqual(migrationConfigs, []);
  assert.deepEqual(account.databases, [{ name: DICTIONARY.name, uuid: DICTIONARY.id }]);

  // Only the exact branch: anything else that looks like it still gets its Preview.
  for (const branch of ["Main", "main-2", "huey/main", "maint"]) {
    assert.equal(prepare(new FakeAccount(), branch).files.has(PREVIEW_NAME_FILE), true, branch);
  }
});

test("the prepare step stops before writing the name when the migrations fail, and runs nowhere without a branch", () => {
  const migrationsFail = new FakeAccount();
  migrationsFail.failing.push(/^d1 migrations apply/);
  assert.throws(() => prepare(migrationsFail, "huey/foo_bar"), /migrations apply failed/);

  assert.throws(() => prepare(new FakeAccount(), undefined), /WORKERS_CI_BRANCH/);
});

// --- The sweep ----------------------------------------------------------------

/** A fake GitHub answering the open pull requests list page by page. */
function github(pages: unknown[][] | { status: number } | Error) {
  const urls: string[] = [];
  const headers: Record<string, string>[] = [];
  const fetchPage = (async (url: string, init?: RequestInit) => {
    urls.push(url);
    headers.push(init?.headers as Record<string, string>);
    if (pages instanceof Error) throw pages;
    if (!Array.isArray(pages)) return new Response("{}", { status: pages.status });
    const page = Number(new URL(url).searchParams.get("page"));
    return Response.json(pages[page - 1] ?? []);
  }) as typeof fetch;
  return { fetchPage, urls, headers };
}

const pull = (ref: string) => ({ number: 1, state: "open", head: { ref, repo: { full_name: "povlabs/lexema" } } });

const OPEN = "huey/still-open";
const CLOSED = "huey/closed";
const account = () =>
  new FakeAccount([
    { name: DICTIONARY.name, uuid: DICTIONARY.id },
    { name: "lexema-app", uuid: "a0000000-0000-4000-8000-000000000001" },
    { name: "someone-elses-db", uuid: "a0000000-0000-4000-8000-000000000002" },
    { name: PreviewName.ofBranch(OPEN).appDatabase, uuid: "a0000000-0000-4000-8000-000000000003" },
    { name: PreviewName.ofBranch(CLOSED).appDatabase, uuid: "a0000000-0000-4000-8000-000000000004" },
    { name: PreviewName.ofBranch("main").appDatabase, uuid: "a0000000-0000-4000-8000-000000000005" },
  ]);

test("the sweep selects only lexema-preview-app databases whose branch has no open pull request", () => {
  const databases = account().databases;
  const open: OpenBranches = { state: "read", branches: new Set([OPEN]) };
  const selected = selectForSweep(databases, open).map(({ preview, database }) => [preview.value, database.name]);
  assert.deepEqual(selected, [
    [PreviewName.ofBranch(CLOSED).value, PreviewName.ofBranch(CLOSED).appDatabase],
    ["main", "lexema-preview-app-main"],
  ]);
  // Even a database that looks like a Preview's is never the dictionary.
  const disguised = [{ name: "lexema-preview-app-x", uuid: DICTIONARY.id }];
  assert.deepEqual(selectForSweep(disguised, { state: "read", branches: new Set() }), []);
});

test("the sweep selects nothing when the open pull requests cannot be read", () => {
  assert.deepEqual(selectForSweep(account().databases, { state: "unread", reason: "no token" }), []);
});

test("the open pull requests of the public repository are read without a token, and are unreadable on a refused request, a network failure or a malformed answer", async () => {
  for (const token of [undefined, "", "  "]) {
    const gh = github([[pull(OPEN)]]);
    const read = await readOpenBranches(token, gh.fetchPage);
    assert.equal(read.state, "read");
    assert.equal(gh.headers[0].authorization, undefined);
  }
  for (const answer of [{ status: 401 }, { status: 403 }, { status: 404 }, { status: 500 }, new Error("getaddrinfo ENOTFOUND"), [[{ number: 1 }]], [[pull(OPEN), { head: { ref: "" } }]]]) {
    const read = await readOpenBranches("token", github(answer as never).fetchPage);
    assert.equal(read.state, "unread", JSON.stringify(answer));
  }
  const notAList = (async () => Response.json({ message: "Bad credentials" })) as unknown as typeof fetch;
  assert.equal((await readOpenBranches("token", notAList)).state, "unread");
});

test("the open pull requests are read page by page from this repository with the read-only token", async () => {
  const first = Array.from({ length: 100 }, (_, i) => pull(`branch-${i}`));
  const gh = github([first, [pull(OPEN)]]);
  const read = await readOpenBranches("github_pat_x", gh.fetchPage);
  assert.equal(read.state, "read");
  assert.equal(read.state === "read" && read.branches.size, 101);
  assert.deepEqual(gh.urls, [
    "https://api.github.com/repos/povlabs/lexema/pulls?state=open&per_page=100&page=1",
    "https://api.github.com/repos/povlabs/lexema/pulls?state=open&per_page=100&page=2",
  ]);
  assert.equal(gh.headers[0].authorization, "Bearer github_pat_x");
});

test("the sweep deletes each closed branch's Preview, then its app database, and nothing else", async () => {
  const fake = account();
  for (const branch of [OPEN, CLOSED]) fake.previews.add(PreviewName.ofBranch(branch).value);
  const deleted = await sweep({ wrangler: fake.wrangler, token: "t", fetchPage: github([[pull(OPEN)]]).fetchPage, log: () => {} });

  const closed = PreviewName.ofBranch(CLOSED);
  assert.deepEqual(deleted.map(({ preview }) => preview.value), [closed.value, "main"]);
  assert.deepEqual(fake.lines.filter((line) => line.includes("delete")), [
    `preview delete --name ${closed.value} --worker-name lexema-web --skip-confirmation`,
    `d1 delete ${closed.appDatabase} --skip-confirmation`,
    // The main database had no Preview: the not-found answer lets its database go.
    "preview delete --name main --worker-name lexema-web --skip-confirmation",
    "d1 delete lexema-preview-app-main --skip-confirmation",
  ]);
  assert.deepEqual([...fake.previews], [PreviewName.ofBranch(OPEN).value]);
  assert.deepEqual(
    fake.databases.map(({ name }) => name),
    [DICTIONARY.name, "lexema-app", "someone-elses-db", PreviewName.ofBranch(OPEN).appDatabase],
  );
});

test("the sweep deletes nothing and calls no Wrangler when the pull requests cannot be read", async () => {
  for (const [token, answer] of [[undefined, { status: 403 }], ["t", { status: 401 }], ["t", new Error("offline")]] as const) {
    const fake = account();
    const deleted = await sweep({ wrangler: fake.wrangler, token, fetchPage: github(answer as never).fetchPage, log: () => {} });
    assert.deepEqual(deleted, []);
    assert.deepEqual(fake.calls, []);
    assert.equal(fake.databases.length, 6);
  }
});

test("a Preview the sweep cannot delete keeps its app database for the next sweep", async () => {
  const fake = account();
  const closed = PreviewName.ofBranch(CLOSED);
  fake.previews.add(closed.value);
  fake.failing.push(new RegExp(`^preview delete --name ${closed.value}`));
  await sweep({ wrangler: fake.wrangler, token: "t", fetchPage: github([[pull(OPEN)]]).fetchPage, log: () => {} });
  assert.ok(fake.databases.some(({ name }) => name === closed.appDatabase));
  assert.equal(fake.lines.includes(`d1 delete ${closed.appDatabase} --skip-confirmation`), false);
});

// --- The production command -------------------------------------------------

test("the production command runs the sweep, then deploys, and deploys even when the sweep fails", async () => {
  for (const outcome of ["passes", "throws", "rejects"] as const) {
    const order: string[] = [];
    await runProductionCommand({
      sweep: async () => {
        order.push("sweep");
        if (outcome === "throws") throw new Error("d1 list failed");
        if (outcome === "rejects") return Promise.reject(new Error("offline"));
      },
      deploy: () => order.push("deploy"),
      log: (line) => order.push(`log: ${line}`),
    });
    assert.equal(order[0], "sweep", outcome);
    assert.equal(order.at(-1), "deploy", outcome);
  }
  await assert.rejects(
    runProductionCommand({ sweep: async () => {}, deploy: () => { throw new Error("deploy failed"); }, log: () => {} }),
    /deploy failed/,
  );
});

test("the web package names the preview prepare step and the deploy command, and production deploys the production build", () => {
  const { scripts } = JSON.parse(readFileSync(PACKAGE, "utf8")) as { scripts: Record<string, string> };
  assert.equal(scripts["preview:prepare"], "node builds/preview.ts");
  assert.equal(scripts["preview:workers-builds"], undefined);
  assert.equal(scripts["deploy:workers-builds"], "node builds/production.ts");
  assert.equal(scripts["deploy:production"], "CLOUDFLARE_ENV=production vinext build && wrangler deploy --config dist/server/wrangler.json");
  const entry = readFileSync(fileURLToPath(new URL("../builds/production.ts", import.meta.url)), "utf8");
  assert.match(entry, /"run", "deploy:production"/);
});
