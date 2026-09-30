// developers.lexema.fyi/pricing (#166, board 26): the two plans, and what
// counts as a call. Nothing on it takes a payment (#161): Pro's button is
// disabled, and Enterprise writes to the contact address.
//
// The call table is read from the call map (src/api/calls.ts): any endpoint,
// then each endpoint counted per word. It restates no count of its own.

import { MAX_BATCH_WORDS } from "@/worker/api/endpoints.ts";
import { CALL_ROWS, callText } from "@/lib/developers/apiReference.ts";
import { CONTACT_EMAIL, DeveloperPage } from "./DeveloperPage";
import { CheckIcon } from "@/components/shared/MenuIcons";
import type { SignedIn } from "@/lib/developers/signedIn.ts";
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
  PLAN_NAME_FEATURED,
  PLAN_NAME_OTHER,
  PLAN_OTHER,
  PLAN_PERIOD,
  PLAN_PRICE,
  PLANS,
} from "@/components/shared/styles.ts";

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

export function DeveloperPricing({ signedIn }: { signedIn?: SignedIn } = {}) {
  return (
    // Board 26 draws the bar with neither page marked.
    <DeveloperPage signedIn={signedIn}>
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
            <Features items={["50,000 calls a day", "Up to 5 API keys", "All endpoints"]} />
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
            <Features items={["Calls and keys to fit your use", `Batch sizes above ${MAX_BATCH_WORDS}`, "Invoicing"]} />
            <div className={PLAN_ACTION}>
              <a className={BUTTON_SECONDARY} href={`mailto:${CONTACT_EMAIL}`}>
                Contact us
              </a>
            </div>
          </section>
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
