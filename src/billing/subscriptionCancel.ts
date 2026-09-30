// Cancelling an account's Stripe subscriptions when the account is deleted
// (#209, Huey 2026-09-29): at once, not at the period's end, so Stripe never
// bills an account that can no longer call the API.
//
// The account's `subscription` rows (the Stripe plugin's, src/db/app/schema.ts)
// name what to cancel. A row whose status is final is done with. For every
// other row, Stripe's own state decides: a subscription Stripe already ended,
// or no longer has, needs nothing, and any other is cancelled. The row then
// takes Stripe's answer, so a second deletion reads it as done and calls
// Stripe no more; the webhook's sync (./subscriptionSync.ts) writes the same
// state when Stripe's `customer.subscription.deleted` arrives.

import { and, eq, isNotNull, notInArray } from "drizzle-orm";
import Stripe from "stripe";
import type { AppDatabase } from "../db/app/database.js";
import { subscription } from "../db/app/schema.js";
import { FINAL_STATUSES, isFinalStatus, STRIPE_STATUSES, type StripeStatus } from "./plans.js";
import type { SubscriptionSource } from "./subscriptionSync.js";

/** What deletion reaches Stripe through: the Stripe client's `subscriptions`. */
export interface SubscriptionCanceller extends SubscriptionSource {
  cancel(id: string, params?: Stripe.SubscriptionCancelParams, options?: Stripe.RequestOptions): Promise<Stripe.Subscription>;
}

/** The Stripe ids of the account's subscriptions whose rows say Stripe may still bill them. */
export const billableSubscriptionsQuery = (db: AppDatabase, accountId: number) =>
  db
    .select({ stripeSubscriptionId: subscription.stripeSubscriptionId })
    .from(subscription)
    .where(
      and(
        eq(subscription.referenceId, String(accountId)),
        isNotNull(subscription.stripeSubscriptionId),
        notInArray(subscription.status, [...FINAL_STATUSES]),
      ),
    );

const isStripeStatus = (status: string): status is StripeStatus => (STRIPE_STATUSES as readonly string[]).includes(status);

const dateOf = (seconds: number | null): Date | null => (seconds === null ? null : new Date(seconds * 1000));

/** Write Stripe's state of an ended subscription to its row. A status this code does not know is left to the webhook. */
async function writeEnded(db: AppDatabase, ended: Stripe.Subscription): Promise<void> {
  if (!isStripeStatus(ended.status)) return;
  await db
    .update(subscription)
    .set({
      status: ended.status,
      cancelAtPeriodEnd: ended.cancel_at_period_end,
      cancelAt: dateOf(ended.cancel_at),
      canceledAt: dateOf(ended.canceled_at),
      endedAt: dateOf(ended.ended_at),
    })
    .where(eq(subscription.stripeSubscriptionId, ended.id));
}

/** Whether Stripe answered that it has no such subscription. */
const isMissing = (failure: unknown): boolean => failure instanceof Stripe.errors.StripeError && failure.statusCode === 404;

/**
 * Stop Stripe billing one subscription: cancel it at once unless Stripe has
 * already ended it or has no such subscription. The cancel carries an
 * idempotency key, so a deletion running twice at once cancels once. Any other
 * failure of Stripe's throws.
 */
async function stop(db: AppDatabase, stripe: SubscriptionCanceller, id: string): Promise<void> {
  let current: Stripe.Subscription;
  try {
    current = await stripe.retrieve(id);
    if (!isFinalStatus(current.status)) current = await stripe.cancel(id, {}, { idempotencyKey: `lexema-delete-account-${id}` });
  } catch (failure) {
    if (isMissing(failure)) return;
    throw failure;
  }
  await writeEnded(db, current);
}

/**
 * Whether the account's subscriptions are stopped: none of them can bill
 * again. With billing off, the ones that may still bill are named, as nothing
 * here can cancel them; that list is never empty.
 */
export type Cancelled = { readonly outcome: "stopped" } | { readonly outcome: "billing-off"; readonly billable: readonly [string, ...string[]] };

/**
 * Stop Stripe billing every subscription of the account, before it is
 * deleted. `stripe` is `undefined` while billing is off (its settings unset):
 * an account with nothing billable needs no Stripe, and one with a billable
 * subscription is answered `billing-off`. Throws when Stripe or the database
 * fails, having stopped the subscriptions before the failure.
 */
export async function cancelSubscriptions(db: AppDatabase, stripe: SubscriptionCanceller | undefined, accountId: number): Promise<Cancelled> {
  const ids = (await billableSubscriptionsQuery(db, accountId)).flatMap((row) => (row.stripeSubscriptionId === null ? [] : [row.stripeSubscriptionId]));
  const [first, ...rest] = ids;
  if (first === undefined) return { outcome: "stopped" };
  if (stripe === undefined) return { outcome: "billing-off", billable: [first, ...rest] };
  for (const id of ids) await stop(db, stripe, id);
  return { outcome: "stopped" };
}
