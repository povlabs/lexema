import { normalizeItalianExact } from "../italian/normalize.js";
import { grammarSignature, mapItalianTags } from "../italian/tags.js";
import type { KaikkiSense, RecordEnvelope, SourceEvidence } from "./types.js";

export interface CandidateEvidenceGroup {
  target: RecordEnvelope;
  evidence: SourceEvidence[];
}

function formOfTargets(sense: KaikkiSense): string[] {
  return sense.form_of?.flatMap((target) => typeof target.word === "string" ? [normalizeItalianExact(target.word)] : []) ?? [];
}

function evidence(kind: SourceEvidence["kind"], source: RecordEnvelope, pointer: string, targetWord?: string): SourceEvidence {
  return {
    kind,
    sourceRecordOrdinal: source.ordinal,
    sourcePos: source.record.pos,
    pointer,
    grammar: mapItalianTags(source.record.tags, source.record.raw_tags),
    targetWord,
  };
}

function formEvidence(source: RecordEnvelope, index: number): SourceEvidence {
  const form = source.record.forms?.[index];
  return {
    kind: "embedded-form",
    sourceRecordOrdinal: source.ordinal,
    sourcePos: source.record.pos,
    pointer: `/forms/${index}`,
    grammar: mapItalianTags(form?.tags, form?.raw_tags),
  };
}

export interface ResolveResult {
  groups: CandidateEvidenceGroup[];
  duplicateCandidatesMerged: number;
  unresolvedRelations: number;
  ambiguousRelations: number;
}

export function resolveCandidates(query: string, records: RecordEnvelope[]): ResolveResult {
  const normalizedQuery = normalizeItalianExact(query);
  const groups = new Map<number, CandidateEvidenceGroup>();
  let duplicateCandidatesMerged = 0;
  let unresolvedRelations = 0;
  let ambiguousRelations = 0;

  const add = (target: RecordEnvelope, item: SourceEvidence) => {
    const current = groups.get(target.ordinal);
    if (current) {
      current.evidence.push(item);
      duplicateCandidatesMerged += 1;
    } else {
      groups.set(target.ordinal, { target, evidence: [item] });
    }
  };

  for (const source of records) {
    const wordMatches = source.record.word && normalizeItalianExact(source.record.word) === normalizedQuery;
    const isFormOf = source.record.tags?.includes("form-of") || (source.record.senses ?? []).some((sense) => sense.tags?.includes("form-of") || formOfTargets(sense).length > 0);

    if (wordMatches && !isFormOf) add(source, evidence("headword", source, "/word"));

    (source.record.forms ?? []).forEach((form, index) => {
      if (typeof form.form === "string" && normalizeItalianExact(form.form) === normalizedQuery) add(source, formEvidence(source, index));
    });

    if (!wordMatches) continue;
    for (const [senseIndex, sense] of (source.record.senses ?? []).entries()) {
      for (const [targetIndex, targetWord] of formOfTargets(sense).entries()) {
        const compatible = records.filter((candidate) =>
          candidate.record.word &&
          normalizeItalianExact(candidate.record.word) === targetWord &&
          candidate.record.pos === source.record.pos,
        );
        if (compatible.length === 0) {
          unresolvedRelations += 1;
          continue;
        }
        if (compatible.length > 1) ambiguousRelations += 1;
        const relationEvidence: SourceEvidence = {
          kind: "form-of",
          sourceRecordOrdinal: source.ordinal,
          sourcePos: source.record.pos,
          pointer: `/senses/${senseIndex}/form_of/${targetIndex}`,
          grammar: mapItalianTags(source.record.tags, source.record.raw_tags),
          targetWord,
        };
        compatible.forEach((target) => add(target, relationEvidence));
      }
    }
  }

  const ordered = [...groups.values()].sort((a, b) => {
    const byLemma = (a.target.record.word ?? "").localeCompare(b.target.record.word ?? "", "it");
    return byLemma || a.target.ordinal - b.target.ordinal;
  });
  for (const group of ordered) {
    group.evidence.sort((a, b) => `${a.kind}|${grammarSignature(a.grammar)}|${a.pointer}`.localeCompare(`${b.kind}|${grammarSignature(b.grammar)}|${b.pointer}`));
  }
  return { groups: ordered, duplicateCandidatesMerged, unresolvedRelations, ambiguousRelations };
}
