// One search, as the page runs it: the exact lookup, and when it finds
// nothing, what to offer instead. Free of the Workers runtime, so the page
// test runs the same code over a local database.

import type { LookupDatabase } from "@lexema/lookup/database.ts";
import { lookup } from "@lexema/lookup/lookup.ts";
import { findNearby } from "@lexema/lookup/nearby.ts";
import type { Attempt } from "./attempt.ts";

export async function searchAttempt(db: LookupDatabase, releaseId: string, query: string): Promise<Attempt> {
  const result = await lookup({ db, releaseId, query });
  if (result.outcome !== "not-found") return result;
  return { ...result, nearby: await findNearby({ db, releaseId, query: result.query.raw }) };
}
