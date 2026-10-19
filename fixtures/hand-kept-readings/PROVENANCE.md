# Hand-kept readings fixtures

The inputs of [test/handKeptReadings.test.ts](../../test/handKeptReadings.test.ts)
(#745, #830, #803, ADR 0031). Every file is verbatim.

- `archive-lines.jsonl`: lines 963 (`si`, noun), 55329 (`uguaglianza`, noun),
  113594 (`come`, adverb) and 113595 (`come`, preposition) of
  `it-extract.jsonl.gz`, release `it-0c432803`, in archive order. Their SHA-256
  digests are
  `1c4712bab318a2c19e88efba51ce5abaae20a45948b04cd8134177032724df11`,
  `4e6edf62ea926dfc93715a25e5ff63a46a7469e3f6d5e4f6e9c0eecdf06ba294`,
  `df1d52ac4ae6239413a4f58551bc718ace5ef9a87ac751161823a19283951141` and
  `a9bce03fc72bec097674f12a54fb6e0da4a6be475a43d5a1979179df752fc20f`. The
  `si` and `come` lines are the only Italian records of the two words; the
  release has no record of `eguaglianza`, and `uguaglianza` is the word its
  reading leads to.
- `si.wikitext`: en.wiktionary `si`,
  [revision 93469502](https://en.wiktionary.org/w/index.php?title=si&oldid=93469502)
  (2026-10-09T07:58:42Z, SHA-1 `8f26f4c46545ebc2d6fabaa1634b4498aca96bef`).
- `come.wikitext`: en.wiktionary `come`,
  [revision 93379611](https://en.wiktionary.org/w/index.php?title=come&oldid=93379611)
  (2026-10-03T08:45:29Z, SHA-1 `acb6809d4959824f60b5f2ef3342b354a8320940`).
- `eguaglianza.wikitext`: en.wiktionary `eguaglianza`,
  [revision 71378670](https://en.wiktionary.org/w/index.php?title=eguaglianza&oldid=71378670)
  (2023-02-23T01:13:31Z, SHA-1 `fc6d49bcc5f9a51eb405f4773b3daed4b5973b55`),
  read on 2026-10-17.
- `Sig..wikitext`: en.wiktionary `Sig.`,
  [revision 89865273](https://en.wiktionary.org/w/index.php?title=Sig.&oldid=89865273)
  (2026-03-16T03:33:51Z, SHA-1 `fbc9c19ad72fb95042c35167ff1d1917117795da`),
  read on 2026-10-17 (#819).
- `cosetta.wikitext`: en.wiktionary `cosetta`,
  [revision 63388291](https://en.wiktionary.org/w/index.php?title=cosetta&oldid=63388291)
  (2021-07-25T12:22:57Z, SHA-1 `686397025e45ac1dbca8eee827f3583ac178a47d`),
  read on 2026-10-17 (#819).
- `in ritardo.wikitext`, `scorso.wikitext`, `quindici.wikitext` and
  `Giulia.wikitext`: en.wiktionary's pages the readings #803 fills cite,
  [in ritardo revision 80039828](https://en.wiktionary.org/w/index.php?title=in%20ritardo&oldid=80039828)
  (2024-06-02T22:59:05Z, SHA-1 `602e20266c8b0f8880a822b5463c54c7124ea0c5`),
  [scorso revision 90562962](https://en.wiktionary.org/w/index.php?title=scorso&oldid=90562962)
  (2026-05-09T11:16:46Z, SHA-1 `37d4d2c8a488637cdd122603c1da8725e683b014`),
  [quindici revision 90558905](https://en.wiktionary.org/w/index.php?title=quindici&oldid=90558905)
  (2026-05-09T08:29:35Z, SHA-1 `5776ca48ff39baf082adda77d95a08624b3900ee`) and
  [Giulia revision 90576577](https://en.wiktionary.org/w/index.php?title=Giulia&oldid=90576577)
  (2026-05-09T15:43:32Z, SHA-1 `0376571092f96b8f1934fe668fad9dff3208fdbe`),
  read on 2026-10-18. Their records and it.wiktionary pages are in
  [`../empty-readings/`](../empty-readings/PROVENANCE.md).
- `lookup-lines.jsonl`, the inputs of
  [test/handKeptWords.test.ts](../../test/handKeptWords.test.ts) (#819): line
  36245 (`Cosetta`, proper name) of `it-extract.jsonl.gz`, release
  `it-0c432803`, SHA-256
  `c3d6864cf404e6ab4c718fd497b0d52ff0ca7908c6859d3d7df83b58cb4c43ad`, the only
  record whose word is `cosetta` in any case; then line 801536 (`Dr.`,
  abbreviation) of release `it-78385b62`, SHA-256
  `66631244276836e177999ecb35441ca35bd29942f6c0c1536ed8f388e3dd94eb`, the
  record the live dictionary answers `dr.` with. Release `it-0c432803` has no
  `Dr.` record; the line was read from the `source_record_json` row the
  `it-0c432803` to `it-78385b62` update plan writes, and its digest equals the
  `line_sha256` that plan states for it.

The `si` and `come` revisions were read on 2026-10-09, the others on the date
they give, each with
`https://en.wiktionary.org/w/index.php?title=<title>&oldid=<revision>&action=raw`.
Each file's SHA-1 equals the one the MediaWiki API states for the revision
(`action=query&prop=revisions&rvprop=ids|timestamp|sha1|size`).
