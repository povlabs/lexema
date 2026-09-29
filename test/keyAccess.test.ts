// What an API key may reach and until when (#187): the endpoint scope and the
// lifetimes the create-key dialog offers. Stored and enforced in
// test/ownedKeys.test.ts and web/test/api.test.ts.

import assert from "node:assert/strict";
import test from "node:test";
import {
  ALL_ENDPOINTS,
  allows,
  endpointsColumn,
  endpointsOfColumn,
  expiresAt,
  KEY_LIFETIMES,
  keyLifetime,
  LIFETIME_LABEL,
  onlyEndpoints,
} from "../src/api/keyAccess.js";
import { ENDPOINTS } from "../src/api/calls.js";

test("only some endpoints is at least one real endpoint, each once, in the checklist's order", () => {
  assert.deepEqual(onlyEndpoints(["random", "lookup", "random"]), { kind: "only", endpoints: ["lookup", "random"] });
  assert.deepEqual(onlyEndpoints(["lookup/batch"]), { kind: "only", endpoints: ["lookup/batch"] });
  for (const names of [[], ["lookups"], ["lookup", "batch"], ["/v1/lookup"]]) assert.equal(onlyEndpoints(names), undefined, names.join());
});

test("a scope allows its own endpoints and no other; all endpoints allows every one", () => {
  const some = onlyEndpoints(["lookup", "inflect"]);
  assert.ok(some !== undefined);
  assert.deepEqual(
    ENDPOINTS.filter((endpoint) => allows(some, endpoint)),
    ["lookup", "inflect"],
  );
  assert.deepEqual(ENDPOINTS.filter((endpoint) => allows(ALL_ENDPOINTS, endpoint)), ENDPOINTS);
});

test("a scope survives its column; a column no key could hold is an error, never a wider scope", () => {
  const some = onlyEndpoints(["nearby", "exists"]);
  assert.ok(some !== undefined);
  assert.equal(endpointsColumn(ALL_ENDPOINTS), null);
  assert.equal(endpointsColumn(some), '["exists","nearby"]');
  assert.deepEqual(endpointsOfColumn(endpointsColumn(some)), some);
  assert.deepEqual(endpointsOfColumn(null), ALL_ENDPOINTS);
  for (const stored of ["[]", '["everything"]', "[1]", '{"lookup":true}']) assert.throws(() => endpointsOfColumn(stored), stored);
});

test("a lifetime is one the dialog offers, Never first; each expires as long after now as it says", () => {
  assert.deepEqual(KEY_LIFETIMES.map((lifetime) => LIFETIME_LABEL[lifetime]), ["Never", "30 days", "90 days", "1 year"]);
  assert.equal(keyLifetime("90-days"), "90-days");
  for (const sent of ["", "forever", "30", "1-years"]) assert.equal(keyLifetime(sent), undefined, sent);

  const now = Date.parse("2026-09-29T15:30:00.000Z");
  assert.equal(expiresAt("never", now), null);
  assert.equal(expiresAt("30-days", now), "2026-10-29T15:30:00.000Z");
  assert.equal(expiresAt("90-days", now), "2026-12-28T15:30:00.000Z");
  assert.equal(expiresAt("1-year", now), "2027-09-29T15:30:00.000Z");
});
