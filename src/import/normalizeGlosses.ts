// The one-off update for a dictionary seeded before a source text
// normalization existed (ADR 0019, #257). It rewrites the stored glosses the
// seed now writes normalized, with the same `normalizeGloss`, and touches no
// other table: `source_record_json` keeps the source's wording.

import { NORMALIZABLE_GLOSS_GLOB, SOURCE_TEXT_RULES, normalizeGloss } from "../italian/sourceTextNormalization.js";
import { type DictionarySql, type GlossRewriteReport, planGlossRewrite, type RulePlanner, runRuleAlone } from "./sourceTextUpdate.js";

export type { DictionarySql } from "./sourceTextUpdate.js";

/** What the update found and did. */
export type GlossNormalizationReport = GlossRewriteReport<typeof SOURCE_TEXT_RULES.personOrdinalGloss>;

/** Plan rewriting every gloss `normalizeGloss` would change, as the earlier rules leave it. */
export const planPersonOrdinals: RulePlanner<GlossNormalizationReport> = (db, glosses) =>
  planGlossRewrite(db, glosses, { rule: SOURCE_TEXT_RULES.personOrdinalGloss, glob: NORMALIZABLE_GLOSS_GLOB, rewrite: (_, text) => normalizeGloss(text) });

/**
 * Rewrite every stored gloss `normalizeGloss` would change, then read the rows
 * back. Each UPDATE names the text it replaces, so a row that changed in
 * between is left alone, and a second run finds nothing to do. Throws when a
 * row still needs the rewrite afterwards.
 */
export const normalizeStoredGlosses = (db: DictionarySql): GlossNormalizationReport => runRuleAlone(db, planPersonOrdinals);
