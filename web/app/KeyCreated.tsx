"use client";

// Board 29: a new key's secret, shown once, with Copy and the note that it
// will not be shown again. The secret came in the create answer and lives
// only while this dialog is open (DashboardFlow.tsx). Done, × and Escape
// close it.

import { Dialog } from "@base-ui/react/dialog";
import { CopySecret } from "./CopySecret";
import { CloseIcon } from "./MenuIcons";
import {
  KEY_CREATED_ACTIONS,
  KEY_CREATED_HEAD,
  KEY_CREATED_NAME,
  KEY_CREATED_NOTE,
  KEY_DONE,
  KEY_SECRET,
  KEY_SECRET_TEXT,
  MODAL_TITLE,
  MODAL_X,
  MODAL_X_ICON,
} from "./styles.ts";

/** What the Key created dialog holds: drawn inside its `Dialog.Popup`. */
export function KeyCreated({ name, secret }: { name: string; secret: string }) {
  return (
    <>
      <div className={KEY_CREATED_HEAD}>
        <Dialog.Title className={MODAL_TITLE}>Key created</Dialog.Title>
        <Dialog.Close className={MODAL_X} aria-label="Close">
          <CloseIcon className={MODAL_X_ICON} />
        </Dialog.Close>
      </div>
      <p className={KEY_CREATED_NAME}>{name}</p>
      <div className={KEY_SECRET}>
        <p className={KEY_SECRET_TEXT} data-secret>
          {secret}
        </p>
        <CopySecret text={secret} />
      </div>
      <p className={KEY_CREATED_NOTE}>Copy it now. You won't be able to see it again.</p>
      <div className={KEY_CREATED_ACTIONS}>
        <Dialog.Close className={KEY_DONE}>Done</Dialog.Close>
      </div>
    </>
  );
}
