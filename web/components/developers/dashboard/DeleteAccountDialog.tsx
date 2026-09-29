"use client";

// Board 30: the confirmation Delete account opens on the settings page (#163
// R1.4, #190). The account is deleted only from here: Delete account sends the
// session's CSRF token and `confirm=delete-account` with fetch, and a refusal
// is said above the buttons. Once deleted, the session is gone, so the page
// goes where signing out goes, the landing page, and leaves it the notice that
// shows "Your account was deleted." there (arrivalNotice.ts). Cancel and
// Escape close it. It is Base UI's alert dialog (ADR 0010), so a click on the
// dimmed page does not close it.

import { AlertDialog } from "@base-ui/react/alert-dialog";
import { useState } from "react";
import { afterDelete, tabStore } from "@/lib/developers/arrivalNotice.ts";
import { CSRF_FIELD, DELETE_ACCOUNT_ACTION, DELETE_CONFIRM_FIELD, DELETE_CONFIRMATION, sendAction } from "@/lib/developers/dashboardActions.ts";
import { DashboardModal } from "./DashboardModal";
import { BUTTON_DANGER, CONFIRM_ACTIONS, CONFIRM_BOX, CONFIRM_TEXT, DIALOG_CANCEL, DIALOG_FAILURE, MODAL_TITLE } from "@/components/shared/styles.ts";

/** Delete account, and the confirmation it opens (board 30). */
export function DeleteAccountControl({ className, warning, csrf }: { className: string; warning: string; csrf: string }) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger className={className}>Delete account</AlertDialog.Trigger>
      <DashboardModal className={CONFIRM_BOX}>
        <DeleteAccount warning={warning} csrf={csrf} />
      </DashboardModal>
    </AlertDialog.Root>
  );
}

/** The delete form while it is open: not yet sent, on its way, or refused with the reason. */
type DeleteStatus = { readonly kind: "ready" } | { readonly kind: "sending" } | { readonly kind: "failed"; readonly message: string };

/** What the delete confirmation holds: drawn inside its `AlertDialog.Popup`. */
export function DeleteAccount({ warning, csrf }: { warning: string; csrf: string }) {
  const [status, setStatus] = useState<DeleteStatus>({ kind: "ready" });
  const send = () => {
    if (status.kind === "sending") return;
    setStatus({ kind: "sending" });
    const fields = new URLSearchParams({ [CSRF_FIELD]: csrf, [DELETE_CONFIRM_FIELD]: DELETE_CONFIRMATION });
    void sendAction(DELETE_ACCOUNT_ACTION, fields).then((answer) => {
      const reason = afterDelete(answer, tabStore(), (location) => window.location.assign(location));
      if (reason !== undefined) setStatus({ kind: "failed", message: reason });
    });
  };
  return (
    <>
      <AlertDialog.Title className={MODAL_TITLE}>Delete your account?</AlertDialog.Title>
      <AlertDialog.Description className={CONFIRM_TEXT}>{warning}</AlertDialog.Description>
      {status.kind === "failed" && (
        <p className={DIALOG_FAILURE} role="alert">
          {status.message}
        </p>
      )}
      <div className={CONFIRM_ACTIONS}>
        <AlertDialog.Close className={DIALOG_CANCEL}>Cancel</AlertDialog.Close>
        <button className={BUTTON_DANGER} type="button" disabled={status.kind === "sending"} onClick={send}>
          Delete account
        </button>
      </div>
    </>
  );
}
