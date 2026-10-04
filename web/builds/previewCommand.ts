// The Workers Builds preview command (ADR 0018, docs/DEPLOY.md): what runs on
// every push to a branch that is not `production`. Workers Builds refuses a
// custom preview command that does not invoke `npx wrangler preview` itself
// (https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/#existing-workers-connected-to-builds),
// so the command is two steps: `preview:prepare`, which is `preparePreview`
// below, then Wrangler's own `wrangler preview` over the files it wrote. The
// second step runs only when the first wrote a Preview name, so a branch that
// gets no Preview builds and deploys nothing and still ends green.

import { type AppDatabase, type BuiltConfig, migrationsConfig, withAppDatabase, withDictionarySlice } from "./previewConfig.ts";
import { PreviewName } from "./previewName.ts";
import { prepareSlice, type SlicePlanner } from "./previewSlice.ts";
import { listDatabases, required, type Wrangler } from "./wrangler.ts";

/** The built config `wrangler preview` reads, relative to web/. */
export const BUILT_CONFIG = "dist/server/wrangler.json";
/**
 * The Preview's name, which `wrangler preview` would otherwise take from the
 * raw branch (`WORKERS_CI_BRANCH`, `getBranchName2` in Wrangler 4.135.0's
 * wrangler-dist/cli.js). Outside dist/server and dist/client, so neither the
 * Worker nor its assets upload it.
 */
export const PREVIEW_NAME_FILE = "dist/preview/name";
/** The secrets `wrangler preview --secrets-file` uploads with the deployment, as JSON. */
export const PREVIEW_SECRETS_FILE = "dist/preview/secrets.json";

/**
 * The exact Preview command in the Workers Builds settings, run from web/
 * (docs/DEPLOY.md). `wrangler preview` runs only when the prepare step wrote
 * the Preview name; with no name, the command ends there, successfully.
 */
export const PREVIEW_COMMAND =
  `pnpm run preview:prepare && if [ -f ${PREVIEW_NAME_FILE} ]; then npx wrangler preview --config ${BUILT_CONFIG}` +
  ` --name "$(cat ${PREVIEW_NAME_FILE})" --secrets-file ${PREVIEW_SECRETS_FILE}; fi`;

/**
 * The branch that gets no Preview (ADR 0018, amended on #491). What lands on
 * `main` goes live through `production` after the next green dictionary
 * deploy, and that production build's sweep would delete a `main` Preview
 * anyway, since `main` has no open pull request.
 */
export const NO_PREVIEW_BRANCH = "main";

/** What the prepare step did for one push: prepared that branch's Preview, or skipped a branch that gets none. */
export type PreparedPreview =
  | { readonly kind: "prepared"; readonly preview: PreviewName }
  | { readonly kind: "skipped"; readonly branch: typeof NO_PREVIEW_BRANCH };

/** The secret better-auth signs the session cookie with (web/worker/signIn.ts). */
const AUTH_SECRET = "BETTER_AUTH_SECRET";

export interface PreviewPrepareSteps {
  /** `WORKERS_CI_BRANCH`: the pushed branch. */
  readonly branch: string | undefined;
  readonly wrangler: Wrangler;
  /** The production build, which writes the built config. */
  build(): void;
  readBuiltConfig(): BuiltConfig;
  /** Write `content` to `path`, relative to web/. */
  writeFile(path: string, content: string): void;
  /** Write the app database's migrations config and return its path. */
  writeMigrationsConfig(config: Record<string, unknown>): string;
  /** The app migrations directory, absolute. */
  readonly migrationsDir: string;
  /** A fresh random secret. */
  newSecret(): string;
  /** What the branch's change declarations give its dictionary slice (web/builds/previewSlice.ts). */
  readonly slices: SlicePlanner;
  log(line: string): void;
}

/**
 * This branch's app database: the one already on the account, so every push
 * to a branch reuses it, or a new one. A create that loses a race with a
 * concurrent build of the same branch still finds the winner's database.
 */
export function findOrCreateAppDatabase(wrangler: Wrangler, preview: PreviewName, log: (line: string) => void): AppDatabase {
  const find = () => listDatabases(wrangler).find(({ name }) => name === preview.appDatabase)?.uuid;
  const existing = find();
  if (existing !== undefined) {
    log(`app database: reusing ${preview.appDatabase} (${existing})`);
    return { preview, id: existing };
  }
  wrangler(["d1", "create", preview.appDatabase, "--update-config=false"]);
  const created = find();
  if (created === undefined) throw new Error(`could not create the app database ${preview.appDatabase}`);
  log(`app database: created ${preview.appDatabase} (${created})`);
  return { preview, id: created };
}

/**
 * Prepare one branch's Preview for `wrangler preview`: build, give the branch
 * its own app database and, when it changes dictionary data, its dictionary
 * slice (#447), migrate the app database, and write the built config, the
 * Preview name and the secrets file the Preview command reads. On `main`,
 * which gets no Preview, it does none of that and writes nothing, so the
 * command's `wrangler preview` step does not run.
 */
export function preparePreview(steps: PreviewPrepareSteps): PreparedPreview {
  const { wrangler, log } = steps;
  if (steps.branch === undefined) throw new Error("WORKERS_CI_BRANCH is not set; the preview command runs in Workers Builds");
  if (steps.branch === NO_PREVIEW_BRANCH) {
    log(`no Preview for branch ${NO_PREVIEW_BRANCH}: nothing built, no app database, nothing deployed`);
    return { kind: "skipped", branch: NO_PREVIEW_BRANCH };
  }
  const preview = PreviewName.ofBranch(steps.branch);
  log(`Preview ${preview} for branch ${steps.branch}`);

  steps.build();
  const database = findOrCreateAppDatabase(wrangler, preview, log);
  const slice = prepareSlice(wrangler, preview, steps.slices, log);
  const config = withAppDatabase(steps.readBuiltConfig(), database);
  steps.writeFile(BUILT_CONFIG, `${JSON.stringify(slice === undefined ? config : withDictionarySlice(config, slice), null, 2)}\n`);

  // Migrations before the Preview, so no deployment ever runs on a database
  // older than its code ("Resources and isolation", D1 migrations).
  const migrations = steps.writeMigrationsConfig(migrationsConfig(database, steps.migrationsDir));
  required(wrangler(["d1", "migrations", "apply", preview.appDatabase, "--remote", "--config", migrations]), "wrangler d1 migrations apply");

  // A Preview deployment keeps only the secrets it is sent (Wrangler 4.135.0
  // sends no keep flag), and `preview secret put` refuses a Preview with no
  // deployment. So every deployment carries a fresh secret through
  // `--secrets-file`; a push signs the Preview's testers out.
  steps.writeFile(PREVIEW_SECRETS_FILE, `${JSON.stringify({ [AUTH_SECRET]: steps.newSecret() })}\n`);
  log(`${AUTH_SECRET}: a new random one goes up with Preview ${preview}`);
  steps.writeFile(PREVIEW_NAME_FILE, preview.value);
  return { kind: "prepared", preview };
}
