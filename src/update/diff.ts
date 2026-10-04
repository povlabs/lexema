// The diff of a later kaikki release against the master (#18): which records
// it would add, change or lose, read without writing a row. The report it
// makes is what a person chooses changes from; the apply runs the same diff
// again and applies only the ids chosen, so both always agree on what an id is.

import { changedFields, contentSha256 } from "./content.js";
import { RecordMatch, type AmbiguousGroup, type Change, type ChangeId, type ReleaseDiff } from "./changes.js";
import { eachFeedLine, readFeed, type FeedArchive } from "./feed.js";
import { readLines, readMaster, type MasterReader, type MasterState } from "./master.js";

/** The master, the later release, and what would change between them. */
export interface MasterDiff {
  master: MasterState;
  feed: FeedArchive;
  diff: ReleaseDiff;
  /** The master's line of every record a `changed` change would replace. */
  masterLines: ReadonlyMap<number, string>;
}

/** Compare the archive at `feedPath` with the master `reader` reads. Nothing is written. */
export async function diffAgainstMaster(reader: MasterReader, feedPath: string): Promise<MasterDiff> {
  const master = readMaster(reader);
  const feed = await readFeed(feedPath);
  const match = RecordMatch.of(master.records, feed.records);
  const masterLines = readLines(reader, match.contentWanted);
  const contentOf = new Map([...masterLines].map(([recordId, line]) => [recordId, contentSha256(line)]));
  return { master, feed, diff: match.diff(contentOf), masterLines };
}

/** A record named in the report: where its line is. */
export interface ReportedLine {
  releaseId: string;
  lineNo: number;
}

/** What the report says of one change. */
export type ReportedChange =
  | { kind: "new"; id: ChangeId; word: string; pos: string; feed: ReportedLine }
  /** `fields` are the record's top-level read fields whose content differs, in name order. */
  | { kind: "changed"; id: ChangeId; word: string; pos: string; master: ReportedLine; feed: ReportedLine; fields: string[] }
  | { kind: "lost"; id: ChangeId; word: string; pos: string; master: ReportedLine };

type Reported<Kind extends ReportedChange["kind"]> = Extract<ReportedChange, { kind: Kind }>;

/**
 * The report a person chooses changes from, as data. A changed record is
 * filed by what changed: its senses, or only other fields Lexema reads. The
 * sense fixes are the changes worth reading first.
 */
export interface DiffReport {
  master: { releaseId: string; feeds: string[] };
  feed: { releaseId: string; archiveSha256: string; archiveBytes: number; linesRead: number; admitted: number };
  counts: { new: number; changedSenses: number; changedElsewhere: number; lost: number; ambiguous: number; unchanged: number };
  new: Reported<"new">[];
  /** Changed records whose `senses` differ. */
  changedSenses: Reported<"changed">[];
  /** Changed records whose `senses` are the same and some other field is not. */
  changedElsewhere: Reported<"changed">[];
  lost: Reported<"lost">[];
  ambiguous: { word: string; pos: string; master: ReportedLine[]; feed: ReportedLine[] }[];
}

const byWord = (a: { word: string; pos: string }, b: { word: string; pos: string }): number =>
  a.word.localeCompare(b.word, "it-IT") || (a.word < b.word ? -1 : a.word > b.word ? 1 : 0) || (a.pos < b.pos ? -1 : a.pos > b.pos ? 1 : 0);

/** Build the report, reading the later release's lines of the changed records for which fields differ. */
export async function reportOf({ master, feed, diff, masterLines }: MasterDiff): Promise<DiffReport> {
  const at = (releaseId: string, lineNo: number): ReportedLine => ({ releaseId, lineNo });
  const of = <Kind extends Change["kind"]>(kind: Kind) =>
    diff.changes.filter((change): change is Extract<Change, { kind: Kind }> => change.kind === kind).sort(byWord);
  const news = of("new").map(({ id, word, pos, feed: record }): Reported<"new"> => ({ kind: "new", id, word, pos, feed: at(feed.releaseId, record.lineNo) }));
  const lost = of("lost").map(({ id, word, pos, master: record }): Reported<"lost"> => ({ kind: "lost", id, word, pos, master: at(record.releaseId, record.lineNo) }));

  const changed = of("changed");
  const fieldsAt = new Map<number, string[]>();
  const beforeAt = new Map(changed.map((change) => [change.feed.lineNo, change.master.recordId]));
  await eachFeedLine(feed, new Set(beforeAt.keys()), ({ lineNo, line: after }) => {
    const before = masterLines.get(beforeAt.get(lineNo) as number);
    if (before === undefined) throw new Error(`no master line read for the record line ${lineNo} would change`);
    fieldsAt.set(lineNo, changedFields(before, after));
  });
  const changes = changed.map(({ id, word, pos, master: before, feed: after }): Reported<"changed"> => ({
    kind: "changed",
    id,
    word,
    pos,
    master: at(before.releaseId, before.lineNo),
    feed: at(feed.releaseId, after.lineNo),
    fields: fieldsAt.get(after.lineNo) ?? [],
  }));
  const changedSenses = changes.filter((change) => change.fields.includes("senses"));
  const changedElsewhere = changes.filter((change) => !change.fields.includes("senses"));

  const ambiguous = [...diff.ambiguous].sort(byWord).map((group: AmbiguousGroup) => ({
    word: group.word,
    pos: group.pos,
    master: group.master.map((record) => at(record.releaseId, record.lineNo)),
    feed: group.feed.map((record) => at(feed.releaseId, record.lineNo)),
  }));
  return {
    master: { releaseId: master.releaseId, feeds: master.feeds.map((release) => release.releaseId) },
    feed: {
      releaseId: feed.releaseId,
      archiveSha256: feed.archiveSha256,
      archiveBytes: feed.archiveBytes,
      linesRead: feed.linesRead,
      admitted: feed.admitted,
    },
    counts: {
      new: news.length,
      changedSenses: changedSenses.length,
      changedElsewhere: changedElsewhere.length,
      lost: lost.length,
      ambiguous: ambiguous.length,
      unchanged: diff.unchanged,
    },
    new: news,
    changedSenses,
    changedElsewhere,
    lost,
    ambiguous,
  };
}

const cell = (text: string): string => text.replaceAll("|", "\\|");
const line = ({ releaseId, lineNo }: ReportedLine): string => `${releaseId}:${lineNo}`;

const changedRows = (changes: readonly Reported<"changed">[]): string[] => [
  "| Id | Word | Part of speech | Fields that differ | Master line | New line |",
  "|---|---|---|---|---|---|",
  ...changes.map((change) => `| ${change.id} | ${cell(change.word)} | ${cell(change.pos)} | ${change.fields.join(", ")} | ${line(change.master)} | ${line(change.feed)} |`),
];

/** The report as Markdown, for a person to read and choose from. */
export function reportMarkdown(report: DiffReport): string {
  const { counts } = report;
  const fieldSets = new Map<string, number>();
  for (const change of report.changedElsewhere) {
    const fields = change.fields.join(", ");
    fieldSets.set(fields, (fieldSets.get(fields) ?? 0) + 1);
  }
  return [
    `# What ${report.feed.releaseId} would change`,
    "",
    `Master: ${report.master.releaseId}` + (report.master.feeds.length > 0 ? `, with changes applied from ${report.master.feeds.join(", ")}` : "") + ".",
    `Later release: ${report.feed.releaseId}, SHA-256 ${report.feed.archiveSha256}, ${report.feed.archiveBytes} bytes, ` +
      `${report.feed.admitted} Italian records in ${report.feed.linesRead} lines.`,
    "",
    "| Group | Count |",
    "|---|---:|",
    `| New words | ${counts.new} |`,
    `| Changed or fixed senses | ${counts.changedSenses} |`,
    `| Other changes, senses the same | ${counts.changedElsewhere} |`,
    `| Lost words | ${counts.lost} |`,
    `| Ambiguous groups, not matched | ${counts.ambiguous} |`,
    `| Unchanged records | ${counts.unchanged} |`,
    "",
    "Choose changes by id: `pnpm run update:apply <archive> <id> <id> ...`. A lost word is never removed,",
    "and an ambiguous group cannot be applied (the runbook: `docs/UPDATE_THE_DICTIONARY.md` in the repository).",
    "",
    "## New words",
    "",
    "| Id | Word | Part of speech | New line |",
    "|---|---|---|---|",
    ...report.new.map((change) => `| ${change.id} | ${cell(change.word)} | ${cell(change.pos)} | ${line(change.feed)} |`),
    "",
    "## Changed or fixed senses",
    "",
    ...changedRows(report.changedSenses),
    "",
    "## Lost words",
    "",
    "| Id | Word | Part of speech | Master line |",
    "|---|---|---|---|",
    ...report.lost.map((change) => `| ${change.id} | ${cell(change.word)} | ${cell(change.pos)} | ${line(change.master)} |`),
    "",
    "## Ambiguous groups",
    "",
    "Several unmatched records of one word and part of speech on one side, and at least one on the other: no pairing is guessed.",
    "",
    "| Word | Part of speech | Master lines | New lines |",
    "|---|---|---|---|",
    ...report.ambiguous.map(
      (group) => `| ${cell(group.word)} | ${cell(group.pos)} | ${group.master.map(line).join(", ")} | ${group.feed.map(line).join(", ")} |`,
    ),
    "",
    "## Other changes, senses the same",
    "",
    "By the fields that differ:",
    "",
    "| Fields that differ | Records |",
    "|---|---:|",
    ...[...fieldSets].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([fields, count]) => `| ${fields} | ${count} |`),
    "",
    ...changedRows(report.changedElsewhere),
    "",
  ].join("\n");
}
