# Content converter

`pnpm run convert -- --database .data/lexema.sqlite --output content` converts a
completed SQLite release into the content-file tree used for seeding. The
converter does not read the archive. It reports changed files, distinct words,
records, and bytes written; running it again against unchanged files reports
zero files and zero bytes.

## File identity and paths

A file is `it/<first>/<first-two>/<first-three>/<word>.json`. The three
components are the first one, two, and three Unicode code points of the
lowercased word. A non-letter becomes `_`, and missing code points become `_`,
so one-letter and punctuation-leading words are always placeable. Filenames are
UTF-8 percent-encoded (including uppercase ASCII letters) so a source word
containing `/`, or differing only by case on a case-insensitive filesystem,
cannot escape or collide in its word-file directory.

Each entry key is `<pos>:<pos_title>`. If that pair occurs more than once for a
word, records are sorted by source line and receive `#2`, `#3`, etc. Therefore a
key resolves to exactly one record. `sale` demonstrates the title distinction;
`bello` demonstrates the deterministic suffix for two records whose title is
also identical.

`manifest.json` at the tree root names the release and archive SHA-256. Each
word file names the release id, each entry carries its source line SHA-256, and
every source value carries its source line and JSON pointer; together these
identify the exact archive bytes. The converter writes
only source-derived fields; existing `lexema` fields (Italian explanation,
English explanation, and Italian example) and other editorial fields are
preserved byte-for-byte.
