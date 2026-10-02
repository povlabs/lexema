// The rule that picks which changes of a later release a simple dictionary
// takes (#377): new Italian words with a real gloss, and changed records only
// where the later senses fix or add something.

import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { italianRecordOf } from "../src/import/importRelease.js";
import type { QualityRecord } from "../src/italian/recordQuality.js";
import { selectChanged, selectNew, type ChangedCandidate, type TargetStatus } from "../src/update/selection.js";
import { idsInFile } from "../src/update/updateCli.js";

// Synthetic senses isolate comparison boundaries, not archive payloads.
type Sense = { glosses: string[]; form_of?: { word: string }[] };

const record = (word: string, senses: Sense[]): QualityRecord => ({
  word,
  pos: "noun",
  forms: [],
  senses: senses.map((sense) => ({ glosses: sense.glosses, form_of: sense.form_of ?? [] })),
});

const PLACEHOLDER = "definizione mancante; se vuoi, aggiungila tu";
const FURNITURE = "casa ( approfondimento) f sing";

const everywhere = (): TargetStatus => "italian";

test("a new Italian word with a real gloss is taken", () => {
  assert.deepEqual(selectNew({ record: record("antifurto", [{ glosses: ["dispositivo contro i furti"] }]), italian: true }, everywhere), {
    take: true,
    reason: "new-word",
  });
});

test("a new word the page puts under another language is skipped, whatever its glosses", () => {
  assert.deepEqual(selectNew({ record: record("skirmish", [{ glosses: ["scaramuccia"] }]), italian: false }, everywhere), {
    take: false,
    reason: "not-italian",
  });
});

test("a new word whose only glosses are the placeholder or the headword line has no real gloss", () => {
  for (const glosses of [[PLACEHOLDER], [FURNITURE], [""]]) {
    const word = glosses[0] === FURNITURE ? "casa" : "parola";
    assert.deepEqual(selectNew({ record: record(word, [{ glosses }]), italian: true }, everywhere), { take: false, reason: "no-real-gloss" }, String(glosses));
  }
});

test("a new form-of record is taken only when its target is an Italian headword", () => {
  const plural = record("antifurti", [{ glosses: ["plurale di antifurto"], form_of: [{ word: "antifurto" }] }]);
  const verdict = (status: TargetStatus) => selectNew({ record: plural, italian: true }, (word) => (word === "antifurto" ? status : "italian"));
  assert.deepEqual(verdict("italian"), { take: true, reason: "new-word" });
  assert.deepEqual(verdict("missing"), { take: false, reason: "form-of-target-missing" });
  assert.deepEqual(verdict("not-italian"), { take: false, reason: "form-of-target-not-italian" });
});

const changed = (before: Sense[], after: Sense[], over: Partial<ChangedCandidate> = {}) =>
  selectChanged({
    before: record("casa", before),
    after: record("casa", after),
    beforeFromMaster: true,
    beforeHidden: false,
    italian: true,
    ...over,
  });

test("a record whose senses show no real gloss is fixed by a later real one", () => {
  assert.deepEqual(changed([{ glosses: [FURNITURE] }], [{ glosses: ["edificio adibito ad abitazione"] }]), { take: true, reason: "fills-gloss" });
  assert.deepEqual(changed([{ glosses: [PLACEHOLDER] }], [{ glosses: ["edificio"] }]), { take: true, reason: "fills-gloss" });
  assert.deepEqual(changed([], [{ glosses: ["edificio"] }]), { take: true, reason: "fills-gloss" });
});

test("a placeholder sense beside real ones that becomes real is a fix", () => {
  assert.deepEqual(changed([{ glosses: ["edificio"] }, { glosses: [PLACEHOLDER] }], [{ glosses: ["edificio"] }, { glosses: ["famiglia"] }]), {
    take: true,
    reason: "fills-gloss",
  });
  // The retention guard must not change the existing fills-gloss route.
  assert.deepEqual(changed(
    [{ glosses: ["edificio"] }, { glosses: [PLACEHOLDER] }, { glosses: [FURNITURE] }],
    [{ glosses: ["abitazione"] }, { glosses: ["famiglia"] }],
  ), { take: true, reason: "fills-gloss" });
});

test("a later record with a sense we do not have adds it", () => {
  assert.deepEqual(changed([{ glosses: ["edificio"] }], [{ glosses: ["edificio"] }, { glosses: ["famiglia"] }]), { take: true, reason: "adds-sense" });
  assert.deepEqual(changed([{ glosses: ["edificio,   abitazione"] }], [{ glosses: ["EDIFICIO; abitazione!"] }, { glosses: ["famiglia"] }]), {
    take: true,
    reason: "adds-sense",
  });
});

test("adding senses never selects an adds-sense replacement that loses an old key", async () => {
  // Verbatim deprimente: it-0c432803:412862 and it-78385b62:413315.
  const before = italianRecordOf((await readFile("fixtures/first-feed-retention-before.jsonl", "utf8")).trimEnd());
  const after = italianRecordOf((await readFile("fixtures/first-feed-retention-after.jsonl", "utf8")).trimEnd());
  assert.ok(before && after);
  const original = JSON.stringify({ before, after });
  assert.deepEqual(selectChanged({ before, after, beforeFromMaster: true, beforeHidden: false, italian: true }), { take: false, reason: "loses-gloss" });
  assert.equal(JSON.stringify({ before, after }), original);
});

test("a later record with more senses, all of them glosses we have, adds nothing", () => {
  assert.deepEqual(changed([{ glosses: ["edificio"] }], [{ glosses: ["edificio"] }, { glosses: ["Edificio."] }]), { take: false, reason: "no-new-gloss" });
});

test("a rewording, a layout change, or a change outside the glosses is skipped", () => {
  assert.deepEqual(changed([{ glosses: ["edificio"] }], [{ glosses: ["costruzione"] }]), { take: false, reason: "rewording" });
  assert.deepEqual(changed([{ glosses: ["edificio, abitazione"] }], [{ glosses: ["Edificio; abitazione."] }]), { take: false, reason: "formatting-only" });
  assert.deepEqual(changed([{ glosses: ["edificio"] }], [{ glosses: ["edificio"] }]), { take: false, reason: "glosses-same" });
});

test("a later record with fewer real senses is skipped: nothing is removed", () => {
  assert.deepEqual(changed([{ glosses: ["edificio"] }, { glosses: ["famiglia"] }], [{ glosses: ["edificio e famiglia"] }]), { take: false, reason: "fewer-senses" });
});

test("a later record with no real gloss never replaces ours", () => {
  assert.deepEqual(changed([{ glosses: ["edificio"] }], [{ glosses: [PLACEHOLDER] }]), { take: false, reason: "no-real-gloss" });
});

test("an earlier applied change, a hidden record or a non-Italian later record is left alone", () => {
  const fix: [Sense[], Sense[]] = [[{ glosses: [FURNITURE] }], [{ glosses: ["edificio"] }]];
  assert.deepEqual(changed(...fix, { beforeFromMaster: false }), { take: false, reason: "earlier-applied" });
  assert.deepEqual(changed(...fix, { beforeHidden: true }), { take: false, reason: "master-hidden" });
  assert.deepEqual(changed(...fix, { italian: false }), { take: false, reason: "not-italian" });
});

test("an ids file holds one id per line, with comments and blank lines ignored", () => {
  assert.deepEqual(idsInFile("# first feed\nnew-49041f266972\n\nchg-c6a71a3abae2  # abbandonare\n"), ["new-49041f266972", "chg-c6a71a3abae2"]);
});
