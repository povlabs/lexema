// Where a release stands, and the moves a person may make on it once its seed
// has ended (#18). `source_release.status` is the mechanism: every lookup
// reads only a `complete` release (src/db/queries.sql), so a release is
// servable exactly while it is `complete`. Which complete release a site
// serves is the deployment's `LEXEMA_RELEASE` (web/wrangler.jsonc).
//
//   importing  --seed verified-->  complete | partial      (seedLoad.ts)
//   importing  --seed check failed-->  failed               (seedLoad.ts)
//   importing  --abandon-->  failed     a seed that stopped without marking it
//   complete   --retire-->   superseded no longer servable; its rows stay
//   superseded --restore-->  complete   servable again, for a rollback past a retire
//   failed | partial  --discard-->  gone   its rows deleted
//
// The CHECK on `source_release.status` already lists these five states, so a
// database seeded before this change needs no migration.

import type { ReleaseState } from "./seedPlacement.js";

export const RELEASE_STATUSES = ["importing", "partial", "complete", "failed", "superseded"] as const;
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];

/** What `pnpm run release` can do to a release. */
export type ReleaseMove = "retire" | "restore" | "abandon" | "discard";

export const RELEASE_MOVES: readonly ReleaseMove[] = ["retire", "restore", "abandon", "discard"];

/** `gone`: the release's rows and its `source_release` row are deleted. */
export type MoveOutcome = ReleaseStatus | "gone";

interface MoveRule {
  readonly from: readonly ReleaseStatus[];
  readonly to: MoveOutcome;
  /** Whether a release a deployment names may be moved this way. */
  readonly whileServed: boolean;
}

const RULES: Readonly<Record<ReleaseMove, MoveRule>> = {
  retire: { from: ["complete"], to: "superseded", whileServed: false },
  restore: { from: ["superseded"], to: "complete", whileServed: true },
  abandon: { from: ["importing"], to: "failed", whileServed: false },
  // Only a release that was never servable. A superseded release may still
  // be rolled back to, and its claim reviews would go with its records.
  discard: { from: ["failed", "partial"], to: "gone", whileServed: false },
};

/** A move this release cannot make; nothing was written. */
export class ReleaseMoveRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReleaseMoveRefused";
  }
}

export const isReleaseMove = (word: string): word is ReleaseMove => (RELEASE_MOVES as readonly string[]).includes(word);

/** The status a release moves from: the one this move may start from. */
export const movesFrom = (move: ReleaseMove): readonly ReleaseStatus[] => RULES[move].from;

/**
 * Where `move` leaves `release`, or a refusal saying why it may not. `served`
 * holds every release id a deployment names; retiring, abandoning or
 * discarding one of those would take the dictionary from a running site.
 */
export function moveOutcome(release: ReleaseState, move: ReleaseMove, served: ReadonlySet<string>): MoveOutcome {
  const rule = RULES[move];
  if (!rule.from.includes(release.status)) {
    throw new ReleaseMoveRefused(
      `cannot ${move} release ${release.releaseId}: it is ${release.status}, and ${move} moves only a ${rule.from.join(" or ")} release`,
    );
  }
  if (!rule.whileServed && served.has(release.releaseId)) {
    throw new ReleaseMoveRefused(
      `cannot ${move} release ${release.releaseId}: web/wrangler.jsonc serves it as LEXEMA_RELEASE. ` +
        `Point every LEXEMA_RELEASE at another release and deploy that first (docs/UPDATE_A_RELEASE.md)`,
    );
  }
  return rule.to;
}

/** Every release id a configuration in web/wrangler.jsonc serves as `LEXEMA_RELEASE`. */
export function servedReleases(wranglerJsonc: string): Set<string> {
  return new Set([...wranglerJsonc.matchAll(/"LEXEMA_RELEASE"\s*:\s*"([^"]+)"/g)].map(([, releaseId]) => releaseId));
}
