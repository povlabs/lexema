import { Buffer } from "node:buffer";
import type { KaikkiRecord, ReleaseMetadata, StreamProfile } from "./types.js";

const bytes = (value: unknown): number => Buffer.byteLength(JSON.stringify(value), "utf8");

export function usefulProjection(record: KaikkiRecord): object {
  return {
    word: record.word,
    lang_code: record.lang_code,
    pos: record.pos,
    title: record.title,
    tags: record.tags,
    sounds: record.sounds,
    forms: (record.forms ?? []).map((form) => ({ form: form.form, tags: form.tags, raw_tags: form.raw_tags, source: form.source })),
    senses: (record.senses ?? []).map((sense) => ({ glosses: sense.glosses, tags: sense.tags, raw_tags: sense.raw_tags, form_of: sense.form_of, examples: sense.examples?.map((example) => ({ text: example.text })) })),
  };
}

export function minimalProjection(record: KaikkiRecord): object {
  return {
    word: record.word,
    pos: record.pos,
    tags: record.tags,
    forms: (record.forms ?? []).map((form) => ({ form: form.form, tags: form.tags, raw_tags: form.raw_tags })),
    form_of: (record.senses ?? []).flatMap((sense) => sense.form_of?.map((target) => target.word) ?? []),
  };
}

export function createProfile(compressedBytes: number, startedAt: number): StreamProfile {
  return {
    compressedBytes, decompressedBytes: 0, parsedLines: 0, malformedLines: 0, nonItalianSkipped: 0, italianAccepted: 0,
    maxRecordBytes: 0, sourceItalianBytes: 0, usefulProjectionBytes: 0, minimalProjectionBytes: 0,
    entryProvenanceBytes: 0, compactEvidenceReferenceBytes: 0, headwordLookupRows: 0, embeddedFormLookupRows: 0,
    formOfRows: 0, peakRetainedRecords: 0, elapsedMs: startedAt, compressedSha256: "",
  };
}

export function profileItalianRecord(profile: StreamProfile, record: KaikkiRecord, ordinal: number, sourceBytes: number, metadata: ReleaseMetadata): void {
  profile.italianAccepted += 1;
  profile.sourceItalianBytes += sourceBytes;
  profile.maxRecordBytes = Math.max(profile.maxRecordBytes, sourceBytes);
  profile.usefulProjectionBytes += bytes(usefulProjection(record));
  profile.minimalProjectionBytes += bytes(minimalProjection(record));
  profile.entryProvenanceBytes += bytes({ source: metadata.source, datasetRelease: metadata.releaseId, sourceRecordOrdinal: ordinal, license: metadata.license, upstreamReference: record.title ?? record.word });
  profile.headwordLookupRows += record.word ? 1 : 0;
  const forms = record.forms ?? [];
  profile.embeddedFormLookupRows += forms.filter((form) => typeof form.form === "string").length;
  profile.formOfRows += (record.senses ?? []).reduce((total, sense) => total + (sense.form_of?.filter((target) => typeof target.word === "string").length ?? 0), 0);
  profile.compactEvidenceReferenceBytes += (1 + forms.filter((form) => typeof form.form === "string").length) * bytes({ r: metadata.releaseId, i: ordinal, p: "/" });
}

export function finishProfile(profile: StreamProfile, startedAt: number, sha256: string): StreamProfile {
  return { ...profile, elapsedMs: Date.now() - startedAt, compressedSha256: sha256 };
}
