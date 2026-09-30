// What an API key may reach, and until when (#187): every endpoint or only
// some of them, and an expiry. A key limited to some endpoints is answered 403
// on any other; a key past its expiry is refused like a revoked one
// (web/worker/api/handler.ts, src/api/keys.ts).
//
// Stored on the key's row as `endpoints` and `expires_at` (src/db/schema.sql),
// both NULL for a key made before #187: every endpoint, never expiring.

import { ENDPOINTS, type Endpoint } from "./calls.js";

/**
 * The endpoints a key may call: all of them, or only the listed ones. The list
 * is never empty, holds each endpoint once, and follows `ENDPOINTS`' order;
 * `onlyEndpoints` is the only way to make one.
 */
export type EndpointScope = { readonly kind: "all" } | { readonly kind: "only"; readonly endpoints: readonly [Endpoint, ...Endpoint[]] };

export const ALL_ENDPOINTS: EndpointScope = { kind: "all" };

const isEndpoint = (name: string): name is Endpoint => (ENDPOINTS as readonly string[]).includes(name);

/** A scope of exactly these endpoints, or `undefined` when the list is empty or names anything that is not an endpoint. */
export function onlyEndpoints(names: Iterable<string>): EndpointScope | undefined {
  const named = new Set(names);
  if (named.size === 0 || ![...named].every(isEndpoint)) return undefined;
  const [first, ...rest] = ENDPOINTS.filter((endpoint) => named.has(endpoint));
  return { kind: "only", endpoints: [first, ...rest] };
}

/** Whether a key with this scope may call the endpoint. */
export const allows = (scope: EndpointScope, endpoint: Endpoint): boolean =>
  scope.kind === "all" || scope.endpoints.includes(endpoint);

/** The scope as `api_key.endpoints` stores it: NULL for every endpoint, else a JSON array. */
export const endpointsColumn = (scope: EndpointScope): string | null =>
  scope.kind === "all" ? null : JSON.stringify(scope.endpoints);

/** The scope `api_key.endpoints` holds. A value no key could have been given is an error, never a wider scope. */
export function endpointsOfColumn(stored: string | null): EndpointScope {
  if (stored === null) return ALL_ENDPOINTS;
  const names: unknown = JSON.parse(stored);
  const scope = Array.isArray(names) && names.every((name) => typeof name === "string") ? onlyEndpoints(names) : undefined;
  if (scope === undefined) throw new Error(`api_key.endpoints holds no endpoint list: ${stored}`);
  return scope;
}

/** How long a new key lasts, as the create-key dialog offers it (board 28b): Never by default. */
export const KEY_LIFETIMES = ["never", "30-days", "90-days", "1-year"] as const;
export type KeyLifetime = (typeof KEY_LIFETIMES)[number];

/** Each lifetime as the dialog names it. */
export const LIFETIME_LABEL: Readonly<Record<KeyLifetime, string>> = {
  never: "Never",
  "30-days": "30 days",
  "90-days": "90 days",
  "1-year": "1 year",
};

/** The lifetime a form sent, or `undefined` for anything the dialog does not offer. */
export const keyLifetime = (sent: string): KeyLifetime | undefined => KEY_LIFETIMES.find((lifetime) => lifetime === sent);

const DAY_MS = 24 * 60 * 60 * 1000;

/** When a key made at `now` with this lifetime expires, ISO-8601, or `null` for never. A year is a calendar year, UTC. */
export function expiresAt(lifetime: KeyLifetime, now: number): string | null {
  switch (lifetime) {
    case "never":
      return null;
    case "30-days":
      return new Date(now + 30 * DAY_MS).toISOString();
    case "90-days":
      return new Date(now + 90 * DAY_MS).toISOString();
    case "1-year": {
      const date = new Date(now);
      date.setUTCFullYear(date.getUTCFullYear() + 1);
      return date.toISOString();
    }
  }
}

/** What a new key may reach and until when. */
export interface KeyAccess {
  endpoints: EndpointScope;
  /** ISO-8601; `null` for a key that never expires. */
  expiresAt: string | null;
}

/** Every endpoint, never expiring: an admin key's access, and what a key made before #187 has. */
export const OPEN_ACCESS: KeyAccess = { endpoints: ALL_ENDPOINTS, expiresAt: null };
