// What the hand-run CLIs share (`pnpm run api-key`, `pnpm run plan`): a
// command's printed answer and exit status, and reading its `--flag value` pairs.

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** What a command printed, and the exit status it ends with. */
export interface CommandResult {
  out: string;
  status: 0 | 1;
}

/** A refusal: the problem, then the command's usage line, exiting 1. */
export const usageError = (problem: string, usage: string): CommandResult => ({ out: `${problem}\n${usage}`, status: 1 });

/** A whole number above zero, or undefined. */
export const positive = (text: string | undefined): number | undefined =>
  text !== undefined && /^[1-9]\d*$/.test(text) ? Number(text) : undefined;

/** The value after each `--flag`, for the flags named, or what is wrong with the arguments. */
export function flags(args: readonly string[], names: readonly string[]): Map<string, string> | string {
  const values = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i].replace(/^--/, "");
    if (!args[i].startsWith("--") || !names.includes(name)) return `unknown argument ${args[i]}`;
    if (args[i + 1] === undefined) return `--${name} needs a value`;
    values.set(name, args[i + 1]);
  }
  return values;
}

/** Whether the module at `url` is the script Node was started with. */
export const isMain = (url: string): boolean =>
  process.argv[1] !== undefined && url === pathToFileURL(resolve(process.argv[1])).href;

/** Print a command's answer on stdout, or stderr when it failed, and end with its status. */
export function finish({ out, status }: CommandResult): void {
  (status === 0 ? process.stdout : process.stderr).write(`${out}\n`);
  process.exitCode = status;
}
