# Hand-kept tables fixtures

The inputs of [test/handKeptTables.test.ts](../../test/handKeptTables.test.ts)
and of the #844 page tests in [web/test/page.test.tsx](../../web/test/page.test.tsx)
(#844, [ADR 0031](../../.decisions/0031-hand-kept-readings-fill-source-gaps.md)).
Every file is verbatim.

## `archive-lines.jsonl`

The 24 verb records of `it-extract.jsonl.gz`, release `it-0c432803`, that
`it-regular-conjugation/v1` declines
([the #838 report](../../reports/2026-10-16-pronominal-regular-tables.md)), in
archive order: lines 48516 `imbattersi`, 48533 `impadronirsi`, 90544
`obliarsi`, 106042 `sdarsi`, 114976 `genuflettersi`, 115055 `appollaiarsi`,
115429 `avvalersi`, 115983 `adastiarsi`, 116314 `assennirsi`, 116364
`attremirsi`, 116880 `inostrarsi`, 456884 `susseguirsi`, 462416 `appassirsi`,
463505 `ravvedersi`, 463606 `industriarsi`, 498021 `rivalersi`, 535683
`informicolirsi`, 538747 `incacchiarsi`, 544556 `avvedersi`, 545132
`stupefarsi`, 552855 `prefiggersi`, 552880 `immusonirsi`, 598569 `assuefarsi`
and 599486 `infischiarsi`. The file's SHA-256 is
`d61e1fbabae4210fa5a80316866d01dc8c4d29e6df93248a932ba9307e125945`.

## `<title>.wikitext`

Each en.wiktionary revision a table in
[src/italian/handKeptTables.ts](../../src/italian/handKeptTables.ts) cites,
read on 2026-10-16 with
`https://en.wiktionary.org/w/index.php?title=<title>&oldid=<revision>&action=raw`.
Each file's SHA-1 equals the one the MediaWiki API states for the revision
(`action=query&prop=revisions&rvprop=ids|timestamp|sha1|size`):

| Title | Revision | Saved | SHA-1 |
|---|---|---|---|
| adastiarsi | [71027279](https://en.wiktionary.org/w/index.php?title=adastiarsi&oldid=71027279) | 2023-01-23T07:15:37Z | `817053fe9a9f216144c7d7620e1156493c180601` |
| appassire | [90569343](https://en.wiktionary.org/w/index.php?title=appassire&oldid=90569343) | 2026-05-09T13:29:12Z | `70327c351a6b3741ad967400958ec970a02efc4c` |
| appollaiarsi | [71105779](https://en.wiktionary.org/w/index.php?title=appollaiarsi&oldid=71105779) | 2023-01-31T05:34:22Z | `e573a795fba3a4f8138868f99e7f03bc9c8289e4` |
| assennire | [71366604](https://en.wiktionary.org/w/index.php?title=assennire&oldid=71366604) | 2023-02-22T08:29:41Z | `196afcd79964af00969ae686d6fdf23a3a187cbf` |
| assuefare | [92141666](https://en.wiktionary.org/w/index.php?title=assuefare&oldid=92141666) | 2026-08-23T20:23:19Z | `f7d36fe0860d61bd506d3b6e88bdf0e2c43975d6` |
| assuefarsi | [92141667](https://en.wiktionary.org/w/index.php?title=assuefarsi&oldid=92141667) | 2026-08-23T20:23:21Z | `47a442504ff12b82555009293ea00a8b1b9b767f` |
| avvalersi | [80612794](https://en.wiktionary.org/w/index.php?title=avvalersi&oldid=80612794) | 2024-07-02T22:23:18Z | `a8303504a4d8c575285921a209c4f731f055ed57` |
| avvedersi | [67977311](https://en.wiktionary.org/w/index.php?title=avvedersi&oldid=67977311) | 2022-07-17T19:50:46Z | `06fbd5640672a862aed51ba13c6bed7bda8870de` |
| genuflettersi | [93133732](https://en.wiktionary.org/w/index.php?title=genuflettersi&oldid=93133732) | 2026-09-30T09:16:46Z | `32629a8d9aec451e297165f5e9eca226530ae6b0` |
| imbattersi | [90564438](https://en.wiktionary.org/w/index.php?title=imbattersi&oldid=90564438) | 2026-05-09T11:48:36Z | `aaae5c849d2d93dc40334d57716cb23d158da279` |
| immusonirsi | [71366912](https://en.wiktionary.org/w/index.php?title=immusonirsi&oldid=71366912) | 2023-02-22T08:34:15Z | `c0d5b449ab5cad21a7dcf769623187ade5a223d1` |
| impadronirsi | [91778278](https://en.wiktionary.org/w/index.php?title=impadronirsi&oldid=91778278) | 2026-08-02T12:28:45Z | `20ff2651cc103dae0409bfd19b23060d9a387dc9` |
| incacchiarsi | [71106904](https://en.wiktionary.org/w/index.php?title=incacchiarsi&oldid=71106904) | 2023-01-31T05:52:39Z | `b5893184e1ea322ff996c8b62b3b94873080fa6c` |
| industriarsi | [92190948](https://en.wiktionary.org/w/index.php?title=industriarsi&oldid=92190948) | 2026-08-24T04:13:58Z | `ef3a8823960e14d0be9a8b1842b1d7a6d51112f3` |
| infischiarsi | [80612746](https://en.wiktionary.org/w/index.php?title=infischiarsi&oldid=80612746) | 2024-07-02T22:21:55Z | `87929e4c0099faa5d9ae6670eb565b2f4bafd5dd` |
| informicolirsi | [75047050](https://en.wiktionary.org/w/index.php?title=informicolirsi&oldid=75047050) | 2023-07-03T19:27:52Z | `94738195eca365b8e6fd5493a376f1e377dd39fd` |
| obliarsi | [92175298](https://en.wiktionary.org/w/index.php?title=obliarsi&oldid=92175298) | 2026-08-24T01:23:48Z | `4d35f56ff410f64c6617fa443b1d8e8039962160` |
| prefiggersi | [67588523](https://en.wiktionary.org/w/index.php?title=prefiggersi&oldid=67588523) | 2022-07-01T06:03:53Z | `1f6bf1e67b199f6f593cae77e5e4b6d26f29815b` |
| ravvedersi | [90577471](https://en.wiktionary.org/w/index.php?title=ravvedersi&oldid=90577471) | 2026-05-09T15:58:49Z | `37270efdfa041aa21545c6904fcf9583cec16047` |
| rivalersi | [93588532](https://en.wiktionary.org/w/index.php?title=rivalersi&oldid=93588532) | 2026-10-15T06:56:57Z | `c4106b300be78b49e15d91bdd356268cac7b522b` |
| stupefare | [93134607](https://en.wiktionary.org/w/index.php?title=stupefare&oldid=93134607) | 2026-09-30T09:19:41Z | `ca394ca642c01e67786395d9876bf8a63104c96d` |
| stupefarsi | [77623586](https://en.wiktionary.org/w/index.php?title=stupefarsi&oldid=77623586) | 2024-01-13T23:49:02Z | `615a5ccedb4a436007a097486f2919afac947bb3` |
| susseguirsi | [90583647](https://en.wiktionary.org/w/index.php?title=susseguirsi&oldid=90583647) | 2026-05-09T17:36:16Z | `695f21fc2a06cff146afaa7522072ca0e0ecbb77` |

The same query on 2026-10-16 answered `missing` for `attremirsi`,
`attremire`, `sdarsi`, `sdare`, `inostrarsi` and `inostrare`: en.wiktionary has
no page for those three verbs or their bases, so they are listed for Huey. It
also answered `missing` for `appassirsi` and `assennirsi`, whose tables cite
their base's page.

## `<title>.expanded`

The table each revision's `{{it-conj}}` call expands to: the call, verbatim
from the revision's `====Conjugation====` section, sent on 2026-10-16 to
`action=expandtemplates&title=<title>&prop=wikitext`. A call names only the
verb's pattern (`{{it-conj|+isc}}`); the forms are what en.wiktionary's
modules write for it, so the expansion is the table the revision shows. It was
made with `Template:it-conj` revision 67345439 and `Module:it-verb` revision
88555991, the ones in force that day.
