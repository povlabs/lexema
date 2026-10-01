// Metering as the API handler reaches it (web/worker/api/metering.ts), in
// process: each account's meter is an `AccountMeter` over its own `node:sqlite`
// storage, built again for every call as a hibernated Durable Object is, and
// the rate bindings are fakes with the binding's contract.

import { DatabaseSync } from "node:sqlite";
import { AccountMeter, type Admission, type GiveBack, type MeterAnswer, type UnsentCalls } from "../../src/api/accountMeter.js";
import type { RateBinding } from "../../src/api/accountRate.js";
import { addUsage } from "../../src/api/usage.js";
import type { AppTables } from "../../src/db/app/database.js";
import { meterSqlOver } from "../../test/databases.js";
import type { Metering } from "@/worker/api/metering.ts";

/** The binding's contract: `limit` answers success until a key has used up its allowance; every call is counted. */
export class FakeRateLimit implements RateLimit {
  readonly counts = new Map<string, number>();
  constructor(readonly allowance: number) {}
  async limit({ key }: RateLimitOptions): Promise<RateLimitOutcome> {
    const count = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, count);
    return { success: count <= this.allowance };
  }
}

export class TestMetering implements Metering {
  readonly bindings: Record<RateBinding, FakeRateLimit> = { CALLS_60: new FakeRateLimit(60), CALLS_300: new FakeRateLimit(300) };
  /** Every call a request made to an account's meter, in order. */
  readonly calls: { accountId: number; admission: Admission }[] = [];
  /** Every give-back a request made to an account's meter, in order (#289). */
  readonly givenBack: { accountId: number; given: GiveBack }[] = [];
  private readonly storage = new Map<number, DatabaseSync>();

  async admit(accountId: number, admission: Admission): Promise<MeterAnswer> {
    this.calls.push({ accountId, admission });
    return this.meterOf(accountId).admit(admission).answer;
  }

  async giveBack(accountId: number, given: GiveBack): Promise<void> {
    this.givenBack.push({ accountId, given });
    this.meterOf(accountId).giveBack(given);
  }

  /** The calls the account's meter counts in the period that began at `periodStart`, as the dashboard reads them. */
  periodCalls(accountId: number, periodStart: string): number {
    return this.meterOf(accountId).periodCalls(periodStart);
  }

  binding(name: RateBinding): RateLimit {
    return this.bindings[name];
  }

  /** Every account meter's alarm, run now: their unsent calls added to the app database. */
  async flush(db: AppTables, now: number): Promise<UnsentCalls[]> {
    const sent: UnsentCalls[] = [];
    for (const accountId of this.storage.keys()) sent.push(...(await this.meterOf(accountId).flush((rows) => addUsage(db, rows), now)));
    return sent;
  }

  /** The account's meter, over the storage it left behind. */
  private meterOf(accountId: number): AccountMeter {
    let sqlite = this.storage.get(accountId);
    if (sqlite === undefined) this.storage.set(accountId, (sqlite = new DatabaseSync(":memory:")));
    return AccountMeter.over(meterSqlOver(sqlite));
  }
}
