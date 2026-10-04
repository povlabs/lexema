// `pnpm run account`: suspend a developer account, and lift it, in the local app database (#573).
//
//   pnpm run account suspend 3 --reason "Resold the API."
//   pnpm run account lift 3
//
// What each does is ./suspension.ts. Stripe is reached with
// `STRIPE_SECRET_KEY` from the environment, and the Radar block list the
// account's cards go on is `STRIPE_RADAR_BLOCK_LIST`, a `card_fingerprint`
// value list's id (`rsl_…`) made in the Stripe Dashboard; this command never
// makes one. Without the list the Radar step is skipped and says so. Without
// the key, a subscription that may still bill is named and the command fails,
// with the account suspended all the same. Both commands can be run again: a
// second run changes nothing done and finishes what an earlier one could not.
// The database is the local `APP_DB` the dev seed migrates, as
// `pnpm run plan` reaches it.

import { finish, flags, isMain, positive, usageError, type CommandResult } from "../commandLine.js";
import type { AppTables } from "../db/app/database.js";
import { seededAppDatabase } from "../db/localD1.js";
import { stripeClient } from "./billing.js";
import { liftSuspension, suspendAccount, suspensionReasonOf, SUSPENSION_REASON_MAX, type CardBlocking, type CardUnblocking, type SuspensionReach } from "./suspension.js";

const USAGE = `usage:
  pnpm run account suspend <account id> --reason <text>
  pnpm run account lift <account id>`;

const usage = (problem: string): CommandResult => usageError(problem, USAGE);

/** The environment the command reads Stripe from. */
export interface AccountEnvironment {
  readonly STRIPE_SECRET_KEY?: string;
  readonly STRIPE_RADAR_BLOCK_LIST?: string;
}

/** How the command reaches Stripe from its environment. Blank counts as unset. */
export function reachOf(env: AccountEnvironment): SuspensionReach {
  const secret = env.STRIPE_SECRET_KEY?.trim() ?? "";
  const list = env.STRIPE_RADAR_BLOCK_LIST?.trim() ?? "";
  return { stripe: secret === "" ? undefined : stripeClient(secret), blockList: list === "" ? undefined : list };
}

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

function blockingLine(cards: CardBlocking): string {
  if (cards.kind === "blocked") return `Radar: ${plural(cards.cards, "card is", "cards are")} on the block list`;
  return `Radar step skipped: ${cards.why === "no-block-list" ? "STRIPE_RADAR_BLOCK_LIST" : "STRIPE_SECRET_KEY"} is not set`;
}

function unblockingLine(cards: CardUnblocking): string {
  if (cards.kind === "skipped") return `Radar: ${plural(cards.left, "item stays", "items stay")} on the block list, as STRIPE_SECRET_KEY is not set; run this again with it set`;
  const shared = cards.shared === 0 ? "" : `; ${plural(cards.shared, "item stays", "items stay")} for another suspended account with the same card`;
  return `Radar: ${plural(cards.removed, "item", "items")} taken off the block list${shared}`;
}

async function suspend(accountId: number, reasonText: string, db: AppTables, now: number, reach: SuspensionReach): Promise<CommandResult> {
  const reason = suspensionReasonOf(reasonText);
  if (reason === undefined) return usage(`suspend needs --reason, 1 to ${SUSPENSION_REASON_MAX} characters`);
  const done = await suspendAccount(db, accountId, reason, now, reach);
  if (done.outcome === "unknown") return { out: `no account ${accountId}`, status: 1 };
  if (done.outcome === "deleted") return { out: `account ${accountId} is deleted; there is nothing to suspend`, status: 1 };
  const { since, reason: inForce } = done.suspension;
  const lines = [
    done.already ? `account ${accountId} was already suspended on ${since.toISOString()}: ${inForce}` : `suspended account ${accountId}: ${inForce}`,
  ];
  const billing = done.subscriptions;
  if (billing.outcome === "billing-off") {
    lines.push(`Stripe: ${plural(billing.billable.length, "subscription", "subscriptions")} may still bill (${billing.billable.join(", ")}), as STRIPE_SECRET_KEY is not set; cancel them in Stripe, or run this again with it set`);
  } else {
    lines.push("Stripe: no subscription can bill the account");
  }
  lines.push(blockingLine(done.cards));
  return { out: lines.join("\n"), status: billing.outcome === "billing-off" ? 1 : 0 };
}

async function lift(accountId: number, db: AppTables, reach: SuspensionReach): Promise<CommandResult> {
  const done = await liftSuspension(db, accountId, reach.stripe);
  if (done.outcome === "unknown") return { out: `no account ${accountId}`, status: 1 };
  const first = done.already ? `account ${accountId} was not suspended` : `lifted account ${accountId}'s suspension; its keys answer again`;
  return { out: [first, unblockingLine(done.cards)].join("\n"), status: done.cards.kind === "skipped" ? 1 : 0 };
}

/** Run one command against a database, reaching Stripe as `reach` says. */
export async function runAccountCommand(args: readonly string[], db: AppTables, now: number, reach: SuspensionReach): Promise<CommandResult> {
  const [command, accountText, ...rest] = args;
  try {
    if (command === "suspend") {
      const accountId = positive(accountText);
      if (accountId === undefined) return usage("suspend needs an account id");
      const given = flags(rest, ["reason"]);
      if (typeof given === "string") return usage(given);
      return await suspend(accountId, given.get("reason") ?? "", db, now, reach);
    }
    if (command === "lift") {
      const accountId = positive(accountText);
      if (accountId === undefined || rest.length !== 0) return usage("lift needs one account id");
      return await lift(accountId, db, reach);
    }
  } catch (failure) {
    // For Huey, not a reader: the cause is printed whole.
    const cause = failure instanceof Error ? failure.message : String(failure);
    return { out: `${command} stopped part way: ${cause}\nWhat is done stays done; run the same command again to finish.`, status: 1 };
  }
  return usage(command === undefined ? "no command" : `unknown command ${command}`);
}

if (isMain(import.meta.url)) {
  const { STRIPE_SECRET_KEY, STRIPE_RADAR_BLOCK_LIST } = process.env;
  finish(await runAccountCommand(process.argv.slice(2), seededAppDatabase(), Date.now(), reachOf({ STRIPE_SECRET_KEY, STRIPE_RADAR_BLOCK_LIST })));
}
