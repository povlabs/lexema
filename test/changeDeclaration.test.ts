// Change declarations and plan counts (#455): a declaration file parses to one
// typed value or is refused naming the file, and a plan's counts held against
// it report every count that differs and every hard limit crossed.

import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { SOURCE_TEXT_UPDATE_RULES } from "../src/import/normalizeSourceText.js";
import { checkPlan, DeclarationRefused, HIDING_RULES, parseDeclaration, passes, readDeclaration } from "../src/update/declaration.js";
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

test("a malformed declaration or an unknown command is refused with a message naming the file", () => {
  assert.match(refusal("{ command: "), /is not JSON/);
  assert.match(refusal("[]"), /JSON object/);
  assert.match(refusal(declared({ command: "update:apply" })), /command must be one of update:upgrade, update:auto, hide:records, normalize:source-text, got "update:apply"/);
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
