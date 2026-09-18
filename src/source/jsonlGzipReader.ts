import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import { createProfile, finishProfile, profileItalianRecord } from "../core/profiler.js";
import type { KaikkiRecord, RecordEnvelope, ReleaseMetadata, StreamProfile } from "../core/types.js";

export interface StreamOptions {
  input: string;
  metadata: ReleaseMetadata;
  recordHashes?: boolean;
  onItalianRecord: (envelope: RecordEnvelope) => void;
}

export async function streamItalianJsonlGzip(options: StreamOptions): Promise<StreamProfile> {
  const startedAt = Date.now();
  const fileStats = await stat(options.input);
  const profile = createProfile(fileStats.size, startedAt);
  const hash = createHash("sha256");
  const source = createReadStream(options.input);
  source.on("data", (chunk) => { hash.update(chunk); });
  const gunzip = createGunzip();
  source.pipe(gunzip);
  const lines = createInterface({ input: gunzip, crlfDelay: Infinity });

  for await (const line of lines) {
    if (!line) continue;
    profile.parsedLines += 1;
    const sourceBytes = Buffer.byteLength(line, "utf8");
    profile.decompressedBytes += sourceBytes + 1;

    let record: KaikkiRecord;
    try {
      record = JSON.parse(line) as KaikkiRecord;
    } catch {
      profile.malformedLines += 1;
      continue;
    }

    if (record.lang_code !== "it") {
      profile.nonItalianSkipped += 1;
      continue;
    }

    const ordinal = profile.parsedLines;
    const recordHash = options.recordHashes ? createHash("sha256").update(line, "utf8").digest("hex") : undefined;
    profileItalianRecord(profile, record, ordinal, sourceBytes, options.metadata);
    options.onItalianRecord({ record, ordinal, sourceBytes, recordHash });
  }

  return finishProfile(profile, startedAt, hash.digest("hex"));
}
