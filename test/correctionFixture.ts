// The committed curated corrections of records (#420, #483), keyed to a
// fixture instead of the release: a fixture holds an archive line at a line
// number of its own, so each entry is moved to the fixture line whose digest is
// the one it names. The digest is kept, so an entry reaches a fixture line only
// when its bytes are the archive line's.
//
// fixtures/curated-corrections.jsonl is 50 whole lines of it-0c432803, byte
// for byte. Its first 42 are in archive order: 2029 `congiuntivo`, 17564
// `fiaschetteria`, 34427 and 34428 `curdo`, 41342 `mossa`, 51562 `maniaco`,
// 53929 `scolara`, 53931 `scolare`, 90585 `ricoverato`, 90588 `ricoverati`,
// 97083 `fissazioni`, 97950 `nozioni`, 129049 `anfitrione`, 138314
// `fissazione`, 139721 and 139722 `scontento`, 244674 `rimbalzo`, 244676
// `rimbalzi`, 419106 `sudafricano`, 421035 `romantico`, 423567 `giocatrici`,
// 423570 `giocatrice`, 432905 `fiaschetterie`, 439466 `portatrice`, 439467
// `portatrici`, 447524 `mosse`, 447845 `predatrici`, 447847 `predatrice`,
// 449250 `sudafricana`, 449504 `costruttrice`, 449506 `costruttrici`, 449965
// `ammaliatore`, 449969 `ammaliatrice`, 453220 `congiuntivi`, 462691
// `nozione`, 584883 `amorevolezze`, 595081 `maniaci`, 596016 `curde`, 599446
// `anfitrioni`, 605508 `romantica`, 605544 `scontente`, 608715 `amorevolezza`,
// all noun records. The last 8, added for rule `it-plural-gloss-number/v1`
// (#483) after them so no earlier line moves, are in archive order too: 10075
// `curve` and 56896 `competitive` (adj), 89313 `guerriglieri`, 140218
// `guerrigliero`, 175500 `mimo`, 175503 `mima`, 447644 `agostiniano` and
// 447650 `agostiniani` (noun).

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { CURATED_CORRECTIONS, recordCorrections, type LineCorrection, type RecordCorrection } from "../src/italian/curatedCorrections.js";

export const CORRECTION_FIXTURE = new URL("../fixtures/curated-corrections.jsonl", import.meta.url);

/** The fixture's lines, each without its newline. */
export async function correctionFixtureLines(): Promise<string[]> {
  return (await readFile(CORRECTION_FIXTURE, "utf8")).trimEnd().split("\n");
}

const sha256 = (line: string): string => createHash("sha256").update(line, "utf8").digest("hex");

/** The archive lines of the rule's corrections (#483) the fixture holds: `curve`, `competitive`, `guerriglieri`, `mima`, `agostiniani`. */
export const FIXTURE_RULE_LINES: readonly number[] = [10075, 56896, 89313, 175503, 447650];

/**
 * The list's record entries the fixture holds, in list order: every hand
 * entry, then the rule's at `FIXTURE_RULE_LINES`. Throws when one of those
 * lines is not a rule correction, so the list and the fixture cannot drift
 * apart unseen.
 */
export function fixtureCorrections(): RecordCorrection[] {
  const records = recordCorrections(CURATED_CORRECTIONS);
  const made = records.filter((correction) => "rule" in correction);
  for (const lineNo of FIXTURE_RULE_LINES) {
    if (!made.some((correction) => correction.record.lineNo === lineNo)) throw new Error(`the rule corrects no record at archive line ${lineNo}`);
  }
  return records.filter((correction) => !("rule" in correction) || FIXTURE_RULE_LINES.includes(correction.record.lineNo));
}

/**
 * `corrections` keyed to `releaseId` at the line of `lines` with the digest
 * each names. Throws on an entry no line carries, so a fixture that drifts
 * from the list fails by name.
 */
export function atFixtureLines(lines: readonly string[], releaseId: string): RecordCorrection[];
export function atFixtureLines<Correction extends LineCorrection>(lines: readonly string[], releaseId: string, corrections: readonly Correction[]): Correction[];
export function atFixtureLines(lines: readonly string[], releaseId: string, corrections: readonly LineCorrection[] = fixtureCorrections()): LineCorrection[] {
  const lineOf = new Map(lines.map((line, i) => [sha256(line), i + 1]));
  return corrections.map((correction) => {
    const lineNo = lineOf.get(correction.record.lineSha256);
    if (lineNo === undefined) throw new Error(`no fixture line is ${correction.record.word} at archive line ${correction.record.lineNo}`);
    return { ...correction, record: { ...correction.record, releaseId, lineNo } };
  });
}
