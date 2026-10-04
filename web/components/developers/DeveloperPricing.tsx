// developers.lexema.fyi/pricing (#166, #208, boards 26 and 26m): three plans,
// and what counts as a call. There is no free plan (#161).
//
// Starter's and Pro's numbers are the plan table's (src/billing/plans.ts), and
// Pro, the table's featured plan, carries the "Most popular" tag and the accent
// border. Their Choose buttons post the plan to Checkout (worker/developers/billing.ts),
// with the session's CSRF token when the visitor is signed in; signed out, the
// route sends them through sign-in first and keeps the plan. Enterprise is
// agreed per account, so its card writes to the contact address.
//
// The call table is read from the call map (src/api/calls.ts): any endpoint,
// then each endpoint counted per word. It restates no count of its own.

import { PLAN_TERMS, type PlanId, type StripePlanId } from "@lexema/billing/plans.ts";
import type { ReactNode } from "react";
import { CALL_ROWS, callText } from "@/lib/developers/apiReference.ts";
import type { PostingVisitor } from "@/lib/developers/signedIn.ts";
import type { SiteOrigins } from "@/worker/shared/hosts.ts";
import { ChoosePlanForm } from "./BillingForms";
import { CONTACT_EMAIL, DeveloperPage } from "./DeveloperPage";
import { CheckIcon } from "@/components/shared/MenuIcons";
import {
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  CALL_ANY,
  CALL_COUNT,
  CALL_ENDPOINT,
  CALL_ROW,
  CALL_TABLE,
  CALLS,
  CALLS_HEADING,
  DEV_HEADING,
  DEV_SHELL,
  PLAN_ACTION,
  PLAN_CHECK,
  PLAN_FEATURE,
  PLAN_FEATURED,
  PLAN_FEATURES,
  PLAN_HEAD,
  PLAN_NAME_FEATURED,
  PLAN_NAME_OTHER,
  PLAN_OTHER,
  PLAN_PERIOD,
  PLAN_PRICE,
  PLAN_TAG,
  PLANS,
} from "@/components/shared/styles.ts";

/** The plans bought through Stripe, in the order the page shows them. */
const STRIPE_PLANS = ["starter", "pro"] as const satisfies readonly StripePlanId[];

const count = (n: number): string => n.toLocaleString("en-US");

/** What a Starter or Pro card lists: the table's allowance and rate, then what every plan gets. */
const stripePlanLines = (plan: StripePlanId): readonly string[] => [
  `${count(PLAN_TERMS[plan].callsPerPeriod)} calls a month`,
  `${count(PLAN_TERMS[plan].callsPerMinute)} calls a minute`,
  "All endpoints",
];

/** What the Enterprise card lists: its numbers are agreed per account, so none is stated. */
const ENTERPRISE_LINES = ["Custom calls a month", "Custom calls a minute", "Invoicing"] as const;

function Features({ items }: { items: readonly string[] }) {
  return (
    <ul className={PLAN_FEATURES}>
      {items.map((item) => (
        <li key={item} className={PLAN_FEATURE}>
          <CheckIcon className={PLAN_CHECK} />
          {item}
        </li>
      ))}
    </ul>
  );
}

/** One plan's card: its name, and the featured plan's tag and border, from the plan table. */
function PlanCard({ plan, price, lines, action }: { plan: PlanId; price: ReactNode; lines: readonly string[]; action: ReactNode }) {
  const { name, featured } = PLAN_TERMS[plan];
  const heading = `plan-${plan}`;
  return (
    <section className={featured ? PLAN_FEATURED : PLAN_OTHER} aria-labelledby={heading} data-plan={plan}>
      <div className={PLAN_HEAD}>
        <h2 className={featured ? PLAN_NAME_FEATURED : PLAN_NAME_OTHER} id={heading}>
          {name}
        </h2>
        {featured && <span className={PLAN_TAG}>Most popular</span>}
      </div>
      <p className={PLAN_PRICE}>{price}</p>
      <Features items={lines} />
      <div className={PLAN_ACTION}>{action}</div>
    </section>
  );
}

export function DeveloperPricing({ visitor, origins }: { visitor?: PostingVisitor; origins: SiteOrigins }) {
  return (
    // Board 26 draws the bar with neither page marked.
    <DeveloperPage signedIn={visitor?.signedIn} origins={origins}>
      <main className={DEV_SHELL}>
        <h1 className={DEV_HEADING}>Pricing</h1>

        <div className={PLANS}>
          {STRIPE_PLANS.map((plan) => (
            <PlanCard
              key={plan}
              plan={plan}
              price={
                <>
                  ${PLAN_TERMS[plan].usdPerMonth}
                  <span className={PLAN_PERIOD}>/ month</span>
                </>
              }
              lines={stripePlanLines(plan)}
              action={
                <ChoosePlanForm plan={plan} csrf={visitor?.csrf} className={PLAN_TERMS[plan].featured ? BUTTON_PRIMARY : BUTTON_SECONDARY} />
              }
            />
          ))}
          <PlanCard
            plan="enterprise"
            price="Contact us"
            lines={ENTERPRISE_LINES}
            action={
              <a className={BUTTON_SECONDARY} href={`mailto:${CONTACT_EMAIL}`}>
                Contact us
              </a>
            }
          />
        </div>

        <section className={CALLS} aria-labelledby="calls">
          <h2 className={CALLS_HEADING} id="calls">
            What counts as a call
          </h2>
          <table className={CALL_TABLE}>
            <thead className="sr-only">
              <tr>
                <th scope="col">Endpoint</th>
                <th scope="col">Calls</th>
              </tr>
            </thead>
            <tbody>
              {CALL_ROWS.map((row) => (
                <tr key={row.endpoint} className={CALL_ROW} data-call-row="">
                  {row.endpoint === "any" ? (
                    <th className={CALL_ANY} scope="row">
                      Any endpoint
                    </th>
                  ) : (
                    <th className={CALL_ENDPOINT} scope="row">
                      {row.endpoint}
                    </th>
                  )}
                  <td className={CALL_COUNT}>{callText(row.basis)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </DeveloperPage>
  );
}
