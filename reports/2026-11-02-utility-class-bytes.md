# Named utility classes on a word page: bytes and render CPU — 2026-11-02

Issue [#922](https://github.com/povlabs/lexema/issues/922). [#921](2026-11-02-page-render-cpu.md)
found that class strings are about half the bytes of a big word page, and
estimated that short named classes might save about 20 ms of render CPU. This
finding measures that on a throwaway prototype. No prototype code is merged.

## In short

- The prototype replaced eleven repeated class lists with short `@utility`
  classes. Big pages lost about 30% of their raw bytes: `sale` went from
  293,568 to 205,859 bytes, `essere` from 279,045 to 192,543.
- Compressed, the saving is small: 7% with gzip and 3-4% with brotli. The
  repeated strings already compress well.
- Warm render CPU did not change. The prototype was 0.4-1.5 ms slower at the
  median, inside the noise. The data rule out a saving larger than about 1.3 ms
  on any of the three pages. The 20 ms estimate in #921 does not hold.
- The pages rendered the same: the same computed style on every element, the
  same boxes, the same focus rings, and byte-identical screenshots.

## What the prototype changed

Branch `huey/922-utility-class-prototype`, commit
`f6992febf5835bbdf30c44bb6da847fa36d70b74`, one commit on `main` at
`0d31456f9d3a8f87d8bfb34e442b03376ef79a3d`. It changed two files:

- `web/app/globals.css` gained eleven `@utility` classes. Each one `@apply`s
  exactly the utilities the old list named, so every class is built from the
  same role-token utilities as before.
- `web/components/shared/styles.ts` set each constant below to its short name.
  `WORD_LINK` was built on `WORD_TEXT`, so it kept the old list written out.

The whole diff is in the data file, under `prototype.patch`. The branch was
local only and never pushed. It was deleted after this finding was written.

The lists were chosen by counting the bytes of every distinct class list on the
three pages, in the markup (`class="…"`) and in the inline RSC payload
(`"className":"…"`). These are the lists at the top of that count. The byte
counts below are the list's own text in both places, without the attribute
syntax around it. #921 counted the whole ` class="…"` attribute, so its totals
are a little higher.

| Constant | New class | Uses on `sale` / `casa` / `essere` | Bytes on `sale` | Bytes on `casa` | Bytes on `essere` |
|---|---|---:|---:|---:|---:|
| `FORM_LINK` | `form-link` | 270 / 0 / 186 | 37,260 → 2,430 | 0 | 25,668 → 1,674 |
| `TENSE_CELL` | `tense-cell` | 170 / 0 / 178 | 24,650 → 1,700 | 0 | 25,810 → 1,780 |
| `TENSE_CELL_SEARCHED_ROW` | `tense-cell-row` | 4 / 0 / 0 | 604 → 56 | 0 | 0 |
| `TENSE_CELL_SEARCHED_ROW_WIDE` | `tense-cell-row-wide` | 4 / 0 / 0 | 616 → 76 | 0 | 0 |
| `PERSON` | `person` | 104 / 0 / 106 | 14,976 → 624 | 0 | 15,264 → 636 |
| `PERSON_SEARCHED` | `person-hit` | 2 / 0 / 0 | 284 → 20 | 0 | 0 |
| `WORD_LIST_ITEM_REST` | `word-rest` | 89 / 86 / 61 | 7,654 → 801 | 7,396 → 774 | 5,246 → 549 |
| `WORD_TEXT` | `word-text` | 108 / 97 / 66 | 4,428 → 972 | 3,977 → 873 | 2,706 → 594 |
| `WORD_DOT` | `word-dot` | 105 / 98 / 69 | 4,200 → 840 | 3,920 → 784 | 2,760 → 552 |
| `EXPRESSION_ROW_EXTRA` | `expr-row-extra` | 0 / 20 / 56 | 0 | 3,980 → 280 | 11,144 → 784 |
| `EXPRESSION_PHRASE` | `expr-phrase` | 1 / 21 / 57 | 84 → 11 | 1,764 → 231 | 4,788 → 627 |
| **All eleven** | | | **94,756 → 7,530** | **21,037 → 2,942** | **93,386 → 7,196** |

"Uses" counts the markup and the payload together. A table cell is written
once in each. The word lists and expressions are written only in the markup,
so `casa`'s payload did not change. `PERSON` includes the row heads that add
`sm:sr-only` (`PERSON_REPEAT`).

All class strings on the page fell from 142,862 to 55,636 bytes on `sale`,
from 41,114 to 23,019 on `casa`, and from 143,899 to 57,709 on `essere`.

## How it was measured

- Before: commit `0d31456f9d3a8f87d8bfb34e442b03376ef79a3d` (`main`, after
  #921). After: the prototype commit above.
- Machine: Apple M1 Pro laptop, 16 GB, macOS 27.0, Node 26.2.0, wrangler
  4.135.0, vinext 1.1.0, Tailwind 4.3.3. No other `wrangler`, `workerd`,
  `vinext` or `vitest` process was running when the runs began. Two agent
  sessions in other projects were open on the laptop. The run order below
  spreads any noise from them over both sides.
- Local numbers compare the two builds. They do not match Cloudflare's own
  figure: Cloudflare's CPUs differ, and its D1 is remote.

Each side was built with `pnpm run build` (`vinext build`) in its own
worktree. Both served the same fifty-word seed (`pnpm run seed:state`) with
`wrangler dev --config dist/server/wrangler.json --port 8790 --inspector-port 9229`.

CPU is the #921 method. A script attached to wrangler's inspector through the
Chrome DevTools Protocol. For each request it ran `Profiler.start` at a 100 µs
sampling interval, fetched the page, read the whole body, waited 300 ms, then
ran `Profiler.stop`. "Busy" is the sum of the non-idle samples. Every request
sent a `Cookie` header, so the shared page cache neither read nor kept it, and
each request rendered the page (#921's "render" kind).

Three details are new here:

- **Sample time.** Each sample owns the time since the sample before it. The
  isolate takes no samples while it waits, so a gap over 10 ms is set aside as
  not CPU (`gapMs` in the data). 10 of the 270 warm requests had one. Three
  were the 300 ms wait after the body, which would otherwise have tripled
  those requests. The other seven were 10-22 ms. Counting those seven back in
  moves no median by more than 0.4 ms and changes no conclusion below.
- **Search limit.** `SEARCH_LIMIT` allows 15 searches a minute, and the runs
  make far more. In the built `dist/server/wrangler.json` of both sides it was
  raised to 100,000. The limiter still runs on every request, so the work is
  the same.
- **Runs.** Each run started on a freshly started `wrangler dev`: one first
  `casa` render and three warm-up rounds of the three pages, none of them
  counted, then 15 measured rounds. There were three runs per side, in the order before, after, before,
  after, after, before. Each page has 45 warm samples per side.

Page sizes are the bodies of the measured requests, compressed with `node:zlib`:
gzip level 6 and brotli quality 4 and 11. Cloudflare picks its own level, so
read these as the range.

Every row is in [2026-11-02-utility-class-bytes.json](2026-11-02-utility-class-bytes.json).

## Page bytes

| Page | Raw | gzip 6 | brotli 4 | brotli 11 |
|---|---:|---:|---:|---:|
| `sale` before | 293,568 | 22,791 | 19,664 | 15,705 |
| `sale` after | 205,859 | 21,141 | 19,050 | 15,091 |
| `sale` change | −87,709 (−29.9%) | −1,650 (−7.2%) | −614 (−3.1%) | −614 (−3.9%) |
| `casa` before | 98,350 | 13,921 | 11,638 | 9,938 |
| `casa` after | 80,255 | 13,694 | 11,535 | 9,851 |
| `casa` change | −18,095 (−18.4%) | −227 (−1.6%) | −103 (−0.9%) | −87 (−0.9%) |
| `essere` before | 279,045 | 23,745 | 19,336 | 15,933 |
| `essere` after | 192,543 | 22,075 | 18,738 | 15,340 |
| `essere` change | −86,502 (−31.0%) | −1,670 (−7.0%) | −598 (−3.1%) | −593 (−3.7%) |

The site stylesheet grew from 56,304 to 59,319 bytes (10,722 to 11,207 gzip),
because each new class carries its own rules. A browser fetches it once and
keeps it.

## Warm render CPU

Busy CPU per render, in ms, over 45 warm renders per page and side.

| Page | Before: median (p25-p75) | After: median (p25-p75) | Change at the median | 95% interval of the change |
|---|---:|---:|---:|---:|
| `sale` | 48.0 (45.8-51.8) | 49.5 (46.6-52.5) | +1.5 | −1.3 to +3.3 |
| `casa` | 26.6 (25.2-27.6) | 27.0 (25.6-30.3) | +0.4 | −0.7 to +2.7 |
| `essere` | 46.6 (43.0-48.8) | 47.1 (45.2-52.6) | +0.5 | −1.1 to +3.7 |

The interval is a bootstrap of the difference of medians (5,000 resamples). The
three runs of a side agree with each other: `sale` before had run medians of
47.9, 48.0 and 47.7 ms, and after had 50.4, 48.0 and 49.5 ms. Wall time per
request moved the same way (`sale` 53.7 ms before, 53.8 ms after).

So the 87 KB the prototype took out of `sale` saved no CPU this method can see.
#921's slope of 0.18 ms per KB compared different pages. A bigger page also has
more elements, more data and more components. Its CPU follows that work, not
the length of its class strings. That last point is an inference: this finding
measures only that shorter strings did not make the render cheaper.

These absolute numbers are lower than #921's (`casa` 27 ms here against 41 ms
there). The sample-time rule above and a different day's load may both play a
part. Compare the rows of this finding with each other, not with #921's.

## Did the page render the same

Yes. A headless Chrome (156, through `playwright-core` 1.63.0) opened each page
on each side, at 390 px and 1280 px wide. For each it recorded every element in
the body: its tag, text, attributes other than `class`, its box, and every
computed style property. It did this twice, once as the page loads and once
after clicking every closed `+ altro` until none was left. Then it pressed Tab
and focused every link and button in turn, and recorded whether it matched
`:focus-visible` and its outline. It also took a full-page screenshot of each
state.

Across the 12 page states and 6 focus passes:

- every element matched, with the same text and attributes;
- no computed style property differed, on any element;
- no box differed;
- every focus outline was the same;
- every screenshot was byte-identical (SHA-256 in the data file).

Scripts were left out of the comparison. They hold the RSC payload, whose class
strings are the change itself, and chunk names that differ between builds.

## Saving per page and per month

Measured saving per page: **0 ms**. The change was +0.4 to +1.5 ms, which is
noise. The largest saving the data allow is 1.3 ms, on `sale`.

Bytes saved per page: 29.9% raw, 7.2% gzip, 3.9% brotli 11 on `sale`; 18.4%,
1.6% and 0.9% on `casa`; 31.0%, 7.0% and 3.7% on `essere`.

Prices: Workers Paid includes 30M CPU ms a month, then $0.02 per million CPU ms.
The cost lines take the local `sale` median, 48 ms, as the CPU of one rendered
page. A saving counts only above the 30M included.

- **At the measured 0 ms:** nothing changes, so **$0 a month saved** at 300k, 1M
  and 10M pages.
- **At the most the data allow, 1.3 ms:**
  - 300k pages: 300,000 × 48 ms = 14.4M ms, under 30M. $0 before and after.
    **$0 saved.**
  - 1M pages: 1,000,000 × 48 ms = 48M ms; (48M − 30M) × $0.02/M = $0.36.
    After: 1,000,000 × 46.7 ms = 46.7M; (46.7M − 30M) × $0.02/M = $0.334.
    **$0.03 saved.**
  - 10M pages: 480M ms; (480M − 30M) × $0.02/M = $9.00. After: 467M;
    (467M − 30M) × $0.02/M = $8.74. **$0.26 saved.**
- **For scale, the 20 ms #921 estimated:** 1M pages would fall to 28M ms, under
  30M, and save $0.36; 10M pages would fall to 280M ms and save $4.00. The
  measurement does not support this line.

Production renders cost more than local ones (about 85-160 ms per request in
#921). That raises every "before" line but not the saving, which is the CPU
taken out per page times the pages.

## The open ADR 0010 question

[ADR 0010](../.decisions/0010-base-ui-and-tailwind-style-the-page.md) says
"Utility classes in markup; no new hand-rolled stylesheet beyond the token
definitions". Named `@utility` classes in `globals.css` would need an
amendment to it.

With these numbers, the case for one is bytes, not CPU. Named classes take out
about 30% of a big word page's raw HTML and about 3-7% of what a reader
downloads after compression. They save no measurable Worker CPU, so $0 a month
at 300k, 1M or 10M pages. They also move part of each component's look out of
the markup and into the stylesheet, and add about 3 KB to that stylesheet.

**For Huey to rule:** should ADR 0010 be amended to allow named `@utility`
classes for the most repeated class lists on a word page, for a 3-7%
compressed-size saving and no CPU saving? Or does it stand as written?
