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
  `line_sha256` that plan states for it. Then, for #915, lines 1654
  (`società`, noun) and 47726 (`attività`, noun) of release `it-0c432803`,
  SHA-256 `310240dc4cdc63eda924c06e750b15beaee736e6a228ea459d794277e692c619`
  and `c59d8eddbad2afbdb8524c15dcac826736e3175e0c3dd81b7f94a26a4f26d4f0`, the
  only Italian records of the two words, which `societa'` and `attivita'`
  open.
- The thirty-nine pages #915's readings cite, the common words of the 2026-10-20
  recount ([report](../../reports/2026-10-20-missing-common-words.md)), read
  on 2026-10-21. `scartoffia` stands for `scartoffie`, which en.wiktionary
  gives only as its plural.

| File | en.wiktionary revision | Saved | SHA-1 |
|---|---|---|---|
| `glielo.wikitext` | [88460023](https://en.wiktionary.org/w/index.php?title=glielo&oldid=88460023) | 2025-12-10T07:50:02Z | `8d5350983f15d601a3caf47b03b1ec26213a65f0` |
| `gliel'.wikitext` | [88460011](https://en.wiktionary.org/w/index.php?title=gliel'&oldid=88460011) | 2025-12-10T07:48:02Z | `ff5dda05e5c1048b19a4a21080416cd379a25c21` |
| `gliela.wikitext` | [88458055](https://en.wiktionary.org/w/index.php?title=gliela&oldid=88458055) | 2025-12-10T06:22:17Z | `05a2c183be1e7135a933b8399bd0e527dcc94693` |
| `glieli.wikitext` | [88458060](https://en.wiktionary.org/w/index.php?title=glieli&oldid=88458060) | 2025-12-10T06:22:33Z | `79be2cb55565875c1b52974b6698d9b141ed9364` |
| `gliele.wikitext` | [92702628](https://en.wiktionary.org/w/index.php?title=gliele&oldid=92702628) | 2026-09-16T13:57:22Z | `59d37da368cde40c6fabc2d87412f066eee316b7` |
| `gliene.wikitext` | [88458065](https://en.wiktionary.org/w/index.php?title=gliene&oldid=88458065) | 2025-12-10T06:23:00Z | `39c057a05d335cb418084ec5512cc858a0c8a7fd` |
| `stanotte.wikitext` | [89891525](https://en.wiktionary.org/w/index.php?title=stanotte&oldid=89891525) | 2026-03-18T23:19:44Z | `8d0606219b14861a9e3b2f4f179b805fd78260cc` |
| `stavolta.wikitext` | [84722050](https://en.wiktionary.org/w/index.php?title=stavolta&oldid=84722050) | 2025-05-04T09:50:02Z | `6addee0438d215366f937b2dc9a79d917a3129cc` |
| `city.wikitext` | [93757027](https://en.wiktionary.org/w/index.php?title=city&oldid=93757027) | 2026-10-20T18:31:56Z | `e4f9be36f22b7bfdf935e727f299eb84348cad6e` |
| `sottofondo.wikitext` | [90570723](https://en.wiktionary.org/w/index.php?title=sottofondo&oldid=90570723) | 2026-05-09T13:54:42Z | `a994bd053f5806d1a6f2ecb13435204759a55647` |
| `eccome.wikitext` | [84429569](https://en.wiktionary.org/w/index.php?title=eccome&oldid=84429569) | 2025-03-31T11:50:56Z | `0c15e03322bcc40ada4beccd7ea61a22ece56772` |
| `quaggiù.wikitext` | [69191594](https://en.wiktionary.org/w/index.php?title=quaggi%C3%B9&oldid=69191594) | 2022-09-10T08:32:33Z | `c39689d2f12d4b49f42cb2daea4e1a3a417323e5` |
| `quassù.wikitext` | [69191613](https://en.wiktionary.org/w/index.php?title=quass%C3%B9&oldid=69191613) | 2022-09-10T08:33:40Z | `ff576ae4a0b810ebbbdcd9537191c9a8f348dc00` |
| `piccolino.wikitext` | [90571699](https://en.wiktionary.org/w/index.php?title=piccolino&oldid=90571699) | 2026-05-09T14:13:07Z | `db1054ad9b8b0d807327cc7acaf685cd404a0e61` |
| `granché.wikitext` | [90404548](https://en.wiktionary.org/w/index.php?title=granch%C3%A9&oldid=90404548) | 2026-05-02T01:13:58Z | `1588f2e6d7a13e855a0be92f6f6998c3598b7b63` |
| `sottufficiale.wikitext` | [90578532](https://en.wiktionary.org/w/index.php?title=sottufficiale&oldid=90578532) | 2026-05-09T16:16:00Z | `5d0bc9948eec9767fc4939c9f73b3050d2a73ef2` |
| `dopodiché.wikitext` | [92187355](https://en.wiktionary.org/w/index.php?title=dopodich%C3%A9&oldid=92187355) | 2026-08-24T03:32:49Z | `69a5d8acb2e069d6cfd2d71e0db6de21579af941` |
| `studentesco.wikitext` | [90579958](https://en.wiktionary.org/w/index.php?title=studentesco&oldid=90579958) | 2026-05-09T16:38:02Z | `6d3c1bdf74292aeed14411fdcebe271f7c53098a` |
| `cordone.wikitext` | [93472718](https://en.wiktionary.org/w/index.php?title=cordone&oldid=93472718) | 2026-10-09T19:42:01Z | `53394659799d2783609e621b00df1774f47774ec` |
| `bigliettino.wikitext` | [71106004](https://en.wiktionary.org/w/index.php?title=bigliettino&oldid=71106004) | 2023-01-31T05:37:38Z | `1b54ed0a964d0eed6d0809518e5c4d51bef1a6b8` |
| `camicetta.wikitext` | [90572356](https://en.wiktionary.org/w/index.php?title=camicetta&oldid=90572356) | 2026-05-09T14:25:40Z | `c3171c0864f720f71199e0ceda0981cd6e55bd06` |
| `orsetto.wikitext` | [90571651](https://en.wiktionary.org/w/index.php?title=orsetto&oldid=90571651) | 2026-05-09T14:12:10Z | `8ee493d9336017507605f06e3d879bcaf25ec5db` |
| `barretta.wikitext` | [90571281](https://en.wiktionary.org/w/index.php?title=barretta&oldid=90571281) | 2026-05-09T14:05:07Z | `c20b8d44c494500b2ccdfcb3f36e4954cd96e821` |
| `prematrimoniale.wikitext` | [90583322](https://en.wiktionary.org/w/index.php?title=prematrimoniale&oldid=90583322) | 2026-05-09T17:31:19Z | `b86d6f8d94c3dc1cdc36d7424344345ba100143c` |
| `quantomeno.wikitext` | [92188743](https://en.wiktionary.org/w/index.php?title=quantomeno&oldid=92188743) | 2026-08-24T03:44:20Z | `336e7f0ba6a1bf9a9b3e754f90d824f73762d991` |
| `caposquadra.wikitext` | [92176403](https://en.wiktionary.org/w/index.php?title=caposquadra&oldid=92176403) | 2026-08-24T01:34:25Z | `f4f89137df319d5c53f9a86d36d4891104194a01` |
| `minorile.wikitext` | [90572737](https://en.wiktionary.org/w/index.php?title=minorile&oldid=90572737) | 2026-05-09T14:32:55Z | `6a4179db0eeff957b3bb1ee6dee2718920f99973` |
| `paranormale.wikitext` | [90579559](https://en.wiktionary.org/w/index.php?title=paranormale&oldid=90579559) | 2026-05-09T16:31:58Z | `ca7964551883ea95115378f3cd59929852b78172` |
| `piacimento.wikitext` | [90569810](https://en.wiktionary.org/w/index.php?title=piacimento&oldid=90569810) | 2026-05-09T13:38:50Z | `5ee8e3a172c11323fc9f9d5d8916e4f36ca81d96` |
| `avvistamento.wikitext` | [90570833](https://en.wiktionary.org/w/index.php?title=avvistamento&oldid=90570833) | 2026-05-09T13:56:48Z | `ac1b245f1be973da15e057ff6affd0cb2576056d` |
| `domattina.wikitext` | [89115027](https://en.wiktionary.org/w/index.php?title=domattina&oldid=89115027) | 2026-01-07T22:43:14Z | `621a060c0c98a906550353cb3676e14d4990d110` |
| `oddio.wikitext` | [90752324](https://en.wiktionary.org/w/index.php?title=oddio&oldid=90752324) | 2026-05-12T14:59:57Z | `b9d3ad9ab56b0e11a9af5f985e01342d261d5240` |
| `paralimpico.wikitext` | [70745701](https://en.wiktionary.org/w/index.php?title=paralimpico&oldid=70745701) | 2023-01-08T09:28:09Z | `6438167ed898e4e554c89a8348706b6cd8c84f4f` |
| `ehi.wikitext` | [92140898](https://en.wiktionary.org/w/index.php?title=ehi&oldid=92140898) | 2026-08-23T19:58:05Z | `32cd7f0a3c71ba3aeeeb395376eae20441027231` |
| `evviva.wikitext` | [85200244](https://en.wiktionary.org/w/index.php?title=evviva&oldid=85200244) | 2025-06-20T22:11:54Z | `d249e5152ff369705507a67c952ea65784a8986e` |
| `mah.wikitext` | [93762112](https://en.wiktionary.org/w/index.php?title=mah&oldid=93762112) | 2026-10-21T08:39:01Z | `b51e2a2efb8ce01d9217246b38c6e9bd1e3d2aed` |
| `scartoffia.wikitext` | [84000656](https://en.wiktionary.org/w/index.php?title=scartoffia&oldid=84000656) | 2025-02-22T00:42:22Z | `bd5543ccf89504cb8ad0ba04a8b80d9c5959b6f8` |
| `rilevatore.wikitext` | [71380839](https://en.wiktionary.org/w/index.php?title=rilevatore&oldid=71380839) | 2023-02-23T02:04:42Z | `2e1bb553b1b6059cfd8478ee06b4dc25159e51ee` |
| `cesareo.wikitext` | [91473030](https://en.wiktionary.org/w/index.php?title=cesareo&oldid=91473030) | 2026-07-04T08:08:26Z | `5aa08097a2757a6c4d302560c03353e04b3b3e3c` |

The `si` and `come` revisions were read on 2026-10-09, the others on the date
they give, each with
`https://en.wiktionary.org/w/index.php?title=<title>&oldid=<revision>&action=raw`.
Each file's SHA-1 equals the one the MediaWiki API states for the revision
(`action=query&prop=revisions&rvprop=ids|timestamp|sha1|size`).
