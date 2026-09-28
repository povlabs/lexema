// Board 29: a new key's secret, shown once, in a dialog over the dashboard,
// with Copy and the note that it will not be shown again. worker/dashboard.ts
// hands the secret to one request and clears it, so a reload finds none and
// lands on the dashboard. Done and × go back there.

import { DASHBOARD } from "../worker/dashboard.ts";
import { CopySecret } from "./CopySecret";
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

export function KeyCreatedDialog({ name, secret }: { name: string; secret: string }) {
  return (
    <PageDialog titleId="key-created" closeHref={DASHBOARD} className={KEY_CREATED_BOX}>
      <div className={KEY_CREATED_HEAD}>
        <h2 className={MODAL_TITLE} id="key-created">
          Key created
        </h2>
        <a className={MODAL_X} href={DASHBOARD} aria-label="Close">
          <CloseIcon className={MODAL_X_ICON} />
        </a>
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
        <a className={KEY_DONE} href={DASHBOARD}>
          Done
        </a>
      </div>
    </PageDialog>
  );
}
