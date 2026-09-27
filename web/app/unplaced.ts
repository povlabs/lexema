// Forms that take no cell, grouped by what the source leaves out of them
// (design-system-manifest.md § "Forms: three shapes": forms the source leaves
// unplaced go in one last group named for what is missing, never scattered).

import type { SourceForm } from "@lexema/lookup/types.ts";

/** What a form lacks that a cell needs, in words: `person not given`. */
export type Missing =
  | "gender and number not given"
  | "gender not given"
  | "number not given"
  | "person not given"
  | "mood and tense not given"
  | "comparison not in the grid";

export interface UnplacedGroup {
  missing: Missing;
  /** Verbatim and in source order. */
  forms: SourceForm[];
}

/** Groups in the order their first form appears, each form once. */
export function groupUnplaced(entries: readonly { form: SourceForm; missing: Missing }[]): UnplacedGroup[] {
  const groups: UnplacedGroup[] = [];
  for (const { form, missing } of entries) {
    const group = groups.find((existing) => existing.missing === missing);
    if (group === undefined) groups.push({ missing, forms: [form] });
    else group.forms.push(form);
  }
  return groups;
}
