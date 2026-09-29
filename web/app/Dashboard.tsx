// developers.lexema.fyi/dashboard (#169, boards 28 and 28m): the account's live
// keys with Create key and a Revoke each, 30 days of usage, the plan card, and
// the account section. Every form posts to a dashboard action
// (worker/dashboard.ts) with the session's CSRF token. What the page shows is
// worked out in `dashboardView.ts`; the wiring that reads the session and D1
// is `(developers)/developer-site/dashboard/`.
//
// Three dialogs open over it, each by its own address so it opens with no
// script: the new key's name (board 28b) at `/dashboard?create=key`, the new
// key's secret (board 29) on the key-created page, and the delete
// confirmation (board 30) at `/dashboard?confirm=delete`.
//
// On a phone (below `sm`, board 28m) the key table becomes one card per key,
// with no column heads: the name and Revoke, the prefix, then "Created … ·
// Last used …", then its endpoints, then "Expires …" (#187). The plan and
// account cards stack their action under the text.

import { CONFIRM_DELETE_PAGE, CREATE_KEY_PAGE, CSRF_FIELD, DELETE_CONFIRMATION } from "../worker/dashboard.ts";
import { CreateKeyDialog } from "./CreateKeyDialog";
import { DeleteAccountDialog } from "./DeleteAccountDialog";
import { DeveloperPage } from "./DeveloperPage";
import { KeyCreatedDialog } from "./KeyCreated";
import { deleteWarning, endpointsText, units, type DashboardView, type UsageRow } from "./dashboardView.ts";
import {
  ACCOUNT_DETAIL,
  ACCOUNT_TEXT,
  ACCOUNT_TITLE,
  BUTTON_DANGER_OUTLINE,
  DASH_BEHIND,
  DASH_CREATE_BUTTON,
  DASH_HEADING,
  DASH_KEYS_CARD,
  DASH_KEYS_SECTION,
  DASH_ROW_CARD,
  DASH_SECTION,
  DASH_SECTION_HEAD,
  DASH_SECTION_HEADING,
  DASH_SHELL,
  DASH_USAGE_HEAD,
  DASH_USAGE_NOTE,
  KEYS_BODY,
  KEYS_CREATED,
  KEYS_ENDPOINT_NAMES,
  KEYS_ENDPOINTS,
  KEYS_EXPIRES,
  KEYS_HEAD,
  KEYS_HEAD_ROW,
  KEYS_LAST_USED,
  KEYS_NAME,
  KEYS_ACTION,
  KEYS_PHONE_BREAK,
  KEYS_PHONE_LABEL,
  KEYS_PREFIX,
  KEYS_REVOKE,
  KEYS_ROW,
  KEYS_TABLE,
  PLAN_CARD,
  PLAN_NONE,
  PLAN_SOON,
  USAGE_BAR,
  USAGE_BAR_TODAY,
  USAGE_CARD,
  USAGE_CHART,
  USAGE_DAY,
} from "./styles.ts";

/** Where each form posts: worker/dashboard.ts. */
export const CREATE_KEY_ACTION = "/dashboard/keys";
export const revokeKeyAction = (keyId: number): string => `/dashboard/keys/${keyId}/revoke`;
export const DELETE_ACCOUNT_ACTION = "/dashboard/account/delete";

/** The session's CSRF token, as every dashboard form carries it. */
export function CsrfField({ csrf }: { csrf: string }) {
  return <input type="hidden" name={CSRF_FIELD} value={csrf} />;
}

/** A dialog open over the dashboard: the new key's name (board 28b), its secret (board 29), or the delete confirmation (board 30). */
export type DashboardDialog =
  | { kind: "create-key"; defaultName: string }
  | { kind: "key-created"; name: string; secret: string }
  | { kind: "confirm-delete" };

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

export function Dashboard({ view, csrf, dialog }: { view: DashboardView; csrf: string; dialog?: DashboardDialog }) {
  return (
    <>
      <div className={DASH_BEHIND} inert={dialog !== undefined}>
        <DeveloperPage current="dashboard" signedIn={{ email: view.email }}>
          <main className={DASH_SHELL}>
            <h1 className={DASH_HEADING}>Dashboard</h1>

            <section className={DASH_KEYS_SECTION} aria-labelledby="keys">
              <div className={DASH_SECTION_HEAD}>
                <h2 className={DASH_SECTION_HEADING} id="keys">
                  API keys
                </h2>
                <a className={DASH_CREATE_BUTTON} href={CREATE_KEY_PAGE}>
                  Create key
                </a>
              </div>
              {view.keys.length > 0 && (
                <div className={DASH_KEYS_CARD}>
                  <table className={KEYS_TABLE}>
                    <thead className={KEYS_HEAD_ROW}>
                      <tr>
                        <th className={KEYS_HEAD} scope="col">
                          Name
                        </th>
                        <th className={KEYS_HEAD} scope="col">
                          Key
                        </th>
                        <th className={KEYS_HEAD} scope="col">
                          Endpoints
                        </th>
                        <th className={KEYS_HEAD} scope="col">
                          Expires
                        </th>
                        <th className={KEYS_HEAD} scope="col">
                          Created
                        </th>
                        <th className={KEYS_HEAD} scope="col">
                          Last used
                        </th>
                        <th className={KEYS_HEAD} scope="col">
                          <span className="sr-only">Revoke</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className={KEYS_BODY}>
                      {view.keys.map((key) => (
                        <tr key={key.keyId} className={KEYS_ROW} data-key-id={key.keyId}>
                          <td className={KEYS_NAME}>{key.name}</td>
                          <td className={KEYS_PREFIX}>{key.prefix}</td>
                          <td className={KEYS_ENDPOINTS}>
                            {key.endpoints.kind === "all" ? (
                              endpointsText(key.endpoints)
                            ) : (
                              <span className={KEYS_ENDPOINT_NAMES}>{endpointsText(key.endpoints)}</span>
                            )}
                          </td>
                          <td className={KEYS_EXPIRES}>
                            <span className={KEYS_PHONE_LABEL}>Expires </span>
                            {key.expires}
                          </td>
                          <td className={KEYS_CREATED}>
                            <span className={KEYS_PHONE_LABEL}>Created </span>
                            {key.created}
                          </td>
                          <td className={KEYS_LAST_USED}>
                            <span className={KEYS_PHONE_LABEL}>{"\u00a0· Last used "}</span>
                            {key.lastUsed}
                          </td>
                          <td className={KEYS_PHONE_BREAK} aria-hidden="true" />
                          <td className={KEYS_ACTION}>
                            <form method="post" action={revokeKeyAction(key.keyId)}>
                              <CsrfField csrf={csrf} />
                              <button className={KEYS_REVOKE} type="submit" aria-label={`Revoke ${key.name}`}>
                                Revoke
                              </button>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
                <a className={BUTTON_DANGER_OUTLINE} href={CONFIRM_DELETE_PAGE}>
                  Delete account
                </a>
              </div>
            </section>
          </main>
        </DeveloperPage>
      </div>
      {dialog?.kind === "create-key" && (
        <CreateKeyDialog action={CREATE_KEY_ACTION} defaultName={dialog.defaultName}>
          <CsrfField csrf={csrf} />
        </CreateKeyDialog>
      )}
      {dialog?.kind === "key-created" && <KeyCreatedDialog name={dialog.name} secret={dialog.secret} />}
      {dialog?.kind === "confirm-delete" && (
        <DeleteAccountDialog action={DELETE_ACCOUNT_ACTION} warning={deleteWarning(view.keys.length)}>
          <CsrfField csrf={csrf} />
          <input type="hidden" name="confirm" value={DELETE_CONFIRMATION} />
        </DeleteAccountDialog>
      )}
    </>
  );
}
