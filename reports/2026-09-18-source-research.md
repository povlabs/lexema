# Italian source research

Research checked on 2026-09-18. This is a reference to observed source content, not a finished data policy or legal opinion.

## Scope

Compared the twelve queries in [the dataset spot check](2026-09-18-dataset-spot-check.md) with Italian Wiktionary revision content. Also inspected live rendered conjugation tables, selected Treccani entries, Kaikki's current download, and current licence notices.

The local file was not changed. Its SHA-256 is `0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf`. Findings do not establish dictionary-wide accuracy.

## Findings

| Finding | Evidence | Confidence and limit |
| --- | --- | --- |
| The downloaded data loses useful `casa` definitions. | Local line 1 has two page-text glosses. Wiktionary has house/dwelling definitions beneath nested `#*` markup, plus feminine singular and plural `case`. Treccani independently confirms the feminine noun and dwelling meaning. | High confidence in the mismatch. The nested markup is a plausible extraction problem, not a proven parser diagnosis. |
| A fresh Kaikki download alone does not fix `casa`. | The current download's first Italian `casa` record still has the same two glosses, no top-level gender tags, and no embedded forms. | High confidence for this one record; the whole current release was not downloaded or audited. |
| `parlerei` loses its mood in the embedded form data. | Local line 37 `/forms/53` only tags it `present`, with raw `io`. The separate Wiktionary entry explicitly names conditional present. Its rendered conjugation table places it under `condizionale`, `presente`, `io`. | High confidence. The missing mood is available upstream; no need to infer it from spelling. |
| `andavano` has explicit grammatical wording upstream. | The direct entry names third-person plural imperfect indicative, matching the local direct entry. The local embedded form lacks a mood tag. | High confidence for this word, not proof of complete verb-table coverage. |
| The `studente` verb claim is disputed by other source evidence. | Wiktionary's `studente` page calls it a present participle of `studiare`. Wiktionary's rendered `studiare` table gives `studiante`. Treccani's `studiare` entry also names `studiante`; its `studente` entry identifies a noun and derives it from Latin `studens`. | High confidence in the conflict. This research does not prove that no historical or regional verb use exists. The imported verb claim is not independently validated. |
| Some odd-looking combinations really exist upstream. | `parlare` and `andare` have noun and verb sections. `sale` has salt, plural-of-`sala`, and verb-of-`salire` sections. `bello` has adjective and two noun sections. | High confidence that the source contains these distinctions; keeping sections separate is not itself an extraction error. |
| The ambiguous noun relation for `bella` remains ambiguous upstream. | Its noun section says feminine of `bello` without identifying either of `bello`'s two noun sections. | High confidence in the lack of a record-specific target. No target was selected. |
| `città` is explicitly feminine and invariable upstream. | Wiktionary uses `f inv`, corresponding to the local tags. | The lack of one number tag does not itself mean a broken entry. Selecting an article still needs a number. |
| `studente/studentessa` is not a local parsing invention. | The Wiktionary page's `Tabs` template contains that exact combined argument. | High confidence in its source origin; this is not a validated policy for splitting combined strings. |

## Wiktionary revisions inspected

These links identify page wikitext revisions. Rendered templates can change independently of the page revision; a page revision alone does not freeze a rendered conjugation table.

| Page | Revision link |
| --- | --- |
| casa | <https://it.wiktionary.org/w/index.php?title=casa&oldid=4257826> |
| case | <https://it.wiktionary.org/w/index.php?title=case&oldid=4030141> |
| studente | <https://it.wiktionary.org/w/index.php?title=studente&oldid=4194138> |
| studenti | <https://it.wiktionary.org/w/index.php?title=studenti&oldid=3882412> |
| sale | <https://it.wiktionary.org/w/index.php?title=sale&oldid=4059406> |
| andare | <https://it.wiktionary.org/w/index.php?title=andare&oldid=4075405> |
| andavano | <https://it.wiktionary.org/w/index.php?title=andavano&oldid=3225302> |
| parlare | <https://it.wiktionary.org/w/index.php?title=parlare&oldid=4251962> |
| parlerei | <https://it.wiktionary.org/w/index.php?title=parlerei&oldid=3018198> |
| bello | <https://it.wiktionary.org/w/index.php?title=bello&oldid=4040530> |
| bella | <https://it.wiktionary.org/w/index.php?title=bella&oldid=3990293> |
| città | <https://it.wiktionary.org/w/index.php?title=citt%C3%A0&oldid=4050795> |
| parlare conjugation page | <https://it.wiktionary.org/w/index.php?title=Appendice:Coniugazioni/Italiano/parlare&oldid=3967622> |
| andare conjugation page | <https://it.wiktionary.org/w/index.php?title=Appendice:Coniugazioni/Italiano/andare&oldid=4043876> |

The `parlare` conjugation page invokes `{{It-conj|parl|are|avere}}`. Its raw wikitext does not contain a full table; that is supplied by template expansion. The `andare` page additionally contains explicit overrides. Merely saving these page bodies would not capture all conjugation values or their headings.

Live tables inspected:

- <https://it.wiktionary.org/wiki/Appendice:Coniugazioni/Italiano/parlare>
- <https://it.wiktionary.org/wiki/Appendice:Coniugazioni/Italiano/studiare>

## Independent dictionary and article checks

Treccani was consulted as a cross-check, not as a source licensed for import. Its pages state that reproduction is reserved. No Treccani definitions were added to the dataset.

- [casa](https://www.treccani.it/vocabolario/casa/): confirms feminine noun and dwelling sense.
- [studente](https://www.treccani.it/vocabolario/studente/): confirms noun, feminine `studentessa`, and Latin participle origin. Latin origin is not evidence for a present-day Italian verb form.
- [studiare](https://www.treccani.it/vocabolario/studiare/): explicitly names present participle `studiante`.
- [Articoli, La grammatica italiana](https://www.treccani.it/enciclopedia/articoli_(La-grammatica-italiana)/): states that articles agree in gender and number and distinguishes definite from indefinite use. It states that the indefinite article has only singular forms.

This verifies the broad need for gender, number, and article kind. It does **not** verify a complete article algorithm, spelling/sound exceptions, loanwords, partitives, or the repo's existing article code.

## Current Kaikki sample

URL: <https://kaikki.org/dictionary/downloads/it/it-extract.jsonl.gz>

Observed HTTP headers:

- `Last-Modified: Wed, 16 Sep 2026 15:41:54 GMT`
- `Content-Length: 40145847`
- `ETag: "6aaab8c2-26493b7"`

The gzip response was streamed only until its first Italian `casa` record. The connection was then closed. These headers identify the response sampled, not a verified immutable release or checksum. The remote size differs from the local file's `39890237` bytes.

[Kaikki's raw-data page](https://kaikki.org/dictionary/rawdata.html) describes regularly updated Wiktextract output. Its English-edition dump date is not evidence for the release date of this Italian-edition file. The local download date, upstream dump date, and extractor version remain unverified.

## Licence evidence

- The Italian Wiktionary [site-info API](https://it.wiktionary.org/w/api.php?action=query&meta=siteinfo&siprop=rightsinfo&format=json) currently reports **Creative Commons Attribution-Share Alike 4.0**, linking to <https://creativecommons.org/licenses/by-sa/4.0/deed.it>.
- The `casa` page footer links to that licence and warns that additional terms may apply.
- The official [CC BY-SA 4.0 summary](https://creativecommons.org/licenses/by-sa/4.0/) permits sharing and adaptation, including commercial use, subject to credit, a licence link, change notices, ShareAlike for adaptations, and no additional restrictions. The summary is not the legal code.
- These current notices do not establish every obligation for the exact older local snapshot. This research did not establish a separate GFDL requirement for that file.
- Audio, images, third-party quotations, and application code need separate consideration. This check does not establish permission to redistribute all linked media or Treccani content.

## Unresolved checks

- Exact source release and extractor version for the local file.
- How widespread lost definitions and missing grammatical headings are.
- A reliable way to preserve conjugation headings and template dependencies.
- Review policy for conflicting source claims, including `studente`.
- Full Italian article rules and exceptions.
- Exact publication attribution and derivative-data licence obligations.

## Follow-up

The licence and attribution questions above are answered in [LICENSING.md](LICENSING.md): the exact
release identity and re-fetch plan, the GFDL question, draft attribution text, how our own data is
licensed, retention duties, media and quotation review, and the remaining publication blockers.
