// What comparing records on the fields Lexema reads changes in the diff of a
// later archive (#369): the diff's counts with the content of a record taken
// as its whole line, as before #369, and as `READ_FIELDS` (src/update/content.ts).
//
// Archive only, like tools/measurePageHiddenSelection.ts: the master is the
// seed archive itself, read the way the diff reads a master (same parser, same
// admission test, same matching), so it is the master `update:diff` ran
// against on 2026-10-01. No database is read or written.
//
//   pnpm exec tsx tools/measureReadFieldDiff.ts <seed.jsonl.gz> <later.jsonl.gz>

import { createHash } from "node:crypto";
import { RecordMatch, type FeedRecord, type MasterRecord, type ReleaseDiff } from "../src/update/changes.js";
import { canonicalJson, changedFields, contentSha256 } from "../src/update/content.js";
import { eachFeedLine, readFeed, type FeedArchive } from "../src/update/feed.js";

/** The whole line's content, as the diff read it before #369. */
const wholeSha256 = (line: string): string => createHash("sha256").update(canonicalJson(JSON.parse(line)), "utf8").digest("hex");

/** The top-level fields whose content differs, every field counted, as before #369. */
function wholeChangedFields(before: string, after: string): string[] {
  const left = JSON.parse(before) as Record<string, unknown>;
  const right = JSON.parse(after) as Record<string, unknown>;
  return [...new Set([...Object.keys(left), ...Object.keys(right)])].filter((field) => canonicalJson(left[field]) !== canonicalJson(right[field])).sort();
}

/** Every line of `archive` at `lineNos`, by line number. */
async function linesAt(archive: FeedArchive, lineNos: ReadonlySet<number>): Promise<Map<number, string>> {
  const lines = new Map<number, string>();
  await eachFeedLine(archive, lineNos, ({ lineNo, line }) => lines.set(lineNo, line));
  return lines;
}

const [seedPath, laterPath] = process.argv.slice(2);
if (!seedPath || !laterPath) throw new Error("usage: pnpm exec tsx tools/measureReadFieldDiff.ts <seed.jsonl.gz> <later.jsonl.gz>");

const seed = await readFeed(seedPath);
const later = await readFeed(laterPath);
const masterRecords: MasterRecord[] = seed.records.map((record) => ({
  recordId: record.lineNo,
  releaseId: seed.releaseId,
  lineNo: record.lineNo,
  word: record.word,
  pos: record.pos,
  lineSha256: record.lineSha256,
}));
// Every unpaired line on both sides, read once: both rules need the same ones.
const firstMatch = RecordMatch.of(masterRecords, later.records);
const seedLines = await linesAt(seed, new Set(firstMatch.contentWanted));

async function measure(rule: string, content: (line: string) => string, fieldsOf: (before: string, after: string) => string[]) {
  const feedRecords: FeedRecord[] = [];
  const unpaired = new Set<number>();
  // The feed's digest is the rule's; only lines not byte-matched need it.
  const byteMatched = new Set(masterRecords.map((record) => record.lineSha256));
  for (const record of later.records) if (!byteMatched.has(record.lineSha256)) unpaired.add(record.lineNo);
  const laterLines = await linesAt(later, unpaired);
  for (const record of later.records) {
    const line = laterLines.get(record.lineNo);
    feedRecords.push(line === undefined ? record : { ...record, contentSha256: content(line) });
  }
  const match = RecordMatch.of(masterRecords, feedRecords);
  const diff: ReleaseDiff = match.diff(new Map(match.contentWanted.map((recordId) => [recordId, content(seedLines.get(recordId) as string)])));
  let changedSenses = 0;
  let changedElsewhere = 0;
  const fieldSets = new Map<string, number>();
  for (const change of diff.changes) {
    if (change.kind !== "changed") continue;
    const fields = fieldsOf(seedLines.get(change.master.recordId) as string, laterLines.get(change.feed.lineNo) as string);
    if (fields.includes("senses")) changedSenses += 1;
    else {
      changedElsewhere += 1;
      fieldSets.set(fields.join(", "), (fieldSets.get(fields.join(", ")) ?? 0) + 1);
    }
  }
  const count = (kind: string) => diff.changes.filter((change) => change.kind === kind).length;
  return {
    rule,
    counts: { new: count("new"), changedSenses, changedElsewhere, lost: count("lost"), ambiguous: diff.ambiguous.length, unchanged: diff.unchanged },
    ambiguousRecords: { master: diff.ambiguous.reduce((n, group) => n + group.master.length, 0), later: diff.ambiguous.reduce((n, group) => n + group.feed.length, 0) },
    otherChangesByFields: Object.fromEntries([...fieldSets].sort((a, b) => b[1] - a[1]).slice(0, 10)),
  };
}

console.log(JSON.stringify({
  master: { releaseId: seed.releaseId, archiveSha256: seed.archiveSha256 },
  feed: { releaseId: later.releaseId, archiveSha256: later.archiveSha256 },
  before: await measure("whole line", wholeSha256, wholeChangedFields),
  after: await measure("READ_FIELDS", contentSha256, changedFields),
}, null, 2));
