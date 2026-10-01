// The releases one dictionary database holds, and the moves `pnpm run release`
// makes on them (releaseLifecycle.ts). Every write names the status it moves
// from, and is read back, so a move that raced another, or did not land, is
// reported rather than assumed.

import { moveOutcome, movesFrom, ReleaseMoveRefused, type ReleaseMove } from "./releaseLifecycle.js";
import { type DictionarySql, quoted, type ReleaseState, releaseStates } from "./seedPlacement.js";

/** Records deleted per statement when a release is discarded, so no one statement runs long. */
export const DISCARD_BATCH = 5_000;

/** Tables whose rows name their release; a discarded release leaves none in any of them. */
const BY_RELEASE = [
  "source_record", "lookup_form", "accent_fold", "typo_key", "form_of_edge",
  "raw_page", "recovered_definition", "release_table_rows",
] as const;

interface IdRange {
  readonly low: number | null;
  readonly high: number | null;
}

export class Releases {
  constructor(
    private readonly sql: DictionarySql,
    /** Every release id a deployment names (`servedReleases`). */
    readonly served: ReadonlySet<string>,
  ) {}

  list(): ReleaseState[] {
    return releaseStates(this.sql);
  }

  find(releaseId: string): ReleaseState {
    const release = this.list().find((held) => held.releaseId === releaseId);
    if (release === undefined) throw new ReleaseMoveRefused(`no release ${releaseId} in this database`);
    return release;
  }

  /** Make `move` on the release, and answer where it now stands, or `gone`. */
  apply(releaseId: string, move: ReleaseMove, batch = DISCARD_BATCH): ReleaseState | "gone" {
    const release = this.find(releaseId);
    const outcome = moveOutcome(release, move, this.served);
    if (outcome === "gone") {
      this.discard(release, batch);
      return "gone";
    }
    const from = movesFrom(move).map(quoted).join(", ");
    this.sql.run(`UPDATE source_release SET status = ${quoted(outcome)} WHERE release_id = ${quoted(releaseId)} AND status IN (${from})`);
    const now = this.find(releaseId);
    if (now.status !== outcome) {
      throw new Error(`release ${releaseId} should be ${outcome} after ${move}, but reads ${now.status}`);
    }
    return now;
  }

  /**
   * Delete every row of a failed or partial release, a batch of records at a
   * time. Deleting a record cascades to the rows hung off it; the two nearby
   * indexes, which carry no foreign key, are deleted by release. The
   * `source_release` row goes last, so a discard that stops can be run again.
   */
  private discard(release: ReleaseState, batch: number): void {
    const id = quoted(release.releaseId);
    const [records] = this.sql.query<IdRange>(`SELECT min(record_id) AS low, max(record_id) AS high FROM source_record WHERE release_id = ${id}`);
    const [recovered] = this.sql.query<IdRange>(`SELECT min(recovered_id) AS low, max(recovered_id) AS high FROM recovered_definition WHERE release_id = ${id}`);
    const drain = (table: string, key: string): void => {
      while (this.sql.query<{ held: number }>(`SELECT EXISTS (SELECT 1 FROM ${table} WHERE release_id = ${id}) AS held`)[0].held === 1) {
        this.sql.run(`DELETE FROM ${table} WHERE release_id = ${id} AND ${key} IN (SELECT ${key} FROM ${table} WHERE release_id = ${id} LIMIT ${batch})`);
      }
    };
    drain("source_record", "record_id");
    drain("accent_fold", "fold_key");
    drain("typo_key", "deletion_key");
    this.sql.run(`DELETE FROM source_release WHERE release_id = ${id} AND status IN (${movesFrom("discard").map(quoted).join(", ")})`);

    // Read back: no row names the release, and none hangs off its ids. The
    // ids a release was given are one unbroken run, so a range covers them.
    const left: string[] = BY_RELEASE.filter(
      (table) => this.sql.query<{ held: number }>(`SELECT EXISTS (SELECT 1 FROM ${table} WHERE release_id = ${id}) AS held`)[0].held === 1,
    );
    if (this.list().some(({ releaseId }) => releaseId === release.releaseId)) left.push("source_release");
    const within = (table: string, column: string, low: number, high: number): void => {
      if (this.sql.query<{ held: number }>(`SELECT EXISTS (SELECT 1 FROM ${table} WHERE ${column} BETWEEN ${low} AND ${high}) AS held`)[0].held === 1) {
        left.push(table);
      }
    };
    if (records.low !== null && records.high !== null) {
      for (const table of ["source_record_json", "sense", "grammar_claim", "claim_review"]) within(table, "record_id", records.low, records.high);
      for (const table of ["sense_gloss", "sense_label"]) within(table, "sense_id", records.low * 1000, records.high * 1000 + 999);
    }
    if (recovered.low !== null && recovered.high !== null) {
      for (const table of ["recovered_label", "recovered_example"]) within(table, "recovered_id", recovered.low, recovered.high);
    }
    if (left.length > 0) throw new Error(`release ${release.releaseId} was discarded, but rows remain in: ${left.join(", ")}`);
  }
}
