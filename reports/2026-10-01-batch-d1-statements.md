# D1 statements in one `/lookup/batch`, 2026-10-01

Measurement for [#158](https://github.com/povlabs/lexema/issues/158). It counts
the D1 statements one `POST /v1/lookup/batch` runs at the largest batch a plan
allows, and compares that count with Cloudflare's per-invocation cap.

**Result: over the cap.** A 300-word batch of random headwords runs 6,391 to
7,469 statements. A batch of the most-matched spellings runs 33,912. Cloudflare's
D1 page caps a Workers Paid invocation at 1,000 queries. Even Starter's 60-word
batch runs 1,285. The follow-up is
[#335](https://github.com/povlabs/lexema/issues/335).

## The largest batch

A batch takes at most as many words as the key's calls a minute
(`batchWords(body, most)` in
[`web/worker/api/endpoints.ts`](../web/worker/api/endpoints.ts), with `most` =
`limits.perMinute` from [`web/worker/api/handler.ts`](../web/worker/api/handler.ts),
#216). The plan rates are in [`src/billing/plans.ts`](../src/billing/plans.ts):

| Plan | Calls a minute, so most words a batch takes |
| --- | ---: |
| Starter | 60 |
| Pro | 300 |
| Enterprise | any whole number above 0 that Huey sets (`pnpm run plan`) |
| Admin key | any whole number above 0 set at creation (`pnpm run api-key`) |

Enterprise and admin keys have no ceiling in code (`enterprise_plan_calls_per_minute`
in [`0003_plans.sql`](../src/db/app/migrations/0003_plans.sql) only checks
`> 0`). So the largest fixed batch is **Pro's 300 words**, and that is what was
measured. An Enterprise rate above 300 makes a larger batch possible.

## Setup

- Release `it-0c432803`: `it-extract.jsonl.gz`, SHA-256
  `0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf`, seeded at
  this branch's base (`64dd786`) into a scratch local D1 with
  `SEED_INPUT=it-extract.jsonl.gz SEED_SQL=<scratch> SEED_STATE=<scratch> pnpm run seed:dev`.
  It loaded 560,357 `source_record` and 1,273,490 `lookup_form` rows, as
  [RUN_AN_IMPORT.md](../docs/RUN_AN_IMPORT.md) expects.
- The D1 is Wrangler's local D1 (wrangler 4.135.0), reached through
  `getPlatformProxy`, so every query goes through the same `fromD1` adapter the
  Worker uses.
- Machine: Apple M1 Pro, 16 GB, macOS 27.0, Node v26.2.0.

## How the count was taken

The script below runs the batch route's own answer (`ROUTES["lookup/batch"]`) with
a dictionary binding that wraps the local `DB`. Each statement the dictionary
runs is one `.all()` on a prepared statement
([`src/lookup/database.ts`](../src/lookup/database.ts) calls nothing else), so the
wrapper counts `.all()` calls and sums each result's `meta.rows_read`.

The words are distinct, chosen from the release:

- **Random:** all 541,247 distinct `source_record.word` values, shuffled with a
  fixed seed, first 300 taken. Five seeds.
- **Most-matched:** the 300 `lookup_form.surface_key` values with the most
  distinct records (from `avere`, 5,249 records, down to `andata`, 8), one
  spelling each. This is a deliberately heavy batch.

The wrapper lets at most 8 queries run at once, because the local proxy drops
connections when hundreds open together. That changes timing, not the count:
`Lookups` caches each word's lookup on its first call, so the same statements
run in any order.

The count covers the dictionary only. Around it, the handler reads the key from
`APP_DB` once and writes its `last_used_at` at most once a minute
([`src/api/keys.ts`](../src/api/keys.ts), `authenticate`). An owned key's rate and
allowance are counted by a Rate Limiting binding and a Durable Object, not D1. So
a whole request adds 1 or 2 D1 statements to the numbers below.

Saved at the repository root as `measure-batch.mts` (not committed) and run as
`TSX_TSCONFIG_PATH=web/tsconfig.json pnpm exec tsx measure-batch.mts <SEED_STATE>/v3 300`,
then again with a trailing `small` for the smaller rows:

```ts
import { getPlatformProxy } from "./web/node_modules/wrangler/wrangler-dist/cli.js";
import { fromD1 } from "./src/lookup/database.ts";
import { ROUTES } from "./web/worker/api/endpoints.ts";

const [stateDir, size = "300"] = process.argv.slice(2);
const most = Number(size);
const release = "it-0c432803";

const proxy = await getPlatformProxy<{ DB: any }>({ configPath: "web/wrangler.jsonc", persist: { path: stateDir } });
const d1 = proxy.env.DB;

let statements = 0;
let rowsRead = 0;
let inFlight = 0;
const waiting: (() => void)[] = [];
const acquire = async () => {
  if (inFlight >= 8) await new Promise<void>((resolve) => waiting.push(resolve));
  inFlight += 1;
};
const release_ = () => {
  inFlight -= 1;
  waiting.shift()?.();
};
const counted = {
  prepare(sql: string) {
    const wrap = (statement: any): any => ({
      bind: (...params: unknown[]) => wrap(statement.bind(...params)),
      all: async () => {
        statements += 1;
        await acquire();
        try {
          const result = await statement.all();
          rowsRead += result.meta.rows_read ?? 0;
          return result;
        } finally {
          release_();
        }
      },
    });
    return wrap(d1.prepare(sql));
  },
};

function shuffled<T>(items: T[], seed: number): T[] {
  let s = seed >>> 0;
  const next = () => ((s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0) / 2 ** 32);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

async function batch(label: string, words: string[]) {
  statements = 0;
  rowsRead = 0;
  const reading = await ROUTES["lookup/batch"].read(
    new Request("https://api.lexema.fyi/v1/lookup/batch", { method: "POST", body: JSON.stringify({ q: words }) }),
    new URL("https://api.lexema.fyi/v1/lookup/batch"),
    { batchWords: most },
  );
  if (reading.outcome !== "read") throw new Error(`${label}: refused ${JSON.stringify(reading.body)}`);
  const answer = await reading.answer({ db: fromD1(counted), releaseId: release } as any);
  const results = (answer.body as { results: { found: boolean; query: string }[] }).results;
  const found = new Set(results.filter((r) => r.found).map((r) => r.query)).size;
  console.log([label, `words ${words.length}`, `found ${found}`, `entries ${results.length}`,
    `statements ${statements}`, `per word ${(statements / words.length).toFixed(1)}`, `rows_read ${rowsRead}`].join(" | "));
}

const headwords = (
  await d1.prepare("SELECT DISTINCT word FROM source_record WHERE release_id = ? ORDER BY word").bind(release).all()
).results.map((r: { word: string }) => r.word).filter((w: string) => w.trim().length > 0 && w.length <= 128);
console.log(`distinct headwords in ${release}: ${headwords.length}`);

if (process.argv[4] === "small") {
  for (const n of [1, 10, 20, 40, 60]) await batch(`random seed 1, first ${n}`, shuffled(headwords, 1).slice(0, n));
  for (const word of ["casa", "andare", "sale", "essere", "avere"]) await batch(word, [word]);
} else {
  for (const seed of [1, 2, 3, 4, 5]) await batch(`random seed ${seed}`, shuffled(headwords, seed).slice(0, most));
  const heavy = (
    await d1.prepare(
      `SELECT MIN(surface) AS surface, COUNT(DISTINCT record_id) AS records FROM lookup_form
        WHERE release_id = ? GROUP BY surface_key ORDER BY records DESC LIMIT ?`,
    ).bind(release, most).all()
  ).results;
  await batch("most records per spelling", heavy.map((r: { surface: string }) => r.surface));
}
await proxy.dispose();
```

## Counts

300 words, Pro's largest batch:

| Batch | Words found | Result entries | D1 statements | Per word | Rows read |
| --- | ---: | ---: | ---: | ---: | ---: |
| Random, seed 1 | 300 | 372 | 6,391 | 21.3 | 289,061 |
| Random, seed 2 | 300 | 419 | 7,404 | 24.7 | 316,607 |
| Random, seed 3 | 300 | 390 | 6,683 | 22.3 | 321,150 |
| Random, seed 4 | 300 | 419 | 7,469 | 24.9 | 317,513 |
| Random, seed 5 | 300 | 386 | 7,146 | 23.8 | 336,459 |
| Most-matched spellings | 294 | 2,499 | **33,912** | 113.0 | 633,524 |

Smaller batches (the first words of the seed-1 sample) and single words:

| Batch | D1 statements | Rows read |
| --- | ---: | ---: |
| 1 word | 27 | 2,319 |
| 10 words | 216 | 9,741 |
| 20 words | 446 | 21,737 |
| 40 words | 824 | 44,595 |
| 60 words (Starter's largest) | **1,285** | 65,220 |
| `casa` | 15 | 170 |
| `andare` | 24 | 1,918 |
| `essere` | 35 | 4,013 |
| `avere` | 35 | 12,572 |
| `sale` | 84 | 4,360 |

Six of the most-matched spellings were not found, such as `come intr. essere`
(114 records). Every index row of each is a `forms[]` entry with an `auxiliary`
form-role claim, which the search skips (#109); checked by a direct query on the
seeded database.

Why a word costs about 20 statements: each lookup reads the release, then the
search rows, then per matched record its lemma links, grammar, forms, the raw
record, recovered definitions, senses, inflections and reviews, all as separate
statements (`found` and `buildReading` in [`src/lookup/lookup.ts`](../src/lookup/lookup.ts)).
A form-of reading then runs a whole lookup of its lemma (`candidatesOf` in
[`web/worker/api/lookupAnswer.ts`](../web/worker/api/lookupAnswer.ts)). The release
row is read again for every word; `Lookups` caches only whole words.

## The cap

Read 2026-10-01:

- Cloudflare D1, [Limits](https://developers.cloudflare.com/d1/platform/limits/)
  (page last updated Apr 21, 2026): "Queries per Worker invocation (read
  subrequest limits)": **1000 (Workers Paid)** / 50 (Free).
- Cloudflare Workers, [Limits § Subrequests](https://developers.cloudflare.com/workers/platform/limits/#subrequests)
  (page last updated Sep 5, 2026): subrequests per invocation 10,000 on Workers
  Paid (configurable up to 10M with `limits` in the Wrangler config), and
  "Subrequests to internal services: Matches configured limit (default 10,000)".
  It names D1 as a subrequest.

The two pages disagree. The D1 page's row points at the Workers page, which is
newer and says 10,000, so 1,000 may be stale. That reading is not proven here.
`web/wrangler.jsonc` sets no `limits` block, so the default applies.

| Batch | Statements | vs 1,000 | vs 10,000 |
| --- | ---: | --- | --- |
| Starter, 60 random words | 1,285 | over | under |
| Pro, 300 random words | 6,391–7,469 | over, 6–7× | under |
| Pro, 300 most-matched words | 33,912 | over, 34× | over, 3.4× |

**Either way the count is over.** Under the D1 page's 1,000, every plan's full
batch fails, and a random batch fits only to about 45 words. Under the Workers
page's 10,000, a typical Pro batch fits, but a heavy one does not, and nothing
stops a client from sending heavy words. Tests run on `node:sqlite`, which has
no cap, so none of this shows locally.

Raising `limits.subrequests` is not a fix for the heavy batch on its own: whether
it lifts the D1 cap is the open question above, and an Enterprise rate can make a
batch larger than any fixed number.

## Cost

D1 bills rows read, not statements
([D1 Pricing](https://developers.cloudflare.com/d1/platform/pricing/), read
2026-10-01, page last updated Apr 21, 2026): Workers Paid includes 25 billion rows
read a month, then $0.001 per million.

The random batches read about 1,000 rows a word (289,061–336,459 for 300); the
heavy one about 2,100. A Pro account using all its 5,000,000 calls a month on
batch words reads about 5 billion rows: a fifth of the inclusion. Five such
accounts would reach it, and each further billion rows costs $1. Rows read come
from local SQLite's count and are an estimate of D1's billed count. Rows read do
not change the cap problem: a batch over the cap fails before it costs much.
