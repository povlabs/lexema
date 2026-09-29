// The create-key form as a value (#187): the reading the server, the dialog
// and Create key's disabled state all share.

import assert from "node:assert/strict";
import { test } from "node:test";
import { canSend, draftFields, draftOf, EMPTY_DRAFT, readDraft, shownProblems, type CreateKeyDraft } from "@/lib/developers/createKeyForm.ts";

const fields = (pairs: [string, string][]) => new URLSearchParams(pairs);

test("Create key can be pressed only while the form is valid and not on its way: Only some with nothing ticked cannot be sent", () => {
  assert.equal(canSend(EMPTY_DRAFT, { kind: "editing" }), true);
  const nothingTicked = draftOf(fields([["endpoints", "some"]]));
  assert.equal(canSend(nothingTicked, { kind: "editing" }), false);
  assert.equal(canSend({ ...nothingTicked, ticked: ["lookup"] }, { kind: "editing" }), true);
  assert.equal(canSend(EMPTY_DRAFT, { kind: "sending" }), false, "never twice at once");
  // A refusal or failure shown does not stop a valid form being sent again.
  assert.equal(canSend(EMPTY_DRAFT, { kind: "failed", message: "Too many keys made. Try again in a minute." }), true);
});

test("a draft reads its form's defaults, keeps what was sent, and survives the trip through the fields the dialog sends", () => {
  assert.deepEqual(draftOf(fields([])), EMPTY_DRAFT);
  const sent = draftOf(
    fields([
      ["name", "  Learning app  "],
      ["endpoints", "some"],
      ["endpoint", "inflect"],
      ["endpoint", "lookup"],
      ["endpoint", "lookup"],
      ["endpoint", "everything"],
      ["expires", "1-year"],
    ]),
  );
  assert.deepEqual(sent, { name: "Learning app", scope: "some", ticked: ["lookup", "inflect"], strayTick: true, expires: "1-year" });
  const odd: CreateKeyDraft = { name: "x".repeat(201), scope: "unknown", ticked: [], strayTick: false, expires: "unknown" };
  for (const draft of [EMPTY_DRAFT, sent, odd]) assert.deepEqual(draftOf(draftFields(draft)), draft);
  // A name is cut past one character too many: still refused, and small enough to draw again.
  assert.equal(draftOf(fields([["name", "x".repeat(5000)]])).name.length, 201);
  assert.equal(readDraft(draftOf(fields([["name", `${" ".repeat(3000)}ok`]]))).ok, true);
});

test("a draft's problems come from the draft alone, one per field, in the form's order", () => {
  const reading = readDraft({ name: "x".repeat(201), scope: "some", ticked: [], strayTick: false, expires: "unknown" });
  assert.ok(!reading.ok);
  assert.deepEqual(reading.problems.map((problem) => problem.field), ["name", "endpoints", "expires"]);
  // Ticks are ignored while All endpoints is chosen, as the dialog hides them.
  assert.equal(readDraft({ ...EMPTY_DRAFT, ticked: ["lookup"], strayTick: true }).ok, true);
});

test("the dialog shows the draft's own problems as it is filled in, and the server's for a form it refused", () => {
  const nothingTicked = { ...EMPTY_DRAFT, scope: "some" as const };
  assert.deepEqual(shownProblems(nothingTicked, { kind: "editing" }), [{ field: "endpoints", message: "Tick at least one endpoint." }]);
  assert.deepEqual(shownProblems({ ...nothingTicked, ticked: ["lookup"] }, { kind: "editing" }), []);
  assert.deepEqual(shownProblems(EMPTY_DRAFT, { kind: "editing" }), []);
  const refused = { kind: "refused", problems: [{ field: "expires", message: "Choose when the key expires." }] } as const;
  assert.deepEqual(shownProblems(EMPTY_DRAFT, refused), refused.problems);
});
