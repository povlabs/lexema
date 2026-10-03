---
id: 0009
title: Source-derived data is CC BY-SA, Lexema's own content is not, and a result shows one Source link
status: amended-in-part by [0013](0013-site-public-behind-rate-limits.md)
date: 2026-09-21
tags: [licensing, product]
---

# 0009 — Source-derived data is CC BY-SA, Lexema's own content is not, and a result shows one Source link

**What this decides:** What Lexema publishes under Wiktionary's licence, what it keeps under its own terms, how a result page credits the source, and what must happen before anything goes public.

## Context

Lexema's dictionary text is copied from Italian Wiktionary through Kaikki. Wiktionary text is CC BY-SA 4.0: anyone may reuse it, commercially too, if they credit the source, release adaptations of it under the same licence, and add no terms that block reuse. The licensing research on [#26](https://github.com/povlabs/lexema/pull/26) established that from the primary sources, settled that CC BY-SA 4.0 alone suffices (no GFDL duty), that ShareAlike reaches neither the application code nor any obligation to publish a bulk download, and left six calls to Huey.

Huey intends a paid API. That makes one of those calls load-bearing: whether Lexema's own content, the labelled explanations and examples of [0008](0008-generated-explanations-are-labelled-and-reportable.md) and the review records, is released under CC BY-SA with the source text or kept under Lexema's terms. Huey also wants the result page to carry a single small link rather than a credit line.

Huey ruled on 2026-09-21, in conversation, on each point below.

## Decision

**Source-derived data is published under CC BY-SA 4.0 because it must be; Lexema's own content is not, and stays separable; a result page credits the source with one link, and the full credit lives on one attribution page.**

- **Two licences.** Everything copied or adapted from Wiktionary is CC BY-SA 4.0. Everything Lexema writes itself, generated explanations and examples, review verdicts, is licensed under Lexema's own terms, decided at launch, and may be paid-only. The schema keeps the two in separate fields with provenance, which is what makes the split real rather than claimed.
- **One Source link per result.** Each reading shows a small link labelled *Source* to its Wiktionary page. No credit line, licence name, or contributor text appears on the search page.
- **One attribution page.** A public `/attribution` page carries the full credit: Wiktionary contributors, the source pages and their histories, CC BY-SA 4.0 with a link, the release identity, and a statement that Lexema restructured the text. A small footer link reaches it from every page. Pages other than the search page may carry a normal-sized credit.
- **API responses** carry the same attribution in a field, so a customer can pass it on.
- **A dated release before publication.** The published data comes from a fetch whose date, checksum, and upstream dump are recorded; the July file, whose dump date is unrecoverable, is not published.
- **No audio at launch.** Audio files carry per-file licences and wait for their own pipeline.
- **Open site terms.** The terms of service add no clause restricting reuse of source-derived content a user sees or receives.
- **Legal review before public launch.** A lawyer confirms the two-licence split and the link-only credit before the first public release. Until then, access stays local or private preview, per [0004](0004-cloudflare-workers-d1-vinext.md).
- **Application code licence** is deferred to the decision on the repository's visibility.

**Binding constraints.**

- No source-derived value is served without a provenance pointer that can reach its Wiktionary page.
- No Lexema-original content is stored in a field that also holds source text.
- The *Source* link and the attribution page are implemented before any address outside this machine serves results.
- Nothing above is legal advice; the lawyer's review can amend this record.

## Consequences

A paid API is possible: the service, and Lexema's own content, are what is sold; the Wiktionary text inside a response remains reusable by whoever receives it, and Lexema never claims otherwise. The search page stays clean at the cost of a link-only credit that the lawyer must accept. A fresh, identified fetch is required before launch, which #10's importer already records. #6 closes on this record; the implementation items in `docs/LICENSING.md` §9 become issues under "Controlled release".

## Records

Two terms to route to `.glossary/TERMS.md` once the fields exist: *source-derived* (copied or adapted from Wiktionary, CC BY-SA) and *Lexema-original* (written by Lexema, its own terms).

## Amendments

- **One licence, not two (2026-09-21).** Huey, the same evening: "i will try to sell the service not explanations. someone easily can create these explanations in a friday afternoon. especially in this ai era." Everything Lexema publishes, source-derived and Lexema-original alike, ships under CC BY-SA 4.0. A reader or an API customer may republish an explanation, with attribution, and that is accepted: the product is the service, not the sentences. The two-licence rule above, and the "may be paid-only" clause, are withdrawn.

  What does not change: a paid API is still allowed, because CC BY-SA permits commercial use. Lexema-original content still lives in fields of its own, never mixed into a source record, for three reasons that outlive the licence question — the page must be able to say which words are the dictionary's and which are Lexema's, the attribution must credit Wiktionary's text specifically, and a re-import must never overwrite what Lexema wrote. The lawyer's review before public launch now confirms one licence and the link-only credit.

- **#281 — One Source link per result page, not one per reading (2026-09-30).** Huey, on [#281](https://github.com/povlabs/lexema/issues/281): "macchina" shows "Source macchina ↗ · Source macchinare ↗ · Report a mistake"; he wants a single "Source ↗ · Report a mistake". The *One Source link per result* clause now reads: a result page shows one link labelled *Source*, with no word after it, to the Wiktionary page of the spelling in its title (a searched expression's page links to the expression's page); the credit on `/attribution` and each API result's `attribution` field are unchanged.

- **#459 — A forms-only word page links its first declared form (2026-10-03).** A page for a word that only its forms name (the declared-lemma page from #453, such as `verbalizzare`) used the #281 rule, so *Source* opened the Wiktionary page of the title spelling. That page almost never exists. Huey [ruled on #459](https://github.com/povlabs/lexema/issues/459#issuecomment-5969625294) that on such a page *Source* opens the page of the first form its forms table shows, because that is where the shown data comes from, and that the link always stays. "First form" is the first form a source record declares, in the order the table renders, so a grid's own title-spelling cell is skipped: `verbalizzare` links *verbalizzando*, `fratellino` links *fratellini*. The #281 clause is unchanged for every other result page.
