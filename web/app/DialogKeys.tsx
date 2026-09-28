"use client";

// The keys of a dialog the server draws open (PageDialog.tsx): on arrival the
// dialog itself takes the focus, so Tab starts inside it and no control is
// ringed before it is reached; Escape goes where the dialog's close link goes.

import { useEffect } from "react";

export function DialogKeys({ closeHref }: { closeHref: string }) {
  useEffect(() => {
    document.querySelector<HTMLElement>('[role="dialog"]')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") window.location.assign(closeHref);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeHref]);
  return null;
}
