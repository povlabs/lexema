// The four writes that move a release through its lifecycle.
//
// They live here rather than in the CLI so that a test can exercise the thing
// an operator actually runs. A test that re-typed the same UPDATE would pass
// while the command it claims to cover was broken.
//
// Activation is deliberately not one of them: the Worker serves whatever
// `LEXEMA_RELEASE` names, so activating and rolling back are that one variable
// and not a database write at all. docs/RELEASES.md has the steps.

import type { LookupDatabase } from "../lookup/database.js";

/**
 * Reads and writes both go through `all`. node:sqlite and D1's HTTP API each
 * run an UPDATE that way, and neither reports a row count through this
 * interface — so every write reads the row back instead of trusting it.
 */
type ReleaseDatabase = LookupDatabase;

export async function readStatus(
  db: ReleaseDatabase,
  releaseId: string,
): Promise<string | undefined> {
  const rows = await db.all<{ status: string }>(
    "SELECT status FROM source_release WHERE release_id = ?",
    [releaseId],
  );
  return rows[0]?.status;
}

/**
 * Move a release between two statuses, refusing unless it is in the one this
 * transition starts from. That refusal is what keeps `retire` and `restore`
 * exact inverses of each other.
 */
async function setStatus(
  db: ReleaseDatabase,
  releaseId: string,
  from: string,
  to: string,
): Promise<void> {
  const before = await readStatus(db, releaseId);
  if (before !== from) {
    throw new Error(
      before === undefined
        ? `no release '${releaseId}' in this database`
        : `'${releaseId}' is ${before}, not ${from}`,
    );
  }
  await db.all("UPDATE source_release SET status = ? WHERE release_id = ? AND status = ?", [
    to,
    releaseId,
    from,
  ]);
  const after = await readStatus(db, releaseId);
  if (after !== to) throw new Error(`'${releaseId}' is still ${after ?? "gone"}; nothing changed`);
}

/**
 * Hide a release from every read without deleting a row.
 *
 * It does not check whether `LEXEMA_RELEASE` still points at the release:
 * retiring the live one takes the site down, and {@link restoreRelease} is the
 * way back. Guessing at the deployed variable from here would be a worse lie
 * than the honest absence of a check.
 */
export function retireRelease(db: ReleaseDatabase, releaseId: string): Promise<void> {
  return setStatus(db, releaseId, "complete", "superseded");
}

/** The inverse of retire, so a retire made too early still has a way back. */
export function restoreRelease(db: ReleaseDatabase, releaseId: string): Promise<void> {
  return setStatus(db, releaseId, "superseded", "complete");
}

/**
 * Clear a crashed import.
 *
 * The importer commits the release row before the first record, so an
 * interruption leaves a release stuck at 'importing' holding however many
 * batches landed: hidden from every read, but enough to make re-importing under
 * the same id refuse. This is the way out, and the foreign keys cascade the
 * children away with the row.
 *
 * It reaches nothing else. A 'complete' release still has readers and a
 * 'superseded' one is somebody's rollback target.
 */
export async function discardRelease(db: ReleaseDatabase, releaseId: string): Promise<void> {
  const status = await readStatus(db, releaseId);
  if (status === undefined) throw new Error(`no release '${releaseId}' in this database`);
  if (status !== "importing") {
    throw new Error(
      `'${releaseId}' is ${status}, not an unfinished import. ` +
        "Use retire to hide a complete release.",
    );
  }

  await db.all("DELETE FROM source_release WHERE release_id = ? AND status = 'importing'", [
    releaseId,
  ]);
  if ((await readStatus(db, releaseId)) !== undefined) {
    throw new Error(`'${releaseId}' is still there; nothing was deleted`);
  }
}
