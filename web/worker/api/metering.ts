// How the API counts an owned key's calls (#261): its account's meter, one
// Durable Object per account (./accountMeterObject.ts), and the Rate Limiting
// bindings that count the plan rates (src/api/accountRate.ts). The handler
// (./handler.ts) reaches them only through `Metering`, so a test stands in an
// `AccountMeter` over `node:sqlite` and fake bindings.

import type { Admission, MeterAnswer } from "@lexema/api/accountMeter.ts";
import type { RateBinding } from "@lexema/api/accountRate.ts";
import type { AccountMeterObject } from "./accountMeterObject.ts";

/** What the handler counts an owned key's calls with. */
export interface Metering {
  /** The account meter's one call for this request: it admits the calls and counts them, or refuses them and counts nothing. */
  admit(accountId: number, admission: Admission): Promise<MeterAnswer>;
  /** The Rate Limiting binding that counts a plan rate. */
  binding(name: RateBinding): RateLimit;
}

/** The Worker bindings metering runs on, as web/wrangler.jsonc names them. */
export interface MeteringBindings {
  ACCOUNT_METER: DurableObjectNamespace<AccountMeterObject>;
  CALLS_60: RateLimit;
  CALLS_300: RateLimit;
}

/** Metering over the Worker's bindings: an account's meter is the object named by its id. */
export function meteringOver(env: MeteringBindings): Metering {
  return {
    admit: (accountId, admission) => env.ACCOUNT_METER.get(env.ACCOUNT_METER.idFromName(String(accountId))).admit(admission),
    binding: (name) => env[name],
  };
}

/**
 * Count a request's calls on a binding under `key`, one `limit()` a call, as
 * the binding counts one per call (#216). It stops at the first refused, so a
 * refused batch spends no more of the minute than it had left.
 */
export async function withinRate(binding: RateLimit, key: string, calls: number): Promise<boolean> {
  for (let counted = 0; counted < calls; counted++) {
    if (!(await binding.limit({ key })).success) return false;
  }
  return true;
}
