// Reaching the deployed D1 database from a plain Node process.
//
// The Worker gets D1 as a binding, which only exists inside a request. The gate
// has to run *before* a release is activated, from an operator's terminal, and
// against the very database the Worker will read — checking a local copy and
// then activating the original is not checking anything.
//
// So this speaks D1's HTTP query API, which takes the same SQL and the same
// bound parameters, and hands back a LookupDatabase. The gate cannot tell the
// difference, which is the point: one gate, both databases.

import type { LookupDatabase } from "../lookup/database.js";

export interface D1HttpOptions {
  accountId: string;
  databaseId: string;
  /** A Cloudflare API token with D1 edit permission on this account. */
  apiToken: string;
  /** Overridable for tests. */
  fetchImpl?: typeof fetch;
}

interface D1QueryResponse<T> {
  success: boolean;
  errors?: { code: number; message: string }[];
  result?: { results?: T[] }[];
}

/**
 * The deployed database, reached over HTTPS.
 *
 * Parameters stay bound rather than interpolated: the queries carry Italian
 * surfaces and release ids straight from operator input, and string-building
 * SQL for a one-off admin tool is how a quoting bug becomes a dropped table.
 */
export function fromD1Http({
  accountId,
  databaseId,
  apiToken,
  fetchImpl = fetch,
}: D1HttpOptions): LookupDatabase {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

  return {
    async all<T>(sql: string, params: readonly (string | number)[]): Promise<T[]> {
      const response = await fetchImpl(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ sql, params }),
      });

      const body = (await response.json()) as D1QueryResponse<T>;
      if (!response.ok || !body.success) {
        const reason =
          body.errors?.map((error) => `${error.code}: ${error.message}`).join("; ") ??
          `HTTP ${response.status}`;
        throw new Error(`D1 query failed (${reason})`);
      }
      // One statement in, so one result set out.
      return body.result?.[0]?.results ?? [];
    },
  };
}
