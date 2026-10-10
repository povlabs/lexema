// Which of a reading's senses and recovered definitions are its definitions,
// in order, each with its examples. The page renders them (Reading.tsx) and the
// API returns them (web/worker/api/lookupAnswer.ts), so both read one list.

import { splitSenses, type SenseShape } from "@lexema/italian/furniture.ts";
import { italianSenseLabels } from "@lexema/italian/senseTagLabels.ts";
import { everyRecovered, isSourceRef } from "@lexema/lookup/types.ts";
import type { FactRef, Reading, RecoveredDefinition, Sense } from "@lexema/lookup/types.ts";

/**
 * Two source glosses for `casa` are page furniture, not definitions (#28, #61).
 * A sense that opens a list of recovered items is a definition whatever its
 * gloss starts with. The rule is `splitSenses`, which the quality measurement
 * reads too.
 */
const shapeOf = (sense: Sense): SenseShape => ({
  glosses: sense.glosses.map(({ text }) => text),
  opensRecoveredList: sense.recoveredItems.length > 0,
});

/** One numbered definition: a sense of the record, or one read back from the raw page. */
export type DefinitionItem =
  | { from: "record"; sense: Sense; examples: string[] }
  | { from: "page"; definition: RecoveredDefinition; examples: string[] };

/**
 * Where a definition sits: a sense of the record, by its index, or a line of
 * the raw page a page-only entry was read from (ADR 0026).
 */
export type DefinitionPlace = { sense: number } | { line: number };

/** Where `item` sits. */
export const placeOf = (item: DefinitionItem): DefinitionPlace =>
  item.from === "record" ? { sense: item.sense.index } : { line: item.definition.ref.line };

/** Whether a fact was read off the definition at `place`. */
export const readAt = (ref: FactRef, place: DefinitionPlace): boolean =>
  "sense" in place
    ? isSourceRef(ref) && ref.jsonPointer.startsWith(`/senses/${place.sense}/`)
    : !isSourceRef(ref) && ref.line === place.line;

/**
 * The reading's definitions in order, each with its examples, and the examples
 * of the senses that are not shown as definitions — furniture, and a sense with
 * no gloss — which stay reachable behind the reading's control. The page adds
 * no note about either. An example the record holds that is really a
 * recovered definition is shown once, as that definition.
 */
export function definitionsOf(reading: Pick<Reading, "word" | "senses" | "recovered">): { items: DefinitionItem[]; looseExamples: string[] } {
  const heldAsDefinition = new Set(
    everyRecovered(reading).flatMap((definition) => definition.heldAsExample?.jsonPointer ?? []),
  );
  const { numbered, setAside } = splitSenses(reading.senses, reading.word, reading.recovered.length, shapeOf);
  const examplesOf = (sense: Sense): string[] =>
    sense.examples.filter((example) => !heldAsDefinition.has(example.ref.jsonPointer)).map((example) => example.text);
  const items: DefinitionItem[] = [
    ...numbered.map(
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
  const looseExamples = setAside.flatMap(examplesOf);
  return { items, looseExamples };
}

/**
 * Whether the reading has a definition to show. The share card takes its
 * meaning from the first reading that has one (card.ts).
 */
export function hasDefinitions(reading: Reading): boolean {
  return definitionsOf(reading).items.length > 0;
}

/** The labels the source put on a sense — `figurato`, `scuola` — as the developer API returns them. */
export function senseLabels(labels: readonly string[]): string[] {
  return labels.filter((label) => label !== "form-of");
}

/**
 * The labels the source put on a sense as the word page shows them: in the
 * Italian the page wrote, `antico` where the extraction stored `archaic`
 * (#799, `it-sense-tag-label/v1`).
 */
export const shownSenseLabels = (sense: Pick<Sense, "labels">): string[] => italianSenseLabels(sense.labels);

/**
 * What a definition reads as, without its examples: equal for two records'
 * definitions only when the page would draw the same text. `costruttrici`'s
 * adjective and noun records both read "plurale di costruttrice". A definition
 * with sub-items keys them with their refs, so it never equals another
 * record's.
 */
export function definitionTextKey(item: DefinitionItem): string {
  return item.from === "record"
    ? JSON.stringify(["record", senseLabels(item.sense.labels.map((label) => label.label)), item.sense.glosses.map((gloss) => gloss.text), item.sense.recoveredItems])
    : JSON.stringify(["page", item.definition.labels, item.definition.text, item.definition.items]);
}
