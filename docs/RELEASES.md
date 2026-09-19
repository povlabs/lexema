# Updating the dictionary

How a new dictionary release goes live, and how to get back off it. Four steps
in order — import, check, activate, retire — plus what to do when one of them
goes wrong.

The rule the whole flow rests on: **one lookup is served entirely from one
release.** The Worker reads `LEXEMA_RELEASE`, and every query, count and
attribution line on the page comes from that release alone. There is no query
anywhere that spans two.

What a release is, what its checksums mean, and what each gate check asserts are
in [docs/RELEASE_REFERENCE.md](RELEASE_REFERENCE.md).

## 1. Add the release

A new release is staged next to the live one. Nothing about it is visible until
the activation step.

```sh
pnpm run import -- --input it-extract.jsonl.gz --database .data/lexema.sqlite \
  --release-id it-2026-09 --retrieved-at 2026-09-19T00:00:00Z
```

Re-using a release id is refused, and so is importing into a database built by a
different schema version. Both are how you lose a release you meant to keep.

## 2. Check it before it goes live

```sh
# the file you just imported
pnpm run release -- check --release-id it-2026-09 --against it-2026-07 --verify-projection

# the database the Worker actually reads
export CLOUDFLARE_API_TOKEN=...      # D1 edit permission
pnpm run release -- check --release-id it-2026-09 --against it-2026-07 --d1 \
  --account-id <account> --database-id <d1-database-id>
```

`--d1` runs the same gate over D1's HTTP query API, so the thing being judged is
the thing about to be activated. Check locally before you upload, and check on
D1 before you flip `LEXEMA_RELEASE`. Check the database you are about to
activate, not a copy. `list`, `retire`, `restore` and `discard` take `--d1` too.

Every `FAIL` line names its check; the
[check reference](RELEASE_REFERENCE.md#the-gates-checks) says what each one
asserts. Go on to step 3 only on a clean run.

## 3. Activate, and roll back if it is wrong

Activation is one variable. `web/wrangler.jsonc` sets `LEXEMA_RELEASE`; change
it and deploy.

Rollback is the same variable, set back. The old release is still `complete` and
still in the database, so nothing has to be rebuilt or re-imported.

`LEXEMA_RELEASE` is part of the Worker version, so one version always reads one
release id, and a request resolves it once and passes that id to every query it
makes — no single response mixes two releases. A deploy is a rollout, not an
instant switch: while it runs, requests are served by either the old version or
the new one ([Cloudflare: versions and
deployments](https://developers.cloudflare.com/workers/versions-and-deployments/)).
We have not measured how long that window is.

There is no cache today. If one is added it must be keyed by release id, or a
rollback serves the new release's answers from the old release's page.

## 4. Retire the old release

Only once the new one has been live long enough to trust:

```sh
pnpm run release -- retire --release-id it-2026-07    # hide it
pnpm run release -- restore --release-id it-2026-07   # undo that
```

`retire` sets `superseded`, which hides the release from every read without
deleting a row. It does **not** check whether `LEXEMA_RELEASE` still points at
it — retiring the live release takes the site down, and `restore` is the way
back.

`discard` is the only command that deletes, and it only reaches a release stuck
at `importing`:

```sh
pnpm run release -- discard --release-id it-2026-09
```

A `complete` release still has readers and a `superseded` one is somebody's
rollback target, so neither is discardable. Deleting one of those is
`DELETE FROM source_release WHERE release_id = ?` typed out by hand, on purpose;
the foreign keys cascade the rest.

## Recovering from a bad import

| what happened | what you see | what to do |
| --- | --- | --- |
| import crashed partway | release stuck at `importing`, some records landed | nothing is served from it. `pnpm run release -- discard --release-id <id>`, then re-import. The cascade clears its children. |
| `check` reports a `projection` mismatch | a derived table is short or gone | do not activate. The database was written to after the import; discard the release and re-import. |
| import finished but `check` fails | `FAIL` lines naming the check | leave `LEXEMA_RELEASE` alone. The live release is untouched. |
| activated and it is wrong | bad answers on the page | set `LEXEMA_RELEASE` back, deploy. |
| retired one you still needed | every query errors with `no complete release` | `restore` it, then set `LEXEMA_RELEASE` back. |

## The open problem: reviews across releases

`claim_review` hangs off `record_id`, and `record_id` belongs to one release.
Re-importing the same source file produces new `record_id`s, so reviews written
against the old release do not follow to the new one.

Nothing here solves that, and nothing here silently guesses at it either — a
review stays attached to the exact record and JSON pointer it was written about.
Carrying reviews across a re-import needs an identity that survives one, which
is #12's question, not this file's.
