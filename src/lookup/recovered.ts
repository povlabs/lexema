// Where a reading shows its recovered definitions (#28, #370).
//
// A recovered definition stays on the record it was recovered for. When a
// change from a later release replaces that record, the lookup still reads the
// definition for the record that replaced it (src/lookup/served.ts). The seed
// checked it against the old record only, so here it is checked again against
// the record served now, by the seed's own rule (`carries`). A definition a
// curated correction hides (#773) is read, so the items listed under it are
// still placed, and never shown.

import { carries, type RecordGloss } from "../italian/recovery.js";
import type { RecoveredDefinition } from "./types.js";

/** A record's recovered definitions, placed where the page lists them. */
export interface RecoveredOfRecord {
  /** At the top of the section's list, after the record's senses. */
  topLevel: RecoveredDefinition[];
  /** Items of the list a sense the record carries opens, by sense index. */
  underSense: Map<number, RecoveredDefinition[]>;
}

/** A lead-in recovered before an item, for the same record, by its id. */
interface RecoveredLeadIn {
  in: "recovered";
  id: number;
}

/**
 * One stored recovered definition, in page order, and the lead-in it names.
 * A lead-in sense is an index into the record the definition was written for,
 * so only a definition written for the served record keeps the index. One
 * written for a record the served one replaced keeps that sense's glosses
 * instead: the served record may hold its senses in another order or count.
 */
export type StoredRecovered = {
  id: number;
  definition: RecoveredDefinition;
  /** A curated correction hides it (`hidden_recovered_definition`): it states no dictionary word. */
  hidden: boolean;
} & (
  | {
      writtenFor: "served";
      leadIn: { in: "sense"; senseIndex: number } | RecoveredLeadIn | null;
    }
  | {
      writtenFor: "replaced";
      leadIn: { in: "sense"; glosses: readonly string[] } | RecoveredLeadIn | null;
    }
);

/**
 * Place a record's recovered definitions against the glosses of the record
 * served now.
 *
 * A definition written for the served record is placed as it was stored: the
 * seed already checked it against this record. One written for a record the
 * served one replaced is dropped when a served gloss carries its text, since
 * the record now shows it as a sense. Its lead-in sense is found by text: it
 * goes under the one served sense with a gloss that carries a gloss of the old
 * sense, and at the top of the list when no sense or more than one does. An
 * item whose recovered lead-in was dropped is found the same way, by that
 * lead-in's text. A hidden definition is dropped like one a served gloss
 * carries.
 */
export function placeRecovered(rows: readonly StoredRecovered[], served: readonly RecordGloss[]): RecoveredOfRecord {
  const placed: RecoveredOfRecord = { topLevel: [], underSense: new Map() };
  const at = (senseIndex: number | null, definition: RecoveredDefinition): void => {
    if (senseIndex === null) {
      placed.topLevel.push(definition);
      return;
    }
    const items = placed.underSense.get(senseIndex) ?? [];
    items.push(definition);
    placed.underSense.set(senseIndex, items);
  };
  /** The one served sense whose glosses carry one of `texts`, if just one does. */
  const senseCarrying = (texts: readonly string[]): number | null => {
    const senses = new Set(
      served.filter((gloss) => texts.some((text) => carries(gloss.text, text))).map((gloss) => gloss.senseIndex),
    );
    return senses.size === 1 ? [...senses][0] : null;
  };

  // Rows come in page order and a lead-in's id is below its items', so every
  // recovered lead-in is read, kept or dropped, before its first item.
  const kept = new Map<number, RecoveredDefinition>();
  const dropped = new Map<number, string>();
  for (const row of rows) {
    const { definition, leadIn } = row;
    if (row.hidden || (row.writtenFor === "replaced" && served.some((gloss) => carries(gloss.text, definition.text)))) {
      dropped.set(row.id, definition.text);
      continue;
    }
    kept.set(row.id, definition);
    if (leadIn === null) at(null, definition);
    else if (leadIn.in === "recovered") {
      const parent = kept.get(leadIn.id);
      if (parent !== undefined) parent.items.push(definition);
      else {
        const text = dropped.get(leadIn.id);
        if (text === undefined) throw new Error(`recovered ${row.id} names lead-in ${leadIn.id}, not read before it`);
        at(senseCarrying([text]), definition);
      }
    } else if ("senseIndex" in leadIn) at(leadIn.senseIndex, definition);
    else at(senseCarrying(leadIn.glosses), definition);
  }
  return placed;
}
