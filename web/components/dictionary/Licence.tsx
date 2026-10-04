// The Licence page's text (#139, frames 33 and 33m), with no database in it.
//
// This page carries the whole credit ADR 0009 asks for, which every result's
// small Source link leans on. The words are Huey's, approved on 2026-10-04
// (https://github.com/povlabs/lexema/issues/139#issuecomment-5978972736), and
// are kept exactly; only the release in section 5 is filled in, from the value
// `licence/page.tsx` hands in. Sections 1, 3, 4, 5 and 7 carry the ids the old
// `/attribution` page's sections had, so a link to one of them still lands on
// the section that replaced it.

import { ExternalLink } from "@/components/shared/ExternalLink";
import { LEGAL_ITEMS, LEGAL_PARAGRAPH, LEGAL_UNBROKEN, LINK } from "@/components/shared/styles.ts";
import type { ServedRelease } from "@lexema/source/servedRelease.ts";
import { LegalItem } from "@/components/shared/LegalPage";
import { DictionaryLegalPage } from "./DictionaryLegalPage";

const LICENCE_URL = "https://creativecommons.org/licenses/by-sa/4.0/";
const LICENCE_TEXT_URL = "https://creativecommons.org/licenses/by-sa/4.0/legalcode";

/** A dump's `YYYY-MM-DD` date, as a reader would say it. */
const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** The whole page, over the release the dictionary serves. */
export function Licence({ release }: { release: ServedRelease }) {
  return (
    <DictionaryLegalPage
      kicker="LEXEMA · LEGAL"
      title="Licence"
      effective="2026-10-04"
      lede="This page sets out the terms under which the lexical content published on Lexema may be reused, and credits the sources from which it is derived."
      sections={[
        {
          id: "licence",
          title: "Licence",
          body: (
            <p className={LEGAL_PARAGRAPH}>
              The definitions and other lexical content derived from the sources below are made available under the{" "}
              <ExternalLink className={LINK} href={LICENCE_URL}>
                Creative Commons Attribution-ShareAlike 4.0 International licence (CC BY-SA 4.0)
              </ExternalLink>
              .
            </p>
          ),
        },
        {
          id: "reuse",
          title: "Reuse",
          body: (
            <>
              <p className={LEGAL_PARAGRAPH}>Under that licence you may:</p>
              <ul className={LEGAL_ITEMS}>
                <LegalItem mark="a">copy and redistribute the content in any medium or format;</LegalItem>
                <LegalItem mark="b">adapt, transform and build upon it, for any purpose, including commercially;</LegalItem>
              </ul>
              <p className={LEGAL_PARAGRAPH}>
                provided that you give appropriate credit, provide a link to the licence, indicate any changes made,
                and distribute your contributions under the same licence.
              </p>
            </>
          ),
        },
        {
          id: "where",
          title: "Sources",
          body: (
            <>
              <p className={LEGAL_PARAGRAPH}>
                The content is derived from the{" "}
                <ExternalLink className={LINK} href="https://it.wiktionary.org/">
                  Italian Wiktionary
                </ExternalLink>{" "}
                (Wikizionario), a project of the{" "}
                <ExternalLink className={LINK} href="https://wikimediafoundation.org/">
                  Wikimedia Foundation
                </ExternalLink>{" "}
                written by volunteer contributors. Most entries are taken from the extraction published by{" "}
                <ExternalLink className={LINK} href="https://kaikki.org/itwiktionary/">
                  kaikki.org
                </ExternalLink>
                , produced with{" "}
                <ExternalLink className={LINK} href="https://github.com/tatuylonen/wiktextract">
                  wiktextract
                </ExternalLink>{" "}
                by Tatu Ylonen. Where that extraction could not read a page, Lexema reads the entry from the
                page&rsquo;s own text in the{" "}
                <ExternalLink className={LINK} href={release.dump.url}>
                  Wikimedia dump
                </ExternalLink>
                .
              </p>
              <p className={LEGAL_PARAGRAPH}>
                The authors of each entry are recorded in the revision history of its Wiktionary page. Every entry on
                Lexema links to that page.
              </p>
            </>
          ),
        },
        {
          id: "changed",
          title: "Modifications",
          body: (
            <p className={LEGAL_PARAGRAPH}>
              Lexema has adapted the source material: it is restructured and indexed for search, some grammatical
              information is added by rule, some wording is made consistent, and individual errors are corrected.
              Lexema does not write or generate definitions.
            </p>
          ),
        },
        {
          id: "version",
          title: "Version of the data",
          body: (
            <p className={LEGAL_PARAGRAPH}>
              The content is up to date with release <span className={LEGAL_UNBROKEN}>{release.release}</span>, published
              by kaikki.org and built from the Italian Wiktionary dump of{" "}
              <span className={LEGAL_UNBROKEN}>{DAY.format(new Date(release.dump.date))}</span>.
            </p>
          ),
        },
        {
          id: "disclaimer",
          title: "Disclaimer",
          body: (
            <p className={LEGAL_PARAGRAPH}>
              The content is provided &ldquo;as is&rdquo;, without warranties of any kind, as set out in{" "}
              <ExternalLink className={LINK} href={LICENCE_TEXT_URL}>
                section 5 of the licence
              </ExternalLink>
              . Lexema does not warrant that the content is accurate, complete or fit for any particular purpose.
            </p>
          ),
        },
        {
          id: "trademarks",
          title: "Trademarks",
          body: (
            <p className={LEGAL_PARAGRAPH}>
              Wikipedia, Wiktionary, Wikizionario and Wikimedia are registered trademarks of the Wikimedia Foundation,
              Inc. Lexema is not affiliated with, endorsed or sponsored by the Wikimedia Foundation.
            </p>
          ),
        },
      ]}
    />
  );
}
