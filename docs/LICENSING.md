# Licensing and attribution for published Lexema content

Research done on 2026-09-18 for [issue #6](https://github.com/povlabs/lexema/issues/6).

**This is not legal advice. Nobody who wrote this is a lawyer.** It quotes primary sources and links
them so a human — or a real lawyer — can check the reasoning. Items that need Huey's call are marked
**[HUEY]**. Items that are still unproven are marked **[UNPROVEN]**.

**Status: research, not publication clearance or an accepted licence policy.** Issue #6's criterion that adapted-data and review-record licensing be settled remains open pending B2. The final notices also remain unfinished (B8). Merging this research would not settle either.

The draft notices, the metadata field lists and the per-surface duty table are on
[Attribution notices and release metadata](ATTRIBUTION_NOTICES.md). The fetch procedure that makes a
release identifiable is [How to re-fetch an identified release](REFETCH_A_RELEASE.md). This page is
the reasoning behind both.

**Rule this document assumes:** local development continues freely. Nothing leaves this machine —
no website, no API, no data download, no screenshot of definitions in a public deck — until the
blockers in [Blockers to publishing](#9-blockers-to-publishing) are cleared.

---

## 1. What the local file actually is

### 1.1 What we can prove

Every value below was read off the file or its filesystem metadata on 2026-09-18.

| Fact | Value | How it was obtained |
| --- | --- | --- |
| Download URL | `https://kaikki.org/dictionary/downloads/it/it-extract.jsonl.gz` | macOS `com.apple.metadata:kMDItemWhereFroms` on the file |
| Referring page | `https://kaikki.org/dictionary/rawdata.html` | same xattr, second entry |
| Downloading app | Arc (browser) | `com.apple.quarantine` xattr, agent field |
| **Download time (to this Mac)** | **2026-07-20 09:04:02 UTC** | `com.apple.quarantine` timestamp field `6a5de482` = epoch 1784538242; independently matches `kMDItemFSCreationDate` 2026-07-20 09:03:30 UTC |
| **Upstream build time** | **2026-07-16 03:17:09 UTC** | gzip member header MTIME field = epoch 1784171829 |
| SHA-256 | `0c432803c672aceccd48787eb64807c5366fdbd6796715c9a99e31c0024d5dcf` | `shasum -a 256` |
| Size | 39,890,237 bytes | `ls -l` |
| Records | 799,600 JSONL lines; 560,357 with `lang_code: "it"` | full decompressed pass |

The download time is **not invented** — it is recorded by macOS in two independent places that agree.
It is the time the file landed on this machine, which is not the same thing as the upstream release date.

The gzip MTIME is the strongest release signal we have: gzip stores the modification time of the
source file at compression time. It says the upstream `.jsonl` was last written **2026-07-16 03:17:09 UTC**.

### 1.2 What we cannot prove

- **The upstream Wikimedia dump date.** Not recorded anywhere in the file.
- **The wiktextract / wikitextprocessor commit** used to build it. Not recorded anywhere in the file.
- **Whether the bytes we hold match any release kaikki still serves.** kaikki overwrites
  `it-extract.jsonl.gz` in place — there is no versioned archive and no published checksum. The file
  now at that URL is a different one (40,145,847 bytes, `Last-Modified: Wed, 16 Sep 2026 15:41:54 GMT`,
  `ETag: "6aaab8c2-26493b7"`). Directory listing at `https://kaikki.org/dictionary/downloads/it/` returns 403.

### 1.3 The one reasonable inference — and its limit

itwiktionary dumps are published monthly. `https://dumps.wikimedia.org/itwiktionary/` currently lists
`20251220, 20260101, 20260201, 20260301, 20260401, 20260501, 20260601, 20260701, 20260801, 20260901`.
The most recent dump that existed before our file was built (2026-07-16) is **`itwiktionary-20260701`**
(its `pages-articles.xml.bz2` is dated 2026-07-03 03:46:04 and is still downloadable).

So the local snapshot was **most likely** extracted from the `itwiktionary-20260701` dump.

**[UNPROVEN]** This is arithmetic on dates, not evidence. kaikki could have re-run an older dump.
So `20260701` is recorded as `inferred`, never as a fact kaikki stated.

For [#28](https://github.com/povlabs/lexema/issues/28), that dump was downloaded on 2026-09-23 to
recover the definitions the extraction drops (SHA-1 `2bdd444236f7dcd26fee3652dbd641c31d0d9651`,
matching Wikimedia's `dumpstatus.json`). Every one of the archive's 560,357 Italian records has a
page of its exact title in it, and its newest revision is 2026-07-03. That is consistent with the
inference, not proof of it ([the measurement](../reports/2026-09-23-recovered-definitions-full-release.md)).

**Recorded since ([#133](https://github.com/povlabs/lexema/issues/133)).** Huey ruled that Lexema
keeps this archive and states its source as the 1 July 2026 dump (ADR 0013, PR #130). The facts
live in [`src/source/archiveFacts.ts`](../src/source/archiveFacts.ts), keyed by the SHA-256 above:
the download URL and time from §1.1, and the dump `itwiktionary-20260701` with basis `inferred`
and this section as its evidence. A seed of this file copies them into `source_release`, with
`upstream_release_basis = 'inferred'`; a file with any other checksum gets none of them.
`/attribution` shows two of them and nothing more, by Huey's ruling on #133: the source, as the
Italian Wiktionary dump of 1 July 2026 linked to
[its Wikimedia page](https://dumps.wikimedia.org/itwiktionary/20260701/), and the kaikki.org
download the file came from. The download time, the checksum, the basis and this reasoning stay
here and in the facts file, not on the page. Since [#139](https://github.com/povlabs/lexema/issues/139)
the page is `/licence`, and it names the release the dictionary serves and its dump date instead
(ADR 0009, amendment #139).

### 1.4 How a future release becomes traceable

This is fixable, and cheaply. kaikki publishes, next to the download, a build log that names the exact
dump file, and a per-edition HTML page whose footer names the extractor commits. Both were checked
on 2026-09-18 and both describe the same run:

From `https://kaikki.org/dictionary/downloads/it/it-extract.log`, line 5:

> `2026-09-15 05:54:19,789 INFO: dump file path: /home/ubuntu/temp-wiktionary/editions/it/data/itwiktionary-20260901-pages-articles.xml.bz2`

From the footer of `https://kaikki.org/itwiktionary/`:

> This page is a part of the kaikki.org machine-readable dictionary. This dictionary is based on
> structured data extracted on 2026-09-16 from the itwiktionary dump dated 2026-09-01 using
> wiktextract ([d6fca27](https://github.com/tatuylonen/wiktextract/commit/d6fca2773bc90b9157248b9edf69585da06bf393)
> and [65e1673](https://github.com/tatuylonen/wikitextprocessor/commit/65e1673d15c3b06f1de84d1c34303fc8f68c3528)).

So the identity gap is a capture problem, not an upstream one: everything missing from the July file
is published, and a fetch that reads the log and the footer at the same time as the archive records
all of it. The procedure is [How to re-fetch an identified release](REFETCH_A_RELEASE.md) — five
steps, about a minute. A re-fetch is the only way to get a release we can honestly describe.

**[HUEY]** Publish from a fresh, fully identified re-fetch, or publish from the July snapshot with the
identity gap disclosed? Recommendation: **re-fetch**. The July file has no recoverable dump date or
extractor version, so every provenance claim about it would carry an asterisk forever, and the
existing validation work (issues #11, #16) would need redoing against the new data anyway. Trade-off:
a re-fetch invalidates the spot checks in `DATASET_SPOT_CHECK.md`, which were done against the July
bytes. Confidence: high that re-fetching is the right call; medium on how much re-validation it costs.

**Decided 2026-09-24:** Huey kept the July snapshot (ADR 0013, PR #130). §1.3 says how its source
is recorded.

---

## 2. Which licence applies, and the GFDL question

### 2.1 The chain of evidence

**Italian Wiktionary's own API** (`https://it.wiktionary.org/w/api.php?action=query&meta=siteinfo&siprop=rightsinfo&format=json`)
returns:

```json
{"rightsinfo": {"url": "https://creativecommons.org/licenses/by-sa/4.0/deed.it",
                "text": "Creative Commons Attribution-Share Alike 4.0"}}
```

**The page footer** on `https://it.wiktionary.org/wiki/casa`:

> Il testo è disponibile secondo la [licenza Creative Commons Attribuzione-Condividi allo stesso
> modo](https://creativecommons.org/licenses/by-sa/4.0/deed.it); possono applicarsi condizioni
> ulteriori. Vedi le [condizioni d'uso](https://foundation.wikimedia.org/wiki/Special:MyLanguage/Policy:Terms_of_Use/it)
> per i dettagli.

("The text is available under the CC Attribution-ShareAlike licence; additional terms may apply. See
the terms of use for details.")

**kaikki.org's own statement**, from the "Copyright and license" section of `https://kaikki.org/itwiktionary/`:

> This data is extracted from Wiktionary and is updated regularly. The full original Wiktionary data
> can be downloaded from Wikimedia dumps. **This data is made available under the same licenses as
> Wiktionary - both CC-BY-SA and GFDL.** See Wiktionary copyright page for more information.

kaikki adds no licence of its own on top. It passes through Wiktionary's terms. Note: kaikki asks a
favour, not a condition —

> If you use this data in academic research, please cite Tatu Ylonen: Wiktextract: Wiktionary as
> Machine-Readable Structured Data […] Linking to the relevant page(s) under https://kaikki.org would
> also be greatly appreciated.

That "would be appreciated" is a request, not a licence term. We should honour it anyway; it costs
one line.

### 2.2 The GFDL question is answered: we can comply with CC BY-SA 4.0 alone

This was the open question from `SOURCE_RESEARCH.md`. The Wikimedia
[Terms of Use](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use), section 7(a), in force
since 7 June 2023, says contributors license their text under:

> - [Creative Commons Attribution-ShareAlike 4.0 International License](https://creativecommons.org/licenses/by-sa/4.0/) ("CC BY-SA 4.0"), and
> - [GNU Free Documentation License](https://www.gnu.org/copyleft/fdl.html) ("GFDL") (unversioned, with no invariant sections, front-cover texts, or back-cover texts).
>
> **Reusers may comply with either license or both.**

And section 7(c) closes the other door:

> You shall not import content that is available solely under GFDL.

So: there is no GFDL-only text on the project, and where GFDL does apply we may ignore it and comply
with CC BY-SA 4.0 instead. **Conclusion: comply with CC BY-SA 4.0. Do not take on GFDL obligations.**

This is version-independent, which is why the July snapshot's unknown release date does not reopen the
question — it is not a property of the snapshot, it is a property of the project's licensing terms.

**Two caveats that survive.** Both come from the same ToU, section 7(g):

> If the text content was imported from another source, it is possible that the content is licensed
> under a compatible CC BY-SA license but not GFDL […] To determine the license that applies to the
> content that you seek to reuse or redistribute, you should review the page footer, page history,
> and discussion page.
>
> In addition, please be aware that text that originated from external sources and was imported into
> a Project may be under a license that attaches additional attribution requirements. Users agree to
> indicate these additional attribution requirements clearly. […] Where there are such visible
> notations, reusers should preserve them.

This is what "possono applicarsi condizioni ulteriori" in the footer means. **The wiktextract output
strips those notations.** Our extract has no page-level banners, no talk pages, no page history — so
we structurally cannot see an extra-attribution notice if one exists. See [§6](#6-extra-attribution-notices-we-cannot-see)
for what to do about it.

### 2.3 What CC BY-SA 4.0 actually requires of us

Quoting the [legal code](https://creativecommons.org/licenses/by-sa/4.0/legalcode.en), section 3(a)(1),
which applies "If You Share the Licensed Material (including in modified form)":

> - retain the following if it is supplied by the Licensor with the Licensed Material:
>   - identification of the creator(s) […]
>   - a copyright notice;
>   - a notice that refers to this Public License;
>   - a notice that refers to the disclaimer of warranties;
>   - a URI or hyperlink to the Licensed Material to the extent reasonably practicable;
> - **indicate if You modified the Licensed Material and retain an indication of any previous modifications**; and
> - indicate the Licensed Material is licensed under this Public License, and include the text of, or
>   the URI or hyperlink to, this Public License.

And 3(a)(2), which is why a compact per-result notice plus a full attribution page is acceptable:

> You may satisfy the conditions in Section 3(a)(1) in any reasonable manner based on the medium,
> means, and context in which You Share the Licensed Material. **For example, it may be reasonable to
> satisfy the conditions by providing a URI or hyperlink to a resource that includes the required
> information.**

Section 3(b), ShareAlike:

> if You Share Adapted Material You produce […] The Adapter's License You apply must be a Creative
> Commons license with the same License Elements, this version or later, or a BY-SA Compatible
> License. You must include the text of, or the URI or hyperlink to, the Adapter's License You apply.
> You may not offer or impose any additional or different terms or conditions on, or apply any
> Effective Technological Measures to, Adapted Material that restrict exercise of the rights granted
> under the Adapter's License You apply.

Section 2(a)(5)(C), no downstream restrictions, applies to the unmodified material too:

> You may not offer or impose any additional or different terms or conditions on, or apply any
> Effective Technological Measures to, the Licensed Material if doing so restricts exercise of the
> Licensed Rights by any recipient of the Licensed Material.

Section 2(b), other rights — this shapes our wording:

> Moral rights […] are not licensed under this Public License […] **Patent and trademark rights are
> not licensed under this Public License.**

Plus section 2(a)(6), no endorsement:

> Nothing in this Public License constitutes or may be construed as permission to assert or imply
> that You are, or that Your use of the Licensed Material is, connected with, or sponsored, endorsed,
> or granted official status by, the Licensor.

Practical consequences for our copy: **name Wiktionary, don't imply it endorses us, and don't use the
Wikipedia/Wiktionary/Wikimedia logos or wordmarks as branding.** Naming the source in plain text is
attribution and is fine; putting the puzzle-globe in our header is a trademark question, not a
licence question.

### 2.4 Commercial use, and the facts-versus-expression line

CC BY-SA 4.0 permits commercial use. ToU 7(a) again:

> Please note that these licenses do allow commercial uses of your contributions, as long as such
> uses are compliant with the terms of the respective licenses. **Where you own Sui Generis Database
> Rights covered by CC BY-SA 4.0, you waive these rights. As an example, this means facts you
> contribute to the projects may be reused freely without attribution.**

That last sentence is tempting and we should not lean on it. It would arguably cover bare facts —
"`casa` is feminine", "`parlerei` is a form of `parlare`" — but it does **not** cover written gloss
prose, usage examples, or etymology paragraphs, which are the bulk of what a user sees. Sorting our
data field-by-field into "fact" and "expression" is exactly the kind of line-drawing we are not
qualified to do.

**Recommendation: attribute everything.** Treat the whole dataset as licensed material. The cost is
one notice; the cost of getting the split wrong is a licence breach. Confidence: high.

---

## 3. What the attribution has to achieve

The notices themselves — the result-page text, the public attribution page, the API envelope, and
the wording we must not use — are drafted in
[Attribution notices and release metadata](ATTRIBUTION_NOTICES.md). They are drafts, not paste-ready
public notices: the full public page still needs an English translation, the B2 licence decision, any
audio terms, verified metadata and any extra source notices from §6 before publication. This section
is why each one is shaped the way it is.

### 3.1 On a word-result page

The [result-page notice](ATTRIBUTION_NOTICES.md#result-page-notice-draft) is compact and sits under
the definitions block. Three things make it work, and all three are load-bearing:

1. **The history link is the author credit.** ToU 7(g) accepts exactly this:
   > Through hyperlink (where possible) or URL to the page or pages that you are reusing (since each
   > page has a history page that lists all contributors, authors and editors)

   We must therefore link **per word**, to the page we actually reused — not to `it.wiktionary.org`
   generally. A site-wide link does not identify the authors of this entry.
2. **The change notice is required and must be specific.** 3(a)(1)(B) says "indicate if You modified".
   "Adapted from Wiktionary" alone is weak; naming what we did to it is better.
3. **`/attribuzione` carries the rest.** 3(a)(2) lets a link absorb the copyright notice, warranty
   disclaimer, and release identification.

**Placement rule:** the notice must be visible on the rendered page without interaction. A notice
hidden behind an accordion, or shown only on an "About" page, does not attribute the entry the user
is looking at. If space is tight, shorten the sentence — do not move it.

**If a result is a form that resolved to a different lemma** (`case` → `casa`), the notice must name
and link **the page the text came from**, not the queried form. This is the same defect as issue
[#16](https://github.com/povlabs/lexema/issues/16); the licence turns it from a quality bug into a
compliance bug.

### 3.2 The public attribution page

Route: `/attribuzione` (IT) and `/licence` (EN), linked from the site footer on every page. It
carries what 3(a)(2) lets a link absorb — the copyright notice, the warranty disclaimer, the release
identification — plus what we changed, the trademark disclaimer, and the statement that no
third-party dictionary text entered the data. The
[draft page](ATTRIBUTION_NOTICES.md#public-attribution-page-draft) is written out in full, and its
`{...}` placeholders come from release metadata: they **must not be published with guessed values.**

**Built since 2026-10-04 ([#139](https://github.com/povlabs/lexema/issues/139)).** The English page
is `/licence`, and `/attribution`, its old address, redirects to it. No `/attribuzione` page exists
yet. [WEB.md](WEB.md#why-the-credit-is-on-its-own-page) describes the current page.

### 3.3 In API responses and data downloads

A machine consuming our data cannot read a footer, so every response that carries source-derived text
has to carry the notice itself — the
[`attribution` envelope](ATTRIBUTION_NOTICES.md#api-responses-and-bulk-downloads-draft) does that,
carrying the same facts the result-page notice shows a reader.

A bulk download is the same problem with no response to attach to, so the notice ships as files
inside the archive. A bare `.jsonl.gz` with no notice files does not attribute anything.

### 3.4 Text we must not use

Two families of wording are ruled out, and
[the list is on the reference page](ATTRIBUTION_NOTICES.md#text-we-must-not-use). Anything implying
Wikimedia endorses us is trademark and endorsement, see §2.3; a blanket "all rights reserved" over
source-derived definitions is offering additional restrictions on the Licensed Material, which
2(a)(5)(C) forbids.

---

## 4. How our own outputs are licensed

Three layers, with legal conditions separated from proposed policy. `LEXEMA_SPEC.md` separates these layers; this research does not settle the open licensing choices.

### 4.1 Application code — not affected

The importer, the site, the API, the Italian adapter, the article rules **as code**: CC BY-SA's
ShareAlike attaches to Adapted Material — adaptations of the licensed text — not to software that
processes it. Our code contains no Wiktionary text (the checked-in fixtures do; see §4.4).

**Decided (Huey, 2026-10-03, when the repo went public):** "all rights reserved for now". The code is
proprietary: published for reading, with no reuse licence. See [`LICENSE`](../LICENSE). Upstream-derived
material keeps CC BY-SA 4.0 (§4.2, §4.4). A more open licence can be chosen later; an open licence
could not be taken back.

### 4.2 Dictionary data — conditional duties and proposed CC BY-SA policy

Section 4 begins with a condition:

> Where the Licensed Rights include Sui Generis Database Rights that apply to Your use of the Licensed Material:

Section 4(b) adds another condition:

> if You include all or a substantial portion of the database contents in a database in which You have
> Sui Generis Database Rights, then the database in which You have Sui Generis Database Rights (but
> not its individual contents) is Adapted Material, including for purposes of Section 3(b)

**[UNPROVEN]** This research establishes neither applicable source database rights nor database rights held by Lexema in the new database. Section 4(b) therefore does not, by itself, prove that our projection is Adapted Material.

Section 1(a) separately defines Adapted Material as modification “in a manner requiring permission under the Copyright and Similar Rights held by the Licensor.” Restructuring alone does not establish that condition. When we share qualifying Adapted Material, §3(b)'s ShareAlike duties apply; copied licensed text still carries its applicable licence duties even without an adaptation.

**[HUEY] Proposed conservative policy:** offer the published data bundle under CC BY-SA 4.0 to the extent we can license our contributions, while retaining upstream terms. This avoids field-by-field legal judgments, at the cost of granting reuse rights on original contributions too. Confidence: high that the cited conditions must be considered; no legal conclusion here that each output meets them. B2 remains open.

What this does **not** mean:

- It does not force us to publish a bulk download. ShareAlike bites on what we *Share*. Running a
  website that displays the data is Sharing the material that is displayed; it is not a duty to hand
  over our whole database. See §8.
- It does not make the service free of charge. Commercial use is permitted.
- It does not touch our code (§4.1) or our unpublished internal data.

What it **does** mean:

- We cannot put the published data behind terms of service that forbid reuse, scraping of the
  displayed content, or redistribution. That is "additional or different terms" under 2(a)(5)(C) and
  3(b)(3). **This directly constrains issue [#9](https://github.com/povlabs/lexema/issues/9)'s access
  model** — rate limits and API keys that protect the service are fine (they restrict *access to our
  service*, not the *licensed rights* in material already received); a clause saying "you may not
  redistribute the definitions you obtained" is not.

**[HUEY]** Confirm the ToS will not contain a no-redistribution clause covering source-derived
content. This is a product decision with a licence consequence, not a research question.

### 4.3 Our review records — the interesting case

Issue [#12](https://github.com/povlabs/lexema/issues/12) will produce records like "the source says
`studente` is a verb form; we reviewed this and marked the claim disputed." Split them in two:

| Kind of record | Example | Licence | Why |
| --- | --- | --- | --- |
| A correction or annotation **attached to** source text | "this gloss is wrong", a corrected gender tag, a disputed-claim flag on a specific sense | **Depends on content and applicable rights; proposed bundle policy: CC BY-SA 4.0** | Attachment alone does not prove modification requiring permission under §1(a). A factual flag may be independent; a rewritten protected gloss may be an adaptation. This research has not decided each case. |
| Independent, freshly authored content | our own usage examples, our own grammar explanations, the deterministic article outputs | **[HUEY] — free choice** | Not derived from the licensed text. The article rules are ours; `il` in front of `cane` is a fact plus our rule, not Wiktionary's expression. |
| Process metadata | who reviewed, when, confidence score | **[HUEY] — free choice** | No lexical claim, no derivation. |

**Recommendation:** license the whole published data bundle under CC BY-SA 4.0 anyway, including the
independent parts to the extent we hold the necessary rights. One licence on our contributions is simpler to state and honour, but does not replace upstream notices or resolve third-party rights. Trade-off: we give away reuse rights on our own original content that we
did not strictly have to. That matters only if original content later becomes the product's moat —
and if that day comes, we split the bundle then. Confidence: medium-high. This is genuinely a business
call, so it is marked **[HUEY]**.

Whatever is chosen, the **separation must be visible in the data**, not just in a policy document.
`LEXEMA_SPEC.md`'s `sourceType` values (`wiktionary-derived`, `lexema-deterministic`, `lexema-reviewed`,
…) already do this job, and `src/core/types.ts` already implements them. Keep them, and make the
attribution page explain what each means in plain words.

### 4.4 The checked-in fixtures

`fixtures/` contains real extracted records. If this repository ever goes public, those files are
published Wiktionary-derived material and need the same notice — a `fixtures/ATTRIBUTION.md` pointing
at the source pages and CC BY-SA 4.0. Small, but it is publication.

---

## 5. Audio, images, and quoted text — reviewed separately

The text licence does **not** carry over to media. ToU 7(d):

> **Non-text media:** Non-text media on the Projects are available under a variety of different
> licenses […]

and 7(g):

> For any non-text media, you agree to comply with the applicable license under which the work has
> been made available (which can be discovered by clicking on the work and looking at the licensing
> section on its description page […])

### 5.1 Audio — confirmed mixed licences, per file

Our extract references Wikimedia Commons audio: 10,874 distinct files across all languages,
**499 distinct files on Italian-language records** (674 references). Every `sounds[]` entry carries
URLs like:

```json
{"ipa": "/ˈkasa/", "audio": "it-casa.ogg",
 "ogg_url": "https://commons.wikimedia.org/wiki/Special:FilePath/it-casa.ogg",
 "mp3_url": "https://upload.wikimedia.org/wikipedia/commons/transcoded/8/89/It-casa.ogg/It-casa.ogg.mp3"}
```

Seven files were sampled through the Commons API (`prop=imageinfo&iiprop=extmetadata`) on 2026-09-18.
**Four different licences in seven files:**

| File | Licence | Attribution required | Author / credit |
| --- | --- | --- | --- |
| `It-poco.ogg` | CC BY 3.0 US | yes | Marta Carbone, Association Shtooka |
| `It-una forchetta.ogg` | CC BY 3.0 US | yes | Marta Carbone, Association Shtooka |
| `It-cucina.oga` | CC BY-SA 3.0 | yes | Icedlake |
| `It-mese.ogg` | CC BY-SA 3.0 | yes | Accurimbono |
| `Assam.ogg` | CC BY-SA 3.0 | yes | Srikeit (from en.wikipedia) |
| `It-Parma.ogg` | Public domain | no | User:Paginazero |
| `LL-Q652 (ita)-DanielParoliere-hovercraft.wav` | CC0 | no | DanielParoliere |

So: some files need named-author credit, some need ShareAlike, some need nothing — and the extract
**tells us none of this.** The `sounds[]` object has no licence and no author field.

**Rules for audio:**

1. **Do not copy or re-host any audio file** until its licence has been fetched from Commons and stored.
   `LEXEMA_SPEC.md` already says this; it is now backed by evidence.
2. **Hot-linking is still publishing.** Embedding `upload.wikimedia.org` URLs in an `<audio>` element
   puts the work in front of our users. A CC BY file still needs its author credited next to the
   player. (It also hammers someone else's bandwidth, which is a separate rudeness.)
3. If audio ships, each clip needs, next to the player: file name linking to its Commons description
   page (`https://commons.wikimedia.org/wiki/File:{name}`), author, licence name, licence link.
4. **Cheapest compliant path:** ship only `CC0` and public-domain clips at first, which need no credit,
   and add the credited ones once the per-file metadata pipeline exists. In the sample above that is
   2 of 7 — a real but non-trivial fraction.
5. **IPA transcriptions are text**, not media. They come under the CC BY-SA 4.0 text licence like
   everything else.

This is a direct constraint on issue [#20](https://github.com/povlabs/lexema/issues/20).

### 5.2 Images — none present

A full pass over all 799,600 records found **zero** image references. No top-level `images`/`image`
key exists in the data at all (the complete set of top-level keys is `antonyms, categories, derived,
etymology_texts, forms, hypernyms, hyphenations, hyponyms, lang, lang_code, notes, pos, pos_title,
proverbs, raw_tags, redirect, related, senses, sounds, synonyms, tags, title, translations, word`).
Nothing to clear. If a future extractor version adds images, they fall under §5.1's rules, not the
text licence.

### 5.3 Quoted text inside examples — low risk, but keep the citation

3,846 `examples[].ref` values exist across the whole file, but only **3 on Italian-language records**
(Carlo Goldoni d. 1793, Vittoria Colonna d. 1547, Leo Ferrero d. 1933). The rest sit on Latin records
(Cicero, Virgil, Tacitus, the Pater noster) that we do not serve. The other 18,140 Italian examples
have no `ref` and read as community-written sentences (`dopo due anni di galera sono tornato libero`),
which are ordinary CC BY-SA 4.0 contributions.

No modern in-copyright quotation was found: a scan for 20th/21st-century years in `ref` values
returned nothing. The most recent Italian author quoted, Leo Ferrero, died in 1933 — past Italy's
70-years-after-death term.

**[UNPROVEN]** This is a scan of the structured `ref` field, not a plagiarism audit of 18,143 example
sentences. A quotation pasted into `text` without a `ref` would not show up.

**Rules for quoted text:**

1. When an example has a `ref`, **display the `ref`.** It is the "visible notation" ToU 7(g) says
   reusers should preserve, and dropping it strips the original author's credit.
2. Do not import examples from any source outside the dataset.

### 5.4 Treccani — cross-check only, and it must stay that way

Treccani pages reserve reproduction. `SOURCE_RESEARCH.md` used Treccani to check facts, and no
Treccani text entered the dataset — confirmed: our data has exactly one origin, the kaikki file.

This must hold as a rule, not a habit: **a fact confirmed against Treccani may inform a review
decision; Treccani wording may never be copied into a record, a gloss, an example, or a commit
message.** When issue #12's review process starts writing corrections, this is the thing most likely
to go wrong — an agent "fixing" a definition by pasting a better one from the dictionary it just
consulted. Facts about a language are not owned by anyone; the sentences describing them are.

---

## 6. Extra-attribution notices we cannot see

From §2.2: ToU 7(g) requires reusers to preserve visible notations marking text imported from
elsewhere under extra attribution terms. The wiktextract output drops all page-level banners, talk
pages, and edit history, so we cannot detect them.

**[UNPROVEN] Unresolved publication clearance (B14).** A source/history link credits contributors; preserving external-source notices is a separate question. The cited ToU does not establish that a generic live-page link satisfies every additional attribution term. Notices were not inspected, and dictionary length is not evidence of low exposure.

Before publication, inspect the relevant source pages, histories and discussion pages for the material to be served, retain any applicable extra notices, and record how the release satisfies them. A dump/template scan can help find notices but has unproven coverage. If inspection cannot establish clearance, informed legal review must determine a defensible scope and treatment; unresolved material must not be published. Record the inspected revision/source, notice, and clearance basis. Merely accepting the uncertainty or adding a history link does not complete B14.

---

## 7. Source metadata we must retain

### 7.1 Per release

`ReleaseMetadata` in [`src/core/types.ts`](../src/core/types.ts) carries most of what a release needs
already. Six fields are missing, and every one of them is the difference between a release we can
describe and one we can only point at: which dump it came from, when it was built, which extractor
built it, which HTTP response we actually received, and how sure we are of all that. The field list
is [Release metadata to retain](ATTRIBUTION_NOTICES.md#release-metadata-to-retain).

`identityConfidence` is the one that earns its place: it makes the July snapshot's gap
representable instead of hidden. The July snapshot is published with its dump recorded as
`inferred` (ADR 0013, PR #130; §1.3); the rule that an `inferred` release is never published no
longer holds.

`license` records the source licence we elect under ToU 7(a), which is a separate question from B2's
bundle policy. It should not be `["CC-BY-SA-4.0", "GFDL"]` as `LEXEMA_SPEC.md` currently suggests:
per §2.2 we elect CC BY-SA 4.0 and do not take on GFDL duties, and listing GFDL claims obligations we
are not meeting.

### 7.2 Per record — the gap that matters

The extract has **no page ID and no revision ID.** Confirmed: no `source`, `page_id`, or `revision`
key exists anywhere in 799,600 records. So we cannot cite the exact revision our text came from — only
the live page, which may have changed since.

We must therefore retain, per served item, enough to name the release, locate the exact source value
inside it, and build the source and history URLs — which means the word **of the record the text came
from**, not the word the user typed. That last one is issue
[#16](https://github.com/povlabs/lexema/issues/16), which the licence turns from a quality bug into a
compliance bug. The field list is
[Per-record metadata to retain](ATTRIBUTION_NOTICES.md#per-record-metadata-to-retain).

A stronger option, if we ever want revision-exact citations: resolve each headword to a revision ID
once per release via the MediaWiki API and store it. Worth doing only if entry-level "as of revision
N" citations become a product requirement.

---

## 8. Redistribution duties for a download or an API

The duties accumulate with reach: a website owes the result-page notice and the attribution page, an
API owes those plus a machine-readable notice in every response, a bulk download owes those plus
notice files and metadata in the archive, and audio owes a per-file licence and author before
anything is served at all. The surface-by-surface table is
[Duties per distribution surface](ATTRIBUTION_NOTICES.md#duties-per-distribution-surface); it
combines applicable source-licence duties with our proposed notice design and conservative bundle
policy, and exact placement and packaging there are implementation proposals, not verbatim licence
requirements. B2, B8 and B14 must be resolved before any of it becomes a final release instruction.

Two things are true on every surface: **no DRM or technical measure that restricts reuse** (2(a)(5)(C)),
and **downstream recipients get their rights directly from the original authors**, not from us —
2(a)(5)(A): "Every recipient of the Licensed Material automatically receives an offer from the
Licensor." We are not in a position to grant or withhold anything.

---

## 9. Blockers to publishing

**Decided since.** Huey ruled on the open decisions below on 2026-09-21, and the ruling is
ADR 0009, `.decisions/0009-two-licences-and-a-source-link.md`, landing on
[PR #55](https://github.com/povlabs/lexema/pull/55): two licences, one *Source* link per result, an attribution page, no audio at launch, open site terms, and a lawyer before public launch.
Read this table as the history that led there, not as the current policy. The numbers are kept
because other issues cite them.

Everything below blocks **external publication only**. Nothing here blocks local development —
keep building.

### Needs Huey's decision (research will not settle these)

| # | Decision | Where | Recommendation |
| --- | --- | --- | --- |
| B1 | Re-fetch a fully identified release, or publish from the July snapshot with the gap disclosed? | §1.4 | **Re-fetch.** The July file's dump date and extractor version are unrecoverable. |
| B2 | Licence for the published data bundle — CC BY-SA 4.0 for everything, or split source-derived from Lexema-original? | §4.2, §4.3 | **One bundle, CC BY-SA 4.0.** Simplest to honour; revisit if original content becomes the product. |
| B3 | Licence for the application code. | §4.1 | Free choice. Decide when the repo's visibility is decided. |
| B4 | Confirm the ToS will contain no clause restricting reuse or redistribution of displayed/returned content. | §4.2 | Required, not optional, if we publish source-derived text. Affects issue #9. |
| B5 | Ship audio at launch? If yes, budget the per-file Commons licence pipeline. | §5.1 | **Not at launch.** Or CC0/PD clips only. Affects issue #20. |
| B6 | Is a professional legal review wanted before the first public release? | all | Above my pay grade, and yours. My read: the CC BY-SA path here is well-trodden and the analysis is grounded in quoted primary sources — but "well-trodden" is not "cleared", and B2/B4 have commercial consequences a lawyer should see. |

### Implementation still needed (subject to the open decisions and clearance)

| # | Work | Where | Related issue |
| --- | --- | --- | --- |
| B7 | Result-page attribution notice, per word, with history link and change notice. | §3.1 | #14, #19 |
| B8 | Finalise and implement `/attribuzione`, and finalise the English page, built as `/licence` ([#139](https://github.com/povlabs/lexema/issues/139)): fill licence/audio choices, translate the full English page, verify metadata and include cleared extra notices. Drafts are not publication-ready. | §3.2 | #19 |
| B9 | Fix form→lemma attribution so the notice cites the record the text actually came from. | §3.1, §7.2 | **#16 — now a compliance blocker, not just a bug** |
| B10 | Add the missing `ReleaseMetadata` fields, including `identityConfidence`; set `license` to whatever B2 decides (the proposed policy is `["CC-BY-SA-4.0"]`). | §7.1 | #2, #10 |
| B11 | Capture the kaikki log and edition-page footer at fetch time. | §1.4 | #10 |
| B12 | Display `examples[].ref` wherever an example with a ref is shown. | §5.3 | #20 |
| B13 | If the repo goes public, add `fixtures/ATTRIBUTION.md`. | §4.4 | — |

### Unresolved publication clearance

| # | Required clearance | Where |
| --- | --- | --- |
| B14 | Inspect and preserve applicable extra-attribution notices for served content, or obtain informed legal review defining a defensible clearance process. Record evidence; unresolved content stays unpublished. | §6 |

### Open question, low priority

| # | Question | Where |
| --- | --- | --- |
| B15 | Should we store per-entry revision IDs for revision-exact citation? | §7.2 |

### Settled by this document — no longer blockers

- **GFDL.** Wikimedia ToU 7(a) lets reusers comply with CC BY-SA 4.0 alone, and 7(c) forbids
  GFDL-only content. We comply with CC BY-SA 4.0. (§2.2)
- **Commercial use.** Explicitly permitted. (§2.4)
- **Does ShareAlike force our code open?** No. (§4.1)
- **Does ShareAlike force us to publish a bulk download?** No. (§4.2, §8)
- **Images.** None in the data. (§5.2)
- **Treccani contamination.** None found; rule restated. (§5.4)

---

## Sources

All checked 2026-09-18.

- Italian Wiktionary rights API — <https://it.wiktionary.org/w/api.php?action=query&meta=siteinfo&siprop=rightsinfo&format=json>
- Wikimedia Terms of Use (in force since 2023-06-07) — <https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use>
- CC BY-SA 4.0 deed — <https://creativecommons.org/licenses/by-sa/4.0/> · Italian deed — <https://creativecommons.org/licenses/by-sa/4.0/deed.it>
- CC BY-SA 4.0 legal code — <https://creativecommons.org/licenses/by-sa/4.0/legalcode.en>; §1(a) and §4 conditions independently checked in [Creative Commons' legal-text repository](https://github.com/creativecommons/cc-legal-tools-data/blob/main/legacy/legalcode/by-sa_4.0_en.html) during PR repair.
- kaikki.org Italian edition, incl. copyright section and release footer — <https://kaikki.org/itwiktionary/>
- kaikki.org raw data downloads — <https://kaikki.org/dictionary/rawdata.html>
- kaikki.org Italian build log — <https://kaikki.org/dictionary/downloads/it/it-extract.log>
- Wikimedia dumps index for itwiktionary — <https://dumps.wikimedia.org/itwiktionary/>
- Wikimedia Commons file metadata API — `https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=extmetadata&titles=File:...`
- wiktextract — <https://github.com/tatuylonen/wiktextract>
- Earlier research in this repo — [source research](../reports/2026-09-18-source-research.md), [dataset findings](../reports/dataset-findings.md), [`LEXEMA_SPEC.md`](LEXEMA_SPEC.md)
