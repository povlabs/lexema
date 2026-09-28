// What the dashboard on developers.lexema.fyi shows (#169, board 28), worked
// out from the account's keys, usage and profile. Pure, so the page's words
// and numbers are tested without a Worker; `Dashboard.tsx` only lays them out.

import type { AccountProfile } from "@lexema/accounts/accounts.ts";
import { PROVIDER_NAME } from "@lexema/accounts/providers.ts";
import type { OwnedKey } from "@lexema/api/ownedKeys.ts";
import type { AccountUsage } from "@lexema/api/usage.ts";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** An ISO-8601 moment or a `YYYY-MM-DD` day as the boards write a date, in UTC: `27 Sep 2026`. */
export function shortDate(iso: string): string {
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const ago = (count: number, unit: string): string => `${count} ${unit}${count === 1 ? "" : "s"} ago`;

/** When a key was last used: `never`, `just now`, `2 minutes ago`, … and past 30 days its date. */
export function lastUsed(iso: string | null, now: number): string {
  if (iso === null) return "never";
  const elapsed = Math.max(0, now - Date.parse(iso));
  if (elapsed < MINUTE) return "just now";
  if (elapsed < HOUR) return ago(Math.floor(elapsed / MINUTE), "minute");
  if (elapsed < DAY) return ago(Math.floor(elapsed / HOUR), "hour");
  if (elapsed < 30 * DAY) return ago(Math.floor(elapsed / DAY), "day");
  return shortDate(iso);
}

/** A count of units with its thousands grouped: `18,240`. */
export const units = (count: number): string => count.toLocaleString("en-US");

/** One day's bar: its day, its units, and its height as a share of the tallest day, 0 to 1. */
export interface UsageBar {
  day: string;
  units: number;
  share: number;
}

/** A row of usage: the account's total, or one key's. */
export interface UsageRow {
  bars: readonly UsageBar[];
  total: number;
}

function usageRow(days: readonly string[], perDay: readonly number[]): UsageRow {
  const tallest = Math.max(0, ...perDay);
  return {
    bars: days.map((day, i) => ({ day, units: perDay[i], share: tallest === 0 ? 0 : perDay[i] / tallest })),
    total: perDay.reduce((sum, count) => sum + count, 0),
  };
}

/** One of the account's keys as its table row shows it. */
export interface KeyRow {
  keyId: number;
  name: string;
  /** The key's leading characters, then an ellipsis. */
  prefix: string;
  created: string;
  lastUsed: string;
  /** `null` while the key is live; the date it was revoked after. */
  revoked: string | null;
  usage: UsageRow;
}

/** The whole dashboard, as the page lays it out. */
export interface DashboardView {
  email: string;
  /** `Signed in with Google · ada@example.com`. */
  signedInWith: string;
  keys: readonly KeyRow[];
  /** Every key's units added up. Each row's bars are scaled to its own tallest day; its total says how much. */
  usage: UsageRow;
  /** How many keys deleting the account revokes. */
  liveKeys: number;
}

/** The dashboard for an account's profile, keys and usage at `now`. */
export function dashboardView(profile: AccountProfile, keys: readonly OwnedKey[], usage: AccountUsage, now: number): DashboardView {
  const total = usage.total;
  const byKey = new Map(usage.keys.map((key) => [key.keyId, key.units]));
  return {
    email: profile.email,
    signedInWith: `Signed in with ${profile.providers.map((provider) => PROVIDER_NAME[provider]).join(" or ")} · ${profile.email}`,
    keys: keys.map((key) => ({
      keyId: key.keyId,
      name: key.name,
      prefix: `${key.displayPrefix}…`,
      created: shortDate(key.createdAt),
      lastUsed: lastUsed(key.lastUsedAt, now),
      revoked: key.revokedAt === null ? null : shortDate(key.revokedAt),
      usage: usageRow(usage.days, byKey.get(key.keyId) ?? usage.days.map(() => 0)),
    })),
    usage: usageRow(usage.days, total),
    liveKeys: keys.filter((key) => key.revokedAt === null).length,
  };
}

/**
 * What the delete confirmation says (#163 R1.4, board 30): "Your N API keys
 * will be revoked right away, and any app using them will stop working. This
 * can't be undone." One key reads in the singular; with none, only the last
 * sentence is true.
 */
export function deleteWarning(liveKeys: number): string {
  const undone = "This can't be undone.";
  if (liveKeys === 0) return undone;
  if (liveKeys === 1) return `Your 1 API key will be revoked right away, and any app using it will stop working. ${undone}`;
  return `Your ${liveKeys} API keys will be revoked right away, and any app using them will stop working. ${undone}`;
}
