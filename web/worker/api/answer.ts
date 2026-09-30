// What every endpoint of the JSON API is handed and what it hands back (#150,
// #152). The handler (./handler.ts) owns the key, the limits and the charge;
// an endpoint (./endpoints.ts) owns only reading its request and its answer.
// It reads the request before any call is counted, so a request it cannot read
// costs nothing and a batch's calls are known before the minute counts them
// (#216, #261).

import type { Charge } from "@lexema/api/calls.ts";
import type { AppTables } from "@lexema/db/app/database.ts";
import type { LookupDatabase } from "@lexema/lookup/database.ts";
import type { Metering } from "./metering.ts";

/** What one request needs from the Worker around it. */
export interface ApiContext {
  /** The dictionary, read-only through its raw SQL. */
  db: LookupDatabase;
  /** The app database: the key and usage tables, through Drizzle. */
  appDb: AppTables;
  /** The release this Worker serves. */
  releaseId: string;
  /** The server's clock, milliseconds since the epoch. */
  now: number;
  /** An owned key's account meter and rate bindings. */
  metering: Metering;
}

/** What an endpoint answers once a request is read and its calls admitted: found (200) or not (404), the work done either way. */
export interface Answer {
  status: 200 | 404;
  body: unknown;
}

/** The error body every refusal carries. */
export interface ErrorJson {
  error: { code: string; message: string };
}

export const error = (code: string, message: string): ErrorJson => ({ error: { code, message } });

/**
 * A request as an endpoint reads it, before any lookup: refused (a 400, which
 * costs nothing), or read, with the calls it will be charged and the work that
 * answers it.
 */
export type Reading =
  | { outcome: "refused"; body: ErrorJson }
  | { outcome: "read"; charge: Charge; answer: (context: ApiContext) => Promise<Answer> };

/** A 400 for a request whose parameters or body could not be read. */
export const refused = (code: string, message: string): Reading => ({ outcome: "refused", body: error(code, message) });

/** A request read: what it is charged, and how it is answered. */
export const read = (charge: Charge, answer: (context: ApiContext) => Promise<Answer>): Reading => ({ outcome: "read", charge, answer });

/** What a key's reading is bounded by: the most words its batch takes, its calls a minute (#216). */
export interface ReadingLimits {
  batchWords: number;
}

/** What an endpoint does with a request it was routed. */
export type Route = (request: Request, url: URL, limits: ReadingLimits) => Promise<Reading>;
