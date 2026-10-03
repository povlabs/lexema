import { ARCHIVE_FACTS, type ArchiveFactsCatalog } from "../source/archiveFacts.js";
import { chooseChanges, planApply, type ApplyPlan } from "./apply.js";
import type { MasterDiff } from "./diff.js";
import type { MasterReader } from "./master.js";
import { selectChanges, type FeedPages } from "./select.js";

/** Compose selection and apply without a per-word choice or review artifact. */
export async function automaticPlan(
  reader: MasterReader,
  found: MasterDiff,
  pages: FeedPages,
  { appliedAt, catalog = ARCHIVE_FACTS }: { appliedAt: string; catalog?: ArchiveFactsCatalog },
): Promise<ApplyPlan | null> {
  const selection = await selectChanges(reader, found, pages, catalog);
  if (selection.taken.length === 0) return null;
  return planApply(reader, found, chooseChanges(found, selection.taken.map(({ id }) => id)), { appliedAt, catalog });
}
