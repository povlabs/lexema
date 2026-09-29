// Board 28b (28bm on a phone): the name a new key will carry, asked before it
// is made (#187). Create key on the dashboard is a link to
// `/dashboard?create=key`, which the server draws with this dialog open, so the
// button never makes a key on its own, script or no script. The name is
// optional: left empty, the key gets the default the hint names. The form posts
// to the create action with the session's CSRF token, which the page hands in
// as `children`; Cancel, and Escape with a script, go back to the dashboard.

import type { ReactNode } from "react";
import { KEY_NAME_MAX } from "@lexema/api/ownedKeys.ts";
import { DASHBOARD, KEY_NAME_FIELD } from "../worker/dashboard.ts";
import { PageDialog } from "./PageDialog";
import {
  CREATE_KEY_ACTIONS,
  CREATE_KEY_BOX,
  CREATE_KEY_HINT,
  CREATE_KEY_INPUT,
  CREATE_KEY_LABEL,
  CREATE_KEY_SUBMIT,
  DELETE_CANCEL,
  MODAL_TITLE,
} from "./styles.ts";

export function CreateKeyDialog({ action, defaultName, children }: { action: string; defaultName: string; children: ReactNode }) {
  return (
    <PageDialog titleId="create-key" closeHref={DASHBOARD} className={CREATE_KEY_BOX}>
      <h2 className={MODAL_TITLE} id="create-key">
        Create an API key
      </h2>
      <form method="post" action={action}>
        {children}
        <label className={CREATE_KEY_LABEL} htmlFor="create-key-name">
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
