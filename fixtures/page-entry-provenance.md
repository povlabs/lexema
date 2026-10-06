# Page-only entry regression inputs

All inputs are verbatim from release `it-0c432803` and its dump
`itwiktionary-20260701-pages-articles.xml.bz2`, read locally on 2026-10-02.
The archive SHA-256 is
`0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf`;
the dump SHA-1 is `2bdd444236f7dcd26fee3652dbd641c31d0d9651`.

[page-entry-forms.jsonl](page-entry-forms.jsonl) copies whole physical archive
lines 52740 (`racconto`, pointing at `raccontare`) and 53209 (`fornito`, pointing
at `fornire`). No lemma record is made for either target.

The saved pages in [upstream-pages/](upstream-pages/) have the repository's
revision header followed by the complete, XML-decoded wikitext, without edits:
`raccontare` and `fornire` cover Transitivo; `dipendere` covers Intransitivo;
`dismagare` covers handwritten Verbo and the labels in its numbered lead-in;
`fidelizzare` writes its definition above `{{-verb-|it}}`, and its `#` line is
an etymology; `piallare` has a bare `{{-verb-}}` heading. `movere` and `skirmish` are foreign entries;
`notiziare` is a `{{W}}` stub. Each header records revision id and timestamp.
The raw facts remain Italian and are licensed CC BY-SA 4.0.

## Rule v2 inputs (ADR 0028)

Read from the same verified dump on 2026-10-03. One page per layout ADR 0028
admits, named by the group of
[the 2026-10-03 measurement](../reports/2026-10-03-unrecorded-page-layouts.md):

| Page | Revision | Saved | Layout |
|---|---:|---|---|
| `mastoide` | 3928854 | 2023-03-23T09:45:11Z | `none-heading/template` |
| `finora` | 4040126 | 2025-07-24T12:39:32Z | `bare-heading/template` |
| `a monte` | 4040642 | 2025-07-29T13:10:52Z | `standard-heading/spaced-template` |
| `lungo` | 4038855 | 2025-07-08T13:36:18Z | `several-parts-of-speech` |
| `trincetto` | 3147373 | 2017-05-13T15:38:39Z | `bare-heading/bare-template` |
| `accerchiarsi` | 3902057 | 2023-01-19T19:43:05Z | `standard-heading/verb-label` (`{{Riflessivo\|it}}`) |
| `purità` | 3681982 | 2020-05-09T14:19:18Z | `malformed-heading/template` |
| `piangere sul latte versato` | 4060155 | 2026-02-03T10:18:06Z | `standard-heading/unknown-template` (`{{-loc veb-\|it}}`) |
| `tantundem` | 3651204 | 2019-12-25T17:54:00Z | `standard-heading/unknown-template` (`{{-pron-\|it}}`) |

Three more pages stay excluded: `motteggio` (2025-02-06T21:25:32Z, revision
4014868) has no part-of-speech signal; `irrequieti` (2017-05-08T05:34:41Z,
revision 2980547) has only `===Adjective===`; `mezz'ora` (2019-12-19T01:36:47Z,
revision 3644006) is a `{{Trasfen}}` copy of English Wiktionary.

[page-entry-v2-forms.jsonl](page-entry-v2-forms.jsonl) copies whole physical
archive line 93815 (`lunga`, pointing at `lungo`), so a seed test reaches a page
with two part-of-speech sections.

## Curated definition corrections (#450)

[definition-corrections.jsonl](definition-corrections.jsonl) copies whole
physical archive lines 119046 (`tremo`, pointing at `tremare`) and 283047
(`grufolando`, pointing at `grufolare`), read on 2026-10-03. Their SHA-256
digests are `8d4d55b99a0a3e68e23b8257863451f616a15d0c01c41c245789cecfb7988297`
and `951b7232d3573b0e0a700f23c8440af8d0ea4b1e6e8e2cc6c21753222267f0f1`.
No lemma record is made for either target.

`upstream-pages/tremare.wikitext` (revision 4002473) and
`upstream-pages/grufolare.wikitext` (revision 3906191) are the dump's pages,
XML-decoded, without edits. Each equals its revision's
`action=raw&oldid=…` wikitext on it.wiktionary.org, read on 2026-10-03.
`grufolare`'s line 4 states *grugnire*'s sense, and `tremare`'s line 4 has no
verb; the committed list corrects both, and the tests check it against these
bytes.

## The other fields (#439, ADR 0026)

[page-facts/](page-facts/) holds two more pages of the same verified dump, read
on 2026-10-04, with the same revision header and their wikitext unedited. They
sit outside `upstream-pages/`, so no seed of the fixture tree reads them:

| Page | Revision | Saved | Covers |
|---|---:|---|---|
| `avventurieri` | 3962578 | 2023-11-13T15:52:01Z | two sections, each with its own `{{Tabs\|…}}` and a definition naming `avventuriero` |
| `amano` | 2822837 | 2017-05-04T23:42:01Z | a `Voce verbale` naming `del verbo [[amare]]` |

[test/pageFacts.test.ts](../test/pageFacts.test.ts) reads them beside
`raccontare`, `fornire` and `mastoide`. It also writes one page of its own,
`racconti`, in `avventurieri`'s layout, so a definition names a lemma the
seed's archive line `racconto` heads; its header says so.

## A verb form's Definitions, counted (#691)

[fiaccando.jsonl](fiaccando.jsonl) copies whole physical archive lines 138358
(`fiaccare`) and 335510 (`fiaccando`, pointing at `fiaccare`), and
[sfocato.jsonl](sfocato.jsonl) lines 122428 (`sfocato`, adjective) and 122429
(`sfocato`, a verb form pointing at `sfocato`), read on 2026-10-06. Their
SHA-256 digests, in that order, are
`e76db26f927e33bacb804a9f63338a350fa051e61f1d5d46e537ead76b0ca649`,
`5a40b5c5915283a6c337e7e9b1c149e9bad3e79460a4b6a8a902412f95ce79f4`,
`85e26d25a1f10518a3e5321e071edb335d96d3d44e95c6ffa26d2124655207f2` and
`e3a23d615b41ee139f88131531dcdf23dfc7010edc1eab32261d553b6df3ce56`.

`upstream-pages/fiaccare.wikitext` is revision 4067084
(2026-03-12T06:36:27Z) of the same dump, XML-decoded, without edits. Its line 8
states the sub-term `fiaccare le corna a uno`, which the archive record drops,
so a seed with this page recovers it. Six verbs in the release have a page that
recovers a definition and are named by a verb form record; `fiaccare` has the
shortest page of the six. `sfocato` is the only verb form record in the release
whose form-of target is its own word, so it is the only page where the verb a
block names is a reading of the same page.
[web/test/pageStatements.test.ts](../web/test/pageStatements.test.ts) counts
both pages' D1 reads.

## Test authoring contracts

- The parser test owns admission, ordered meanings/labels/examples and physical
  line provenance across the three ruled layouts. A parser that reads a foreign
  section, admits a stub or loses the revision/line fails it. Existing recovery
  tests require an archive record and do not cover this distinct admission path.
- The disposable seed-to-lookup test owns the missing-entry bug and preservation
  of originals and existing recovered rows. It fails on the pre-fix main commit
  `e87c49b850cc783121426de4e01901dc6cadc29c`: `raccontare` is `not-found` rather than
  `found`. It compares a real development seed with the same seed plus page-only
  entries, and checks full/batch identities and form-of navigation. It uses only
  production seed and read-only lookup boundaries, not new test-only seams.
- The rendered-page test owns a separate presentation/transport risk: archive-only
  DOM/API identities would be `undefined`, or the empty verb could acquire a
  fabricated table. It renders the actual components and checks observable
  content and API fields, not classes or source strings. Existing tests contain
  only archive-backed readings and cannot reach that identity shape.
