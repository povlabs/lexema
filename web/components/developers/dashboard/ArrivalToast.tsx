"use client";

// The toast a page left for this one (#190): on the landing page, "Your account
// was deleted." after the settings page deleted it. Shown by Base UI's toasts
// in board 28f's style (DashboardToasts.tsx), once: the notice is taken as the
// page opens (arrivalNotice.ts).

import { useEffect } from "react";
import { tabStore, takeNotice } from "@/lib/developers/arrivalNotice.ts";
import { DashboardToasts, useShowToast } from "./DashboardToasts";

function TakeNotice() {
  const showToast = useShowToast();
  useEffect(() => {
    const toast = takeNotice(tabStore());
    if (toast !== undefined) showToast(toast);
  }, [showToast]);
  return null;
}

export function ArrivalToast() {
  return (
    <DashboardToasts>
      <TakeNotice />
    </DashboardToasts>
  );
}
