// `pnpm run report:issues`: open one GitHub issue per new waiting reader report
// in production (#631). Only the `reader-reports.yml` workflow runs it; see
// docs/DEPLOY.md, "Reader report issues".
//
// It reads production's `lexema-app` and `lexema-dictionary` by their real ids
// through temporary Wrangler configs, as the production deploy does
// (web/builds/), because web/wrangler.jsonc gives `lexema-app` a local
// placeholder id. Its D1 statements are `WAITING_REPORTS_QUERY` on
// `lexema-app` and, when a report to open names a record, one `headwordQuery`
// on `lexema-dictionary`. Wrangler's answers are captured and never printed:
// Actions logs are public, and an answer may hold reader text.
//
//   CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID  the D1 read token, for Wrangler only
//   GITHUB_TOKEN, GITHUB_REPOSITORY              the issues to read and open, for GitHub only

import { spawnSync } from "node:child_process";
import { setTimeout as pause } from "node:timers/promises";
import type { D1Target } from "../../web/builds/appMigrations.ts";
import { PRODUCTION_APP_DATABASE } from "../../web/builds/productionAppDatabase.ts";
import { appMigrationsConfig, DICTIONARY } from "../../web/builds/previewConfig.ts";
import { APP_MIGRATIONS_DIR, WEB_DIR, writeMigrationsConfigFile } from "../../web/builds/wrangler.ts";
import { isMain } from "../commandLine.js";
import {
  REPORT_LABEL,
  ReportNotice,
  sendWaitingReports,
  WAITING_REPORTS_QUERY,
  type Dictionary,
  type ReportIssues,
  type WaitingReports,
} from "./reportIssue.js";

/** Runs `wrangler <args>` from web/ with `env`, and gives back its exit status and stdout, which it never prints. */
export type QuietWrangler = (args: readonly string[], env: NodeJS.ProcessEnv) => { status: number | null; stdout: string };

const quietWrangler: QuietWrangler = (args, env) => {
  const run = spawnSync("pnpm", ["exec", "wrangler", ...args], {
    cwd: WEB_DIR,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return { status: run.status, stdout: run.stdout ?? "" };
};

/** The rows of `wrangler d1 execute --json`'s answer to one statement, or a throw that quotes none of it. */
export function rowsOf(stdout: string): unknown[] {
  let answer: unknown;
  try {
    answer = JSON.parse(stdout);
  } catch {
    throw new Error("wrangler d1 execute did not answer JSON");
  }
  const rows = Array.isArray(answer) && answer.length === 1 ? (answer[0] as { results?: unknown }).results : undefined;
  if (!Array.isArray(rows)) throw new Error("wrangler d1 execute did not answer one list of rows");
  return rows;
}

/**
 * The rows of `statement` on `database`, through the Wrangler config at
 * `config`. Wrangler gets the Cloudflare token and none of GitHub's; its output
 * is read, never echoed, and a failure names only its exit status.
 */
function quietRows(wrangler: QuietWrangler, env: NodeJS.ProcessEnv, database: D1Target, config: string, statement: string): unknown[] {
  const { GITHUB_TOKEN: _github, GH_TOKEN: _gh, ...wranglerEnv } = env;
  const args = ["d1", "execute", database.name, "--remote", "--config", config, "--json", `--command=${statement}`];
  const run = wrangler(args, { ...wranglerEnv, CI: "1", WRANGLER_SEND_METRICS: "false" });
  if (run.status !== 0) throw new Error(`wrangler d1 execute on ${database.name} failed (exit ${run.status ?? "signal"}); its output is not printed`);
  return rowsOf(run.stdout);
}

/** The waiting reports in production's `lexema-app`. */
export function productionReports(wrangler: QuietWrangler = quietWrangler, env: NodeJS.ProcessEnv = process.env): WaitingReports {
  return {
    read() {
      const config = writeMigrationsConfigFile(appMigrationsConfig(PRODUCTION_APP_DATABASE, APP_MIGRATIONS_DIR));
      return quietRows(wrangler, env, PRODUCTION_APP_DATABASE, config, WAITING_REPORTS_QUERY).map((row) => ReportNotice.fromRow(row));
    },
  };
}

/** The Wrangler config naming the shared dictionary by its real id, bound as production binds it. */
export const dictionaryConfig = (): Record<string, unknown> => ({
  name: "lexema-web",
  d1_databases: [{ binding: "DB", database_name: DICTIONARY.name, database_id: DICTIONARY.id }],
});

/** Production's `lexema-dictionary`, read only: it runs the one headword statement it is handed. */
export function productionDictionary(wrangler: QuietWrangler = quietWrangler, env: NodeJS.ProcessEnv = process.env): Dictionary {
  return {
    rows(statement) {
      return quietRows(wrangler, env, DICTIONARY, writeMigrationsConfigFile(dictionaryConfig()), statement);
    },
  };
}

/** GitHub's REST API, as `fetch` reaches it. */
export type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<Response>;

/** The URL a `Link` header names as the next page, if any. */
export function nextPage(link: string | null): string | undefined {
  return link?.split(",").map((part) => /^\s*<([^>]+)>\s*;\s*rel="next"\s*$/.exec(part)?.[1]).find((url) => url !== undefined);
}

/**
 * Report issues in `repository` through GitHub's REST API with `token`. The
 * marker read pages through the issues list, open and closed, never the search
 * API, which lags behind a just-opened issue and would let a run open a twin.
 * A failed call names its status, never the response body.
 */
export function githubIssues(repository: string, token: string, fetch: Fetch = globalThis.fetch, wait: (ms: number) => Promise<unknown> = pause): ReportIssues {
  const api = `https://api.github.com/repos/${repository}`;
  const headers = {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "x-github-api-version": "2022-11-28",
    "user-agent": "lexema-reader-reports",
  };
  const call = async (what: string, url: string, method = "GET", body?: unknown): Promise<Response> => {
    const response = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!response.ok && response.status !== 404) throw new Error(`GitHub refused to ${what} (HTTP ${response.status})`);
    return response;
  };
  return {
    async labelledBodies() {
      const bodies: (string | null)[] = [];
      let url: string | undefined = `${api}/issues?labels=${REPORT_LABEL}&state=all&per_page=100`;
      while (url !== undefined) {
        const response = await call("list the report issues", url);
        if (response.status === 404) throw new Error("GitHub refused to list the report issues (HTTP 404)");
        const page: unknown = await response.json();
        if (!Array.isArray(page)) throw new Error("GitHub did not answer the issues list as a list");
        for (const issue of page) bodies.push(typeof issue?.body === "string" ? issue.body : null);
        url = nextPage(response.headers.get("link"));
      }
      return bodies;
    },
    async ensureLabel() {
      const found = await call("read the report label", `${api}/labels/${REPORT_LABEL}`);
      if (found.status !== 404) return;
      await call("create the report label", `${api}/labels`, "POST", {
        name: REPORT_LABEL,
        color: "c5def5",
        description: "One reader report from lexema.fyi, opened by reader-reports.yml",
      });
    },
    async open(title, body) {
      const opened = await call("open a report issue", `${api}/issues`, "POST", { title, body, labels: [REPORT_LABEL] });
      if (opened.status === 404) throw new Error("GitHub refused to open a report issue (HTTP 404)");
      // GitHub asks for a second between requests that create content.
      await wait(1000);
    },
  };
}

if (isMain(import.meta.url)) {
  const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repository } = process.env;
  if (!token || !repository) {
    process.stderr.write("report:issues needs GITHUB_TOKEN and GITHUB_REPOSITORY\n");
    process.exitCode = 1;
  } else {
    try {
      await sendWaitingReports(productionReports(), githubIssues(repository, token), productionDictionary(), (line) => process.stdout.write(`${line}\n`));
    } catch (error) {
      process.stderr.write(`report:issues: ${(error as Error).message}\n`);
      process.exitCode = 1;
    }
  }
}
