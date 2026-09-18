# vinext + D1 spike — THROWAWAY

Not product code. Do not build on this directory.

It exists to answer one question: can vinext render React on the Cloudflare
Workers runtime and read a real D1 database? Findings live in
[`docs/SPIKE_VINEXT_D1.md`](../../docs/SPIKE_VINEXT_D1.md).

The table in `db/seed.sql` is deliberately dumb and the words are fake.
The real Lexema schema is designed elsewhere (#3).

## Prove it

```bash
pnpm install --frozen-lockfile
pnpm run proof
```

Local only. Nothing here talks to Cloudflare's servers; `pnpm run deploy` was
removed on purpose.

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm run dev` | vinext dev server |
| `pnpm run build` | build the Worker into `dist/` |
| `pnpm run start` | run the built Worker under wrangler (workerd) |
| `pnpm run db:seed` | seed the local D1 database |
| `pnpm run typecheck` | regenerate Workers types, then `tsc --noEmit` |
| `pnpm run proof` | all of the above, with assertions |

## Gotcha

`--persist-to` must be an **absolute** path. wrangler resolves it against the
config file, and the generated config sits in `dist/server/`. Get this wrong and
the built Worker quietly reads an empty database.
