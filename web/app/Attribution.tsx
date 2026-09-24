// The attribution page's markup, with no database in it.
//
// Split from `attribution/page.tsx` the way `SearchPage.tsx` is split from
// `page.tsx`: the route file reaches D1 through `cloudflare:workers`, and this
// file takes the release as a value, so `web/test/page.test.tsx` can render it.
//
// What is on this page and why is ADR 0009: each reading carries a small
// *Source* link and no credit, and this page carries the whole credit the
// licence asks for. The wording follows the English draft in
// docs/ATTRIBUTION_NOTICES.md. Two rules from that draft are load-bearing here:
// a `{...}` placeholder is never published with a guessed value, and a section
// the draft marks `{open — …}` stays open on the page, saying what would settle
// it. Neither a blank nor a plausible-looking value is allowed to stand in.

import type { ReactNode } from "react";
import type { ReleaseInfo } from "@lexema/lookup/types.ts";
import {
  CODE_IDENTITY,
  EMPTY,
  FIELD,
  FIELD_LABEL,
  FIELD_VALUE,
  LINK,
  OPEN_FIELDS,
  OPEN_MARK,
  PAGE_HEADING,
  PARAGRAPH,
  PROSE_LIST,
  RELEASE_FIELDS,
  SECTION_HEADING,
  SHELL_TOP,
} from "./styles.ts";
import { SiteHeader } from "./SiteHeader";

const LICENCE_URL = "https://creativecommons.org/licenses/by-sa/4.0/";
const LICENCE_TEXT_URL = "https://creativecommons.org/licenses/by-sa/4.0/legalcode";

/**
 * A column the import did not know.
 *
 * `null` is the import saying it did not know the value, which is a different
 * fact from an empty one, so it is said in words. Nothing here falls back to a
 * default: a release identity that guesses is worse than one that admits a gap.
 */
function NotRecorded() {
  return <span className={EMPTY}>not recorded</span>;
}

/** `2026-07-01` as `1 July 2026`, the date a reader would say. */
const DUMP_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** A field of the draft that is still open, and what would close it. */
function OpenField({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={FIELD}>
      <dt className={FIELD_LABEL}>
        {title} <span className={OPEN_MARK}>— open</span>
      </dt>
      <dd className={FIELD_VALUE}>{children}</dd>
    </div>
  );
}

/**
 * Where this release's data came from, or the reason there is none to show.
 *
 * Only what a reader needs to know that: the Wiktionary dump, and the file it
 * was downloaded as. The release's other facts — its checksum, when it was
 * downloaded, that the dump is inferred and why — are kept with the release
 * (src/source/archiveFacts.ts) and not shown here, by Huey's ruling on #133.
 *
 * A page that cannot read its release says so rather than rendering a table of
 * blanks, which would read as a release with no identity at all.
 */
function ReleaseIdentity({ release }: { release: ReleaseInfo | undefined }) {
  if (release === undefined) {
    return (
      <p className={EMPTY} role="status">
        The release serving this site could not be read, so this page cannot state which
        snapshot of the source it is showing. Nothing is assumed in its place.
      </p>
    );
  }

  return (
    <dl className={RELEASE_FIELDS}>
      <div className={FIELD}>
        <dt className={FIELD_LABEL}>Source</dt>
        <dd className={FIELD_VALUE}>
          {release.dump === null ? (
            <NotRecorded />
          ) : (
            <a className={LINK} href={release.dump.url} rel="noreferrer">
              Italian Wiktionary, dump of {DUMP_DATE.format(new Date(release.dump.date))}
            </a>
          )}
        </dd>
      </div>
      <div className={FIELD}>
        <dt className={FIELD_LABEL}>Downloaded from</dt>
        <dd className={FIELD_VALUE}>
          {release.sourceUrl === null ? (
            <NotRecorded />
          ) : (
            <a className={LINK} href={release.sourceUrl} rel="noreferrer">
              <code className={CODE_IDENTITY}>{release.sourceUrl}</code>
            </a>
          )}
        </dd>
      </div>
    </dl>
  );
}

/** The whole page, over one release. */
export function Attribution({ release }: { release: ReleaseInfo | undefined }) {
  return (
    <>
    <SiteHeader />
    <main className={SHELL_TOP}>
      <h1 className={PAGE_HEADING}>Sources and licences</h1>

      <section aria-labelledby="where">
        <h2 className={SECTION_HEADING} id="where">
          Where the definitions come from
        </h2>
        <p className={PARAGRAPH}>
          Lexema&rsquo;s Italian lexical data comes from the{" "}
          <a className={LINK} href="https://it.wiktionary.org/" rel="noreferrer">
            Italian Wiktionary
          </a>
          , the Italian edition of Wiktionary, a project of the{" "}
          <a className={LINK} href="https://wikimediafoundation.org/" rel="noreferrer">
            Wikimedia Foundation
          </a>{" "}
          written by volunteers.
        </p>
        <p className={PARAGRAPH}>
          We did not read Wiktionary directly. We use the automatic extraction published by{" "}
          <a className={LINK} href="https://kaikki.org/itwiktionary/" rel="noreferrer">
            kaikki.org
          </a>
          , produced with{" "}
          <a className={LINK} href="https://github.com/tatuylonen/wiktextract" rel="noreferrer">
            wiktextract
          </a>{" "}
          by Tatu Ylonen.
        </p>
      </section>

      <section aria-labelledby="licence">
        <h2 className={SECTION_HEADING} id="licence">Licence</h2>
        <p className={PARAGRAPH}>
          Wiktionary&rsquo;s text is published under{" "}
          <a className={LINK} href={LICENCE_URL} rel="noreferrer">
            Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)
          </a>
          .
        </p>
        {/* The credit the licence asks for: the authors, and where a reader can
            see who they are. The source stores no author list, and the page
            history is where Wiktionary keeps one, so that is what is named. */}
        <p className={PARAGRAPH}>
          The material is written by Wiktionary&rsquo;s contributors. The authors of each entry
          are listed in the page history of that entry&rsquo;s Wiktionary page, which is where
          Wiktionary keeps them; every result on Lexema links to the entry&rsquo;s page, and its
          history is reachable from there.
        </p>
        <p className={PARAGRAPH}>
          The material is provided as-is, without warranties of any kind, as{" "}
          <a className={LINK} href={LICENCE_TEXT_URL} rel="noreferrer">
            section 5 of the licence
          </a>{" "}
          provides. Lexema does not warrant that the definitions are accurate or complete.
        </p>
      </section>

      <section aria-labelledby="changed">
        <h2 className={SECTION_HEADING} id="changed">What we changed</h2>
        <p className={PARAGRAPH}>Lexema modified this material. Specifically:</p>
        <ul className={PROSE_LIST}>
          <li>the data was extracted from wiki text and converted into a data structure;</li>
          <li>entries were indexed by exact form and by inflected form, to make search possible;</li>
          <li>
            the source&rsquo;s grammatical tags were mapped onto a smaller, uniform set;
          </li>
          <li>some information present in the source was not imported;</li>
          <li>
            articles and other grammatical indications marked as derived by Lexema come from our
            own deterministic rules and are not from the source.
          </li>
        </ul>
        <p className={PARAGRAPH}>
          The wording of the definitions was not rewritten and was not generated. Where Lexema
          adds content of its own, it is always labelled as such and kept separate from the
          source&rsquo;s text.
        </p>
      </section>

      <section aria-labelledby="version">
        <h2 className={SECTION_HEADING} id="version">Which data this is</h2>
        <ReleaseIdentity release={release} />
      </section>

      {/* The draft in docs/ATTRIBUTION_NOTICES.md leaves these open. They are
          shown as open rather than filled in: a guessed licence or a guessed
          extractor version would be a claim nobody made. */}
      <section aria-labelledby="open">
        <h2 className={SECTION_HEADING} id="open">Still open</h2>
        <dl className={OPEN_FIELDS}>
          <OpenField title="The licence for Lexema’s own material">
            Lexema has not decided the licence for what it writes itself — its own explanations,
            examples and review records. It is settled by the open decision recorded as §4 of
            Lexema’s licensing record, and nothing is assumed here until it is.
          </OpenField>
          <OpenField title="Pronunciation and audio">
            Lexema ships no audio. Audio files carry a licence and an author per file, so shipping
            any waits on the per-file review recorded as §5 of Lexema’s licensing record.
          </OpenField>
          <OpenField title="The version of the extractor">
            The version of wiktextract that produced this extraction is not recorded: the release
            carries no field for it yet. It is settled by recording that version at import, and
            until then this page states nothing in its place.
          </OpenField>
        </dl>
      </section>

      <section aria-labelledby="trademarks">
        <h2 className={SECTION_HEADING} id="trademarks">Trademarks</h2>
        <p className={PARAGRAPH}>
          Wikipedia, Wiktionary, Wikizionario and Wikimedia are registered trademarks of the
          Wikimedia Foundation, Inc. Lexema is not affiliated with the Wikimedia Foundation and is
          neither endorsed nor sponsored by it.
        </p>
      </section>

      <section aria-labelledby="other-sources">
        <h2 className={SECTION_HEADING} id="other-sources">
          Other sources consulted
        </h2>
        <p className={PARAGRAPH}>
          During development we consulted third-party dictionaries, among them the{" "}
          <a className={LINK} href="https://www.treccani.it/vocabolario/" rel="noreferrer">
            Vocabolario Treccani
          </a>
          , solely as an editorial cross-check.{" "}
          <strong>No text from those sources was imported into Lexema.</strong>
        </p>
      </section>
    </main>
    </>
  );
}
