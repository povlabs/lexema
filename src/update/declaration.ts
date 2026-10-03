// A change declaration (#455): one JSON file under `dictionary-changes/` that
// names one write to the shared dictionary, its inputs, and the counts its
// plan is expected to have. One file per change, so two pull requests never
// edit one list. The deploy reads them and the monthly release job writes
// them (#446); this is the only format either uses. `parseDeclaration` is the
// only way to get a `ChangeDeclaration`, so a value of that type is always a
// valid one.

import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { FORM_OF_FOREIGN_LEMMA_RULE } from "../italian/formOfForeignLemma.js";
import { SECTION_LANGUAGE_RULE } from "../italian/sectionLanguage.js";
import { SOURCE_TEXT_UPDATE_RULES } from "../import/normalizeSourceText.js";
import { type CountDifference, type CountedTable, isCountedTable, PlanCounts } from "./planCounts.js";

/** The directory, from the repository root, that holds every change declaration. */
export const DECLARATIONS_DIR = "dictionary-changes";

/** Whether `path`, from the repository root, is where a declaration lives: a `.json` file directly under `DECLARATIONS_DIR`. */
export const isDeclarationPath = (path: string): boolean =>
  path.startsWith(`${DECLARATIONS_DIR}/`) && path.endsWith(".json") && !path.slice(DECLARATIONS_DIR.length + 1).includes("/");

/** The five commands that write the dictionary. */
export const DECLARED_COMMANDS = ["update:upgrade", "update:auto", "hide:records", "normalize:source-text", "correct:records"] as const;
export type DeclaredCommand = (typeof DECLARED_COMMANDS)[number];

/** A release id: `it-` and the first eight hex digits of its archive's SHA-256. */
export type ReleaseId = `it-${string}`;
const RELEASE_ID = /^it-[0-9a-f]{8}$/;

/** The rules `hide:records` applies; a declaration names them all. */
export const HIDING_RULES = [SECTION_LANGUAGE_RULE, FORM_OF_FOREIGN_LEMMA_RULE] as const;

interface Declared<Command extends DeclaredCommand, Inputs> {
  /** The file it was read from, as given. */
  readonly file: string;
  readonly command: Command;
  readonly inputs: Inputs;
}

/**
 * One write and its inputs, without the counts it expects: what a plan-only
 * run is asked for (`parseChange`), and the part of a declaration a plan is
 * built from.
 */
export type DeclaredChange =
  | Declared<"update:upgrade", Record<string, never>>
  /** The feed release whose eligible changes are applied; its archive and dump follow from it. */
  | Declared<"update:auto", { readonly feedRelease: ReleaseId }>
  /** The release the master was seeded from, whose archive the rules read, and the rules. */
  | Declared<"hide:records", { readonly archive: ReleaseId; readonly rules: typeof HIDING_RULES }>
  | Declared<"normalize:source-text", { readonly rules: typeof SOURCE_TEXT_UPDATE_RULES }>
  /**
   * No inputs: it writes the committed list (src/italian/curatedCorrections.ts)
   * as it stands at the deploy's commit, and the expected counts pin what that
   * list writes.
   */
  | Declared<"correct:records", Record<string, never>>;

export type ChangeDeclaration = DeclaredChange & { readonly expected: PlanCounts };

/**
 * A declaration as a pull request adds it (#494): its `expected` may still be
 * missing, since the pull request's plan check is what finds it. The deploy
 * reads only a `ChangeDeclaration`, so a draft with no counts never deploys.
 */
export type DeclarationDraft = DeclaredChange & { readonly expected: PlanCounts | null };

/** Why a file is not a change declaration, naming the file. */
export class DeclarationRefused extends Error {
  constructor(readonly file: string, readonly reasons: readonly string[]) {
    super(`${file} is not a change declaration:\n${reasons.map((reason) => `- ${reason}`).join("\n")}`);
    this.name = "DeclarationRefused";
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isCommand = (value: unknown): value is DeclaredCommand =>
  typeof value === "string" && (DECLARED_COMMANDS as readonly string[]).includes(value);

/** Every key of `value` that is not one of `allowed`, as reasons. */
function unknownKeys(value: Record<string, unknown>, allowed: readonly string[], where: string): string[] {
  return Object.keys(value).filter((key) => !allowed.includes(key)).map((key) => `${where} has an unknown field ${JSON.stringify(key)}`);
}

function releaseId(value: unknown, where: string, reasons: string[]): ReleaseId | undefined {
  if (typeof value === "string" && RELEASE_ID.test(value)) return value as ReleaseId;
  reasons.push(`${where} must be a release id, it- and eight lowercase hex digits, got ${JSON.stringify(value)}`);
  return undefined;
}

/** `value` when it lists exactly `rules`, in any order. */
function ruleSet<Rules extends readonly string[]>(value: unknown, rules: Rules, where: string, reasons: string[]): Rules | undefined {
  const listed = Array.isArray(value) && value.every((rule) => typeof rule === "string") ? (value as string[]) : undefined;
  if (listed === undefined) {
    reasons.push(`${where} must be a list of rule ids`);
    return undefined;
  }
  const unknown = listed.filter((rule) => !rules.includes(rule));
  const missing = rules.filter((rule) => !listed.includes(rule));
  for (const rule of unknown) reasons.push(`${where} names ${JSON.stringify(rule)}, which the command does not apply`);
  if (missing.length > 0) reasons.push(`${where} must name every rule the command applies; it lacks ${missing.join(", ")}`);
  if (new Set(listed).size !== listed.length) reasons.push(`${where} names a rule twice`);
  return unknown.length === 0 && missing.length === 0 && new Set(listed).size === listed.length ? rules : undefined;
}

function rows(value: unknown, where: string, reasons: string[]): Partial<Record<CountedTable, number>> {
  if (value === undefined) return {};
  if (!isObject(value)) {
    reasons.push(`${where} must be an object of table names and row counts`);
    return {};
  }
  const read: Partial<Record<CountedTable, number>> = {};
  for (const [table, count] of Object.entries(value)) {
    if (!isCountedTable(table)) reasons.push(`${where} names ${JSON.stringify(table)}, a table no write command changes`);
    else if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) reasons.push(`${where}.${table} must be a whole number of rows, got ${JSON.stringify(count)}`);
    else read[table] = count;
  }
  return read;
}

function counts(value: unknown, reasons: string[]): PlanCounts | undefined {
  if (!isObject(value)) {
    reasons.push("expected must be an object with records, and optionally written and deleted");
    return undefined;
  }
  reasons.push(...unknownKeys(value, ["records", "written", "deleted"], "expected"));
  const records = value.records;
  const read: Record<string, number> = {};
  if (!isObject(records)) reasons.push("expected.records must be an object with added, changed and removed");
  else {
    reasons.push(...unknownKeys(records, ["added", "changed", "removed"], "expected.records"));
    for (const name of ["added", "changed", "removed"]) {
      const count = records[name];
      if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) reasons.push(`expected.records.${name} must be a whole number of records, got ${JSON.stringify(count)}`);
      else read[name] = count;
    }
  }
  const written = rows(value.written, "expected.written", reasons);
  const deleted = rows(value.deleted, "expected.deleted", reasons);
  if (Object.keys(read).length !== 3) return undefined;
  return new PlanCounts({ added: read.added, changed: read.changed, removed: read.removed }, written, deleted);
}

/** `text` as a JSON object, or `DeclarationRefused` naming `file`. */
function jsonObject(file: string, text: string, fields: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error: unknown) {
    throw new DeclarationRefused(file, [`it is not JSON (${error instanceof Error ? error.message : String(error)})`]);
  }
  if (!isObject(value)) throw new DeclarationRefused(file, [`it must be a JSON object with ${fields}`]);
  return value;
}

/** The command and inputs `value` states, adding everything wrong with them to `reasons`; undefined when an input is unreadable. */
function changeOf(file: string, value: Record<string, unknown>, reasons: string[]): DeclaredChange | undefined {
  const { command } = value;
  if (!isCommand(command)) {
    reasons.push(`command must be one of ${DECLARED_COMMANDS.join(", ")}, got ${JSON.stringify(command)}`);
    throw new DeclarationRefused(file, reasons);
  }
  const inputs = value.inputs ?? {};
  if (!isObject(inputs)) throw new DeclarationRefused(file, [...reasons, "inputs must be an object"]);
  switch (command) {
    case "update:upgrade": {
      reasons.push(...unknownKeys(inputs, [], "inputs of update:upgrade"));
      return { file, command, inputs: {} };
    }
    case "update:auto": {
      reasons.push(...unknownKeys(inputs, ["feedRelease"], "inputs of update:auto"));
      const feedRelease = releaseId(inputs.feedRelease, "inputs.feedRelease", reasons);
      return feedRelease === undefined ? undefined : { file, command, inputs: { feedRelease } };
    }
    case "hide:records": {
      reasons.push(...unknownKeys(inputs, ["archive", "rules"], "inputs of hide:records"));
      const archive = releaseId(inputs.archive, "inputs.archive", reasons);
      const rules = ruleSet(inputs.rules, HIDING_RULES, "inputs.rules", reasons);
      return archive === undefined || rules === undefined ? undefined : { file, command, inputs: { archive, rules } };
    }
    case "normalize:source-text": {
      reasons.push(...unknownKeys(inputs, ["rules"], "inputs of normalize:source-text"));
      const rules = ruleSet(inputs.rules, SOURCE_TEXT_UPDATE_RULES, "inputs.rules", reasons);
      return rules === undefined ? undefined : { file, command, inputs: { rules } };
    }
    case "correct:records": {
      reasons.push(...unknownKeys(inputs, [], "inputs of correct:records"));
      return { file, command, inputs: {} };
    }
  }
}

/** The declaration `text` states, or `DeclarationRefused` naming `file` and every reason it is not one. */
export function parseDeclaration(file: string, text: string): ChangeDeclaration {
  const value = jsonObject(file, text, "command, inputs and expected");
  const reasons = unknownKeys(value, ["command", "inputs", "expected"], "the declaration");
  const change = changeOf(file, value, reasons);
  const expected = counts(value.expected, reasons);
  if (reasons.length > 0 || change === undefined || expected === undefined) throw new DeclarationRefused(file, reasons);
  return { ...change, expected };
}

/** The draft `text` states: a declaration whose `expected` may be left out, refused for anything else `parseDeclaration` refuses. */
export function parseDraft(file: string, text: string): DeclarationDraft {
  const value = jsonObject(file, text, "command, inputs and expected");
  const reasons = unknownKeys(value, ["command", "inputs", "expected"], "the declaration");
  const change = changeOf(file, value, reasons);
  const expected = value.expected === undefined ? null : counts(value.expected, reasons);
  if (reasons.length > 0 || change === undefined || expected === undefined) throw new DeclarationRefused(file, reasons);
  return { ...change, expected };
}

/**
 * The change `text` asks a plan-only run for: a declaration's command and
 * inputs without expected counts, since the run is what finds them. `where`
 * names where the text came from in a refusal.
 */
export function parseChange(where: string, text: string): DeclaredChange {
  const value = jsonObject(where, text, "command and inputs");
  const reasons = unknownKeys(value, ["command", "inputs"], "the change");
  const change = changeOf(where, value, reasons);
  if (reasons.length > 0 || change === undefined) throw new DeclarationRefused(where, reasons);
  return change;
}

/** Read and parse the declaration at `path`; refuses a file that is not `*.json`. */
export async function readDeclaration(path: string): Promise<ChangeDeclaration> {
  if (!basename(path).endsWith(".json")) throw new DeclarationRefused(path, ["a change declaration is a .json file"]);
  return parseDeclaration(path, await readFile(path, "utf8"));
}

/** A plan's counts held against a declaration. */
export interface PlanCheck {
  /** Each count the plan and the declaration disagree on. */
  readonly differences: readonly CountDifference[];
  /** Each hard limit the plan crosses. */
  readonly breaches: readonly string[];
}

/** Whether a check lets the change be written: no count differs and no hard limit is crossed. */
export const passes = (check: PlanCheck): boolean => check.differences.length === 0 && check.breaches.length === 0;

/** What a plan-only run of one command returns: its counts, and the size of the dictionary it read. */
export interface PlanOnlyRun {
  readonly command: DeclaredCommand;
  readonly counts: PlanCounts;
  /** Records the dictionary holds, served or not: what the 5% limit is a share of. */
  readonly dictionaryRecords: number;
}

/** Hold a plan-only run of `declaration`'s command against it. Throws when the run is of another command. */
export function checkPlan(declaration: ChangeDeclaration, run: PlanOnlyRun): PlanCheck {
  if (run.command !== declaration.command) {
    throw new Error(`${declaration.file} declares ${declaration.command}, but the plan is of ${run.command}`);
  }
  return { differences: run.counts.differencesFrom(declaration.expected), breaches: run.counts.limitBreaches(run.dictionaryRecords) };
}
