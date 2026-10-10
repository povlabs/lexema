// `it-sense-tag-label/v1` (#799): a sense's labels as the page wrote them.

import assert from "node:assert/strict";
import { test } from "node:test";
import { italianSenseLabels, type StoredSenseLabel } from "../src/italian/senseTagLabels.js";

const tag = (label: string): StoredSenseLabel => ({ kind: "tag", label });
const raw = (label: string): StoredSenseLabel => ({ kind: "raw_tag", label });

test("each tag the release writes shows as the label its template prints", () => {
  assert.deepEqual(italianSenseLabels([tag("archaic")]), ["antico"]);
  assert.deepEqual(italianSenseLabels([tag("figuratively")]), ["senso figurato"]);
  assert.deepEqual(italianSenseLabels([tag("broadly")]), ["per estensione"]);
  assert.deepEqual(italianSenseLabels([tag("pejorative")]), ["spregiativo"]);
  assert.deepEqual(italianSenseLabels([tag("toponymic")]), ["toponimo"]);
});

test("a raw tag is the page's own words and shows as it is, in stored order", () => {
  // `aprile`'s sense: raw `poetico`, and {{Fig}}.
  assert.deepEqual(italianSenseLabels([raw("poetico"), tag("figuratively")]), ["poetico", "senso figurato"]);
});

test("the extraction's own marks show nothing", () => {
  assert.deepEqual(italianSenseLabels([tag("form-of")]), []);
  assert.deepEqual(italianSenseLabels([tag("no-gloss"), raw("storia")]), ["storia"]);
});

test("{{Spec pl}}'s two tags are its one label, shown once", () => {
  assert.deepEqual(italianSenseLabels([tag("especially"), tag("in-plural")]), ["specialmente al plurale"]);
});

test("raw tags stay exactly as stored, a repeated one included", () => {
  assert.deepEqual(italianSenseLabels([raw("familiare"), raw("familiare")]), ["familiare", "familiare"]);
});

test("a tag with no Italian label in the table is shown as stored, never translated on the fly", () => {
  assert.deepEqual(italianSenseLabels([tag("endearing")]), ["endearing"]);
  assert.deepEqual(italianSenseLabels([tag("constructor")]), ["constructor"]);
});
