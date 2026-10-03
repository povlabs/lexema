// Read-only measurement of the dangling-with-a-page set under ADR 0024.
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { parseArchive } from "./importRelease.js";
import { PUBLISHED_ARCHIVE_SHA256 } from "../source/archiveFacts.js";
import { ARCHIVE_DUMP, VerifiedDump } from "../source/wiktionaryDump.js";
import { recoverPageEntry, PAGE_ENTRY_RULE } from "../italian/pageEntry.js";

const { values } = parseArgs({ options: { archive: { type: "string" }, dump: { type: "string" }, out: { type: "string" } } });
if (values.archive === undefined || values.dump === undefined || values.out === undefined) {
  throw new Error("usage: pnpm exec tsx src/import/measurePageEntries.ts --archive <jsonl.gz> --dump <xml.bz2> --out <json>");
}
const words = new Set<string>();
const targets = new Set<string>();
const archive = await parseArchive({ input: values.archive, onRejection: () => {}, onRecord: ({ record }) => {
  words.add(record.word);
  for (const sense of record.senses) for (const edge of sense.form_of) {
    if (typeof edge.word === "string") targets.add(edge.word);
  }
} });
if (archive.archiveSha256 !== PUBLISHED_ARCHIVE_SHA256 || archive.status !== "complete") {
  throw new Error("measurement requires the verified, complete it-0c432803 archive");
}
const dangling = new Set([...targets].filter((title) => !words.has(title)));
const dump = await VerifiedDump.open(values.dump, ARCHIVE_DUMP);
const titles: { title: string; revisionId: number; timestamp: string; outcome: string; definitions: number }[] = [];
try {
  for await (const page of dump.pages()) {
    if (!dangling.has(page.title)) continue;
    const result = recoverPageEntry(page, words);
    titles.push({ title: page.title, revisionId: page.revisionId, timestamp: page.timestamp,
      outcome: result.outcome, definitions: result.outcome === "recovered" ? result.entry.definitions.length : 0 });
  }
} finally { await dump.close(); }
titles.sort((a, b) => a.title.localeCompare(b.title, "it"));
const eligible = titles.filter((item) => item.outcome === "recovered");
const counts: Record<string, number> = {};
for (const item of titles) counts[item.outcome] = (counts[item.outcome] ?? 0) + 1;
const output = { release: `it-${archive.archiveSha256.slice(0, 8)}`, archiveSha256: archive.archiveSha256,
  dump: "itwiktionary-20260701", dumpSha1: ARCHIVE_DUMP.sha1, rule: PAGE_ENTRY_RULE,
  danglingTitles: dangling.size, withAPage: titles.length, eligible: eligible.length, excluded: titles.length - eligible.length,
  counts, titles };
await writeFile(values.out, JSON.stringify(output, null, 2) + "\n");
process.stdout.write(JSON.stringify({ release: output.release, rule: output.rule, withAPage: output.withAPage,
  eligible: output.eligible, excluded: output.excluded, counts, output: values.out }) + "\n");
