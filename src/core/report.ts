import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ValidationReport } from "./types.js";

function countFixture(report: ValidationReport, selector: (result: ValidationReport["fixtures"][number]["results"][number]) => number): number {
  return report.fixtures.reduce((total, fixture) => total + fixture.results.reduce((candidateTotal, candidate) => candidateTotal + selector(candidate), 0), 0);
}

export function summarizeReport(report: ValidationReport): ValidationReport {
  report.summary.qualifyingUsageExamples = countFixture(report, (candidate) => candidate.usageExamples.length);
  report.summary.articlesGenerated = countFixture(report, (candidate) => candidate.languageData.it.articles.length);
  report.summary.articlesWithheld = countFixture(report, (candidate) => candidate.languageData.it.articleWithheldReasons.length);
  report.summary.classifiedVerbForms = countFixture(report, (candidate) => candidate.partOfSpeech === "verb" ? candidate.languageData.it.forms.length : 0);
  report.summary.unclassifiedForms = countFixture(report, (candidate) => candidate.languageData.it.unclassifiedForms.length);
  return report;
}

function formatGrammar(grammar: { gender?: string; number?: string; person?: string; tense?: string }): string {
  return [grammar.gender, grammar.number, grammar.person, grammar.tense].filter(Boolean).join(" / ") || "unclassified";
}

function markdown(report: ValidationReport): string {
  const { profile } = report;
  const duration = (profile.elapsedMs / 1000).toFixed(2);
  const fixtures = report.fixtures.map((fixture) => {
    const candidates = fixture.results.map((candidate) => {
      const forms = candidate.languageData.it.forms.map((form) => `${form.surface} (${formatGrammar(form.grammar)})`).join(", ") || "none";
      const unclassified = candidate.languageData.it.unclassifiedForms.map((form) => `${form.surface} [${form.reason}]`).join(", ") || "none";
      const examples = candidate.usageExamples.map((example) => `“${example.sentence}”`).join("; ") || "none";
      return `- **${candidate.lemma}** (${candidate.partOfSpeech}) — forms indexed: ${forms}; unclassified: ${unclassified}; articles: ${candidate.languageData.it.articles.map((article) => article.displayForm).join(", ") || "none"}; qualifying examples: ${examples}; evidence paths: ${candidate.evidence.map((item) => item.kind).join(", ")}`;
    }).join("\n") || "- No candidates";
    return `### ${fixture.query.surface} — ${fixture.assertionStatus}\n\nSource records found: ${fixture.sourceRecordsFound}. Candidate lemmas/POS:\n${candidates}\n\nDuplicate candidates merged: ${fixture.duplicateCandidatesMerged}.\n${fixture.warnings.length ? `Warnings: ${fixture.warnings.join(" ")}` : "Warnings: none."}`;
  }).join("\n\n");
  return `# Italian source-adapter validation report\n\n## Run identity\n\n- Input: \`${report.run.input}\`\n- Compressed SHA-256: \`${profile.compressedSha256}\`\n- Dataset release: \`${report.run.metadata.releaseId}\`\n- Source: ${report.run.metadata.source}\n- Source URL: ${report.run.metadata.sourceUrl ?? "missing"}\n- Retrieved at: ${report.run.metadata.retrievedAt ?? "missing"}\n- Duration: ${duration}s\n\n## Streaming integrity\n\n| Metric | Value |\n| --- | ---: |\n| Parsed records | ${profile.parsedLines} |\n| Italian accepted | ${profile.italianAccepted} |\n| Non-Italian skipped | ${profile.nonItalianSkipped} |\n| Malformed records | ${profile.malformedLines} |\n| Peak retained records | ${profile.peakRetainedRecords} |\n| Largest Italian record bytes | ${profile.maxRecordBytes} |\n\n## Global projection and provenance profile\n\n| Metric | Bytes / rows |\n| --- | ---: |\n| Complete Italian source records | ${profile.sourceItalianBytes} |\n| Useful-field projection | ${profile.usefulProjectionBytes} |\n| Minimal-MVP projection | ${profile.minimalProjectionBytes} |\n| Entry-level provenance | ${profile.entryProvenanceBytes} |\n| Compact evidence references | ${profile.compactEvidenceReferenceBytes} |\n| Minimal projection + provenance | ${profile.projectionWithProvenanceBytes} |\n| Provenance overhead | ${profile.provenanceOverheadPercent.toFixed(2)}% |\n| Headword lookup rows | ${profile.headwordLookupRows} |\n| Embedded-form lookup rows | ${profile.embeddedFormLookupRows} |\n| form_of rows | ${profile.formOfRows} |\n\n## Adapter summary\n\n- Qualifying usage examples: ${report.summary.qualifyingUsageExamples}\n- Generated articles: ${report.summary.articlesGenerated}\n- Withheld articles: ${report.summary.articlesWithheld}\n- Classified verb forms: ${report.summary.classifiedVerbForms}\n- Unclassified forms: ${report.summary.unclassifiedForms}\n- Unresolved relations: ${report.summary.unresolvedRelations}\n- Multi-target relations: ${report.summary.ambiguousRelations}\n\n## Fixture results\n\n${fixtures}\n\n## Warnings\n\n${report.run.warnings.map((warning) => `- ${warning}`).join("\n") || "None."}\n`;
}

export async function writeReport(outputDirectory: string, report: ValidationReport): Promise<void> {
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(join(outputDirectory, "validation-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(join(outputDirectory, "validation-report.md"), markdown(report));
}
