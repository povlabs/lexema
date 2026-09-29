// The dashboard's address and its actions' answers (#168, #169, #187),
// shared by the Worker that answers them (worker/dashboard.ts) and the page
// that sends them. Nothing here reaches the database, so the browser loads it.
//
// Every action is a POST of form fields, which the page sends with fetch from
// its dialogs and key rows (DashboardFlow.tsx). Each is answered with one
// `ActionAnswer` in JSON, so the page changes in place.

import type { CreateKeyProblems } from "./createKeyForm.ts";
import type { KeyRow } from "./dashboardView.ts";

/** Where the dashboard lives, and its settings page (#190). */
export const DASHBOARD = "/dashboard";
export const SETTINGS = "/dashboard/settings";

/** Where each form posts. */
export const CREATE_KEY_ACTION = "/dashboard/keys";
export const revokeKeyAction = (keyId: number): string => `/dashboard/keys/${keyId}/revoke`;
export const DELETE_ACCOUNT_ACTION = "/dashboard/account/delete";

/** The form field carrying the session's CSRF token. */
export const CSRF_FIELD = "csrf";
/** The delete form's field, and what it must say for the account to be deleted. */
export const DELETE_CONFIRM_FIELD = "confirm";
export const DELETE_CONFIRMATION = "delete-account";

/** The type of an action's answer, which the page's POST asks for in `Accept`. */
export const JSON_ANSWER = "application/json";

/**
 * What an action answers.
 *
 * - `created` (201): the new key's row as the list shows it, and its secret, once.
 * - `refused-form` (400): the create form's problems, each under its field.
 * - `revoked` (200): the key no longer has a row.
 * - `signed-out` (200): the account is deleted and the session with it; the page goes to `location`.
 * - `refused` (401, 403, 404, 400, 503): why nothing changed.
 *
 * The key-creation limit answers before the action runs: a 429 whose body is
 * the sentence to show (worker/rateLimit.ts).
 */
export type ActionAnswer =
  | { readonly outcome: "created"; readonly key: KeyRow; readonly secret: string }
  | { readonly outcome: "refused-form"; readonly problems: CreateKeyProblems }
  | { readonly outcome: "revoked"; readonly keyId: number }
  | { readonly outcome: "signed-out"; readonly location: string }
  | { readonly outcome: "refused"; readonly message: string };

/** What the page says when an action could not be reached at all. */
export const UNREACHABLE = "That could not be done. Try again later.";

const OUTCOMES: readonly string[] = ["created", "refused-form", "revoked", "signed-out", "refused"];

/** An action's answer, read off its response: its JSON, or, for a response that is not one (the limit's 429), its text as the reason. */
export async function answerOf(response: Response): Promise<ActionAnswer> {
  if ((response.headers.get("content-type") ?? "").startsWith(JSON_ANSWER)) {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "outcome" in body && OUTCOMES.includes(String(body.outcome))) return body as ActionAnswer;
    return { outcome: "refused", message: UNREACHABLE };
  }
  const message = (await response.text()).trim();
  return { outcome: "refused", message: message === "" ? UNREACHABLE : message };
}

/** Send a dashboard action's fields from the page and read the answer. The browser adds the session cookie and the `Origin`. */
export async function sendAction(action: string, form: FormData | URLSearchParams, send: typeof fetch = fetch): Promise<ActionAnswer> {
  try {
    return await answerOf(await send(action, { method: "POST", body: form, headers: { accept: JSON_ANSWER } }));
  } catch {
    return { outcome: "refused", message: UNREACHABLE };
  }
}
