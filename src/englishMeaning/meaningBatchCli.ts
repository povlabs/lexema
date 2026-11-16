// `pnpm run meanings:batch` — make English meanings for chosen words offline,
// through the Message Batches API (ADR 0035, #933). It is the only code that
// calls a model; no Worker or `web/` path does.
//
//   pnpm run meanings:batch plan <word>... | --spot-check
//   pnpm run meanings:batch submit <word>... | --spot-check
//   pnpm run meanings:batch collect <batch-id>
//
// `plan` reads the senses and prints what a run would send, sending nothing.
// `submit` sends one batch and keeps its manifest under `--out` (default
// `.data/english-meanings`); `collect` waits for that batch to end, stores
// each meaning in `english_meaning`, keeps the raw results beside the
// manifest, and prints a Markdown report with the tokens and their cost.
// `--spot-check` names the twelve queries of
// reports/2026-09-18-dataset-spot-check.md.
//
// It reads and writes the local D1 under `SEED_STATE` (default
// `.data/seed-state`); a remote D1 is refused. `submit` needs
// `ANTHROPIC_API_KEY`. A run is capped at `MAX_REQUESTS` requests: the full
// run over every sense is a later decision, not this command's default.

import Anthropic from "@anthropic-ai/sdk";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { finish, flags, isMain, usageError, type CommandResult } from "../commandLine.js";
import { webWrangler, type Wrangler, LocalSeedTarget } from "../import/seedTarget.js";
import { fromNodeSqlite } from "../lookup/database.js";
import { dictionaryFile, masterOf } from "../lookup/localDictionary.js";
import { dictionaryTables } from "../lookup/served.js";
import { upgradeFirst, upgradeNeededFor } from "../update/master.js";
import { ENGLISH_MEANING_TABLES } from "../update/masterUpgrade.js";
import { masterReaderOf } from "../update/updateCli.js";
import { planBatch, readResults, type BatchPlan, type Manifest, type ReadResults, type TokenUse } from "./meaningBatch.js";
import { readMeaningPages } from "./meaningPages.js";
import { MEANING_MODEL } from "./meaningRequest.js";
import { byKey, insertSql, MEANING_TABLE, rowsOfHeadwordsSql, type MeaningRow } from "./meaningStore.js";

const USAGE = [
  "usage: pnpm run meanings:batch plan <word>... | --spot-check",
  "       pnpm run meanings:batch submit <word>... | --spot-check [--out <dir>]",
  "       pnpm run meanings:batch collect <batch-id> [--out <dir>]",
].join("\n");

/** The twelve queries of reports/2026-09-18-dataset-spot-check.md, in its order. */
export const SPOT_CHECK_QUERIES = ["casa", "case", "studente", "studenti", "sale", "andare", "andavano", "parlare", "parlerei", "bello", "bella", "città"] as const;

/** The most requests one run sends. A run over every sense is not this command's to start. */
export const MAX_REQUESTS = 500;

/** How long `collect` waits between reads of a batch that has not ended. */
const POLL_MS = 30_000;

/**
 * Message Batches prices for `MEANING_MODEL`, dollars per million tokens: half
 * the standard input and output prices, and the cache multipliers (1.25x
 * write, 0.05x read) applied to the batch input price. Read from
 * https://platform.claude.com/docs/en/about-claude/pricing on 2026-11-16.
 */
export const BATCH_PRICES = { model: MEANING_MODEL, input: 1.0, output: 5.0, cacheWrite: 1.25, cacheRead: 0.05 } as const;

/** What a run costs at `BATCH_PRICES`, in dollars. */
export const costOf = (tokens: TokenUse): number =>
  (tokens.input * BATCH_PRICES.input + tokens.output * BATCH_PRICES.output + tokens.cacheWrite * BATCH_PRICES.cacheWrite + tokens.cacheRead * BATCH_PRICES.cacheRead) / 1_000_000;

/** The batch calls the command makes; the SDK's in a run, a stub in a test. */
export interface BatchClient {
  create(requests: BatchPlan["requests"]): Promise<{ id: string }>;
  ended(batchId: string): Promise<boolean>;
  results(batchId: string): Promise<Anthropic.Messages.Batches.MessageBatchIndividualResponse[]>;
}

/** The Message Batches API, through the SDK, with the key in `ANTHROPIC_API_KEY`. */
export function anthropicBatches(): BatchClient {
  const client = new Anthropic();
  return {
    create: async (requests) => client.messages.batches.create({ requests }),
    ended: async (batchId) => (await client.messages.batches.retrieve(batchId)).processing_status === "ended",
    results: async (batchId) => {
      const all: Anthropic.Messages.Batches.MessageBatchIndividualResponse[] = [];
      for await (const result of await client.messages.batches.results(batchId)) all.push(result);
      return all;
    },
  };
}

export interface Environment {
  env: NodeJS.ProcessEnv;
  wrangler: Wrangler;
  client: () => BatchClient;
  now: () => Date;
  sleep: (ms: number) => Promise<void>;
  log: (line: string) => void;
}

const defaults: Environment = {
  env: process.env,
  wrangler: webWrangler,
  client: anthropicBatches,
  now: () => new Date(),
  sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
  log: (line) => process.stderr.write(`${line}\n`),
};

/** The words a `plan` or `submit` names. */
function wordsOf(args: readonly string[]): string[] | string {
  if (args.length === 1 && args[0] === "--spot-check") return [...SPOT_CHECK_QUERIES];
  if (args.length === 0) return "name the words, or --spot-check";
  const flag = args.find((arg) => arg.startsWith("--"));
  return flag === undefined ? [...args] : `unknown argument ${flag}`;
}

/** The local dictionary: its state directory, refusing a remote one. */
function stateOf(env: NodeJS.ProcessEnv): string {
  if (env.SEED_REMOTE !== undefined) throw new Error("meanings:batch writes only a local D1; unset SEED_REMOTE");
  return resolve(env.SEED_STATE ?? ".data/seed-state");
}

/** The plan for `words` over the local dictionary, and the master it read. */
async function planFor(state: string, words: readonly string[]): Promise<{ plan: BatchPlan; releaseId: string; missing: string[] }> {
  const raw = new DatabaseSync(await dictionaryFile(state), { readOnly: true });
  try {
    const releaseId = masterOf(raw, undefined);
    const db = fromNodeSqlite(raw);
    const pages = await readMeaningPages(db, releaseId, await dictionaryTables(db), words);
    const hasTable = raw.prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?").get(MEANING_TABLE) !== undefined;
    const held = hasTable ? (raw.prepare(rowsOfHeadwordsSql(words)).all() as unknown as MeaningRow[]) : [];
    const missing = pages.filter(({ senses, formOf }) => senses.length === 0 && formOf.length === 0).map(({ page }) => page.headword);
    return { plan: planBatch(pages, byKey(held)), releaseId, missing };
  } finally {
    raw.close();
  }
}

/** What a plan sends, in one line per kind of sense. */
function planLines(plan: BatchPlan, releaseId: string, missing: readonly string[]): string[] {
  const count = (need: string) => plan.manifest.senses.filter((sense) => sense.need === need).length;
  return [
    `master ${releaseId}, model ${plan.manifest.model}, prompt ${plan.manifest.promptVersion}`,
    `senses with source English, no request: ${count("source")}`,
    `senses with a stored meaning, no request: ${count("held")}`,
    `senses asked: ${count("ask")}, in ${plan.requests.length} request(s)`,
    `form-of senses, no meaning: ${count("form-of")}`,
    ...(missing.length === 0 ? [] : [`words with no served record: ${missing.join(", ")}`]),
  ];
}

const manifestFile = (out: string, batchId: string): string => join(out, `${batchId}.manifest.json`);

async function submit(environment: Environment, words: readonly string[], out: string): Promise<CommandResult> {
  const { plan, releaseId, missing } = await planFor(stateOf(environment.env), words);
  const lines = planLines(plan, releaseId, missing);
  if (plan.requests.length === 0) return { out: ["nothing to send", ...lines].join("\n"), status: 0 };
  if (plan.requests.length > MAX_REQUESTS) {
    return { out: [`${plan.requests.length} requests is more than one run sends (${MAX_REQUESTS}); nothing was sent`, ...lines].join("\n"), status: 1 };
  }
  const batch = await environment.client().create(plan.requests);
  await mkdir(out, { recursive: true });
  await writeFile(manifestFile(out, batch.id), `${JSON.stringify({ batchId: batch.id, releaseId, words, submittedAt: environment.now().toISOString(), ...plan.manifest }, null, 2)}\n`);
  return { out: [`submitted batch ${batch.id}`, ...lines, `collect it with: pnpm run meanings:batch collect ${batch.id}`].join("\n"), status: 0 };
}

async function collect(environment: Environment, batchId: string, out: string): Promise<CommandResult> {
  const manifest = JSON.parse(await readFile(manifestFile(out, batchId), "utf8")) as Manifest & { releaseId: string };
  const state = stateOf(environment.env);
  const target = new LocalSeedTarget(environment.wrangler, state);
  const needed = upgradeNeededFor(masterReaderOf(target), ENGLISH_MEANING_TABLES);
  if (needed.length > 0) return { out: upgradeFirst(target.dictionary, needed), status: 1 };

  const client = environment.client();
  while (!(await client.ended(batchId))) {
    environment.log(`batch ${batchId} has not ended; reading it again in ${POLL_MS / 1000} s`);
    await environment.sleep(POLL_MS);
  }
  const raw = await client.results(batchId);
  await writeFile(join(out, `${batchId}.results.jsonl`), raw.map((result) => JSON.stringify(result)).join("\n") + "\n");
  const read = readResults(manifest, batchId, raw, environment.now().toISOString());

  const sql = insertSql(read.stored);
  if (sql !== "") {
    const file = join(out, `${batchId}.sql`);
    await writeFile(file, sql);
    // One file, one transaction: if any row fails, D1 keeps none of them.
    target.execute(["--file", file], false);
  }
  return { out: reportOf(manifest, batchId, read), status: 0 };
}

const cell = (text: string): string => text.replaceAll("|", "\\|").replaceAll("\n", " ");

/** The run as Markdown: each sense, what it got, and the tokens and cost. */
export function reportOf(manifest: Manifest, batchId: string, read: ReadResults): string {
  const byId = new Map(read.results.map((result) => [result.customId, result]));
  const rows = manifest.senses.map((sense) => {
    const head = `| ${cell(sense.headword)} | ${sense.pos} | ${cell(sense.definition)} |`;
    if (sense.need === "form-of") return `${head} | — | form-of, none made |`;
    if (sense.need === "source") return `${head} | ${cell(sense.english.join(", "))} | source |`;
    if (sense.need === "held") return `${head} | ${cell(sense.english)} | ${sense.origin} (held) |`;
    const result = byId.get(sense.customId);
    if (result === undefined) return `${head} | — | no result |`;
    if (result.kind === "stored") return `${head} | ${cell(result.english)} | ${result.origin} |`;
    return `${head} | — | ${result.kind}: ${cell(result.reason)} |`;
  });
  const { tokens } = read;
  return [
    `Batch \`${batchId}\`, model \`${manifest.model}\`, prompt \`${manifest.promptVersion}\`: ${read.stored.length} meaning(s) stored, ${read.results.length - read.stored.length} not.`,
    "",
    "| Headword | Part of speech | Italian definition | English | Origin |",
    "|---|---|---|---|---|",
    ...rows,
    "",
    "| Tokens | Count |",
    "|---|---:|",
    `| Input, uncached | ${tokens.input} |`,
    `| Cache write | ${tokens.cacheWrite} |`,
    `| Cache read | ${tokens.cacheRead} |`,
    `| Output | ${tokens.output} |`,
    "",
    `Cost at batch prices (input $${BATCH_PRICES.input}, output $${BATCH_PRICES.output}, cache write $${BATCH_PRICES.cacheWrite}, cache read $${BATCH_PRICES.cacheRead} per million tokens): $${costOf(tokens).toFixed(4)}.`,
  ].join("\n");
}

export async function main(args: readonly string[], environment: Environment = defaults): Promise<CommandResult> {
  const [command, ...rest] = args;
  if (command === "collect") {
    const [batchId, ...more] = rest;
    if (batchId === undefined || batchId.startsWith("--")) return usageError("name the batch to collect", USAGE);
    const options = flags(more, ["out"]);
    if (typeof options === "string") return usageError(options, USAGE);
    return collect(environment, batchId, resolve(options.get("out") ?? ".data/english-meanings"));
  }
  if (command === "plan" || command === "submit") {
    const outAt = rest.indexOf("--out");
    const out = outAt === -1 ? undefined : rest[outAt + 1];
    if (outAt !== -1 && (command === "plan" || out === undefined)) return usageError("--out is for submit and collect, with a directory", USAGE);
    const words = wordsOf(outAt === -1 ? rest : [...rest.slice(0, outAt), ...rest.slice(outAt + 2)]);
    if (typeof words === "string") return usageError(words, USAGE);
    if (command === "submit") return submit(environment, words, resolve(out ?? ".data/english-meanings"));
    const { plan, releaseId, missing } = await planFor(stateOf(environment.env), words);
    return { out: planLines(plan, releaseId, missing).join("\n"), status: 0 };
  }
  return usageError(command === undefined ? "name a command" : `unknown command ${command}`, USAGE);
}

/** A refusal from the Message Batches API as one plain line; anything else is thrown on. */
export async function plainApiErrors(run: Promise<CommandResult>): Promise<CommandResult> {
  try {
    return await run;
  } catch (failure) {
    if (failure instanceof Anthropic.APIError) return { out: `the Message Batches API refused (${failure.status ?? "no status"}): ${failure.message}`, status: 1 };
    throw failure;
  }
}

if (isMain(import.meta.url)) finish(await plainApiErrors(main(process.argv.slice(2))));
