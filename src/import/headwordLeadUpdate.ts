// The one-off update for a dictionary seeded before rule
// `gloss-headword-lead/v1` (#325, ADR 0019). It rewrites the stored glosses
// the seed now writes without their headword lead, with the same
// `withoutHeadwordLead`, and touches no other table: `source_record_json`
// keeps the source's wording.

import { HEADWORD_LEAD_GLOSS_GLOB, SOURCE_TEXT_RULES, withoutHeadwordLead } from "../italian/sourceTextNormalization.js";
import type { DictionarySql } from "./normalizeGlosses.js";

/** What the update found and did. */
export interface HeadwordLeadReport {
  readonly rule: typeof SOURCE_TEXT_RULES.headwordLeadGloss;
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
  const found = db.query<{ gloss_id: number; text: string; word: string }>(
    `SELECT g.gloss_id, g.text, r.word
       FROM sense_gloss g JOIN sense s ON s.sense_id = g.sense_id JOIN source_record r ON r.record_id = s.record_id
      WHERE g.text GLOB ${quoted(HEADWORD_LEAD_GLOSS_GLOB)} ORDER BY g.gloss_id`,
  );
  const rows = found
    .map(({ gloss_id, text, word }) => ({ glossId: gloss_id, from: text, to: withoutHeadwordLead(word, text) }))
    .filter(({ from, to }) => from !== to);
  return { candidates: found.length, rows };
}

/**
 * Rewrite every stored gloss `withoutHeadwordLead` would change, then read the
 * rows back. Each UPDATE names the text it replaces, so a row that changed in
 * between is left alone, and a second run finds nothing to do. Throws when a
 * row still needs the rewrite afterwards.
 */
export function dropStoredHeadwordLeads(db: DictionarySql): HeadwordLeadReport {
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
      `${after.rows.length} gloss(es) still lead with the headword after the update: gloss_id ${after.rows.map(({ glossId }) => glossId).join(", ")}`,
    );
  }
  return { rule: SOURCE_TEXT_RULES.headwordLeadGloss, candidates: before.candidates, changed: before.rows.length };
}
