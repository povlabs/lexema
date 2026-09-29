"use client";

// Board 30: the confirmation Delete account opens (#163 R1.4). The account is
// deleted only from here: Delete account sends the session's CSRF token and
// `confirm=delete-account` with fetch, and a refusal is said above the
// buttons. Once deleted, the session is gone, so the page goes where signing
// out goes. Cancel and Escape close it.

import { Dialog } from "@base-ui/react/dialog";
import { useState } from "react";
import { CSRF_FIELD, DELETE_ACCOUNT_ACTION, DELETE_CONFIRM_FIELD, DELETE_CONFIRMATION, sendAction, UNREACHABLE } from "./dashboardActions.ts";
import { BUTTON_DANGER, DELETE_ACTIONS, DELETE_CANCEL, DELETE_TEXT, DIALOG_FAILURE, MODAL_TITLE } from "./styles.ts";

/** The delete form while it is open: not yet sent, on its way, or refused with the reason. */
type DeleteStatus = { readonly kind: "ready" } | { readonly kind: "sending" } | { readonly kind: "failed"; readonly message: string };

/** What the delete confirmation holds: drawn inside its `Dialog.Popup`. */
export function DeleteAccount({ warning, csrf }: { warning: string; csrf: string }) {
  const [status, setStatus] = useState<DeleteStatus>({ kind: "ready" });
  const send = () => {
    if (status.kind === "sending") return;
    setStatus({ kind: "sending" });
    const fields = new URLSearchParams({ [CSRF_FIELD]: csrf, [DELETE_CONFIRM_FIELD]: DELETE_CONFIRMATION });
    void sendAction(DELETE_ACCOUNT_ACTION, fields).then((answer) => {
      if (answer.outcome === "signed-out") window.location.assign(answer.location);
      else setStatus({ kind: "failed", message: answer.outcome === "refused" ? answer.message : UNREACHABLE });
    });
  };
  return (
    <>
      <Dialog.Title className={MODAL_TITLE}>Delete your account?</Dialog.Title>
      <Dialog.Description className={DELETE_TEXT}>{warning}</Dialog.Description>
      {status.kind === "failed" && (
        <p className={DIALOG_FAILURE} role="alert">
          {status.message}
        </p>
      )}
      <div className={DELETE_ACTIONS}>
        <Dialog.Close className={DELETE_CANCEL}>Cancel</Dialog.Close>
        <button className={BUTTON_DANGER} type="button" disabled={status.kind === "sending"} onClick={send}>
          Delete account
        </button>
      </div>
    </>
  );
}
