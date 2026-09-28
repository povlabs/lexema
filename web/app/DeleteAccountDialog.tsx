// Board 30: the confirmation Delete account opens (#163 R1.4), drawn by the
// server at `/dashboard?confirm=delete`, so it opens with no script too. The
// account is deleted only from this dialog's form, which posts to the
// dashboard action with the session's CSRF token and `confirm=delete-account`;
// the page hands those fields in as `children`. Cancel goes back to the
// dashboard.

import type { ReactNode } from "react";
import { DASHBOARD } from "../worker/dashboard.ts";
import { PageDialog } from "./PageDialog";
import { BUTTON_DANGER, DELETE_BOX, DELETE_CANCEL, DELETE_TEXT, DELETE_ACTIONS, MODAL_TITLE } from "./styles.ts";

export function DeleteAccountDialog({ action, warning, children }: { action: string; warning: string; children: ReactNode }) {
  return (
    <PageDialog titleId="delete-account" descriptionId="delete-account-warning" closeHref={DASHBOARD} className={DELETE_BOX}>
      <h2 className={MODAL_TITLE} id="delete-account">
        Delete your account?
      </h2>
      <p className={DELETE_TEXT} id="delete-account-warning">
        {warning}
      </p>
      <form className={DELETE_ACTIONS} method="post" action={action}>
        {children}
        <a className={DELETE_CANCEL} href={DASHBOARD}>
          Cancel
        </a>
        <button className={BUTTON_DANGER} type="submit">
          Delete account
        </button>
      </form>
    </PageDialog>
  );
}
