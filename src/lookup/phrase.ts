// The multi-word headwords a query spells word by word (#214): what the index
// says about each word, read for rule `it-phrase/v1` (src/italian/phrase.ts).
//
// They are offered, never answered: a search that found nothing shows them as
// "Did you mean andare via?" (src/lookup/nearby.ts; Huey's ruling on #214,
// 2026-09-30). Every read is an indexed probe by key, and the lemma sequences
// are probed as exact headword keys, so a sequence that is not a stored
// headword finds nothing: no partial phrase, no ranking, no headword that is
// not in the release.

import {
  lemmaSequences,
  MAX_PHRASE_WORDS,
  participleCandidates,
  phraseSlots,
  type WordLemmas,
} from "../italian/phrase.js";
import type { LookupDatabase } from "./database.js";

/**
 * A word's lemmas: itself when it is a headword, and the word every form-of
 * edge on its headword records names — the edge `vado` declares to `andare`.
 * Exported so a test can assert the plan.
 */
export const WORD_LEMMA_SQL = `SELECT lf.surface_key AS lemma
       FROM lookup_form lf
      WHERE lf.release_id = ? AND lf.surface_key = ? AND lf.origin = 'headword'
     UNION
     SELECT e.target_word_key AS lemma
       FROM lookup_form lf
       JOIN form_of_edge e ON e.record_id = lf.record_id
      WHERE lf.release_id = ? AND lf.surface_key = ? AND lf.origin = 'headword'`;

/**
 * The verbs whose own table lists a spelling as their past participle: a
 * `forms[]` entry of a verb record the source tags both `participle` and
 * `past`. `andato` is `andare`'s. Exported so a test can assert the plan.
 */
export const PAST_PARTICIPLE_SQL = `SELECT DISTINCT hw.surface_key AS verb
       FROM lookup_form lf
       JOIN source_record r ON r.record_id = lf.record_id AND r.pos = 'verb'
       JOIN lookup_form hw ON hw.record_id = lf.record_id AND hw.origin = 'headword'
      WHERE lf.release_id = ? AND lf.surface_key = ? AND lf.origin = 'embedded-form'
        AND EXISTS (
              SELECT 1 FROM grammar_claim g
               WHERE g.record_id = lf.record_id
                 AND g.scope = 'form' AND g.scope_index = lf.form_index
                 AND g.status = 'stated' AND g.dimension = 'mood' AND g.value = 'participle')
        AND EXISTS (
              SELECT 1 FROM grammar_claim g
               WHERE g.record_id = lf.record_id
                 AND g.scope = 'form' AND g.scope_index = lf.form_index
                 AND g.status = 'stated' AND g.dimension = 'tense' AND g.value = 'past')`;

/** How many keys one headword probe binds, under D1's limit of 100 bound values. */
const PROBE_CHUNK = 90;

/** Which of the keys are headwords. Exported so a test can assert the plan. */
export const headwordKeySql = (count: number): string =>
  `SELECT DISTINCT surface_key
       FROM lookup_form
      WHERE release_id = ? AND origin = 'headword'
        AND surface_key IN (${Array.from({ length: count }, () => "?").join(", ")})`;

async function lemmasOf(db: LookupDatabase, releaseId: string, word: string): Promise<string[]> {
  const rows = await db.all<{ lemma: string }>(WORD_LEMMA_SQL, [releaseId, word, releaseId, word]);
  const others = rows.map((row) => row.lemma).filter((lemma) => lemma !== word).sort();
  // The word itself first, when it is a headword, then its lemmas in key order.
  return rows.some((row) => row.lemma === word) ? [word, ...others] : others;
}

/**
 * The verbs a word is the past participle of: through its own spelling, or
 * through a word it is a form of — `andati` names `andato`, which is
 * `andare`'s past participle.
 */
async function participleVerbs(db: LookupDatabase, releaseId: string, word: WordLemmas): Promise<string[]> {
  const spellings = [...new Set([word.typed, ...word.lemmas])];
  const verbs = await Promise.all(
    spellings.map((spelling) => db.all<{ verb: string }>(PAST_PARTICIPLE_SQL, [releaseId, spelling])),
  );
  return [...new Set(verbs.flat().map((row) => row.verb))].sort();
}

async function headwordKeys(db: LookupDatabase, releaseId: string, keys: readonly string[]): Promise<Set<string>> {
  const present = new Set<string>();
  for (let from = 0; from < keys.length; from += PROBE_CHUNK) {
    const chunk = keys.slice(from, from + PROBE_CHUNK);
    const rows = await db.all<{ surface_key: string }>(headwordKeySql(chunk.length), [releaseId, ...chunk]);
    for (const row of rows) present.add(row.surface_key);
  }
  return present;
}

/**
 * Every multi-word headword the query's words spell, as keys, in the order the
 * lemma sequences were tried. The query's own key is never one: a query that
 * is a headword is the exact lookup's. Empty when the query is one word, more
 * than `MAX_PHRASE_WORDS`, more than `MAX_PHRASE_PROBES` sequences, or spells
 * no headword.
 *
 * `key` is the query as normalized for the index.
 */
export async function phraseHeadwords(db: LookupDatabase, releaseId: string, key: string): Promise<string[]> {
  const typed = key.split(/\s+/).filter((word) => word !== "");
  if (typed.length < 2 || typed.length > MAX_PHRASE_WORDS) return [];

  const words = await Promise.all(
    typed.map(async (word): Promise<WordLemmas> => ({ typed: word, lemmas: await lemmasOf(db, releaseId, word) })),
  );
  const participles = new Map(
    await Promise.all(
      participleCandidates(words).map(async (index) => [index, await participleVerbs(db, releaseId, words[index])] as const),
    ),
  );
  const slots = phraseSlots(words, (index) => participles.get(index) ?? []);
  // Only a multi-word headword: a compound tense alone (`sono andati`) is one
  // slot, and its verb is a single word the exact lookup answers for.
  if (slots.length < 2) return [];
  const sequences = lemmaSequences(slots);
  if (sequences === undefined || sequences.length === 0) return [];

  const spelled = [...new Set(sequences.map((sequence) => sequence.join(" ")))].filter((phrase) => phrase !== key);
  const present = await headwordKeys(db, releaseId, spelled);
  return spelled.filter((phrase) => present.has(phrase));
}
