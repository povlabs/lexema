// Seed SQL delivered as numbered parts. `wrangler d1 execute --file` reads a
// whole file into one JavaScript string, and V8 caps a string at 0x1fffffe8
// UTF-16 code units (about 512 MiB), so a full release (about 1 GB of SQL)
// cannot go through one file. Each part stays under a byte ceiling, and since a
// UTF-8 byte count is never smaller than the string length it decodes to, the
// ceiling bounds the string Wrangler builds too.

import { open, readdir, rm, type FileHandle } from "node:fs/promises";
import { join } from "node:path";

/**
 * The default part ceiling: 128 MiB, a quarter of Node's string limit. The
 * measurements behind this number are in docs/DEV_SEED.md.
 */
export const DEFAULT_PART_CEILING_BYTES = 128 * 1024 * 1024;

const PART_NAME = /^part-\d{3,}\.sql$/;

export const partName = (index: number): string => `part-${String(index).padStart(3, "0")}.sql`;

/** Remove the parts a previous seed left in `directory`, and nothing else. */
export async function clearParts(directory: string): Promise<void> {
  let names: string[];
  try {
    names = await readdir(directory);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  await Promise.all(names.filter((name) => PART_NAME.test(name)).map((name) => rm(join(directory, name))));
}

/**
 * Writes SQL into `part-001.sql`, `part-002.sql`, ... in order. Callers hand it
 * whole units: one or more complete statements that must land in one part. A
 * unit is never split, so a part boundary never falls inside a statement.
 */
export class SqlPartWriter {
  private readonly written: string[] = [];
  private current: FileHandle | undefined;
  private used = 0;

  constructor(private readonly directory: string, readonly ceilingBytes: number = DEFAULT_PART_CEILING_BYTES) {
    if (!Number.isInteger(ceilingBytes) || ceilingBytes <= 0) {
      throw new Error(`part ceiling must be a positive whole number of bytes, got ${ceilingBytes}`);
    }
  }

  async write(unit: string | Uint8Array): Promise<void> {
    const bytes = typeof unit === "string" ? Buffer.from(unit, "utf8") : unit;
    if (bytes.byteLength > this.ceilingBytes) {
      throw new Error(`a ${bytes.byteLength}-byte SQL unit exceeds the ${this.ceilingBytes}-byte part ceiling`);
    }
    if (this.current && this.used + bytes.byteLength > this.ceilingBytes) await this.closeCurrent();
    if (!this.current) {
      const path = join(this.directory, partName(this.written.length + 1));
      this.current = await open(path, "wx");
      this.written.push(path);
    }
    await this.current.write(bytes);
    this.used += bytes.byteLength;
  }

  /** Close the last part and return every part path, in execution order. */
  async close(): Promise<readonly string[]> {
    await this.closeCurrent();
    return [...this.written];
  }

  private async closeCurrent(): Promise<void> {
    await this.current?.close();
    this.current = undefined;
    this.used = 0;
  }
}

/** A part that failed to apply, with the parts that were applied before it. */
export class PartFailure extends Error {
  constructor(
    readonly part: string,
    readonly index: number,
    readonly total: number,
    readonly applied: readonly string[],
    cause: unknown,
  ) {
    super(
      `part ${index} of ${total} failed: ${part}\n` +
        (applied.length > 0 ? `applied before it: ${applied.join(", ")}` : "no part was applied before it"),
      { cause },
    );
    this.name = "PartFailure";
  }
}

/**
 * Apply `parts` strictly in order. The first failure stops the run: no later
 * part is attempted, and the thrown PartFailure names the failed part and every
 * part that was applied.
 */
export async function applyParts(
  parts: readonly string[],
  apply: (part: string, index: number, total: number) => void | Promise<void>,
): Promise<void> {
  const applied: string[] = [];
  for (const [offset, part] of parts.entries()) {
    try {
      await apply(part, offset + 1, parts.length);
    } catch (error: unknown) {
      throw new PartFailure(part, offset + 1, parts.length, applied, error);
    }
    applied.push(part);
  }
}
