# Hand-kept readings fixtures

The inputs of [test/handKeptReadings.test.ts](../../test/handKeptReadings.test.ts)
(#745, ADR 0031). Every file is verbatim.

- `archive-lines.jsonl`: lines 963 (`si`, noun), 113594 (`come`, adverb) and
  113595 (`come`, preposition) of `it-extract.jsonl.gz`, release `it-0c432803`,
  in archive order. Their SHA-256 digests are
  `1c4712bab318a2c19e88efba51ce5abaae20a45948b04cd8134177032724df11`,
  `df1d52ac4ae6239413a4f58551bc718ace5ef9a87ac751161823a19283951141` and
  `a9bce03fc72bec097674f12a54fb6e0da4a6be475a43d5a1979179df752fc20f`. These are
  the only Italian records of the two words.
- `si.wikitext`: en.wiktionary `si`,
  [revision 93469502](https://en.wiktionary.org/w/index.php?title=si&oldid=93469502)
  (2026-10-09T07:58:42Z, SHA-1 `8f26f4c46545ebc2d6fabaa1634b4498aca96bef`).
- `come.wikitext`: en.wiktionary `come`,
  [revision 93379611](https://en.wiktionary.org/w/index.php?title=come&oldid=93379611)
  (2026-10-03T08:45:29Z, SHA-1 `acb6809d4959824f60b5f2ef3342b354a8320940`).

Both revisions were read on 2026-10-09 with
`https://en.wiktionary.org/w/index.php?title=<title>&oldid=<revision>&action=raw`.
Each file's SHA-1 equals the one the MediaWiki API states for the revision
(`action=query&prop=revisions&rvprop=ids|timestamp|sha1|size`).
