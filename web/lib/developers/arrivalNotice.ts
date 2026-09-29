// A toast that waits for the next page (#190). Deleting the account ends the
// session, so the browser leaves the dashboard for the landing page, and the
// toast that says so has to be shown there. The dialog leaves the notice in
// the tab's session storage just before it goes, and the landing page takes
// it, once, as it opens (ArrivalToast.tsx).

import { UNREACHABLE, type ActionAnswer } from "./dashboardActions.ts";
import type { DashboardToast } from "./keyFlow.ts";

/** What a page can leave for the next one to say. */
export type ArrivalNotice = "account-deleted";

/** The toast each notice is shown as (board 28f). */
export const ARRIVAL_TOAST: Readonly<Record<ArrivalNotice, DashboardToast>> = {
  "account-deleted": { tone: "success", message: "Your account was deleted." },
};

/** The storage key the notice waits under. */
export const ARRIVAL_KEY = "lexema:arrival";

/** Where a notice waits: the tab's `sessionStorage`, or a stand-in for it. */
export type NoticeStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** This tab's session storage, or `undefined` where the browser refuses it. */
export function tabStore(): NoticeStore | undefined {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

const isNotice = (value: string | null): value is ArrivalNotice => value !== null && Object.hasOwn(ARRIVAL_TOAST, value);

/** Leave a notice for the next page. A store that refuses it (private mode, quota) loses only the toast. */
export function leaveNotice(store: NoticeStore | undefined, notice: ArrivalNotice): void {
  try {
    store?.setItem(ARRIVAL_KEY, notice);
  } catch {
    // The deletion stands without its toast.
  }
}

/** The toast a notice left for this page, taken so it shows once; `undefined` when none waits. */
export function takeNotice(store: NoticeStore | undefined): DashboardToast | undefined {
  if (store === undefined) return undefined;
  try {
    const notice = store.getItem(ARRIVAL_KEY);
    store.removeItem(ARRIVAL_KEY);
    return isNotice(notice) ? ARRIVAL_TOAST[notice] : undefined;
  } catch {
    return undefined;
  }
}

/**
 * What the delete confirmation does with its answer: once the account is
 * deleted, leave the notice and go where the answer says (`go`), and answer
 * `undefined`; otherwise answer the reason to show above its buttons.
 */
export function afterDelete(answer: ActionAnswer, store: NoticeStore | undefined, go: (location: string) => void): string | undefined {
  if (answer.outcome === "signed-out") {
    leaveNotice(store, "account-deleted");
    go(answer.location);
    return undefined;
  }
  return answer.outcome === "refused" ? answer.message : UNREACHABLE;
}
