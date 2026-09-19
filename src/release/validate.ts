// The gate a staged release has to pass before anything points a reader at it.
//
// Activation is one config flip: the Worker serves whatever release
// `LEXEMA_RELEASE` names. That flip is cheap and instant, which is exactly why
// the checking has to happen before it — after it, every reader is already on
// the new data.
//
// The checks run through LookupDatabase, so the same code gates a local SQLite
// file and the real D1. Checking a staged release on a laptop and activating it
// in production would be checking a different database.

import { fromNodeSqlite, type LookupDatabase } from "../lookup/database.js";
import { lookup } from "../lookup/lookup.js";
import { IT_NORMALIZER_VERSION } from "../italian/normalize.js";
import { SCHEMA_VERSION } from "../import/importRelease.js";

/**
 * Words the staged release must still answer. Each one is a shape the dataset is
 * known to contain (docs/DATASET_SPOT_CHECK.md): a three-record spelling, an
 * embedded form whose container is not the lemma, an ambiguous form_of edge, and
 * a plain headword. An import that silently drops a table tends to lose one of
 * these before it loses the row count.
 *
 * A partial release — the development seed, a `--limit` smoke run — holds none
 * of them, so `probes` is overridable. Overriding it for the real release is
 * choosing not to check.
 */
export const DEFAULT_PROBES = ["sale", "studenti", "bella", "casa"] as const;

/**
 * How far below the live release the staged one may fall before the gate says
 * no. Releases grow and shrink a little between upstream dumps; losing a tenth
 * of the rows is not drift, it is a broken import.
 */
const MIN_SIZE_RATIO = 0.9;

export interface ReleaseCheck {
  name: string;
  ok: boolean;
  /** What was actually found, in words a person can act on. */
  detail: string;
}

export interface ReleaseVerdict {
  releaseId: string;
  /** The live release the staged one was sized against, when there is one. */
  against?: string;
  checks: readonly ReleaseCheck[];
  /** True only when every check passed. Nothing partial is activatable. */
  ok: boolean;
}

export interface ValidateOptions {
  db: LookupDatabase;
  /** The staged release, the one being considered for activation. */
  releaseId: string;
  /** The currently live release, if any, used as the size baseline. */
  against?: string;
  /** Words the release must answer. Defaults to {@link DEFAULT_PROBES}. */
  probes?: readonly string[];
}

interface ReleaseRow {
  release_id: string;
  status: string;
  normalizer: string;
  schema_version: number;
  importer_version: string;
}

interface CountRow {
  records: number;
  forms: number;
  edges: number;
}

async function readRelease(db: LookupDatabase, releaseId: string): Promise<ReleaseRow | undefined> {
  const rows = await db.all<ReleaseRow>(
    `SELECT release_id, status, normalizer, schema_version, importer_version
       FROM source_release
      WHERE release_id = ?`,
    [releaseId],
  );
  return rows[0];
}

async function readCounts(db: LookupDatabase, releaseId: string): Promise<CountRow> {
  const rows = await db.all<CountRow>(
    `SELECT
       (SELECT count(*) FROM source_record WHERE release_id = ?) AS records,
       (SELECT count(*) FROM lookup_form   WHERE release_id = ?) AS forms,
       (SELECT count(*) FROM form_of_edge  WHERE release_id = ?) AS edges`,
    [releaseId, releaseId, releaseId],
  );
  return rows[0];
}

const n = (value: number) => value.toLocaleString("en-US");

/**
 * Judge one staged release. Every check runs even after one fails, because the
 * useful output of a rejected release is the whole list of what is wrong with
 * it, not the first thing that tripped.
 */
export async function validateRelease({
  db,
  releaseId,
  against,
  probes = DEFAULT_PROBES,
}: ValidateOptions): Promise<ReleaseVerdict> {
  const checks: ReleaseCheck[] = [];
  const staged = await readRelease(db, releaseId);

  if (staged === undefined) {
    return {
      releaseId,
      against,
      ok: false,
      checks: [{ name: "exists", ok: false, detail: `no release '${releaseId}' in this database` }],
    };
  }
  checks.push({ name: "exists", ok: true, detail: `imported by ${staged.importer_version}` });

  // An interrupted import leaves 'importing'; a retired one is 'superseded'.
  // Both are invisible to lookup, so activating either serves an error page.
  checks.push({
    name: "complete",
    ok: staged.status === "complete",
    detail: `status is '${staged.status}'`,
  });

  // A release built by a different normalizer has search keys this build cannot
  // reproduce, so every query would miss. lookup() refuses it outright.
  checks.push({
    name: "normalizer",
    ok: staged.normalizer === IT_NORMALIZER_VERSION,
    detail:
      staged.normalizer === IT_NORMALIZER_VERSION
        ? staged.normalizer
        : `release has '${staged.normalizer}', this build reads '${IT_NORMALIZER_VERSION}'`,
  });

  checks.push({
    name: "schema",
    ok: staged.schema_version === SCHEMA_VERSION,
    detail:
      staged.schema_version === SCHEMA_VERSION
        ? `v${staged.schema_version}`
        : `release is v${staged.schema_version}, this build reads v${SCHEMA_VERSION}`,
  });

  const counts = await readCounts(db, releaseId);
  checks.push({
    name: "not-empty",
    ok: counts.records > 0 && counts.forms > 0,
    detail: `${n(counts.records)} records, ${n(counts.forms)} lookup forms, ${n(counts.edges)} form_of edges`,
  });

  if (against !== undefined) {
    const live = await readCounts(db, against);
    const floor = Math.floor(live.records * MIN_SIZE_RATIO);
    checks.push({
      name: "size",
      ok: counts.records >= floor,
      detail:
        counts.records >= floor
          ? `${n(counts.records)} records against ${n(live.records)} live`
          : `${n(counts.records)} records is under the ${n(floor)} floor set by ${against}'s ${n(live.records)}`,
    });
  }

  // The probes go through the real lookup path rather than counting rows, so a
  // release that has rows but cannot be queried still fails here.
  for (const probe of probes) {
    try {
      const result = await lookup({ db, releaseId, query: probe });
      checks.push({
        name: `probe:${probe}`,
        ok: result.outcome === "found",
        detail:
          result.outcome === "found"
            ? `${result.readings.length} ${result.readings.length === 1 ? "entry" : "entries"}`
            : `lookup returned '${result.outcome}'`,
      });
    } catch (error: unknown) {
      checks.push({
        name: `probe:${probe}`,
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { releaseId, against, checks, ok: checks.every((check) => check.ok) };
}

/** Convenience for the CLI and tests: validate a local SQLite file. */
export function validateLocalRelease(
  db: Parameters<typeof fromNodeSqlite>[0],
  options: Omit<ValidateOptions, "db">,
): Promise<ReleaseVerdict> {
  return validateRelease({ db: fromNodeSqlite(db), ...options });
}
