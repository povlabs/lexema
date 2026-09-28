// developers.lexema.fyi/dashboard (#169, board 28): the account's keys with a
// create form and a revoke action each, 30 days of usage in total and per key,
// the plan card, and the account section. Every form posts to a dashboard
// action (worker/dashboard.ts) with the session's CSRF token. What the page
// shows is worked out in `dashboardView.ts`; the wiring that reads the session
// and D1 is `(developers)/developer-site/dashboard/page.tsx`.

import { KEY_NAME_MAX } from "@lexema/api/ownedKeys.ts";
import { CSRF_FIELD, DELETE_CONFIRMATION } from "../worker/dashboard.ts";
import { DeleteAccountDialog } from "./DeleteAccountDialog";
import { DeveloperPage } from "./DeveloperPage";
import { deleteWarning, units, type DashboardView, type UsageRow } from "./dashboardView.ts";
import {
  ACCOUNT_DETAIL,
  ACCOUNT_TITLE,
  DASH_CARD,
  DASH_CARD_RAISED,
  DASH_CREATE,
  DASH_CREATE_BUTTON,
  DASH_CREATE_INPUT,
  DASH_ROW_CARD,
  DASH_SECTION,
  DASH_SECTION_HEAD,
  DASH_SECTION_NOTE,
  DEV_HEADING,
  DEV_SECTION_HEADING,
  DEV_SHELL,
  KEYS_ACTION,
  KEYS_CELL,
  KEYS_HEAD,
  KEYS_NAME,
  KEYS_PREFIX,
  KEYS_REVOKE,
  KEYS_REVOKED,
  KEYS_ROW,
  KEYS_SCROLL,
  KEYS_TABLE,
  PLAN_NONE,
  PLAN_SOON,
  USAGE_BAR,
  USAGE_BAR_TODAY,
  USAGE_CHART,
  USAGE_KEY,
  USAGE_KEY_CHART,
  USAGE_KEY_NAME,
  USAGE_KEY_TOTAL,
  USAGE_KEYS,
  USAGE_PLOT,
} from "./styles.ts";

/** Where each form posts: worker/dashboard.ts. */
export const CREATE_KEY_ACTION = "/dashboard/keys";
export const revokeKeyAction = (keyId: number): string => `/dashboard/keys/${keyId}/revoke`;
export const DELETE_ACCOUNT_ACTION = "/dashboard/account/delete";

/** The session's CSRF token, as every dashboard form carries it. */
export function CsrfField({ csrf }: { csrf: string }) {
  return <input type="hidden" name={CSRF_FIELD} value={csrf} />;
}

/** Each bar's width and the gap after it, in the chart's own units; the chart stretches to its box. */
const BAR = 10;
const GAP = 3;

/** 30 days of units as bars, oldest first; the last, today, in the accent. */
function UsageBars({ row, className, label }: { row: UsageRow; className: string; label?: string }) {
  const width = row.bars.length * (BAR + GAP) - GAP;
  return (
    <svg
      className={className}
      viewBox={`0 0 ${width} 100`}
      preserveAspectRatio="none"
      role={label === undefined ? undefined : "img"}
      aria-label={label}
      aria-hidden={label === undefined ? true : undefined}
    >
      {row.bars.map((bar, i) => (
        <rect
          key={bar.day}
          className={i === row.bars.length - 1 ? USAGE_BAR_TODAY : USAGE_BAR}
          x={i * (BAR + GAP)}
          y={100 - bar.share * 100}
          width={BAR}
          height={bar.share * 100}
          data-day={bar.day}
          data-units={bar.units}
        >
          <title>{`${bar.day}: ${units(bar.units)} units`}</title>
        </rect>
      ))}
    </svg>
  );
}

export function Dashboard({ view, csrf }: { view: DashboardView; csrf: string }) {
  return (
    <DeveloperPage current="dashboard" signedIn={{ email: view.email }}>
      <main className={DEV_SHELL}>
        <h1 className={DEV_HEADING}>Dashboard</h1>

        <section className={DASH_SECTION} aria-labelledby="keys">
          <div className={DASH_SECTION_HEAD}>
            <h2 className={DEV_SECTION_HEADING} id="keys">
              API keys
            </h2>
            <form className={DASH_CREATE} method="post" action={CREATE_KEY_ACTION}>
              <CsrfField csrf={csrf} />
              <input
                className={DASH_CREATE_INPUT}
                type="text"
                name="name"
                required
                maxLength={KEY_NAME_MAX}
                placeholder="Key name"
                aria-label="Key name"
                autoComplete="off"
              />
              <button className={DASH_CREATE_BUTTON} type="submit">
                Create key
              </button>
            </form>
          </div>
          {view.keys.length > 0 && (
            <div className={DASH_CARD}>
              <div className={KEYS_SCROLL}>
                <table className={KEYS_TABLE}>
                  <thead>
                    <tr>
                      <th className={KEYS_HEAD} scope="col">
                        Name
                      </th>
                      <th className={KEYS_HEAD} scope="col">
                        Key
                      </th>
                      <th className={KEYS_HEAD} scope="col">
                        Created
                      </th>
                      <th className={KEYS_HEAD} scope="col">
                        Last used
                      </th>
                      <th className={KEYS_HEAD} scope="col">
                        <span className="sr-only">Action</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.keys.map((key) => (
                      <tr key={key.keyId} className={KEYS_ROW} data-key-id={key.keyId}>
                        <td className={KEYS_NAME}>{key.name}</td>
                        <td className={KEYS_PREFIX}>{key.prefix}</td>
                        <td className={KEYS_CELL}>{key.created}</td>
                        <td className={KEYS_CELL}>{key.lastUsed}</td>
                        <td className={KEYS_ACTION}>
                          {key.revoked === null ? (
                            <form method="post" action={revokeKeyAction(key.keyId)}>
                              <CsrfField csrf={csrf} />
                              <button className={KEYS_REVOKE} type="submit" aria-label={`Revoke ${key.name}`}>
                                Revoke
                              </button>
                            </form>
                          ) : (
                            <span className={KEYS_REVOKED}>Revoked {key.revoked}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <section className={DASH_SECTION} aria-labelledby="usage">
          <div className={DASH_SECTION_HEAD}>
            <h2 className={DEV_SECTION_HEADING} id="usage">
              Usage
            </h2>
            <p className={DASH_SECTION_NOTE} data-usage-total={view.usage.total}>
              Last 30 days · {units(view.usage.total)} units
            </p>
          </div>
          <div className={DASH_CARD_RAISED}>
            <div className={USAGE_PLOT} data-usage="total">
              <UsageBars row={view.usage} className={USAGE_CHART} label="Units per day, all keys, the last 30 days" />
            </div>
            {view.keys.length > 0 && (
              <ul className={USAGE_KEYS}>
                {view.keys.map((key) => (
                  <li key={key.keyId} className={USAGE_KEY} data-usage={key.keyId}>
                    <span className={USAGE_KEY_NAME}>{key.name}</span>
                    <UsageBars row={key.usage} className={USAGE_KEY_CHART} />
                    <span className={USAGE_KEY_TOTAL}>{units(key.usage.total)} units</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className={DASH_SECTION} aria-labelledby="plan">
          <h2 className={DEV_SECTION_HEADING} id="plan">
            Plan
          </h2>
          <div className={DASH_ROW_CARD}>
            <p className={PLAN_NONE}>No plan yet</p>
            <button className={PLAN_SOON} type="button" disabled>
              Choose a plan — coming soon
            </button>
          </div>
        </section>

        <section className={DASH_SECTION} aria-labelledby="account">
          <h2 className={DEV_SECTION_HEADING} id="account">
            Account
          </h2>
          <div className={DASH_ROW_CARD}>
            <div>
              <p className={ACCOUNT_TITLE}>Delete account</p>
              <p className={ACCOUNT_DETAIL}>{view.signedInWith}</p>
            </div>
            <DeleteAccountDialog action={DELETE_ACCOUNT_ACTION} warning={deleteWarning(view.liveKeys)}>
              <CsrfField csrf={csrf} />
              <input type="hidden" name="confirm" value={DELETE_CONFIRMATION} />
            </DeleteAccountDialog>
          </div>
        </section>
      </main>
    </DeveloperPage>
  );
}
