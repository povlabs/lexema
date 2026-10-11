// `pnpm run preview:slice`: what a branch's Preview build asks of its
// change declarations (#447). web/builds/previewSlice.ts runs it from the
// repository root and reads the answer it writes; the slice itself is
// src/deploy/previewSlice.ts.
//
//   pnpm run preview:slice declared --answer <file>
//   pnpm run preview:slice build --dictionary lexema-dictionary --answer <file> --sql <file> [--cap <rows>]
//
// `declared` reads only Git: the declarations the checkout adds past `main`,
// and the fingerprint they and schema.sql give a slice, so a build whose
// slice is current writes nothing and plans nothing. `build` plans each
// declaration with `planWrite` against the shared dictionary, through
// read-only statements only, builds the slice locally, and writes its SQL and
// the rows that SQL writes. With `--cap`, a slice of every touched word that
// would write more rows is a sample of them that writes at most that many
// (#741). Neither writes any database: the Preview build decides, against
// the cap, whether the SQL is run, and on which D1.
//
// Every answer is JSON: `none` with the reason a Preview keeps the shared
// dictionary alone, `built` for a slice of every touched word, or `sample`
// for one that leaves out the touched words it names in `leftOut`. A reason
// is an answer, not a failure, so the command exits 0 for it.

import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { finish, flags, isMain, usageError, type CommandResult } from "../commandLine.js";
import { RemoteSeedTarget, webWrangler, type Wrangler } from "../import/seedTarget.js";
import { readOnly } from "../lookup/database.js";
import { DeclarationRefused, type DeclarationDraft, parseDraft } from "../update/declaration.js";
import type { MasterReader } from "../update/master.js";
import { masterReaderOf } from "../update/updateCli.js";
import { lexemaDataFetcher } from "./dataFiles.js";
import { planDeclared } from "./dictionaryDeploy.js";
import { type Git, gitIn } from "./pending.js";
import { PreviewSlice, sliceFingerprint, SliceRefused, SliceSource } from "./previewSlice.js";
import { addedDeclarationFiles } from "./pullRequestPlan.js";
import { hasBoundedWords, NO_WORDS, unionOf } from "./touchedWords.js";
import type { WritePlan } from "./writePlan.js";

const USAGE = `usage:
  pnpm run preview:slice declared --answer <file>
  pnpm run preview:slice build --dictionary <shared dictionary D1> --answer <file> --sql <file> [--cap <rows>]`;

/** The branch the declarations are read past, as the remote has it. */
const MAIN = "main";
const MAIN_REF = `refs/remotes/origin/${MAIN}`;

/** Why a Preview keeps the shared dictionary alone. */
export interface NoSlice {
  readonly state: "none";
  readonly reason: string;
}

/** The declarations a branch adds past `main`, and the fingerprint of the slice they give. */
export type SliceDeclared = NoSlice | { readonly state: "declared"; readonly fingerprint: string; readonly declarations: readonly DeclarationDraft[] };

/** What a build gives: no slice and why, or the slice built locally, which the caller closes. */
export type SliceBuilt = NoSlice | { readonly state: "built"; readonly slice: PreviewSlice };

const none = (reason: string): NoSlice => ({ state: "none", reason });
const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * The declarations the checkout's `HEAD` adds past the remote's `main`. A
 * branch that cannot read `main`, or adds a file that is not a declaration,
 * gets no slice; nor does one that adds none.
 */
export function declaredSlice(git: Git, schema: string): SliceDeclared {
  try {
    git.run(["fetch", "--no-tags", "origin", `+refs/heads/${MAIN}:${MAIN_REF}`]);
  } catch (error: unknown) {
    return none(`the base could not be read: fetching ${MAIN} failed (${messageOf(error)})`);
  }
  let files;
  let declarations;
  try {
    files = addedDeclarationFiles(git, MAIN_REF, "HEAD");
    declarations = files.map(({ file, text }) => parseDraft(file, text));
  } catch (error: unknown) {
    if (error instanceof DeclarationRefused) return none(`a declaration could not be read: ${error.message}`);
    return none(`the declarations past ${MAIN} could not be read: ${messageOf(error)}`);
  }
  if (declarations.length === 0) return none(`the branch adds no change declaration past ${MAIN}`);
  return { state: "declared", fingerprint: sliceFingerprint(files, schema), declarations };
}

/**
 * What `builtSlice` plans through: each declaration's plan against the shared
 * dictionary, which `reader` reads, and the most rows the slice may write.
 * With a `cap`, a slice of every touched word over it is a sample (#741);
 * with none, the slice holds every touched word, whatever it writes.
 */
export interface SlicePlanning {
  readonly reader: MasterReader;
  readonly plan: (declaration: DeclarationDraft) => Promise<WritePlan>;
  readonly cap?: number;
}

/**
 * Plan each declaration against the shared dictionary, in path order, and
 * build the slice of the words they touch with every plan's SQL applied.
 * `update:upgrade`'s SQL is left out: the slice is built from schema.sql, so
 * it has the upgrade already. Over `cap`, the slice is a sample that takes the
 * words the declarations name in their `lookups` first, in path order
 * (`PreviewSlice.fitting`). No slice when a declaration has no bounded word
 * set, when they touch no word, when a plan cannot be read or its SQL does
 * not run on the slice, or when not even one word fits under the cap.
 */
export async function builtSlice(declared: Extract<SliceDeclared, { state: "declared" }>, schema: string, { reader, plan, cap }: SlicePlanning): Promise<SliceBuilt> {
  const unbounded = declared.declarations.find(({ command }) => !hasBoundedWords(command));
  if (unbounded !== undefined) return none(`${unbounded.file} runs ${unbounded.command}, which rewrites the whole dictionary, so no word set bounds a slice`);
  const plans: { file: string; command: string; plan: WritePlan }[] = [];
  for (const declaration of declared.declarations) {
    try {
      plans.push({ file: declaration.file, command: declaration.command, plan: await plan(declaration) });
    } catch (error: unknown) {
      return none(`the plan of ${declaration.file} could not be read: ${messageOf(error)}`);
    }
  }
  const touched = plans.reduce((all, { plan: { touched: words } }) => unionOf(all, words), NO_WORDS);
  if (touched.kind === "unbounded") return none(`${touched.command} has no bounded word set`);
  if (touched.words.length === 0) return none("the declarations touch no word (only update:upgrade, or plans that write nothing)");
  const changes = plans.filter(({ command, plan: { sql } }) => command !== "update:upgrade" && sql !== "").map(({ file, plan: { sql } }) => ({ file, sql }));
  const inputs = { schema, changes, fingerprint: declared.fingerprint };
  try {
    if (cap === undefined) return { state: "built", slice: PreviewSlice.build({ reader, words: touched.words, ...inputs }) };
    const named = declared.declarations.flatMap(({ lookups = [] }) => lookups.map(({ word }) => word));
    const source = SliceSource.copy({ reader, words: touched.words, schema });
    try {
      return { state: "built", slice: PreviewSlice.fitting({ source, named, cap, ...inputs }) };
    } finally {
      source.close();
    }
  } catch (error: unknown) {
    if (error instanceof SliceRefused) return none(error.message);
    return none(`the slice could not be built: ${messageOf(error)}`);
  }
}

/** A reader that runs only single SELECTs on the dictionary: the slice never writes the shared dictionary (ADR 0018). */
export const readOnlyReader = (reader: MasterReader): MasterReader => ({ query: <Row>(sql: string): Row[] => reader.query<Row>(readOnly(sql)) });

export async function main(args: readonly string[], wrangler: Wrangler = webWrangler, git: Git = gitIn(process.cwd())): Promise<CommandResult> {
  const [verb, ...rest] = args;
  if (verb !== "declared" && verb !== "build") return usageError(`unknown argument ${verb}`, USAGE);
  const options = flags(rest, verb === "declared" ? ["answer"] : ["dictionary", "answer", "sql", "cap"]);
  if (typeof options === "string") return usageError(options, USAGE);
  const answerFile = options.get("answer");
  if (answerFile === undefined) return usageError("--answer names the file the answer is written to", USAGE);
  const dictionary = options.get("dictionary");
  const sqlFile = options.get("sql");
  if (verb === "build" && (dictionary === undefined || sqlFile === undefined)) return usageError("build needs --dictionary and --sql", USAGE);
  const capText = options.get("cap");
  const cap = capText === undefined ? undefined : Number(capText);
  if (cap !== undefined && !(Number.isInteger(cap) && cap > 0)) return usageError(`--cap must be a whole number of rows above 0, not ${capText}`, USAGE);
  const schema = await readFile(resolve("src/db/schema.sql"), "utf8");
  const declared = declaredSlice(git, schema);

  let answer: Record<string, unknown>;
  if (declared.state === "none") answer = { ...declared };
  else if (verb === "declared" || dictionary === undefined || sqlFile === undefined) {
    answer = { state: "declared", fingerprint: declared.fingerprint, files: declared.declarations.map(({ file }) => file) };
  } else {
    const reader = readOnlyReader(masterReaderOf(new RemoteSeedTarget(wrangler, dictionary)));
    const fetcher = lexemaDataFetcher();
    const workDir = await mkdtemp(join(tmpdir(), "lexema-slice-"));
    const built = await builtSlice(declared, schema, { reader, plan: (declaration) => planDeclared(declaration, { reader, fetcher, workDir }), cap });
    if (built.state === "none") answer = { ...built };
    else {
      const { slice } = built;
      try {
        await writeFile(sqlFile, slice.sql());
        answer = { state: "built", fingerprint: slice.fingerprint, words: slice.keys.length, rowsWritten: slice.rowsWritten, rowsByTable: slice.rowsByTable(), sql: resolve(sqlFile) };
        if (slice.isSample) answer = { ...answer, state: "sample", leftOut: slice.leftOut };
      } finally {
        slice.close();
      }
    }
  }
  await writeFile(answerFile, `${JSON.stringify(answer)}\n`);
  return { out: JSON.stringify(answer), status: 0 };
}

if (isMain(import.meta.url)) finish(await main(process.argv.slice(2)));
