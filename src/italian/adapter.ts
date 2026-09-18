import { generateItalianArticles } from "./articles.js";
import { IT_NORMALIZER_VERSION, normalizeItalianExact } from "./normalize.js";
import { isQualifyingUsageExample } from "./examples.js";
import { hasExplicitNounGrammar, hasUsefulVerbClassification, mapItalianTags } from "./tags.js";
import { resolveCandidates } from "../core/candidateResolver.js";
import { provenanceFor } from "../source/provenance.js";
import type { Candidate, ClassifiedForm, FixtureResult, Grammar, RecordEnvelope, ReleaseMetadata, SourceEvidence, UnclassifiedForm } from "../core/types.js";

function combinedGrammar(evidence: SourceEvidence[]): Grammar {
  const values = <T extends string>(pick: (grammar: Grammar) => T | undefined): T | undefined => {
    const found = [...new Set(evidence.map((item) => pick(item.grammar)).filter((item): item is T => Boolean(item)))];
    return found.length === 1 ? found[0] : undefined;
  };
  return {
    gender: values((grammar) => grammar.gender),
    number: values((grammar) => grammar.number),
    person: values((grammar) => grammar.person),
    tense: values((grammar) => grammar.tense),
    lexicalTags: [...new Set(evidence.flatMap((item) => item.grammar.lexicalTags))].sort(),
    unknownTags: [...new Set(evidence.flatMap((item) => item.grammar.unknownTags))].sort(),
    rawTags: [...new Set(evidence.flatMap((item) => item.grammar.rawTags))].sort(),
  };
}

function sourceExamples(query: string, envelope: RecordEnvelope, metadata: ReleaseMetadata): { examples: Candidate["usageExamples"]; rejected: number } {
  const examples: Candidate["usageExamples"] = [];
  let rejected = 0;
  for (const [senseIndex, sense] of (envelope.record.senses ?? []).entries()) {
    for (const [exampleIndex, example] of (sense.examples ?? []).entries()) {
      if (typeof example.text !== "string" || !isQualifyingUsageExample(example.text, query)) {
        rejected += 1;
        continue;
      }
      examples.push({ sentence: example.text, provenance: provenanceFor(metadata, envelope, `/senses/${senseIndex}/examples/${exampleIndex}/text`) });
    }
  }
  return { examples, rejected };
}

function targetForms(envelope: RecordEnvelope, metadata: ReleaseMetadata): { forms: ClassifiedForm[]; unclassifiedForms: UnclassifiedForm[] } {
  const forms: ClassifiedForm[] = [];
  const unclassifiedForms: UnclassifiedForm[] = [];
  const sourcePos = envelope.record.pos;
  const all = [
    { surface: envelope.record.word, tags: envelope.record.tags, rawTags: envelope.record.raw_tags, pointer: "/word" },
    ...(envelope.record.forms ?? []).map((form, index) => ({ surface: form.form, tags: form.tags, rawTags: form.raw_tags, pointer: `/forms/${index}` })),
  ];
  for (const item of all) {
    if (typeof item.surface !== "string") continue;
    const grammar = mapItalianTags(item.tags, item.rawTags);
    const classified = ["noun", "adj"].includes(sourcePos ?? "") ? hasExplicitNounGrammar(grammar) : sourcePos === "verb" ? hasUsefulVerbClassification(grammar) : false;
    const provenance = provenanceFor(metadata, envelope, item.pointer);
    if (classified) forms.push({ surface: item.surface, grammar, provenance });
    else unclassifiedForms.push({ surface: item.surface, reason: "missing-or-unsupported-explicit-grammar", tags: item.tags ?? [], rawTags: item.rawTags ?? [], provenance });
  }
  return { forms, unclassifiedForms };
}

function candidateFromGroup(query: string, target: RecordEnvelope, evidence: SourceEvidence[], metadata: ReleaseMetadata): { candidate: Candidate; rejectedExamples: number } {
  const grammar = combinedGrammar(evidence);
  const ownForms = targetForms(target, metadata);
  const matchingProvenance = provenanceFor(metadata, target, "/word");
  const matchingClassified = ["noun", "adj"].includes(target.record.pos ?? "") ? hasExplicitNounGrammar(grammar) : target.record.pos === "verb" ? hasUsefulVerbClassification(grammar) : false;
  if (matchingClassified) ownForms.forms.push({ surface: query, grammar, provenance: matchingProvenance });
  else ownForms.unclassifiedForms.push({ surface: query, reason: "query-form-grammar-unclassified", tags: [], rawTags: grammar.rawTags, provenance: matchingProvenance });

  const articleResult = target.record.pos === "noun" ? generateItalianArticles(query, grammar.gender, grammar.number) : { articles: [] };
  const examples = sourceExamples(query, target, metadata);
  const sourceFragments = grammar.unknownTags.length > 0 ? [{ kind: "unknown-tags" as const, text: grammar.unknownTags.join(", "), provenance: matchingProvenance }] : [];
  const conjugationIllustrations = target.record.pos === "verb" && hasUsefulVerbClassification(grammar)
    ? [{ surface: query, grammar, provenance: matchingProvenance }]
    : [];

  return {
    candidate: {
      entryId: `it:${target.ordinal}`,
      lemma: target.record.word ?? query,
      matchedForm: query,
      partOfSpeech: target.record.pos ?? "unknown",
      definitions: (target.record.senses ?? []).flatMap((sense) => sense.glosses ?? []),
      usageExamples: examples.examples,
      conjugationIllustrations,
      sourceFragments,
      languageData: { it: { forms: ownForms.forms, unclassifiedForms: ownForms.unclassifiedForms, articles: articleResult.articles, articleWithheldReasons: articleResult.withheldReason ? [articleResult.withheldReason] : [] } },
      provenance: { source: metadata.source, datasetRelease: metadata.releaseId, sourceRecordOrdinal: target.ordinal, license: metadata.license, upstreamReference: target.record.title ?? target.record.word },
      evidence,
    },
    rejectedExamples: examples.rejected,
  };
}

function fixturePasses(query: string, candidates: Candidate[]): boolean {
  if (candidates.length === 0) return false;
  const lemma = (value: string) => candidates.some((candidate) => candidate.lemma === value);
  if (query === "studenti") return lemma("studente");
  if (query === "case") return lemma("casa");
  if (query === "andavano") return lemma("andare");
  if (query === "sale") return candidates.length >= 3 && lemma("sale") && lemma("sala") && lemma("salire");
  return true;
}

export interface AdapterResult {
  fixture: FixtureResult;
  rejectedExamples: number;
  unresolvedRelations: number;
  ambiguousRelations: number;
}

export function adaptFixture(query: string, records: RecordEnvelope[], metadata: ReleaseMetadata): AdapterResult {
  const resolved = resolveCandidates(query, records);
  let rejectedExamples = 0;
  const results = resolved.groups.map((group) => {
    const converted = candidateFromGroup(query, group.target, group.evidence, metadata);
    rejectedExamples += converted.rejectedExamples;
    return converted.candidate;
  });
  const sourceRecordOrdinals = new Set(results.flatMap((candidate) => candidate.evidence.map((item) => item.sourceRecordOrdinal)));
  const warnings: string[] = [];
  if (resolved.unresolvedRelations) warnings.push(`${resolved.unresolvedRelations} form_of relation(s) had no compatible retained Italian target.`);
  if (resolved.ambiguousRelations) warnings.push(`${resolved.ambiguousRelations} form_of relation(s) resolved to multiple compatible Italian target records.`);
  for (const result of results) {
    warnings.push(...result.languageData.it.articleWithheldReasons.map((reason) => `${result.lemma}: ${reason}`));
  }

  return {
    fixture: {
      query: { surface: query, normalized: normalizeItalianExact(query), language: "it", normalizer: IT_NORMALIZER_VERSION },
      sourceRecordsFound: sourceRecordOrdinals.size,
      results,
      duplicateCandidatesMerged: resolved.duplicateCandidatesMerged,
      warnings: [...new Set(warnings)],
      assertionStatus: fixturePasses(query, results) ? "pass" : "fail",
    },
    rejectedExamples,
    unresolvedRelations: resolved.unresolvedRelations,
    ambiguousRelations: resolved.ambiguousRelations,
  };
}
