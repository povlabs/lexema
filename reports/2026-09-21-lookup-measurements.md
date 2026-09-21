# Lookup measurements: headword length, 2026-09-21

Measurement. One pass over the local archive to back the 128-character query
bound described in
[LOOKUP_DESIGN.md](../docs/LOOKUP_DESIGN.md#accents-are-meaning). It describes
this machine and this file; a different archive gives different rows.

The timing claim on that same page is not measured here. It comes from the
benchmark on the `huey/37-lookup-bench` branch, and
[the last section](#the-timing-claim-is-not-from-this-report) says where and how
to re-run it.

## Setup

- Archive: `it-extract.jsonl.gz`, 39,890,237 bytes,
  SHA-256 `0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf`
  (the same file as [the dataset spot check](2026-09-18-dataset-spot-check.md)
  and [the import measurements](2026-09-21-import-measurements.md)).
- Machine: Apple M1 Pro, 16 GB, macOS 27.0. Node v26.2.0, pnpm 10.13.1.
- Run on PR #33's branch `huey/13-lookup`, as merged with
  `origin/huey/10-import` at `42cef2a`.

## Longest headword

`MAX_QUERY_LENGTH` in [`src/lookup/lookup.ts`](../src/lookup/lookup.ts) bounds
the *trimmed* query before normalization, so the length measured here is the raw
`word` string's length in UTF-16 code units — the same unit `String.length`
gives the lookup.

```sh
gzcat it-extract.jsonl.gz | node -e '
const rl = require("node:readline").createInterface({ input: process.stdin });
let n = 0, admitted = 0;
const hist = new Map();
const longest = [];
rl.on("line", (line) => {
  n += 1;
  const rec = JSON.parse(line);
  if (rec.lang_code !== "it" || typeof rec.word !== "string") return;
  admitted += 1;
  hist.set(rec.word.length, (hist.get(rec.word.length) ?? 0) + 1);
  longest.push(rec.word);
  longest.sort((a, b) => b.length - a.length || (a < b ? -1 : a > b ? 1 : 0));
  longest.length = Math.min(longest.length, 5);
});
rl.on("close", () => {
  console.log("lines read      ", n);
  console.log("it headwords    ", admitted);
  console.log("longest length  ", longest[0].length);
  console.log("longer than 128 ", [...hist].filter(([len]) => len > 128).reduce((s, [, c]) => s + c, 0));
  console.log("five longest    ");
  for (const word of longest) console.log("  " + String(word.length).padStart(3) + "  " + JSON.stringify(word));
});
'
```

Output, verbatim:

```
lines read       799600
it headwords     560357
longest length   51
longer than 128  0
five longest    
   51  "memoria a sola lettura cancellabile e programmabile"
   47  "Regno Unito di Gran Bretagna e Irlanda del Nord"
   45  "capo dell'ordine costantiniano di San Giorgio"
   44  "Anagrafe degli Italiani Residenti all'Estero"
   43  "capo dei cavalieri di Santa Maria Teutonica"
```

Wall clock: 2.9 s.

### What it says

The longest Italian headword in this archive is 51 characters. The bound is 128,
so it sits at 2.5× the longest headword and no headword in the archive reaches
it. The `it headwords` count matches the 560,357 admitted records in
[the import measurements](2026-09-21-import-measurements.md), which is the
cross-check that this pass admitted the same records the importer does.

All five of the longest headwords printed above are multi-word phrases — a
technical term, two titles, a country's full name, a registry's name — rather
than single words. None of them is vocabulary a search box is likely to be
handed, so the margin over ordinary single words is wider still. How much wider
is not measured here: this pass prints these five spellings and the count over
128, not a length distribution for single-word headwords.

## The timing claim is not from this report

`docs/LOOKUP_DESIGN.md`'s "seconds against fractions of a millisecond" comes
from the lookup benchmark, which is **not on this branch**. It is on
`huey/37-lookup-bench` (PR #38), and its captured output lives in
`docs/LOOKUP_BENCHMARK.md` on that branch. To re-derive it:

```sh
git checkout huey/37-lookup-bench
pnpm run bench:lookup
```

Its captured run of 2026-09-19, at a 560,357-record synthetic corpus matching
this archive's shape, reports the `form_of_candidate` view at 6722.0 ms against
0.03 ms for the inlined join, for identical rows. Nothing in this report
measures that, and nothing on PR #33's branch can run that command.
