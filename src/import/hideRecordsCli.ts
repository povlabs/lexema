// `pnpm run hide:records`: the one-off update that hides, in an already seeded
// dictionary, the records the section-language rule finds in another language
// (hideRecords.ts, ADR 0023). It picks its database the way the seed does: the
// local D1 under `SEED_STATE` (default `.data/seed-state`), or the remote D1
// `SEED_REMOTE` names. It reads the archive the master was seeded from
// (`SEED_INPUT`, default `it-extract.jsonl.gz`) and the dump that archive was
// built from (`RAW_PAGES`, default the dump in the repository root), both
// checked before anything is written. See docs/RUN_AN_IMPORT.md.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { finish, isMain, type CommandResult } from "../commandLine.js";
import { readLanguageHeadings } from "../italian/sectionLanguage.js";
import { ARCHIVE_DUMP, VerifiedDump } from "../source/wiktionaryDump.js";
import { readMasterRelease } from "../update/master.js";
import { masterReaderOf } from "../update/updateCli.js";
import { findForeignRecords, readTitles } from "./hiddenLayer.js";
import { planHide, unhidden } from "./hideRecords.js";
import { seedTargetFrom, webWrangler } from "./seedTarget.js";

const log = (line: string): void => {
  process.stderr.write(`${line}\n`);
};

export async function main(env: NodeJS.ProcessEnv = process.env): Promise<CommandResult> {
  const target = seedTargetFrom(env, webWrangler, resolve(".data/seed-state"));
  const reader = masterReaderOf(target);
  const archive = resolve(env.SEED_INPUT ?? "it-extract.jsonl.gz");
  const dumpPath = resolve(env.RAW_PAGES ?? ARCHIVE_DUMP.file);
  const master = readMasterRelease(reader);
  log(`reading ${archive} and ${dumpPath} for the master ${master.releaseId} in ${target.dictionary}`);

  const { titles, archiveSha256 } = await readTitles(archive);
  if (archiveSha256 !== master.archiveSha256) {
    return { out: `${archive} has SHA-256 ${archiveSha256}; the master ${master.releaseId} was seeded from ${master.archiveSha256}. Nothing was written.`, status: 1 };
  }
  const languages = await readLanguageHeadings(resolve("fixtures/section-language/regressions.json"));
  const dump = await VerifiedDump.open(dumpPath, ARCHIVE_DUMP);
  let found;
  try {
    found = await findForeignRecords(dump.pages(), titles, languages);
  } finally {
    await dump.close();
  }

  const plan = planHide(reader, found, await readFile(resolve("src/db/schema.sql"), "utf8"));
  const summary = `${found.length} record(s) the rule finds; ${plan.alreadyHidden} already hidden`;
  if (plan.sql === "") return { out: `${summary}; nothing to hide in ${target.dictionary}`, status: 0 };

  const out = resolve(".data/updates");
  await mkdir(out, { recursive: true });
  const file = join(out, `hide-${plan.masterReleaseId}-${Date.now()}.sql`);
  await writeFile(file, plan.sql);
  log(`hiding ${plan.hides.length} record(s) as one transaction: ${file}`);
  // One file, one transaction: if any statement fails, D1 leaves the master as it was.
  try {
    target.execute(["--file", file], false);
  } catch (error: unknown) {
    return { out: `the update did not run to its end, so D1 kept the master as it was (${error instanceof Error ? error.message : String(error)})`, status: 1 };
  }
  const left = unhidden(reader, plan);
  if (left.length > 0) return { out: `the update ran, but these records do not read back as hidden: record ${left.join(", ")}`, status: 1 };
  return {
    out: [
      `${summary}; hidden now: ${plan.hides.length}`,
      ...plan.hides.map(({ recordId, found: { word, foreign } }) =>
        `  ${word} line ${foreign.lineNo} (record ${recordId}): ${foreign.code}, ${foreign.because} at line ${foreign.ref.line} of revision ${foreign.ref.revisionId}`),
      `rows deleted: lookup_form ${plan.removed.lookup_form}, form_of_edge ${plan.removed.form_of_edge}; ` +
        `nearby index rows replaced: ${plan.replacedIndexRows}`,
    ].join("\n"),
    status: 0,
  };
}

if (isMain(import.meta.url)) finish(await main());
