// Archive/local aggregate comparison only: no per-word output, no database writes.
// The language dump is not read here, so these are pre-language-screening
// definition verdicts, not eligible apply counts or live serving observations.
import { DatabaseSync } from "node:sqlite";
import { italianRecordOf } from "../src/import/importRelease.js";
import { diffAgainstMaster, reportOf } from "../src/update/diff.js";
import { feedLines } from "../src/update/feed.js";
import { verifyFeedOrdering } from "../src/update/ordering.js";
import { ReadSenses, selectChanged, SELECTION_RULE } from "../src/update/selection.js";
import type { QualityRecord } from "../src/italian/recordQuality.js";

/** Frozen v2 definition predicate for historical aggregate comparison. */
function v2(before: QualityRecord, after: QualityRecord, fromMaster: boolean, hidden: boolean): string {
  if (!fromMaster) return "skip:earlier-applied";
  if (hidden) return "skip:master-hidden";
  const was = ReadSenses.of(before);
  const now = ReadSenses.of(after);
  if (now.real.length === 0) return "skip:no-real-gloss";
  if (was.real.length === 0) return "take:fills-gloss";
  if (now.real.length > was.real.length) {
    if (!now.keys.some((key) => !was.keys.includes(key))) return "skip:no-new-gloss";
    if (was.notReal > now.notReal) return "take:fills-gloss";
    return was.keys.every((key) => now.keys.includes(key)) ? "take:adds-sense" : "skip:loses-gloss";
  }
  if (now.real.length < was.real.length) return "skip:fewer-senses";
  const equal = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((item, index) => item === b[index]);
  if (equal([...was.keys].sort(), [...now.keys].sort())) return equal(was.shown, now.shown) ? "skip:glosses-same" : "skip:formatting-only";
  return "skip:rewording";
}

const [database, archive] = process.argv.slice(2);
if (!database || !archive) throw new Error("usage: pnpm exec tsx tools/measureFeedSelection.ts <local-master.sqlite> <later.jsonl.gz>");
const db = new DatabaseSync(database, { readOnly: true });
try {
  const reader = { query: <Row>(sql: string) => db.prepare(sql).all() as Row[] };
  const found = await diffAgainstMaster(reader, archive);
  verifyFeedOrdering(found);
  const report = await reportOf(found);
  const candidates = report.changedSenses;
  const after = await feedLines(found.feed, new Set(candidates.map((change) => change.feed.lineNo)));
  const hasHidden = db.prepare("SELECT name FROM sqlite_schema WHERE name = 'hidden_record'").get() !== undefined;
  const hidden = new Set(hasHidden ? db.prepare("SELECT record_id FROM hidden_record").all().map((row) => row.record_id) : []);
  const changes = new Map(found.diff.changes.map((change) => [change.id, change]));
  const counts: Record<string, number> = {};
  for (const entry of candidates) {
    const change = changes.get(entry.id);
    if (change?.kind !== "changed") throw new Error("missing changed candidate");
    const before = italianRecordOf(found.masterLines.get(change.master.recordId)!);
    const later = after.get(change.feed.lineNo)?.record;
    if (!before || !later) throw new Error("missing imported candidate line");
    const old = v2(before, later, change.master.releaseId === found.master.releaseId, hidden.has(change.master.recordId));
    const current = selectChanged({ before, after: later, beforeHidden: hidden.has(change.master.recordId), italian: true });
    const transition = `${old} -> ${current.take ? "take" : "skip"}:${current.reason}`;
    counts[transition] = (counts[transition] ?? 0) + 1;
  }
  console.log(JSON.stringify({
    scope: "local archived master; changed definitions before language screening; not live serving or final eligible counts",
    rules: ["feed-selection/v2", SELECTION_RULE],
    master: { releaseId: found.master.releaseId, archiveSha256: found.master.archiveSha256, feeds: found.master.feeds },
    feed: { releaseId: found.feed.releaseId, archiveSha256: found.feed.archiveSha256 },
    diff: report.counts,
    definitionTransitions: counts,
    hiddenTablePresent: hasHidden,
    unavailableInputs: "The verified feed language dump is required for final eligibility; this archive-only comparison does not read it. New-word eligibility is unchanged and not remeasured here.",
  }, null, 2));
} finally {
  db.close();
}
