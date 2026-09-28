"use client";

// Delete account, and the confirmation it opens (#169, board 30; #163 R1.4).
// The account is deleted only from the dialog's own form, which posts to the
// dashboard action with the session's CSRF token and `confirm=delete-account`;
// the page hands those fields in as `children`, so this file carries no
// server code.
//
// Base UI supplies the dialog's behaviour (ADR 0010), as it does for the
// report box: focus is kept inside, Escape and Cancel close it, and the page
// behind is inert while it is open.

import { Dialog } from "@base-ui/react/dialog";
import type { ReactNode } from "react";
import {
  BUTTON_DANGER,
  BUTTON_DANGER_OUTLINE,
  BUTTON_SECONDARY,
  MODAL_ACTIONS,
  MODAL_BACKDROP,
  MODAL_POPUP,
  MODAL_TEXT,
  MODAL_TITLE,
} from "./styles.ts";

export function DeleteAccountDialog({ action, warning, children }: { action: string; warning: string; children: ReactNode }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger className={BUTTON_DANGER_OUTLINE}>Delete account</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className={MODAL_BACKDROP} />
        <Dialog.Popup className={MODAL_POPUP}>
          <Dialog.Title className={MODAL_TITLE}>Delete your account?</Dialog.Title>
          <Dialog.Description className={MODAL_TEXT}>{warning}</Dialog.Description>
          <form className={MODAL_ACTIONS} method="post" action={action}>
            {children}
            <Dialog.Close className={BUTTON_SECONDARY}>Cancel</Dialog.Close>
            <button className={BUTTON_DANGER} type="submit">
              Delete account
            </button>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
