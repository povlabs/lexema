"use client";

// Small pieces every dashboard form and dialog shares (#169, #187): the CSRF
// field, and the link that closes a dialog, in place with a script.

import type { MouseEvent, ReactNode } from "react";
import { CSRF_FIELD, DASHBOARD } from "./dashboardActions.ts";

/** The session's CSRF token, as every dashboard form carries it. */
export function CsrfField({ csrf }: { csrf: string }) {
  return <input type="hidden" name={CSRF_FIELD} value={csrf} />;
}

/** A click the page may take over: the main button, no key held that asks for a new tab or window. */
export const plainClick = (event: MouseEvent): boolean =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

/** A dialog's way back to the dashboard: a link there, or, with a script, the dialog closed in place. */
export function CloseLink({ className, onClose, label, children }: { className: string; onClose: () => void; label?: string; children: ReactNode }) {
  return (
    <a
      className={className}
      href={DASHBOARD}
      aria-label={label}
      onClick={(event) => {
        if (!plainClick(event)) return;
        event.preventDefault();
        onClose();
      }}
    >
      {children}
    </a>
  );
}
