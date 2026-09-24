# Attribution notices and release metadata

Lookup material for publication: the draft attribution notices, the wording we
must not use, the release and per-record metadata to retain, and the duties each
distribution surface carries. Why any of it is required is
[LICENSING.md](LICENSING.md); how to fetch a release that can fill the metadata
in is [How to re-fetch an identified release](REFETCH_A_RELEASE.md).

**Status: drafts, not paste-ready public notices.** Every `{...}` placeholder is
an open field and **must not be published with guessed values**. The open policy
choices are tracked as B2, B8 and B14 in
[LICENSING.md §9](LICENSING.md#9-blockers-to-publishing), whose "Decided since"
note names the decision that has since landed.

## Result-page notice (draft)

Compact, sits under the definitions block. `{word}` is the headword,
URL-encoded in the links. The English interface uses the English notice.

> **Fonte:** voce «{word}» su [Wikizionario](https://it.wiktionary.org/wiki/{word}) —
> [cronologia e autori](https://it.wiktionary.org/w/index.php?title={word}&action=history).
> Testo disponibile con licenza [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.it).
> **Lexema ha modificato questo materiale:** i dati sono stati estratti, ristrutturati e riorganizzati
> automaticamente; il testo delle definizioni non è stato riscritto.
> [Dettagli su fonti e licenze](/attribuzione).

English equivalent:

> **Source:** the entry "{word}" on [Italian Wiktionary](https://it.wiktionary.org/wiki/{word}) —
> [page history and authors](https://it.wiktionary.org/w/index.php?title={word}&action=history).
> Text available under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
> **Lexema modified this material:** the data was extracted, restructured and reorganised
> automatically; the wording of the definitions was not rewritten.
> [Full source and licence details](/attribution).

What each part has to achieve, and the rules on placement and on forms that
resolve to a different lemma, are in
[LICENSING.md §3.1](LICENSING.md#31-on-a-word-result-page).

## Public attribution page (draft)

Route: `/attribuzione` (IT) and `/attribution` (EN), linked from the site footer
on every page. Drafted in full below — placeholders in `{...}` come from release
metadata, and **must not be published with guessed values.**

> # Fonti e licenze
>
> ## Da dove vengono le definizioni
>
> I dati lessicali di Lexema per l'italiano provengono dal
> [Wikizionario italiano](https://it.wiktionary.org/), l'edizione italiana di Wiktionary, un progetto
> della [Wikimedia Foundation](https://wikimediafoundation.org/) scritto da volontari.
>
> La maggior parte proviene dall'estrazione automatica pubblicata da
> [kaikki.org](https://kaikki.org/itwiktionary/), prodotta con lo strumento
> [wiktextract](https://github.com/tatuylonen/wiktextract) di Tatu Ylonen.
>
> Dove quell'estrazione ha perso una definizione, Lexema la legge dalla pagina stessa, nel
> [dump Wikimedia del Wikizionario italiano](https://dumps.wikimedia.org/itwiktionary/), e la
> segna come *recuperata*, con un link alla revisione della pagina da cui è stata letta.
>
> ## Licenza
>
> Il testo del Wikizionario è pubblicato con licenza
> [Creative Commons Attribuzione - Condividi allo stesso modo 4.0 Internazionale (CC BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/deed.it).
> Gli autori di ogni voce sono elencati nella cronologia della pagina corrispondente sul
> Wikizionario; ogni risultato di ricerca su Lexema contiene il collegamento diretto a quella
> cronologia.
>
> Il materiale è fornito «così com'è», senza garanzie di alcun tipo, come previsto dalla
> [sezione 5 della licenza](https://creativecommons.org/licenses/by-sa/4.0/legalcode.it).
> Lexema non garantisce l'esattezza o la completezza delle definizioni.
>
> ## Cosa abbiamo modificato
>
> Lexema ha modificato il materiale. In particolare:
>
> - i dati sono stati estratti dal testo wiki e convertiti in una struttura dati;
> - le voci sono state indicizzate per forma esatta e per forma flessa, per permettere la ricerca;
> - i tag grammaticali della fonte sono stati mappati su un insieme ristretto e uniforme;
> - alcune informazioni presenti nella fonte non sono state importate;
> - articoli e altre indicazioni grammaticali contrassegnate come «calcolate da Lexema» sono generate
>   da regole deterministiche nostre, non provengono dalla fonte.
>
> Il testo delle definizioni non è stato riscritto né generato automaticamente. Dove Lexema aggiunge
> contenuto proprio, questo è sempre indicato come tale e tenuto separato dal testo della fonte.
>
> ## Versione dei dati
>
> - Fonte: [Wikizionario italiano, dump del {dumpDate}](https://dumps.wikimedia.org/itwiktionary/{dumpYYYYMMDD}/)
> - Scaricato da: [`{sourceUrl}`]({sourceUrl})

This section says where the data came from and nothing else, by Huey's ruling on
[#133](https://github.com/hueypov/lexema/issues/133): no release id, download date, build date,
checksum or counts. For the July archive the dump is inferred, not recorded by kaikki; that basis
and its evidence are kept in [`src/source/archiveFacts.ts`](../src/source/archiveFacts.ts) and
[LICENSING.md §1.3](LICENSING.md#13-the-one-reasonable-inference--and-its-limit), not on the page.
>
> ## Licenza dei dati di Lexema
>
> Anche i contenuti scritti da Lexema sono pubblicati con licenza CC BY-SA 4.0 ([ADR 0009](../.decisions/0009-two-licences-and-a-source-link.md), emendamento del 2026-09-21).
>
> ## Pronuncia e file audio
>
> {open — see [LICENSING.md §5](LICENSING.md#5-audio-images-and-quoted-text--reviewed-separately); only if audio is ever shipped}
>
> ## Marchi
>
> Wikipedia, Wiktionary, Wikizionario e Wikimedia sono marchi registrati della Wikimedia Foundation,
> Inc. Lexema non è affiliato alla Wikimedia Foundation e non è da essa approvato o sponsorizzato.
>
> ## Altre fonti consultate
>
> Durante lo sviluppo abbiamo consultato dizionari di terze parti, fra cui il
> [Vocabolario Treccani](https://www.treccani.it/vocabolario/), esclusivamente come verifica
> redazionale. **Nessun testo proveniente da queste fonti è stato importato in Lexema.**

An English translation of this page should exist at `/attribution` with
identical content. That translation is not written yet; it is part of B8.

## API responses and bulk downloads (draft)

Suggested envelope field, present on every response that carries
source-derived text:

```json
{
  "attribution": {
    "source": "Italian Wiktionary (it.wiktionary.org)",
    "sourceUrl": "https://it.wiktionary.org/wiki/casa",
    "authorsUrl": "https://it.wiktionary.org/w/index.php?title=casa&action=history",
    "via": "kaikki.org / wiktextract",
    "license": "CC-BY-SA-4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
    "modified": true,
    "modificationNotice": "Extracted, restructured and re-indexed by Lexema. Definition wording unchanged.",
    "releaseId": "{releaseId}",
    "attributionPage": "https://{host}/attribution",
    "disclaimer": "Provided as-is, without warranties. See CC BY-SA 4.0 section 5."
  }
}
```

For a bulk download, ship a sibling `LICENSE.txt` and `ATTRIBUTION.md` inside
the archive with the same content as the public attribution page above, plus the
release metadata below filled in.

## Text we must not use

- "Powered by Wiktionary", "Official Wiktionary data", any Wikimedia logo in our chrome — endorsement
  and trademark.
- "© Lexema. All rights reserved." on any page showing source-derived definitions — that is offering
  additional restrictions on the Licensed Material, which 2(a)(5)(C) forbids. Our own code and design
  can carry a copyright line; the definitions block cannot sit under a blanket one.

The licence text behind both is
[LICENSING.md §3.4](LICENSING.md#34-text-we-must-not-use).

## Release metadata to retain

`ReleaseMetadata` in [`src/core/types.ts`](../src/core/types.ts) already has
`releaseId, source, sourceUrl, retrievedAt, importerVersion, schemaVersion,
license, attribution, compressedSha256`. Missing fields, all needed to make a
release describable:

| Field | Example | Why it is needed |
| --- | --- | --- |
| `upstreamDumpName` | `itwiktionary-20260901-pages-articles.xml.bz2` | The only true statement of which Wiktionary snapshot this is. From the kaikki log. |
| `upstreamDumpDate` | `2026-09-01` | Human-readable form of the above, for the attribution page. |
| `extractorVersion` | `wiktextract d6fca27 / wikitextprocessor 65e1673` | Extraction bugs are release-specific (see #11). Without it, a bug report cannot be reproduced. |
| `upstreamBuiltAt` | `2026-09-16T15:41:54Z` | gzip MTIME / `Last-Modified`. Distinguishes builds when the dump is the same. |
| `httpEtag`, `httpLastModified` | `"6aaab8c2-26493b7"` | Identifies the exact HTTP response fetched. |
| `identityConfidence` | `verified` \| `inferred` \| `unknown` | Makes the July snapshot's gap representable instead of hidden. The July snapshot's dump is stored as `upstream_release_basis = 'inferred'` and may be published (ADR 0013, PR #130). |

[How to re-fetch an identified release](REFETCH_A_RELEASE.md) is the procedure
that produces every value above.

## Per-record metadata to retain

| Field | Source | Purpose |
| --- | --- | --- |
| `releaseId` | release metadata | Ties text to a described snapshot |
| record ordinal + JSON pointer | already in `ProvenanceRef` | Locates the exact source value |
| `word` **of the record the text came from** | the record | Builds the source and history URL. Must be the record's own `word`, not the query — this is issue [#16](https://github.com/hueypov/lexema/issues/16). |
| `lang_code` | the record | Distinguishes the `it` from the `la` record on the same page |
| `recordHash` | already optional in `ProvenanceRef` | Detects drift between releases |

Source URL: `https://it.wiktionary.org/wiki/{word}` (percent-encoded).
Authors URL: `https://it.wiktionary.org/w/index.php?title={word}&action=history`
(verified 200 for `casa` on 2026-09-18).

Why no revision id is available, and what it would cost to add one, is
[LICENSING.md §7.2](LICENSING.md#72-per-record--the-gap-that-matters).

## Duties per distribution surface

The table combines applicable source-licence duties with our proposed notice
design and conservative bundle policy. Exact placement and packaging are
implementation proposals, not verbatim licence requirements. B2, B8 and B14 must
be resolved before these become final release instructions.

| We offer | Duties and proposed implementation |
| --- | --- |
| **Website only** | The result-page notice on every result page; the attribution page linked from the footer; ShareAlike terms stated on that page; no ToS clause restricting reuse of displayed content. No duty to publish a bulk download. |
| **Public API** | Everything above, plus the `attribution` object in every response carrying source-derived text, plus a machine-readable licence declaration at a stable path (`/v1/attribution`, as `LEXEMA_SPEC.md` already proposes). Rate limits and keys are fine; terms forbidding redistribution of returned content are not. |
| **Bulk download** | Everything above, plus `LICENSE.txt` and `ATTRIBUTION.md` inside the archive, plus the release metadata above shipped with it, plus per-record provenance in the data. If the database qualifies as Adapted Material, §3(b) applies. The proposed bundle policy is CC BY-SA 4.0; [LICENSING.md §4.2](LICENSING.md#42-dictionary-data--conditional-duties-and-proposed-cc-by-sa-policy) explains the unproven database-rights conditions. |
| **Audio of any kind** | Per-file licence and author, fetched and stored first — [LICENSING.md §5.1](LICENSING.md#51-audio--confirmed-mixed-licences-per-file). |

Two things are true in every row: **no DRM or technical measure that restricts
reuse** (2(a)(5)(C)), and **downstream recipients get their rights directly from
the original authors**, not from us — 2(a)(5)(A): "Every recipient of the
Licensed Material automatically receives an offer from the Licensor." We are not
in a position to grant or withhold anything.
