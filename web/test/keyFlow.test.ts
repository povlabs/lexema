// Where the dashboard's key flow goes next (#187, boards 28d to 28f): the
// create dialog from its form to the new key in the same dialog, the revoke
// confirmation, and the toasts each ends in. What each dialog holds is
// web/test/signedIn.test.tsx.

import assert from "node:assert/strict";
import { test } from "node:test";
import { ALL_ENDPOINTS } from "../../src/api/keyAccess.js";
import { UNREACHABLE, type ActionAnswer } from "../app/dashboardActions.ts";
import type { KeyRow } from "../app/dashboardView.ts";
import {
  answeredKeyStep,
  closeKeyStep,
  createdSummary,
  KEY_ASKING,
  KEY_CLOSED,
  keyCreatedToast,
  keyRevokedToast,
  REVOKE_FAILED,
  REVOKE_IDLE,
  revokeAfter,
  revokeToast,
  type KeyStep,
  type RevokeStep,
} from "../app/keyFlow.ts";

const LEARNING_APP: KeyRow = {
  keyId: 7,
  name: "Learning app",
  prefix: "lx_7f3a9c21…",
  created: "29 Sep 2026",
  lastUsed: "never",
  endpoints: ALL_ENDPOINTS,
  expires: "Never",
};
const SECRET = `lx_${"ab".repeat(32)}`;
const SENDING: KeyStep = { kind: "asking", status: { kind: "sending" } };
const ASKING: RevokeStep = { kind: "asking" };

test("the toasts say what board 28f says", () => {
  assert.deepEqual(keyCreatedToast("Learning app"), { tone: "success", message: "Key “Learning app” created" });
  assert.deepEqual(keyRevokedToast("Learning app"), { tone: "success", message: "Key “Learning app” revoked" });
  assert.deepEqual(revokeToast("Learning app", { outcome: "revoked", keyId: 7 }), keyRevokedToast("Learning app"));
  // A revoke that could not be done, for no reason but trying again: the board's error.
  assert.deepEqual(revokeToast("Learning app", { outcome: "refused", message: UNREACHABLE }), { tone: "error", message: "Couldn't revoke the key. Try again." });
  assert.equal(REVOKE_FAILED, "Couldn't revoke the key. Try again.");
  // A refusal with a reason says it.
  assert.deepEqual(revokeToast("Learning app", { outcome: "refused", message: "This form has expired. Reload the page and try again." }), {
    tone: "error",
    message: "This form has expired. Reload the page and try again.",
  });
});

test("a created key takes the form's place in the same dialog, and closing it says Key created in a toast", () => {
  const created: ActionAnswer = { outcome: "created", key: LEARNING_APP, secret: SECRET };
  const shown = answeredKeyStep(SENDING, created);
  assert.deepEqual(shown, { kind: "created", key: LEARNING_APP, secret: SECRET });
  // Done, × or Escape: the dialog closes, the secret goes with it, and the toast names the key.
  assert.deepEqual(closeKeyStep(shown), { step: KEY_CLOSED, toast: keyCreatedToast("Learning app") });
});

test("closing the form makes no toast, and the dialog stays while its form is on its way", () => {
  assert.deepEqual(closeKeyStep(KEY_ASKING), { step: KEY_CLOSED });
  assert.deepEqual(closeKeyStep({ kind: "asking", status: { kind: "failed", message: "Sign in first." } }), { step: KEY_CLOSED });
  assert.deepEqual(closeKeyStep(SENDING), { step: SENDING }, "an answer on its way has a dialog to land in");
});

test("a refused form stays in the dialog, its problems by field or the reason above the buttons", () => {
  assert.deepEqual(answeredKeyStep(SENDING, { outcome: "refused-form", problems: [{ field: "endpoints", message: "Tick at least one endpoint." }] }), {
    kind: "asking",
    status: { kind: "refused", problems: [{ field: "endpoints", message: "Tick at least one endpoint." }] },
  });
  assert.deepEqual(answeredKeyStep(SENDING, { outcome: "refused", message: "Too many keys made. Try again in a minute." }), {
    kind: "asking",
    status: { kind: "failed", message: "Too many keys made. Try again in a minute." },
  });
  // An answer that is no create's reads as a failure, never a key.
  assert.deepEqual(answeredKeyStep(SENDING, { outcome: "revoked", keyId: 7 }), { kind: "asking", status: { kind: "failed", message: UNREACHABLE } });
  // An answer with no form waiting for it changes nothing.
  assert.equal(answeredKeyStep(KEY_CLOSED, { outcome: "created", key: LEARNING_APP, secret: SECRET }), KEY_CLOSED);
});

test("the new key's line names it, its endpoints and its expiry (board 28e)", () => {
  assert.equal(createdSummary(LEARNING_APP), "Learning app · All endpoints · Never expires");
  assert.equal(
    createdSummary({ ...LEARNING_APP, endpoints: { kind: "only", endpoints: ["lookup", "inflect", "random"] }, expires: "28 Dec 2026" }),
    "Learning app · 3 endpoints · Expires 28 Dec 2026",
  );
  assert.equal(createdSummary({ ...LEARNING_APP, endpoints: { kind: "only", endpoints: ["lookup"] } }), "Learning app · 1 endpoint · Never expires");
});

test("Revoke only asks; Cancel and Escape revoke nothing; only Revoke key on the open confirmation sends", () => {
  const asked = revokeAfter(REVOKE_IDLE, "ask");
  assert.deepEqual(asked, { step: ASKING, send: false }, "Revoke opens the confirmation and sends nothing");
  assert.deepEqual(revokeAfter(asked.step, "cancel"), { step: REVOKE_IDLE, send: false }, "Cancel or Escape closes it and sends nothing");
  assert.deepEqual(revokeAfter(asked.step, "confirm"), { step: { kind: "sending" }, send: true }, "Revoke key closes it and sends once");
  // Nothing sends without the confirmation open, and nothing sends twice.
  assert.deepEqual(revokeAfter(REVOKE_IDLE, "confirm"), { step: REVOKE_IDLE, send: false });
  for (const event of ["ask", "cancel", "confirm"] as const) assert.deepEqual(revokeAfter({ kind: "sending" }, event), { step: { kind: "sending" }, send: false }, event);
});
