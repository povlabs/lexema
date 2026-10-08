// Production's app database, `lexema-app`, for the hand-run CLIs that take
// `--remote` (`pnpm run api-key`, `pnpm run plan`; #737). Only Huey runs them,
// with his own Wrangler login; see DEVELOPMENT.md.
//
// It reaches `lexema-app` by its real id through a temporary Wrangler config,
// as the production deploy and `pnpm run report:issues` do (web/builds/),
// because web/wrangler.jsonc gives `lexema-app` a local placeholder id at top
// level. Before any statement it checks that the account holds `lexema-app`
// under that id, and refuses the shared dictionary by name or id. It sends the
// statements the local target sends (./localD1.ts), one per call, and asks for
// a typed confirmation before the first one that writes.
//
// Wrangler's answers are captured and never printed: an INSERT of a new key
// carries the key's hash. A failure names its exit status and quotes what
// Wrangler said with every 64-digit hex run, the form of a key's hash, cut out.

import { spawnSync } from "node:child_process";
import type { D1Target } from "../../web/builds/appMigrations.ts";
import { appMigrationsConfig, isDictionary } from "../../web/builds/previewConfig.ts";
import { PRODUCTION_APP_DATABASE } from "../../web/builds/productionAppDatabase.ts";
import { APP_MIGRATIONS_DIR, WEB_DIR, writeMigrationsConfigFile } from "../../web/builds/wrangler.ts";
import type { CommandResult } from "../commandLine.js";
import type { AppTables } from "./app/database.js";
import type { D1Executor } from "./d1Command.js";
import { appTablesOver } from "./localD1.js";

/** What one Wrangler run gave back. Nothing here prints it. */
export interface WranglerAnswer {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/** Runs `wrangler <args>` from web/ and gives back what it said, printing none of it. */
export type QuietWrangler = (args: readonly string[]) => WranglerAnswer;

const quietWrangler: QuietWrangler = (args) => {
  const run = spawnSync("pnpm", ["exec", "wrangler", ...args], {
    cwd: WEB_DIR,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, CI: "1", WRANGLER_SEND_METRICS: "false" },
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return { status: run.error === undefined ? run.status : null, stdout: run.stdout ?? "", stderr: run.stderr ?? (run.error ? String(run.error) : "") };
};

/** `text` with every run of 64 hex digits, the form of a key's SHA-256 (src/api/keys.ts), cut out. */
export const withoutHashes = (text: string): string => text.replace(/[0-9a-f]{64}/gi, "<hash>");

/** What Wrangler said, without hashes, for a failure's message. */
const said = ({ stdout, stderr }: WranglerAnswer): string =>
  [stdout, stderr]
    .map((text) => withoutHashes(text.trim()))
    .filter((text) => text !== "")
    .map((text) => `\n${text}`)
    .join("");

/** A stop whose message holds no statement and no hash, so a `--remote` run prints it whole. */
export class ProductionStop extends Error {}

/** The account or the target is not what production's app database must be; nothing was sent to it. */
export class ProductionRefused extends ProductionStop {}

/** Huey did not type the confirmation, so the write was not sent. */
export class NotConfirmed extends ProductionStop {}

/** A statement Wrangler did not run. */
export class StatementFailed extends ProductionStop {}

/** Production's app database, checked on the account and reached by its real id. */
export class ProductionAppDatabase {
  private constructor(
    readonly target: D1Target,
    private readonly wrangler: QuietWrangler,
    private readonly config: string,
  ) {}

  /**
   * `target`, once the account is shown to hold it under its id; else
   * `ProductionRefused`, before any statement is sent. The dictionary is
   * refused by name or id.
   */
  static open(
    wrangler: QuietWrangler = quietWrangler,
    target: D1Target = PRODUCTION_APP_DATABASE,
    writeConfig: (config: Record<string, unknown>) => string = writeMigrationsConfigFile,
  ): ProductionAppDatabase {
    if (isDictionary(target)) throw new ProductionRefused(`refusing to write the shared dictionary (${target.name}, ${target.id})`);
    const listed = wrangler(["d1", "list", "--json"]);
    if (listed.status !== 0) throw new ProductionRefused(`wrangler d1 list failed (exit ${listed.status ?? "signal"}); is Wrangler logged in?${said(listed)}`);
    let databases: unknown;
    try {
      databases = JSON.parse(listed.stdout);
    } catch {
      throw new ProductionRefused("wrangler d1 list --json did not answer JSON");
    }
    if (!Array.isArray(databases) || !databases.every((db) => typeof db?.uuid === "string" && typeof db?.name === "string")) {
      throw new ProductionRefused("wrangler d1 list --json did not answer a list of databases");
    }
    const onAccount = (databases as { uuid: string; name: string }[]).find(({ name }) => name === target.name);
    if (onAccount === undefined) throw new ProductionRefused(`refusing to write ${target.name}: it is not on the account`);
    if (onAccount.uuid !== target.id) {
      throw new ProductionRefused(`refusing to write ${target.name}: the account holds it as ${onAccount.uuid}, not ${target.id}`);
    }
    return new ProductionAppDatabase(target, wrangler, writeConfig(appMigrationsConfig(target, APP_MIGRATIONS_DIR)));
  }

  /** Its name and id, as a prompt or a refusal says them. */
  get described(): string {
    return `production's ${this.target.name} (${this.target.id})`;
  }

  /** The app tables in it; `beforeWrite` runs before every statement that is not a SELECT. */
  tables(beforeWrite: () => Promise<void>): AppTables {
    const database: D1Executor = {
      execute: (args) => {
        const run = this.wrangler(["d1", "execute", this.target.name, "--remote", "--config", this.config, ...args]);
        if (run.status !== 0) {
          throw new StatementFailed(`wrangler d1 execute on ${this.described} failed (exit ${run.status ?? "signal"})${said(run)}`);
        }
        return run.stdout;
      },
    };
    return appTablesOver(database, beforeWrite);
  }
}

/** Asks Huey `question` and gives back what he typed, or "" once the input has closed. */
export type Ask = (question: string) => Promise<string>;

/** A question on the terminal: the prompt on stderr, the answer one line of stdin. */
export const askOnTerminal: Ask = async (question) => {
  const { createInterface } = await import("node:readline");
  const terminal = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    terminal.once("close", () => resolve(""));
    terminal.question(question, (answer) => {
      resolve(answer);
      terminal.close();
    });
  });
};

/** A failure's message when it is a `ProductionStop`, at any depth of its causes; else none of its text. */
function printable(failure: unknown): string {
  for (let at = failure; at instanceof Error; at = at.cause) {
    if (at instanceof ProductionStop) return at.message;
  }
  const name = failure instanceof Error ? failure.name : typeof failure;
  return `stopped on ${name}; its text is not printed, since it may quote a statement that holds a key's hash`;
}

/**
 * Run `command` on production's app database. It names the database and the
 * change before the first write, and sends that write only once Huey types
 * the database's name; anything else ends the run with nothing written. A
 * refusal or failure is printed only as a `ProductionStop` says it.
 */
export async function onProduction(
  change: string,
  command: (db: AppTables) => Promise<CommandResult>,
  ask: Ask,
  open: () => ProductionAppDatabase,
): Promise<CommandResult> {
  let database: ProductionAppDatabase;
  try {
    database = open();
  } catch (failure) {
    return { out: printable(failure), status: 1 };
  }
  let confirmed = false;
  const confirm = async (): Promise<void> => {
    if (confirmed) return;
    const answer = await ask(
      `About to write to ${database.described}: ${change}\nType ${database.target.name} to write it, anything else to stop: `,
    );
    if (answer.trim() !== database.target.name) throw new NotConfirmed(`not confirmed: nothing was written to ${database.described}`);
    confirmed = true;
  };
  try {
    return await command(database.tables(confirm));
  } catch (failure) {
    return { out: printable(failure), status: 1 };
  }
}

/** The flag that sends a hand-run command to production. It is only ever the first argument. */
export const REMOTE_FLAG = "--remote";

/** Where a `--remote` run goes and how it asks; the defaults are production and the terminal. */
export interface RemoteReach {
  readonly ask?: Ask;
  readonly open?: () => ProductionAppDatabase;
}

/** An argument as Huey would type it again. */
const shown = (arg: string): string => (/^[\w./:@=-]+$/.test(arg) ? arg : JSON.stringify(arg));

/**
 * Run `pnpm run <name> <args>`: on production's app database when `args` opens
 * with `--remote`, else on the local one `local` names, exactly as before.
 */
export function runHandCommand(
  name: string,
  args: readonly string[],
  command: (args: readonly string[], db: AppTables) => Promise<CommandResult>,
  local: () => AppTables,
  remote: RemoteReach = {},
): Promise<CommandResult> {
  if (args[0] !== REMOTE_FLAG) return command(args, local());
  const rest = args.slice(1);
  return onProduction(
    [name, ...rest].map(shown).join(" "),
    (db) => command(rest, db),
    remote.ask ?? askOnTerminal,
    remote.open ?? (() => ProductionAppDatabase.open()),
  );
}
