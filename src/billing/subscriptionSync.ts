// Keeping an account's `subscription` row in step with Stripe (#262).
//
// The Stripe plugin's webhook (src/accounts/billing.ts) verifies each event
// and runs its own handlers, which write what the event carries: an older
// `customer.subscription.updated` arriving late would overwrite a newer state,
// and a failed write is logged and answered 200, so Stripe never retries
// (#200 R2.1). So for every event that concerns a subscription, this module
// reads the subscription back from Stripe and writes that snapshot to its row.
// Replays and late events then end in Stripe's current state, and a failed
// write throws, which the plugin answers with a 400 so Stripe tries again.
//
// A suspended account keeps no plan (#578): a subscription that may still bill
// for one, such as one made by a Checkout paid just before the suspension
// closed it, is cancelled at once, through deletion's own path
// (./subscriptionCancel.ts), and the account is told nothing of it.

import { and, eq, isNull, or } from "drizzle-orm";
import type Stripe from "stripe";
import type { AppDatabase } from "../db/app/database.js";
import { accountSuspensionQuery, isSuspended } from "../accounts/suspension.js";
import { developerAccount, subscription } from "../db/app/schema.js";
import { isFinalStatus, STRIPE_STATUSES, type StripePlanId, type StripeStatus } from "./plans.js";
import { stopSubscription, type SubscriptionCanceller } from "./subscriptionCancel.js";

/** The Stripe price each plan is bought at: `STRIPE_PRICE_STARTER` and `STRIPE_PRICE_PRO`. */
export type PlanPrices = Readonly<Record<StripePlanId, string>>;

/** The events whose subscription is read back and written (#161): every other event changes nothing. */
export const SYNCED_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
] as const satisfies readonly Stripe.Event.Type[];

/** The id of a Stripe object that may be expanded in place. */
const idOf = (value: string | { id: string }): string => (typeof value === "string" ? value : value.id);

/**
 * The Stripe subscription an event is about, or `undefined` when it is about
 * none: an event this module does not sync, a Checkout that made no
 * subscription, or an invoice no subscription billed. On the API version
 * stripe-node 22.6.2 pins, an invoice names its subscription under
 * `parent.subscription_details`.
 */
export function subscriptionNamedBy(event: Stripe.Event): string | undefined {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      return session.mode === "subscription" && session.subscription !== null ? idOf(session.subscription) : undefined;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return event.data.object.id;
    case "invoice.paid":
    case "invoice.payment_failed": {
      const billed = event.data.object.parent?.subscription_details?.subscription;
      return billed === undefined ? undefined : idOf(billed);
    }
    default:
      return undefined;
  }
}

/** A subscription as its row holds it: the fields this module writes. */
export interface SubscriptionSnapshot {
  readonly stripeSubscriptionId: string;
  readonly stripeCustomerId: string;
  readonly plan: StripePlanId;
  readonly status: StripeStatus;
  /** The plan item's current period (#200 R1.3). */
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly cancelAtPeriodEnd: boolean;
  /** Stripe's `cancel_at`: when a cancelled plan stops serving. */
  readonly cancelAt: Date | null;
  readonly canceledAt: Date | null;
  readonly endedAt: Date | null;
}

const dateOf = (seconds: number | null): Date | null => (seconds === null ? null : new Date(seconds * 1000));

/**
 * What a subscription's row should hold, or why it holds nothing: none of its
 * items is bought at a plan's price, so it is not one of Lexema's plans, or
 * Stripe sent a status this code does not know, which is refused, never guessed.
 */
export type SnapshotReading =
  | { readonly outcome: "snapshot"; readonly snapshot: SubscriptionSnapshot }
  | { readonly outcome: "not-a-plan" }
  | { readonly outcome: "unknown-status"; readonly status: string };

const isStripeStatus = (status: string): status is StripeStatus => (STRIPE_STATUSES as readonly string[]).includes(status);

/** Read a Stripe subscription as its row should hold it. */
export function snapshotOf(stripe: Stripe.Subscription, prices: PlanPrices): SnapshotReading {
  const plans = Object.entries(prices) as [StripePlanId, string][];
  for (const item of stripe.items.data) {
    const plan = plans.find(([, price]) => price === item.price.id)?.[0];
    if (plan === undefined) continue;
    if (!isStripeStatus(stripe.status)) return { outcome: "unknown-status", status: stripe.status };
    const snapshot: SubscriptionSnapshot = {
      stripeSubscriptionId: stripe.id,
      stripeCustomerId: idOf(stripe.customer),
      plan,
      status: stripe.status,
      periodStart: new Date(item.current_period_start * 1000),
      periodEnd: new Date(item.current_period_end * 1000),
      cancelAtPeriodEnd: stripe.cancel_at_period_end,
      cancelAt: dateOf(stripe.cancel_at),
      canceledAt: dateOf(stripe.canceled_at),
      endedAt: dateOf(stripe.ended_at),
    };
    return { outcome: "snapshot", snapshot };
  }
  return { outcome: "not-a-plan" };
}

/**
 * The row a Checkout the plugin started made for this subscription, as the
 * plugin names it in the subscription's metadata: its own row id and the
 * account it is for.
 */
function checkoutRowOf(metadata: Stripe.Metadata): { id: number; referenceId: string } | undefined {
  const id = Number(metadata.subscriptionId);
  const referenceId = metadata.referenceId;
  return Number.isSafeInteger(id) && id > 0 && typeof referenceId === "string" ? { id, referenceId } : undefined;
}

/** The row a subscription is kept in: the one already linked to it, else the one its Checkout started with. */
const subscriptionRowQuery = (db: AppDatabase, stripeSubscriptionId: string, checkout: { id: number; referenceId: string } | undefined) =>
  db
    .select({ id: subscription.id, referenceId: subscription.referenceId, stripeSubscriptionId: subscription.stripeSubscriptionId })
    .from(subscription)
    .where(
      or(
        eq(subscription.stripeSubscriptionId, stripeSubscriptionId),
        checkout === undefined ? undefined : and(eq(subscription.id, checkout.id), eq(subscription.referenceId, checkout.referenceId)),
      ),
    );

/** What syncing one event did. */
export type SyncOutcome =
  /** The event is about no subscription: nothing was read or written. */
  | { readonly outcome: "not-synced" }
  /** The subscription is bought at no plan's price: nothing was written. */
  | { readonly outcome: "not-a-plan"; readonly stripeSubscriptionId: string }
  /** Stripe sent a status this code does not know: nothing was written. */
  | { readonly outcome: "unknown-status"; readonly stripeSubscriptionId: string; readonly status: string }
  /** No row is kept for the subscription: it was not started by a Checkout here, nor made for a known customer. */
  | { readonly outcome: "no-row"; readonly stripeSubscriptionId: string }
  /** The row now holds Stripe's current state. */
  | { readonly outcome: "written"; readonly accountId: number; readonly snapshot: SubscriptionSnapshot }
  /** The account is suspended, so the subscription was cancelled at once and its row holds Stripe's ended state. */
  | { readonly outcome: "stopped-suspended"; readonly accountId: number; readonly stripeSubscriptionId: string };

/** How a subscription is read back from Stripe. */
export interface SubscriptionSource {
  retrieve(id: string): Promise<Stripe.Subscription>;
}

/**
 * Read the subscription an event is about back from Stripe and write it to its
 * row, linking its Stripe customer to the account when the account has none.
 * Both writes are one batch. When the account is suspended and the
 * subscription may still bill, it is then cancelled at once. Throws when
 * Stripe or the database fails, so the webhook answers 400 and Stripe retries.
 */
export async function syncSubscription(db: AppDatabase, source: SubscriptionCanceller, prices: PlanPrices, event: Stripe.Event): Promise<SyncOutcome> {
  const stripeSubscriptionId = subscriptionNamedBy(event);
  if (stripeSubscriptionId === undefined) return { outcome: "not-synced" };
  const current = await source.retrieve(stripeSubscriptionId);
  const reading = snapshotOf(current, prices);
  if (reading.outcome === "not-a-plan") return { outcome: "not-a-plan", stripeSubscriptionId };
  if (reading.outcome === "unknown-status") return { outcome: "unknown-status", stripeSubscriptionId, status: reading.status };
  const { snapshot } = reading;
  const rows = await subscriptionRowQuery(db, stripeSubscriptionId, checkoutRowOf(current.metadata));
  const row = rows.find((candidate) => candidate.stripeSubscriptionId === stripeSubscriptionId) ?? rows[0];
  if (row === undefined) return { outcome: "no-row", stripeSubscriptionId };
  const accountId = Number(row.referenceId);
  await db.batch([
    db.update(subscription).set(snapshot).where(eq(subscription.id, row.id)),
    db
      .update(developerAccount)
      .set({ stripeCustomerId: snapshot.stripeCustomerId })
      .where(and(eq(developerAccount.id, accountId), isNull(developerAccount.stripeCustomerId))),
  ]);
  if (!isFinalStatus(snapshot.status)) {
    const [owner] = await accountSuspensionQuery(db, accountId);
    if (owner !== undefined && isSuspended(owner)) {
      await stopSubscription(db, source, stripeSubscriptionId);
      return { outcome: "stopped-suspended", accountId, stripeSubscriptionId };
    }
  }
  return { outcome: "written", accountId, snapshot };
}
