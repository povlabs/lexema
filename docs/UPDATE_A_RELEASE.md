# Update the served release

Put a new release of the dictionary live without taking the site down, and roll
it back if it goes wrong. Why it works this way is
[IMPORT.md § Releases side by side](IMPORT.md#releases-side-by-side); the
first upload into an empty database is
[RUN_AN_IMPORT.md § Load a release into Cloudflare D1](RUN_AN_IMPORT.md#load-a-release-into-cloudflare-d1).

Every command runs from the repository root on an up-to-date `main`, from
Huey's laptop, signed in to Wrangler as for the first upload. Put
`CLOUDFLARE_ACCOUNT_ID=<account id>` first on any of them if
`pnpm --dir web exec wrangler whoami` lists more than one account.

## Before you start

- The new archive, fetched and identified as
  [REFETCH_A_RELEASE.md](REFETCH_A_RELEASE.md) says, saved as
  `it-extract.jsonl.gz` in the repository root. Its release id is `it-` and the
  first eight hex digits of its SHA-256.
- Its facts committed in [`src/source/archiveFacts.ts`](../src/source/archiveFacts.ts),
  keyed by that SHA-256. Without them the release records no download URL, time
  or source dump.
- Room for two releases. One is about 1.4 GB
  ([import measurements](../reports/2026-09-21-import-measurements.md)), and the
  old one stays until step 7.

## Put a new release live

1. **Check what the database holds.**

   ```sh
   SEED_REMOTE=lexema-dictionary pnpm run release list
   ```

   It prints one line per release and marks the one `web/wrangler.jsonc`
   serves. Go on only if no release reads `importing`.

2. **Seed the new release beside the served one.**

   ```sh
   SEED_INPUT=it-extract.jsonl.gz \
   SEED_SQL=.data/next-sql \
   SEED_REMOTE=lexema-dictionary \
   SEED_BESIDE=1 \
   pnpm run seed:dev
   ```

   The served release keeps answering throughout. The run is finished only when
   it prints `source_release: 1 row, complete` and then the
   `remote D1 lexema-dictionary database id:` line, which is the same id as
   before. If it stops, follow [If a seed stops](#if-a-seed-stops).

3. **List the releases again.** The new one reads `complete`, and nothing
   serves it yet.

4. **Try it on a Preview.** On a new branch, set `LEXEMA_RELEASE` in the
   `previews` block of `web/wrangler.jsonc` to the new release id, and open a
   pull request. Its Preview serves the new release from the shared database;
   production and every other Preview do not change. Search a few words there.

5. **Put it live.** In the same pull request, set `LEXEMA_RELEASE` in
   `env.production` to the new id too. Merging it deploys production
   ([DEPLOY.md](DEPLOY.md#deploy)), which then serves the new release.
   Production's `LEXEMA_RELEASE` only means something once production has its
   dictionary binding, [#19](https://github.com/hueypov/lexema/issues/19).

6. **Keep the old release while you might roll back.** It stays `complete` and
   answers anything that still names it.

7. **Retire the old release** once the new one has held.

   ```sh
   SEED_REMOTE=lexema-dictionary pnpm run release retire <old release id>
   ```

   It reads `superseded` and is no longer servable; its rows stay. The command
   refuses while any `LEXEMA_RELEASE` in `web/wrangler.jsonc` still names it.

## Roll back

1. **If the old release was retired, restore it first.**

   ```sh
   SEED_REMOTE=lexema-dictionary pnpm run release restore <old release id>
   ```

   It reads `complete` again.

2. **Put the previous Worker version back.** List production's recent
   deployments, pick the one from before the merge in step 5, and roll back to
   it:

   ```sh
   pnpm --dir web exec wrangler deployments list --name lexema-web
   pnpm --dir web exec wrangler rollback <version id> --name lexema-web --message "roll back to <old release id>"
   ```

   That version names the old release, so it serves it at once, with no build.

3. **Revert the pull request from step 5** on `main`. Otherwise the next merge
   deploys the new release again.

## If a seed stops

The served release is untouched whatever the seed did. Do not clear or delete
the database: it holds the served release.

1. Read the error. It names the failing part and the parts applied before it,
   or the tables and release fields that differed.
2. Make sure no seed is running. If the new release still reads `importing`,
   mark it failed:

   ```sh
   SEED_REMOTE=lexema-dictionary pnpm run release abandon <new release id>
   ```

3. Delete its rows, a batch at a time. It ends by printing the release id and
   `discarded`; if it stops before that, run it again.

   ```sh
   SEED_REMOTE=lexema-dictionary pnpm run release discard <new release id>
   ```

4. Fix the cause and go back to step 2 of [Put a new release live](#put-a-new-release-live).

## The same, locally

Each command above takes `SEED_STATE=<directory>` instead of
`SEED_REMOTE=lexema-dictionary` to work on a local database, such as the full
release in `.data/full-state`. There is no Preview or deploy step: a local run
picks its release with `--var LEXEMA_RELEASE:<id>` on `wrangler dev`
([RUN_THE_SITE.md](RUN_THE_SITE.md)).
