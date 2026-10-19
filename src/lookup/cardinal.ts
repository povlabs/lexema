// The last step of a lookup (ADR 0034, #804): a spelled Italian cardinal up
// to 999.999 that nothing else answers, the source, the readings beside it or
// the headword an accentless query opens, gets one reading rule
// `it-cardinal/v1` builds (src/italian/cardinal.ts): `duemilauno`, defined as
// "numero cardinale corrispondente a 2001". A spelling the source lists
// (`cinquantanove`) never gets one, and nor does a word whose page answers it
// as a declared lemma (#453), which is a Wiktionary reading too. `lookup()`,
// `exists()` and `lookupBatch()` all read it here, so the three agree.

import { CARDINAL_POS, parseItalianCardinal, type ItalianCardinal } from "../italian/cardinal.js";
import { readingPartOfSpeech } from "./articles.js";
import type { LookupDatabase } from "./database.js";
import { isDeclaredLemma } from "./declaredLemma.js";
import { NO_ENTRY_FACTS } from "./pageFacts.js";
import type { DictionaryTables } from "./served.js";
import type { CardinalRef, Reading } from "./types.js";

/**
 * The cardinal `key` spells, for a key nothing else answers, or none: none
 * when it spells no cardinal of the rule, or the page answers it as a
 * declared lemma. The declared lemma is read only for a key that spells one.
 */
export async function unansweredCardinal(
  db: LookupDatabase,
  releaseId: string,
  tables: Pick<DictionaryTables, "corrections" | "edgeCorrections">,
  key: string,
): Promise<ItalianCardinal | undefined> {
  const cardinal = parseItalianCardinal(key);
  if (cardinal === undefined || (await isDeclaredLemma(db, releaseId, key, tables))) return undefined;
  return cardinal;
}

/**
 * A rule-built cardinal as a reading of `key`: the key as its word, the part
 * of speech the source files its numerals under, and, through its cardinal,
 * the one fixed Lexema definition (`cardinalDefinition`). It states no
 * grammar, no form and no other fact, and it is about the query.
 */
export function cardinalReading(releaseId: string, key: string, cardinal: ItalianCardinal): Reading {
  const ref: CardinalRef = { releaseId, rule: cardinal.rule, value: cardinal.value };
  const { forms, wordFacts, lemmaLinks } = NO_ENTRY_FACTS;
  return {
    cardinal, ref, word: key,
    ...readingPartOfSpeech(CARDINAL_POS.pos, key, []), posTitle: CARDINAL_POS.posTitle,
    isAboutQuery: true, evidence: [], senses: [], recovered: [], forms, wordFacts, translations: [],
    grammar: { record: [], byForm: new Map(), bySense: new Map() },
    lemmaLinks, inflections: [], reviews: [],
  };
}
