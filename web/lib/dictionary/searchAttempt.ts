// One search, as the page runs it: the exact lookup; when it finds nothing, a
// word only form-of records name (#453); and when that has no table either,
// what to offer instead. Free of the Workers runtime, so the page test runs the
// same code over a local database.

import type { LookupDatabase } from "@lexema/lookup/database.ts";
import { declaredLemma } from "@lexema/lookup/declaredLemma.ts";
import { lookup } from "@lexema/lookup/lookup.ts";
import { findNearby } from "@lexema/lookup/nearby.ts";
import type { Attempt } from "./attempt.ts";
import { declaredLemmaPage } from "./declaredLemmaPage.ts";

export async function searchAttempt(db: LookupDatabase, releaseId: string, query: string): Promise<Attempt> {
  const result = await lookup({ db, releaseId, query });
  if (result.outcome !== "not-found") return result;
  const declared = await declaredLemma(db, releaseId, result);
  const page = declared === undefined ? undefined : declaredLemmaPage(declared);
  if (declared !== undefined && page !== undefined) return { ...declared, page };
  return { ...result, nearby: await findNearby({ db, releaseId, query: result.query.raw }) };
}
