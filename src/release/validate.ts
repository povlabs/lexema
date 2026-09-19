// The gate a staged release has to pass before anything points a reader at it.
//
// Activation is one config flip: the Worker serves whatever release
// `LEXEMA_RELEASE` names. That flip is cheap and instant, which is exactly why
// the checking has to happen before it — after it, every reader is already on
// the new data.
//
// The checks run through LookupDatabase, so the same code gates a local SQLite
// file and the real D1 (`check --d1`). Checking a staged release on a laptop
// and activating it in production would be checking a different database.

import { fromNodeSqlite, type LookupDatabase } from "../lookup/database.js";
import { lookup } from "../lookup/lookup.js";
import type { Reading } from "../lookup/types.js";
import { IT_NORMALIZER_VERSION } from "../italian/normalize.js";
import { SCHEMA_VERSION } from "../import/importRelease.js";
import {
  computeProjection,
  countProjection,
  decodeCounts,
  diffCounts,
} from "./projection.js";

/**
 * Something a probe requires of the readings a release returns. Counting rows
 * proves a table is populated; these prove the *relationships* survived, which
 * is what a dropped or truncated derived table actually costs.
 */
export type ProbeExpectation =
  /** Some reading is about the searched surface, not merely listing it. */
  | "headword"
  /** Some reading only lists the surface in its own forms table. */
  | "embedded-form"
  /** Some reading declares a form_of edge that resolves to a real record. */
  | "lemma-candidates"
  /** Some record declares itself a form of a returned reading. */
  | "inflections"
  /** Some reading carries copied source gloss text. */
  | "gloss"
  /** Some reading carries grammar read off the source tags. */
  | "grammar";

export interface Probe {
  query: string;
  /** Fewest readings the release must return for this surface. */
  minReadings: number;
  /** Shapes at least one returned reading must have. */
  expects: readonly ProbeExpectation[];
}

/**
 * Words the staged release must still answer, and what each one has to come
 * back carrying. Each is a shape the dataset is known to contain
 * (docs/DATASET_SPOT_CHECK.md): a three-record spelling, an embedded form whose
 * container is not the lemma, an ambiguous form_of edge, a headword the source
 * says little about, and a lemma with inflections pointing back at it.
 *
 * Asserting only "lookup found something" would let a release that lost every
 * `form_of_edge` row pass — the headword rows alone answer all five queries.
 * The expectations are the point of the probes.
 *
 * A partial release — the development seed, a `--limit` smoke run — holds none
 * of this, so `probes` is overridable. Overriding it for the real release is
 * choosing not to check.
 */
export const DEFAULT_PROBES: readonly Probe[] = [
  // Three separate records: the salt noun, the plural of `sala`, and a form of
  // `salire`. Merging them, or losing two, is caught here and nowhere else.
  { query: "sale", minReadings: 3, expects: ["headword", "lemma-candidates"] },
  // Listed by `studente` and `studentessa` in their forms tables, and its own
  // record declares the edge back to the lemma.
  { query: "studenti", minReadings: 2, expects: ["embedded-form", "lemma-candidates"] },
  // Its noun edge points at `bello`, which is several records. The gate only
  // requires that the edge still resolves to at least one.
  { query: "bella", minReadings: 1, expects: ["lemma-candidates"] },
  // A plain headword whose gender the source never states.
  { query: "casa", minReadings: 1, expects: ["headword", "gloss", "grammar"] },
  // The reverse direction: records that declare themselves forms of this one.
  { query: "studente", minReadings: 1, expects: ["headword", "inflections"] },
];

/**
 * How far below the live release the staged one may fall before the gate says
 * no. Releases grow and shrink a little between upstream dumps; losing a tenth
 * of the rows is not drift, it is a broken import.
 */
const MIN_SIZE_RATIO = 0.9;

/**
 * What the staged release's size is judged against.
 *
 * There is no "unspecified" case on purpose. An omitted baseline used to skip
 * the size check silently, which meant a mistyped release id turned the 90%
 * floor into no floor at all. Sizing a release against nothing is now something
 * a caller has to say out loud, and it is only allowed when there is genuinely
 * no earlier release to size against.
 */
export type SizeBaseline =
  | { kind: "against"; releaseId: string }
  | { kind: "first-release" };

export interface ReleaseCheck {
  name: string;
  ok: boolean;
  /** What was actually found, in words a person can act on. */
  detail: string;
}

export interface ReleaseVerdict {
  releaseId: string;
  baseline: SizeBaseline;
  checks: readonly ReleaseCheck[];
  /** True only when every check passed. Nothing partial is activatable. */
  ok: boolean;
}

export interface ValidateOptions {
  db: LookupDatabase;
  /** The staged release, the one being considered for activation. */
  releaseId: string;
  /** What to size it against. */
  baseline: SizeBaseline;
  /** Words the release must answer. Defaults to {@link DEFAULT_PROBES}. */
  probes?: readonly Probe[];
  /**
   * Re-hash every derived row and compare against the digest the import
   * recorded. Off by default because it is a full scan of the release; the row
   * counts are checked either way.
   */
  verifyProjection?: boolean;
}

interface ReleaseRow {
  release_id: string;
  status: string;
  normalizer: string;
  schema_version: number;
  importer_version: string;
  projection_sha256: string | null;
  projection_counts: string | null;
}

interface CountRow {
  records: number;
  forms: number;
  edges: number;
}

async function readRelease(db: LookupDatabase, releaseId: string): Promise<ReleaseRow | undefined> {
  const rows = await db.all<ReleaseRow>(
    `SELECT release_id, status, normalizer, schema_version, importer_version,
            projection_sha256, projection_counts
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

/** Every release in the database other than the staged one. */
async function otherReleases(db: LookupDatabase, releaseId: string): Promise<ReleaseRow[]> {
  return db.all<ReleaseRow>(
    `SELECT release_id, status, normalizer, schema_version, importer_version,
            projection_sha256, projection_counts
       FROM source_release
      WHERE release_id <> ?
      ORDER BY release_id`,
    [releaseId],
  );
}

const n = (value: number) => value.toLocaleString("en-US");

/** Does any reading satisfy this expectation? */
function satisfies(readings: readonly Reading[], expectation: ProbeExpectation): boolean {
  switch (expectation) {
    case "headword":
      return readings.some((reading) => reading.isAboutQuery);
    case "embedded-form":
      return readings.some((reading) =>
        reading.evidence.some((item) => item.origin === "embedded-form"),
      );
    case "lemma-candidates":
      return readings.some((reading) =>
        reading.lemmaLinks.some((link) => link.kind === "candidates" && link.candidates.length > 0),
      );
    case "inflections":
      return readings.some((reading) => reading.inflections.length > 0);
    case "gloss":
      return readings.some((reading) =>
        reading.senses.some((sense) => sense.glosses.length > 0),
      );
    case "grammar":
      return readings.some(
        (reading) =>
          reading.grammar.record.length > 0 ||
          reading.grammar.byForm.size > 0 ||
          reading.grammar.bySense.size > 0,
      );
  }
}

/** Judge one probe's answer. The detail names every expectation that failed. */
async function runProbe(
  db: LookupDatabase,
  releaseId: string,
  probe: Probe,
): Promise<ReleaseCheck> {
  const name = `probe:${probe.query}`;
  let readings: readonly Reading[];
  try {
    const result = await lookup({ db, releaseId, query: probe.query });
    if (result.outcome !== "found") {
      return { name, ok: false, detail: `lookup returned '${result.outcome}'` };
    }
    readings = result.readings;
  } catch (error: unknown) {
    return { name, ok: false, detail: error instanceof Error ? error.message : String(error) };
  }

  const missing = probe.expects.filter((expectation) => !satisfies(readings, expectation));
  const short = readings.length < probe.minReadings;
  if (!short && missing.length === 0) {
    const found = `${readings.length} ${readings.length === 1 ? "reading" : "readings"}`;
    return {
      name,
      ok: true,
      detail: probe.expects.length === 0 ? found : `${found}, ${probe.expects.join(" + ")}`,
    };
  }

  const faults = [
    ...(short ? [`${readings.length} readings, expected at least ${probe.minReadings}`] : []),
    ...(missing.length > 0 ? [`no reading has ${missing.join(" or ")}`] : []),
  ];
  return { name, ok: false, detail: faults.join("; ") };
}

/**
 * Judge one staged release. Every check runs even after one fails, because the
 * useful output of a rejected release is the whole list of what is wrong with
 * it, not the first thing that tripped.
 */
export async function validateRelease({
  db,
  releaseId,
  baseline,
  probes = DEFAULT_PROBES,
  verifyProjection = false,
}: ValidateOptions): Promise<ReleaseVerdict> {
  const checks: ReleaseCheck[] = [];
  const staged = await readRelease(db, releaseId);

  if (staged === undefined) {
    return {
      releaseId,
      baseline,
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
    ok: counts.records > 0 && counts.forms > 0 && counts.edges > 0,
    detail: `${n(counts.records)} records, ${n(counts.forms)} lookup forms, ${n(counts.edges)} form_of edges`,
  });

  checks.push(...(await projectionChecks(db, staged, verifyProjection)));
  checks.push(await sizeCheck(db, releaseId, counts, baseline));

  // The probes go through the real lookup path rather than counting rows, so a
  // release that has rows but cannot be queried still fails here.
  for (const probe of probes) {
    checks.push(await runProbe(db, releaseId, probe));
  }

  return { releaseId, baseline, checks, ok: checks.every((check) => check.ok) };
}

/**
 * Is this release still the derivation the import produced? The recorded counts
 * are compared every time; the full digest only when asked, because it re-reads
 * every derived row.
 */
async function projectionChecks(
  db: LookupDatabase,
  staged: ReleaseRow,
  verify: boolean,
): Promise<ReleaseCheck[]> {
  const recorded = decodeCounts(staged.projection_counts);
  if (recorded === undefined) {
    return [
      {
        name: "projection",
        ok: false,
        detail:
          "the import recorded no per-table counts for this release, so its derived data cannot be checked",
      },
    ];
  }

  const found = await countProjection(db, staged.release_id);
  const differences = diffCounts(recorded, found);
  const checks: ReleaseCheck[] = [
    {
      name: "projection",
      ok: differences.length === 0,
      detail:
        differences.length === 0
          ? `${Object.values(recorded).reduce((sum, value) => sum + value, 0).toLocaleString("en-US")} derived rows, every table as imported`
          : differences
              .map((d) => `${d.table}: ${n(d.found)} rows, import recorded ${n(d.recorded)}`)
              .join("; "),
    },
  ];

  if (!verify) return checks;

  const projection = await computeProjection(db, staged.release_id);
  checks.push({
    name: "projection-digest",
    ok: projection.digest === staged.projection_sha256,
    detail:
      projection.digest === staged.projection_sha256
        ? `sha256:${projection.digest.slice(0, 16)} matches the import`
        : `derived rows hash to ${projection.digest.slice(0, 16)}, the import recorded ${(staged.projection_sha256 ?? "nothing").slice(0, 16)}`,
  });
  return checks;
}

/** The 90% floor, and the refusal to pretend there is one when there is not. */
async function sizeCheck(
  db: LookupDatabase,
  releaseId: string,
  counts: CountRow,
  baseline: SizeBaseline,
): Promise<ReleaseCheck> {
  if (baseline.kind === "first-release") {
    // Claiming there is nothing to size against is only true if there is
    // nothing to size against. Otherwise it is the mistyped `--against` this
    // check exists to catch, spelled differently.
    const others = await otherReleases(db, releaseId);
    return {
      name: "size",
      ok: others.length === 0,
      detail:
        others.length === 0
          ? `${n(counts.records)} records, and no earlier release to size against`
          : `--first-release, but this database also holds ${others.map((row) => `${row.release_id} (${row.status})`).join(", ")}`,
    };
  }

  const live = await readRelease(db, baseline.releaseId);
  if (live === undefined) {
    return {
      name: "size",
      ok: false,
      detail: `no release '${baseline.releaseId}' to size against — check the spelling, or pass --first-release`,
    };
  }

  const liveCounts = await readCounts(db, baseline.releaseId);
  if (liveCounts.records === 0) {
    return {
      name: "size",
      ok: false,
      detail: `${baseline.releaseId} has no records, so it is no baseline`,
    };
  }

  const floor = Math.floor(liveCounts.records * MIN_SIZE_RATIO);
  return {
    name: "size",
    ok: counts.records >= floor,
    detail:
      counts.records >= floor
        ? `${n(counts.records)} records against ${n(liveCounts.records)} in ${baseline.releaseId}`
        : `${n(counts.records)} records is under the ${n(floor)} floor set by ${baseline.releaseId}'s ${n(liveCounts.records)}`,
  };
}

/** Convenience for the CLI and tests: validate a local SQLite file. */
export function validateLocalRelease(
  db: Parameters<typeof fromNodeSqlite>[0],
  options: Omit<ValidateOptions, "db">,
): Promise<ReleaseVerdict> {
  return validateRelease({ db: fromNodeSqlite(db), ...options });
}
