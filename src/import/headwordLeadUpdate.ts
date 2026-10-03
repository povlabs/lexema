// The one-off update for a dictionary seeded before rule
// `gloss-headword-lead/v1` (#325, ADR 0019). It rewrites the stored glosses
// the seed now writes without their headword lead, with the same
// `withoutHeadwordLead`, and touches no other table: `source_record_json`
// keeps the source's wording.

import { HEADWORD_LEAD_GLOSS_GLOB, SOURCE_TEXT_RULES, withoutHeadwordLead } from "../italian/sourceTextNormalization.js";
import { type DictionarySql, type GlossRewriteReport, planGlossRewrite, type RulePlanner, runRuleAlone } from "./sourceTextUpdate.js";

/** What the update found and did. */
export type HeadwordLeadReport = GlossRewriteReport<typeof SOURCE_TEXT_RULES.headwordLeadGloss>;

/** Plan rewriting every gloss `withoutHeadwordLead` would change, as the earlier rules leave it. */
export const planHeadwordLeads: RulePlanner<HeadwordLeadReport> = (db, glosses) =>
  planGlossRewrite(db, glosses, { rule: SOURCE_TEXT_RULES.headwordLeadGloss, glob: HEADWORD_LEAD_GLOSS_GLOB, rewrite: withoutHeadwordLead });

/**
 * Rewrite every stored gloss `withoutHeadwordLead` would change, then read the
 * rows back. Each UPDATE names the text it replaces, so a row that changed in
 * between is left alone, and a second run finds nothing to do. Throws when a
 * row still needs the rewrite afterwards.
 */
export const dropStoredHeadwordLeads = (db: DictionarySql): HeadwordLeadReport => runRuleAlone(db, planHeadwordLeads);
