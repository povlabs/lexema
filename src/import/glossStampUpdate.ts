// The one-off update that brings a dictionary seeded before the gloss grammar
// stamp rule (#317) to what the seed now writes. It reads each candidate
// record's raw line back through `glossStampLiftOf`, the seed's own reading,
// and writes only the difference: the stamped glosses trimmed or dropped, the
// stated gender and number claims added, the 'missing' rows they answer
// removed. `source_record_json` is read, never written (ADR 0019).

import { GLOSS_GRAMMAR_STAMP_RULE, STAMPED_GLOSS_GLOBS } from "../italian/glossGrammarStamp.js";
import { select, type MasterReader } from "../update/master.js";
import { glossStampLiftOf, italianRecordOf, stampedGlossRows } from "./importRelease.js";
import { type DictionarySql, quoted, type RulePlanner, runRuleAlone } from "./sourceTextUpdate.js";

/** What the update found and did. */
export interface GlossStampReport {
  readonly rule: typeof GLOSS_GRAMMAR_STAMP_RULE;
  /** Records the GLOBs selected, whether or not the rule takes them. */
  readonly candidates: number;
  /** Statements this run makes, by table; all 0 on a database already up to date. */
  readonly changed: { readonly sense_gloss: number; readonly grammar_claim: number };
}

interface Candidate {
  record_id: number;
  word: string;
  raw_json: string;
}

interface GlossRow {
  record_id: number;
  gloss_id: number;
  json_pointer: string;
  text: string;
}

interface ClaimRow {
  record_id: number;
  json_pointer: string;
  status: string;
  dimension: string | null;
}

/**
 * Candidates: a noun or adjective with a gloss that may end in a stamp, or one
 * already holding a claim lifted off a gloss, so a second run reads the same
 * records back and finds them done. The earlier rules rewrite only a gloss's
 * opening, so they never move a gloss in or out of these GLOBs, which read the
 * end.
 */
function candidates(db: MasterReader): Candidate[] {
  const stampLike = STAMPED_GLOSS_GLOBS.map((glob) => `g.text GLOB ${quoted(glob)}`).join(" OR ");
  return select<Candidate>(
    db,
    `SELECT r.record_id, r.word, j.raw_json
       FROM source_record r JOIN source_record_json j ON j.record_id = r.record_id
      WHERE r.pos IN ('noun', 'adj') AND r.record_id IN (
              SELECT s.record_id FROM sense_gloss g JOIN sense s ON s.sense_id = g.sense_id WHERE ${stampLike}
              UNION
              SELECT record_id FROM grammar_claim
               WHERE scope = 'record' AND status = 'stated' AND json_pointer GLOB '/senses/*/glosses/*')
      ORDER BY r.record_id`,
  );
}

/**
 * Plan the gloss grammar stamp rule. A gloss is compared as the earlier rules
 * in the file leave it, and each statement names that row state, so a row
 * that changed in between is left alone and a second run finds nothing to do.
 */
export const planGlossStamps: RulePlanner<GlossStampReport> = (db, glosses) => {
  const found = candidates(db);
  const glossStatements: string[] = [];
  const claimStatements: string[] = [];
  const records = new Set<number>();
  let claimsAdded = 0;
  let claimsRemoved = 0;
  if (found.length > 0) {
    const ids = found.map(({ record_id }) => record_id).join(", ");
    const glossRows = select<GlossRow>(
      db,
      `SELECT s.record_id, g.gloss_id, g.json_pointer, g.text
         FROM sense_gloss g JOIN sense s ON s.sense_id = g.sense_id
        WHERE s.record_id IN (${ids})`,
    );
    const claims = select<ClaimRow>(
      db,
      `SELECT record_id, json_pointer, status, dimension FROM grammar_claim
        WHERE scope = 'record' AND record_id IN (${ids})`,
    );

    for (const { record_id: recordId, word, raw_json: rawJson } of found) {
      const record = italianRecordOf(rawJson);
      if (record === undefined) continue;
      const lift = glossStampLiftOf(record);

      for (const { pointer, stored } of stampedGlossRows(lift, record.word)) {
        const row = glossRows.find((gloss) => gloss.record_id === recordId && gloss.json_pointer === pointer);
        if (row === undefined) continue;
        const text = glosses.textOf(row.gloss_id, row.text);
        if (text === null || text === stored) continue;
        const where = `WHERE gloss_id = ${row.gloss_id} AND text = ${quoted(text)}`;
        glossStatements.push(
          stored === undefined
            ? `DELETE FROM sense_gloss ${where};`
            : `UPDATE sense_gloss SET text = ${quoted(stored)} ${where};`,
        );
        glosses.set(row.gloss_id, { recordId, word, text: stored ?? null });
      }

      const lifted = lift.claims();
      for (const claim of lifted) {
        const present = claims.some((row) =>
          row.record_id === recordId && row.json_pointer === claim.pointer && row.dimension === claim.dimension);
        if (present) continue;
        claimStatements.push(
          `INSERT INTO grammar_claim (record_id, scope, scope_index, json_pointer, status, dimension, value, source_text)
           SELECT ${recordId}, 'record', NULL, ${quoted(claim.pointer)}, 'stated', ${quoted(claim.dimension)}, ${quoted(claim.value)}, ${quoted(claim.sourceText)}
            WHERE NOT EXISTS (SELECT 1 FROM grammar_claim WHERE record_id = ${recordId}
                                AND json_pointer = ${quoted(claim.pointer)} AND dimension = ${quoted(claim.dimension)});`,
        );
        claimsAdded += 1;
        records.add(recordId);
      }
      for (const dimension of new Set(lifted.map((claim) => claim.dimension))) {
        const missing = claims.filter((row) =>
          row.record_id === recordId && row.status === "missing" && row.dimension === dimension).length;
        if (missing === 0) continue;
        claimStatements.push(
          `DELETE FROM grammar_claim WHERE record_id = ${recordId} AND scope = 'record' AND status = 'missing' AND dimension = ${quoted(dimension)};`,
        );
        claimsRemoved += missing;
        records.add(recordId);
      }
    }
  }
  return {
    report: {
      rule: GLOSS_GRAMMAR_STAMP_RULE,
      candidates: found.length,
      changed: { sense_gloss: glossStatements.length, grammar_claim: claimStatements.length },
    },
    statements: [...glossStatements, ...claimStatements],
    records: [...records],
    written: { grammar_claim: claimsAdded },
    deleted: { grammar_claim: claimsRemoved },
  };
};

/**
 * Apply the gloss grammar stamp rule to an already seeded dictionary, then
 * read it back. Throws when anything is still pending afterwards.
 */
export const liftStoredGlossStamps = (db: DictionarySql): GlossStampReport => runRuleAlone(db, planGlossStamps);
