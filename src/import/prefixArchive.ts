// Cut a small archive off the head of a big one.
//
// The development seed needs a few thousand records, and the obvious way to get
// them is `--limit`. That ends the run before the last line of the archive, so
// the importer records the release as `partial` — correctly, because a release
// named after the whole archive holds only part of it — and every canonical
// read then hides it (#47).
//
// So the seed names a smaller archive instead. This writes the head of the
// source file to its own .jsonl.gz, and the importer reads *that* file to its
// end: the release is `complete`, and the checksum and byte count on it
// describe the prefix, which is what was actually imported. No dev-only
// exception anywhere, and no release claiming bytes nobody read.
//
// Line numbers and record ids are unchanged by the cut, because both count from
// the start of the file and the prefix starts where the archive does. A record
// in the prefix carries the coordinates it carries in the full release.

import { createReadStream, createWriteStream } from "node:fs";
import { createInterface } from "node:readline";
import { pipeline } from "node:stream/promises";
import { createGunzip, createGzip } from "node:zlib";
import { admitsRecord } from "./importRelease.js";

export interface PrefixOptions {
  /** Path to the full .jsonl.gz source archive. */
  input: string;
  /** Path to write the prefix .jsonl.gz to. Overwritten. */
  output: string;
  /** Stop after this many records have been written. */
  records: number;
}

/** What the prefix actually holds, which is not always what was asked for. */
export interface PrefixReport {
  /** Source lines written, which is the last line number the prefix reaches. */
  lines: number;
  /**
   * Records in the prefix. Below `records` only when the source archive ran
   * out first, and then the prefix is the whole archive.
   */
  records: number;
  /** True when the source ended before `records` was reached. */
  exhausted: boolean;
}

/**
 * Write the head of `input` to `output`, stopping on the line that carries the
 * `records`-th record.
 *
 * The cut lands *after* that line rather than before the next one, so the
 * prefix never ends on a run of lines that contribute nothing — its last line
 * is always a record.
 */
export async function writePrefixArchive(options: PrefixOptions): Promise<PrefixReport> {
  if (!Number.isInteger(options.records) || options.records < 1) {
    throw new RangeError(`records must be a positive integer, got ${options.records}`);
  }

  const source = createReadStream(options.input).pipe(createGunzip());
  const lines = createInterface({ input: source, crlfDelay: Infinity });
  const gzip = createGzip();
  const written = pipeline(gzip, createWriteStream(options.output));

  const write = (chunk: string): Promise<void> =>
    gzip.write(chunk) ? Promise.resolve() : new Promise((r) => gzip.once("drain", () => r()));

  let linesRead = 0;
  let records = 0;
  let exhausted = true;
  try {
    for await (const line of lines) {
      linesRead += 1;
      await write(`${line}\n`);
      if (admitsRecord(line)) records += 1;
      if (records >= options.records) {
        exhausted = false;
        break;
      }
    }
  } finally {
    lines.close();
    // The reader is left mid-file by the break above; closing the interface
    // does not release the handle underneath it.
    source.destroy();
    gzip.end();
  }
  await written;

  return { lines: linesRead, records, exhausted };
}
