// The one-off update for a dictionary seeded before rule
// `gloss-web-address/v1` (#872, ADR 0019). It rewrites the stored glosses the
// seed now writes without their web addresses, with the same
// `withoutWebAddresses`, and touches no other table: `source_record_json`
// keeps the source's wording.

import { SOURCE_TEXT_RULES, WEB_ADDRESS_GLOSS_GLOB, withoutWebAddresses } from "../italian/sourceTextNormalization.js";
import { type DictionarySql, type GlossRewriteReport, planGlossRewrite, type RulePlanner, runRuleAlone } from "./sourceTextUpdate.js";

/** What the update found and did. */
export type WebAddressReport = GlossRewriteReport<typeof SOURCE_TEXT_RULES.webAddressGloss>;

/** Plan rewriting every gloss `withoutWebAddresses` would change, as the earlier rules leave it. */
export const planWebAddresses: RulePlanner<WebAddressReport> = (db, glosses) =>
  planGlossRewrite(db, glosses, { rule: SOURCE_TEXT_RULES.webAddressGloss, glob: WEB_ADDRESS_GLOSS_GLOB, rewrite: (_, text) => withoutWebAddresses(text) });

/**
 * Rewrite every stored gloss `withoutWebAddresses` would change, then read the
 * rows back. Each UPDATE names the text it replaces, so a row that changed in
 * between is left alone, and a second run finds nothing to do. Throws when a
 * row still needs the rewrite afterwards.
 */
export const dropStoredWebAddresses = (db: DictionarySql): WebAddressReport => runRuleAlone(db, planWebAddresses);
