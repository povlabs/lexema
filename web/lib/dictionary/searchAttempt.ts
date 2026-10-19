// One search, as the page runs it: the exact lookup, which itself answers a
// word only form-of records name (a declared lemma, #453, #818); when it finds
// only a shape of another word (#809), a declared lemma of the query before
// that shape; and when nothing has a table, what to offer instead. A word found also carries the headwords that write it
// with an accent or apostrophe it lacks (#478), the records of the lemmas
// whose grids its noun and adjective forms show (#626), the definitions of
// the verbs its verb forms name (#686), and, for a verb whose records draw no
// conjugation, the verb forms its form records declare (#799) and, for a
// pronominal one, its base verb's records (#837), and, for a verb form whose
// verb's records draw no table, that verb's records (#852), all in one wait. Free of the Workers runtime, so the page test runs the
// same code over a local database.

import { normalizeItalianExact } from "@lexema/italian/normalize.ts";
import type { LookupDatabase } from "@lexema/lookup/database.ts";
import type { Reading } from "@lexema/lookup/types.ts";
import { declaredLemma, declaredVerbForms } from "@lexema/lookup/declaredLemma.ts";
import { lookup, withVerbDefinitions } from "@lexema/lookup/lookup.ts";
import { findNearby, writtenSpellings } from "@lexema/lookup/nearby.ts";
import { dictionaryTables } from "@lexema/lookup/served.ts";
import type { Attempt } from "./attempt.ts";
import { declaredLemmaPage } from "./declaredLemmaPage.ts";
import { builtTableVerbWords, gridLemmaWords, pronominalBaseWords, wantsDeclaredConjugation, type VerbRecords } from "./wordPage.ts";

export async function searchAttempt(db: LookupDatabase, releaseId: string, query: string): Promise<Attempt> {
  // The tables are read beside the lookup, which reads them too: one statement in its first call.
  const [result, tables] = await Promise.all([lookup({ db, releaseId, query }), dictionaryTables(db)]);
  // A word typed without its final accent opens the headword's own page
  // (#846): what that page reads for its word, it reads for the headword, so
  // it offers no accent the query lacked and says nothing of how it was reached.
  const word = result.outcome === "found" && result.route.kind === "accentless" ? result.route.headword : result.query.raw;
  const written = () => writtenSpellings({ db, releaseId, query: word });
  if (result.outcome === "found") {
    const [spellings, lemmas, readings, declared, bases, verbs, shapedLemma] = await Promise.all([
      written(),
      lemmaRecords(db, releaseId, result.readings),
      withVerbDefinitions(db, result.readings, tables),
      wantsDeclaredConjugation(result.readings) ? declaredVerbForms(db, releaseId, normalizeItalianExact(word)) : undefined,
      baseRecords(db, releaseId, pronominalBaseWords(result.readings)),
      verbRecords(db, releaseId, builtTableVerbWords(result.readings)),
      // A word the page answers as a declared lemma keeps that page: rule
      // `it-word-shape/v1` answers only what nothing else does (#809), so
      // `aggrapparsi` stays itself, not a clitic form of `aggrappare`.
      result.route.kind === "shape" ? declaredLemma(db, releaseId, { outcome: "not-found", query: result.query, release: result.release }) : undefined,
    ]);
    const shapedPage = shapedLemma === undefined ? undefined : declaredLemmaPage(shapedLemma);
    if (shapedLemma !== undefined && shapedPage !== undefined) return { ...shapedLemma, page: shapedPage, written: spellings };
    return { ...result, readings, written: spellings, lemmas, declared: declared ?? [], bases, verbs };
  }
  if (result.outcome === "rejected") return result;
  // The lookup answers a declared lemma itself (#818); one whose forms take
  // no cell has no page, so the search shows what it would for nothing found.
  const page = result.outcome === "declared-lemma" ? declaredLemmaPage(result) : undefined;
  if (result.outcome === "declared-lemma" && page !== undefined) return { ...result, page, written: await written() };
  return { outcome: "not-found", query: result.query, release: result.release, nearby: await findNearby({ db, release: result.release, query: result.query.raw }) };
}

/**
 * The records about each of `words`, in order, each read by the same lookup a
 * search of that word runs: a pronominal verb's table is built from its base
 * verb's own record, as the base verb's page reads it (#837). Nothing is read
 * when `words` is empty, as it is for any page but a pronominal verb's.
 */
async function baseRecords(db: LookupDatabase, releaseId: string, words: readonly string[]): Promise<Reading[]> {
  const found = await Promise.all(words.map((word) => lookup({ db, releaseId, query: word })));
  return found.flatMap((result) => (result.outcome === "found" ? result.readings.filter((reading) => reading.isAboutQuery) : []));
}

/**
 * The records of each of `words`, verbs a verb form names, as a search of the
 * verb reads them, with its base verbs' (`baseRecords`): what the verb's own
 * page builds its table from, so a form of it draws the same one (#852).
 * Nothing is read when `words` is empty.
 */
async function verbRecords(db: LookupDatabase, releaseId: string, words: readonly string[]): Promise<VerbRecords[]> {
  return Promise.all(
    words.map(async (word) => {
      const readings = await baseRecords(db, releaseId, [word]);
      return { word, readings, bases: await baseRecords(db, releaseId, pronominalBaseWords(readings)) };
    }),
  );
}

/** How many rounds of reads a chain of forms may take: `bellissima` reads `bellissimo`, then `bello`. */
const LEMMA_ROUNDS = 4;

/**
 * The records of the words `gridLemmaWords` names, each read by the same
 * lookup a search of that word runs: a lemma grid is drawn from the lemma's
 * own record, exactly as the lemma's page draws it. A word that is itself a
 * form names the next word to read, so a chain takes one more wait per link
 * (#695). Nothing is read for a page with no noun or adjective form.
 */
async function lemmaRecords(db: LookupDatabase, releaseId: string, readings: readonly Reading[]): Promise<Reading[]> {
  const asked = new Set<string>();
  const records: Reading[] = [];
  for (let round = 0; round < LEMMA_ROUNDS; round++) {
    const words = gridLemmaWords(readings, records).filter((word) => !asked.has(word));
    if (words.length === 0) break;
    for (const word of words) asked.add(word);
    const found = await Promise.all(words.map((word) => lookup({ db, releaseId, query: word })));
    records.push(...found.flatMap((result) => (result.outcome === "found" ? result.readings.filter((reading) => reading.isAboutQuery) : [])));
  }
  return records;
}
