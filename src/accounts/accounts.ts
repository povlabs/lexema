// Developer accounts and the provider identities that sign in to them (#165).
//
// An account is found by the identity signing in: first by the provider's own
// id for the person, then by verified email, so the same person signing in
// with Google and then GitHub under one email reaches one account. The first
// sign-in under an email nobody has used makes the account. Only a verified
// email ever reaches here: `verifiedIdentity` is the one way to build the
// value this module takes. better-auth carries out those rules at every live
// sign-in (./auth.ts, ADR 0017); `signInAccount` below is the same rule for a
// tool or test that needs an account without a browser.
//
// Each identity also keeps the name its provider gives the person, refreshed
// at every sign-in, for the account menu (#190). It lives on the identity, so
// the menu names the person as their first provider does.

import { and, asc, eq, sql } from "drizzle-orm";
import { revokeAllAccountKeys } from "../api/ownedKeys.js";
import { cancelSubscriptions, type SubscriptionCanceller } from "../billing/subscriptionCancel.js";
import type { AppDatabase, AppTables } from "../db/app/database.js";
import { developerAccount, developerSession, providerIdentity } from "../db/app/schema.js";
import { nameOf, PROVIDER_IDS, type ProviderId, type ProviderProfile } from "./providers.js";

/** A person a provider vouched for, with an email it says is verified. */
export interface VerifiedIdentity {
  readonly provider: ProviderId;
  readonly subject: string;
  /** Lowercased, so one address is one account however a provider spells it. */
  readonly email: string;
  /** The name the provider gives the person, or `undefined` when it gives none. */
  readonly name: string | undefined;
}

/** The identity a profile proves, or `undefined` when the provider verified no email. */
export function verifiedIdentity(provider: ProviderId, profile: ProviderProfile): VerifiedIdentity | undefined {
  const email = profile.verifiedEmail?.trim().toLowerCase() ?? "";
  if (profile.subject === "" || !/^[^@\s]+@[^@\s]+$/.test(email)) return undefined;
  return { provider, subject: profile.subject, email, name: nameOf(profile.name) };
}

/** A known identity's account, with its name refreshed to what the provider gives now. */
export const refreshIdentityQuery = (db: AppDatabase, identity: VerifiedIdentity, at: Date) =>
  db
    .update(providerIdentity)
    .set({ displayName: identity.name ?? null, updatedAt: at })
    .where(and(eq(providerIdentity.providerId, identity.provider), eq(providerIdentity.accountId, identity.subject)))
    .returning({ accountId: providerIdentity.userId });

/** The account an email belongs to: better-auth's link by email. A deleted account's email is no longer the person's. */
export const accountByEmailQuery = (db: AppDatabase, email: string) =>
  db.select({ accountId: developerAccount.id }).from(developerAccount).where(eq(developerAccount.email, email));

/** A new account under the identity's verified email. */
export const insertAccountQuery = (db: AppDatabase, identity: VerifiedIdentity, at: Date) =>
  db
    .insert(developerAccount)
    .values({ name: identity.name ?? "", email: identity.email, emailVerified: true, createdAt: at, updatedAt: at })
    .returning({ accountId: developerAccount.id });

/** The identity, linked to the account. */
export const insertIdentityQuery = (db: AppDatabase, accountId: number, identity: VerifiedIdentity, at: Date) =>
  db.insert(providerIdentity).values({
    userId: accountId,
    providerId: identity.provider,
    accountId: identity.subject,
    email: identity.email,
    displayName: identity.name ?? null,
    createdAt: at,
    updatedAt: at,
  });

/** How a sign-in reached its account. */
export type AccountMatch = "identity" | "email" | "new";

/** The account this identity signs in to, linking or creating as needed; a known identity's name is refreshed. */
export async function signInAccount(
  db: AppTables,
  identity: VerifiedIdentity,
  now: number,
): Promise<{ accountId: number; match: AccountMatch }> {
  const at = new Date(now);
  const [known] = await refreshIdentityQuery(db.app, identity, at);
  if (known !== undefined) return { accountId: known.accountId, match: "identity" };

  const [sameEmail] = await accountByEmailQuery(db.app, identity.email);
  let accountId: number;
  let match: AccountMatch;
  if (sameEmail !== undefined) {
    accountId = sameEmail.accountId;
    match = "email";
  } else {
    const [created] = await insertAccountQuery(db.app, identity, at);
    if (created === undefined) throw new Error("the new account was not stored");
    accountId = created.accountId;
    match = "new";
  }
  await insertIdentityQuery(db.app, accountId, identity, at);
  return { accountId, match };
}

/** An account's identities, in the order they were linked, through `provider_identity_by_account`. */
export const accountIdentitiesQuery = (db: AppDatabase, accountId: number) =>
  db
    .select({ provider: providerIdentity.providerId, email: providerIdentity.email, displayName: providerIdentity.displayName })
    .from(providerIdentity)
    .where(eq(providerIdentity.userId, accountId))
    .orderBy(asc(providerIdentity.id));

/** Who an account is, as the dashboard names it: a name, an email and the providers it signs in with. */
export interface AccountProfile {
  /** The email its first linked identity was verified with. */
  readonly email: string;
  /** The first name any of its identities carries, in the order they were linked, or `undefined` when none does. */
  readonly name: string | undefined;
  /** Each provider linked to the account, once, in `PROVIDER_IDS` order; never empty. */
  readonly providers: readonly [ProviderId, ...ProviderId[]];
}

/** The account's profile, or `undefined` when it has no identity: deleted, or never signed in. */
export async function accountProfile(db: AppTables, accountId: number): Promise<AccountProfile | undefined> {
  const rows = await accountIdentitiesQuery(db.app, accountId);
  const [first] = rows;
  if (first === undefined) return undefined;
  const linked = PROVIDER_IDS.filter((provider) => rows.some((row) => row.provider === provider));
  const name = rows.find((row) => row.displayName !== null)?.displayName ?? undefined;
  return { email: first.email, name, providers: linked as [ProviderId, ...ProviderId[]] };
}

/**
 * Mark an account deleted, the first time only, and replace its email and
 * name with values that say nothing about the person. The email stays unique
 * and shaped like one, as better-auth's user needs, on a domain that cannot
 * exist (RFC 2606).
 */
export const markAccountDeletedQuery = (db: AppDatabase, accountId: number, at: string) =>
  db
    .update(developerAccount)
    .set({
      deletedAt: sql`coalesce(${developerAccount.deletedAt}, ${at})`,
      updatedAt: sql`coalesce(${developerAccount.deletedAt}, ${at})`,
      email: sql`'deleted-' || ${developerAccount.id} || '@deleted.invalid'`,
      name: "",
      image: null,
    })
    .where(eq(developerAccount.id, accountId))
    .returning({ accountId: developerAccount.id });

/** End every session of the account. */
export const deleteAccountSessionsQuery = (db: AppDatabase, accountId: number) =>
  db.delete(developerSession).where(eq(developerSession.userId, accountId));

/** Unlink every provider identity of the account. */
export const deleteAccountIdentitiesQuery = (db: AppDatabase, accountId: number) =>
  db.delete(providerIdentity).where(eq(providerIdentity.userId, accountId));

/** What deleting an account did. */
export type AccountDeletion =
  | { readonly outcome: "deleted"; readonly revokedKeys: number }
  /** No account has this id. */
  | { readonly outcome: "unknown" }
  /** A subscription of the account may still bill and billing is off, so nothing changed. Never empty. */
  | { readonly outcome: "billing-off"; readonly billable: readonly [string, ...string[]] };

/**
 * Delete an account (#163 R1.4): stop Stripe billing it, revoke every key it
 * owns, end its sessions and unlink its provider identities. The row stays,
 * marked deleted and with nothing personal in it, so its revoked keys and
 * their usage keep an owner; signing in again with the same email makes a new
 * account. This stays Lexema's: better-auth's own `deleteUser` removes the row
 * (ADR 0017).
 *
 * First every subscription Stripe may still bill is cancelled at once, not at
 * the period's end (#209, src/billing/subscriptionCancel.ts). `stripe` is
 * `undefined` while billing is off; an account with a subscription that may
 * still bill is then answered `billing-off` and left as it was. A Stripe
 * failure throws before the account changes, so the developer can try again.
 *
 * The four statements that follow run as one batch, which is one transaction,
 * so a deletion that fails leaves the account exactly as it was, still signed
 * in and with its keys live, and one that succeeds leaves no session or
 * identity that could reach it. Running it again on a deleted account changes
 * nothing, calls Stripe for nothing already cancelled, and keeps the first
 * time. Answers the number of keys it revoked.
 */
export async function deleteAccount(
  db: AppTables,
  accountId: number,
  now: number,
  stripe: SubscriptionCanceller | undefined,
): Promise<AccountDeletion> {
  const cancelled = await cancelSubscriptions(db.app, stripe, accountId);
  if (cancelled.outcome === "billing-off") return cancelled;
  const [marked, revoked] = await db.app.batch([
    markAccountDeletedQuery(db.app, accountId, new Date(now).toISOString()),
    revokeAllAccountKeys(db.app, accountId, now),
    deleteAccountSessionsQuery(db.app, accountId),
    deleteAccountIdentitiesQuery(db.app, accountId),
  ]);
  if (marked.length === 0) return { outcome: "unknown" };
  return { outcome: "deleted", revokedKeys: revoked.length };
}
