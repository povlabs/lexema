// Source text normalization (ADR 0019): fixed rewrites of source-derived text,
// so one meaning reads one way across the dictionary. The seed applies them to
// the structured rows, and a one-off update applies the same function to a
// database seeded before a rule existed (src/import/normalizeGlosses.ts). The
// raw line in `source_record_json` never passes through here. This is not the
// search normalization in normalize.ts, which only builds lookup keys.

const ORDINAL_PERSON = /^([123])ª(?= persona(?!\p{L}))/u;
const ORDINAL_WORD = { "1": "prima", "2": "seconda", "3": "terza" } as const;

/**
 * A gloss as Lexema stores it. #257: a gloss opening "1ª/2ª/3ª persona" opens
 * "prima/seconda/terza persona", the way 499,427 glosses of release
 * `it-0c432803` already do; 177 did not. Only the opening ordinal changes, and
 * only before " persona"; a "1ª" anywhere else in the gloss stays as written.
 */
export function normalizeGloss(text: string): string {
  return text.replace(ORDINAL_PERSON, (_, digit: keyof typeof ORDINAL_WORD) => ORDINAL_WORD[digit]);
}

/**
 * A SQLite GLOB that matches every stored gloss `normalizeGloss` would change,
 * and possibly more. The one-off update reads only these rows and lets
 * `normalizeGloss` decide, so the rule is written once.
 */
export const NORMALIZABLE_GLOSS_GLOB = "[123]ª persona*";
