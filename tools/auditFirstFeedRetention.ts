// Read-only reproduction of #414's first-feed audit. The pair manifest was
// reconstructed from the original apply SQL and the pre-apply local master.
// Archive digests and every original change id are independently rechecked.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import { italianRecordOf } from "../src/import/importRelease.js";
import { ReadSenses } from "../src/update/selection.js";

interface Pair {
  id: string;
  word: string;
  pos: string;
  beforeLine: number;
  afterLine: number;
  retiredRecordId: number;
  laterRecordId: number;
}
const pairs: Pair[] = JSON.parse(await readFile("reports/2026-10-02-first-feed-pairs.json", "utf8"));
const ids = new Set((await readFile("reports/2026-10-01-first-feed-selection.ids", "utf8")).trim().split(/\s+/));
const sha = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
async function lines(path: string, expected: string, wanted: Set<number>): Promise<Map<number, string>> {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(path)) digest.update(chunk);
  assert.equal(digest.digest("hex"), expected, "archive SHA-256");
  const found = new Map<number, string>();
  let lineNo = 0;
  for await (const line of createInterface({ input: createReadStream(path).pipe(createGunzip()), crlfDelay: Infinity })) {
    lineNo += 1;
    if (wanted.has(lineNo)) found.set(lineNo, line);
  }
  assert.equal(found.size, wanted.size, "all source lines found");
  return found;
}
const [beforePath, afterPath] = process.argv.slice(2);
assert.ok(beforePath && afterPath, "usage: pnpm exec tsx tools/auditFirstFeedRetention.ts <old.jsonl.gz> <later.jsonl.gz>");
const before = await lines(beforePath, "0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf", new Set(pairs.map((p) => p.beforeLine)));
const after = await lines(afterPath, "78385b6229d19ed990ada6f6f33930585701c3bdc146fb1c849818df72a3e8d4", new Set(pairs.map((p) => p.afterLine)));
assert.equal(pairs.length, 54);
assert.equal(new Set(pairs.map((p) => p.id)).size, 54);
const added = [];
for (const pair of pairs) {
  const oldLine = before.get(pair.beforeLine)!;
  const laterLine = after.get(pair.afterLine)!;
  const old = italianRecordOf(oldLine);
  const later = italianRecordOf(laterLine);
  assert.ok(old && later);
  assert.deepEqual([old.word, old.pos, later.word, later.pos], [pair.word, pair.pos, pair.word, pair.pos]);
  assert.equal(`chg-${sha(["changed", pair.word, pair.pos, sha(oldLine), sha(laterLine)].join("\u0000")).slice(0, 12)}`, pair.id);
  assert.ok(ids.has(pair.id), "id in original committed selection");
  const was = ReadSenses.of(old);
  const now = ReadSenses.of(later);
  // The original v1 adds-sense route, frozen here for this historical audit:
  // more real senses, a new key, and no decrease in non-real senses.
  if (was.real.length === 0 || now.real.length <= was.real.length || was.notReal > now.notReal || !now.keys.some((key) => !was.keys.includes(key))) continue;
  const missing = was.keys.flatMap((key, index) => now.keys.includes(key) ? [] : [{ gloss: was.shown[index], key }]);
  // Frozen v2 adds-sense outcome: this historical reproduction must not use v3.
  const verdict = missing.length ? { take: false, reason: "loses-gloss" } : { take: true, reason: "adds-sense" };
  added.push({ ...pair, beforeSha256: sha(oldLine), afterSha256: sha(laterLine), oldKeys: was.keys, laterKeys: now.keys, missing, verdict });
}
assert.equal(added.length, 22);
assert.equal(added.filter((p) => p.missing.length).length, 4);
console.log(JSON.stringify({ changedIdsVerified: pairs.length, originalAddsSense: added.length, affected: 4, retained: 18, records: added }, null, 2));
