import { ARCHIVE_FACTS, type ArchiveFactsCatalog } from "../source/archiveFacts.js";
import { chooseChanges, planApply, type ApplyPlan } from "./apply.js";
import type { MasterDiff } from "./diff.js";
import type { MasterReader } from "./master.js";
import { selectChanges, type FeedPages, type Selection } from "./select.js";

/** What the selection took: the records per take reason, and how many `replaces-translations` records differ only in translations. */
export type TakenCounts = Pick<Selection["counts"], "taken" | "translationsOnly">;

/** The automatic update: what the selection took, and the apply of it, or null when it took nothing. */
export interface AutomaticUpdate {
  readonly taken: TakenCounts;
  readonly apply: ApplyPlan | null;
}

type AutomaticOptions = { appliedAt: string; catalog?: ArchiveFactsCatalog };

/** Compose selection and apply without a per-word choice or review artifact, and say what the selection took. */
export async function automaticUpdate(reader: MasterReader, found: MasterDiff, pages: FeedPages, { appliedAt, catalog = ARCHIVE_FACTS }: AutomaticOptions): Promise<AutomaticUpdate> {
  const selection = await selectChanges(reader, found, pages, catalog);
  const taken = { taken: selection.counts.taken, translationsOnly: selection.counts.translationsOnly };
  if (selection.taken.length === 0) return { taken, apply: null };
  return { taken, apply: await planApply(reader, found, chooseChanges(found, selection.taken.map(({ id }) => id)), { appliedAt, catalog }) };
}

/** The apply of what the automatic selection takes, or null when it takes nothing. */
export async function automaticPlan(reader: MasterReader, found: MasterDiff, pages: FeedPages, options: AutomaticOptions): Promise<ApplyPlan | null> {
  return (await automaticUpdate(reader, found, pages, options)).apply;
}
