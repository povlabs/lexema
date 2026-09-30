// Which of a reading's senses and recovered definitions are its definitions,
// in order, each with its examples. The page renders them (Reading.tsx) and the
// API returns them (web/worker/api/lookupAnswer.ts), so both read one list.

import { everyRecovered } from "@lexema/lookup/types.ts";
import type { Reading, RecoveredDefinition, Sense } from "@lexema/lookup/types.ts";

/**
 * Two source glosses for `casa` are page furniture, not definitions (#28, #61).
 * A sense that opens a list of recovered items is a definition whatever its
 * gloss starts with.
 */
function isEntryFurniture(sense: Sense, word: string): boolean {
  return (
    sense.glosses.length > 0 &&
    sense.recoveredItems.length === 0 &&
    sense.glosses.every(({ text }) => text === `${word} ( citazioni)` || text.startsWith(`${word} ( approfondimento)`))
  );
}

/** One numbered definition: a sense of the record, or one read back from the raw page. */
export type DefinitionItem =
  | { from: "record"; sense: Sense; examples: string[] }
  | { from: "page"; definition: RecoveredDefinition; examples: string[] };

/**
 * The reading's definitions in order, each with its examples, and the examples
 * of the senses that are not shown as definitions — furniture, and a sense with
 * no gloss — which stay reachable behind the reading's control. The page adds
 * no note about either. An example the record holds that is really a
 * recovered definition is shown once, as that definition.
 */
export function definitionsOf(reading: Reading): { items: DefinitionItem[]; looseExamples: string[] } {
  const heldAsDefinition = new Set(
    everyRecovered(reading).flatMap((definition) => definition.heldAsExample?.jsonPointer ?? []),
  );
  // Furniture is left out only when the reading has real definitions to show
  // instead; a reading with nothing else shows it verbatim rather than nothing.
  const furniture = (sense: Sense) => isEntryFurniture(sense, reading.word);
  const hasOwn = reading.recovered.length > 0 || reading.senses.some((sense) => !furniture(sense));
  const glossless = (sense: Sense) => sense.glosses.length === 0 && sense.recoveredItems.length === 0;
  const examplesOf = (sense: Sense): string[] =>
    sense.examples.filter((example) => !heldAsDefinition.has(example.ref.jsonPointer)).map((example) => example.text);
  const items: DefinitionItem[] = [
    ...reading.senses
      .filter((sense) => !glossless(sense) && (!hasOwn || !furniture(sense)))
      .map(
        (sense): DefinitionItem => ({
          from: "record",
          sense,
          examples: examplesOf(sense),
        }),
      ),
    ...reading.recovered.map(
      (definition): DefinitionItem => ({
        from: "page",
        definition,
        examples: definition.examples.map((example) => example.text),
      }),
    ),
  ];
  const looseExamples = reading.senses
    .filter((sense) => glossless(sense) || (hasOwn && furniture(sense)))
    .flatMap(examplesOf);
  return { items, looseExamples };
}

/**
 * Whether the reading has a definition to show. The one rule for it: a reading
 * without one gets no number (wordPage.ts), so whatever `definitionsOf` stops
 * counting as a definition changes the numbering too.
 */
export function hasDefinitions(reading: Reading): boolean {
  return definitionsOf(reading).items.length > 0;
}

/** The labels the source put on a sense — `figurato`, `scuola` — as a definition shows them. */
export function senseLabels(labels: readonly string[]): string[] {
  return labels.filter((label) => label !== "form-of");
}
