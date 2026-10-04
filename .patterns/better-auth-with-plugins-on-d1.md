# Better Auth with plugins on D1

How [`src/accounts/auth.ts`](../src/accounts/auth.ts) builds better-auth over the
app tables in D1, and how a plugin joins it; applies to every route that signs in,
reads a session or calls Stripe through better-auth.

Adapted from phoenix's [better-auth-with-plugins-on-d1](https://github.com/kamp-us/phoenix/blob/main/.patterns/better-auth-with-plugins-on-d1.md).

## The shape

One function, `baseOptions(db, secret, origin)`, holds what better-auth is told
whatever the request: the Drizzle adapter over the app database, Lexema's table
names, the session and cookie rules, and better-auth's limiter and telemetry off.
Each builder spreads it and adds only what its own job needs:

```ts
export function billingAuth(db: AppDatabase, secret: string, origin: string, billing: Billing, mail?: AccountMail) {
  return betterAuth({ ...baseOptions(db, secret, origin), plugins: [billingPlugin(db, billing, mail)] });
}
```

There are four builders in `auth.ts`:

| Builder | Adds to the base | Used by |
|---|---|---|
| `sessionAuth` | nothing | reading and ending a session ([`web/worker/developers/signIn.ts`](../web/worker/developers/signIn.ts)) |
| `signInAuth` | one social provider and the database hooks | one sign-in, start or callback |
| `billingAuth` | the Stripe plugin ([`src/accounts/billing.ts`](../src/accounts/billing.ts)) | [`web/worker/developers/billing.ts`](../web/worker/developers/billing.ts), [`web/worker/developers/stripeWebhook.ts`](../web/worker/developers/stripeWebhook.ts) |
| `startSession` | a one-off `createAuthEndpoint.serverOnly` plugin | starting a session for an account already signed in |

The rules, each visible in `auth.ts`:

1. **Built per request.** A route calls a builder with the request's database,
   secret and origin. Nothing keeps an instance between requests
   ([ADR 0017](../.decisions/0017-better-auth-and-drizzle-own-accounts.md)).
2. **A plugin goes on its builder, never in `baseOptions`.** Its endpoints then
   exist only on the instance that needs them. `billingAuth` is only reachable
   once every Stripe setting is set.
3. **Tables are named, not defaulted.** `TABLES` maps better-auth's models to the
   Drizzle tables in [`src/db/app/schema.ts`](../src/db/app/schema.ts), and
   `modelName` renames user, account and session to `developer_account`,
   `provider_identity` and `developer_session`. Fields only the server sets are
   `input: false`.
4. **The Worker's limits, not better-auth's.** `rateLimit: { enabled: false }`;
   sign-in starts are counted by the rate-limit bindings in
   [`web/worker/shared/rateLimit.ts`](../web/worker/shared/rateLimit.ts).
5. **Host-only cookies.** `crossSubDomainCookies: { enabled: false }` and
   `useSecureCookies: true`, so `lexema.fyi` never gets a session cookie.
6. **What better-auth would keep, dropped in a hook.** The account hooks spread
   `NO_CREDENTIALS` over every write, and the session hook drops `ipAddress` and
   `userAgent`.
7. **A server-only action is a plugin built inline.** `startSession` adds an
   endpoint no router mounts, so better-auth's own code writes the session and
   its signed cookie.

[`web/test/signIn.test.ts`](../web/test/signIn.test.ts) is the worked example: a
stub round trip ends with a host-only cookie, and Google then GitHub under one
verified email is one account.

## When this applies

Code that reaches better-auth: `src/accounts/auth.ts`, `src/accounts/billing.ts`,
`src/accounts/testDeveloper.ts` and the three Worker files above. It stops at the
app database. The dictionary database never reaches better-auth
([`src/db/app/database.ts`](../src/db/app/database.ts)). API keys, account
deletion, the CSRF token and the per-visitor limits are Lexema's own code, not
better-auth plugins; ADR 0017 says why for each.

## Why it is not obvious

better-auth's docs show one module-level `auth` with every plugin on it. In a
Worker, the D1 binding and secrets arrive with the request, so a module-level
instance has nothing to bind to. Putting a plugin in the shared options turns its
endpoints on everywhere, the sign-in instance included. And better-auth's defaults
store provider tokens, addresses and user agents, which the app tables' `CHECK`s
refuse, and its limiter counts per isolate (ADR 0017).

> Derived from `better-auth@1.7.6` — re-verify on pin bump.
