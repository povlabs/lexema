// The page's own markup, with no database in it.
//
// Split from `page.tsx` so every state this page can be in is a value away
// rather than a running Worker away: `web/test/page.test.tsx` renders these
// components to HTML over an imported fixture release, and that test runs in CI
// with no archive and no D1. What `page.tsx` adds is where the data comes from.

import type { ReactNode } from "react";
import type { Attempt } from "./attempt.ts";
import { ReadingCard } from "./Reading";

/**
 * The shell every state shares: the heading, the search form, and the one
 * `main` landmark. The form is a plain GET form, so the query lands in the URL
 * and the page works before any JavaScript does.
 */
export function SearchPage({ raw, children }: { raw: string; children: ReactNode }) {
  return (
    <main>
      <h1>Lexema</h1>
      <p className="tagline">Italian words, as the source dictionary has them.</p>

      <form action="/" method="get" role="search">
        <label htmlFor="q">Italian word</label>
        <input
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
        <button type="submit">Search</button>
      </form>

      {children}
    </main>
  );
}

/** Nothing asked yet. */
export function FirstLoad() {
  return (
    <p className="hint">
      Try <a href="/?q=sale" lang="it">sale</a>,{" "}
      <a href="/?q=studenti" lang="it">studenti</a> or{" "}
      <a href="/?q=bella" lang="it">bella</a> — each shows a different kind of ambiguity.
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
    <p className="pending" role="status">
      Searching for <q lang="it">{raw.trim()}</q> …
    </p>
  );
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
        <p className="error" role="alert">
          {attempt.rejection.reason === "empty"
            ? "Type a word to search for."
            : `That is ${attempt.rejection.length} characters. The limit is ${attempt.rejection.limit}.`}
        </p>
      )}

      {/* The database did not answer. Saying so is the point: a reader must be
          able to tell "we could not look" from "we looked and found nothing".
          Why it failed is in the Worker's log, not on this page. */}
      {attempt.outcome === "failed" && (
        <p className="error" role="alert">
          The lookup failed, so this page cannot say whether <q lang="it">{raw.trim()}</q> is in
          the dictionary. Try again in a moment.
        </p>
      )}

      {attempt.outcome === "not-found" && (
        <p className="empty" role="status">
          Nothing in this release matches <q lang="it">{attempt.query.raw.trim()}</q>. Accents
          matter: <code lang="it">citta</code> and <code lang="it">città</code> are different
          words.
        </p>
      )}

      {attempt.outcome === "found" && (
        <>
          <p className="count" role="status">
            {attempt.readings.length} {attempt.readings.length === 1 ? "entry" : "entries"} for{" "}
            <q lang="it">{attempt.query.raw.trim()}</q>
          </p>
          {attempt.readings.map((reading) => (
            <ReadingCard key={reading.recordId} reading={reading} query={attempt.query.raw.trim()} />
          ))}
        </>
      )}

      {(attempt.outcome === "found" || attempt.outcome === "not-found") && (
        <footer className="release">
          <p>
            Release <code>{attempt.release.releaseId}</code>
          </p>
        </footer>
      )}
    </>
  );
}
