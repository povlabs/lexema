"use client";

// Board 28d: the confirmation Revoke opens. The key is revoked only from
// here: Revoke key closes it and sends the revoke (DashboardFlow.tsx), and
// the answer arrives as a toast. Cancel and Escape close it and send nothing.
// It is Base UI's alert dialog (ADR 0010), so a click on the dimmed page does
// not close it.

import { AlertDialog } from "@base-ui/react/alert-dialog";
import type { KeyRow } from "./dashboardView.ts";
import { BUTTON_DANGER, CONFIRM_ACTIONS, CONFIRM_TEXT, DIALOG_CANCEL, MODAL_TITLE } from "./styles.ts";

/** What the revoke confirmation holds: drawn inside its `AlertDialog.Popup`. */
export function RevokeKey({ keyRow, onConfirm }: { keyRow: KeyRow; onConfirm: () => void }) {
  return (
    <>
      <AlertDialog.Title className={MODAL_TITLE}>Revoke “{keyRow.name}”?</AlertDialog.Title>
      <AlertDialog.Description className={CONFIRM_TEXT}>
        Any app using {keyRow.prefix} will stop working right away. This can't be undone.
      </AlertDialog.Description>
      <div className={CONFIRM_ACTIONS}>
        <AlertDialog.Close className={DIALOG_CANCEL}>Cancel</AlertDialog.Close>
        <button className={BUTTON_DANGER} type="button" onClick={onConfirm}>
          Revoke key
        </button>
      </div>
    </>
  );
}
