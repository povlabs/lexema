// One SQL batch the dictionary deploy sends to D1 (#507), and the route it
// takes there.
//
// A batch of at most `QUERY_API_LIMIT` bytes goes through D1's query API,
// `wrangler d1 execute --command=<sql>`. Wrangler posts the whole text to
// `/d1/database/{id}/query` in one request (wrangler 4.135.0, `executeRemotely`
// in wrangler-dist/cli.js). That endpoint runs "multiple statements, joined by
// semicolons ... as a batch"
// (https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/),
// and "Batched statements are SQL transactions. If a statement in the sequence
// fails, then an error is returned for that specific statement, and it aborts
// or rolls back the entire sequence"
// (https://developers.cloudflare.com/d1/worker-api/d1-database/). So a batch
// lands whole or not at all, as an import does.
//
// A larger batch keeps the import, `--file`. D1 limits each statement to
// 100,000 bytes (https://developers.cloudflare.com/d1/platform/limits/), so a
// batch under that size holds no statement D1 would refuse for length, and it
// stays under Linux's 128 KiB limit on one command-line argument.
//
// Either way the batch is first held to D1's 50-byte LIKE and GLOB limit
// (src/db/d1PatternLimit.ts), so a pattern D1 would refuse stops the run
// before anything is sent.

import { writeFile } from "node:fs/promises";
import { overlongPatterns } from "../db/d1PatternLimit.js";

/** The largest batch, in UTF-8 bytes, sent through the query API rather than imported. */
export const QUERY_API_LIMIT = 100_000;

/** `wrangler d1 execute` aimed at the dictionary, as `DeployTarget` gives it. */
export interface D1Executor {
  execute(args: readonly string[], capture: boolean): string;
}

/**
 * `--command` and its SQL as the one argument Wrangler parses whole. As two
 * arguments, Wrangler's yargs-parser takes the next one as the option's value
 * only when it does not start with `-`, so SQL that opens with a `--` comment,
 * as every deploy batch does, is read as an unknown flag and nothing is sent
 * (wrangler 4.135.0, #507). Joined by `=`, the parser splits at the first `=`
 * and keeps the rest, newlines and later `=` included.
 */
export const commandArgument = (sql: string): string => `--command=${sql}`;

/** A batch D1 would refuse before running it. */
export class D1BatchRefused extends Error {}

/** SQL D1 can run as one transaction: every LIKE and GLOB pattern in it within D1's limit. */
export class D1Batch {
  private constructor(
    readonly sql: string,
    readonly bytes: number,
  ) {}

  /** `sql` as a batch, or `D1BatchRefused` naming every pattern D1 would refuse. */
  static of(sql: string): D1Batch {
    const overlong = overlongPatterns(sql);
    if (overlong.length > 0) {
      throw new D1BatchRefused(
        `D1 refuses a LIKE or GLOB pattern over 50 bytes, and this SQL holds ${overlong.length}: ` +
          overlong.map(({ operator, pattern, bytes }) => `${operator} '${pattern}' (${bytes} bytes)`).join(", "),
      );
    }
    return new D1Batch(sql, Buffer.byteLength(sql, "utf8"));
  }

  /** How the batch reaches D1: the query API when small enough, else an import. */
  get route(): "command" | "file" {
    return this.bytes <= QUERY_API_LIMIT ? "command" : "file";
  }

  /**
   * Run the batch on `target`. An import first writes it to `file`. It returns
   * only once D1 answered without error; any failure throws, and D1 kept the
   * dictionary as it was.
   */
  async run(target: D1Executor, file: string): Promise<void> {
    if (this.route === "command") {
      target.execute([commandArgument(this.sql)], false);
      return;
    }
    await writeFile(file, this.sql);
    target.execute(["--file", file], false);
  }
}
