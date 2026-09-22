# Content converter

`pnpm run convert -- --input it-extract.jsonl.gz --output content` converts an
archive directly into the content-file tree used for seeding. The converter
never opens or requires SQLite. It reports changed files, distinct words,
records, and bytes written; running it again against unchanged files reports
zero files and zero bytes. The release id defaults to `it-` plus the first eight
characters of the archive SHA-256 and can be set with `--release-id`.

## File identity and paths

A file is `it/<first>/<first-two>/<first-three>/<first-four>/<word>.json`.
The four components are the first one, two, three, and four Unicode code
points of the lowercased word. A non-letter becomes `_`, and missing code
points become `_`, so one-letter and punctuation-leading words are always
placeable. A letter whose Unicode case-folding could alias another code point
on a case-insensitive filesystem is percent-encoded in the directory
components. Filenames are
UTF-8 percent-encoded (including uppercase ASCII letters) so a source word
containing `/`, or differing only by case on a case-insensitive filesystem,
cannot escape or collide in its word-file directory.

Each entry key is `<escaped-pos>:<escaped-pos_title>`. `%`, `:` and `#` in either
component are escaped as `%25`, `%3A` and `%23`; this keeps a literal title such
as `X#2` distinct from the generated duplicate suffix `#2`. If a pair occurs
more than once for a word, records are sorted by source-line hash and receive
`#2`, `#3`, etc., so unchanged records retain their keys when a release reorders
that word's lines among themselves. A duplicate generated key fails conversion
instead of silently overwriting an entry. `sale` demonstrates title distinction;
`bello` demonstrates duplicate suffixes.

One ordering property is required of the archive rather than provided by the
converter: every record for a word must arrive in a single run of lines. A word
is written once, when its run ends, so a word returning later in the file would
reopen a finished document and lose what the earlier run wrote. Conversion
refuses such an archive by name and line instead of writing a file that looks
complete. The release this tree was built from holds 560,357 records in 541,247
runs with no word repeating, and the database this converter replaced sorted by
word, which is where the requirement comes from.

`manifest.json` at the tree root names the release and archive SHA-256. The
fixed four-level layout keeps a word's path stable; adaptive bucket splitting
was deliberately rejected because a new word could move every existing file in
a bucket and make a re-conversion diff unreadable. Re-conversion rebuilds each
word's `entries` from the new release, removes entries whose records vanished,
and deletes files for words that vanished when they have no editorial content.
A vanished word with editorial fields is retained as `status: "orphaned"`, with
those fields under `orphanedEntries` and its prior release under
`orphanedFromReleaseId`; it is never presented as current content. A current
word's dropped entries are removed from `entries` and their editorial fields,
if any, are retained under `orphanedEntries`.

Each word file names the release id, each entry carries its source line
SHA-256, and every source value carries its source line and JSON pointer;
together these identify the exact archive bytes. The converter writes only
source-derived fields; existing `lexema` fields (Italian explanation, English
explanation, and Italian example) and other editorial fields are preserved as
values. JSON is parsed and canonically re-serialized, so editorial values are
preserved but their original whitespace and key order are not.
