// developers.lexema.fyi/dashboard/key-created (#169, board 29): a new key's
// secret, shown once, with Copy and the note that it will not be shown again.
// worker/dashboard.ts hands the secret to this one request and clears it, so
// a reload finds none and lands on the dashboard. Done and × go back there.

import { DASHBOARD } from "../worker/dashboard.ts";
import { CopySecret } from "./CopySecret";
import {
  BUTTON_PRIMARY,
  KEY_CREATED_NAME,
  KEY_SECRET,
  KEY_SECRET_TEXT,
  MODAL_ACTIONS,
  MODAL_BOX,
  MODAL_PAGE,
  MODAL_TEXT,
  MODAL_TITLE,
  MODAL_X,
} from "./styles.ts";

export function KeyCreated({ name, secret }: { name: string; secret: string }) {
  return (
    <main className={MODAL_PAGE}>
      <section className={MODAL_BOX} aria-labelledby="key-created">
        <h1 className={MODAL_TITLE} id="key-created">
          Key created
        </h1>
        <a className={MODAL_X} href={DASHBOARD} aria-label="Close">
          ×
        </a>
        <p className={KEY_CREATED_NAME}>{name}</p>
        <div className={KEY_SECRET}>
          <p className={KEY_SECRET_TEXT} data-secret>
            {secret}
          </p>
          <CopySecret text={secret} />
        </div>
        <p className={MODAL_TEXT}>Copy it now. You won't be able to see it again.</p>
        <div className={MODAL_ACTIONS}>
          <a className={BUTTON_PRIMARY} href={DASHBOARD}>
            Done
          </a>
        </div>
      </section>
    </main>
  );
}
