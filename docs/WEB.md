# The search page

A Cloudflare Worker that renders one search box and one result page. React on
the server, D1 underneath, no client-side fetching.

## Run it locally

```sh
pnpm install --frozen-lockfile
pnpm run seed:dev                       # ~90 s, builds a dev release and loads local D1
pnpm --filter @lexema/web build
cd web && pnpm exec wrangler dev --config dist/server/wrangler.json \
  --persist-to "$PWD/.wrangler/state" --port 8790
```

Then <http://localhost:8790/?q=sale>.

Nothing here touches a Cloudflare account. `wrangler dev` runs the Worker on
workerd locally and `--local` D1 is a miniflare SQLite file. Deploying is #19
and is blocked on licensing (#6) anyway.

## How it is put together

```
web/app/page.tsx      the search form and the four outcomes
web/app/Reading.tsx   how one entry renders
web/app/db.ts         the D1 binding
src/lookup/           the query layer, shared with the importer's tests
```

`web/` is a workspace package so there is still exactly one lockfile at the
root, which is what ADR 0002 asks for. It reaches the lookup layer through a
Vite alias rather than a copy — two copies of a query layer drift apart.

**Reaching D1 from server code in vinext:** there is no framework helper and no
`getCloudflareContext()`. You import the Workers runtime's own `env`:

```ts
import { env } from "cloudflare:workers";
const db = fromD1(env.DB);
```

The spike (#27) established that. `env.LEXEMA_RELEASE` picks which imported
release to serve; flipping it safely is #18.

## The page is a server component

The query arrives in the URL, the D1 read happens on the Worker, and the HTML
that comes back already contains the answer. Three things follow: the page works
before any JavaScript loads, a result is shareable by copying the address bar,
and there is no loading state to get wrong.

## Being visibly silent

The point of this page is that it does not pretend. Five things it says out loud
rather than hiding:

**A record that only mentions the word.** Searching `sale` returns five entries,
and two of them — `sala` and `salire` — merely list `sale` in their own tables.
Each is labelled *"Does not define sale — it lists the form in its own table."*
Without that, a reader would take `salire` to be the lemma of `sale`, which the
source never said.

**An ambiguous lemma link.** `sale` says it is the plural of `sala`, and `sala`
is two entries, a noun and a verb. The page says *"2 entries share this
spelling: noun, verb"* instead of picking one.

**Grammar the source never stated.** `casa` shows `gender — not stated in the
source` and `number — not stated in the source`, as dashed chips. That reads
differently from a word whose gender simply was not expected.

**Definitions that define nothing.** `casa`'s two glosses are page furniture
(`casa ( approfondimento) f sing`) and `sala` carries the source's own
*"definizione mancante; se vuoi, aggiungila tu"*. Both are shown verbatim.
Filtering them would hide how incomplete this data is, which is the one thing
this page must not do.

**A lookup that did not happen.** If the D1 read throws — no release, a D1
error, a release built by a different normalizer — the page says the lookup
failed and shows the reason. That is deliberately not the same message as "found
nothing": a reader must be able to tell *we could not look* from *we looked and
the word is not here*.

A disputed claim renders with a warning and a link to the evidence, and the
claim itself is left untouched. Nothing writes those rows yet — that is #12.

## Following a reading back to the source

Each reading ends with a link to the Italian Wiktionary page for that record's
headword, next to the release line number and the JSON pointers the reading was
built from. The release stores no per-record URL, so the link is built from the
headword and is labelled *"Wiktionary page for X"* rather than presented as a
citation of the reading itself. The line number and pointers are the exact
provenance; the link is the part a reader can click.

## The development seed

`pnpm run seed:dev` imports the first `SEED_RECORDS` records (default 25,000,
about ninety seconds, 142 MB of SQL) and loads them into local D1.

It is a **prefix of the archive, not a sample**, so coverage stops at a source
line number. 25,000 records reaches line 60,501, which covers `casa`, `case`,
`sale`, `sala`, `salire`, `studente`, `studenti`, `bella`, `bello`, `andare`,
`andavano`, `città` and `parlare`. Words further in are simply absent, and the
page will honestly say it found nothing. `SEED_RECORDS=560000` would load the
whole release, but the SQL is gigabytes and the loader is slow.

Local D1 is only reachable through `wrangler d1 execute --file`, so the seed
goes via generated SQL rather than by handing miniflare the SQLite file the
importer already built. Two things that cost time and are now handled:
statements are batched to **64 KiB** (wrangler refuses around 119 KB with a bare
`SQLITE_TOOBIG` and no hint which table caused it), and `--persist-to` must be an
absolute path because wrangler resolves it relative to the config file.

The seed is **repeatable**: the generated SQL creates the schema and inserts the
release, so loading it into a database that already has a seed would collide on
duplicate rows. The script therefore deletes the persisted local D1 database
(`web/.wrangler/state/v3/d1`) before loading. It holds nothing the seed cannot
rebuild, so re-running `pnpm run seed:dev` needs no manual cleanup.

## Known rough edges

- `form-of` renders as an *unclassified* grammar chip next to the "Form of"
  section, which is redundant. It is left in rather than filtered, because
  hiding source data by hand is how you stop noticing what the source contains.
- No favicon, so the dev log carries a 404 for it.
- Styling is deliberately plain. This is the first working page, not a design.

## Not in scope

Autocomplete (#15). Pronunciation and examples (#20). Deployment, rate limits
and smoke tests against a real URL (#19).
