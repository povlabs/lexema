import { ARCHIVE_FACTS, archiveFactsFor, type ArchiveFactsCatalog } from "../source/archiveFacts.js";
import type { MasterDiff } from "./diff.js";

/** Checksum-bound dump dates establish ordering, never release hashes or download times. */
export function verifyFeedOrdering({ master, feed }: MasterDiff, catalog: ArchiveFactsCatalog = ARCHIVE_FACTS): void {
  const dateOf = (sha: string): string => {
    const facts = archiveFactsFor(sha, catalog);
    const id = facts?.dump.id;
    if (id === undefined || !/^itwiktionary-\d{8}$/.test(id)) throw new Error(`unverified source ordering: no dated dump facts for archive ${sha}`);
    const digits = id.slice(-8);
    const iso = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
    const date = new Date(`${iso}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== iso) throw new Error(`unverified source ordering: invalid dump date ${id}`);
    return digits;
  };
  const later = dateOf(feed.archiveSha256);
  for (const release of [master, ...master.feeds]) {
    const earlier = dateOf(release.archiveSha256);
    if (feed.archiveSha256 === release.archiveSha256 && release.releaseId !== master.releaseId) continue;
    if (later <= earlier) throw new Error(`unverified source ordering: ${feed.releaseId} is not a newer dump than ${release.releaseId}; same-dump different archives have no verified order`);
  }
}
