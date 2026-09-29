// developers.lexema.fyi/dashboard (#169, boards 28 and 28m): the account's live
// keys with Create key and a Revoke each, 30 days of usage, the plan card, and
// the account section. Every action (worker/dashboard.ts) carries the
// session's CSRF token. What the page shows is worked out in
// `dashboardView.ts`; the wiring that reads the session and D1 is
// `(developers)/developer-site/dashboard/`.
//
// Create key, Revoke and Delete account open their dialogs over the page in
// place and send their action with fetch: the new key's form, then its secret
// in the same dialog (boards 28b and 28e), the revoke confirmation (28d) and
// the delete confirmation (30). Toasts say what happened (28f)
// (DashboardFlow.tsx).
//
// On a phone (below `sm`, board 28m) the key table becomes one card per key,
// with no column heads: the name and Revoke, the prefix, then "Created … ·
// Last used …", then its endpoints, then "Expires …" (#187). The plan and
// account cards stack their action under the text.

import { DeveloperPage } from "./DeveloperPage";
import { CreateKeyControl, DashboardFlow, DeleteAccountControl, KeyTable } from "./DashboardFlow";
import { units, type DashboardView, type UsageRow } from "./dashboardView.ts";
import {
  ACCOUNT_DETAIL,
  ACCOUNT_TEXT,
  ACCOUNT_TITLE,
  BUTTON_DANGER_OUTLINE,
  DASH_CREATE_BUTTON,
  DASH_HEADING,
  DASH_KEYS_SECTION,
  DASH_ROW_CARD,
  DASH_SECTION,
  DASH_SECTION_HEAD,
  DASH_SECTION_HEADING,
  DASH_SHELL,
  DASH_USAGE_HEAD,
  DASH_USAGE_NOTE,
  PLAN_CARD,
  PLAN_NONE,
  PLAN_SOON,
  USAGE_BAR,
  USAGE_BAR_TODAY,
  USAGE_CARD,
  USAGE_CHART,
  USAGE_DAY,
} from "./styles.ts";

export { CREATE_KEY_ACTION, DELETE_ACCOUNT_ACTION, revokeKeyAction } from "./dashboardActions.ts";

/** 30 days of units as bars, oldest first; the last, today, in the accent. Each day is its own box, so the gap between bars is the board's at every width. */
function UsageBars({ row }: { row: UsageRow }) {
  return (
    <div className={USAGE_CHART} role="img" aria-label="Units per day, all keys, the last 30 days">
      {row.bars.map((bar, i) => (
        <svg key={bar.day} className={USAGE_DAY} viewBox="0 0 1 100" preserveAspectRatio="none" aria-hidden="true">
          <rect
            className={i === row.bars.length - 1 ? USAGE_BAR_TODAY : USAGE_BAR}
            x={0}
            y={100 - bar.share * 100}
            width={1}
            height={bar.share * 100}
            data-day={bar.day}
            data-units={bar.units}
          />
        </svg>
      ))}
    </div>
  );
}

/**
 * The dashboard for a view, with the session's CSRF token in every form.
 * `made` counts every key the account has made, revoked ones too, for the
 * create dialog's default name.
 */
export function Dashboard({ view, csrf, made }: { view: DashboardView; csrf: string; made: number }) {
  return (
    <DashboardFlow keys={view.keys} made={made} csrf={csrf}>
      <DeveloperPage current="dashboard" signedIn={{ email: view.email }}>
        <main className={DASH_SHELL}>
          <h1 className={DASH_HEADING}>Dashboard</h1>

          <section className={DASH_KEYS_SECTION} aria-labelledby="keys">
            <div className={DASH_SECTION_HEAD}>
              <h2 className={DASH_SECTION_HEADING} id="keys">
                API keys
              </h2>
              <CreateKeyControl className={DASH_CREATE_BUTTON} />
            </div>
            <KeyTable />
          </section>

          <section className={DASH_SECTION} aria-labelledby="usage">
            <div className={DASH_USAGE_HEAD}>
              <h2 className={DASH_SECTION_HEADING} id="usage">
                Usage
              </h2>
              <p className={DASH_USAGE_NOTE} data-usage-total={view.usage.total}>
                Last 30 days · {units(view.usage.total)} units
              </p>
            </div>
            <div className={USAGE_CARD} data-usage="total">
              <UsageBars row={view.usage} />
            </div>
          </section>

          <section className={DASH_SECTION} aria-labelledby="plan">
            <h2 className={DASH_SECTION_HEADING} id="plan">
              Plan
            </h2>
            <div className={PLAN_CARD}>
              <p className={PLAN_NONE}>No plan yet</p>
              <button className={PLAN_SOON} type="button" disabled>
                Choose a plan — coming soon
              </button>
            </div>
          </section>

          <section className={DASH_SECTION} aria-labelledby="account">
            <h2 className={DASH_SECTION_HEADING} id="account">
              Account
            </h2>
            <div className={DASH_ROW_CARD}>
              <div className={ACCOUNT_TEXT}>
                <p className={ACCOUNT_TITLE}>Delete account</p>
                <p className={ACCOUNT_DETAIL}>{view.signedInWith}</p>
              </div>
              <DeleteAccountControl className={BUTTON_DANGER_OUTLINE} />
            </div>
          </section>
        </main>
      </DeveloperPage>
    </DashboardFlow>
  );
}
