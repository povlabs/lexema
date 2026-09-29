"use client";

// Board 28f: the dashboard's toasts, Base UI's (ADR 0010). A new key when its
// dialog closes, a revoked key, and a revoke that failed each end in one.
// Base UI stacks them, reads each out, closes each after 5 seconds, and keeps
// them while the pointer is over them; × closes one at once.

import { Toast } from "@base-ui/react/toast";
import { useCallback, type ReactNode } from "react";
import { AlertIcon } from "@/components/shared/icons";
import type { DashboardToast } from "@/lib/developers/keyFlow.ts";
import { CheckIcon, CloseIcon } from "@/components/shared/MenuIcons";
import { TOAST, TOAST_ERROR_ICON, TOAST_SUCCESS_ICON, TOAST_TEXT, TOAST_VIEWPORT, TOAST_X, TOAST_X_ICON } from "@/components/shared/styles.ts";

/** How long a toast stays, in milliseconds, unless the pointer is over it. */
export const TOAST_TIMEOUT = 5000;

/** The toasts' place on the page, around the controls that show them (`children`). */
export function DashboardToasts({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider timeout={TOAST_TIMEOUT}>
      {children}
      <ToastList />
    </Toast.Provider>
  );
}

/** Show a toast; drawn inside `DashboardToasts`. */
export function useShowToast(): (toast: DashboardToast) => void {
  const { add } = Toast.useToastManager();
  return useCallback((toast: DashboardToast) => void add({ title: toast.message, type: toast.tone, priority: toast.tone === "error" ? "high" : "low" }), [add]);
}

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return (
    <Toast.Portal>
      <Toast.Viewport className={TOAST_VIEWPORT}>
        {toasts.map((toast) => (
          <Toast.Root key={toast.id} toast={toast} className={TOAST}>
            {toast.type === "error" ? <AlertIcon className={TOAST_ERROR_ICON} /> : <CheckIcon className={TOAST_SUCCESS_ICON} />}
            <Toast.Title className={TOAST_TEXT} />
            <Toast.Close className={TOAST_X} aria-label="Close">
              <CloseIcon className={TOAST_X_ICON} />
            </Toast.Close>
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  );
}
