"use client";

// The keys of a dashboard dialog (PageDialog.tsx): on arrival the dialog
// itself takes the focus, so Tab starts inside it and no control is ringed
// before it is reached; Escape closes it the way its Cancel, Done or × does.

import { useEffect, useRef } from "react";

export function DialogKeys({ onClose }: { onClose: () => void }) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    document.querySelector<HTMLElement>('[role="dialog"]')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return null;
}
