// Suspending a developer account, and lifting it (#573, Huey 2026-10-04).
//
// A suspended account still signs in, as the same person through the same
// identities (./auth.ts is unchanged), but sees only a card saying so, with
// Delete account. Its keys stay as they are and are refused while it lasts
// (src/api/keys.ts); every dashboard and billing action but deletion and
// signing out is refused (web/worker/developers/). Lifting it makes the same
// keys answer again.
//
// Suspending also stops Stripe: every subscription that may still bill is
// cancelled at once, through deletion's own path (src/billing/subscriptionCancel.ts),
// and each card on the account's Stripe customer is put on a Radar block list,
// so the same card cannot pay from a new account. Lifting takes off the items
// the suspension put there and leaves the subscriptions cancelled. No address
// of any kind is read or kept.
//
// Both are run by hand (`pnpm run account`, ./accountCli.ts) and both are
// idempotent: a second run keeps the first suspension's time and reason, and
// finishes whatever Stripe step an earlier run could not.

import { and, eq, isNotNull, isNull, ne } from "drizzle-orm";
import Stripe from "stripe";
import { cancelSubscriptions, type Cancelled, type SubscriptionCanceller } from "../billing/subscriptionCancel.js";
import type { AppDatabase, AppTables } from "../db/app/database.js";
import { developerAccount, suspensionCardBlock } from "../db/app/schema.js";

/** The longest reason a suspension keeps, as the table's CHECK holds it. */
export const SUSPENSION_REASON_MAX = 500;

declare const reasonBrand: unique symbol;
/** Why an account is suspended: trimmed, 1 to 500 characters. Only `suspensionReasonOf` makes one. */
export type SuspensionReason = string & { readonly [reasonBrand]: true };

/** The reason `text` gives, trimmed, or `undefined` when it is empty or longer than the table keeps. */
export function suspensionReasonOf(text: string): SuspensionReason | undefined {
  const reason = text.trim();
  return reason.length >= 1 && reason.length <= SUSPENSION_REASON_MAX ? (reason as SuspensionReason) : undefined;
}

/** One suspension: when it began and why. An account has one, or none. */
export interface Suspension {
  readonly since: Date;
  readonly reason: SuspensionReason;
}

/** The two columns as stored. The table's CHECK sets both or neither. */
interface SuspensionColumns {
  readonly suspendedAt: Date | null;
  readonly suspensionReason: string | null;
}

/** The suspension two stored columns hold, or `undefined` for none. */
function suspensionOf({ suspendedAt, suspensionReason }: SuspensionColumns): Suspension | undefined {
  if (suspendedAt === null && suspensionReason === null) return undefined;
  const reason = suspensionReason === null ? undefined : suspensionReasonOf(suspensionReason);
  if (suspendedAt === null || reason === undefined) throw new Error("a suspension is stored half set");
  return { since: suspendedAt, reason };
}

/** An account's suspension columns, and whether it is deleted, by its primary key. */
export const accountSuspensionQuery = (db: AppDatabase, accountId: number) =>
  db
    .select({
      suspendedAt: developerAccount.suspendedAt,
      suspensionReason: developerAccount.suspensionReason,
      deletedAt: developerAccount.deletedAt,
      stripeCustomerId: developerAccount.stripeCustomerId,
    })
    .from(developerAccount)
    .where(eq(developerAccount.id, accountId));

/** The account's suspension, or `undefined` while it has none or there is no such account. */
export async function accountSuspension(db: AppTables, accountId: number): Promise<Suspension | undefined> {
  const [row] = await accountSuspensionQuery(db.app, accountId);
  return row === undefined ? undefined : suspensionOf(row);
}

/** Whether a key's owner, read with the key (src/api/keys.ts), is suspended. */
export const isSuspended = (columns: SuspensionColumns): boolean => suspensionOf(columns) !== undefined;

/** Suspend an account that is neither deleted nor suspended yet. Only the first suspension gets a row back. */
export const suspendQuery = (db: AppDatabase, accountId: number, suspension: Suspension) =>
  db
    .update(developerAccount)
    .set({ suspendedAt: suspension.since, suspensionReason: suspension.reason })
    .where(and(eq(developerAccount.id, accountId), isNull(developerAccount.suspendedAt), isNull(developerAccount.deletedAt)))
    .returning({ accountId: developerAccount.id });

/** Lift a suspension. Only a suspended account gets a row back. */
export const liftQuery = (db: AppDatabase, accountId: number) =>
  db
    .update(developerAccount)
    .set({ suspendedAt: null, suspensionReason: null })
    .where(and(eq(developerAccount.id, accountId), isNotNull(developerAccount.suspendedAt)))
    .returning({ accountId: developerAccount.id });

// ---------------------------------------------------------------------------
// Stripe: the parts of the Stripe client a suspension reaches
// ---------------------------------------------------------------------------

/** The cards on a Stripe customer: the client's `customers.listPaymentMethods`. */
export interface CardSource {
  listPaymentMethods(customer: string, params: { type: "card" }): AsyncIterable<{ readonly card?: { readonly fingerprint?: string | null } | null }>;
}

/** The items of a Radar value list: the client's `radar.valueListItems`. */
export interface RadarItems {
  list(params: { value_list: string; value: string }): PromiseLike<{ readonly data: readonly { readonly id: string; readonly value: string }[] }>;
  create(params: { value_list: string; value: string }): PromiseLike<{ readonly id: string }>;
  del(id: string): PromiseLike<unknown>;
}

/** What a suspension reaches Stripe through; a Stripe client is one. */
export interface SuspensionStripe {
  readonly subscriptions: SubscriptionCanceller;
  readonly customers: CardSource;
  readonly radar: { readonly valueListItems: RadarItems };
}

/**
 * How a suspension reaches Stripe: the client, `undefined` while billing is
 * off, and the Radar block list its cards go on, `undefined` while none is
 * configured. The list's type must be `card_fingerprint`; this code never
 * makes one.
 */
export interface SuspensionReach {
  readonly stripe: SuspensionStripe | undefined;
  readonly blockList: string | undefined;
}

/** Why the Radar step did nothing: no block list is configured, or billing is off. */
export type RadarSkip = "no-block-list" | "billing-off";

/** What suspending did to the account's cards. */
export type CardBlocking =
  | { readonly kind: "skipped"; readonly why: RadarSkip }
  /** `cards`: the account's distinct cards, each now on the list. */
  | { readonly kind: "blocked"; readonly cards: number };

/** What lifting did to the items its suspension added. */
export type CardUnblocking =
  /** Billing is off, so the `left` items stay on the list until a run with Stripe. Never 0. */
  | { readonly kind: "skipped"; readonly why: "billing-off"; readonly left: number }
  /** `removed` items left the list; `shared` stay for another suspended account that paid with the same card. */
  | { readonly kind: "unblocked"; readonly removed: number; readonly shared: number };

/** The items this account's suspension added, through the table's primary key. */
export const accountCardBlocksQuery = (db: AppDatabase, accountId: number) =>
  db
    .select({ valueListItemId: suspensionCardBlock.valueListItemId, cardFingerprint: suspensionCardBlock.cardFingerprint })
    .from(suspensionCardBlock)
    .where(eq(suspensionCardBlock.accountId, accountId));

/** Another account's row for this item, through `suspension_card_block_by_item`. */
export const otherHoldersQuery = (db: AppDatabase, valueListItemId: string, accountId: number) =>
  db
    .select({ accountId: suspensionCardBlock.accountId })
    .from(suspensionCardBlock)
    .where(and(eq(suspensionCardBlock.valueListItemId, valueListItemId), ne(suspensionCardBlock.accountId, accountId)))
    .limit(1);

/** Any suspension's row for this item, through `suspension_card_block_by_item`. */
export const anyHolderQuery = (db: AppDatabase, valueListItemId: string) =>
  db.select({ accountId: suspensionCardBlock.accountId }).from(suspensionCardBlock).where(eq(suspensionCardBlock.valueListItemId, valueListItemId)).limit(1);

/** Record that this account's suspension holds the item; a second record of it changes nothing. */
export const holdItemQuery = (db: AppDatabase, accountId: number, valueListItemId: string, cardFingerprint: string) =>
  db.insert(suspensionCardBlock).values({ accountId, valueListItemId, cardFingerprint }).onConflictDoNothing();

/** Forget that this account's suspension holds the item. */
export const releaseItemQuery = (db: AppDatabase, accountId: number, valueListItemId: string) =>
  db.delete(suspensionCardBlock).where(and(eq(suspensionCardBlock.accountId, accountId), eq(suspensionCardBlock.valueListItemId, valueListItemId)));

/** The distinct fingerprints of the cards on a Stripe customer, in Stripe's order. */
async function cardFingerprints(cards: CardSource, customer: string): Promise<string[]> {
  const fingerprints: string[] = [];
  for await (const method of cards.listPaymentMethods(customer, { type: "card" })) {
    const fingerprint = method.card?.fingerprint;
    if (typeof fingerprint === "string" && fingerprint !== "" && !fingerprints.includes(fingerprint)) fingerprints.push(fingerprint);
  }
  return fingerprints;
}

/**
 * Put each card of the customer on the block list, and record the items this
 * suspension holds. A card already on the list stays: when another
 * suspension added it, this one holds it too; when nothing here added it,
 * someone put it there by hand, and lifting must not take it off, so it is
 * not recorded.
 */
async function blockCards(db: AppDatabase, stripe: SuspensionStripe, blockList: string, accountId: number, customer: string | null): Promise<CardBlocking> {
  const fingerprints = customer === null ? [] : await cardFingerprints(stripe.customers, customer);
  const items = stripe.radar.valueListItems;
  for (const fingerprint of fingerprints) {
    // Stripe matches `value` loosely, so the item is the one whose value is exactly the fingerprint.
    const listed = (await items.list({ value_list: blockList, value: fingerprint })).data.find((item) => item.value === fingerprint);
    if (listed === undefined) {
      const created = await items.create({ value_list: blockList, value: fingerprint });
      await holdItemQuery(db, accountId, created.id, fingerprint);
    } else if ((await anyHolderQuery(db, listed.id)).length > 0) {
      await holdItemQuery(db, accountId, listed.id, fingerprint);
    }
  }
  return { kind: "blocked", cards: fingerprints.length };
}

/** Whether Stripe answered that it has no such object. */
const isMissing = (failure: unknown): boolean => failure instanceof Stripe.errors.StripeError && failure.statusCode === 404;

/**
 * Take off the list each item this account's suspension holds, unless another
 * suspended account holds it too, and forget each. An item Stripe no longer
 * has is already off. Each row goes only once its item is off, so a run that
 * fails part way leaves the rest for the next.
 */
async function unblockCards(db: AppDatabase, stripe: SuspensionStripe | undefined, accountId: number): Promise<CardUnblocking> {
  const held = await accountCardBlocksQuery(db, accountId);
  if (stripe === undefined && held.length > 0) return { kind: "skipped", why: "billing-off", left: held.length };
  let removed = 0;
  let shared = 0;
  for (const { valueListItemId } of held) {
    if ((await otherHoldersQuery(db, valueListItemId, accountId)).length > 0) {
      shared += 1;
    } else {
      try {
        await stripe?.radar.valueListItems.del(valueListItemId);
      } catch (failure) {
        if (!isMissing(failure)) throw failure;
      }
      removed += 1;
    }
    await releaseItemQuery(db, accountId, valueListItemId);
  }
  return { kind: "unblocked", removed, shared };
}

// ---------------------------------------------------------------------------
// Suspend and lift
// ---------------------------------------------------------------------------

/** What suspending an account did. */
export type Suspending =
  | {
      readonly outcome: "suspended";
      /** The suspension in force: this one, or the first one when the account already was. */
      readonly suspension: Suspension;
      /** Whether the account was already suspended before this run. */
      readonly already: boolean;
      readonly subscriptions: Cancelled;
      readonly cards: CardBlocking;
    }
  /** No account has this id. */
  | { readonly outcome: "unknown" }
  /** The account is deleted: it has no keys or sessions to stop. */
  | { readonly outcome: "deleted" };

/**
 * Suspend an account at `now` for `reason`. The suspension is stored first, so
 * its keys stop at once whatever Stripe does next. Then every subscription
 * that may still bill is cancelled at once, and each of its cards goes on the
 * block list. A Stripe failure throws with the account already suspended; a
 * second run keeps that suspension and finishes the rest.
 */
export async function suspendAccount(db: AppTables, accountId: number, reason: SuspensionReason, now: number, reach: SuspensionReach): Promise<Suspending> {
  const [stored] = await suspendQuery(db.app, accountId, { since: new Date(now), reason });
  const [row] = await accountSuspensionQuery(db.app, accountId);
  if (row === undefined) return { outcome: "unknown" };
  const suspension = suspensionOf(row);
  if (suspension === undefined) return { outcome: "deleted" };
  const subscriptions = await cancelSubscriptions(db.app, reach.stripe?.subscriptions, accountId);
  let cards: CardBlocking;
  if (reach.blockList === undefined) cards = { kind: "skipped", why: "no-block-list" };
  else if (reach.stripe === undefined) cards = { kind: "skipped", why: "billing-off" };
  else cards = await blockCards(db.app, reach.stripe, reach.blockList, accountId, row.stripeCustomerId);
  return { outcome: "suspended", suspension, already: stored === undefined, subscriptions, cards };
}

/** What lifting a suspension did. */
export type Lifting =
  /** `already`: the account was not suspended before this run. */
  | { readonly outcome: "lifted"; readonly already: boolean; readonly cards: CardUnblocking }
  /** No account has this id. */
  | { readonly outcome: "unknown" };

/**
 * Lift an account's suspension: its keys answer again, and the cards its
 * suspension put on the block list come off. Its cancelled subscriptions stay
 * cancelled. Lifting an account that is not suspended changes nothing but
 * whatever card items an earlier lift could not take off.
 */
export async function liftSuspension(db: AppTables, accountId: number, stripe: SuspensionStripe | undefined): Promise<Lifting> {
  const [lifted] = await liftQuery(db.app, accountId);
  if (lifted === undefined && (await accountSuspensionQuery(db.app, accountId)).length === 0) return { outcome: "unknown" };
  return { outcome: "lifted", already: lifted === undefined, cards: await unblockCards(db.app, stripe, accountId) };
}
