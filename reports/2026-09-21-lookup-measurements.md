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
  `origin/huey/10-import` at `7560e06`.

## Longest headword

`MAX_QUERY_LENGTH` in [`src/lookup/lookup.ts`](../src/lookup/lookup.ts) bounds
the *trimmed* query before normalization, so the length measured here is the raw
`word` string's length in UTF-16 code units — the same unit `String.length`
gives the lookup.

```sh
gzcat it-extract.jsonl.gz | node -e '
const rl = require("node:readline").createInterface({ input: process.stdin });
let n = 0, admitted = 0, longest = "";
const hist = new Map();
rl.on("line", (line) => {
  n += 1;
  const rec = JSON.parse(line);
  if (rec.lang_code !== "it" || typeof rec.word !== "string") return;
  admitted += 1;
  hist.set(rec.word.length, (hist.get(rec.word.length) ?? 0) + 1);
  if (rec.word.length > longest.length) longest = rec.word;
});
rl.on("close", () => {
  console.log("lines read      ", n);
  console.log("it headwords    ", admitted);
  console.log("longest length  ", longest.length);
  console.log("longest headword", JSON.stringify(longest));
  const over = [...hist].filter(([len]) => len > 128).reduce((s, [, c]) => s + c, 0);
  console.log("longer than 128 ", over);
  const top = [...hist].sort((a, b) => b[0] - a[0]).slice(0, 5);
  console.log("top lengths     ", JSON.stringify(top));
});
'
```

Output, verbatim:

```
lines read       799600
it headwords     560357
longest length   51
longest headword "memoria a sola lettura cancellabile e programmabile"
longer than 128  0
top lengths      [[51,1],[47,1],[45,1],[44,1],[43,2]]
```

Wall clock: 2.8 s.

### What it says

The longest Italian headword in this archive is 51 characters. The bound is 128,
so it sits at 2.5× the longest headword and no headword in the archive reaches
it. The `it headwords` count matches the 560,357 admitted records in
[the import measurements](2026-09-21-import-measurements.md), which is the
cross-check that this pass admitted the same records the importer does.

The five longest headwords are all multi-word technical glosses rather than
single words, so the margin over ordinary vocabulary is wider still.

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
