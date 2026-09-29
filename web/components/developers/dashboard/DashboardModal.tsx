"use client";

// The frame of a dashboard dialog (boards 28b to 28e and 30): Base UI's dialog
// (ADR 0010), as the report box (ReportDialog.tsx) uses it. Base UI keeps the
// focus inside while it is open, makes the page behind inert, and closes it on
// Escape; the dialog's own root holds whether it is open. The same frame sits
// in an `AlertDialog.Root` for the revoke and delete confirmations: Base UI's
// alert dialog is made of these very parts, and its root keeps a click on the
// dimmed page from closing it.

import { Dialog } from "@base-ui/react/dialog";
import type { ReactNode } from "react";
import { MODAL_BACKDROP, MODAL_VIEWPORT } from "@/components/shared/styles.ts";

export function DashboardModal({ className, children }: { className: string; children: ReactNode }) {
  return (
    <Dialog.Portal>
      <Dialog.Backdrop className={MODAL_BACKDROP} />
      <Dialog.Viewport className={MODAL_VIEWPORT}>
        <Dialog.Popup className={className}>{children}</Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
  );
}
