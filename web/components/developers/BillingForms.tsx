// The billing buttons (#264): Choose Starter or Pro posts the plan to Checkout,
// Manage billing posts to the billing portal. Pricing (#208) and the settings
// Plan section (#207) both draw them; each page picks the button's size.
// Signed in, a form carries the session's CSRF token; signed out, pricing's
// Choose goes through sign-in first and keeps the plan (worker/billing.ts).

import { Button } from "@base-ui/react/button";
import { PLAN_TERMS, type StripePlanId } from "@lexema/billing/plans.ts";
import { CHECKOUT_ACTION, PLAN_FIELD, PORTAL_ACTION } from "@/lib/developers/billingActions.ts";
import { CSRF_FIELD } from "@/lib/developers/dashboardActions.ts";

/** Choose Starter or Pro. `csrf` is absent only for a signed-out visitor on pricing. */
export function ChoosePlanForm({ plan, csrf, className }: { plan: StripePlanId; csrf: string | undefined; className: string }) {
  return (
    <form method="post" action={CHECKOUT_ACTION}>
      <input type="hidden" name={PLAN_FIELD} value={plan} />
      {csrf !== undefined && <input type="hidden" name={CSRF_FIELD} value={csrf} />}
      <Button className={className} type="submit">
        Choose {PLAN_TERMS[plan].name}
      </Button>
    </form>
  );
}

/** Manage billing: the account's Stripe billing portal. */
export function ManageBillingForm({ csrf, className }: { csrf: string; className: string }) {
  return (
    <form method="post" action={PORTAL_ACTION}>
      <input type="hidden" name={CSRF_FIELD} value={csrf} />
      <Button className={className} type="submit">
        Manage billing
      </Button>
    </form>
  );
}
