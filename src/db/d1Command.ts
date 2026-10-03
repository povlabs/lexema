// One SQL text sent to D1 through `wrangler d1 execute --command=<sql>`
// (#507, #513). Every read and every small write the tools make goes through
// `D1Command`, so no call site builds the `--command` argument itself.

import { overlongPatterns } from "./d1PatternLimit.js";

/** `wrangler d1 execute` aimed at one database, its target arguments already given. */
export interface D1Executor {
  execute(args: readonly string[], capture: boolean): string;
}

/**
 * `--command` and its SQL as the one argument Wrangler parses whole. As two
 * arguments, Wrangler's yargs-parser takes the next one as the option's value
 * only when it does not start with `-`, so SQL that opens with a `--` comment
 * is read as an unknown flag and nothing is sent (wrangler 4.135.0, #507).
 * Joined by `=`, the parser splits at the first `=` and keeps the rest,
 * newlines and later `=` included.
 */
export const commandArgument = (sql: string): string => `--command=${sql}`;

/** SQL D1 would refuse before running it. */
export class D1SqlRefused extends Error {}

/**
 * Why D1 would refuse `sql` for its 50-byte LIKE and GLOB limit
 * (src/db/d1PatternLimit.ts), naming each pattern and its size, or
 * `undefined` when every pattern is within it.
 */
export function patternLimitRefusal(sql: string): string | undefined {
  const overlong = overlongPatterns(sql);
  if (overlong.length === 0) return undefined;
  return (
    `D1 refuses a LIKE or GLOB pattern over 50 bytes, and this SQL holds ${overlong.length}: ` +
    overlong.map(({ operator, pattern, bytes }) => `${operator} '${pattern}' (${bytes} bytes)`).join(", ")
  );
}

/** SQL D1 can run: every LIKE and GLOB pattern in it within D1's limit. */
export class D1Command {
  private constructor(readonly sql: string) {}

  /** `sql` as a command, or `D1SqlRefused` naming every pattern D1 would refuse. */
  static of(sql: string): D1Command {
    const refusal = patternLimitRefusal(sql);
    if (refusal !== undefined) throw new D1SqlRefused(refusal);
    return new D1Command(sql);
  }

  /** Run it on `target` and answer each statement's rows, in statement order. */
  read<Row>(target: D1Executor): Row[][] {
    const answers = JSON.parse(target.execute(["--json", commandArgument(this.sql)], true)) as { results: Row[] }[];
    return answers.map(({ results }) => results);
  }

  /** Run it on `target` for its effect; Wrangler's answer is read by no one. */
  write(target: D1Executor): void {
    target.execute([commandArgument(this.sql)], true);
  }
}

/** Each statement's rows of `sql` on `target`; see `D1Command.read`. */
export const readD1 = <Row>(target: D1Executor, sql: string): Row[][] => D1Command.of(sql).read<Row>(target);

/** Run `sql` on `target` for its effect; see `D1Command.write`. */
export const writeD1 = (target: D1Executor, sql: string): void => D1Command.of(sql).write(target);
