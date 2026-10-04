// Why the shared dictionary's page-entry load writes fewer entries than a local
// seed of the same release (#539). It rebuilds both from public inputs and plans
// the load on each with planPageEntries (src/import/loadPageEntries.ts); it never
// reads the shared D1.
//
// - "local": the master seeded from the archive, with the dump's raw pages and
//   section-language headings but no page-only entry, then rule v1's entries
//   loaded: the dictionary a local seed's counts compare with.
// - "shared": the same seed, the 268 changes of the first feed applied
//   (reports/2026-10-01-first-feed-selection.ids) as on 2026-10-01, then rule
//   v1's entries loaded, which is the order the shared dictionary took them in.
//
// It prints the two plans' counts, every entry the shared plan skips but the
// local plan writes, with the records that spell its title on the shared
// dictionary, and the local plan's counts without those entries.
//
//   pnpm exec tsx tools/explainPageEntryGap.ts <it-extract.jsonl.gz> <itwiktionary-20260701 dump> <it-78385b62.jsonl.gz> <new work dir>
//
// The work dir must not exist yet; the run leaves three SQLite files of about
// 1.5 GB each in it.
//
// reports/2026-10-04-page-entry-gap.md is its first run, and
// reports/2026-10-04-page-entry-gap.json its output.

import { copyFile, mkdir, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { sha256Of } from "../src/deploy/dataFiles.js";
import { archiveWords, findPageEntries, planPageEntries, type PlannedEntry } from "../src/import/loadPageEntries.js";
import { pageEntryRows } from "../src/import/pageEntryRows.js";
import { seedSql } from "../src/import/seedSql.js";
import { CURATED_CORRECTIONS } from "../src/italian/curatedCorrections.js";
import { PAGE_ENTRY_RULE, type RecoveredEntry } from "../src/italian/pageEntry.js";
import { normalizeItalianExact } from "../src/italian/normalize.js";
import { readLanguageHeadings } from "../src/italian/sectionLanguage.js";
import { deletionKeys } from "../src/lookup/nearby.js";
import { archiveFactsFor } from "../src/source/archiveFacts.js";
import type { RawPage, RawPageSource } from "../src/source/rawPage.js";
import { KNOWN_DUMPS, loadDumpPages } from "../src/source/wiktionaryDump.js";
import { chooseChanges, planApply } from "../src/update/apply.js";
import { diffAgainstMaster } from "../src/update/diff.js";
import type { MasterReader } from "../src/update/master.js";

const [archive, dumpPath, feedPath, workArg] = process.argv.slice(2);
if (!archive || !dumpPath || !feedPath || !workArg) {
  throw new Error("usage: tools/explainPageEntryGap.ts <archive.jsonl.gz> <dump.xml.bz2> <feed.jsonl.gz> <work dir>");
}
const work = resolve(workArg);
const SELECTION = resolve("reports/2026-10-01-first-feed-selection.ids");
const log = (line: string): void => void process.stderr.write(`${line}\n`);

const dumpId = archiveFactsFor(await sha256Of(archive))?.dump.id;
if (dumpId === undefined || !Object.hasOwn(KNOWN_DUMPS, dumpId)) throw new Error(`no dump is known for ${archive}`);
log(`reading ${dumpPath}`);
const pages = await loadDumpPages(dumpPath, KNOWN_DUMPS[dumpId]);
const allPages = function* (): Iterable<RawPage> {
  for (const title of pages.titles()) yield pages.page(title) as RawPage;
};

// The seed as it stood before page-only entries: it reads record pages, but
// lists no title to recover a page-only entry from.
const recordPagesOnly: RawPageSource = { size: pages.size, page: (title) => pages.page(title), titles: () => [] };
// A new directory, so a run never overwrites one it did not make.
await mkdir(work);
log("seeding the master without page-only entries");
const seeded = await seedSql({
  input: archive,
  outputDir: join(work, "sql"),
  schema: resolve("src/db/schema.sql"),
  rawPages: recordPagesOnly,
  languageHeadings: await readLanguageHeadings(resolve("fixtures/section-language/regressions.json")),
});
const base = join(work, "base.sqlite");
const baseDb = new DatabaseSync(base);
for (const part of seeded.parts) baseDb.exec(await readFile(part, "utf8"));
baseDb.close();
await rm(join(work, "sql"), { recursive: true, force: true });

const spelled = await archiveWords(archive);
const found = await findPageEntries(allPages(), spelled);
const ruleV1 = found.filter((entry) => entry.rule === PAGE_ENTRY_RULE);
log(`the rule reads ${found.length} entries, ${ruleV1.length} of them by ${PAGE_ENTRY_RULE}`);

const open = async (name: string): Promise<{ db: DatabaseSync; reader: MasterReader }> => {
  const path = join(work, `${name}.sqlite`);
  await copyFile(base, path);
  const db = new DatabaseSync(path);
  return { db, reader: { query: <Row>(sql: string) => db.prepare(sql).all() as Row[] } };
};

const local = await open("local");
const shared = await open("shared");
const ids = (await readFile(SELECTION, "utf8")).split("\n").map((line) => line.trim()).filter((line) => line !== "");
const feed = await diffAgainstMaster(shared.reader, feedPath);
const chosen = chooseChanges(feed, ids);
const applied = await planApply(shared.reader, feed, chosen, { appliedAt: "2026-10-01T00:00:00.000Z" });
shared.db.exec(applied.sql);
log(`applied ${chosen.length} change(s) of ${feed.feed.releaseId}: ${chosen.filter((change) => change.kind === "new").length} new`);

/** Load rule v1's entries, as the dictionary took them first, then plan the load of every entry. */
const planAfterRuleV1 = ({ db, reader }: { db: DatabaseSync; reader: MasterReader }) => {
  db.exec(planPageEntries(reader, ruleV1, CURATED_CORRECTIONS).sql);
  return planPageEntries(reader, found, CURATED_CORRECTIONS);
};
const plans = { local: planAfterRuleV1(local), shared: planAfterRuleV1(shared) };

const placeOf = (entry: RecoveredEntry): string => `${entry.page.title}\u0000${entry.posRef.line}`;
const stateIn = new Map(plans.local.entries.map((planned) => [placeOf(planned.entry), planned.state]));
const skipped = plans.shared.entries.filter((planned: PlannedEntry) => planned.state !== "write" && stateIn.get(placeOf(planned.entry)) === "write");
// The local plan without the skipped entries: the gap is fully theirs when it counts what the shared plan counts.
const skippedPlaces = new Set(skipped.map((planned) => placeOf(planned.entry)));
const localWithout = planPageEntries(local.reader, found.filter((entry) => !skippedPlaces.has(placeOf(entry))), CURATED_CORRECTIONS);
const changeOf = new Map(chosen.map((change) => [`${change.word}\u0000${change.pos}`, change.id]));

const records = (title: string) =>
  shared.reader
    .query<{ record_id: number; release_id: string; pos: string; hidden: number; replaced: number }>(
      `SELECT r.record_id, r.release_id, r.pos,
              EXISTS (SELECT 1 FROM hidden_record h WHERE h.record_id = r.record_id) AS hidden,
              EXISTS (SELECT 1 FROM applied_change a WHERE a.replaced_record_id = r.record_id) AS replaced
         FROM source_record r WHERE r.word = '${title.replaceAll("'", "''")}' ORDER BY r.record_id`,
    )
    .map((row) => ({
      ...row,
      changeId: changeOf.get(`${title}\u0000${row.pos}`) ?? null,
      glosses: shared.reader
        .query<{ text: string }>(
          `SELECT g.text FROM sense s JOIN sense_gloss g ON g.sense_id = s.sense_id WHERE s.record_id = ${row.record_id} ORDER BY s.sense_index, g.gloss_index`,
        )
        .map((gloss) => gloss.text),
    }));

console.log(
  JSON.stringify(
    {
      archive: { path: archive, sha256: await sha256Of(archive) },
      feed: { releaseId: feed.feed.releaseId, sha256: feed.feed.archiveSha256, applied: chosen.length },
      found: found.length,
      local: plans.local.counts,
      shared: plans.shared.counts,
      localWithoutSkipped: localWithout.counts,
      gapIsTheSkipped: localWithout.counts.differencesFrom(plans.shared.counts).length === 0,
      skipped: skipped.map((planned) => ({
        title: planned.entry.page.title,
        revision: planned.entry.page.revisionId,
        line: planned.entry.posRef.line,
        rule: planned.entry.rule,
        pos: planned.entry.pos,
        state: planned.state,
        definitions: planned.entry.definitions.map((definition) => definition.text),
        labels: pageEntryRows(0, plans.local.masterReleaseId, 0, planned.entry).entry_label.length,
        typoKeys: deletionKeys(normalizeItalianExact(planned.entry.page.title)).length,
        records: records(planned.entry.page.title),
      })),
    },
    null,
    2,
  ),
);
local.db.close();
shared.db.close();
