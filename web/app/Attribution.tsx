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

const LICENCE_URL = "https://creativecommons.org/licenses/by-sa/4.0/";
const LICENCE_TEXT_URL = "https://creativecommons.org/licenses/by-sa/4.0/legalcode";

/**
 * One column of the release row.
 *
 * `null` is the import saying it did not know the value, which is a different
 * fact from an empty one, so it is said in words. Nothing here falls back to a
 * default: a release identity that guesses is worse than one that admits a gap.
 */
function Recorded({ value }: { value: string | null }) {
  return value === null ? (
    <span className="empty">not recorded</span>
  ) : (
    <code>{value}</code>
  );
}

/** A field of the draft that is still open, and what would close it. */
function OpenField({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="open-field">
      <dt>
        {title} <span className="ambiguous">— open</span>
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

/**
 * The release identity, or the reason there is none to show.
 *
 * A page that cannot read its release says so rather than rendering a table of
 * blanks, which would read as a release with no identity at all.
 */
function ReleaseIdentity({ release }: { release: ReleaseInfo | undefined }) {
  if (release === undefined) {
    return (
      <p className="empty" role="status">
        The release serving this site could not be read, so this page cannot state which
        snapshot of the source it is showing. Nothing is assumed in its place.
      </p>
    );
  }

  return (
    <dl className="release-identity">
      <div>
        <dt>Release</dt>
        <dd>
          <code>{release.releaseId}</code>
        </dd>
      </div>
      <div>
        <dt>Source file</dt>
        <dd>
          {release.sourceUrl === null ? (
            <span className="empty">not recorded</span>
          ) : (
            <a href={release.sourceUrl} rel="noreferrer">
              <code>{release.sourceUrl}</code>
            </a>
          )}
        </dd>
      </div>
      <div>
        <dt>Downloaded at (UTC)</dt>
        <dd>
          <Recorded value={release.retrievedAt} />
        </dd>
      </div>
      <div>
        <dt>SHA-256 of the downloaded file</dt>
        <dd>
          <code>{release.archiveSha256}</code>
        </dd>
      </div>
      <div>
        <dt>Upstream Wiktionary dump</dt>
        <dd>
          <Recorded value={release.upstreamRelease} />
        </dd>
      </div>
    </dl>
  );
}

/** The whole page, over one release. */
export function Attribution({ release }: { release: ReleaseInfo | undefined }) {
  return (
    <main>
      <h1>Sources and licences</h1>

      <section aria-labelledby="where">
        <h2 id="where">Where the definitions come from</h2>
        <p>
          Lexema&rsquo;s Italian lexical data comes from the{" "}
          <a href="https://it.wiktionary.org/" rel="noreferrer">
            Italian Wiktionary
          </a>
          , the Italian edition of Wiktionary, a project of the{" "}
          <a href="https://wikimediafoundation.org/" rel="noreferrer">
            Wikimedia Foundation
          </a>{" "}
          written by volunteers.
        </p>
        <p>
          We did not read Wiktionary directly. We use the automatic extraction published by{" "}
          <a href="https://kaikki.org/itwiktionary/" rel="noreferrer">
            kaikki.org
          </a>
          , produced with{" "}
          <a href="https://github.com/tatuylonen/wiktextract" rel="noreferrer">
            wiktextract
          </a>{" "}
          by Tatu Ylonen.
        </p>
      </section>

      <section aria-labelledby="licence">
        <h2 id="licence">Licence</h2>
        <p>
          Wiktionary&rsquo;s text is published under{" "}
          <a href={LICENCE_URL} rel="noreferrer">
            Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)
          </a>
          .
        </p>
        {/* The credit the licence asks for: the authors, and where a reader can
            see who they are. The source stores no author list, and the page
            history is where Wiktionary keeps one, so that is what is named. */}
        <p>
          The material is written by Wiktionary&rsquo;s contributors. The authors of each entry
          are listed in the page history of that entry&rsquo;s Wiktionary page, which is where
          Wiktionary keeps them; every result on Lexema links to the entry&rsquo;s page, and its
          history is reachable from there.
        </p>
        <p>
          The material is provided as-is, without warranties of any kind, as{" "}
          <a href={LICENCE_TEXT_URL} rel="noreferrer">
            section 5 of the licence
          </a>{" "}
          provides. Lexema does not warrant that the definitions are accurate or complete.
        </p>
      </section>

      <section aria-labelledby="changed">
        <h2 id="changed">What we changed</h2>
        <p>Lexema modified this material. Specifically:</p>
        <ul>
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
        <p>
          The wording of the definitions was not rewritten and was not generated. Where Lexema
          adds content of its own, it is always labelled as such and kept separate from the
          source&rsquo;s text.
        </p>
      </section>

      <section aria-labelledby="version">
        <h2 id="version">Which data this is</h2>
        <ReleaseIdentity release={release} />
      </section>

      {/* The draft in docs/ATTRIBUTION_NOTICES.md leaves these open. They are
          shown as open rather than filled in: a guessed licence or a guessed
          extractor version would be a claim nobody made. */}
      <section aria-labelledby="open">
        <h2 id="open">Still open</h2>
        <dl className="open-fields">
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
        <h2 id="trademarks">Trademarks</h2>
        <p>
          Wikipedia, Wiktionary, Wikizionario and Wikimedia are registered trademarks of the
          Wikimedia Foundation, Inc. Lexema is not affiliated with the Wikimedia Foundation and is
          neither endorsed nor sponsored by it.
        </p>
      </section>

      <section aria-labelledby="other-sources">
        <h2 id="other-sources">Other sources consulted</h2>
        <p>
          During development we consulted third-party dictionaries, among them the{" "}
          <a href="https://www.treccani.it/vocabolario/" rel="noreferrer">
            Vocabolario Treccani
          </a>
          , solely as an editorial cross-check.{" "}
          <strong>No text from those sources was imported into Lexema.</strong>
        </p>
      </section>
    </main>
  );
}
