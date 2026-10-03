// What feed-selection/v5 changes against v4 over a later archive (#422): the
// records v4 takes, or lets replace ours, for a sense the word page hides.
//
// Archive only: the master is the seed archive itself, read the way the diff
// reads a master (same parser, same admission test, same change ids), so it is
// the master the first feed selection (#377) ran against. No database is read
// or written. The language dump is not read, so `not-italian` is never
// answered here; the first selection found no new or changed record in
// another language. Records hidden as another language are not known here
// either; the first selection found none a change would replace.
//
//   pnpm exec tsx tools/measurePageHiddenSelection.ts <seed.jsonl.gz> <later.jsonl.gz> [<taken.ids>]
//
// `<taken.ids>` is an ids file of a selection already applied; the output
// names every id in it whose record v5 would not take.

import { readFile } from "node:fs/promises";
import { italianRecordOf, parseArchive } from "../src/import/importRelease.js";
import { isFurnitureSense } from "../src/italian/furniture.js";
import { normalizeItalianExact } from "../src/italian/normalize.js";
import { withoutPlaceholder } from "../src/italian/placeholder.js";
import { PageSenses, type QualityRecord } from "../src/italian/recordQuality.js";
import { RecordMatch, type Change, type MasterRecord } from "../src/update/changes.js";
import { contentSha256 } from "../src/update/content.js";
import { reportOf } from "../src/update/diff.js";
import { feedLines, readFeed } from "../src/update/feed.js";
import { idsInFile } from "../src/update/updateCli.js";
import { selectChanged, selectNew, SELECTION_RULE, type TargetStatus, type Verdict } from "../src/update/selection.js";

type Sense = QualityRecord["senses"][number];
const sourceGlosses = (sense: Sense): string[] =>
  Array.isArray(sense.glosses) ? sense.glosses.filter((item): item is string => typeof item === "string") : [];
const realGlosses = (sense: Sense): string[] => sourceGlosses(sense).flatMap((text) => withoutPlaceholder(text) ?? []);

/** feed-selection/v4's reading of a record, frozen here: the source text, not the page's. */
function v4Reading(record: QualityRecord) {
  const isReal = (sense: Sense): boolean => {
    const glosses = realGlosses(sense);
    return glosses.length > 0 && !isFurnitureSense({ glosses, opensRecoveredList: false }, record.word);
  };
  const real = record.senses.filter(isReal);
  const shown = real.map((sense) => realGlosses(sense).join("\n"));
  return {
    real,
    notReal: record.senses.filter((sense) => sourceGlosses(sense).some((text) => text.trim() !== "") && !isReal(sense)).length,
    blank: record.senses.filter((sense) => realGlosses(sense).length === 0).length,
    total: record.senses.length,
    shown,
    keys: shown.map((text) => normalizeItalianExact(text).replace(/[^\p{L}\p{N}]+/gu, " ").trim()),
    targets: real.flatMap((sense) => sense.form_of.flatMap((pointer) => (typeof pointer.word === "string" ? [pointer.word] : []))),
  };
}

/** feed-selection/v4's verdicts, frozen here, with the language and hidden-record answers this tool cannot read left out. */
function v4New(record: QualityRecord, targetOf: (word: string) => TargetStatus): Verdict {
  const senses = v4Reading(record);
  if (senses.real.length === 0) return { take: false, reason: "no-real-gloss" };
  const targets = senses.targets.map(targetOf);
  if (targets.includes("missing")) return { take: false, reason: "form-of-target-missing" };
  if (targets.includes("not-italian")) return { take: false, reason: "form-of-target-not-italian" };
  return { take: true, reason: "new-word" };
}

function v4Changed(before: QualityRecord, after: QualityRecord): Verdict {
  const was = v4Reading(before);
  const now = v4Reading(after);
  const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((item, index) => item === b[index]);
  if (now.real.length < was.real.length && (now.blank > was.blank || now.blank === now.total)) return { take: false, reason: "blank-replaces-definition" };
  if (now.real.length < was.real.length) return { take: true, reason: "removes-definitions" };
  if (now.real.length === 0) return { take: false, reason: "no-real-gloss" };
  if (was.real.length === 0) return { take: true, reason: "fills-gloss" };
  if (now.real.length > was.real.length) {
    const held = new Set(was.keys);
    if (!now.keys.some((key) => !held.has(key))) {
      const later = new Set(now.keys);
      return was.keys.every((key) => later.has(key)) ? { take: false, reason: "no-new-gloss" } : { take: true, reason: "replaces-definitions" };
    }
    if (was.notReal > now.notReal) return { take: true, reason: "fills-gloss" };
    return { take: true, reason: "adds-sense" };
  }
  if (same([...was.keys].sort(), [...now.keys].sort())) return { take: false, reason: same(was.shown, now.shown) ? "glosses-same" : "formatting-only" };
  return { take: true, reason: "replaces-definitions" };
}

const label = (verdict: Verdict): string => `${verdict.take ? "take" : "skip"}:${verdict.reason}`;
const pageKinds = (record: QualityRecord): string[] => PageSenses.of(record).kinds;
const glosses = (record: QualityRecord): string[] => record.senses.map((sense) => sourceGlosses(sense).join(" / "));

/** Senses the page hides in a whole archive, so a zero among the candidates is not a reader that sees none. */
async function hiddenSensesIn(path: string): Promise<{ "headword-echo": number; stamp: number }> {
  const counts = { "headword-echo": 0, stamp: 0 };
  await parseArchive({
    input: path,
    onRejection: () => {},
    onRecord: ({ record }) => {
      const kinds = pageKinds(record);
      record.senses.forEach((sense, index) => {
        if (kinds[index] === "headword-echo") counts["headword-echo"] += 1;
        else if (kinds[index] === "no-gloss" && realGlosses(sense).length > 0) counts.stamp += 1;
      });
    },
  });
  return counts;
}

const [seedPath, laterPath, idsPath] = process.argv.slice(2);
if (!seedPath || !laterPath) throw new Error("usage: pnpm exec tsx tools/measurePageHiddenSelection.ts <seed.jsonl.gz> <later.jsonl.gz> [<taken.ids>]");

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
const match = RecordMatch.of(masterRecords, later.records);
const seedLines = await feedLines(seed, new Set(match.contentWanted));
const masterLines = new Map([...seedLines].map(([lineNo, record]) => [lineNo, record.line]));
const diff = match.diff(new Map([...masterLines].map(([lineNo, line]) => [lineNo, contentSha256(line)])));
const master = { releaseId: seed.releaseId, normalizer: "", archiveSha256: seed.archiveSha256, upgraded: true, feeds: [], records: masterRecords, maxRecordId: 0 };
const report = await reportOf({ master, feed: later, diff, masterLines });

const byId = new Map<string, Change>(diff.changes.map((change) => [change.id, change]));
const news = report.new.map((entry) => byId.get(entry.id) as Extract<Change, { kind: "new" }>);
const changed = report.changedSenses.map((entry) => byId.get(entry.id) as Extract<Change, { kind: "changed" }>);
const laterLines = await feedLines(later, new Set([...news, ...changed].map((change) => change.feed.lineNo)));
const afterOf = (lineNo: number): QualityRecord => {
  const record = laterLines.get(lineNo)?.record;
  if (record === undefined) throw new Error(`no line read at ${later.releaseId}:${lineNo}`);
  return record;
};

// Where a form-of target lands: a seed headword, or a new word the rule takes.
const headwords = new Set(seed.records.map((record) => normalizeItalianExact(record.word)));
const takenNew = (select: (record: QualityRecord) => Verdict) =>
  new Set(news.filter((change) => select(afterOf(change.feed.lineNo)).take).map((change) => normalizeItalianExact(change.word)));
const targetsFor = (taken: Set<string>) => (word: string): TargetStatus => (headwords.has(normalizeItalianExact(word)) || taken.has(normalizeItalianExact(word)) ? "italian" : "missing");
const v4Targets = targetsFor(takenNew((record) => v4New(record, () => "italian")));
const v5Targets = targetsFor(takenNew((record) => selectNew({ record, italian: true }, () => "italian")));

const transitions: Record<string, number> = {};
const moved: { id: string; kind: string; word: string; pos: string; v4: string; v5: string; pageKinds: { before?: string[]; after: string[] }; before?: string[]; after: string[] }[] = [];
const v5ById = new Map<string, Verdict>();
const tally = (key: string) => {
  transitions[key] = (transitions[key] ?? 0) + 1;
};
// Candidates whose later record has a sense the page hides, whatever the verdict.
const HIDDEN_KINDS = new Set(["headword-echo", "no-gloss"]);
const withHidden: { id: string; kind: string; word: string; pos: string; verdict?: string; pageKinds: string[]; after: string[] }[] = [];
const noteHidden = (change: Change & { feed: { lineNo: number } }, record: QualityRecord) => {
  const kinds = pageKinds(record);
  const hidden = record.senses.some((sense, index) => HIDDEN_KINDS.has(kinds[index]) && realGlosses(sense).length > 0);
  if (hidden) withHidden.push({ id: change.id, kind: change.kind, word: change.word, pos: change.pos, pageKinds: kinds, after: glosses(record) });
};
for (const change of news) {
  const record = afterOf(change.feed.lineNo);
  const old = v4New(record, v4Targets);
  const now = selectNew({ record, italian: true }, v5Targets);
  v5ById.set(change.id, now);
  noteHidden(change, record);
  tally(`new ${label(old)} -> ${label(now)}`);
  if (label(old) !== label(now)) moved.push({ id: change.id, kind: "new", word: change.word, pos: change.pos, v4: label(old), v5: label(now), pageKinds: { after: pageKinds(record) }, after: glosses(record) });
}
for (const change of changed) {
  const line = masterLines.get(change.master.recordId);
  const before = line === undefined ? undefined : italianRecordOf(line);
  if (before === undefined) throw new Error(`no seed line for ${change.id}`);
  const record = afterOf(change.feed.lineNo);
  const old = v4Changed(before, record);
  const now = selectChanged({ before, after: record, beforeHidden: false, italian: true });
  v5ById.set(change.id, now);
  noteHidden(change, record);
  tally(`changed ${label(old)} -> ${label(now)}`);
  if (label(old) !== label(now)) {
    moved.push({ id: change.id, kind: "changed", word: change.word, pos: change.pos, v4: label(old), v5: label(now), pageKinds: { before: pageKinds(before), after: pageKinds(record) }, before: glosses(before), after: glosses(record) });
  }
}

let applied: { ids: number; found: number; notTakenByV5: { id: string; v5: string }[] } | undefined;
if (idsPath !== undefined) {
  const ids = idsInFile(await readFile(idsPath, "utf8"));
  const found = ids.filter((id) => v5ById.has(id));
  applied = {
    ids: ids.length,
    found: found.length,
    notTakenByV5: found.flatMap((id) => {
      const verdict = v5ById.get(id) as Verdict;
      return verdict.take ? [] : [{ id, v5: label(verdict) }];
    }),
  };
}

console.log(JSON.stringify({
  rules: ["feed-selection/v4 (frozen in this tool)", SELECTION_RULE],
  master: { releaseId: seed.releaseId, archiveSha256: seed.archiveSha256 },
  feed: { releaseId: later.releaseId, archiveSha256: later.archiveSha256 },
  diff: report.counts,
  hiddenSenses: { [seed.releaseId]: await hiddenSensesIn(seedPath), [later.releaseId]: await hiddenSensesIn(laterPath) },
  transitions: Object.fromEntries(Object.entries(transitions).sort()),
  moved,
  withHidden: withHidden.map((entry) => ({ ...entry, verdict: label(v5ById.get(entry.id) as Verdict) })),
  applied,
}, null, 2));
