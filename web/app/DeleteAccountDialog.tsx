"use client";

// Board 30: the confirmation Delete account opens (#163 R1.4), drawn by the
// server at `/dashboard?confirm=delete`, so it opens with no script too. The
// account is deleted only from this dialog's form, which posts to the
// dashboard action with the session's CSRF token and `confirm=delete-account`.
// With a script the form is sent with fetch (DashboardFlow.tsx), and a
// refusal is said above the buttons; once deleted, the session is gone, so
// the page goes where signing out goes. Cancel goes back to the dashboard.

import { useState } from "react";
import { CloseLink, CsrfField } from "./DashboardControls";
import { DELETE_ACCOUNT_ACTION, DELETE_CONFIRM_FIELD, DELETE_CONFIRMATION, sendAction, UNREACHABLE } from "./dashboardActions.ts";
import { PageDialog } from "./PageDialog";
import { BUTTON_DANGER, DELETE_ACTIONS, DELETE_BOX, DELETE_CANCEL, DELETE_TEXT, DIALOG_FAILURE, MODAL_TITLE } from "./styles.ts";

/** The delete form while it is open: not yet sent, on its way, or refused with the reason. */
type DeleteStatus = { readonly kind: "ready" } | { readonly kind: "sending" } | { readonly kind: "failed"; readonly message: string };

export function DeleteAccountDialog({ warning, csrf, onClose }: { warning: string; csrf: string; onClose: () => void }) {
  const [status, setStatus] = useState<DeleteStatus>({ kind: "ready" });
  return (
    <PageDialog titleId="delete-account" descriptionId="delete-account-warning" onClose={onClose} className={DELETE_BOX}>
      <h2 className={MODAL_TITLE} id="delete-account">
        Delete your account?
      </h2>
      <p className={DELETE_TEXT} id="delete-account-warning">
        {warning}
      </p>
      {status.kind === "failed" && (
        <p className={DIALOG_FAILURE} role="alert">
          {status.message}
        </p>
      )}
      <form
        className={DELETE_ACTIONS}
        method="post"
        action={DELETE_ACCOUNT_ACTION}
        onSubmit={(event) => {
          event.preventDefault();
          if (status.kind === "sending") return;
          const form = new FormData(event.currentTarget);
          setStatus({ kind: "sending" });
          void sendAction(DELETE_ACCOUNT_ACTION, form).then((answer) => {
            if (answer.outcome === "signed-out") window.location.assign(answer.location);
            else setStatus({ kind: "failed", message: answer.outcome === "refused" ? answer.message : UNREACHABLE });
          });
        }}
      >
        <CsrfField csrf={csrf} />
        <input type="hidden" name={DELETE_CONFIRM_FIELD} value={DELETE_CONFIRMATION} />
        <CloseLink className={DELETE_CANCEL} onClose={onClose}>
          Cancel
        </CloseLink>
        <button className={BUTTON_DANGER} type="submit" disabled={status.kind === "sending"}>
          Delete account
        </button>
      </form>
    </PageDialog>
  );
}
