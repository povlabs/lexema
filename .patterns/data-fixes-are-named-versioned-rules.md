# Data fixes are named, versioned rules

How a fix to the dictionary's data is written: a fixed rule with a name and a
version, applied by the seed and by a one-off update of a seeded database; applies
to `src/italian/`, `src/import/` and every `pnpm run` command that changes stored
dictionary rows.

## The shape

A data fix is never an edit of rows by hand. It is a rule
([ADR 0019](../.decisions/0019-source-text-may-be-normalized.md),
[ADR 0023](../.decisions/0023-foreign-records-are-hidden-not-deleted.md)):

1. **Named and versioned in code.** Each rule has an id ending in `/vN`, declared
   once ([`src/italian/sourceTextNormalization.ts`](../src/italian/sourceTextNormalization.ts)):

   ```ts
   export const SOURCE_TEXT_RULES = {
     personOrdinalGloss: "gloss-person-ordinal/v1",
     pluralPlaceholderForm: "form-plural-placeholder/v1",
     headwordLeadGloss: "gloss-headword-lead/v1",
   } as const;
   ```

   `it-gloss-stamp/v1` and `section-language/v1` sit beside the code they name.
   Changing what a rule matches or writes is a new version, never an edit of the
   old one.
2. **One function, two callers.** The seed applies the rule as it writes rows.
   A one-off update applies the same function to a database seeded before the
   rule existed: `pnpm run normalize:source-text`
   ([`src/import/normalizeSourceTextCli.ts`](../src/import/normalizeSourceTextCli.ts))
   or `pnpm run hide:records`
   ([`src/import/hideRecordsCli.ts`](../src/import/hideRecordsCli.ts)).
3. **The raw line is never touched.** `source_record_json` keeps the archive line
   byte for byte, so the original is always provable.
4. **It reports by rule, and a second run changes nothing.** Each update prints
   one line per rule, led by its id, with the rows it changed. The test runs it
   twice ([`test/sourceTextNormalization.test.ts`](../test/sourceTextNormalization.test.ts)):

   ```ts
   assert.deepEqual(normalizeStoredGlosses(sql), { rule: "gloss-person-ordinal/v1", candidates: 3, changed: 3 });
   assert.deepEqual(rawLines(db), LINES);
   assert.deepEqual(normalizeStoredGlosses(sql), { rule: "gloss-person-ordinal/v1", candidates: 0, changed: 0 });
   ```

   [`test/hiddenRecords.test.ts`](../test/hiddenRecords.test.ts) does the same for
   `hide:records`: the update brings an old database to what a seed now writes,
   and a second run plans nothing.
5. **An agent never writes the shared D1.** The update picks its database the way
   the seed does: the local D1 under `SEED_STATE`, or the remote one `SEED_REMOTE`
   names. The shared `lexema-dictionary` is updated from Huey's laptop through
   Wrangler, never through the Worker's read-only binding
   ([docs/RUN_AN_IMPORT.md](../docs/RUN_AN_IMPORT.md)). A lane runs and tests it
   against a local D1 only.

## When this applies

Any change to what the dictionary stores from a release: a rewrite of source text,
a hidden record, a dropped form. Each new rule is its own issue with its row count
in the current release (ADR 0019). It does not cover the search keys built in
`src/italian/normalize.ts`, which are derived at seed time and never stored as
text a reader sees, or the app tables, which Drizzle migrations change
([ADR 0017](../.decisions/0017-better-auth-and-drizzle-own-accounts.md)).

## Why it is not obvious

The quick fix is an `UPDATE` run once against the shared database. It leaves no
trace of which rows changed or why, a fresh seed brings the old text back, and
nothing proves the change was the only one. A rule with a version, applied the
same way at seed time and by the update, gives every changed row a name, makes a
reseed agree with an updated database, and turns "did it run?" into a zero on the
second run.
