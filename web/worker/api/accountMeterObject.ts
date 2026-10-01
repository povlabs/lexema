// The account meter's Durable Object (#261): one per developer account, named
// by its id, SQLite-backed, around the pure `AccountMeter`
// (src/api/accountMeter.ts). `admit` is the one call each API request makes,
// and `giveBack` the second one a request makes only when its answer fails
// (#289); its alarm adds the calls D1 does not have yet to `api_key_usage`, at
// most once a minute. web/worker/index.ts exports it, and web/wrangler.jsonc
// binds it as ACCOUNT_METER with its `new_sqlite_classes` migration.

import { DurableObject } from "cloudflare:workers";
import { AccountMeter, type Admission, type GiveBack, type MeterAnswer, type SqlValue } from "@lexema/api/accountMeter.ts";
import { addUsage } from "@lexema/api/usage.ts";
import { appTablesOverD1 } from "@lexema/db/app/database.ts";

/** What the object reads from the Worker's bindings: the app database it flushes to. */
interface MeterEnv {
  APP_DB?: D1Database;
}

export class AccountMeterObject extends DurableObject<MeterEnv> {
  private readonly meter: AccountMeter;

  constructor(ctx: DurableObjectState, env: MeterEnv) {
    super(ctx, env);
    // The object's own SQLite: each statement runs, and is written, in the request that sends it.
    this.meter = AccountMeter.over(<Row extends Record<string, SqlValue>>(query: string, ...bindings: SqlValue[]) =>
      ctx.storage.sql.exec<Row>(query, ...bindings).toArray(),
    );
  }

  /** Admit and count one request's calls, arming the flush when none is pending. */
  async admit(admission: Admission): Promise<MeterAnswer> {
    const { answer, flushAt } = this.meter.admit(admission);
    if (flushAt !== undefined) await this.ctx.storage.setAlarm(flushAt);
    return answer;
  }

  /** Take back the calls of an admitted request whose answer failed (#289). */
  async giveBack(given: GiveBack): Promise<void> {
    this.meter.giveBack(given);
  }

  /** The calls counted in the period that began at `periodStart`, for the dashboard (#207). Reads only. */
  async periodCalls(periodStart: string): Promise<number> {
    return this.meter.periodCalls(periodStart);
  }

  /** Add the unsent calls to D1; on a failure, try again a minute on. */
  async alarm(): Promise<void> {
    try {
      if (this.env.APP_DB === undefined) throw new Error("no D1 binding: this Worker has no APP_DB");
      const db = appTablesOverD1(this.env.APP_DB);
      await this.meter.flush((rows) => addUsage(db, rows), Date.now());
    } catch (failure) {
      console.error("account meter flush failed", failure);
      const at = this.meter.retryAt(Date.now());
      if (at !== undefined) await this.ctx.storage.setAlarm(at);
    }
  }
}
