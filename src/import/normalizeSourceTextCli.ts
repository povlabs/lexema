// `pnpm run normalize:source-text`: the one-off updates of an already seeded
// dictionary, one per source text normalization (ADR 0019): the glosses a
// headword line leads (headwordLeadUpdate.ts, #325), the glosses
// (normalizeGlosses.ts, #257), the forms (normalizeForms.ts, #342), the
// gloss grammar stamps (glossStampUpdate.ts, #317) and the page text a label's
// punctuation was left in (labelPunctuationUpdate.ts, #712). They are planned
// into one SQL file and run in one step (normalizeSourceText.ts, #455), so a run that
// stops leaves the dictionary as it was. It picks its database the way the
// seed does: the local D1 under `SEED_STATE` (default `.data/seed-state`), or
// the remote D1 `SEED_REMOTE` names. `--plan-only` prints the plan's counts as
// JSON and writes nothing to the database (src/update/planOnly.ts). See
// docs/RUN_AN_IMPORT.md.

import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { finish, flags, isMain, usageError, type CommandResult } from "../commandLine.js";
import { masterReaderOf } from "../update/updateCli.js";
import { planOnlyAnswer, planOnlyFlag, planOnlyRun } from "../update/planOnly.js";
import { normalizeSourceText, planSourceText } from "./normalizeSourceText.js";
import { seedTargetFrom, webWrangler, type Wrangler } from "./seedTarget.js";

const USAGE = "usage: pnpm run normalize:source-text [--out <dir>] [--plan-only]";

export async function main(env: NodeJS.ProcessEnv = process.env, args: readonly string[] = [], wrangler: Wrangler = webWrangler): Promise<CommandResult> {
  const { planOnly, rest } = planOnlyFlag(args);
  const options = flags(rest, ["out"]);
  if (typeof options === "string") return usageError(options, USAGE);
  const target = seedTargetFrom(env, wrangler, resolve(".data/seed-state"));
  const reader = masterReaderOf(target);
  const where = env.SEED_REMOTE === undefined
    ? `local D1 ${target.dictionary} in ${resolve(env.SEED_STATE ?? ".data/seed-state")}`
    : `remote D1 ${target.dictionary}`;
  const out = resolve(options.get("out") ?? ".data/updates");

  if (planOnly) {
    const plan = planSourceText(reader);
    return planOnlyAnswer(planOnlyRun("normalize:source-text", plan.counts, reader), plan.sql, out, "normalize", { reports: plan.reports });
  }

  process.stderr.write(`normalizing source text in ${where}\n`);
  let file: string | undefined;
  const plan = await normalizeSourceText(reader, async (sql) => {
    await mkdir(out, { recursive: true });
    file = join(out, `normalize-${Date.now()}.sql`);
    await writeFile(file, sql);
    process.stderr.write(`applying the source text rules as one file: ${file}\n`);
    // One file, one step: if any statement fails, D1 leaves the dictionary as it was.
    target.execute(["--file", file], false);
  });
  const { headwordLeads, glosses, forms, glossStamps, labelPunctuation } = plan.reports;
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
  return {
    out: JSON.stringify({ database: where, file: file ?? null, counts: plan.counts, headwordLeads, glosses, forms, glossStamps, labelPunctuation }),
    status: 0,
  };
}

if (isMain(import.meta.url)) finish(await main(process.env, process.argv.slice(2)));
