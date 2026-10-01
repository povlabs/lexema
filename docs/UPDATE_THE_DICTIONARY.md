# Update the dictionary from a later kaikki release

Take chosen changes from a newer kaikki Italian file into the dictionary
database, the master, without rebuilding it. Why it works this way is
[UPDATES.md](UPDATES.md); this page is the steps, in order.

## Before you start

- The archive the master was seeded from is not needed. The later one is.
- For the shared `lexema-dictionary`: Wrangler signed in to the Cloudflare
  account, as for the upload in
  [RUN_AN_IMPORT.md](RUN_AN_IMPORT.md#load-a-release-into-cloudflare-d1). Put
  `CLOUDFLARE_ACCOUNT_ID=<account id>` first on every command below if
  `pnpm --dir web exec wrangler whoami` lists more than one account.
- The commands pick their database the way the seed does: the remote D1
  `SEED_REMOTE` names, or else the local D1 under `SEED_STATE` (default
  `.data/seed-state`). The examples use the shared dictionary.
- Both commands run from the laptop, through Wrangler. Nothing here goes through
  the Worker, whose dictionary binding only reads
  ([ADR 0018](../.decisions/0018-previews-on-workers-builds.md)).

## Once: a dictionary seeded before #18

Lookups read the view `served_release`, which a dictionary seeded before #18
lacks: on one, every lookup fails with `no such table: served_release`. Give it
the tables and views once, before code that reads them serves from it:

```sh
SEED_REMOTE=lexema-dictionary pnpm run update:upgrade
```

It writes no row, only the two tables and the views, read out of
`src/db/schema.sql`, and says so. Run again, it does nothing. Code from before
#18 never reads them, so it serves the same afterwards. The first apply would
add them too, but lookups need them before any change is applied.

## 1. Check for a new build

kaikki rebuilds its Italian file about weekly and publishes no changelog
([#132](https://github.com/hueypov/lexema/issues/132)). Ask for its headers:

```sh
curl -sI https://kaikki.org/dictionary/downloads/it/it-extract.jsonl.gz | grep -iE 'last-modified|content-length'
curl -s https://kaikki.org/dictionary/downloads/it/it-extract.log | grep -m1 'dump file path'
```

A new `last-modified`, a new size, or a new `itwiktionary-YYYYMMDD` dump in the
log means a new build. If none moved, stop here.

Fetch it with [REFETCH_A_RELEASE.md](REFETCH_A_RELEASE.md), which keeps the
headers, checksum and build log that say which build it is. Keep the `.gz`: the
apply reads the same file, and its id is `it-` plus the first eight hex digits
of its SHA-256.

## 2. Run the diff

```sh
SEED_REMOTE=lexema-dictionary pnpm run update:diff <path to the later .jsonl.gz>
```

It reads the master and the file and writes nothing to the database. It prints
the count of each group, then writes the report to `.data/updates/` (or
`--out <dir>`):

- `diff-<master>-<later>.md`, to read;
- `diff-<master>-<later>.json`, the same, as data.

On the full release it reads every record of the master, about 560,000, so it
takes about five minutes on a laptop against a local copy ([the September measurement](../reports/2026-10-01-update-diff-september.md)).

## 3. Choose

Read the Markdown report. Its groups are:

| Group | What it is | Can be applied |
|---|---|---|
| New words | a word and part of speech the master does not hold | yes |
| Changed or fixed senses | one record on each side, senses differ | yes |
| Other changes, senses the same | one record on each side, another field differs | yes |
| Lost words | a master record the later file has no record of its word and part of speech for | no: reported, never removed |
| Ambiguous groups | several unmatched records of one word and part of speech | no: no pairing is guessed |

Write down the ids of the changes to take: `new-…` and `chg-…`, twelve hex
digits each.

## 4. Apply

Before the shared dictionary, note where to go back to if needed:

```sh
pnpm --dir web exec wrangler d1 time-travel info lexema-dictionary
```

Keep the bookmark it prints. For a local master, copy its `SEED_STATE`
directory instead.

Then apply, naming the same file and the chosen ids:

```sh
SEED_REMOTE=lexema-dictionary pnpm run update:apply <path to the later .jsonl.gz> <id> <id> ...
```

It runs the diff again and refuses, writing nothing, if any id is not a change
that diff finds, names a lost word, or is not an id at all. Otherwise it writes
one SQL file to `.data/updates/` and runs it with
`wrangler d1 execute --file`, as one transaction: the dictionary does not
answer while it runs, a matter of seconds for a few changes. It ends by
listing each change with its record id, and the rows written per table.

## 5. Verify

1. The apply reads the dictionary back before it says `applied`: every change
   is recorded and every record's rows are there. A run that printed
   `applied N change(s)` passed that check.
2. Run the diff of step 2 again. The changes applied are no longer listed; the
   rest are, under the same ids.
3. Look the words up on a Preview or the site. A fixed word shows the later
   release's senses, and its *Source* link names the later release and its
   line. A word not chosen still shows the master's.

## If an apply stops

An apply that did not print `applied` either refused before writing, and says
why, or ran its file and failed, in which case D1 kept the dictionary as it was
before. Either way nothing was applied. Fix the cause and run the same command
again.

## If an apply reads back wrong

If the apply ran but says the dictionary does not read back as planned, the
changes are in and something is wrong with them. Go back to the bookmark from
step 4:

```sh
pnpm --dir web exec wrangler d1 time-travel restore lexema-dictionary --bookmark=<bookmark>
```

For a local master, put the copied `SEED_STATE` directory back. Then file an
issue with the apply's output and its SQL file.
