# Empty readings fixtures

The inputs of [test/emptyReadings.test.ts](../../test/emptyReadings.test.ts) and
of the #803 page test in [web/test/page.test.tsx](../../web/test/page.test.tsx)
(#803, ADR 0031's amendment of 2026-10-18). Every file is verbatim.

- `archive-lines.jsonl`: lines of `it-extract.jsonl.gz`, release `it-0c432803`,
  in archive order, each with its SHA-256:

  | Line | Record | SHA-256 |
  |---|---|---|
  | 1882 | `quindici`, Aggettivo numerale | `be8dde8857257407af2a557095fb5751adb5f2dec96a5fb746f6d374bcaed232` |
  | 1883 | `quindici`, Sostantivo | `5b98f315c31405035ff187814700ef58c341af693055bbe3943b40f0de8319c3` |
  | 2323 | `uno`, Aggettivo numerale | `4b9b2a43a28de98f6ca1136da6724730f44fe9c3b7678055da4e03cf7cef2b89` |
  | 2324 | `uno`, Articolo | `e28ba544c7893a1f8f90d460a9d91aceb5e60bbc97b8bf7108de2bd9f44f78d2` |
  | 2325 | `uno`, Pronome | `b546f3a194a43a9559a69866f1bcf565103d5223abf66d511f0d349c228f080e` |
  | 2326 | `uno`, Sostantivo | `98e6b4dacb81127553ee6bc17853f980e83cb57c1380a535dedae853b7121c1e` |
  | 25470 | `un`, Articolo | `56ff17a5be06aba69d42e6853239845a688fa6449bbeb37381a5b9306bf45a0c` |
  | 25471 | `un`, Aggettivo numerale | `6d4f5d161c6f9c767d719c3d0d8def9140b5a49d41e0bd797530e52a9997632a` |
  | 30901 | `Giulia`, Nome proprio | `e154e9f3ddfddb7b784d43d9f586c9652bee490ad0deeb56868dc8eeea3b06ad` |
  | 56345 | `in ritardo`, Locuzione aggettivale | `75dfd9b99874e9ae3dec60422a7e3bbbc70d640e3160b27926aacd96fc37b70e` |
  | 56346 | `in ritardo`, Locuzione avverbiale | `90ed13930c95d70f7540dfd215cc4c9672006ea7ae796c14a767bc5e5fbd7321` |
  | 115580 | `scorso`, Aggettivo | `7510c83ec9e176b8bb7863c2531545f223178bb83721cc7d4a6bb7db0f8ffb5e` |
  | 115581 | `scorso`, Voce verbale | `b3162a19fd78751c93f0d7169bdcf62b1194898cf21d649b7313e7d480465e83` |

  These are every Italian record of the six words.
- `<title>.wikitext`: it.wiktionary's page at the revision dump
  `itwiktionary-20260701` holds, read on 2026-10-18 with
  `https://it.wiktionary.org/w/index.php?title=<title>&oldid=<revision>&action=raw`.
  Each file's SHA-1 equals the one the MediaWiki API states for the revision
  (`action=query&prop=revisions&rvprop=ids|timestamp|sha1|size`):

  | File | Revision | Saved | SHA-1 |
  |---|---|---|---|
  | `in ritardo.wikitext` | 4053044 | 2025-12-11T17:57:48Z | `fc5c840efd504d1789ee467dc964f71eaf651d9a` |
  | `scorso.wikitext` | 3920837 | 2023-01-21T10:14:02Z | `806d9744517074d5772ee9dacd4de9f16a3f3edf` |
  | `quindici.wikitext` | 4070131 | 2026-04-10T16:12:10Z | `af0b6fb56c6ce2d828e555e9501e9f5d8d254d90` |
  | `Giulia.wikitext` | 3863404 | 2022-07-23T06:27:31Z | `66d3a9b5deada1d70491a34545407767a9ce2f7b` |
  | `uno.wikitext` | 4012236 | 2025-01-21T23:03:59Z | `3a5eb19f2babbbe9d3b45cd7690fdc09223753d3` |

The en.wiktionary revisions the filled readings cite are in
[`../hand-kept-readings/`](../hand-kept-readings/PROVENANCE.md).
