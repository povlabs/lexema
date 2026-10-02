import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Inspect only the operator-facing section/path contract, not CLI identifiers or
// control flow. This avoids a test-only export or a database/dump setup merely
// to check where an operator is sent after a read-back failure.
test("apply recovery guidance names an existing runbook heading", async () => {
  const source = await readFile(new URL("../src/update/updateCli.ts", import.meta.url), "utf8");
  const references = [...source.matchAll(/see "([^"]+)" in (docs\/[^\s`]+\.md)/g)];
  assert.ok(references.length > 0, "the CLI supplies a recovery section and runbook path");
  for (const [, heading, path] of references) {
    const runbook = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
    const headings = [...runbook.matchAll(/^#{1,6} (.+)$/gm)].map((match) => match[1]);
    assert.ok(headings.includes(heading), `${path} has recovery heading "${heading}"`);
  }
});
