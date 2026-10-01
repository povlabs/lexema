export type JsonObject = Record<string, unknown>;

export interface KaikkiForm {
  form?: string;
  tags?: string[];
  raw_tags?: string[];
  source?: string;
  [key: string]: unknown;
}

export interface KaikkiSense {
  glosses?: string[];
  tags?: string[];
  raw_tags?: string[];
  examples?: Array<{ text?: string; [key: string]: unknown }>;
  form_of?: Array<{ word?: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

export interface KaikkiRecord extends JsonObject {
  word?: string;
  lang_code?: string;
  lang?: string;
  pos?: string;
  title?: string;
  tags?: string[];
  raw_tags?: string[];
  forms?: KaikkiForm[];
  senses?: KaikkiSense[];
}

export interface RecordEnvelope {
  record: KaikkiRecord;
  ordinal: number;
  sourceBytes: number;
  recordHash?: string;
}

export interface ProvenanceRef {
  r: string;
  i: number;
  p: string;
  h?: string;
}

export interface ReleaseMetadata {
  releaseId: string;
  source: string;
  sourceUrl?: string;
  retrievedAt?: string;
  importerVersion: string;
  schemaVersion: string;
  license?: string[];
  attribution?: string;
  compressedSha256?: string;
}

export interface Grammar {
  gender?: "masculine" | "feminine";
  number?: "singular" | "plural";
  person?: "first" | "second" | "third";
  tense?: "present" | "imperfect" | "future" | "past" | "perfect";
  lexicalTags: string[];
  unknownTags: string[];
  rawTags: string[];
}

export interface SourceEvidence {
  kind: "headword" | "embedded-form" | "form-of";
  sourceRecordOrdinal: number;
  sourcePos?: string;
  pointer: string;
  grammar: Grammar;
  targetWord?: string;
}

export interface ClassifiedForm {
  surface: string;
  grammar: Grammar;
  provenance: ProvenanceRef;
}

export interface UnclassifiedForm {
  surface: string;
  reason: string;
  tags: string[];
  rawTags: string[];
  provenance: ProvenanceRef;
}

export interface ArticleDisplay {
  kind: "definite" | "indefinite" | "partitive";
  article: string;
  displayForm: string;
  gender: "masculine" | "feminine";
  number: "singular" | "plural";
  sourceType: "lexema-deterministic";
  rule: "it-articles/v2";
}

export interface UsageExample {
  sentence: string;
  provenance: ProvenanceRef;
}

export interface ConjugationIllustration {
  surface: string;
  grammar: Grammar;
  provenance: ProvenanceRef;
}

export interface SourceFragment {
  kind: "form" | "relation" | "unknown-tags";
  text: string;
  provenance: ProvenanceRef;
}

export interface Candidate {
  entryId: string;
  lemma: string;
  matchedForm: string;
  partOfSpeech: string;
  definitions: string[];
  usageExamples: UsageExample[];
  conjugationIllustrations: ConjugationIllustration[];
  sourceFragments: SourceFragment[];
  languageData: { it: { forms: ClassifiedForm[]; unclassifiedForms: UnclassifiedForm[]; articles: ArticleDisplay[]; articleWithheldReasons: string[] } };
  provenance: { source: string; datasetRelease: string; sourceRecordOrdinal: number; license?: string[]; upstreamReference?: string };
  evidence: SourceEvidence[];
}

export interface FixtureResult {
  query: { surface: string; normalized: string; language: "it"; normalizer: "it-normalize/v1" };
  sourceRecordsFound: number;
  results: Candidate[];
  duplicateCandidatesMerged: number;
  warnings: string[];
  assertionStatus: "pass" | "fail";
}

export interface StreamProfile {
  compressedBytes: number;
  decompressedBytes: number;
  parsedLines: number;
  malformedLines: number;
  nonItalianSkipped: number;
  italianAccepted: number;
  maxRecordBytes: number;
  sourceItalianBytes: number;
  usefulProjectionBytes: number;
  minimalProjectionBytes: number;
  entryProvenanceBytes: number;
  compactEvidenceReferenceBytes: number;
  headwordLookupRows: number;
  embeddedFormLookupRows: number;
  formOfRows: number;
  peakRetainedRecords: number;
  elapsedMs: number;
  compressedSha256: string;
}

export interface ValidationReport {
  run: { input: string; fixtureManifestHash: string; metadata: ReleaseMetadata; warnings: string[] };
  profile: StreamProfile & { projectionWithProvenanceBytes: number; provenanceOverheadPercent: number };
  fixtures: FixtureResult[];
  summary: { qualifyingUsageExamples: number; articlesGenerated: number; articlesWithheld: number; classifiedVerbForms: number; unclassifiedForms: number; unresolvedRelations: number; ambiguousRelations: number };
}
