// The selection of a later release's changes by the rule in selection.ts
// (ADR 0025): it runs the diff, reads every candidate's lines, judges the new and
// changed records on the later release's own dump with #29's language rule,
// and sorts every change into a bucket. It writes nothing to the database; the
// ids it takes feed automatic apply, or `update:apply --ids` after a fresh diff.

import { readLanguageHeadings, type LanguageHeadings } from "../italian/sectionLanguage.js";
import type { RawPage } from "../source/rawPage.js";
import type { FeedArchive } from "./feed.js";
import { findForeignRecords, readRulePass, type TitleRecords } from "../import/hiddenLayer.js";
import { italianRecordOf, type ArchiveRecord } from "../import/importRelease.js";
import { normalizeItalianExact } from "../italian/normalize.js";
import type { QualityRecord } from "../italian/recordQuality.js";
import { ARCHIVE_FACTS, type ArchiveFactsCatalog, archiveFactsFor } from "../source/archiveFacts.js";
import { KNOWN_DUMPS, VerifiedDump } from "../source/wiktionaryDump.js";
import type { AmbiguousGroup, Change, ChangeId } from "./changes.js";
import { verifyFeedOrdering } from "./ordering.js";
import { reportOf, type MasterDiff, type ReportedLine } from "./diff.js";
import { feedLines } from "./feed.js";
import { select, type MasterReader } from "./master.js";
import { selectChanged, selectNew, SELECTION_RULE, type SkipReason, type TakeReason, type TargetStatus, type Verdict } from "./selection.js";

/** One new or changed record and the bucket the rule put it in. */
export interface SelectedChange {
  id: ChangeId;
  kind: "new" | "changed";
  word: string;
  pos: string;
  reason: TakeReason | SkipReason;
  feed: ReportedLine;
  master?: ReportedLine;
  /** The glosses of each sense, as the source has them: ours, for a changed record. */
  before?: string[];
  /** The glosses of each sense of the later record. */
  after: string[];
}

/** Why an ambiguous group could not be paired. */
export type AmbiguousShape = "more-later-records" | "more-of-ours" | "as-many-each-side";

/** Every change of the diff, sorted into the bucket the rule put it in. */
export interface Selection {
  rule: typeof SELECTION_RULE;
  master: { releaseId: string };
  feed: { releaseId: string; archiveSha256: string; dump: string };
  counts: {
    taken: Record<TakeReason, number>;
    skipped: Record<SkipReason, number>;
    /** Changed records whose senses are the same: no meaning changed. */
    sensesTheSame: number;
    lost: number;
    ambiguous: Record<AmbiguousShape, number>;
    unchanged: number;
  };
  taken: SelectedChange[];
  skipped: SelectedChange[];
  /** The first changed records, by word, whose senses are the same; the rest are only counted. */
  sensesTheSame: { id: ChangeId; word: string; pos: string; fields: string[]; master: ReportedLine; feed: ReportedLine }[];
  lost: { id: ChangeId; word: string; pos: string; master: ReportedLine }[];
  ambiguous: { word: string; pos: string; shape: AmbiguousShape; master: ReportedLine[]; feed: ReportedLine[] }[];
}

const TAKE_REASONS: readonly TakeReason[] = ["new-word", "fills-gloss", "adds-sense", "replaces-definitions", "removes-definitions"];
const SKIP_REASONS: readonly SkipReason[] = [
  "not-italian",
  "no-real-gloss",
  "form-of-target-missing",
  "form-of-target-not-italian",
  "master-hidden",
  "glosses-same",
  "formatting-only",
  "no-new-gloss",
];
const SHAPES: readonly AmbiguousShape[] = ["more-later-records", "more-of-ours", "as-many-each-side"];

const shapeOf = (group: AmbiguousGroup): AmbiguousShape =>
  group.feed.length > group.master.length ? "more-later-records" : group.feed.length < group.master.length ? "more-of-ours" : "as-many-each-side";

const json = (values: readonly unknown[]): string => `'${JSON.stringify(values).replaceAll("'", "''")}'`;

/** Each sense's glosses, as the source has them. */
const glossesOf = (record: QualityRecord): string[] =>
  record.senses.map((sense) => (Array.isArray(sense.glosses) ? sense.glosses.filter((text) => typeof text === "string").join(" / ") : ""));

/** The pages #29's rule judges the later records on, and the dump they are. */
export interface FeedPages {
  /** The dump's id, `itwiktionary-20260901`. */
  dump: string;
  pages: AsyncIterable<RawPage> | Iterable<RawPage>;
  languages: LanguageHeadings;
}

/**
 * Open the dump `feed` was built from at `path`, refused unless its size and
 * SHA-1 are the ones Wikimedia published for the dump the feed's build log
 * names. `use` reads its pages once; the file is closed after.
 */
export async function withFeedDump<Result>(feed: FeedArchive, path: string, languagesPath: string, use: (pages: FeedPages) => Promise<Result>): Promise<Result> {
  const facts = archiveFactsFor(feed.archiveSha256);
  if (facts === undefined) throw new Error(`no archive facts name the dump ${feed.releaseId} was built from (src/source/archiveFacts.ts)`);
  const identity = KNOWN_DUMPS[facts.dump.id];
  if (identity === undefined) throw new Error(`${facts.dump.id}, the dump ${feed.releaseId} was built from, has no size and SHA-1 in KNOWN_DUMPS`);
  const languages = await readLanguageHeadings(languagesPath);
  const dump = await VerifiedDump.open(path, identity);
  try {
    return await use({ dump: facts.dump.id, pages: dump.pages(), languages });
  } finally {
    await dump.close();
  }
}

/**
 * The lines of the feed records of the titles `wanted` names that #29's rule
 * (section-language/v1) finds in another language. `form-of-foreign-lemma/v1`
 * is not applied here: a record it hides points at a lemma with no Italian
 * record in the feed, so unless the master heads that lemma `selectNew`
 * already skips it as `form-of-target-missing`.
 */
async function foreignLines(feed: FeedArchive, judge: FeedPages, wanted: ReadonlySet<string>): Promise<Set<number>> {
  const { titles, archiveSha256 } = await readRulePass(feed.path);
  if (archiveSha256 !== feed.archiveSha256) throw new Error(`${feed.path} changed since it was read`);
  const judged: TitleRecords = new Map([...titles].filter(([title]) => wanted.has(title)));
  const records = await findForeignRecords(judge.pages, judged, judge.languages);
  return new Set(records.map(({ lineNo }) => lineNo));
}

const recordOf = (line: string, what: string): QualityRecord => {
  const record = italianRecordOf(line);
  if (record === undefined) throw new Error(`${what} is not a line the import admits`);
  return record;
};

/**
 * Sort every change of `found` by the rule. `judge` holds the pages of the
 * dump the later release was built from (`withFeedDump`). Nothing is written.
 */
export async function selectChanges(reader: MasterReader, found: MasterDiff, judge: FeedPages, catalog: ArchiveFactsCatalog = ARCHIVE_FACTS): Promise<Selection> {
  verifyFeedOrdering(found, catalog);
  const { master, feed } = found;
  const report = await reportOf(found);
  const byId = new Map<string, Change>(found.diff.changes.map((change) => [change.id, change]));
  const news = report.new.map((reported) => byId.get(reported.id) as Extract<Change, { kind: "new" }>);
  const changed = report.changedSenses.map((reported) => byId.get(reported.id) as Extract<Change, { kind: "changed" }>);

  const lines: Map<number, ArchiveRecord> = await feedLines(feed, new Set([...news, ...changed].map((change) => change.feed.lineNo)));
  const after = (change: Change & { feed: { lineNo: number } }): QualityRecord => {
    const record = lines.get(change.feed.lineNo)?.record;
    if (record === undefined) throw new Error(`no line read at ${feed.releaseId}:${change.feed.lineNo}`);
    return record;
  };
  const foreign = await foreignLines(feed, judge, new Set([...news, ...changed].map((change) => change.word)));
  const { dump } = judge;

  const hasHidden = select<{ name: string }>(reader, "SELECT name FROM sqlite_schema WHERE type = 'table' AND name = 'hidden_record'").length > 0;
  const hidden = hasHidden
    ? select<{ record_id: number; word: string }>(reader, "SELECT h.record_id, r.word FROM hidden_record h JOIN source_record r USING (record_id)")
    : [];
  const hiddenIds = new Set(hidden.map((row) => row.record_id));

  // Where a form-of target lands: a headword of the master, a new word this
  // selection takes, or only a record hidden as another language.
  const served = [master.releaseId, ...master.feeds.map((release) => release.releaseId)];
  const targetKeys = [
    ...new Set(news.flatMap((change) => after(change).senses.flatMap((sense) => sense.form_of.flatMap((pointer) => (typeof pointer.word === "string" ? [normalizeItalianExact(pointer.word)] : []))))),
  ];
  const headed = new Set(
    targetKeys.length === 0
      ? []
      : select<{ surface_key: string }>(
          reader,
          `SELECT DISTINCT surface_key FROM lookup_form WHERE origin = 'headword'
              AND release_id IN (SELECT value FROM json_each(${json(served)}))
              AND surface_key IN (SELECT value FROM json_each(${json(targetKeys)}))`,
        ).map((row) => row.surface_key),
  );
  const newItalian = new Set(
    news.filter((change) => !foreign.has(change.feed.lineNo) && selectNew({ record: after(change), italian: true }, () => "italian").take).map((change) => normalizeItalianExact(change.word)),
  );
  const notItalian = new Set([
    ...hidden.map((row) => normalizeItalianExact(row.word)),
    ...news.filter((change) => foreign.has(change.feed.lineNo)).map((change) => normalizeItalianExact(change.word)),
  ]);
  const targetOf = (word: string): TargetStatus => {
    const key = normalizeItalianExact(word);
    if (headed.has(key) || newItalian.has(key)) return "italian";
    return notItalian.has(key) ? "not-italian" : "missing";
  };

  const taken: SelectedChange[] = [];
  const skipped: SelectedChange[] = [];
  const file = (verdict: Verdict, entry: Omit<SelectedChange, "reason">): void => {
    (verdict.take ? taken : skipped).push({ ...entry, reason: verdict.reason });
  };
  for (const change of news) {
    const record = after(change);
    file(selectNew({ record, italian: !foreign.has(change.feed.lineNo) }, targetOf), {
      id: change.id,
      kind: "new",
      word: change.word,
      pos: change.pos,
      feed: { releaseId: feed.releaseId, lineNo: change.feed.lineNo },
      after: glossesOf(record),
    });
  }
  for (const change of changed) {
    const line = found.masterLines.get(change.master.recordId);
    if (line === undefined) throw new Error(`no master line read for record ${change.master.recordId}`);
    const before = recordOf(line, `record ${change.master.recordId}`);
    const record = after(change);
    file(
      selectChanged({
        before,
        after: record,
        beforeHidden: hiddenIds.has(change.master.recordId),
        italian: !foreign.has(change.feed.lineNo),
      }),
      {
        id: change.id,
        kind: "changed",
        word: change.word,
        pos: change.pos,
        feed: { releaseId: feed.releaseId, lineNo: change.feed.lineNo },
        master: { releaseId: change.master.releaseId, lineNo: change.master.lineNo },
        before: glossesOf(before),
        after: glossesOf(record),
      },
    );
  }

  const tally = <Key extends string>(keys: readonly Key[], of: readonly Key[]): Record<Key, number> =>
    Object.fromEntries(keys.map((key) => [key, of.filter((item) => item === key).length])) as Record<Key, number>;
  const ambiguous = [...found.diff.ambiguous]
    .map((group) => ({ group, shape: shapeOf(group) }))
    .map(({ group, shape }) => ({
      word: group.word,
      pos: group.pos,
      shape,
      master: group.master.map((record) => ({ releaseId: record.releaseId, lineNo: record.lineNo })),
      feed: group.feed.map((record) => ({ releaseId: feed.releaseId, lineNo: record.lineNo })),
    }));
  const order = new Map(report.ambiguous.map((group, index) => [`${group.word}\u0000${group.pos}`, index]));
  ambiguous.sort((a, b) => (order.get(`${a.word}\u0000${a.pos}`) ?? 0) - (order.get(`${b.word}\u0000${b.pos}`) ?? 0));
  return {
    rule: SELECTION_RULE,
    master: { releaseId: master.releaseId },
    feed: { releaseId: feed.releaseId, archiveSha256: feed.archiveSha256, dump },
    counts: {
      taken: tally(TAKE_REASONS, taken.map((entry) => entry.reason as TakeReason)),
      skipped: tally(SKIP_REASONS, skipped.map((entry) => entry.reason as SkipReason)),
      sensesTheSame: report.counts.changedElsewhere,
      lost: report.counts.lost,
      ambiguous: tally(SHAPES, ambiguous.map((group) => group.shape)),
      unchanged: report.counts.unchanged,
    },
    taken,
    skipped,
    sensesTheSame: report.changedElsewhere.slice(0, EXAMPLES).map(({ id, word, pos, fields, master: before, feed: after }) => ({ id, word, pos, fields, master: before, feed: after })),
    lost: report.lost.map(({ id, word, pos, master: line }) => ({ id, word, pos, master: line })),
    ambiguous,
  };
}

const EXAMPLES = 10;

const cell = (text: string): string => text.replaceAll("|", "\\|").replaceAll("\n", " ");
const at = ({ releaseId, lineNo }: ReportedLine): string => `${releaseId}:${lineNo}`;
const clip = (text: string, length = 90): string => (text.length > length ? `${text.slice(0, length - 1)}…` : text);
const senses = (glosses: readonly string[] | undefined): string =>
  glosses === undefined ? "" : glosses.length === 0 ? "(no sense)" : glosses.slice(0, 3).map((text, index) => `${index + 1}. ${clip(text === "" ? "(no gloss)" : text, 70)}`).join("<br>") + (glosses.length > 3 ? `<br>(+${glosses.length - 3} more)` : "");

const MEANING: Readonly<Record<TakeReason | SkipReason, string>> = {
  "new-word": "a new Italian word with a real gloss",
  "fills-gloss": "ours shows no real gloss, or a placeholder or headword-line sense, and the later record a real one",
  "adds-sense": "the later record has more real senses and a new gloss key",
  "replaces-definitions": "the later record corrects or rewrites definition text",
  "removes-definitions": "the matched later record removes some or all real definitions",
  "not-italian": "the page puts the record under another language (section-language/v1, on the later release's dump)",
  "no-real-gloss": "no sense of the later record has a real gloss",
  "form-of-target-missing": "a form-of whose target no Italian headword of the dictionary or of this selection has",
  "form-of-target-not-italian": "a form-of whose target only a record hidden as another language has",
  "master-hidden": "the record it would replace is hidden as another language",
  "glosses-same": "the real glosses are the same; only examples, tags or links differ",
  "formatting-only": "the real glosses differ only in case, punctuation, spacing or order",
  "no-new-gloss": "more real senses, every one a gloss we already have",
};

const SHAPE_MEANING: Readonly<Record<AmbiguousShape, string>> = {
  "more-later-records": "more unmatched later records than ours",
  "more-of-ours": "more of our unmatched records than later ones",
  "as-many-each-side": "as many on each side, two or more",
};

/** The selection as Markdown: counts per bucket and ten examples of each. */
export function selectionMarkdown(selection: Selection): string {
  const { counts } = selection;
  const entries = (reason: TakeReason | SkipReason): SelectedChange[] =>
    [...selection.taken, ...selection.skipped].filter((entry) => entry.reason === reason);
  const bucket = (reason: TakeReason | SkipReason, count: number): string[] => {
    if (count === 0) return [];
    const examples = entries(reason).slice(0, EXAMPLES);
    const changed = examples.some((entry) => entry.kind === "changed");
    return [
      `### ${reason} (${count})`,
      "",
      `${MEANING[reason][0].toUpperCase()}${MEANING[reason].slice(1)}.${count > EXAMPLES ? ` The first ${EXAMPLES} by word:` : ""}`,
      "",
      changed ? "| Id | Word | Part of speech | Ours | Later |" : "| Id | Word | Part of speech | Later |",
      changed ? "|---|---|---|---|---|" : "|---|---|---|---|",
      ...examples.map((entry) =>
        changed
          ? `| ${entry.id} | ${cell(entry.word)} | ${cell(entry.pos)} | ${cell(senses(entry.before))} | ${cell(senses(entry.after))} |`
          : `| ${entry.id} | ${cell(entry.word)} | ${cell(entry.pos)} | ${cell(senses(entry.after))} |`,
      ),
      "",
    ];
  };
  const takenTotal = selection.taken.length;
  const skippedTotal = selection.skipped.length;
  return [
    `Rule \`${selection.rule}\` (src/update/selection.ts) over ${selection.feed.releaseId} against the master ${selection.master.releaseId};`,
    `the language rule read ${selection.feed.dump}, the dump ${selection.feed.releaseId} was built from.`,
    "",
    "| Group | Bucket | Count |",
    "|---|---|---:|",
    ...TAKE_REASONS.map((reason) => `| Applied | ${reason} | ${counts.taken[reason]} |`),
    `| Applied | **total** | **${takenTotal}** |`,
    ...SKIP_REASONS.filter((reason) => counts.skipped[reason] > 0).map((reason) => `| Skipped, new or changed senses | ${reason} | ${counts.skipped[reason]} |`),
    `| Skipped, new or changed senses | **total** | **${skippedTotal}** |`,
    `| Skipped | senses the same (other fields changed) | ${counts.sensesTheSame} |`,
    `| Skipped | lost word, kept | ${counts.lost} |`,
    ...SHAPES.map((shape) => `| Skipped | ambiguous group, ${SHAPE_MEANING[shape]} | ${counts.ambiguous[shape]} |`),
    `| Unchanged | | ${counts.unchanged} |`,
    "",
    "## Applied",
    "",
    ...TAKE_REASONS.flatMap((reason) => bucket(reason, counts.taken[reason])),
    "## Skipped",
    "",
    ...SKIP_REASONS.flatMap((reason) => bucket(reason, counts.skipped[reason])),
    `### Senses the same (${counts.sensesTheSame})`,
    "",
    `Another field changed and no sense did, so no meaning changed. The first ${EXAMPLES} by word:`,
    "",
    "| Id | Word | Part of speech | Fields that differ | Our line | Later line |",
    "|---|---|---|---|---|---|",
    ...selection.sensesTheSame.map(
      (entry) => `| ${entry.id} | ${cell(entry.word)} | ${cell(entry.pos)} | ${entry.fields.join(", ")} | ${at(entry.master)} | ${at(entry.feed)} |`,
    ),
    "",
    "### Lost words, kept",
    "",
    "Every one of them. Ours stay as they are.",
    "",
    "| Id | Word | Part of speech | Our line |",
    "|---|---|---|---|",
    ...selection.lost.map((entry) => `| ${entry.id} | ${cell(entry.word)} | ${cell(entry.pos)} | ${at(entry.master)} |`),
    "",
    ...SHAPES.flatMap((shape) => {
      const groups = selection.ambiguous.filter((group) => group.shape === shape);
      if (groups.length === 0) return [];
      return [
        `### Ambiguous: ${SHAPE_MEANING[shape]} (${groups.length})`,
        "",
        ...(groups.length > EXAMPLES ? [`The first ${EXAMPLES} by word:`, ""] : []),
        "| Word | Part of speech | Our lines | Later lines |",
        "|---|---|---|---|",
        ...groups.slice(0, EXAMPLES).map((group) => `| ${cell(group.word)} | ${cell(group.pos)} | ${group.master.map(at).join(", ")} | ${group.feed.map(at).join(", ")} |`),
        "",
      ];
    }),
  ].join("\n");
}

/** The ids the selection takes, one per line, in report order: what `update:apply --ids` reads. */
export function selectionIds(selection: Selection): string {
  return `${selection.taken.map((entry) => entry.id).join("\n")}\n`;
}
