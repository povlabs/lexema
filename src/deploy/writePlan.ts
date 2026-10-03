// One declared change, planned against the dictionary (#456): the SQL file
// its command would run, the counts that file writes, and the read-back that
// says whether the dictionary holds what the plan wrote. Each command's plan
// is the one its own CLI builds (#455), so the deploy writes what a plan-only
// run of that command counts.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { planCorrections, unwritten } from "../import/correctRecords.js";
import { readRulePass, findHiddenRecords } from "../import/hiddenLayer.js";
import { planHide, unhidden } from "../import/hideRecords.js";
import { danglingTitles, findPageEntries, planPageEntries, unloaded } from "../import/loadPageEntries.js";
import { planSourceText } from "../import/normalizeSourceText.js";
import { CURATED_CORRECTIONS, type CuratedCorrection } from "../italian/curatedCorrections.js";
import { readLanguageHeadings } from "../italian/sectionLanguage.js";
import { ARCHIVE_FACTS, archiveFactsFor, type ArchiveFactsCatalog } from "../source/archiveFacts.js";
import { type DumpIdentity, KNOWN_DUMPS, VerifiedDump } from "../source/wiktionaryDump.js";
import { checkApplied } from "../update/apply.js";
import { automaticPlan } from "../update/automatic.js";
import type { DeclaredChange, PlanOnlyRun } from "../update/declaration.js";
import { diffAgainstMaster } from "../update/diff.js";
import { planUpgrade, readMasterRelease, type Rebuild, rebuildsOf, upgradeShortfall, type MasterReader } from "../update/master.js";
import { PlanCounts } from "../update/planCounts.js";
import { planOnlyRun } from "../update/planOnly.js";
import { type SourceCatalogs, withFeedDump } from "../update/select.js";
import { DataRefused, type FetchedFiles, sha256Of } from "./dataFiles.js";

/** The schema the upgrade reads and the language headings the plans read, from the repository root. */
export const SCHEMA = resolve("src/db/schema.sql");
export const LANGUAGES = resolve("fixtures/section-language/regressions.json");

/** One change, ready to run: what it writes, counted, and how to check it was written. */
export interface WritePlan {
  readonly run: PlanOnlyRun;
  /** The whole change as one file; empty when there is nothing to write. */
  readonly sql: string;
  /** What the dictionary does not hold as planned, read after the file ran; empty when it all reads back. */
  readBack(reader: MasterReader): string[];
  /** The tables `update:upgrade` drops and creates again, with their rows; absent for every other command. */
  readonly rebuilds?: readonly Rebuild[];
}

/** A change and the files it reads: `update:auto`, `hide:records` and `load:page-entries` read an archive and a dump, the others none. */
export type ReadyChange =
  | { readonly change: Extract<DeclaredChange, { command: "update:upgrade" | "normalize:source-text" | "correct:records" }> }
  | { readonly change: Extract<DeclaredChange, { command: "update:auto" | "hide:records" | "load:page-entries" }>; readonly files: FetchedFiles };

/**
 * What a plan reads besides the dictionary and the files: the archive facts
 * and dumps, and the curated corrections. Each is the committed one unless
 * given, so a test can plan against a fixture's own.
 */
export interface PlanSources extends SourceCatalogs {
  readonly corrections?: readonly CuratedCorrection[];
}

/** The dump the master's archive was built from, opened at `path` and held to its size and SHA-1. */
async function openMasterDump(path: string, archive: string, archiveSha256: string, catalog: ArchiveFactsCatalog, dumps: Readonly<Record<string, DumpIdentity>>): Promise<VerifiedDump> {
  const facts = archiveFactsFor(archiveSha256, catalog);
  const identity = facts === undefined || !Object.hasOwn(dumps, facts.dump.id) ? undefined : dumps[facts.dump.id];
  if (identity === undefined) throw new DataRefused([`no dump is known for ${archive}`]);
  return VerifiedDump.open(path, identity);
}

/** Pair `change` with the files it reads, or refuse when it reads files and has none, or reads none and has some. */
export function readyChange(change: DeclaredChange, files: FetchedFiles | null): ReadyChange {
  switch (change.command) {
    case "update:upgrade":
    case "normalize:source-text":
    case "correct:records":
      if (files !== null) throw new Error(`${change.command} reads no archive`);
      return { change };
    case "update:auto":
    case "hide:records":
    case "load:page-entries":
      if (files === null) throw new Error(`${change.command} reads an archive and a dump`);
      return { change, files };
  }
}

/**
 * Plan `ready` against the dictionary `reader` reads. It writes nothing.
 * `sources` are the archive facts, dumps and curated corrections it reads,
 * the committed ones unless a plan-only run is given a release not yet
 * committed.
 */
export async function planWrite(ready: ReadyChange, reader: MasterReader, appliedAt: string, sources: PlanSources = {}): Promise<WritePlan> {
  const { catalog = ARCHIVE_FACTS, dumps = KNOWN_DUMPS, corrections = CURATED_CORRECTIONS } = sources;
  if (!("files" in ready)) {
    const { change } = ready;
    switch (change.command) {
      case "update:upgrade": {
        const schema = await readFile(SCHEMA, "utf8");
        const upgrade = planUpgrade(reader, schema);
        return {
          run: planOnlyRun(change.command, PlanCounts.NONE, reader),
          sql: upgrade.sql,
          readBack: (after) => upgradeShortfall(after, schema, upgrade),
          rebuilds: rebuildsOf(upgrade),
        };
      }
      case "normalize:source-text": {
        const plan = planSourceText(reader);
        return {
          run: planOnlyRun(change.command, plan.counts, reader),
          sql: plan.sql,
          readBack: (after) => {
            const left = planSourceText(after).statements;
            return left === 0 ? [] : [`${left} source text change(s) still pending after the file ran`];
          },
        };
      }
      case "correct:records": {
        const plan = planCorrections(reader, corrections);
        return {
          run: planOnlyRun(change.command, plan.counts, reader),
          sql: plan.sql,
          readBack: (after) => unwritten(after, plan).map((id) => `correction ${id} does not read back as written`),
        };
      }
    }
  }

  const { change, files } = ready;
  if (change.command === "update:auto") {
    const found = await diffAgainstMaster(reader, files.archive);
    if (found.feed.releaseId !== change.inputs.feedRelease) {
      throw new DataRefused([`${files.archive} is release ${found.feed.releaseId}; ${change.file} declares ${change.inputs.feedRelease}`]);
    }
    const plan = await withFeedDump(found.feed, files.dump, LANGUAGES, (pages) => automaticPlan(reader, found, pages, { appliedAt, catalog }), { catalog, dumps });
    return {
      run: planOnlyRun(change.command, plan?.counts ?? PlanCounts.NONE, reader),
      sql: plan?.sql ?? "",
      readBack: (after) => {
        if (plan === null) return [];
        const { missing, differing } = checkApplied(after, plan);
        return [
          ...missing.map((id) => `change ${id} is not recorded with the record id planned`),
          ...differing.map(({ table, planned, found: held }) => `${table}: ${held} row(s) for the new records, ${planned} planned`),
        ];
      },
    };
  }

  if (change.command === "load:page-entries") {
    const master = readMasterRelease(reader);
    const sha256 = await sha256Of(files.archive);
    if (sha256 !== master.archiveSha256) {
      throw new DataRefused([`${change.file} declares ${change.inputs.archive}, but the master ${master.releaseId} was seeded from the archive with SHA-256 ${master.archiveSha256}`]);
    }
    const dump = await openMasterDump(files.dump, change.inputs.archive, sha256, catalog, dumps);
    let found;
    try {
      found = await findPageEntries(dump.pages(), danglingTitles(reader));
    } finally {
      await dump.close();
    }
    const plan = planPageEntries(reader, found, corrections);
    return {
      run: planOnlyRun(change.command, plan.counts, reader),
      sql: plan.sql,
      readBack: (after) => unloaded(after, plan).map((title) => `page-only entry ${title} does not read back as written`),
    };
  }

  const master = readMasterRelease(reader);
  const pass = await readRulePass(files.archive);
  if (pass.archiveSha256 !== master.archiveSha256) {
    throw new DataRefused([`${change.file} declares ${change.inputs.archive}, but the master ${master.releaseId} was seeded from the archive with SHA-256 ${master.archiveSha256}`]);
  }
  const dump = await openMasterDump(files.dump, change.inputs.archive, pass.archiveSha256, catalog, dumps);
  let found;
  try {
    found = await findHiddenRecords(dump.pages(), pass, await readLanguageHeadings(LANGUAGES));
  } finally {
    await dump.close();
  }
  const plan = planHide(reader, found);
  return {
    run: planOnlyRun(change.command, plan.counts, reader),
    sql: plan.sql,
    readBack: (after) => unhidden(after, plan).map((recordId) => `record ${recordId} does not read back as hidden`),
  };
}
