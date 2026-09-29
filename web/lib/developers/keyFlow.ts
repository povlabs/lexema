// Where the dashboard's key flow stands (#187, boards 28b to 28f), as values:
// the create dialog from its form to the new key (28e), the revoke
// confirmation (28d), and the toasts they end in (28f). Pure, so what the page
// does next is tested without a browser; DashboardFlow.tsx only wires it up.

import { UNREACHABLE, type ActionAnswer } from "./dashboardActions.ts";
import type { CreateKeyStatus } from "./createKeyForm.ts";
import { LIFETIME_LABEL } from "@lexema/api/keyAccess.ts";
import type { KeyRow } from "./dashboardView.ts";

/** A toast (board 28f): a success, with the accent's tick, or an error, with the warning's alert. */
export interface DashboardToast {
  readonly tone: "success" | "error";
  readonly message: string;
}

export const keyCreatedToast = (name: string): DashboardToast => ({ tone: "success", message: `Key “${name}” created` });
export const keyRevokedToast = (name: string): DashboardToast => ({ tone: "success", message: `Key “${name}” revoked` });
/** A revoke that failed with no reason worth more than trying again (board 28f). */
export const REVOKE_FAILED = "Couldn't revoke the key. Try again.";

/**
 * The create dialog. `closed`; `asking`, the form (28b) with where its send
 * stands; or `created`, the same dialog showing the new key (28e), whose
 * secret lives only here and goes when the dialog closes.
 */
export type KeyStep =
  | { readonly kind: "closed" }
  | { readonly kind: "asking"; readonly status: CreateKeyStatus }
  | { readonly kind: "created"; readonly key: KeyRow; readonly secret: string };

export const KEY_CLOSED: KeyStep = { kind: "closed" };
export const KEY_ASKING: KeyStep = { kind: "asking", status: { kind: "editing" } };

/** Where the create dialog goes on closing (Cancel, Done, Escape), and the toast a new key ends in. */
export function closeKeyStep(step: KeyStep): { readonly step: KeyStep; readonly toast?: DashboardToast } {
  if (step.kind === "asking" && step.status.kind === "sending") return { step };
  if (step.kind === "created") return { step: KEY_CLOSED, toast: keyCreatedToast(step.key.name) };
  return { step: KEY_CLOSED };
}

/** The create dialog once the server answered the form it sent: the new key in place, or the form with the refusal. */
export function answeredKeyStep(step: KeyStep, answer: ActionAnswer): KeyStep {
  if (step.kind !== "asking" || step.status.kind !== "sending") return step;
  switch (answer.outcome) {
    case "created":
      return { kind: "created", key: answer.key, secret: answer.secret };
    case "refused-form":
      return { kind: "asking", status: { kind: "refused", problems: answer.problems } };
    case "refused":
      return { kind: "asking", status: { kind: "failed", message: answer.message } };
    default:
      return { kind: "asking", status: { kind: "failed", message: UNREACHABLE } };
  }
}

const endpointCount = (count: number): string => `${count} endpoint${count === 1 ? "" : "s"}`;

/** The new key's line under "Key created" (28e): `Learning app · All endpoints · Never expires`. */
export function createdSummary(key: KeyRow): string {
  const endpoints = key.endpoints.kind === "all" ? "All endpoints" : endpointCount(key.endpoints.endpoints.length);
  const expires = key.expires === LIFETIME_LABEL.never ? "Never expires" : `Expires ${key.expires}`;
  return `${key.name} · ${endpoints} · ${expires}`;
}

/** A key's Revoke: nothing asked, the confirmation open (28d), or confirmed and on its way. */
export type RevokeStep = { readonly kind: "idle" } | { readonly kind: "asking" } | { readonly kind: "sending" };

export const REVOKE_IDLE: RevokeStep = { kind: "idle" };

/**
 * What the confirmation does with Revoke, Cancel (or Escape) and Revoke key.
 * Only Revoke key on an open confirmation sends: it closes the dialog, and the
 * answer arrives as a toast.
 */
export function revokeAfter(step: RevokeStep, event: "ask" | "cancel" | "confirm"): { readonly step: RevokeStep; readonly send: boolean } {
  if (step.kind === "sending") return { step, send: false };
  if (event === "ask") return { step: { kind: "asking" }, send: false };
  if (event === "confirm" && step.kind === "asking") return { step: { kind: "sending" }, send: true };
  return { step: REVOKE_IDLE, send: false };
}

/** The toast a revoke ends in: the key revoked, or why not. */
export function revokeToast(name: string, answer: ActionAnswer): DashboardToast {
  if (answer.outcome === "revoked") return keyRevokedToast(name);
  const reason = answer.outcome === "refused" && answer.message !== UNREACHABLE ? answer.message : REVOKE_FAILED;
  return { tone: "error", message: reason };
}
