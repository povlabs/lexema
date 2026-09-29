// A dashboard dialog (#169, #187, boards 28b, 29 and 30): over a dimmed page,
// in the middle of the screen. The server can draw it open by the page's
// address, so it shows with no script at all: `/dashboard?create=key` after
// Create key, the key-created page after a new key, and
// `/dashboard?confirm=delete` after Delete account. With a script it opens in
// place instead (DashboardFlow.tsx). The page behind is `inert` while it is
// open, so the keyboard stays in the dialog.
//
// Base UI's dialog (ADR 0010) is drawn only in the browser, into a portal, and
// so never in the server's HTML; these open from the server too, so they are
// drawn here. `DialogKeys` adds what a script can: the dialog takes the
// focus, and Escape closes it the way its Cancel, Done or × does.

import type { ReactNode } from "react";
import { DialogKeys } from "./DialogKeys";
import { MODAL_LAYER } from "./styles.ts";

export function PageDialog({
  titleId,
  descriptionId,
  onClose,
  className,
  children,
}: {
  titleId: string;
  descriptionId?: string;
  /** What Escape does: what the dialog's own Cancel, Done or × does. */
  onClose: () => void;
  className: string;
  children: ReactNode;
}) {
  return (
    <div className={MODAL_LAYER}>
      <section className={className} role="dialog" tabIndex={-1} aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>
        <DialogKeys onClose={onClose} />
        {children}
      </section>
    </div>
  );
}
