import { normalizeItalianExact } from "../italian/normalize.js";
import { streamItalianJsonlGzip } from "../source/jsonlGzipReader.js";
import type { RecordEnvelope, ReleaseMetadata, StreamProfile } from "./types.js";

export interface Collection {
  records: RecordEnvelope[];
  profile: StreamProfile;
  relationDepthExceeded: number;
}

function matchesAnyFixture(envelope: RecordEnvelope, fixtures: Set<string>): boolean {
  if (envelope.record.word && fixtures.has(normalizeItalianExact(envelope.record.word))) return true;
  return (envelope.record.forms ?? []).some((form) => typeof form.form === "string" && fixtures.has(normalizeItalianExact(form.form)));
}

function directTargets(envelope: RecordEnvelope): string[] {
  return (envelope.record.senses ?? []).flatMap((sense) => sense.form_of?.flatMap((target) => typeof target.word === "string" ? [normalizeItalianExact(target.word)] : []) ?? []);
}

export async function collectFixtureRecords(input: string, fixtureSurfaces: string[], metadata: ReleaseMetadata, recordHashes = false): Promise<Collection> {
  const startedAt = Date.now();
  const fixtures = new Set(fixtureSurfaces.map(normalizeItalianExact));
  const records = new Map<number, RecordEnvelope>();
  const targetWords = new Set<string>();

  const retain = (envelope: RecordEnvelope) => records.set(envelope.ordinal, envelope);
  const profile = await streamItalianJsonlGzip({
    input,
    metadata,
    recordHashes,
    onItalianRecord(envelope) {
      if (!matchesAnyFixture(envelope, fixtures)) return;
      retain(envelope);
      for (const target of directTargets(envelope)) targetWords.add(target);
    },
  });

  let relationDepthExceeded = 0;
  await streamItalianJsonlGzip({
    input,
    metadata,
    recordHashes,
    onItalianRecord(envelope) {
      const word = envelope.record.word ? normalizeItalianExact(envelope.record.word) : "";
      if (targetWords.has(word)) {
        retain(envelope);
        const nestedTargets = directTargets(envelope).filter((target) => !targetWords.has(target));
        relationDepthExceeded += nestedTargets.length;
      }
    },
  });

  profile.peakRetainedRecords = records.size;
  profile.elapsedMs = Date.now() - startedAt;
  return { records: [...records.values()].sort((a, b) => a.ordinal - b.ordinal), profile, relationDepthExceeded };
}
