// Change declarations and plan counts (#455): a declaration file parses to one
// typed value or is refused naming the file, and a plan's counts held against
// it report every count that differs and every hard limit crossed.

import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { SOURCE_TEXT_UPDATE_RULES } from "../src/import/normalizeSourceText.js";
import {
  checkPlan,
  DECLARATIONS_DIR,
  DeclarationRefused,
  HIDING_RULES,
  lookupJSON,
  parseChange,
  parseDeclaration,
  parseDraft,
  passes,
  readDeclaration,
} from "../src/update/declaration.js";
import { PlanCounts } from "../src/update/planCounts.js";

const FILE = "dictionary-changes/2026-10-feed.json";

const declared = (fields: Record<string, unknown>): string =>
  JSON.stringify({ expected: { records: { added: 2, changed: 1, removed: 0 }, written: { source_record: 3 } }, ...fields });

/** The reasons `text` is refused for, after checking the refusal names `file`. */
function refusal(text: string, file = FILE): string {
  try {
    parseDeclaration(file, text);
  } catch (error: unknown) {
    assert.ok(error instanceof DeclarationRefused);
    assert.equal(error.file, file);
    assert.ok(error.message.startsWith(`${file} is not a change declaration`), error.message);
    return error.reasons.join("\n");
  }
  assert.fail("the declaration was accepted");
}

test("a declaration of each command parses to its command, inputs and expected counts", () => {
  const auto = parseDeclaration(FILE, declared({ command: "update:auto", inputs: { feedRelease: "it-78385b62" } }));
  assert.equal(auto.command, "update:auto");
  assert.deepEqual(auto.inputs, { feedRelease: "it-78385b62" });
  assert.deepEqual(auto.expected.toJSON(), { records: { added: 2, changed: 1, removed: 0 }, written: { source_record: 3 }, deleted: {} });
  assert.equal(auto.file, FILE);

  assert.deepEqual(parseDeclaration(FILE, declared({ command: "update:upgrade" })).inputs, {});
  const hide = parseDeclaration(FILE, declared({ command: "hide:records", inputs: { archive: "it-0c432803", rules: [...HIDING_RULES].reverse() } }));
  assert.deepEqual(hide.inputs, { archive: "it-0c432803", rules: HIDING_RULES });
  const normalize = parseDeclaration(FILE, declared({ command: "normalize:source-text", inputs: { rules: [...SOURCE_TEXT_UPDATE_RULES] } }));
  assert.deepEqual(normalize.inputs, { rules: SOURCE_TEXT_UPDATE_RULES });
});

test("a correct:records declaration takes no inputs and counts the correction tables", () => {
  const expected = { records: { added: 0, changed: 2, removed: 0 }, written: { corrected_claim: 3, correction_version: 1 }, deleted: { corrected_claim: 1 } };
  const correct = parseDeclaration(FILE, JSON.stringify({ command: "correct:records", expected }));
  assert.equal(correct.command, "correct:records");
  assert.deepEqual(correct.inputs, {});
  assert.deepEqual(correct.expected.toJSON(), expected);
  assert.deepEqual(parseDeclaration(FILE, JSON.stringify({ command: "correct:records", inputs: {}, expected })).inputs, {});

  assert.match(refusal(JSON.stringify({ command: "correct:records", inputs: { corrections: ["it-0c432803:138314"] }, expected })), /inputs of correct:records has an unknown field "corrections"/);
});

test("a malformed declaration or an unknown command is refused with a message naming the file", () => {
  assert.match(refusal("{ command: "), /is not JSON/);
  assert.match(refusal("[]"), /JSON object/);
  assert.match(refusal(declared({ command: "update:apply" })), /command must be one of update:upgrade, update:auto, hide:records, normalize:source-text, correct:records, load:page-entries, load:recovered-definitions, got "update:apply"/);
  assert.match(refusal(declared({})), /command must be one of/);
  assert.match(refusal(declared({ command: "update:auto", inputs: { feedRelease: "it-78385B62" } })), /inputs\.feedRelease must be a release id/);
  assert.match(refusal(declared({ command: "update:auto", inputs: {} })), /inputs\.feedRelease must be a release id/);
  assert.match(refusal(declared({ command: "update:upgrade", inputs: { feedRelease: "it-78385b62" } })), /unknown field "feedRelease"/);
  assert.match(refusal(declared({ command: "hide:records", inputs: { archive: "it-0c432803", rules: [HIDING_RULES[0]] } })), /lacks form-of-foreign-lemma\/v1/);
  assert.match(
    refusal(declared({ command: "normalize:source-text", inputs: { rules: [...SOURCE_TEXT_UPDATE_RULES, "gloss-person-ordinal/v2"] } })),
    /names "gloss-person-ordinal\/v2", which the command does not apply/,
  );
  assert.match(refusal(JSON.stringify({ command: "update:upgrade" })), /expected must be an object/);
  assert.match(refusal(JSON.stringify({ command: "update:upgrade", expected: { records: { added: 1, changed: -1, removed: 0 } } })), /expected\.records\.changed must be a whole number/);
  assert.match(refusal(JSON.stringify({ command: "update:upgrade", expected: { records: { added: 0, changed: 0, removed: 0 }, written: { claim_review: 1 } } })), /"claim_review", a table no write command changes/);
  assert.match(refusal(declared({ command: "update:upgrade", note: "x" })), /unknown field "note"/);
});

test("a declaration is read from a .json file, and any other file is refused by name", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lexema-declaration-"));
  try {
    const file = join(dir, "upgrade.json");
    await writeFile(file, declared({ command: "update:upgrade" }));
    assert.equal((await readDeclaration(file)).file, file);
    const text = join(dir, "upgrade.txt");
    await writeFile(text, declared({ command: "update:upgrade" }));
    await assert.rejects(readDeclaration(text), (error: unknown) => error instanceof DeclarationRefused && error.file === text);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

const declaration = parseDeclaration(FILE, declared({ command: "update:auto", inputs: { feedRelease: "it-78385b62" } }));

test("a plan whose counts match its declaration passes", () => {
  const counts = new PlanCounts({ added: 2, changed: 1, removed: 0 }, { source_record: 3 });
  const check = checkPlan(declaration, { command: "update:auto", counts, dictionaryRecords: 1000 });
  assert.deepEqual(check, { differences: [], breaches: [] });
  assert.ok(passes(check));
});

test("comparing plan counts with a declaration reports each count that differs", () => {
  const counts = new PlanCounts({ added: 3, changed: 1, removed: 0 }, { source_record: 4, applied_change: 4 }, { lookup_form: 2 });
  const check = checkPlan(declaration, { command: "update:auto", counts, dictionaryRecords: 1000 });
  assert.deepEqual(check.differences, [
    { count: "records.added", declared: 2, planned: 3 },
    { count: "written.applied_change", declared: 0, planned: 4 },
    { count: "written.source_record", declared: 3, planned: 4 },
    { count: "deleted.lookup_form", declared: 0, planned: 2 },
  ]);
  assert.ok(!passes(check));
  assert.throws(() => checkPlan(declaration, { command: "hide:records", counts, dictionaryRecords: 1000 }), /declares update:auto, but the plan is of hide:records/);
});

test("a plan removing more than 100 records, or changing more than 5% of the records, is refused", () => {
  const removing = (removed: number) => new PlanCounts({ added: 0, changed: 0, removed });
  assert.deepEqual(removing(100).limitBreaches(1_000_000), []);
  assert.deepEqual(removing(101).limitBreaches(1_000_000), ["removes 101 records, more than 100"]);

  const changing = (changed: number) => new PlanCounts({ added: 0, changed, removed: 0 });
  assert.deepEqual(changing(50).limitBreaches(1000), []);
  assert.deepEqual(changing(51).limitBreaches(1000), ["changes or removes 51 of 1000 records, more than 5%"]);
  // Hides count toward the share too, and new records do not.
  assert.deepEqual(new PlanCounts({ added: 500, changed: 30, removed: 21 }).limitBreaches(1000), ["changes or removes 51 of 1000 records, more than 5%"]);

  // A plan that matches its declaration is still refused past a limit.
  const hides = parseDeclaration(FILE, JSON.stringify({ command: "hide:records", inputs: { archive: "it-0c432803", rules: HIDING_RULES }, expected: { records: { added: 0, changed: 0, removed: 101 } } }));
  const check = checkPlan(hides, { command: "hide:records", counts: removing(101), dictionaryRecords: 560_357 });
  assert.deepEqual(check, { differences: [], breaches: ["removes 101 records, more than 100"] });
  assert.ok(!passes(check));
});

// Words a declaration names for the deploy to look up after the write (#554).
const withLookups = (lookups: unknown): string => declared({ command: "update:upgrade", lookups });

test("a declaration may name words to look up: found, found with a gloss, or not found", () => {
  const parsed = parseDeclaration(FILE, withLookups([{ word: "mastoide" }, { word: "finora", found: true, gloss: "fino a ora" }, { word: "tantundem", found: false }]));
  assert.deepEqual(parsed.lookups, [
    { word: "mastoide", expect: "found", gloss: null },
    { word: "finora", expect: "found", gloss: "fino a ora" },
    { word: "tantundem", expect: "not-found" },
  ]);
  assert.deepEqual(parsed.lookups?.map(lookupJSON), [{ word: "mastoide" }, { word: "finora", gloss: "fino a ora" }, { word: "tantundem", found: false }]);
  // A draft keeps them too, with or without `expected`.
  assert.deepEqual(parseDraft(FILE, JSON.stringify({ command: "update:upgrade", lookups: [{ word: "mastoide" }] })).lookups, [{ word: "mastoide", expect: "found", gloss: null }]);
  // A declaration naming none has no lookups field at all.
  assert.equal("lookups" in parseDeclaration(FILE, declared({ command: "update:upgrade" })), false);
  assert.equal("lookups" in parseDraft(FILE, JSON.stringify({ command: "update:upgrade" })), false);
});

test("every declaration already in dictionary-changes parses as before, with no lookups", async () => {
  const files = (await readdir(DECLARATIONS_DIR)).filter((name) => name.endsWith(".json"));
  assert.ok(files.length > 0);
  for (const name of files) {
    const path = `${DECLARATIONS_DIR}/${name}`;
    const text = await readFile(path, "utf8");
    // The deployed load:page-entries files name the rule sets they deployed
    // with, which later rules extended; each is refused for that alone.
    const outgrownRules: Record<string, string> = {
      "2026-10-03-load-page-entries-it-0c432803.json": "italian-page-entry/v2, italian-page-facts/v1",
      "2026-10-03-load-page-entries-v2-it-0c432803.json": "italian-page-facts/v1",
    };
    if (name in outgrownRules) {
      assert.equal(refusal(text, path), `inputs.rules must name every rule the command applies; it lacks ${outgrownRules[name]}`);
      continue;
    }
    // The entry_fact backfill (#439) is the first declaration to name lookups.
    if (name === "2026-10-04-load-page-entry-facts-it-0c432803.json") {
      assert.deepEqual(
        parseDeclaration(path, text).lookups?.map((item) => item.word),
        ["raccontare", "fornire", "mastoide"],
      );
      continue;
    }
    // The second update:auto of it-78385b62, planned on the read fields (#560).
    if (name === "2026-10-04-update-auto-read-fields-it-78385b62.json") {
      assert.deepEqual(
        parseDeclaration(path, text).lookups?.map((item) => item.word),
        ["informatica", "stonare", "console"],
      );
      continue;
    }
    // The recovered bullet and prose lines (#706) name the words they fill in.
    if (name === "2026-10-07-load-recovered-definitions-it-0c432803.json") {
      assert.deepEqual(
        parseDraft(path, text).lookups?.map((item) => item.word),
        ["centouno", "decrepito", "bavaglio", "museruola"],
      );
      continue;
    }
    for (const parsed of [parseDeclaration(path, text), parseDraft(path, text)]) {
      assert.deepEqual(Object.keys(parsed).sort(), ["command", "expected", "file", "inputs"], path);
    }
  }
});

test("lookups that are not a list of one to ten distinct, well-formed words are refused, naming the item", () => {
  const refusals: [unknown, RegExp][] = [
    ["mastoide", /lookups must be a list of words to look up/],
    [{ word: "mastoide" }, /lookups must be a list of words to look up/],
    [[], /lookups must name at least one word/],
    [Array.from({ length: 11 }, (_, i) => ({ word: `parola${i}` })), /lookups names 11 words, more than 10/],
    [["mastoide"], /lookups\[0\] must be an object with a word/],
    [[{ gloss: "osso" }], /lookups\[0\] has no word/],
    [[{ word: "" }], /lookups\[0\] has an empty word/],
    [[{ word: "   " }], /lookups\[0\] has an empty word/],
    [[{ word: 7 }], /lookups\[0\]\.word must be a text, got 7/],
    [[{ word: "a".repeat(129) }], /lookups\[0\] \("a+"\)\.word is 129 characters, longer than the lookup takes \(128\)/],
    [[{ word: "mastoide" }, { word: "mastoide" }], /lookups\[1\] \("mastoide"\) names the same word as lookups\[0\]/],
    [[{ word: "mastoide" }, { word: " mastoide " }], /lookups\[1\] \(" mastoide "\) names the same word as lookups\[0\]/],
    [[{ word: "mastoide", note: "x" }], /lookups\[0\] \("mastoide"\) has an unknown field "note"/],
    [[{ word: "mastoide", found: "yes" }], /lookups\[0\] \("mastoide"\)\.found must be true or false, got "yes"/],
    [[{ word: "mastoide", gloss: "" }], /lookups\[0\] \("mastoide"\)\.gloss must be a non-empty text/],
    [[{ word: "mastoide", gloss: 3 }], /lookups\[0\] \("mastoide"\)\.gloss must be a non-empty text, got 3/],
    [[{ word: "tantundem", found: false, gloss: "tanto" }], /lookups\[0\] \("tantundem"\) has found: false and a gloss, which only a found word can have/],
  ];
  for (const [lookups, reason] of refusals) {
    assert.match(refusal(withLookups(lookups)), reason);
    assert.throws(
      () => parseDraft(FILE, JSON.stringify({ command: "update:upgrade", lookups })),
      (error: unknown) => error instanceof DeclarationRefused && reason.test(error.reasons.join("\n")),
    );
  }
  // Every item's reasons are given at once, each naming its item.
  const both = refusal(withLookups([{ word: "" }, { word: "finora", found: false, gloss: "x" }]));
  assert.match(both, /lookups\[0\] has an empty word/);
  assert.match(both, /lookups\[1\] \("finora"\) has found: false and a gloss/);
});

test("the change a plan-only run is asked for still takes no lookups", () => {
  assert.equal("lookups" in parseChange("change", JSON.stringify({ command: "update:upgrade" })), false);
  assert.throws(() => parseChange("change", JSON.stringify({ command: "update:upgrade", lookups: [{ word: "mastoide" }] })), /the change has an unknown field "lookups"/);
});
