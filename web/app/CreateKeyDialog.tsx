// Board 28b (28bm on a phone): what a new key is called, what it may call and
// how long it lasts, asked before it is made (#187). Create key on the
// dashboard is a link to `/dashboard?create=key`, which the server draws with
// this dialog open, so the button never makes a key on its own, script or no
// script.
//
// The name is optional: left empty, the key gets the default the hint names.
// Endpoints is All endpoints by default; Only some opens the checklist of the
// 8 endpoints (board 28c) with no script, since the form's own CSS reads which
// is ticked. Expires is Never by default. The form posts to the create action
// with the session's CSRF token, which the page hands in as `children`; the
// server refuses Only some with nothing ticked. Cancel, and Escape with a
// script, go back to the dashboard.

import type { ReactNode } from "react";
import { KEY_LIFETIMES, LIFETIME_LABEL } from "@lexema/api/keyAccess.ts";
import { KEY_NAME_MAX } from "@lexema/api/ownedKeys.ts";
import { ENDPOINTS } from "@lexema/api/units.ts";
import { DASHBOARD, ENDPOINT_FIELD, ENDPOINT_SCOPE, ENDPOINT_SCOPE_FIELD, EXPIRES_FIELD, KEY_NAME_FIELD } from "../worker/dashboard.ts";
import { ChevronIcon } from "./icons";
import { CheckIcon } from "./MenuIcons";
import { PageDialog } from "./PageDialog";
import {
  CREATE_KEY_ACTIONS,
  CREATE_KEY_BOX,
  CREATE_KEY_CHECK,
  CREATE_KEY_CHECKBOX,
  CREATE_KEY_CHECKLIST,
  CREATE_KEY_CHEVRON,
  CREATE_KEY_FORM,
  CREATE_KEY_HINT,
  CREATE_KEY_INPUT,
  CREATE_KEY_LABEL,
  CREATE_KEY_LABEL_FIRST,
  CREATE_KEY_RADIO,
  CREATE_KEY_SCOPE,
  CREATE_KEY_SCOPE_HINT,
  CREATE_KEY_SCOPES,
  CREATE_KEY_SELECT,
  CREATE_KEY_SELECT_WRAP,
  CREATE_KEY_SUBMIT,
  CREATE_KEY_TICK,
  DELETE_CANCEL,
  MODAL_TITLE,
} from "./styles.ts";

export function CreateKeyDialog({ action, defaultName, children }: { action: string; defaultName: string; children: ReactNode }) {
  return (
    <PageDialog titleId="create-key" closeHref={DASHBOARD} className={CREATE_KEY_BOX}>
      <h2 className={MODAL_TITLE} id="create-key">
        Create an API key
      </h2>
      <form className={CREATE_KEY_FORM} method="post" action={action}>
        {children}
        <label className={CREATE_KEY_LABEL_FIRST} htmlFor="create-key-name">
          Name
        </label>
        <input
          className={CREATE_KEY_INPUT}
          id="create-key-name"
          name={KEY_NAME_FIELD}
          type="text"
          maxLength={KEY_NAME_MAX}
          autoComplete="off"
          placeholder="What's it for? e.g. Learning app"
          aria-describedby="create-key-hint"
        />
        <p className={CREATE_KEY_HINT} id="create-key-hint">
          Optional. Left empty, it's called {defaultName}.
        </p>

        <p className={CREATE_KEY_LABEL} id="create-key-endpoints">
          Endpoints
        </p>
        <div className={CREATE_KEY_SCOPES} role="radiogroup" aria-labelledby="create-key-endpoints" aria-describedby="create-key-endpoints-hint">
          <label className={CREATE_KEY_SCOPE}>
            <input className={CREATE_KEY_RADIO} type="radio" name={ENDPOINT_SCOPE_FIELD} value={ENDPOINT_SCOPE.all} defaultChecked />
            All endpoints
          </label>
          <label className={CREATE_KEY_SCOPE}>
            <input className={CREATE_KEY_RADIO} type="radio" name={ENDPOINT_SCOPE_FIELD} value={ENDPOINT_SCOPE.some} />
            Only some
          </label>
        </div>
        <p className={CREATE_KEY_SCOPE_HINT} id="create-key-endpoints-hint">
          Only some: pick the endpoints this key may call. Anything else answers 403.
        </p>
        <fieldset className={CREATE_KEY_CHECKLIST} aria-label="The endpoints this key may call">
          {ENDPOINTS.map((endpoint) => (
            <label key={endpoint} className={CREATE_KEY_CHECK}>
              <input className={CREATE_KEY_CHECKBOX} type="checkbox" name={ENDPOINT_FIELD} value={endpoint} />
              <CheckIcon className={CREATE_KEY_TICK} />
              {endpoint}
            </label>
          ))}
        </fieldset>

        <label className={CREATE_KEY_LABEL} htmlFor="create-key-expires">
          Expires
        </label>
        <div className={CREATE_KEY_SELECT_WRAP}>
          <select className={CREATE_KEY_SELECT} id="create-key-expires" name={EXPIRES_FIELD} defaultValue="never" aria-describedby="create-key-expires-hint">
            {KEY_LIFETIMES.map((lifetime) => (
              <option key={lifetime} value={lifetime}>
                {LIFETIME_LABEL[lifetime]}
              </option>
            ))}
          </select>
          <ChevronIcon className={CREATE_KEY_CHEVRON} />
        </div>
        <p className={CREATE_KEY_HINT} id="create-key-expires-hint">
          After this date the key answers 401.
        </p>

        <div className={CREATE_KEY_ACTIONS}>
          <a className={DELETE_CANCEL} href={DASHBOARD}>
            Cancel
          </a>
          <button className={CREATE_KEY_SUBMIT} type="submit">
            Create key
          </button>
        </div>
      </form>
    </PageDialog>
  );
}
