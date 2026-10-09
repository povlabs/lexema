// Where `placeRecovered` puts a recovered definition written for a record the
// served one replaced, when its old place is not one served sense (#370). The
// lookup tests in update.test.ts cover the one-sense and no-sense cases through
// an apply; these cover a place more than one served sense could claim.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { RecordGloss } from "../src/italian/recovery.js";
import { placeRecovered, type RecoveredOfRecord } from "../src/lookup/recovered.js";
import type { RecoveredDefinition } from "../src/lookup/types.js";

let line = 0;
const definition = (text: string): RecoveredDefinition => ({
  route: "below-page-control",
  text,
  correction: null,
  labels: [],
  ref: { wiki: "it.wiktionary.org", title: "corona", revisionId: 456, line: ++line },
  examples: [],
  heldAsExample: null,
  items: [],
});

const shape = (placed: RecoveredOfRecord) => ({
  topLevel: placed.topLevel.map((item) => [item.text, item.items.map((child) => child.text)]),
  underSense: [...placed.underSense].map(([sense, items]) => [sense, items.map((item) => item.text)]),
});

test("an old sense lead-in that two served senses carry goes to the top of the list", () => {
  const served: RecordGloss[] = [
    { senseIndex: 0, text: "ornamento circolare che si porta sul capo, simbolo di regalità" },
    { senseIndex: 1, text: "ornamento circolare che si porta sul capo, intrecciato di fiori" },
  ];
  const placed = placeRecovered(
    [
      {
        id: 1,
        definition: definition("la corona ferrea"),
        hidden: false,
        writtenFor: "replaced",
        leadIn: { in: "sense", glosses: ["ornamento circolare che si porta sul capo"] },
      },
    ],
    served,
  );
  assert.deepEqual(shape(placed), { topLevel: [["la corona ferrea", []]], underSense: [] });
});

test("an item whose dropped lead-in two served senses carry goes to the top of the list", () => {
  const served: RecordGloss[] = [
    { senseIndex: 0, text: "dinastia regnante di uno stato europeo" },
    { senseIndex: 1, text: "per estensione, dinastia regnante di uno stato" },
  ];
  const placed = placeRecovered(
    [
      { id: 1, definition: definition("dinastia regnante di uno stato"), hidden: false, writtenFor: "replaced", leadIn: null },
      { id: 2, definition: definition("la corona dei Savoia"), hidden: false, writtenFor: "replaced", leadIn: { in: "recovered", id: 1 } },
    ],
    served,
  );
  // The lead-in is a sense now, so it is not shown again; its item cannot tell
  // which of the two senses it belongs to.
  assert.deepEqual(shape(placed), { topLevel: [["la corona dei Savoia", []]], underSense: [] });
});

test("a hidden definition is not shown, and an item listed under it goes to the top of the list (#773)", () => {
  const placed = placeRecovered(
    [
      { id: 1, definition: definition("hhhhhhhh"), hidden: true, writtenFor: "served", leadIn: null },
      { id: 2, definition: definition("la corona ferrea"), hidden: false, writtenFor: "served", leadIn: { in: "recovered", id: 1 } },
      { id: 3, definition: definition("cerchio d'oro"), hidden: false, writtenFor: "served", leadIn: { in: "sense", senseIndex: 0 } },
    ],
    [{ senseIndex: 0, text: "ornamento circolare che si porta sul capo" }],
  );
  assert.deepEqual(shape(placed), { topLevel: [["la corona ferrea", []]], underSense: [[0, ["cerchio d'oro"]]] });
});
