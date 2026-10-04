// The pull request plan check (#494): for each change declaration a pull
// request adds, plan it with the pull request's own code against the live
// dictionary and hold its counts to `expected`, so one pull request carries a
// change and its counts. `.github/workflows/dictionary-plan.yml` runs it with a
// D1 read-only token; it writes nothing. The deploy still holds every
// declaration to `expected` at merge (dictionaryDeploy.ts); this check only
// tells the author the counts before then.
//
// A plan reads the dictionary as it is now, so only the first declaration a
// pull request adds is planned: a later one's counts depend on what the earlier
// ones write, which a run that writes nothing cannot see. A later declaration
// is refused, naming the earlier ones. `update:auto`, `hide:records` and
// `load:page-entries` read an archive and a dump from `povlabs/lexema-data`,
// which is public and read without a token (#527).

import {
  checkPlan,
  type DeclarationDraft,
  type DeclaredChange,
  DECLARATIONS_DIR,
  isDeclarationPath,
  lookupJSON,
  lookupLine,
  parseDraft,
  passes,
  type PlanCheck,
} from "../update/declaration.js";
import type { PlanCounts } from "../update/planCounts.js";
import type { PlanOnlyAnswer } from "./dictionaryDeploy.js";
import type { Git } from "./pending.js";

/**
 * The declarations `head` adds past `base`, each parsed as a draft. They come
 * in path order, the order the deploy reads them from the one commit a pull
 * request lands as. A file that is not a declaration is refused, naming it.
 */
export function addedDeclarations(git: Git, base: string, head: string): DeclarationDraft[] {
  return git
    .run(["diff", "--name-only", "--diff-filter=A", base, head, "--", DECLARATIONS_DIR])
    .split("\n")
    .filter(isDeclarationPath)
    .map((path) => parseDraft(path, git.run(["show", `${head}:${path}`])));
}

/** What the check found for one declaration the pull request adds. */
export type DeclarationOutcome =
  /** An earlier declaration in the pull request writes first, so a plan against the dictionary as it is would ignore it. */
  | { readonly kind: "after-earlier"; readonly declaration: DeclarationDraft; readonly earlier: readonly string[] }
  /** Planned: `check` holds the plan to `expected`, or is null when the draft has no `expected` yet. */
  | { readonly kind: "planned"; readonly declaration: DeclarationDraft; readonly answer: PlanOnlyAnswer; readonly check: PlanCheck | null };

/** Whether an outcome lets the pull request pass: only a planned declaration whose counts match and cross no limit. */
export function outcomePasses(outcome: DeclarationOutcome): boolean {
  switch (outcome.kind) {
    case "after-earlier":
      return false;
    case "planned":
      return outcome.check !== null && passes(outcome.check);
  }
}

/** The plan-only entry. `povlabs/lexema-data` is public, so a change that reads data files needs no token (#527). */
export interface PullRequestPlanner {
  readonly plan: (change: DeclaredChange) => Promise<PlanOnlyAnswer>;
}

/**
 * Plan each declaration in order with the plan-only entry. Only the first is
 * planned; a later one is refused instead.
 */
export async function planPullRequest(declarations: readonly DeclarationDraft[], { plan }: PullRequestPlanner): Promise<DeclarationOutcome[]> {
  const outcomes: DeclarationOutcome[] = [];
  for (const [index, declaration] of declarations.entries()) {
    if (index > 0) outcomes.push({ kind: "after-earlier", declaration, earlier: declarations.slice(0, index).map(({ file }) => file) });
    else {
      const answer = await plan(declaration);
      const { expected } = declaration;
      outcomes.push({ kind: "planned", declaration, answer, check: expected === null ? null : checkPlan({ ...declaration, expected }, answer) });
    }
  }
  return outcomes;
}

/** The declaration file `declaration` should be, with `counts` as its `expected` and its own `lookups` kept. */
export function declarationWith(declaration: DeclaredChange & Pick<DeclarationDraft, "lookups">, counts: PlanCounts): string {
  const { command, inputs, lookups } = declaration;
  return `${JSON.stringify({ command, inputs, ...(lookups === undefined ? {} : { lookups: lookups.map(lookupJSON) }), expected: counts.toJSON() }, null, 2)}\n`;
}

/** The words a draft names for the deploy to look up, which this check does not look up: the change is not written yet. */
const lookupLines = ({ lookups }: DeclarationDraft): string[] =>
  lookups === undefined ? [] : ["", "After writing it, the deploy looks up:", ...lookups.map((lookup) => `- ${lookupLine(lookup)}`)];


const fenced = (json: string): string[] => ["```json", json.trimEnd(), "```"];

function outcomeLines(outcome: DeclarationOutcome): string[] {
  const { file, command } = outcome.declaration;
  const heading = `### \`${file}\` (\`${command}\`)`;
  switch (outcome.kind) {
    case "after-earlier":
      return [
        heading,
        "",
        `Not planned: it comes after ${outcome.earlier.map((earlier) => `\`${earlier}\``).join(", ")} in this pull request, ` +
          "and its counts depend on what those write first. This check writes nothing, so it cannot count them. " +
          "Move this declaration to its own pull request once the earlier ones are deployed.",
      ];
    case "planned": {
      const { answer, check } = outcome;
      const breaches = answer.limitBreaches.length === 0 ? [] : ["", "The plan crosses a hard limit, so the deploy would refuse it:", ...answer.limitBreaches.map((breach) => `- ${breach}`)];
      const rebuilds =
        answer.rebuilds.length === 0
          ? []
          : ["", "The plan rebuilds these tables, dropping each and copying its rows back:", "", "| Table | Rows |", "|---|---|", ...answer.rebuilds.map(({ table, rows }) => `| \`${table}\` | ${rows} |`)];
      const counts = ["", "Put this in the file, with `expected` set to the plan's counts:", "", ...fenced(declarationWith(outcome.declaration, answer.counts))];
      if (check === null) return [heading, "", "It has no `expected` yet.", ...counts, ...breaches, ...rebuilds];
      if (check.differences.length === 0) return [heading, "", "The plan's counts match `expected`.", ...breaches, ...rebuilds];
      return [
        heading,
        "",
        "The plan's counts differ from `expected`:",
        ...check.differences.map(({ count, declared, planned }) => `- \`${count}\` is ${planned} in the plan, ${declared} declared`),
        ...counts,
        ...breaches,
        ...rebuilds,
      ];
    }
  }
}

/** The check's answer as Markdown for the job summary and log, and whether the pull request passes. */
export function pullRequestPlanReport(outcomes: readonly DeclarationOutcome[], dictionary: string): { readonly markdown: string; readonly green: boolean } {
  const green = outcomes.every(outcomePasses);
  const lines =
    outcomes.length === 0
      ? ["This pull request adds no change declaration, so there is nothing to plan."]
      : [`Each declaration this pull request adds, planned with its own code against \`${dictionary}\`. Nothing was written.`, ...outcomes.flatMap((outcome) => ["", ...outcomeLines(outcome), ...lookupLines(outcome.declaration)])];
  return { markdown: [`## Dictionary plan check: ${green ? "green" : "red"}`, "", ...lines, ""].join("\n"), green };
}
