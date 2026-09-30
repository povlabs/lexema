// The account meter (#261), over `node:sqlite` storage as a Durable Object's
// SQLite is. Each call builds the meter again over the same storage, as a
// hibernated object is, so nothing it answers can come from memory.

import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { AccountMeter, FLUSH_EVERY_MS, type Admission, type UnsentCalls } from "../src/api/accountMeter.js";
import { accountUsage, addUsage, USAGE_WINDOW_DAYS } from "../src/api/usage.js";
import { signInAccount, verifiedIdentity } from "../src/accounts/accounts.js";
import { createAccountKey, keyName } from "../src/api/ownedKeys.js";
import { freshAppDatabase, meterSqlOver } from "./databases.js";

const NOW = Date.parse("2026-09-27T12:00:20Z");
const DAY = 24 * 60 * 60 * 1000;
const PERIOD = "2026-09-01T00:00:00.000Z";

/** A meter's storage, and the meter built afresh over it for each use. */
function storage() {
  const sqlite = new DatabaseSync(":memory:");
  const meter = () => AccountMeter.over(meterSqlOver(sqlite));
  const admit = (over: Partial<Admission> = {}) =>
    meter().admit({ keyId: 1, calls: 1, periodStart: PERIOD, allowance: null, perMinute: null, now: NOW, ...over });
  /** Run the flush into a sink that keeps what it was sent. */
  const flush = async (now = NOW + FLUSH_EVERY_MS) => {
    const sent: UnsentCalls[] = [];
    await meter().flush(async (rows) => void sent.push(...rows), now);
    return sent;
  };
  return { meter, admit, flush };
}

test("the meter counts the period across keys and each key's calls per UTC day, and a meter rebuilt from storage holds them all", async () => {
  const { admit, flush } = storage();
  assert.deepEqual(admit({ keyId: 1, calls: 1 }).answer, { outcome: "admitted", periodCalls: 1 });
  assert.deepEqual(admit({ keyId: 2, calls: 7 }).answer, { outcome: "admitted", periodCalls: 8 });
  assert.deepEqual(admit({ keyId: 1, calls: 2, now: NOW + DAY }).answer, { outcome: "admitted", periodCalls: 10 });
  assert.deepEqual(await flush(NOW + DAY), [
    { keyId: 1, day: "2026-09-27", calls: 1 },
    { keyId: 1, day: "2026-09-28", calls: 2 },
    { keyId: 2, day: "2026-09-27", calls: 7 },
  ]);
  // Sent once: the next flush has nothing, and a later call sends only itself.
  assert.deepEqual(await flush(NOW + DAY), []);
  admit({ keyId: 1, calls: 3, now: NOW + DAY });
  assert.deepEqual(await flush(NOW + DAY), [{ keyId: 1, day: "2026-09-28", calls: 3 }]);
});

test("a new period start restarts the count; an older one counts in the current period", () => {
  const { admit } = storage();
  admit({ calls: 5 });
  assert.deepEqual(admit({ calls: 1, periodStart: "2026-10-01T00:00:00.000Z" }).answer, { outcome: "admitted", periodCalls: 1 });
  assert.deepEqual(admit({ calls: 1, periodStart: PERIOD }).answer, { outcome: "admitted", periodCalls: 2 });
});

test("a call over the allowance or the meter's rate is refused and counts nothing", async () => {
  const { admit, flush } = storage();
  admit({ calls: 8, allowance: 10 });
  assert.deepEqual(admit({ calls: 3, allowance: 10 }).answer, { outcome: "over-allowance", periodCalls: 8 });
  assert.deepEqual(admit({ calls: 2, allowance: 10 }).answer, { outcome: "admitted", periodCalls: 10 });

  // An Enterprise rate of 5 a minute, counted here: a batch of 4 then 2 words is refused at the second.
  assert.deepEqual(admit({ calls: 4, perMinute: 5 }).answer, { outcome: "admitted", periodCalls: 14 });
  assert.deepEqual(admit({ calls: 2, perMinute: 5 }).answer, { outcome: "over-rate", periodCalls: 14 });
  assert.deepEqual(admit({ calls: 2, perMinute: 5, now: NOW + 60_000 }).answer, { outcome: "admitted", periodCalls: 16 });
  assert.deepEqual(await flush(), [{ keyId: 1, day: "2026-09-27", calls: 16 }]);
});

test("a flush is armed by the first call not yet due to be sent, a minute on, and never twice within a minute", async () => {
  const { admit, flush, meter } = storage();
  assert.equal(admit({ now: NOW }).flushAt, NOW + FLUSH_EVERY_MS);
  assert.equal(admit({ now: NOW + 30_000 }).flushAt, undefined);
  await flush(NOW + FLUSH_EVERY_MS);
  // After the flush the next call arms the next one, a minute after itself.
  assert.equal(admit({ now: NOW + 70_000 }).flushAt, NOW + 70_000 + FLUSH_EVERY_MS);

  // A failed send marks nothing sent; the next try is armed, and sends it all.
  await assert.rejects(meter().flush(() => Promise.reject(new Error("D1 is down")), NOW + 130_000));
  assert.equal(meter().retryAt(NOW + 130_000), NOW + 130_000 + FLUSH_EVERY_MS);
  assert.equal(admit({ now: NOW + 140_000 }).flushAt, undefined);
  assert.deepEqual(await flush(NOW + 190_000), [{ keyId: 1, day: "2026-09-27", calls: 2 }]);
});

test("calls admitted while a send is on its way stay unsent and go with the next", async () => {
  const { admit, meter, flush } = storage();
  admit({ calls: 2 });
  await meter().flush(async () => void admit({ calls: 5 }), NOW + FLUSH_EVERY_MS);
  assert.deepEqual(await flush(), [{ keyId: 1, day: "2026-09-27", calls: 5 }]);
});

test("after a flush, the account's 30-day usage in D1 shows the calls made", async () => {
  const { sqlite, appDb } = freshAppDatabase();
  const identity = verifiedIdentity("github", { subject: "meter", verifiedEmail: "meter@example.com", name: undefined });
  const name = keyName("meter");
  assert.ok(identity !== undefined && name !== undefined);
  const { accountId } = await signInAccount(appDb, identity, NOW);
  const created = await createAccountKey(appDb, accountId, name, NOW);
  assert.ok(created.outcome === "created");

  const { admit, meter } = storage();
  admit({ keyId: created.keyId, calls: 1, now: NOW - DAY });
  admit({ keyId: created.keyId, calls: 7 });
  await meter().flush((rows) => addUsage(appDb, rows), NOW);
  admit({ keyId: created.keyId, calls: 1 });
  await meter().flush((rows) => addUsage(appDb, rows), NOW + FLUSH_EVERY_MS);

  const expected = Array<number>(USAGE_WINDOW_DAYS).fill(0);
  expected[USAGE_WINDOW_DAYS - 2] = 1;
  expected[USAGE_WINDOW_DAYS - 1] = 8;
  assert.deepEqual((await accountUsage(appDb, accountId, NOW)).total, expected);
  sqlite.close();
});
