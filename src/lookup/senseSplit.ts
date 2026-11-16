// Which of a reading's senses are numbered as its definitions, by the page's
// one rule (`splitSenses`, src/italian/furniture.ts). The page and the API
// list a reading's definitions through it (web/lib/dictionary/definitions.ts),
// and translation placement (src/lookup/translationPlacement.ts, #928) counts
// a definition's index through it, so the two never disagree about where a
// definition sits.

import { splitSenses, type SenseShape, type SenseSplit } from "../italian/furniture.js";
import type { RecoveredDefinition, Sense } from "./types.js";

/**
 * Two source glosses for `casa` are page furniture, not definitions (#28, #61).
 * A sense that opens a list of recovered items is a definition whatever its
 * gloss starts with.
 */
export const senseShape = (sense: Sense): SenseShape => ({
  glosses: sense.glosses.map(({ text }) => text),
  opensRecoveredList: sense.recoveredItems.length > 0,
});

/**
 * A reading's senses, split by the page's rule. The numbered ones are the
 * first entries of the reading's definitions, in order; its recovered
 * definitions follow them.
 */
export function splitReadingSenses(reading: {
  word: string;
  senses: readonly Sense[];
  recovered: readonly RecoveredDefinition[];
}): SenseSplit<Sense> {
  return splitSenses(reading.senses, reading.word, reading.recovered.length, senseShape);
}
