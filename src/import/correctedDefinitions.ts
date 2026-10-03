// Writes the curated definition corrections (#450) beside the page-only
// entries a seed recovers (ADR 0024).
//
// Each definition entry of the committed list (src/italian/curatedCorrections.ts)
// names one page by title and dump revision, and the definition it replaces by
// its place, page line and text. When the seed recovers an entry of that title
// from that revision, with that definition at that place, the entry gets one
// `corrected_definition` row naming the list entry and the revision it cites.
// An entry read from another revision, or a title the seed recovers no entry
// for, gets none and is reported: the list was checked against that revision
// and no other. The entry's own rows, `entry_definition` least of all, are
// written by the seed and are not touched here.

import {
  correctionId,
  definitionCorrections,
  definitionMismatch,
  evidenceUrl,
  type CuratedCorrection,
  type DefinitionCorrection,
  type DefinitionMismatch,
  type PageEntryDefinitions,
} from "../italian/curatedCorrections.js";
import type { ImportStatement } from "./importRelease.js";

/** One `corrected_definition` row's values after its entry id and definition index, in `COLUMNS` order. */
export const correctedDefinitionValues = (correction: DefinitionCorrection): [text: string, correctionId: string, evidenceUrl: string] =>
  [correction.text, correctionId(correction), evidenceUrl(correction.evidence[0])];

/** Whether `correction` is keyed to an entry of this title and part of speech; `definitionMismatch` then says if it reaches it. */
export const correctsEntry = (correction: DefinitionCorrection, entry: { title: string; pos: string }): boolean =>
  correction.entry.title === entry.title && correction.entry.pos === entry.pos;

/** Why a definition correction was not written. */
export type UnwrittenDefinition = "no-entry" | DefinitionMismatch;

/** What one seed did with the list's definition corrections: the count reported after every run. */
export interface DefinitionCorrectionSummary {
  /** Definition corrections on the list. */
  listed: number;
  /** Corrections written, one row each. */
  applied: number;
  /** Corrections not written, and why. */
  unapplied: { id: string; reason: UnwrittenDefinition }[];
}

export class CorrectedDefinitionLayer {
  private readonly corrections: DefinitionCorrection[];
  private readonly outcomes = new Map<string, "applied" | DefinitionMismatch>();

  constructor(
    corrections: readonly CuratedCorrection[],
    private readonly insert: ImportStatement,
    private readonly rows: { corrected_definition: number },
  ) {
    this.corrections = definitionCorrections(corrections);
  }

  /**
   * Write the corrections of the entry's title and part of speech that reach
   * it. A page may give several entries (ADR 0028); a correction one of them
   * took stays applied whatever the others say.
   */
  add(entry: PageEntryDefinitions & { entryId: number; title: string; pos: string }): void {
    for (const correction of this.corrections) {
      if (!correctsEntry(correction, entry)) continue;
      const id = correctionId(correction);
      const mismatch = definitionMismatch(correction, entry);
      if (this.outcomes.get(id) !== "applied") this.outcomes.set(id, mismatch ?? "applied");
      if (mismatch !== undefined) continue;
      this.insert.run(entry.entryId, correction.replaces.index, ...correctedDefinitionValues(correction));
      this.rows.corrected_definition += 1;
    }
  }

  get summary(): DefinitionCorrectionSummary {
    const ids = this.corrections.map(correctionId);
    return {
      listed: ids.length,
      applied: ids.filter((id) => this.outcomes.get(id) === "applied").length,
      unapplied: ids.flatMap((id) => {
        const outcome = this.outcomes.get(id);
        return outcome === "applied" ? [] : [{ id, reason: outcome ?? "no-entry" }];
      }),
    };
  }
}
