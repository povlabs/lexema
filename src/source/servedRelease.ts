// Which release the shared dictionary serves, as the repository records it (#139).
//
// The Licence page names the release its content is up to date with. That is
// read from the change declarations under `dictionary-changes/`, never from D1,
// so the page needs no database: the newest `update:auto` declaration names the
// release fed into the master, and with none the master is still the release
// it was seeded from, `PUBLISHED_ARCHIVE_SHA256`. "Newest" is the feed release
// built from the latest dump: dump dates are what order releases
// (src/update/ordering.ts), and the monthly job names its declarations
// `<release id>.json`, with no date to sort by (src/release/monthlyRelease.ts).
//
// This file reads no file itself, so the web bundle can carry it; reading the
// declarations is src/update/readServedRelease.ts's.

import type { DeclaredChange, ReleaseId } from "../update/declaration.js";
import { ARCHIVE_FACTS, type ArchiveFacts, type ArchiveFactsCatalog, dumpPage, PUBLISHED_ARCHIVE_SHA256 } from "./archiveFacts.js";

/** The release the dictionary serves, and the Wiktionary dump it was built from. */
export interface ServedRelease {
  readonly release: ReleaseId;
  /** The dump's date, `YYYY-MM-DD`, and its public Wikimedia page. */
  readonly dump: { readonly date: string; readonly url: string };
}

/** Why the served release cannot be named: a release the catalog holds no facts for. */
export class ServedReleaseUnknown extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServedReleaseUnknown";
  }
}

/** `it-` and the first eight hex digits of an archive's SHA-256. */
export const releaseIdOf = (sha256: string): ReleaseId => `it-${sha256.slice(0, 8)}`;

/** The one archive in `catalog` whose release id is `release`, with its facts. */
function archiveOf(release: ReleaseId, catalog: ArchiveFactsCatalog): { release: ReleaseId; facts: ArchiveFacts } {
  const matches = Object.keys(catalog).filter((sha256) => releaseIdOf(sha256) === release);
  if (matches.length !== 1) {
    throw new ServedReleaseUnknown(
      `release ${release} names ${matches.length} archives in src/source/archiveFacts.ts; it must name exactly one, so its dump is known`,
    );
  }
  return { release, facts: catalog[matches[0]] };
}

/**
 * The release `changes` leave the dictionary serving: the `update:auto` feed
 * release built from the latest dump, or `master` when no change feeds one.
 * Refuses a release `catalog` holds no facts for, rather than name it without
 * its dump.
 */
export function servedRelease(
  changes: readonly DeclaredChange[],
  catalog: ArchiveFactsCatalog = ARCHIVE_FACTS,
  master: string = PUBLISHED_ARCHIVE_SHA256,
): ServedRelease {
  const fed = changes.flatMap((change) => (change.command === "update:auto" ? [archiveOf(change.inputs.feedRelease, catalog)] : []));
  const served =
    fed.length === 0
      ? archiveOf(releaseIdOf(master), catalog)
      : fed.reduce((newest, next) => (next.facts.dump.id > newest.facts.dump.id ? next : newest));
  const { date, url } = dumpPage(served.facts.dump.id);
  return { release: served.release, dump: { date, url } };
}
