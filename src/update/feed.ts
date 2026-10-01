// A later kaikki archive, read the way the seed reads one (#18): the same
// parser, the same admission test, the same release id. The diff keeps only a
// digest of each record; the lines a report describes or an apply writes are
// read in a second pass, from the same file, checked by its checksum.

import { parseArchive, validateArchiveRecord, type ArchiveRecord, type Rejection } from "../import/importRelease.js";
import type { FeedRecord } from "./changes.js";
import { contentSha256 } from "./content.js";

/** The later release: what identifies it, what its parse counted, and its records. */
export interface FeedArchive {
  path: string;
  /** `it-` and the first eight hex digits of its checksum, as a seed names it. */
  releaseId: string;
  archiveSha256: string;
  archiveBytes: number;
  linesRead: number;
  admitted: number;
  skippedOtherLanguage: number;
  malformed: number;
  malformedMembers: number;
  records: FeedRecord[];
}

/** Read every admitted record of the archive at `path`. */
export async function readFeed(path: string, onRejection: (rejection: Rejection) => void = () => {}): Promise<FeedArchive> {
  const records: FeedRecord[] = [];
  const report = await parseArchive({
    input: path,
    onRejection,
    onRecord: ({ record, lineNo, line, lineSha256 }, reportMember) => {
      // The seed's leaf rules, so the release counts the leaves a seed would refuse.
      validateArchiveRecord(record, reportMember);
      records.push({ lineNo, word: record.word, pos: record.pos, lineSha256, contentSha256: contentSha256(line) });
    },
  });
  // parseArchive names the release when no id is given; ask it the same way.
  const releaseId = `it-${report.archiveSha256.slice(0, 8)}`;
  return {
    path,
    releaseId,
    archiveSha256: report.archiveSha256,
    archiveBytes: report.archiveBytes,
    linesRead: report.linesRead,
    admitted: report.admitted,
    skippedOtherLanguage: report.skippedOtherLanguage,
    malformed: report.malformed,
    malformedMembers: report.malformedMembers,
    records,
  };
}

/**
 * Hand `visit` each record at `lineNos` of the archive the feed was read from,
 * in line order, keeping none of them. The file is read again, so its checksum
 * is held against the first read: a file changed in between is refused rather
 * than read as the same release.
 */
export async function eachFeedLine(feed: FeedArchive, lineNos: ReadonlySet<number>, visit: (record: ArchiveRecord) => void): Promise<void> {
  if (lineNos.size === 0) return;
  const seen = new Set<number>();
  const report = await parseArchive({
    input: feed.path,
    releaseId: feed.releaseId,
    onRejection: () => {},
    onRecord: (archiveRecord) => {
      if (!lineNos.has(archiveRecord.lineNo)) return;
      seen.add(archiveRecord.lineNo);
      visit(archiveRecord);
    },
  });
  if (report.archiveSha256 !== feed.archiveSha256) {
    throw new Error(`${feed.path} changed since it was read: its SHA-256 is now ${report.archiveSha256}, not ${feed.archiveSha256}`);
  }
  const missing = [...lineNos].filter((lineNo) => !seen.has(lineNo));
  if (missing.length > 0) throw new Error(`${feed.path} holds no admitted record at line(s) ${missing.slice(0, 10).join(", ")}`);
}

/** The records at `lineNos`, by line: for the few lines an apply writes. */
export async function feedLines(feed: FeedArchive, lineNos: ReadonlySet<number>): Promise<Map<number, ArchiveRecord>> {
  const lines = new Map<number, ArchiveRecord>();
  await eachFeedLine(feed, lineNos, (record) => lines.set(record.lineNo, record));
  return lines;
}
