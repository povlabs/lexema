// The curated corrections keyed to a fixture instead of the release they name
// (#742). A fixture holds an archive line at a line number of its own, so each
// entry keyed to a record is moved to the fixture line whose digest is the one
// it names, and keyed to the fixture's release. The digest is kept, so an
// entry reaches a fixture line only when its bytes are the archive line's.
// The dev seed (src/import/seedDev.ts) and the tests both key through here.

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isDefinitionCorrection, type CuratedCorrection, type LineCorrection, type SenseEdgeCorrection } from "./curatedCorrections.js";

/** An entry keyed to one record's line: its gender or number, cells of its table, or a sense's edge set or removed. */
export type RecordKeyedCorrection = LineCorrection | SenseEdgeCorrection;

/** The list keyed to a fixture: what it holds, and the record entries whose line it does not. */
export interface KeyedToFixture<Correction extends CuratedCorrection> {
  /** Each record entry a line holds, keyed there, and each definition entry as it is, in list order. */
  held: Correction[];
  /** The record entries no fixture line carries byte for byte, as listed. */
  leftOut: Correction[];
}

const sha256 = (line: string): string => createHash("sha256").update(line, "utf8").digest("hex");

/** A fixture's lines by their digests, under the release id the fixture is seeded as. */
export class FixtureLines {
  private constructor(
    readonly releaseId: string,
    private readonly lineOf: ReadonlyMap<string, number>,
  ) {}

  /** `lines` are the fixture's lines in order, each without its newline. */
  static of(lines: readonly string[], releaseId: string): FixtureLines {
    return new FixtureLines(releaseId, new Map(lines.map((line, i) => [sha256(line), i + 1])));
  }

  /** The JSON Lines file at `path`, seeded as `releaseId`. */
  static async read(path: string | URL, releaseId: string): Promise<FixtureLines> {
    const text = await readFile(path, "utf8");
    const lines = text.split("\n");
    if (lines.at(-1) === "") lines.pop();
    return FixtureLines.of(lines, releaseId);
  }

  /** `correction` keyed to this fixture at the line with its digest, or `undefined` when no line holds those bytes. */
  place<Correction extends RecordKeyedCorrection>(correction: Correction): Correction | undefined {
    const lineNo = this.lineOf.get(correction.record.lineSha256);
    return lineNo === undefined ? undefined : { ...correction, record: { ...correction.record, releaseId: this.releaseId, lineNo } };
  }

  /**
   * `corrections` keyed to this fixture. A definition entry is matched by its
   * page revision, not by a line, so it is held as it is.
   */
  key<Correction extends CuratedCorrection>(corrections: readonly Correction[]): KeyedToFixture<Correction> {
    const keyed: KeyedToFixture<Correction> = { held: [], leftOut: [] };
    for (const correction of corrections) {
      if (isDefinitionCorrection(correction)) {
        keyed.held.push(correction);
        continue;
      }
      const placed = this.place(correction as Correction & RecordKeyedCorrection);
      if (placed === undefined) keyed.leftOut.push(correction);
      else keyed.held.push(placed);
    }
    return keyed;
  }
}
