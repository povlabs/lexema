// `pnpm run normalize:source-text`: the one-off updates of an already seeded
// dictionary, one per source text normalization (ADR 0019): the web addresses
// left in a gloss (webAddressUpdate.ts, #872), the glosses a headword line
// leads (headwordLeadUpdate.ts, #325), the glosses (normalizeGlosses.ts,
// #257), the forms (normalizeForms.ts, #342), the gloss grammar stamps
// (glossStampUpdate.ts, #317) and the page text a label's punctuation was left
// in (labelPunctuationUpdate.ts, #712) and the labels
// `{{Fig}}` printed as `figurato` (figLabelUpdate.ts, #800). They are planned
// into one SQL file and run in one step (normalizeSourceText.ts, #455), so a run that
// stops leaves the dictionary as it was. It picks its database the way the
// seed does: the local D1 under `SEED_STATE` (default `.data/seed-state`), or
// the remote D1 `SEED_REMOTE` names. Rule `rendered-fig-label/v1` reads the
// pages of a `wrapped-prose` or `numbered-prose` definition from the dump the
// master's archive was built from (`RAW_PAGES`, default its copy in
// `.data/source/`, fetched from `povlabs/lexema-data` when the cache lacks
// it), held to its size and SHA-1 (#814); with no such definition to decide,
// no dump is read. `--plan-only` prints the plan's counts as JSON and writes
// nothing to the database (src/update/planOnly.ts). See docs/RUN_AN_IMPORT.md.

import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { finish, flags, isMain, usageError, type CommandResult } from "../commandLine.js";
import { archiveFactsFor } from "../source/archiveFacts.js";
import { releaseIdOf } from "../source/servedRelease.js";
import { SourceCache } from "../source/sourceCache.js";
import { KNOWN_DUMPS, VerifiedDump } from "../source/wiktionaryDump.js";
import { readMasterRelease } from "../update/master.js";
import { masterReaderOf } from "../update/updateCli.js";
import { planOnlyAnswer, planOnlyFlag, planOnlyRun } from "../update/planOnly.js";
import { readFigLabelPages } from "./figLabelUpdate.js";
import { normalizeSourceText, planSourceText } from "./normalizeSourceText.js";
import { seedTargetFrom, webWrangler, type Wrangler } from "./seedTarget.js";

const USAGE = "usage: pnpm run normalize:source-text [--out <dir>] [--plan-only]";

export async function main(
  env: NodeJS.ProcessEnv = process.env,
  args: readonly string[] = [],
  wrangler: Wrangler = webWrangler,
  source: SourceCache = new SourceCache(),
): Promise<CommandResult> {
  const { planOnly, rest } = planOnlyFlag(args);
  const options = flags(rest, ["out"]);
  if (typeof options === "string") return usageError(options, USAGE);
  const target = seedTargetFrom(env, wrangler, resolve(".data/seed-state"));
  const reader = masterReaderOf(target);
  const where = env.SEED_REMOTE === undefined
    ? `local D1 ${target.dictionary} in ${resolve(env.SEED_STATE ?? ".data/seed-state")}`
    : `remote D1 ${target.dictionary}`;
  const out = resolve(options.get("out") ?? ".data/updates");

  const pages = await readFigLabelPages(reader, async () => {
    const master = readMasterRelease(reader);
    const dumpId = archiveFactsFor(master.archiveSha256)?.dump.id;
    const identity = dumpId === undefined || !Object.hasOwn(KNOWN_DUMPS, dumpId) ? undefined : KNOWN_DUMPS[dumpId];
    if (identity === undefined) throw new Error(`no dump is known for the master ${master.releaseId}, whose pages rule rendered-fig-label/v1 reads. Nothing was written.`);
    const path = env.RAW_PAGES === undefined ? await source.dump(releaseIdOf(master.archiveSha256)) : resolve(env.RAW_PAGES);
    process.stderr.write(`reading ${path} for the pages of the master ${master.releaseId}'s definitions that rule rendered-fig-label/v1 reads\n`);
    return VerifiedDump.open(path, identity);
  });

  if (planOnly) {
    const plan = planSourceText(reader, pages);
    return planOnlyAnswer(planOnlyRun("normalize:source-text", plan.counts, reader), plan.sql, out, "normalize", { reports: plan.reports });
  }

  process.stderr.write(`normalizing source text in ${where}\n`);
  let file: string | undefined;
  const plan = await normalizeSourceText(reader, pages, async (sql) => {
    await mkdir(out, { recursive: true });
    file = join(out, `normalize-${Date.now()}.sql`);
    await writeFile(file, sql);
    process.stderr.write(`applying the source text rules as one file: ${file}\n`);
    // One file, one step: if any statement fails, D1 leaves the dictionary as it was.
    target.execute(["--file", file], false);
  });
  const { webAddresses, headwordLeads, glosses, forms, glossStamps, labelPunctuation, figLabels } = plan.reports;
  process.stderr.write(`${webAddresses.rule}: sense_gloss: ${webAddresses.changed} row(s) changed, ${webAddresses.candidates} candidate(s) read\n`);
  process.stderr.write(`${headwordLeads.rule}: sense_gloss: ${headwordLeads.changed} row(s) changed, ${headwordLeads.candidates} candidate(s) read\n`);
  process.stderr.write(`${glosses.rule}: sense_gloss: ${glosses.changed} row(s) changed, ${glosses.candidates} candidate(s) read\n`);
  process.stderr.write(`${forms.rule}: lookup_form: ${forms.forms} row(s) removed, grammar_claim: ${forms.claims} row(s) removed\n`);
  process.stderr.write(
    `${glossStamps.rule}: sense_gloss: ${glossStamps.changed.sense_gloss} row(s) changed, ` +
      `grammar_claim: ${glossStamps.changed.grammar_claim} row(s) changed, ${glossStamps.candidates} candidate record(s) read\n`,
  );
  process.stderr.write(
    `${labelPunctuation.rule}: ${Object.entries(labelPunctuation.changed).map(([table, rows]) => `${table}: ${rows} row(s) changed`).join(", ")}, ` +
      `${labelPunctuation.candidates} candidate(s) read\n`,
  );
  process.stderr.write(
    `${figLabels.rule}: ${Object.entries(figLabels.changed).map(([table, rows]) => `${table}: ${rows} row(s) changed`).join(", ")}, ` +
      `${figLabels.candidates} candidate(s) read, ${figLabels.undecided} left undecided\n`,
  );
  return {
    out: JSON.stringify({ database: where, file: file ?? null, counts: plan.counts, webAddresses, headwordLeads, glosses, forms, glossStamps, labelPunctuation, figLabels }),
    status: 0,
  };
}

if (isMain(import.meta.url)) finish(await main(process.env, process.argv.slice(2)));
