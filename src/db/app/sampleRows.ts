// One valid row for every app table (#330). SQLite runs a CHECK only when a row
// is written, and D1 refuses some patterns there that node:sqlite accepts: a
// long GLOB passed CREATE TABLE and every unit test, and failed on D1's first
// insert (#167). So CI's `d1` job writes these rows into a fresh local D1
// (`pnpm run db:check-d1`, ./sampleRowsCli.ts), and test/sampleRows.test.ts
// writes them on node:sqlite.
//
// Each row takes the branch of every CHECK that runs its pattern or function:
// a nullable column a CHECK tests is filled, so `x IS NULL OR ...` reaches the
// part after OR.

import { getTableName, type InferInsertModel } from "drizzle-orm";
import { getTableConfig, type SQLiteTable } from "drizzle-orm/sqlite-core";
import type { AppDatabase } from "./database.js";
import * as schema from "./schema.js";

type Schema = typeof schema;

/** A valid row for each table in ./schema.ts: a table with none does not compile. */
type SampleRowsByTable = { readonly [K in keyof Schema]: InferInsertModel<Schema[K]> };

const at = (iso: string) => new Date(iso);
const SHA256_A = "a".repeat(64);
const SHA256_B = "b".repeat(64);

const ROWS: SampleRowsByTable = {
  developerAccount: {
    id: 1,
    name: "Sample Developer",
    email: "sample@example.com",
    emailVerified: true,
    image: null,
    createdAt: at("2026-10-01T00:00:00.000Z"),
    updatedAt: at("2026-10-01T00:00:00.000Z"),
    stripeCustomerId: "cus_sample",
  },
  providerIdentity: {
    id: 1,
    userId: 1,
    providerId: "github",
    accountId: "1",
    email: "sample@example.com",
    displayName: "Sample Developer",
    createdAt: at("2026-10-01T00:00:00.000Z"),
    updatedAt: at("2026-10-01T00:00:00.000Z"),
  },
  developerSession: {
    id: 1,
    token: "sample-session-token",
    userId: 1,
    expiresAt: at("2026-10-08T00:00:00.000Z"),
    createdAt: at("2026-10-01T00:00:00.000Z"),
    updatedAt: at("2026-10-01T00:00:00.000Z"),
  },
  verification: {
    id: 1,
    identifier: "sample-state",
    value: "sample-verifier",
    expiresAt: at("2026-10-01T00:10:00.000Z"),
    createdAt: at("2026-10-01T00:00:00.000Z"),
    updatedAt: at("2026-10-01T00:00:00.000Z"),
  },
  apiKey: {
    keyId: 1,
    keyHash: SHA256_A,
    label: "sample",
    perMinuteLimit: 1,
    createdAt: "2026-10-01T00:00:00.000Z",
    ownerAccountId: null,
    displayPrefix: "lx_0123abcd",
    endpoints: '["lookup"]',
    expiresAt: "2026-11-01T00:00:00.000Z",
  },
  apiKeyMinute: { keyId: 1, minute: 29_323_440, requests: 1 },
  apiKeyUsage: { keyId: 1, day: "2026-10-01", calls: 1 },
  subscription: {
    id: 1,
    plan: "starter",
    referenceId: "1",
    stripeCustomerId: "cus_sample",
    stripeSubscriptionId: "sub_sample",
    status: "active",
    periodStart: at("2026-10-01T00:00:00.000Z"),
    periodEnd: at("2026-11-01T00:00:00.000Z"),
    cancelAtPeriodEnd: false,
    seats: 1,
  },
  enterprisePlan: {
    id: 1,
    accountId: 1,
    callsPerPeriod: 1,
    callsPerMinute: 1,
    periodStart: at("2026-10-01T00:00:00.000Z"),
    periodEnd: at("2026-11-01T00:00:00.000Z"),
  },
  planNotice: { stripeSubscriptionId: "sub_sample", accountId: 1, plan: "starter", state: "active" },
  readerReport: {
    reportId: 1,
    releaseId: "it-dev",
    word: "casa",
    recordId: 1,
    lineNo: 1,
    lineSha256: SHA256_B,
    choice: "meaning",
    // Answered, so its note is erased: one row cannot hold both a note and an answer.
    details: null,
    visitorHash: SHA256_A,
    receivedAt: "2026-10-01T00:00:00.000Z",
    outcome: "sample answer",
    reviewedAt: "2026-10-02T00:00:00.000Z",
    reviewedBy: "sample",
  },
  reportOpening: { token: "sample-opening", openedAt: "2026-10-01T00:00:00.000Z" },
};

/** One table's valid row. */
export interface SampleRow {
  readonly table: SQLiteTable;
  readonly name: string;
  readonly row: Record<string, unknown>;
}

const referencedTables = (table: SQLiteTable): string[] =>
  getTableConfig(table).foreignKeys.map((key) => getTableName(key.reference().foreignTable));

/**
 * Every sample row, each after the rows its foreign keys reference, so they can
 * be written one by one with foreign keys enforced, as D1 enforces them.
 */
export const SAMPLE_ROWS: readonly SampleRow[] = (() => {
  const pending = (Object.keys(ROWS) as (keyof Schema)[]).map((key) => ({
    table: schema[key] as SQLiteTable,
    name: getTableName(schema[key]),
    row: ROWS[key] as Record<string, unknown>,
  }));
  const ordered: SampleRow[] = [];
  while (pending.length > 0) {
    const written = new Set(ordered.map(({ name }) => name));
    const next = pending.findIndex(({ table }) => referencedTables(table).every((name) => written.has(name)));
    if (next === -1) throw new Error(`foreign keys form a cycle among: ${pending.map(({ name }) => name).join(", ")}`);
    ordered.push(...pending.splice(next, 1));
  }
  return ordered;
})();

/** Where the sample rows and the tables the migrations create disagree. */
export interface SampleCoverage {
  /** Tables the migrations create that no sample row writes. */
  readonly unwritten: readonly string[];
  /** Sample rows for tables the migrations do not create. */
  readonly uncreated: readonly string[];
}

/** Compare the sample rows with the tables the migrations create. */
export function sampleCoverage(created: Iterable<string>): SampleCoverage {
  const createdSet = new Set(created);
  const sampled = new Set(SAMPLE_ROWS.map(({ name }) => name));
  return {
    unwritten: [...createdSet].filter((name) => !sampled.has(name)).sort(),
    uncreated: [...sampled].filter((name) => !createdSet.has(name)).sort(),
  };
}

/** Write every sample row, one statement each, in foreign-key order; a refused write throws, naming its table. */
export async function writeSampleRows(app: AppDatabase, log: (line: string) => void = () => {}): Promise<void> {
  for (const { table, name, row } of SAMPLE_ROWS) {
    try {
      await app.insert(table).values(row);
    } catch (failure) {
      throw new Error(`${name}: the sample row was refused`, { cause: failure });
    }
    log(`  ${name}: written`);
  }
}
