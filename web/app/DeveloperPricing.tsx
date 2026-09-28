// developers.lexema.fyi/pricing (#166, board 26): the two plans as the board
// draws them, and what each call costs. Nothing on it takes a payment (#161):
// Pro's button is disabled, and Enterprise writes to the contact address.
//
// The cost table is the unit map (src/api/units.ts) grouped by cost; it
// restates no number of its own.

import { MAX_BATCH_WORDS } from "../worker/api/endpoints.ts";
import { COST_ROWS, costText } from "./apiReference.ts";
import { CONTACT_EMAIL, DeveloperPage } from "./DeveloperPage";
import {
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  COST_ENDPOINTS,
  COST_ROW,
  COST_TABLE,
  COST_UNITS,
  COSTS,
  DEV_HEADING,
  DEV_SECTION_HEADING,
  DEV_SHELL,
  PLAN_ACTION,
  PLAN_CHECK,
  PLAN_FEATURE,
  PLAN_FEATURED,
  PLAN_FEATURES,
  PLAN_NAME_FEATURED,
  PLAN_NAME_OTHER,
  PLAN_OTHER,
  PLAN_PERIOD,
  PLAN_PRICE,
  PLANS,
} from "./styles.ts";

function Features({ items }: { items: readonly string[] }) {
  return (
    <ul className={PLAN_FEATURES}>
      {items.map((item) => (
        <li key={item} className={PLAN_FEATURE}>
          <span className={PLAN_CHECK} aria-hidden="true">
            ✓
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}

export function DeveloperPricing() {
  return (
    <DeveloperPage current="pricing">
      <main className={DEV_SHELL}>
        <h1 className={DEV_HEADING}>Pricing</h1>

        <div className={PLANS}>
          <section className={PLAN_FEATURED} aria-labelledby="plan-pro">
            <h2 className={PLAN_NAME_FEATURED} id="plan-pro">
              Pro
            </h2>
            <p className={PLAN_PRICE}>
              $15<span className={PLAN_PERIOD}>/ month</span>
            </p>
            <Features items={["50,000 units a day", "Up to 5 API keys", "All endpoints"]} />
            <div className={PLAN_ACTION}>
              <button className={BUTTON_PRIMARY} type="button" disabled>
                Coming soon
              </button>
            </div>
          </section>

          <section className={PLAN_OTHER} aria-labelledby="plan-enterprise">
            <h2 className={PLAN_NAME_OTHER} id="plan-enterprise">
              Enterprise
            </h2>
            <p className={PLAN_PRICE}>Contact us</p>
            <Features items={["Units and keys to fit your use", `Batch sizes above ${MAX_BATCH_WORDS}`, "Invoicing"]} />
            <div className={PLAN_ACTION}>
              <a className={BUTTON_SECONDARY} href={`mailto:${CONTACT_EMAIL}`}>
                Contact us
              </a>
            </div>
          </section>
        </div>

        <section className={COSTS} aria-labelledby="costs">
          <h2 className={DEV_SECTION_HEADING} id="costs">
            What a call costs
          </h2>
          <table className={COST_TABLE}>
            <thead className="sr-only">
              <tr>
                <th scope="col">Endpoints</th>
                <th scope="col">Cost</th>
              </tr>
            </thead>
            <tbody>
              {COST_ROWS.map((row) => (
                <tr key={row.endpoints.join()} className={COST_ROW} data-cost-row="">
                  <th className={COST_ENDPOINTS} scope="row">
                    {row.endpoints.join(", ")}
                  </th>
                  <td className={COST_UNITS}>{costText(row.weight)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </DeveloperPage>
  );
}
