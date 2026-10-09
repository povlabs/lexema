// The rule that picks which changes of a later release a simple dictionary
// takes (ADR 0025): unchanged new-word eligibility and authoritative newer definitions.

import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { italianRecordOf } from "../src/import/importRelease.js";
import type { QualityRecord } from "../src/italian/recordQuality.js";
import { selectChanged, selectNew, selectTranslations, type ChangedCandidate, type TargetStatus } from "../src/update/selection.js";
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
  // Keep the existing fills-gloss classification while trusting newer wording.
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

test("newer definitions are taken even when an old key is absent", async () => {
  // Verbatim deprimente: it-0c432803:412862 and it-78385b62:413315.
  const before = italianRecordOf((await readFile("fixtures/first-feed-retention-before.jsonl", "utf8")).trimEnd());
  const after = italianRecordOf((await readFile("fixtures/first-feed-retention-after.jsonl", "utf8")).trimEnd());
  assert.ok(before && after);
  const original = JSON.stringify({ before, after });
  assert.deepEqual(selectChanged({ before, after, beforeHidden: false, italian: true }), { take: true, reason: "adds-sense" });
  assert.equal(JSON.stringify({ before, after }), original);
});

test("a later record with more senses, all of them glosses we have, adds nothing", () => {
  assert.deepEqual(changed([{ glosses: ["edificio"] }], [{ glosses: ["edificio"] }, { glosses: ["Edificio."] }]), { take: false, reason: "no-new-gloss" });
  // Duplicate additions cannot conceal a removed older definition.
  assert.deepEqual(changed([{ glosses: ["edificio"] }, { glosses: ["famiglia"] }], [{ glosses: ["edificio"] }, { glosses: ["edificio"] }, { glosses: ["edificio"] }]), { take: true, reason: "replaces-definitions" });
});

test("a rewording is taken; layout and non-definition changes stay skipped", () => {
  assert.deepEqual(changed([{ glosses: ["edificio"] }], [{ glosses: ["costruzione"] }]), { take: true, reason: "replaces-definitions" });
  assert.deepEqual(changed([{ glosses: ["edificio, abitazione"] }], [{ glosses: ["Edificio; abitazione."] }]), { take: false, reason: "formatting-only" });
  assert.deepEqual(changed([{ glosses: ["edificio"] }], [{ glosses: ["edificio"] }]), { take: false, reason: "glosses-same" });
});

test("a matched later record can remove definitions", () => {
  assert.deepEqual(changed([{ glosses: ["edificio"] }, { glosses: ["famiglia"] }], [{ glosses: ["edificio e famiglia"] }]), { take: true, reason: "removes-definitions" });
});

test("a real definition lost to an empty or placeholder sense keeps ours serving (#442)", () => {
  const blanked = { take: false, reason: "blank-replaces-definition" };
  assert.deepEqual(changed([{ glosses: ["edificio"] }], [{ glosses: [PLACEHOLDER] }]), blanked);
  assert.deepEqual(changed([{ glosses: ["edificio"] }], [{ glosses: [] }]), blanked);
  assert.deepEqual(changed([{ glosses: ["edificio"] }], [{ glosses: [" "] }]), blanked);
  assert.deepEqual(changed([{ glosses: ["edificio"] }], []), blanked);
  // One definition of several, the rest kept.
  assert.deepEqual(changed([{ glosses: ["edificio"] }, { glosses: ["famiglia"] }], [{ glosses: ["edificio"] }, { glosses: [PLACEHOLDER] }]), blanked);
  // Already a placeholder beside a real one, and now only the placeholder.
  assert.deepEqual(changed([{ glosses: ["edificio"] }, { glosses: [PLACEHOLDER] }], [{ glosses: [PLACEHOLDER] }]), blanked);
});

test("a blank that loses no real definition does not stop a removal", () => {
  // The placeholder was there already; a real definition goes and another stays.
  assert.deepEqual(changed([{ glosses: ["edificio"] }, { glosses: ["famiglia"] }, { glosses: [PLACEHOLDER] }], [{ glosses: ["edificio"] }, { glosses: [PLACEHOLDER] }]), {
    take: true,
    reason: "removes-definitions",
  });
});

// Verbatim lines, in this order: passata verb, civetta noun, gay adj,
// gastronomia noun, logografo noun. Before: it-0c432803:52202, 16197, 41222,
// 30767, 409187. After: it-78385b62:52494, 16368, 41502, 31035, 409634.
const archived = async (side: "before" | "after"): Promise<Map<string, QualityRecord>> => {
  const lines = (await readFile(`fixtures/feed-blank-loss-${side}.jsonl`, "utf8")).trimEnd().split("\n");
  return new Map(lines.map((line) => {
    const read = italianRecordOf(line);
    assert.ok(read);
    return [`${read.word} ${read.pos}`, read];
  }));
};

test("archived extraction losses are skipped and archived editorial removals are taken", async () => {
  const before = await archived("before");
  const after = await archived("after");
  const original = JSON.stringify([...before, ...after]);
  const verdict = (key: string) => selectChanged({ before: before.get(key)!, after: after.get(key)!, beforeHidden: false, italian: true });
  // passata: its form-of sense becomes `{"tags": ["no-gloss"]}`.
  assert.deepEqual(verdict("passata verb"), { take: false, reason: "blank-replaces-definition" });
  // civetta: "locandina" becomes the placeholder.
  assert.deepEqual(verdict("civetta noun"), { take: false, reason: "blank-replaces-definition" });
  // Senses dropped with no blank left in their place.
  for (const key of ["gay adj", "gastronomia noun", "logografo noun"]) {
    assert.deepEqual(verdict(key), { take: true, reason: "removes-definitions" }, key);
  }
  assert.equal(JSON.stringify([...before, ...after]), original);
});

// The shapes the page hides (#422): a headword echo with its stamp, a stamp
// alone, and a raw echo. Each is a verbatim it-0c432803 sense.
const PRESINA: Sense = { glosses: ["presina f"] };
const STAMP: Sense = { glosses: ["m sing"] };
const LATINISMO: Sense = { glosses: ["latinismo"] };
const hiddenShapes: [string, Sense][] = [["presina", PRESINA], ["Pettinatore", STAMP], ["latinismo", LATINISMO]];

test("a new word whose only sense the page hides has no real gloss (#422)", () => {
  for (const [word, sense] of hiddenShapes) {
    assert.deepEqual(selectNew({ record: record(word, [sense]), italian: true }, everywhere), { take: false, reason: "no-real-gloss" }, word);
  }
  // A real definition beside the headword still reads as real.
  assert.deepEqual(selectNew({ record: record("presina", [{ glosses: ["presina f, piccolo panno per afferrare le pentole calde"] }]), italian: true }, everywhere), {
    take: true,
    reason: "new-word",
  });
  assert.deepEqual(selectNew({ record: record("latinismo", [LATINISMO, { glosses: ["parola della lingua latina"] }]), italian: true }, everywhere), {
    take: true,
    reason: "new-word",
  });
});

test("a sense the page hides fills no gloss (#422)", () => {
  for (const [word, sense] of hiddenShapes) {
    const verdict = selectChanged({ before: record(word, [{ glosses: [PLACEHOLDER] }]), after: record(word, [sense]), beforeHidden: false, italian: true });
    assert.deepEqual(verdict, { take: false, reason: "no-real-gloss" }, word);
  }
  // Ours already shows only the echo, and a real definition arrives.
  assert.deepEqual(
    selectChanged({ before: record("presina", [PRESINA]), after: record("presina", [{ glosses: ["piccolo panno per afferrare le pentole calde"] }]), beforeHidden: false, italian: true }),
    { take: true, reason: "fills-gloss" },
  );
});

test("a real definition lost to a sense the page hides keeps ours serving (#422)", () => {
  const hidden = { take: false, reason: "hidden-replaces-definition" };
  for (const [word, sense] of hiddenShapes) {
    const verdict = (before: Sense[], after: Sense[]) => selectChanged({ before: record(word, before), after: record(word, after), beforeHidden: false, italian: true });
    assert.deepEqual(verdict([{ glosses: ["oggetto"] }], [sense]), hidden, word);
    assert.deepEqual(verdict([{ glosses: ["oggetto"] }, { glosses: ["arnese"] }], [{ glosses: ["oggetto"] }, sense]), hidden, word);
  }
  // A blank in its place keeps the reason it had under v4.
  assert.deepEqual(changed([{ glosses: ["edificio"] }, { glosses: ["famiglia"] }], [{ glosses: [PLACEHOLDER] }, LATINISMO]), {
    take: false,
    reason: "blank-replaces-definition",
  });
  // The echo was there already: the removal loses nothing to it.
  assert.deepEqual(
    selectChanged({
      before: record("latinismo", [{ glosses: ["parola latina"] }, { glosses: ["stile latino"] }, LATINISMO]),
      after: record("latinismo", [{ glosses: ["parola latina"] }, LATINISMO]),
      beforeHidden: false,
      italian: true,
    }),
    { take: true, reason: "removes-definitions" },
  );
});

test("a hidden record or a non-Italian later record is left alone", () => {
  const fix: [Sense[], Sense[]] = [[{ glosses: [FURNITURE] }], [{ glosses: ["edificio"] }]];
  assert.deepEqual(changed(...fix, { beforeHidden: true }), { take: false, reason: "master-hidden" });
  assert.deepEqual(changed(...fix, { italian: false }), { take: false, reason: "not-italian" });
});

test("changed translations under the same senses are taken, unless ours is hidden or the later record is not Italian (#781)", () => {
  assert.deepEqual(selectTranslations({ beforeHidden: false, italian: true }), { take: true, reason: "replaces-translations" });
  assert.deepEqual(selectTranslations({ beforeHidden: true, italian: true }), { take: false, reason: "master-hidden" });
  assert.deepEqual(selectTranslations({ beforeHidden: false, italian: false }), { take: false, reason: "not-italian" });
});

test("an ids file holds one id per line, with comments and blank lines ignored", () => {
  assert.deepEqual(idsInFile("# first feed\nnew-49041f266972\n\nchg-c6a71a3abae2  # abbandonare\n"), ["new-49041f266972", "chg-c6a71a3abae2"]);
});
