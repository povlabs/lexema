import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { adaptFixture } from "./italian/adapter.js";
import { collectFixtureRecords } from "./core/fixtureCollector.js";
import { summarizeReport, writeReport } from "./core/report.js";
import type { ReleaseMetadata, ValidationReport } from "./core/types.js";

const REQUIRED_FIXTURES = ["studente", "studenti", "casa", "case", "zaino", "amica", "bello", "belle", "andare", "andavano", "parlare", "parlerò", "credere", "finire", "sale", "camera"];

type Args = Record<string, string | boolean>;

function parseArgs(values: string[]): Args {
  const args: Args = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) args[key] = true;
    else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

function value(args: Args, key: string): string | undefined {
  const result = args[key];
  return typeof result === "string" ? result : undefined;
}

async function loadMetadata(args: Args): Promise<{ metadata: ReleaseMetadata; warnings: string[] }> {
  const manifestPath = value(args, "metadata") ?? "fixtures/release-metadata.local.json";
  const manifest = await readJson<Partial<ReleaseMetadata>>(manifestPath);
  const metadata: ReleaseMetadata = {
    releaseId: value(args, "release-id") ?? manifest.releaseId ?? "it-local-validation",
    source: value(args, "source") ?? manifest.source ?? "Kaikki/Wiktextract",
    sourceUrl: value(args, "source-url") ?? manifest.sourceUrl,
    retrievedAt: value(args, "retrieved-at") ?? manifest.retrievedAt,
    importerVersion: value(args, "importer-version") ?? manifest.importerVersion ?? "0.1.0",
    schemaVersion: value(args, "schema-version") ?? manifest.schemaVersion ?? "it-adapter/v1",
    license: manifest.license,
    attribution: manifest.attribution,
  };
  const warnings = [
    !metadata.sourceUrl && "Missing sourceUrl: acceptable for local validation, required before a production release.",
    !metadata.retrievedAt && "Missing retrievedAt: acceptable for local validation, required before a production release.",
    !metadata.license?.length && "Missing license metadata.",
    !metadata.attribution && "Missing attribution metadata.",
  ].filter((warning): warning is string => Boolean(warning));
  return { metadata, warnings };
}

async function loadFixtures(path: string): Promise<{ fixtures: string[]; hash: string }> {
  const raw = await readFile(path);
  const manifest = JSON.parse(raw.toString("utf8")) as { language?: string; fixtures?: unknown };
  if (manifest.language !== "it" || !Array.isArray(manifest.fixtures) || manifest.fixtures.length !== REQUIRED_FIXTURES.length || manifest.fixtures.some((item) => typeof item !== "string") || manifest.fixtures.some((item, index) => item !== REQUIRED_FIXTURES[index])) {
    throw new Error("Fixture manifest must contain the 16 required Italian surfaces in the documented order.");
  }
  return { fixtures: manifest.fixtures, hash: createHash("sha256").update(raw).digest("hex") };
}

async function validate(args: Args): Promise<void> {
  const input = value(args, "input") ?? "it-extract.jsonl.gz";
  const fixturePath = value(args, "fixtures") ?? "fixtures/it-validation-forms.json";
  const output = value(args, "out") ?? "artifacts/it-adapter-validation";
  const { fixtures, hash } = await loadFixtures(fixturePath);
  const { metadata, warnings } = await loadMetadata(args);
  const collected = await collectFixtureRecords(input, fixtures, metadata, args["record-hashes"] === true);
  metadata.compressedSha256 = collected.profile.compressedSha256;
  if (collected.relationDepthExceeded) warnings.push(`${collected.relationDepthExceeded} relation target(s) require a third scan and remain unresolved by this bounded validation spike.`);

  let rejectedExamples = 0;
  let unresolvedRelations = collected.relationDepthExceeded;
  let ambiguousRelations = 0;
  const fixtureResults = fixtures.map((fixture) => {
    const result = adaptFixture(fixture, collected.records, metadata);
    rejectedExamples += result.rejectedExamples;
    unresolvedRelations += result.unresolvedRelations;
    ambiguousRelations += result.ambiguousRelations;
    return result.fixture;
  });
  const projectionWithProvenanceBytes = collected.profile.minimalProjectionBytes + collected.profile.entryProvenanceBytes + collected.profile.compactEvidenceReferenceBytes;
  const report: ValidationReport = {
    run: { input: resolve(input), fixtureManifestHash: hash, metadata, warnings },
    profile: { ...collected.profile, projectionWithProvenanceBytes, provenanceOverheadPercent: collected.profile.minimalProjectionBytes === 0 ? 0 : ((collected.profile.entryProvenanceBytes + collected.profile.compactEvidenceReferenceBytes) / collected.profile.minimalProjectionBytes) * 100 },
    fixtures: fixtureResults,
    summary: { qualifyingUsageExamples: 0, articlesGenerated: 0, articlesWithheld: 0, classifiedVerbForms: 0, unclassifiedForms: 0, unresolvedRelations, ambiguousRelations },
  };
  summarizeReport(report);
  await writeReport(output, report);

  const failures = fixtureResults.filter((fixture) => fixture.assertionStatus === "fail");
  console.log(`Validation report written to ${resolve(output)} (${basename(input)}; ${collected.profile.italianAccepted} Italian records; ${collected.profile.elapsedMs}ms).`);
  if (failures.length) throw new Error(`Fixture assertions failed: ${failures.map((fixture) => fixture.query.surface).join(", ")}`);
}

if (process.argv[2] !== "validate") {
  console.error("Usage: npm run validate -- validate [--input path] [--fixtures path] [--metadata path] [--release-id id] [--out directory]");
  process.exitCode = 1;
} else {
  validate(parseArgs(process.argv.slice(3))).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
