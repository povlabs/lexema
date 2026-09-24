# How to re-fetch an identified release

Fetch the Italian extract from kaikki.org and capture, in one go, everything
needed to say which release it is. Why a release has to be identifiable at all,
and what the July 2026 snapshot is missing, is
[LICENSING.md §1](LICENSING.md#1-what-the-local-file-actually-is); this page is
the operation.

## Before you start

- `curl`, `shasum` and `python3` on the path. No repository tooling is involved.
- A directory to write five files into. They belong beside the `.gz` in the
  immutable release store, not in the working tree.
- Roughly a minute. The download is about 40 MB, the build log about 154 kB, and
  the edition page is one HTTP GET.

kaikki overwrites `it-extract.jsonl.gz` in place and publishes no checksum, so
identity has to be captured at fetch time. Nothing here can be recovered later.

## Run it

Set the two variables once, then run the five steps in order. Step 1 must come
first: the response headers have to belong to the body fetched with them.

```sh
BASE=https://kaikki.org/dictionary/downloads/it
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
```

1. **Fetch the archive and the build log, keeping the response headers.**

   ```sh
   curl -sS -D "release-$STAMP.headers" -o "it-extract-$STAMP.jsonl.gz" "$BASE/it-extract.jsonl.gz"
   curl -sS -o "it-extract-$STAMP.log" "$BASE/it-extract.log"
   ```

2. **Checksum the bytes you actually received.**

   ```sh
   shasum -a 256 "it-extract-$STAMP.jsonl.gz" > "it-extract-$STAMP.sha256"
   ```

3. **Read the upstream dump this build came from.**

   ```sh
   grep -m1 "dump file path" "it-extract-$STAMP.log"
   ```

   The line names a file such as
   `itwiktionary-20260901-pages-articles.xml.bz2`. That name is the only true
   statement of which Wiktionary snapshot the data is.

4. **Read the upstream build time out of the gzip header.**

   ```sh
   python3 -c "import struct,sys,datetime;h=open(sys.argv[1],'rb').read(8);print(datetime.datetime.fromtimestamp(struct.unpack('<I',h[4:8])[0],datetime.timezone.utc).isoformat())" "it-extract-$STAMP.jsonl.gz"
   ```

   gzip stores the modification time of the source file at compression time, so
   this is when the upstream `.jsonl` was last written.

5. **Save the per-edition page, whose footer names the extractor commits.**

   ```sh
   curl -sS https://kaikki.org/itwiktionary/ -o "kaikki-itwiktionary-$STAMP.html"
   ```

   The footer reads like
   `extracted on 2026-09-16 from the itwiktionary dump dated 2026-09-01 using
   wiktextract (d6fca27 and 65e1673)`. Extraction bugs are release-specific, so
   without those commits a bug report cannot be reproduced.

## When you are done

Store all five outputs — archive, headers, log, checksum, edition page — beside
each other in the release store, and record the fields they supply:
`upstreamDumpName`, `upstreamDumpDate`, `extractorVersion`, `upstreamBuiltAt`,
`httpEtag`, `httpLastModified`, and `identityConfidence: verified`. The field
list and what each one is for is in
[Attribution notices and release metadata](ATTRIBUTION_NOTICES.md#release-metadata-to-retain).

A release fetched any other way is `inferred` at best. The July snapshot is one,
published with its dump recorded as inferred by ADR 0013 (PR #130); see
[LICENSING.md §1.3](LICENSING.md#13-the-one-reasonable-inference--and-its-limit).
