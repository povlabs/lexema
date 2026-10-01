// The one-off update for a dictionary seeded before a source text
// normalization existed (ADR 0019, #257). It rewrites the stored glosses the
// seed now writes normalized, with the same `normalizeGloss`, and touches no
// other table: `source_record_json` keeps the source's wording.

import { NORMALIZABLE_GLOSS_GLOB, SOURCE_TEXT_RULES, normalizeGloss } from "../italian/sourceTextNormalization.js";

/** What the update needs from a dictionary database: read rows, run statements. */
export interface DictionarySql {
  query<Row>(sql: string): Row[];
  run(sql: string): void;
}

/** What the update found and did. */
export interface GlossNormalizationReport {
  /** The rule this update applies, name and version. */
  readonly rule: typeof SOURCE_TEXT_RULES.personOrdinalGloss;
  /** Rows the GLOB selected, whether or not they needed a change. */
  readonly candidates: number;
  /** Rows rewritten by this run; 0 on a database already normalized. */
  readonly changed: number;
}

interface PendingGloss {
  readonly glossId: number;
  readonly from: string;
  readonly to: string;
}

const quoted = (value: string): string => `'${value.replaceAll("'", "''")}'`;

function pending(db: DictionarySql): { candidates: number; rows: PendingGloss[] } {
  const found = db.query<{ gloss_id: number; text: string }>(
    `SELECT gloss_id, text FROM sense_gloss WHERE text GLOB ${quoted(NORMALIZABLE_GLOSS_GLOB)} ORDER BY gloss_id`,
  );
  const rows = found
    .map(({ gloss_id, text }) => ({ glossId: gloss_id, from: text, to: normalizeGloss(text) }))
    .filter(({ from, to }) => from !== to);
  return { candidates: found.length, rows };
}

/**
 * Rewrite every stored gloss `normalizeGloss` would change, then read the rows
 * back. Each UPDATE names the text it replaces, so a row that changed in
 * between is left alone, and a second run finds nothing to do. Throws when a
 * row still needs the rewrite afterwards.
 */
export function normalizeStoredGlosses(db: DictionarySql): GlossNormalizationReport {
  const before = pending(db);
  if (before.rows.length > 0) {
    db.run(
      before.rows
        .map(({ glossId, from, to }) =>
          `UPDATE sense_gloss SET text = ${quoted(to)} WHERE gloss_id = ${glossId} AND text = ${quoted(from)};`)
        .join("\n"),
    );
  }
  const after = pending(db);
  if (after.rows.length > 0) {
    throw new Error(
      `${after.rows.length} gloss(es) still need normalizing after the update: gloss_id ${after.rows.map(({ glossId }) => glossId).join(", ")}`,
    );
  }
  return { rule: SOURCE_TEXT_RULES.personOrdinalGloss, candidates: before.candidates, changed: before.rows.length };
}
