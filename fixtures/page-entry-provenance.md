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
