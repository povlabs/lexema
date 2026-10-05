// One search, as the page runs it: the exact lookup; when it finds nothing, a
// word only form-of records name (#453); and when that has no table either,
// what to offer instead. A word found also carries the headwords that write it
// with an accent or apostrophe it lacks (#478), and the records of the lemmas
// whose grids its noun and adjective forms show (#626). Free of the Workers runtime, so the page test runs the
// same code over a local database.

import type { LookupDatabase } from "@lexema/lookup/database.ts";
import type { Reading } from "@lexema/lookup/types.ts";
import { declaredLemma } from "@lexema/lookup/declaredLemma.ts";
import { lookup } from "@lexema/lookup/lookup.ts";
import { findNearby, writtenSpellings } from "@lexema/lookup/nearby.ts";
import type { Attempt } from "./attempt.ts";
import { declaredLemmaPage } from "./declaredLemmaPage.ts";
import { gridLemmaWords } from "./wordPage.ts";

export async function searchAttempt(db: LookupDatabase, releaseId: string, query: string): Promise<Attempt> {
  const result = await lookup({ db, releaseId, query });
  const written = () => writtenSpellings({ db, releaseId, query: result.query.raw });
  if (result.outcome === "found") {
    const [spellings, lemmas] = await Promise.all([written(), lemmaRecords(db, releaseId, result.readings)]);
    return { ...result, written: spellings, lemmas };
  }
  if (result.outcome !== "not-found") return result;
  const declared = await declaredLemma(db, releaseId, result);
  const page = declared === undefined ? undefined : declaredLemmaPage(declared);
  if (declared !== undefined && page !== undefined) return { ...declared, page, written: await written() };
  return { ...result, nearby: await findNearby({ db, releaseId, query: result.query.raw }) };
}

/**
 * The records of the words `gridLemmaWords` names, each read by the same
 * lookup a search of that word runs: a lemma grid is drawn from the lemma's
 * own record, exactly as the lemma's page draws it. Nothing is read for a page
 * with no noun or adjective form.
 */
async function lemmaRecords(db: LookupDatabase, releaseId: string, readings: readonly Reading[]): Promise<Reading[]> {
  const found = await Promise.all(gridLemmaWords(readings).map((word) => lookup({ db, releaseId, query: word })));
  return found.flatMap((result) => (result.outcome === "found" ? result.readings.filter((reading) => reading.isAboutQuery) : []));
}
