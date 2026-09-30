// What every endpoint of the JSON API is handed and what it hands back (#150,
// #152). The handler (./handler.ts) owns the key, the limits and the charge;
// an endpoint (./endpoints.ts) owns only its answer.

import type { Charge } from "@lexema/api/calls.ts";
import type { AppTables } from "@lexema/db/app/database.ts";
import type { LookupDatabase } from "@lexema/lookup/database.ts";

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
}

/**
 * What an endpoint answers. A refusal is a 400 and costs nothing; any other
 * answer did the endpoint's work, found or not, and carries its charge.
 */
export type Answer =
  | { status: 400; body: ErrorJson; charge?: never }
  | { status: 200 | 404; body: unknown; charge: Charge };

/** The error body every refusal carries. */
export interface ErrorJson {
  error: { code: string; message: string };
}

export const error = (code: string, message: string): ErrorJson => ({ error: { code, message } });

/** A 400 for a request whose parameters or body could not be read. */
export const refused = (code: string, message: string): Answer => ({ status: 400, body: error(code, message) });

/** What an endpoint does with a request it was routed. */
export type Route = (request: Request, url: URL, context: ApiContext) => Promise<Answer>;
