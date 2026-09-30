// Where the pricing and settings pages' billing buttons post (#264), shared by
// the Worker that answers them (worker/billing.ts) and the pages (#207, #208).
// Nothing here reaches the database, so the browser loads it.
//
// Each is a plain form POST the browser follows: the answer is a 303 to
// Stripe's Checkout or billing portal, to sign-in, or to pricing.

/** Choose Starter or Pro: the form carries `plan` and, signed in, the session's CSRF token. */
export const CHECKOUT_ACTION = "/billing/checkout";
/** Manage billing: the form carries the session's CSRF token. */
export const PORTAL_ACTION = "/billing/portal";
/** The checkout form's field naming the plan: `starter` or `pro`. */
export const PLAN_FIELD = "plan";
/** The pricing page, where Checkout's back button and a portal with no customer land. */
export const PRICING = "/pricing";
