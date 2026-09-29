"use client";

// The frame of a dashboard dialog (boards 28b, 29 and 30): Base UI's dialog
// (ADR 0010), as the report box (ReportDialog.tsx) uses it. Base UI keeps the
// focus inside while it is open, makes the page behind inert, and closes it on
// Escape or a click on the dimmed page; the dialog's own `Dialog.Root` holds
// whether it is open.

import { Dialog } from "@base-ui/react/dialog";
import type { ReactNode, RefObject } from "react";
import { MODAL_BACKDROP, MODAL_VIEWPORT } from "./styles.ts";

export function DashboardModal({
  className,
  finalFocus,
  children,
}: {
  className: string;
  /** Where the focus goes when it closes, for a dialog no trigger of its own opened. */
  finalFocus?: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  return (
    <Dialog.Portal>
      <Dialog.Backdrop className={MODAL_BACKDROP} />
      <Dialog.Viewport className={MODAL_VIEWPORT}>
        <Dialog.Popup className={className} finalFocus={finalFocus}>
          {children}
        </Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
  );
}
