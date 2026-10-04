// The sweep (ADR 0018): on each push to `production`, before production
// deploys, delete the Preview and app database of every branch with no open
// pull request. A merged pull request is cleaned up at the production build
// that follows its merge; one closed without merging, at the next production
// build.
//
// Which branches still have an open pull request is read from GitHub's REST
// API: the build itself sees no pull request state (#238 R3.2). The repository
// is public, so no token is needed; `GITHUB_PR_READ_TOKEN` is sent when set
// (#527). When that list cannot be read, nothing is deleted.
//
// What exists is read from the account's D1 databases: the preview command
// creates `lexema-preview-app-<name>` before it runs `wrangler preview --name
// <name>`, so every Preview it made has one, and Wrangler 4.135.0 has no
// command that lists Previews. Only databases with that prefix are ever
// selected, and the shared dictionary never is.

import { DICTIONARY } from "./previewConfig.ts";
import { PreviewName } from "./previewName.ts";
import { type D1Database, listDatabases, type Wrangler } from "./wrangler.ts";

/** The repository whose pull requests keep Previews alive. */
export const REPOSITORY = "povlabs/lexema";
/** GitHub's largest page (https://docs.github.com/en/rest/pulls/pulls#list-pull-requests). */
const PAGE_SIZE = 100;
/** More pages than this is not a list this repository has; read it as unreadable. */
const MAX_PAGES = 20;
/** The Worker whose Previews these are (web/wrangler.jsonc). */
const WORKER = "lexema-web";
/**
 * The API error code for a Preview that is not there. Wrangler 4.135.0 names it
 * `PREVIEW_NOT_FOUND_ERR_CODE` and prints API errors as `[code: <n>]`
 * (`throwFetchError` in wrangler-dist/cli.js).
 */
const PREVIEW_NOT_FOUND = "[code: 10025]";

/** The head branches of open pull requests, or why they could not be read. */
export type OpenBranches =
  | { readonly state: "read"; readonly branches: ReadonlySet<string> }
  | { readonly state: "unread"; readonly reason: string };

/** One branch's leftovers the sweep deletes. */
export interface SweepTarget {
  readonly preview: PreviewName;
  readonly database: D1Database;
}

/**
 * Every open pull request's head branch, read page by page from GitHub's REST
 * API. The repository is public, so no token is needed; one is sent when set
 * (#527). Anything short of a whole, well-formed list is `unread`: a refused or
 * failed request, or an answer of the wrong shape.
 */
export async function readOpenBranches(token: string | undefined, fetchPage: typeof fetch): Promise<OpenBranches> {
  const auth: Record<string, string> = token === undefined || token.trim() === "" ? {} : { authorization: `Bearer ${token.trim()}` };
  const branches = new Set<string>();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `https://api.github.com/repos/${REPOSITORY}/pulls?state=open&per_page=${PAGE_SIZE}&page=${page}`;
    let pulls: unknown;
    try {
      const response = await fetchPage(url, {
        headers: {
          accept: "application/vnd.github+json",
          ...auth,
          "user-agent": "lexema-workers-builds-sweep",
          "x-github-api-version": "2022-11-28",
        },
      });
      if (!response.ok) return { state: "unread", reason: `GitHub answered ${response.status} for open pull requests` };
      pulls = await response.json();
    } catch (error) {
      return { state: "unread", reason: `could not read open pull requests: ${error instanceof Error ? error.message : String(error)}` };
    }
    if (!Array.isArray(pulls)) return { state: "unread", reason: "GitHub's answer was not a list of pull requests" };
    for (const pull of pulls) {
      const ref: unknown = pull?.head?.ref;
      if (typeof ref !== "string" || ref === "") return { state: "unread", reason: "an open pull request has no head branch" };
      branches.add(ref);
    }
    if (pulls.length < PAGE_SIZE) return { state: "read", branches };
  }
  return { state: "unread", reason: `more than ${MAX_PAGES * PAGE_SIZE} open pull requests` };
}

/**
 * What the sweep deletes: each Preview app database whose branch has no open
 * pull request, with its Preview. Nothing when the open list is unread, and
 * never a database without the Preview prefix or the shared dictionary.
 */
export function selectForSweep(databases: readonly D1Database[], open: OpenBranches): SweepTarget[] {
  if (open.state !== "read") return [];
  const live = new Set([...open.branches].map((branch) => PreviewName.ofBranch(branch).value));
  return databases.flatMap((database) => {
    if (database.uuid === DICTIONARY.id || database.name === DICTIONARY.name) return [];
    const preview = PreviewName.ofAppDatabase(database.name);
    return preview === undefined || live.has(preview.value) ? [] : [{ preview, database }];
  });
}

export interface SweepSteps {
  readonly wrangler: Wrangler;
  /** `GITHUB_PR_READ_TOKEN`, optional on the public repository (#527). */
  readonly token: string | undefined;
  readonly fetchPage: typeof fetch;
  log(line: string): void;
}

/**
 * Delete what `selectForSweep` selects. Each Preview goes first; its database
 * goes only once the Preview is gone, so a failed delete leaves the database
 * as the record the next sweep retries from. Returns what it deleted.
 */
export async function sweep({ wrangler, token, fetchPage, log }: SweepSteps): Promise<SweepTarget[]> {
  const open = await readOpenBranches(token, fetchPage);
  if (open.state !== "read") {
    log(`sweep: deleting nothing, ${open.reason}`);
    return [];
  }
  const targets = selectForSweep(listDatabases(wrangler), open);
  log(`sweep: ${open.branches.size} open pull request branch(es); ${targets.length} Preview(s) to delete`);
  const deleted: SweepTarget[] = [];
  for (const target of targets) {
    const { preview } = target;
    const removed = wrangler(["preview", "delete", "--name", preview.value, "--worker-name", WORKER, "--skip-confirmation"]);
    if (!removed.ok && !`${removed.stdout}${removed.stderr}`.includes(PREVIEW_NOT_FOUND)) {
      log(`sweep: could not delete Preview ${preview}; keeping ${preview.appDatabase} for the next sweep`);
      continue;
    }
    if (!wrangler(["d1", "delete", preview.appDatabase, "--skip-confirmation"]).ok) {
      log(`sweep: deleted Preview ${preview}, but not ${preview.appDatabase}`);
      continue;
    }
    log(`sweep: deleted Preview ${preview} and ${preview.appDatabase}`);
    deleted.push(target);
  }
  return deleted;
}
