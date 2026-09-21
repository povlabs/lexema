# Search page and development seed measurements, 2026-09-21

Measurement. What the development seed produced, and what the search page
answered, on one machine on this date. The durable documentation
([DEV_SEED.md](../docs/DEV_SEED.md), [RUN_THE_SITE.md](../docs/RUN_THE_SITE.md),
[WEB.md](../docs/WEB.md)) links here rather than carrying these numbers, because
they describe this machine and these files and will drift.

## Setup

- Machine: Apple M1 Pro, 16 GB, macOS 27.0. Node v26.2.0, pnpm 10.13.1.
- Archive: `it-extract.jsonl.gz`, 39,890,237 bytes, SHA-256
  `0c432803…` ([dataset spot check](2026-09-18-dataset-spot-check.md)).
- Two releases appear below. `it-dev` is the 25,000-record prefix the seed
  builds at its default. `it-0c432803` is the whole archive, 560,357 admitted
  records ([import measurements](2026-09-21-import-measurements.md)), imported
  separately and already loaded into the same local D1.

## The development seed at its default

Measured by running the recipe in [RUN_THE_SITE.md](../docs/RUN_THE_SITE.md) at
`SEED_RECORDS=25000`. Recorded on the round that built the seed; this round
served the full release instead and did not re-run it.

| Fact | Value |
|---|---|
| Records | 25,000 |
| Last source line reached | 60,501 |
| Release status | `complete` |
| Prefix archive | 8.3 MB |
| Runtime | about 85 seconds |
| Generated SQL | about 142 MB, 2,341 statements |
| `lookup_form` rows | 186,830 |

Four checks against that seed, on `wrangler dev` over the built Worker:

| Query | Observed |
|---|---|
| `?q=sale` | 5 entries, two labelled as mentions, and a two-candidate lemma link |
| `?q=casa` | 1 entry, gender and number shown as *not stated in the source* |
| `?q=citta` | the empty state — accents are significant |
| `?q=` | the opening hint |

## The twelve sampled queries, against the whole release

Run on this date against `it-0c432803` on the built Worker at
`http://localhost:8791`, one `curl` per query. Port 8791 rather than the
documented 8790, which a demo server held. Cards are `article.reading` elements
in the delivered HTML; mentions are cards labelled *Does not define …*.

The two counts beside each query are the ones
[the spot check](2026-09-18-dataset-spot-check.md#twelve-query-checks) states:
direct Italian records, and embedded matching forms. They are index rows, not
cards — four evidence rows over three records are three cards.

| Query | Report: direct / embedded | HTTP | Cards | Mentions | Observed |
|---|---|---|---:|---:|---|
| `casa` | 1 / 0 | 200 | 1 | 0 | 1 entry; gender and number *not stated in the source*; no forms, no conjugations, no article — each said in words |
| `case` | 1 / 0 | 200 | 1 | 0 | 1 entry, form-of link to `casa` |
| `studente` | 2 / 3 | 200 | 5 | 3 | 5 entries; the verb record carries **Disputed by later research** with its evidence link and claim pointer |
| `studenti` | 1 / 4 | 200 | 4 | 3 | 4 entries; three of them list the form in their own tables |
| `sale` | 3 / 2 | 200 | 5 | 2 | 5 entries; `salire` shows the auxiliary row as *not an inflected form* |
| `andare` | 2 / 0 | 200 | 2 | 0 | 2 entries; the verb's forms group by tense, each group saying the mood is not stated |
| `andavano` | 1 / 1 | 200 | 2 | 1 | 2 entries; the direct entry names the mood in prose, the table entry does not state it |
| `parlare` | 2 / 0 | 200 | 2 | 0 | 2 entries; grouped conjugations, `parlerei` among them with its conjugation-table source |
| `parlerei` | 1 / 1 | 200 | 2 | 1 | 2 entries; mood in prose on one, missing from the tags on the other |
| `bello` | 3 / 7 | 200 | **11** | 7 | 11 entries: four headword records, not three — see below |
| `bella` | 2 / 7 | 200 | 9 | 7 | 9 entries; every incoming edge lists all 4 candidates spelling `bello` |
| `città` | 1 / 0 | 200 | 1 | 0 | 1 entry, feminine and invariable stated, and still no article |

### `bello` returns one more entry than the spot check counted

The spot check matched `word` **case-sensitively**; the release's index is keyed
by the normalizer, which lowercases. `Bello` at line 34706 — a `name` record —
therefore matches here and did not match there:

| record | line | word | pos |
|---:|---:|---|---|
| 5781 | 33645 | `bello` | adj |
| 5782 | 33646 | `bello` | noun |
| 5783 | 33647 | `bello` | noun |
| 6367 | 34706 | `Bello` | name |

The other eleven queries match the report's direct and embedded counts exactly.
This is a difference between two ways of matching, not a difference in the data.

## Other states

| State | How it was produced | Observed |
|---|---|---|
| First load | `?q=` | the opening hint, no lookup run |
| Rejected, too long | `?q=` + 200 characters | *That is 200 characters. The limit is 128.* |
| Repeated parameter | `?q=sale&q=casa` | HTTP 200, `sale` searched; before this round the page raised a server error |
| Loading | a 2.5 s delay inserted in `web/app/db.ts`, built and served, then reverted | the first flush carried `<p class="pending" role="status">Searching for …` and no result cards; the answer replaced it when the read returned |

The loading state is the Suspense fallback in `web/app/page.tsx`. Against local
D1 the read finishes before the first flush, so a reader does not normally see
it; the delay above is how it was shown to exist in the delivered HTML.

## Accessibility spot checks on the delivered HTML

Taken from `?q=studente`, with the RSC payload scripts stripped:

| Check | Observed |
|---|---|
| Document language | one `lang="en"`, on `<html>` |
| Italian marked as Italian | 80 `lang="it"` elements: headwords, glosses, forms, labels, candidates |
| Landmarks | one `<main>`, one `<h1>`, one `<h2>` per entry, 21 labelled `<h3>` sections |
| Search form | `role="search"`, one `<label for="q">` |
| Disputed claim | one disputed block, on the verb record |

`web/test/page.test.tsx` asserts the same floor over a fixture release, so it is
checked on every run rather than on this date only.

## Limits

- One machine, one date, one archive. Different hardware gives different
  runtimes, and a different download gives different rows.
- The twelve queries were run against the full release; the four checks above
  them were run against the 25,000-record prefix. A query's outcome can differ
  between the two, and `citta` is one that does.
- No browser was used. These are HTTP responses and their HTML, not a rendered
  screenshot or a screen-reader run.
