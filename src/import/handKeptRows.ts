// The `hand_kept_definition` rows of the committed hand-kept readings (ADR
// 0031, #745): one row per definition, in `COLUMNS` order
// (src/import/seedSql.ts). The seed writes them for every reading on the list,
// whatever the archive holds, and `correct:records` writes them into a master
// seeded before them (src/import/correctRecords.ts). Nothing here reads or
// writes a source row.

import { evidenceUrl } from "../italian/curatedCorrections.js";
import { handKeptId, sectionEvidence, type HandKeptReading } from "../italian/handKeptReadings.js";
import { normalizeItalianExact } from "../italian/normalize.js";

/** A reading's rows, one per definition, in definition order. */
export function handKeptRows(reading: HandKeptReading): unknown[][] {
  const evidence = sectionEvidence(reading);
  return reading.definitions.map((definition, index) => [
    handKeptId(reading),
    index,
    reading.word,
    normalizeItalianExact(reading.word),
    reading.partOfSpeech.pos,
    reading.partOfSpeech.posTitle,
    definition.text,
    definition.paraphrases.line,
    definition.paraphrases.wikitext,
    reading.section.line,
    reading.section.wikitext,
    evidenceUrl(evidence),
    evidence.timestamp,
  ]);
}
