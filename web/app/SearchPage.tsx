// The page's own markup, with no database in it.
//
// Split from `page.tsx` so every state this page can be in is a value away
// rather than a running Worker away: `web/test/page.test.tsx` renders these
// components to HTML over an imported fixture release, and that test runs in CI
// with no archive and no D1. What `page.tsx` adds is where the data comes from.
//
// Nothing here is a client component. The form is a plain GET form and every
// state is decided by the URL, so no part of this page holds client state and no
// `"use client"` boundary exists — the interactive parts Base UI supplies are
// what the first card that needs one will reach for (#48).

import type { ReactNode } from "react";
import { isFormOfReading } from "@lexema/lookup/types.ts";
import type { Reading } from "@lexema/lookup/types.ts";
import type { Attempt } from "./attempt.ts";
import { ReadingCard } from "./Reading";
import {
  COUNT,
  WORD_LAYER,
  WORD_HEADING,
  READING_INDEX,
  INDEX_LIST,
  INDEX_LINK,
  INDEX_NUMBER,
  INDEX_GLOSS,
  READING_NUMBER,
  EMPTY,
  ERROR,
  HINT,
  LINK,
  PENDING,
  RELEASE_FOOTER,
  RELEASE_LINE,
  SEARCH_BUTTON,
  SEARCH_FORM,
  SEARCH_INPUT,
  SEARCH_LABEL,
  SHELL_CENTRED,
  SHELL_TOP,
  SITE_NAME,
  TAGLINE,
} from "./styles.ts";

/**
 * The shell every state shares: the heading, the search form, and the one
 * `main` landmark. The form is a plain GET form, so the query lands in the URL
 * and the page works before any JavaScript does.
 *
 * Two states, one bar. "Before a query, the page is the search bar alone,
 * centred on the screen with the site name above it and nothing else competing.
 * With a query, the bar sits at the top and the results fill the page below it"
 * (design-system-manifest.md § "The page"). Which state this is is read off the
 * query itself, and the only thing that changes is how the column is laid out:
 * the same `main`, the same `h1`, the same one form, so a result stays
 * shareable by its URL and moving the bar is layout rather than a second route.
 */
export function SearchPage({ raw, children }: { raw: string; children: ReactNode }) {
  const asked = raw.trim() !== "";

  return (
    <main className={asked ? SHELL_TOP : SHELL_CENTRED}>
      <h1 className={SITE_NAME}>Lexema</h1>
      <p className={TAGLINE}>Italian words, as the source dictionary has them.</p>

      <form className={SEARCH_FORM} action="/" method="get" role="search">
        <label className={SEARCH_LABEL} htmlFor="q">
          Italian word
        </label>
        <input
          className={SEARCH_INPUT}
          id="q"
          name="q"
          type="search"
          defaultValue={raw}
          placeholder="casa"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          lang="it"
          autoFocus
        />
        <button className={SEARCH_BUTTON} type="submit">
          Search
        </button>
      </form>

      {children}
    </main>
  );
}

/** Nothing asked yet. */
export function FirstLoad() {
  return (
    <p className={HINT}>
      Try{" "}
      <a className={LINK} href="/?q=sale" lang="it">
        sale
      </a>
      ,{" "}
      <a className={LINK} href="/?q=studenti" lang="it">
        studenti
      </a>{" "}
      or{" "}
      <a className={LINK} href="/?q=bella" lang="it">
        bella
      </a>{" "}
      — each shows a different kind of ambiguity.
    </p>
  );
}

/**
 * The lookup is running.
 *
 * This is the fallback of the streaming boundary in `page.tsx`: the shell above
 * is flushed as soon as the request is understood, and this stands in the
 * result's place until the D1 read answers. It is the smallest honest loading
 * state a server-rendered page has — no client JavaScript, and nothing that
 * pretends to know the answer yet. On a local D1 the read is usually faster
 * than the first flush, and then a reader never sees it.
 */
export function Pending({ raw }: { raw: string }) {
  return (
    <p className={PENDING} role="status">
      Searching for <q lang="it">{raw.trim()}</q> …
    </p>
  );
}

/**
 * Direct readings stay in the source's order: a word with a base reading
 * leads with it, as in the design's sale and studente frames. When only a
 * form-of record matches the queried headword, it leads the embedded lemma's
 * table (#49). Neither branch drops or merges a reading.
 */
export function pageOrder(readings: readonly Reading[]): Reading[] {
  if (readings.some((reading) => reading.isAboutQuery && !isFormOfReading(reading))) {
    return [...readings];
  }
  return [
    ...readings.filter((reading) => isFormOfReading(reading)),
    ...readings.filter((reading) => !isFormOfReading(reading)),
  ];
}

/**
 * Every state a probed query can land in, and the release under it.
 *
 * Each is said plainly rather than collapsed into one blank page: asked badly,
 * the lookup itself failed, asked and not found, asked and found.
 *
 * The credit is not here. [ADR 0009](../../.decisions/0009-two-licences-and-a-source-link.md)
 * puts no credit line, licence name or contributor text on the search page: each
 * reading carries a *Source* link to its Wiktionary page, and the full credit is
 * on `/attribution`, which the site footer reaches from every page. What stays
 * below is provenance rather than credit — which release answered, so that the
 * line numbers and pointers on each card name something exact.
 */
export function Outcome({ raw, attempt }: { raw: string; attempt: Attempt }) {
  return (
    <>
      {attempt.outcome === "rejected" && (
        <p className={ERROR} role="alert">
          {attempt.rejection.reason === "empty"
            ? "Type a word to search for."
            : `That is ${attempt.rejection.length} characters. The limit is ${attempt.rejection.limit}.`}
        </p>
      )}

      {/* The database did not answer. Saying so is the point: a reader must be
          able to tell "we could not look" from "we looked and found nothing".
          Why it failed is in the Worker's log, not on this page. */}
      {attempt.outcome === "failed" && (
        <p className={ERROR} role="alert">
          The lookup failed, so this page cannot say whether <q lang="it">{raw.trim()}</q> is in
          the dictionary. Try again in a moment.
        </p>
      )}

      {attempt.outcome === "not-found" && (
        <p className={EMPTY} role="status">
          Nothing in this release matches <q lang="it">{attempt.query.raw.trim()}</q>. Accents
          matter: <code lang="it">citta</code> and <code lang="it">città</code> are different
          words.
        </p>
      )}

      {attempt.outcome === "found" && (
        <>
          <p className={COUNT} role="status">
            {attempt.readings.length} {attempt.readings.length === 1 ? "entry" : "entries"} for{" "}
            <q lang="it">{attempt.query.raw.trim()}</q>
          </p>
          <section className={WORD_LAYER} aria-label="Word">
            <h2 className={WORD_HEADING} lang="it">{attempt.query.raw.trim()}</h2>
          </section>
          {attempt.readings.length > 1 && (
            <nav className={READING_INDEX} aria-label="Reading index">
              <h2>Readings</h2>
              <ol className={INDEX_LIST}>
                {pageOrder(attempt.readings).map((reading, index) => (
                  <li key={reading.recordId}>
                    <a className={INDEX_LINK} href={`#reading-${reading.recordId}`}>
                      <span className={INDEX_NUMBER}>{index + 1}</span>
                      <span>{reading.pos === "adj" ? "adjective" : reading.pos === "noun" ? "noun" : reading.pos === "verb" ? "verb" : reading.posTitle}</span>
                      {reading.senses[0]?.glosses[0] && (
                        <span className={INDEX_GLOSS} lang="it">{reading.senses[0].glosses[0].text}</span>
                      )}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}
          {pageOrder(attempt.readings).map((reading, index) => (
            <div key={reading.recordId} id={`reading-${reading.recordId}`}>
              {attempt.readings.length > 1 && <p className={READING_NUMBER}>Reading {index + 1}</p>}
              <ReadingCard reading={reading} query={attempt.query.raw.trim()} />
            </div>
          ))}
        </>
      )}

      {(attempt.outcome === "found" || attempt.outcome === "not-found") && (
        <footer className={RELEASE_FOOTER}>
          <p className={RELEASE_LINE}>
            Release <code>{attempt.release.releaseId}</code>
          </p>
        </footer>
      )}
    </>
  );
}
