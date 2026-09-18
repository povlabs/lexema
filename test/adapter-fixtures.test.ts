import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { adaptFixture } from "../src/italian/adapter.js";
import { collectFixtureRecords } from "../src/core/fixtureCollector.js";
import type { ReleaseMetadata } from "../src/core/types.js";

const metadata: ReleaseMetadata = {
  releaseId: "it-local-integration",
  source: "Kaikki/Wiktextract",
  importerVersion: "test",
  schemaVersion: "it-adapter/v1",
  license: ["CC-BY-SA-4.0", "GFDL"],
};

const manifest = JSON.parse(await readFile("fixtures/it-validation-forms.json", "utf8")) as { fixtures: string[] };
let collection: Awaited<ReturnType<typeof collectFixtureRecords>> | undefined;

async function collected() {
  collection ??= await collectFixtureRecords("it-extract.jsonl.gz", manifest.fixtures, metadata);
  return collection;
}

test("streams and profiles the actual Italian source without retaining the corpus", async () => {
  const result = await collected();
  assert.ok(result.profile.italianAccepted > 500_000);
  assert.ok(result.profile.headwordLookupRows >= result.profile.italianAccepted);
  assert.ok(result.profile.embeddedFormLookupRows > 700_000);
  assert.ok(result.profile.peakRetainedRecords < 500);
});

test("validates all requested fixtures against the real source", async () => {
  const result = await collected();
  const outputs = manifest.fixtures.map((fixture) => adaptFixture(fixture, result.records, metadata).fixture);
  assert.equal(outputs.length, 16);
  assert.deepEqual(outputs.filter((output) => output.assertionStatus === "fail").map((output) => output.query.surface), []);

  const byQuery = new Map(outputs.map((output) => [output.query.surface, output]));
  assert.ok(byQuery.get("studenti")?.results.some((candidate) => candidate.lemma === "studente"));
  assert.ok(byQuery.get("case")?.results.some((candidate) => candidate.lemma === "casa"));
  assert.ok(byQuery.get("andavano")?.results.some((candidate) => candidate.lemma === "andare"));
  assert.ok(byQuery.get("sale")?.results.some((candidate) => candidate.lemma === "sale" && candidate.partOfSpeech === "noun"));
  assert.ok(byQuery.get("sale")?.results.some((candidate) => candidate.lemma === "sala"));
  assert.ok(byQuery.get("sale")?.results.some((candidate) => candidate.lemma === "salire"));
});
