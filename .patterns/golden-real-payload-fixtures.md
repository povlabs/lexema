# Golden real-payload fixtures

How a test gets the source data it runs on: real archive lines and real
Wiktionary pages, committed verbatim under `fixtures/`; applies to every test of
the adapter, the seed, the lookup and the rendered page.

Adapted from phoenix's [golden-real-payload-fixtures](https://github.com/kamp-us/phoenix/blob/main/.patterns/golden-real-payload-fixtures.md).

## The shape

**A record fixture is a copy of archive lines, byte for byte.** Each `.jsonl`
fixture holds whole lines of `it-extract.jsonl.gz`, unedited, and a comment where
it is used says where they came from. From
[`test/recordQuality.test.ts`](../test/recordQuality.test.ts):

```ts
// Every record is a verbatim archive line: the twelve's words
// from fixtures/dev-seed.jsonl, the rest from fixtures/quality-regressions.jsonl
// (archive lines 196 `gallo`, 43791 `palo`, 139668 `vogare`, ...).
```

On 2026-10-01 every line of [`fixtures/dev-seed.jsonl`](../fixtures/dev-seed.jsonl)
(130), [`fixtures/quality-regressions.jsonl`](../fixtures/quality-regressions.jsonl)
(7), [`fixtures/macchina.jsonl`](../fixtures/macchina.jsonl) (3) and
[`fixtures/pantomima.jsonl`](../fixtures/pantomima.jsonl) (1) was found
unchanged in release `it-0c432803`.

**Load the file; never retype a record in the test.** Tests read the fixture
from disk and feed it to the real code, often through the seed itself
([`web/test/page.test.tsx`](../web/test/page.test.tsx)):

```ts
/** The real development fixture, `fixtures/dev-seed.jsonl`. */
const text = await readFile(join(REPO, "fixtures/dev-seed.jsonl"), "utf8");
```

So a count asserted on the page is a count of the real record, never a number
copied from a design frame.

**A raw page is saved verbatim, with its revision.** Pages under
[`fixtures/upstream-pages/`](../fixtures/upstream-pages/) and
[`fixtures/upstream-wikitext/`](../fixtures/upstream-wikitext/) are the wikitext
as it.wiktionary.org served it. The second directory's
[`PROVENANCE.md`](../fixtures/upstream-wikitext/PROVENANCE.md) says how and when
they were fetched, and each file carries its `revid`, so a reviewer can tell a
fetched page from a typed one.

**A synthetic fixture says so, and says why.** When the real words cannot reach
an edge case, a small made-up archive is allowed, and its header states what it
copies and what it does not. [`web/test/fixture.ts`](../web/test/fixture.ts) opens
with "It is not a copy of those lines", then lists what was shortened.

## When this applies

Any test whose input is a Kaikki record or a Wiktionary page: `test/`, `web/test/`
and the Python checks under `tools/`. A new regression case adds the real archive
line to a fixture and names its line number. The one test that needs the whole
release, [`test/integration/adapter-fixtures.test.ts`](../test/integration/adapter-fixtures.test.ts),
reads `it-extract.jsonl.gz` itself and is kept out of CI.

## Why it is not obvious

A hand-typed record is shorter and easier to read, so it is the first thing a test
author reaches for. But the source's quirks are the whole difficulty: tags
missing, glosses with stamps, other languages under an Italian heading. A typed
record carries only the quirks its author already knew, so the test passes on a
shape the archive never has. A verbatim line fails where the real data would.

The `lang_code` filter is the standing example: the file named Italian also holds
other languages ([dataset findings](../reports/dataset-findings.md)).
