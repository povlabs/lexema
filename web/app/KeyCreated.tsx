// Board 29: a new key's secret, shown once, in a dialog over the dashboard,
// with Copy and the note that it will not be shown again. With no script,
// worker/dashboard.ts hands the secret to one request and clears it, so a
// reload finds none and lands on the dashboard; with one, the secret came in
// the create answer and lives only while this dialog is open
// (DashboardFlow.tsx). Done and × go back to the dashboard.

import { CopySecret } from "./CopySecret";
import { CloseLink } from "./DashboardControls";
import { CloseIcon } from "./MenuIcons";
import { PageDialog } from "./PageDialog";
import {
  KEY_CREATED_BOX,
  KEY_CREATED_HEAD,
  KEY_CREATED_NAME,
  KEY_CREATED_NOTE,
  KEY_SECRET,
  KEY_SECRET_TEXT,
  KEY_CREATED_ACTIONS,
  KEY_DONE,
  MODAL_TITLE,
  MODAL_X,
  MODAL_X_ICON,
} from "./styles.ts";

export function KeyCreatedDialog({ name, secret, onClose }: { name: string; secret: string; onClose: () => void }) {
  return (
    <PageDialog titleId="key-created" onClose={onClose} className={KEY_CREATED_BOX}>
      <div className={KEY_CREATED_HEAD}>
        <h2 className={MODAL_TITLE} id="key-created">
          Key created
        </h2>
        <CloseLink className={MODAL_X} onClose={onClose} label="Close">
          <CloseIcon className={MODAL_X_ICON} />
        </CloseLink>
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
        <CloseLink className={KEY_DONE} onClose={onClose}>
          Done
        </CloseLink>
      </div>
    </PageDialog>
  );
}
