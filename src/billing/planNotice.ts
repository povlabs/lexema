// Which account emails a plan change owes (#215), each sent once per change.
//
// The webhook's sync (./subscriptionSync.ts) leaves a subscription's row in
// Stripe's current state, but the row cannot say what changed: the Stripe
// plugin writes it from the event before the sync runs. So each subscription
// keeps a second row, `plan_notice`, holding the plan state its account was
// last emailed about. A sync compares Stripe's current state with that row,
// and the emails owed are the difference (`planEmails`). The row is moved only
// from the state it was read in, so of a replayed event, a late one and two
// arriving at once, one moves it and owes the emails, and the rest find the
// row already where Stripe is and owe nothing.

import { and, eq } from "drizzle-orm";
import type { AppDatabase } from "../db/app/database.js";
import { planNotice } from "../db/app/schema.js";
import type { AccountEmail } from "../email/accountEmail.js";
import { stateOfSubscription, type PlanState, type StripePlanId, type SubscriptionRow } from "./plans.js";

/** What an account was last emailed about one subscription: nothing yet, or a plan state's kind and its plan. */
export type PlanNotice =
  | { readonly state: "none" }
  | { readonly state: "active" | "past-due" | "cancelling" | "ended"; readonly plan: StripePlanId };

const NOTHING_YET: PlanNotice = { state: "none" };

/** What a plan state is to its account's emails: only a Stripe plan is ever emailed about, as Enterprise is set by hand. */
export function noticeOf(state: PlanState): PlanNotice {
  if (state.kind === "none" || state.plan.id === "enterprise") return NOTHING_YET;
  return { state: state.kind, plan: state.plan.id };
}

const told = (notice: PlanNotice): notice is Exclude<PlanNotice, { state: "none" }> => notice.state !== "none";

/**
 * The emails an account is owed when its subscription moves from what it was
 * last told (`before`) to `after`, in the order they are sent:
 *
 * - plan started: a plan serves that did not, or had ended;
 * - plan changed: a serving plan moved between Starter and Pro;
 * - payment failed: the plan fell past due;
 * - cancellation confirmed: the plan was cancelled, with the day it ends;
 * - plan ended: a plan that served no longer does.
 *
 * A move back, such as a failed payment paid or a cancellation withdrawn, owes
 * nothing: Stripe's own receipt covers it.
 */
export function planEmails(before: PlanNotice, after: PlanState): AccountEmail[] {
  const now = noticeOf(after);
  if (!told(now)) return [];
  const serving = told(before) && before.state !== "ended";
  if (now.state === "ended") return serving ? [{ kind: "plan-ended", plan: now.plan }] : [];
  const emails: AccountEmail[] = [];
  if (!serving) emails.push({ kind: "plan-started", plan: now.plan });
  else if (before.plan !== now.plan) emails.push({ kind: "plan-changed", from: before.plan, to: now.plan });
  if (now.state === "past-due" && before.state !== "past-due") emails.push({ kind: "payment-failed", plan: now.plan });
  if (after.kind === "cancelling" && before.state !== "cancelling") {
    emails.push({ kind: "cancellation-confirmed", plan: now.plan, endsAt: after.endsAt });
  }
  return emails;
}

const same = (a: PlanNotice, b: PlanNotice): boolean => (told(a) && told(b) ? a.state === b.state && a.plan === b.plan : a.state === b.state);

/** The notice kept for one subscription, if any. */
export const planNoticeQuery = (db: AppDatabase, stripeSubscriptionId: string) =>
  db.select({ plan: planNotice.plan, state: planNotice.state }).from(planNotice).where(eq(planNotice.stripeSubscriptionId, stripeSubscriptionId));

/** How many times the notice is read and moved before giving up: another sync moving it first costs one more try. */
const ATTEMPTS = 3;

/** A subscription as the sync just wrote it: whose it is, and its row's fields. */
export interface WrittenSubscription {
  readonly accountId: number;
  readonly snapshot: SubscriptionRow & { readonly stripeSubscriptionId: string };
}

/**
 * Record that the account is being told of its subscription's current state,
 * and answer the emails that owes, which only this call then sends. Answers
 * none when the account was already told, including by a sync running at the
 * same time. Throws when the database fails, so the webhook answers 400 and
 * Stripe retries; the notice has not moved, so the retry owes the same emails.
 */
export async function notePlanChange(db: AppDatabase, written: WrittenSubscription): Promise<AccountEmail[]> {
  const { accountId, snapshot } = written;
  const reading = stateOfSubscription(snapshot);
  if (reading.outcome !== "state") throw new Error(`a synced subscription with no plan state: ${reading.outcome} (${reading.status})`);
  const after = noticeOf(reading.state);
  if (!told(after)) return [];
  const id = snapshot.stripeSubscriptionId;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const [row] = await planNoticeQuery(db, id);
    const before: PlanNotice = row === undefined ? NOTHING_YET : { state: row.state, plan: row.plan };
    if (same(before, after)) return [];
    const moved =
      row === undefined
        ? await db.insert(planNotice).values({ stripeSubscriptionId: id, accountId, plan: after.plan, state: after.state }).onConflictDoNothing().returning({ id: planNotice.stripeSubscriptionId })
        : await db
            .update(planNotice)
            .set({ plan: after.plan, state: after.state })
            .where(and(eq(planNotice.stripeSubscriptionId, id), eq(planNotice.plan, row.plan), eq(planNotice.state, row.state)))
            .returning({ id: planNotice.stripeSubscriptionId });
    if (moved.length > 0) return planEmails(before, reading.state);
  }
  throw new Error(`the plan notice of ${id} kept moving under this sync`);
}
