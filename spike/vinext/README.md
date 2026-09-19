# vinext + D1 spike — THROWAWAY

Not product code. Do not build on this directory.

It exists to answer one question: can vinext render React on the Cloudflare
Workers runtime and read a real D1 database? What it taught us is in
[`docs/SPIKE_VINEXT_D1.md`](../../docs/SPIKE_VINEXT_D1.md). Versions, scripts
and other lookup facts are in [`docs/REFERENCE.md`](docs/REFERENCE.md).

The table in `db/seed.sql` is deliberately dumb and the words are fake.
The real Lexema schema is designed elsewhere (#3).

## Prove it

Local only. Nothing here talks to Cloudflare's servers.

```bash
cd spike/vinext
pnpm install --frozen-lockfile
pnpm run proof
```

`scripts/proof.sh` seeds D1, builds the Worker, starts it under wrangler, and
asserts on real rows. It fails loudly if any step regresses.

Expected tail:

```
== 4/5 route handler -> D1
{"q":"casa","count":2,"rows":[{"id":1,"lemma":"casa","pos":"noun","gloss":"FAKE SEED DATA - a house"},{"id":2,"lemma":"casa","pos":"verb","gloss":"FAKE SEED DATA - third person of casare"}]}

== 5/5 server-rendered React page -> D1
<main>...<li data-row-id="3"><strong>gatto</strong> <em>(noun)</em> — FAKE SEED DATA - a cat</li>...</main>

== bonus: client component hydration
data-hydrated: no (server) -> yes (after hydration)

PASS — vinext served real D1 rows from the Workers runtime.
```

The hydration step needs Google Chrome at the usual macOS path. Without it the
step is skipped and the rest still runs.

## If it fails

**`EADDRINUSE ... 127.0.0.1:8788`** — something else holds the port. Stop it, or
run with another port: `PORT=8799 pnpm run proof`.

**`no such table: spike_words`** — `--persist-to` reached the wrong directory.
It must be an **absolute** path: wrangler resolves it against the config file,
and the generated config sits in `dist/server/`.

**`Response is not from this proof run`** — a server that is not this run
answered. Kill the other listener and start again.
