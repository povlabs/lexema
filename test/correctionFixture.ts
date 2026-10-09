// The committed curated corrections of records (#420, #483), keyed to a
// fixture instead of the release by `FixtureLines`
// (src/italian/correctionsAtLines.ts), the keying the dev seed uses too.
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

import { readFile } from "node:fs/promises";
import { FixtureLines, type RecordKeyedCorrection } from "../src/italian/correctionsAtLines.js";
import {
  CURATED_CORRECTIONS,
  edgeCorrections,
  recordCorrections,
  senseEdgeCorrections,
  type EdgeCorrection,
  type RecordCorrection,
  type SenseEdgeCorrection,
} from "../src/italian/curatedCorrections.js";

export const CORRECTION_FIXTURE = new URL("../fixtures/curated-corrections.jsonl", import.meta.url);

/** The fixture's lines, each without its newline. */
export async function correctionFixtureLines(): Promise<string[]> {
  return (await readFile(CORRECTION_FIXTURE, "utf8")).trimEnd().split("\n");
}

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
export function atFixtureLines<Correction extends RecordKeyedCorrection = RecordCorrection>(
  lines: readonly string[],
  releaseId: string,
  corrections: readonly Correction[] = fixtureCorrections() as Correction[],
): Correction[] {
  const { held, leftOut } = FixtureLines.of(lines, releaseId).key(corrections);
  const [missing] = leftOut;
  if (missing !== undefined) throw new Error(`no fixture line is ${missing.record.word} at archive line ${missing.record.lineNo}`);
  return held;
}

/**
 * The committed list's edge corrections (#722) of the records `lines` holds,
 * keyed to `releaseId` at their fixture lines: every edge the list sets on a
 * line the fixture carries byte for byte, and no other.
 */
export function edgeCorrectionsAt(lines: readonly string[], releaseId: string): EdgeCorrection[] {
  return FixtureLines.of(lines, releaseId).key(edgeCorrections(CURATED_CORRECTIONS)).held;
}

/**
 * The committed list's corrections of a sense's edge, set or removed (#722,
 * #755), of the records `lines` holds, keyed to `releaseId` at their fixture
 * lines, in list order.
 */
export function senseEdgeCorrectionsAt(lines: readonly string[], releaseId: string): SenseEdgeCorrection[] {
  return FixtureLines.of(lines, releaseId).key(senseEdgeCorrections(CURATED_CORRECTIONS)).held;
}
