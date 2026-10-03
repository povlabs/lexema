// The committed curated corrections (#420), keyed to a fixture instead of the
// release: a fixture holds an archive line at a line number of its own, so each
// entry is moved to the fixture line whose digest is the one it names. The
// digest is kept, so an entry reaches a fixture line only when its bytes are
// the archive line's.
//
// fixtures/curated-corrections.jsonl is 26 whole lines of it-0c432803, byte
// for byte, in archive order: 2029 `congiuntivo`, 17564 `fiaschetteria`, 51562
// `maniaco`, 97083 `fissazioni`, 97950 `nozioni`, 138314 `fissazione`, 244674
// `rimbalzo`, 244676 `rimbalzi`, 419106 `sudafricano`, 421035 `romantico`,
// 423567 `giocatrici`, 423570 `giocatrice`, 432905 `fiaschetterie`, 447845
// `predatrici`, 447847 `predatrice`, 449250 `sudafricana`, 449504
// `costruttrice`, 449506 `costruttrici`, 449965 `ammaliatore`, 449969
// `ammaliatrice`, 453220 `congiuntivi`, 462691 `nozione`, 584883
// `amorevolezze`, 595081 `maniaci`, 605508 `romantica`, 608715 `amorevolezza`.
// All are noun records.

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { CURATED_CORRECTIONS, type CuratedCorrection } from "../src/italian/curatedCorrections.js";

export const CORRECTION_FIXTURE = new URL("../fixtures/curated-corrections.jsonl", import.meta.url);

/** The fixture's lines, each without its newline. */
export async function correctionFixtureLines(): Promise<string[]> {
  return (await readFile(CORRECTION_FIXTURE, "utf8")).trimEnd().split("\n");
}

const sha256 = (line: string): string => createHash("sha256").update(line, "utf8").digest("hex");

/**
 * `corrections` keyed to `releaseId` at the line of `lines` with the digest
 * each names. Throws on an entry no line carries, so a fixture that drifts
 * from the list fails by name.
 */
export function atFixtureLines(lines: readonly string[], releaseId: string, corrections: readonly CuratedCorrection[] = CURATED_CORRECTIONS): CuratedCorrection[] {
  const lineOf = new Map(lines.map((line, i) => [sha256(line), i + 1]));
  return corrections.map((correction) => {
    const lineNo = lineOf.get(correction.record.lineSha256);
    if (lineNo === undefined) throw new Error(`no fixture line is ${correction.record.word} at archive line ${correction.record.lineNo}`);
    return { ...correction, record: { ...correction.record, releaseId, lineNo } };
  });
}
