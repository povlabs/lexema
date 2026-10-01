// The one-off update that brings a dictionary seeded before the gloss grammar
// stamp rule (#317) to what the seed now writes. It reads each candidate
// record's raw line back through `glossStampLiftOf`, the seed's own reading,
// and writes only the difference: the stamped glosses trimmed or dropped, the
// stated gender and number claims added, the 'missing' rows they answer
// removed. `source_record_json` is read, never written (ADR 0019).

import { GLOSS_GRAMMAR_STAMP_RULE, STAMPED_GLOSS_GLOBS } from "../italian/glossGrammarStamp.js";
import { glossStampLiftOf, italianRecordOf, stampedGlossRows } from "./importRelease.js";
import type { DictionarySql } from "./normalizeGlosses.js";

/** What the update found and did. */
export interface GlossStampReport {
  readonly rule: typeof GLOSS_GRAMMAR_STAMP_RULE;
  /** Records the GLOBs selected, whether or not the rule takes them. */
  readonly candidates: number;
  /** Rows this run changed, by table; all 0 on a database already up to date. */
  readonly changed: { readonly sense_gloss: number; readonly grammar_claim: number };
}

const quoted = (value: string): string => `'${value.replaceAll("'", "''")}'`;

interface Candidate {
  record_id: number;
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

interface Plan {
  readonly candidates: number;
  readonly glossStatements: string[];
  readonly claimStatements: string[];
}

/**
 * Candidates: a noun or adjective with a gloss that may end in a stamp, or one
 * already holding a claim lifted off a gloss, so a second run reads the same
 * records back and finds them done.
 */
function candidates(db: DictionarySql): Candidate[] {
  const stampLike = STAMPED_GLOSS_GLOBS.map((glob) => `g.text GLOB ${quoted(glob)}`).join(" OR ");
  return db.query<Candidate>(
    `SELECT r.record_id, j.raw_json
       FROM source_record r JOIN source_record_json j ON j.record_id = r.record_id
      WHERE r.pos IN ('noun', 'adj') AND r.record_id IN (
              SELECT s.record_id FROM sense_gloss g JOIN sense s ON s.sense_id = g.sense_id WHERE ${stampLike}
              UNION
              SELECT record_id FROM grammar_claim
               WHERE scope = 'record' AND status = 'stated' AND json_pointer GLOB '/senses/*/glosses/*')
      ORDER BY r.record_id`,
  );
}

function plan(db: DictionarySql): Plan {
  const found = candidates(db);
  const glossStatements: string[] = [];
  const claimStatements: string[] = [];
  if (found.length === 0) return { candidates: 0, glossStatements, claimStatements };

  const ids = found.map(({ record_id }) => record_id).join(", ");
  const glosses = db.query<GlossRow>(
    `SELECT s.record_id, g.gloss_id, g.json_pointer, g.text
       FROM sense_gloss g JOIN sense s ON s.sense_id = g.sense_id
      WHERE s.record_id IN (${ids})`,
  );
  const claims = db.query<ClaimRow>(
    `SELECT record_id, json_pointer, status, dimension FROM grammar_claim
      WHERE scope = 'record' AND record_id IN (${ids})`,
  );

  for (const { record_id: recordId, raw_json: rawJson } of found) {
    const record = italianRecordOf(rawJson);
    if (record === undefined) continue;
    const lift = glossStampLiftOf(record);

    for (const { pointer, stored } of stampedGlossRows(lift)) {
      const row = glosses.find((gloss) => gloss.record_id === recordId && gloss.json_pointer === pointer);
      if (row === undefined || row.text === stored) continue;
      const where = `WHERE gloss_id = ${row.gloss_id} AND text = ${quoted(row.text)}`;
      glossStatements.push(
        stored === undefined
          ? `DELETE FROM sense_gloss ${where};`
          : `UPDATE sense_gloss SET text = ${quoted(stored)} ${where};`,
      );
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
    }
    for (const dimension of new Set(lifted.map((claim) => claim.dimension))) {
      const missing = claims.some((row) =>
        row.record_id === recordId && row.status === "missing" && row.dimension === dimension);
      if (!missing) continue;
      claimStatements.push(
        `DELETE FROM grammar_claim WHERE record_id = ${recordId} AND scope = 'record' AND status = 'missing' AND dimension = ${quoted(dimension)};`,
      );
    }
  }
  return { candidates: found.length, glossStatements, claimStatements };
}

/**
 * Apply the gloss grammar stamp rule to an already seeded dictionary, then
 * read it back. Each statement names the row state it replaces, so a row that
 * changed in between is left alone and a second run finds nothing to do.
 * Throws when anything is still pending afterwards.
 */
export function liftStoredGlossStamps(db: DictionarySql): GlossStampReport {
  const before = plan(db);
  const statements = [...before.glossStatements, ...before.claimStatements];
  if (statements.length > 0) db.run(statements.join("\n"));
  const after = plan(db);
  const pending = after.glossStatements.length + after.claimStatements.length;
  if (pending > 0) {
    throw new Error(`${pending} change(s) of ${GLOSS_GRAMMAR_STAMP_RULE} still pending after the update`);
  }
  return {
    rule: GLOSS_GRAMMAR_STAMP_RULE,
    candidates: before.candidates,
    changed: { sense_gloss: before.glossStatements.length, grammar_claim: before.claimStatements.length },
  };
}
