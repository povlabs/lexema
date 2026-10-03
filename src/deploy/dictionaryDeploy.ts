// The dictionary deploy run (#456): after a merge to `main`, apply the change
// declarations it adds to the shared dictionary, then let the site deploy.
//
// 1. Read the declarations added in `production..head` (pending.ts). None:
//    write nothing and fast-forward `production`.
// 2. Fetch the archive and dump each one reads and check their checksums
//    (dataFiles.ts). A file that is not what it must be stops the run here.
// 3. Record a D1 Time Travel bookmark: the restore point.
// 4. For each declaration, oldest first: plan it, hold the plan's counts to
//    the declared ones and to the hard limits, run its file, read it back.
// 5. Look up a fixed word list in the dictionary written (wordCheck.ts).
// 6. Fast-forward `production` to `head`, which deploys the site.
//
// Any stop is red and leaves `production` where it is. Once something was
// written, a red run names the bookmark and the command that restores it; it
// never restores by itself (ADR 0018). The YAML only wires the credentials.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { checkPlan, passes, type ChangeDeclaration, type DeclaredChange } from "../update/declaration.js";
import type { MasterReader } from "../update/master.js";
import type { PlanCounts } from "../update/planCounts.js";
import { type DataFetcher, type DumpCatalog, fetchVerified, filesFor } from "./dataFiles.js";
import { advanceProduction, deployRange, type Git } from "./pending.js";
import { type ReadyChange, planWrite, readyChange } from "./writePlan.js";
import { lookUpWords, WORD_LIST } from "./wordCheck.js";
import type { ArchiveFactsCatalog } from "../source/archiveFacts.js";

/** The steps of a run, in the order a run that writes takes them. */
export const DEPLOY_STEPS = ["pending", "fetch", "bookmark", "plan", "apply", "read-back", "word-lookup", "production"] as const;
export type DeployStep = (typeof DEPLOY_STEPS)[number];

/** The dictionary a run writes: its name, and `wrangler d1 execute` aimed at it. */
export interface DeployTarget {
  readonly dictionary: string;
  execute(args: readonly string[], capture: boolean): string;
}

/** What a run reads and writes through. Each is injected, so a test runs the whole run on a local D1 and a local Git remote. */
export interface DeployDeps {
  readonly git: Git;
  /** The commit the run deploys. */
  readonly head: string;
  readonly target: DeployTarget;
  readonly reader: MasterReader;
  /** Record a Time Travel bookmark of the dictionary as it is now, and return it. */
  readonly bookmark: () => string;
  readonly fetcher: DataFetcher;
  /** Where fetched files and the SQL files go. */
  readonly workDir: string;
  readonly catalog?: ArchiveFactsCatalog;
  readonly dumps?: DumpCatalog;
  readonly words?: readonly string[];
  readonly now?: () => string;
  /** Told each step as it starts. */
  readonly onStep?: (step: DeployStep, detail: string) => void;
}

/** One declaration the run took up: its counts, and whether its file ran. */
export interface DeployedChange {
  readonly file: string;
  readonly command: DeclaredChange["command"];
  readonly counts: PlanCounts;
  readonly ran: boolean;
}

/** How a run ended. A red run that wrote holds the bookmark it wrote after, so its restore can always be named. */
export type DeployOutcome =
  | { readonly kind: "green"; readonly production: string; readonly bookmark: string | null; readonly changes: readonly DeployedChange[] }
  | { readonly kind: "deployed-already"; readonly production: string; readonly head: string }
  | { readonly kind: "red"; readonly written: false; readonly reasons: readonly string[]; readonly bookmark: string | null; readonly changes: readonly DeployedChange[] }
  | { readonly kind: "red"; readonly written: true; readonly reasons: readonly string[]; readonly bookmark: string; readonly changes: readonly DeployedChange[] };

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Fetch and check the files each change reads, pairing each change with them. Nothing is planned before every file is checked. */
async function readyAll<Change extends DeclaredChange>(
  changes: readonly Change[],
  deps: Pick<DeployDeps, "fetcher" | "workDir" | "catalog" | "dumps">,
): Promise<{ change: Change; ready: ReadyChange }[]> {
  const ready: { change: Change; ready: ReadyChange }[] = [];
  for (const change of changes) {
    const files = filesFor(change, deps.catalog, deps.dumps);
    const fetched = files === null ? null : await fetchVerified(files, deps.fetcher, join(deps.workDir, "data"));
    ready.push({ change, ready: readyChange(change, fetched) });
  }
  return ready;
}

/** Run a deploy of `deps.head`. It never throws for a red run: the outcome says why. */
export async function deployDictionary(deps: DeployDeps): Promise<DeployOutcome> {
  const step = deps.onStep ?? (() => {});
  const now = deps.now ?? (() => new Date().toISOString());
  const changes: DeployedChange[] = [];
  let bookmark: string | null = null;
  let written = false;
  const red = (reasons: readonly string[]): DeployOutcome =>
    written && bookmark !== null ? { kind: "red", written, reasons, bookmark, changes } : { kind: "red", written: false, reasons, bookmark, changes };

  try {
    step("pending", deps.head);
    const range = deployRange(deps.git, deps.head);
    if (range.kind === "deployed-already") return range;
    if (range.declarations.length > 0) {
      step("fetch", range.declarations.map((declaration) => declaration.file).join(", "));
      const ready = await readyAll<ChangeDeclaration>(range.declarations, deps);

      step("bookmark", deps.target.dictionary);
      bookmark = deps.bookmark();

      for (const { change: declaration, ready: change } of ready) {
        step("plan", declaration.file);
        const plan = await planWrite(change, deps.reader, now());
        const check = checkPlan(declaration, plan.run);
        const taken = { file: declaration.file, command: declaration.command, counts: plan.run.counts, ran: false };
        if (!passes(check)) {
          changes.push(taken);
          return red([
            ...check.differences.map(({ count, declared, planned }) => `${declaration.file}: ${count} is ${planned} in the plan, ${declared} declared`),
            ...check.breaches.map((breach) => `${declaration.file}: the plan ${breach}`),
          ]);
        }
        if (plan.sql !== "") {
          step("apply", declaration.file);
          await mkdir(deps.workDir, { recursive: true });
          const file = join(deps.workDir, `${declaration.file.replaceAll("/", "-")}.sql`);
          await writeFile(file, plan.sql);
          written = true;
          deps.target.execute(["--file", file], false);
        }
        changes.push({ ...taken, ran: plan.sql !== "" });
        step("read-back", declaration.file);
        const mismatches = plan.readBack(deps.reader);
        if (mismatches.length > 0) return red(mismatches.map((mismatch) => `${declaration.file}: ${mismatch}`));
      }

      step("word-lookup", (deps.words ?? WORD_LIST).join(", "));
      const missing = await lookUpWords(deps.reader, deps.words);
      if (missing.length > 0) return red(missing.map((mismatch) => `word lookup: ${mismatch}`));
    }

    step("production", range.head);
    try {
      advanceProduction(deps.git, range.head);
    } catch (error: unknown) {
      return red([
        `every check passed, but production could not be fast-forwarded to ${range.head} (${messageOf(error)}). ` +
          "A re-run plans the same declarations again, so restore the bookmark first when something was written.",
      ]);
    }
    return { kind: "green", production: range.head, bookmark, changes };
  } catch (error: unknown) {
    return red([messageOf(error)]);
  }
}

/** What a plan-only run of one change found: its counts and the hard limits they cross. */
export interface PlanOnlyAnswer {
  readonly command: DeclaredChange["command"];
  readonly counts: PlanCounts;
  readonly dictionaryRecords: number;
  readonly limitBreaches: readonly string[];
}

/**
 * The plan-only entry (#456): fetch and check the files `change` reads, plan
 * it, and return its counts. It records no bookmark, runs nothing on the
 * dictionary and moves no branch.
 */
export async function planOnly(change: DeclaredChange, deps: Pick<DeployDeps, "reader" | "fetcher" | "workDir" | "catalog" | "dumps" | "now">): Promise<PlanOnlyAnswer> {
  const [{ ready }] = await readyAll([change], deps);
  const { run } = await planWrite(ready, deps.reader, (deps.now ?? (() => new Date().toISOString()))());
  return { command: run.command, counts: run.counts, dictionaryRecords: run.dictionaryRecords, limitBreaches: run.counts.limitBreaches(run.dictionaryRecords) };
}

/** The command that restores the dictionary to `bookmark`, run from the repository root. */
export const restoreCommand = (dictionary: string, bookmark: string): string =>
  `pnpm --dir web exec wrangler d1 time-travel restore ${dictionary} --bookmark=${bookmark}`;

const countsLine = ({ file, command, counts, ran }: DeployedChange): string =>
  `| \`${file}\` | \`${command}\` | ${counts.records.added} | ${counts.records.changed} | ${counts.records.removed} | ${ran ? "yes" : "no"} |`;

const changesTable = (changes: readonly DeployedChange[]): string[] =>
  changes.length === 0
    ? []
    : ["", "| Declaration | Command | Added | Changed | Removed | Written |", "|---|---|---|---|---|---|", ...changes.map(countsLine)];

/** The run's summary, as Markdown for the GitHub job summary. */
export function deploySummary(outcome: DeployOutcome, dictionary: string): string {
  switch (outcome.kind) {
    case "deployed-already":
      return `## Dictionary deploy: nothing to do\n\n\`${outcome.head}\` is already in \`production\` (\`${outcome.production}\`). Nothing was written and no branch moved.\n`;
    case "green":
      return [
        "## Dictionary deploy: green",
        "",
        outcome.changes.length === 0
          ? `No change declaration was added, so nothing was written to \`${dictionary}\`.`
          : `Applied ${outcome.changes.length} change declaration(s) to \`${dictionary}\`. Bookmark before the first write: \`${outcome.bookmark}\`.`,
        ...changesTable(outcome.changes),
        "",
        `\`production\` is now \`${outcome.production}\`, so the site deploys.`,
        "",
      ].join("\n");
    case "red":
      return [
        "## Dictionary deploy: red",
        "",
        ...outcome.reasons.map((reason) => `- ${reason}`),
        ...changesTable(outcome.changes),
        "",
        "`production` did not move, so the site stays at its last green commit.",
        "",
        ...(outcome.written
          ? [
              `Something was written to \`${dictionary}\`. The bookmark from before the first write is \`${outcome.bookmark}\`. Nothing restores by itself. To restore, run from the repository root:`,
              "",
              "```sh",
              restoreCommand(dictionary, outcome.bookmark),
              "```",
            ]
          : [
              `Nothing was written to \`${dictionary}\`.` +
                (outcome.bookmark === null ? "" : ` The bookmark recorded before planning is \`${outcome.bookmark}\`; no restore is needed.`),
            ]),
        "",
      ].join("\n");
  }
}
