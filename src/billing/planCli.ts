// `pnpm run plan`: set and end an account's Enterprise plan in the local app database (#260).
//
//   pnpm run plan enterprise 3 --calls 20000000 --per-minute 1000 --from 2026-10-01 --until 2026-11-01
//   pnpm run plan end 3
//
// Enterprise is agreed per account, so Huey sets its calls, its rate and each
// period by hand; nothing renews it. The period runs from the start of `--from`
// up to the start of `--until`, both UTC days. An account that still holds a
// Starter or Pro plan, serving or past due, is refused: that plan is cancelled
// in Stripe first. The
// database is the local `APP_DB` the dev seed migrates, as `pnpm run api-key`
// reaches it.

import { finish, flags, isMain, positive, usageError, type CommandResult } from "../commandLine.js";
import type { AppTables } from "../db/app/database.js";
import { seededAppDatabase } from "../db/localD1.js";
import { endEnterprise, setEnterprise } from "./accountPlan.js";
import { PLAN_TERMS, type PlanState } from "./plans.js";

const USAGE = `usage:
  pnpm run plan enterprise <account id> --calls <calls a period> --per-minute <calls> --from <YYYY-MM-DD> --until <YYYY-MM-DD>
  pnpm run plan end <account id>`;

const usage = (problem: string): CommandResult => usageError(problem, USAGE);

/** The start of a UTC day written `YYYY-MM-DD`, in milliseconds, or undefined when it is not a real day. */
function dayStart(text: string | undefined): number | undefined {
  if (text === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined;
  const at = Date.parse(`${text}T00:00:00Z`);
  return Number.isNaN(at) || new Date(at).toISOString().slice(0, 10) !== text ? undefined : at;
}

const count = (n: number): string => n.toLocaleString("en-US");
const day = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** A serving Stripe state in a few words, for a refusal. */
function describe(state: PlanState): string {
  if (state.kind === "none") return "has no plan";
  return `is ${state.kind} on ${PLAN_TERMS[state.plan.id].name}`;
}

/** Run one command against a database. */
export async function runPlanCommand(args: readonly string[], db: AppTables, now: number): Promise<CommandResult> {
  const [command, accountText, ...rest] = args;
  if (command === "enterprise") {
    const accountId = positive(accountText);
    if (accountId === undefined) return usage("enterprise needs an account id");
    const given = flags(rest, ["calls", "per-minute", "from", "until"]);
    if (typeof given === "string") return usage(given);
    const callsPerPeriod = positive(given.get("calls"));
    const callsPerMinute = positive(given.get("per-minute"));
    const start = dayStart(given.get("from"));
    const end = dayStart(given.get("until"));
    if (callsPerPeriod === undefined) return usage("enterprise needs --calls, a whole number above 0");
    if (callsPerMinute === undefined) return usage("enterprise needs --per-minute, a whole number above 0");
    if (start === undefined || end === undefined) return usage("enterprise needs --from and --until, each a day YYYY-MM-DD");
    if (end <= start) return usage("--until must be after --from");
    const set = await setEnterprise(db, accountId, { callsPerPeriod, callsPerMinute }, { start, end }, now);
    if (set.outcome === "unknown") return { out: `no account ${accountId}`, status: 1 };
    if (set.outcome === "on-stripe") {
      return { out: `account ${accountId} ${describe(set.state)} through Stripe; cancel it in Stripe first`, status: 1 };
    }
    return {
      out: `account ${accountId} is on Enterprise: ${count(callsPerPeriod)} calls from ${day(start)} until ${day(end)}, ${count(callsPerMinute)} calls a minute`,
      status: 0,
    };
  }
  if (command === "end") {
    const accountId = positive(accountText);
    if (accountId === undefined || rest.length !== 0) return usage("end needs one account id");
    const ended = await endEnterprise(db, accountId, now);
    if (ended === "none") return { out: `account ${accountId} has no Enterprise plan`, status: 1 };
    return {
      out: ended === "ended" ? `ended account ${accountId}'s Enterprise plan` : `account ${accountId}'s Enterprise plan had already ended`,
      status: 0,
    };
  }
  return usage(command === undefined ? "no command" : `unknown command ${command}`);
}

if (isMain(import.meta.url)) finish(await runPlanCommand(process.argv.slice(2), seededAppDatabase(), Date.now()));
