import type { ProvenanceRef, RecordEnvelope, ReleaseMetadata } from "../core/types.js";

export function provenanceFor(metadata: ReleaseMetadata, envelope: RecordEnvelope, pointer: string): ProvenanceRef {
  return {
    r: metadata.releaseId,
    i: envelope.ordinal,
    p: pointer,
    ...(envelope.recordHash ? { h: envelope.recordHash } : {}),
  };
}
